import { Patient } from '../../../types';

// ═══════════════════════════════════════════════════════════════
// DE-IDENTIFICAÇÃO (LGPD) — pré-requisito do corpus de treinamento
// ═══════════════════════════════════════════════════════════════
// Laudos são dados sensíveis de saúde. Antes de qualquer texto entrar
// no corpus de excelência ou ser enviado a um juiz LLM para avaliação,
// passa por esta de-identificação determinística (sem IA, reproduzível).
//
// Estratégia em duas frentes:
//   1. Substituição de valores CONHECIDOS (vindos do objeto Patient).
//   2. Regex para PII estrutural brasileira (CPF, RG, telefone, e-mail,
//      datas, números de prontuário).
//
// O objetivo é preservar 100% do valor clínico (estrutura, fraseologia,
// raciocínio, medidas) e remover 100% do que identifica o paciente.

export interface AnonymizationReport {
  text: string;
  /** Quantas substituições ocorreram por categoria (auditoria). */
  redactions: Record<string, number>;
}

/** Escapa uma string para uso seguro dentro de um RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove acentos para casar nomes com/sem diacríticos. */
function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // CPF: 000.000.000-00 ou 00000000000
  { name: 'cpf', pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: '[CPF]' },
  // RG: variações com pontos/traço (6 a 9 dígitos)
  { name: 'rg', pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX]\b/g, replacement: '[RG]' },
  // CNS (Cartão Nacional de Saúde): 15 dígitos
  { name: 'cns', pattern: /\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: '[CNS]' },
  // E-mail
  { name: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[EMAIL]' },
  // Telefone BR: (00) 00000-0000, +55..., 0000-0000
  { name: 'telefone', pattern: /(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, replacement: '[TELEFONE]' },
  // Datas: 00/00/0000, 00-00-0000, 00.00.0000
  { name: 'data', pattern: /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g, replacement: '[DATA]' },
];

/**
 * De-identifica um texto de laudo. Quando o objeto Patient é fornecido,
 * substitui os valores nominais conhecidos antes das regex genéricas —
 * o que é muito mais confiável do que tentar NER de nomes via regex.
 */
export function anonymizeReport(html: string, patient?: Patient | null): AnonymizationReport {
  if (!html) return { text: '', redactions: {} };

  let text = html;
  const redactions: Record<string, number> = {};

  const apply = (name: string, pattern: RegExp, replacement: string) => {
    let count = 0;
    text = text.replace(pattern, () => {
      count++;
      return replacement;
    });
    if (count > 0) redactions[name] = (redactions[name] || 0) + count;
  };

  // 1. Substituição de valores conhecidos do paciente.
  if (patient) {
    const known: Array<{ name: string; raw?: string; token: string }> = [
      { name: 'nome', raw: patient.name, token: '[PACIENTE]' },
      { name: 'cpf', raw: (patient as any).cpf, token: '[CPF]' },
      { name: 'rg', raw: (patient as any).rg, token: '[RG]' },
      { name: 'email', raw: (patient as any).email, token: '[EMAIL]' },
      { name: 'telefone', raw: (patient as any).phone, token: '[TELEFONE]' },
    ];

    for (const { name, raw, token } of known) {
      if (!raw || String(raw).trim().length < 2) continue;
      const value = String(raw).trim();
      // Casa o valor literal e, para nomes, também cada palavra ≥3 letras
      // (cobre laudos que citam só o primeiro/último nome).
      apply(name, new RegExp(escapeRegExp(value), 'gi'), token);
      if (name === 'nome') {
        const parts = stripDiacritics(value)
          .split(/\s+/)
          .filter((p) => p.replace(/[^A-Za-z]/g, '').length >= 3);
        for (const part of parts) {
          apply('nome', new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'), token);
        }
      }
    }
  }

  // 2. Regex de PII estrutural.
  for (const { name, pattern, replacement } of PII_PATTERNS) {
    apply(name, pattern, replacement);
  }

  return { text, redactions };
}

/**
 * Verifica se um texto ainda contém PII residual aparente. Usado como
 * gate de segurança antes de persistir no corpus — se retornar problemas,
 * o documento NÃO deve ser salvo.
 */
export function detectResidualPII(text: string): string[] {
  const problems: string[] = [];
  for (const { name, pattern } of PII_PATTERNS) {
    // Reconstrói o regex sem flag global para teste pontual.
    const probe = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    if (probe.test(text)) problems.push(name);
  }
  return problems;
}

// ═══════════════════════════════════════════════════════════════
// CAMADA DE VERIFICAÇÃO ANTI-ALUCINAÇÃO
// ═══════════════════════════════════════════════════════════════
// Rede de segurança DETERMINÍSTICA (código, não IA) executada após a
// geração. Mesmo com prompts perfeitos, LLMs alucinam — em laudo médico
// uma alucinação é risco assistencial. Estas verificações são rápidas,
// reproduzíveis e auditáveis.
//
// Complementa auditReportQuality (que cobre estrutura). Aqui o foco é
// COERÊNCIA CLÍNICA: classificações obrigatórias, unidades, e coerência
// entre conclusão e análise.

export interface VerificationIssue {
  type:
    | 'unit'
    | 'missing_classification'
    | 'coherence'
    | 'ungrounded_measurement';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface VerificationReport {
  /** True se nenhum problema de severidade 'error' foi encontrado. */
  passed: boolean;
  issues: VerificationIssue[];
}

export interface VerificationContext {
  area?: string;
  anamnesis?: string;
  clinicalIndication?: string;
}

/** Extrai o conteúdo textual de uma seção <h2>NOME</h2> ... até o próximo <h2>. */
function extractSection(html: string, sectionName: string): string {
  const re = new RegExp(`<h2[^>]*>\\s*${sectionName}[^<]*<\\/h2>([\\s\\S]*?)(?=<h2|$)`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

/** Remove tags HTML para análise de texto puro. */
function plain(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── 1. Consistência de unidades ────────────────────────────────────────────
// Em medicina-fetal, todas as medidas devem ser em mm (regra R do sistema).
function checkUnits(html: string, ctx: VerificationContext): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  if (ctx.area !== 'medicina-fetal') return issues;

  // Procura medidas em cm fora de observações metodológicas.
  const body = html.replace(
    /<h2[^>]*>OBSERVA[ÇC][ÕO]ES\s+METODOL[OÓ]GICAS<\/h2>[\s\S]*$/i,
    ''
  );
  const cmMatches = body.match(/\d+[.,]?\d*\s?cm\b/gi);
  if (cmMatches && cmMatches.length > 0) {
    issues.push({
      type: 'unit',
      severity: 'error',
      message: `Medicina-fetal exige milímetros (mm), mas foram encontradas ${cmMatches.length} medida(s) em cm: ${cmMatches.slice(0, 3).join(', ')}.`,
    });
  }
  return issues;
}

// ─── 2. Classificações obrigatórias por achado ──────────────────────────────
function checkMandatoryClassifications(html: string): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const text = plain(html).toLowerCase();

  const rules: Array<{
    findingRe: RegExp;
    classRe: RegExp;
    label: string;
    severity: 'error' | 'warning';
  }> = [
    {
      findingRe: /(mama|mamári|mamar)/,
      classRe: /bi-?rads/i,
      label: 'Achado mamário sem classificação BI-RADS',
      severity: 'error',
    },
    {
      findingRe: /(tireoid|tireóid).*(nódulo|nodulo)/,
      classRe: /ti-?rads/i,
      label: 'Nódulo tireoidiano sem classificação TI-RADS',
      severity: 'error',
    },
    {
      findingRe: /(ovári|ovário|anexial|anexo).*(massa|cisto|formação|formacao|tumor)/,
      classRe: /o-?rads/i,
      label: 'Formação anexial/ovariana sem classificação O-RADS',
      severity: 'warning',
    },
    {
      findingRe: /mioma/,
      classRe: /figo/i,
      label: 'Mioma sem classificação FIGO',
      severity: 'warning',
    },
  ];

  for (const rule of rules) {
    if (rule.findingRe.test(text) && !rule.classRe.test(text)) {
      issues.push({
        type: 'missing_classification',
        severity: rule.severity,
        message: `${rule.label}. Verificar se a classificação aplicável foi omitida.`,
      });
    }
  }
  return issues;
}

// ─── 3. Coerência conclusão ↔ análise ───────────────────────────────────────
function checkCoherence(html: string): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const analysis = plain(extractSection(html, 'AN[ÁA]LISE')).toLowerCase();
  const conclusionRaw = extractSection(html, 'CONCLUS[ÃA]O');
  const conclusion = plain(conclusionRaw);
  if (!conclusion) return issues;

  // 3a. Classificações citadas na conclusão devem existir na análise.
  const classTokens = conclusion.match(/(BI-?RADS|TI-?RADS|O-?RADS|LI-?RADS|BOSNIAK|FIGO)\s*[0-9IVXa-c]+/gi) || [];
  for (const token of classTokens) {
    const normalized = token.replace(/\s+/g, ' ').toLowerCase();
    const base = normalized.split(' ')[0].replace(/-/g, '');
    if (!analysis.replace(/-/g, '').includes(base)) {
      issues.push({
        type: 'coherence',
        severity: 'warning',
        message: `Classificação "${token}" aparece na CONCLUSÃO mas o sistema correspondente não foi localizado na ANÁLISE.`,
      });
    }
  }

  // 3b. ALERTA (R6) na conclusão deve ter base de urgência na análise.
  if (/alerta/i.test(conclusion)) {
    const urgencyTerms = [
      'aneurisma', 'dissecção', 'dissecao', 'trombo', 'ectópica', 'ectopica',
      'torção', 'torcao', 'abscesso', 'hemoperitoneo', 'isquemia', 'espiculad',
      'suspeit', 'malign', 'ruptura', 'séptic', 'septic', '≥', 'acima',
    ];
    const hasBasis = urgencyTerms.some((t) => analysis.includes(t));
    if (!hasBasis) {
      issues.push({
        type: 'coherence',
        severity: 'warning',
        message: 'Há ALERTA (R6) na CONCLUSÃO, mas a ANÁLISE não evidencia claramente o achado de urgência correspondente. Revisar fundamentação.',
      });
    }
  }

  return issues;
}

// ─── 4. Rastreabilidade de medidas (informacional) ──────────────────────────
// Lista medidas com unidade no laudo que NÃO aparecem na entrada clínica.
// Podem ser valores normais do template OU invenções — exige olhar humano.
// Severidade 'info': nunca bloqueia, apenas auxilia a revisão.
function checkMeasurementGrounding(html: string, ctx: VerificationContext): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const input = `${ctx.anamnesis || ''} ${ctx.clinicalIndication || ''}`.trim();
  if (input.length < 10) return issues; // sem entrada para fundamentar — não verifica

  const inputDigits = input.replace(/[^\d]/g, ' ');
  const body = plain(html);
  const measurements = body.match(/\d+[.,]?\d*\s?(mm|cm|cm³|cm3|mL|ml|g|mm²|mm2|cm\/s)\b/gi) || [];

  const ungrounded = new Set<string>();
  for (const measure of measurements) {
    const numericCore = measure.match(/\d+[.,]?\d*/)?.[0]?.replace(',', '.') || '';
    const intPart = numericCore.split('.')[0];
    // Considera fundamentado se o número inteiro aparece na entrada.
    if (intPart.length >= 1 && !inputDigits.includes(intPart)) {
      ungrounded.add(measure.trim());
    }
  }

  if (ungrounded.size > 0) {
    const list = [...ungrounded].slice(0, 8);
    issues.push({
      type: 'ungrounded_measurement',
      severity: 'info',
      message: `${ungrounded.size} medida(s) no laudo não constam na entrada clínica (podem ser valores normais do template ou requerer conferência): ${list.join(', ')}.`,
    });
  }
  return issues;
}

/**
 * Verifica um laudo gerado quanto a alucinações clínicas. Determinístico.
 * Retorna passed=false apenas se houver problema de severidade 'error'.
 */
export function verifyReport(html: string, ctx: VerificationContext = {}): VerificationReport {
  if (!html || html.trim().length < 50) {
    return { passed: false, issues: [{ type: 'coherence', severity: 'error', message: 'Laudo vazio ou muito curto para verificação.' }] };
  }

  const issues: VerificationIssue[] = [
    ...checkUnits(html, ctx),
    ...checkMandatoryClassifications(html),
    ...checkCoherence(html),
    ...checkMeasurementGrounding(html, ctx),
  ];

  const passed = !issues.some((i) => i.severity === 'error');
  return { passed, issues };
}

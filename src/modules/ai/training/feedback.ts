// ═══════════════════════════════════════════════════════════════
// LOOP DE FEEDBACK — mineração de correções
// ═══════════════════════════════════════════════════════════════
// Quando o médico refina/edita um laudo gerado, o delta entre a geração
// inicial e o laudo final aprovado carrega sinal de aprendizado. Aqui
// classificamos esse delta em categorias e agregamos padrões repetidos
// que viram regras de calibração pessoal (Camada 0.5).
//
// Lógica PURA e determinística. Uma correção isolada é ruído; só padrões
// com frequência estatística (ou de segurança) viram regra.

export type CorrectionCategory =
  | 'omissao'            // o médico ADICIONOU conteúdo que a IA não gerou
  | 'invencao-removida'  // o médico REMOVEU conteúdo que a IA inventou
  | 'fraseologia'        // mudança de redação/estilo, mesmo sentido
  | 'calculo'            // medidas/números alterados
  | 'classificacao'      // classificação adicionada/corrigida
  | 'urgencia-perdida';  // ALERTA (R6) presente no final, ausente na geração

export interface CorrectionSignal {
  area: string;
  examType: string;
  motor?: 'lite' | 'pro';
  categories: CorrectionCategory[];
  /** Fração do texto que mudou (0-1), via distância de Jaccard. */
  magnitude: number;
  /** True se a mudança ultrapassa o limiar de significância (>15%). */
  significant: boolean;
  /** True se houve urgência perdida — incidente crítico, qualquer frequência. */
  critical: boolean;
}

const SIGNIFICANCE_THRESHOLD = 0.15;
const CLASS_RE = /(BI-?RADS|TI-?RADS|O-?RADS|LI-?RADS|BOSNIAK|FIGO|NASCET|CEAP)/i;

function plain(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function tokenize(text: string): Set<string> {
  return new Set(text.split(/\s+/).filter((t) => t.length > 2));
}

function numbers(text: string): Set<string> {
  return new Set((text.match(/\d+[.,]?\d*/g) || []));
}

/** Distância de Jaccard entre dois conjuntos de tokens (0 = idêntico, 1 = disjunto). */
function jaccardDistance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : 1 - inter / union;
}

/**
 * Classifica a correção entre o laudo gerado e o laudo final aprovado.
 */
export function classifyCorrection(
  generated: string,
  final: string,
  meta: { area: string; examType: string; motor?: 'lite' | 'pro' }
): CorrectionSignal {
  const g = plain(generated);
  const f = plain(final);

  const gTokens = tokenize(g);
  const fTokens = tokenize(f);
  const magnitude = jaccardDistance(gTokens, fTokens);

  const categories = new Set<CorrectionCategory>();

  // Urgência perdida — incidente crítico.
  const finalHasAlert = /alerta/.test(f);
  const genHasAlert = /alerta/.test(g);
  const critical = finalHasAlert && !genHasAlert;
  if (critical) categories.add('urgencia-perdida');

  // Classificação adicionada/corrigida.
  const finalClasses = f.match(CLASS_RE);
  const genClasses = g.match(CLASS_RE);
  if (finalClasses && !genClasses) categories.add('classificacao');

  // Cálculo/medidas alteradas.
  const gNums = numbers(g);
  const fNums = numbers(f);
  if (jaccardDistance(gNums, fNums) > 0.2) categories.add('calculo');

  // Omissão vs. invenção-removida (delta de conteúdo).
  const addedTokens = [...fTokens].filter((t) => !gTokens.has(t)).length;
  const removedTokens = [...gTokens].filter((t) => !fTokens.has(t)).length;
  if (addedTokens > removedTokens * 1.3 && addedTokens > 5) categories.add('omissao');
  if (removedTokens > addedTokens * 1.3 && removedTokens > 5) categories.add('invencao-removida');

  // Fraseologia: mudança moderada sem outras categorias dominantes.
  if (categories.size === 0 && magnitude > 0.05) categories.add('fraseologia');

  return {
    area: meta.area,
    examType: meta.examType,
    motor: meta.motor,
    categories: [...categories],
    magnitude: Math.round(magnitude * 1000) / 1000,
    significant: magnitude >= SIGNIFICANCE_THRESHOLD || critical,
    critical,
  };
}

export interface AggregatedPattern {
  area: string;
  examType: string;
  category: CorrectionCategory;
  count: number;
  /** True se algum sinal desse grupo foi crítico (urgência perdida). */
  critical: boolean;
}

/**
 * Agrega sinais de correção em padrões. Só retorna padrões com frequência
 * ≥ minFrequency OU que contenham incidente crítico (segurança não espera
 * frequência). Padrões críticos vêm primeiro.
 */
export function aggregatePatterns(
  signals: CorrectionSignal[],
  minFrequency = 5
): AggregatedPattern[] {
  const map = new Map<string, AggregatedPattern>();

  for (const s of signals) {
    if (!s.significant) continue;
    for (const category of s.categories) {
      const key = `${s.area}|${s.examType}|${category}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.critical = existing.critical || s.critical;
      } else {
        map.set(key, {
          area: s.area,
          examType: s.examType,
          category,
          count: 1,
          critical: s.critical,
        });
      }
    }
  }

  return [...map.values()]
    .filter((p) => p.count >= minFrequency || p.critical)
    .sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return b.count - a.count;
    });
}

const CATEGORY_HINTS: Record<CorrectionCategory, string> = {
  omissao: 'tende a OMITIR conteúdo que o médico precisa adicionar — seja mais completo',
  'invencao-removida': 'tende a INVENTAR conteúdo que o médico remove — seja mais conservador',
  fraseologia: 'a redação difere do padrão do médico — ajuste o vocabulário e o tom',
  calculo: 'medidas/cálculos costumam ser corrigidos — redobre a atenção numérica',
  classificacao: 'classificações são adicionadas pelo médico — não as omita',
  'urgencia-perdida': 'ALERTA de urgência foi perdido — INCIDENTE CRÍTICO de segurança',
};

/**
 * Constrói o bloco de Calibração Pessoal (Camada 0.5) a partir dos
 * padrões agregados. ATENÇÃO: este bloco deve passar pelo Harness de
 * Evals (Fase 1) antes de ser ativado em produção (Fase 4).
 */
export function buildCalibrationBlock(patterns: AggregatedPattern[]): string {
  if (patterns.length === 0) return '';

  const lines = patterns.map((p) => {
    const flag = p.critical ? '⚠️ CRÍTICO — ' : '';
    return `- Em ${p.area} / ${p.examType}: ${flag}${CATEGORY_HINTS[p.category]} (${p.count}x).`;
  });

  return `═══════════════════════════════════════════
CALIBRAÇÃO PESSOAL (aprendida das correções do médico)
═══════════════════════════════════════════
${lines.join('\n')}`;
}

import { ExamArea, Patient, ReportTemplate } from '../../../types';

// ═══════════════════════════════════════════════════════════════
// LAUD.IA TRAINING & EXCELLENCE — Fase 1: Harness de Avaliação
// ═══════════════════════════════════════════════════════════════
// Tipos centrais do sistema de avaliação (Evals). Nada aqui altera o
// motor de geração existente — é uma camada de medição paralela.

/** Dimensões de qualidade avaliadas em cada laudo gerado. */
export type EvalDimension =
  | 'fidelity'       // Lei da Não-Invenção: não inventou achados
  | 'completeness'   // Estrutura e classificações obrigatórias presentes
  | 'safety'         // R6/N4: urgências detectadas e sinalizadas
  | 'numeric'        // Cálculos, percentis e unidades corretos
  | 'style';         // Aderência à fraseologia/padrão do médico

/** Peso de cada dimensão no score final (soma = 1.0). */
export const DIMENSION_WEIGHTS: Record<EvalDimension, number> = {
  fidelity: 0.30,
  completeness: 0.20,
  safety: 0.25,
  numeric: 0.15,
  style: 0.10,
};

export const DIMENSION_LABELS: Record<EvalDimension, string> = {
  fidelity: 'Fidelidade Clínica',
  completeness: 'Completude Estrutural',
  safety: 'Segurança (R6/N4)',
  numeric: 'Precisão Numérica',
  style: 'Estilo e Fraseologia',
};

/**
 * Um caso do conjunto-ouro: entrada clínica + laudo de referência
 * aprovado pelo médico. É o "gabarito" contra o qual o motor é medido.
 */
export interface GoldenCase {
  id: string;
  area: ExamArea;
  examType: string;
  /** Complexidade clínica esperada (1 = rotina, 5 = alta complexidade). */
  complexity: 1 | 2 | 3 | 4 | 5;
  /** Motor que deveria ser usado para este caso. */
  expectedMotor: 'lite' | 'pro';
  /** Dados de entrada que alimentam a geração. */
  input: {
    template: ReportTemplate;
    patient: Patient | null;
    clinicalIndication?: string;
    requestingPhysician?: string;
    anamnesis?: string;
  };
  /** Laudo-referência aprovado (HTML), o padrão-ouro de qualidade. */
  referenceReport: string;
  /**
   * Asserções determinísticas que DEVEM ser satisfeitas independente
   * da nota subjetiva. Ex: laudo deve conter "ALERTA", BI-RADS, etc.
   */
  hardAssertions?: HardAssertion[];
  /** Descrição livre do que torna este caso importante (armadilha?). */
  notes?: string;
}

/** Verificação determinística de presença/ausência no laudo gerado. */
export interface HardAssertion {
  kind: 'mustContain' | 'mustNotContain' | 'mustMatch';
  /** String literal (para contain) ou padrão regex (para match). */
  value: string;
  /** Dimensão impactada se a asserção falhar. */
  dimension: EvalDimension;
  /** Mensagem explicativa exibida no relatório. */
  description: string;
}

/** Nota de uma única dimensão, atribuída pelo juiz LLM. */
export interface DimensionScore {
  dimension: EvalDimension;
  score: number;       // 0-100
  justification: string;
}

/** Resultado completo da avaliação de um laudo gerado contra seu gabarito. */
export interface EvalResult {
  caseId: string;
  area: ExamArea;
  examType: string;
  motorUsed: 'lite' | 'pro';
  /** Nota ponderada final (0-100). */
  weightedScore: number;
  dimensions: DimensionScore[];
  /** Asserções determinísticas que falharam. */
  failedAssertions: HardAssertion[];
  /** Resultado das verificações determinísticas (auditReportQuality + verifyReport). */
  deterministicIssues: Array<{ type: string; severity: 'error' | 'warning' | 'info'; message: string }>;
  latencyMs: number;
  generatedReport: string;
  /** True se nenhuma asserção de segurança falhou (gate crítico). */
  safetyPassed: boolean;
  timestamp: number;
}

/** Agregação de uma execução completa do harness sobre o Golden Dataset. */
export interface EvalRunResult {
  runId: string;
  promptVersion?: string;
  startedAt: number;
  finishedAt: number;
  totalCases: number;
  /** Médias ponderadas por dimensão sobre todos os casos. */
  averageByDimension: Record<EvalDimension, number>;
  /** Nota média ponderada geral. */
  overallScore: number;
  /** Quantos casos passaram no gate de segurança (meta: 100%). */
  safetyPassRate: number;
  results: EvalResult[];
}

/** Configuração de uma execução do harness. */
export interface HarnessOptions {
  /** Subconjunto de casos por id; se vazio, roda todos. */
  caseIds?: string[];
  /** Filtra por área. */
  area?: ExamArea;
  /** Identificador da versão de prompt sendo testada (auditoria). */
  promptVersion?: string;
  /** Callback de progresso (caso N de M). */
  onProgress?: (done: number, total: number, current: EvalResult) => void;
}

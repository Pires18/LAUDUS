import { ReportTemplate, Patient, AppSettings, ExamArea } from '../../types';

export interface GenerateReportParams {
  examId?: string;
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
  examDateMs?: number;
  signal?: AbortSignal;
}

export interface CopilotParams {
  examId?: string;
  instruction: string;
  currentReport: string;
  patient: Patient | null;
  exam: { examType: string; area: string; clinicalIndication?: string; requestingPhysician?: string; anamnesis?: string; createdAt?: number };
  settings: AppSettings;
  previousExams?: string[];
  template?: ReportTemplate | null;
  signal?: AbortSignal;
}

export interface RefineParams {
  examId?: string;
  currentReport: string;
  template: ReportTemplate;
  patient: Patient | null;
  settings: AppSettings;
  clinicalIndication?: string;
  requestingPhysician?: string;
  anamnesis?: string;
  previousExams?: string[];
  customPrompt?: string;
  examDateMs?: number;
  signal?: AbortSignal;
}

export interface BuiltPrompt {
  universalContext: string;
  areaContext: string;
  userMessage: string;
}

export interface CallMetrics {
  examId?: string;
  mode: 'generation' | 'refine' | 'copilot' | 'template';
  provider: 'gemini' | 'anthropic';
  area: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualOutputTokens?: number;
  latencyMs: number;
  timestamp: number;
  success: boolean;
  scratchpad?: string;
  modelName?: string;
}

export interface AiProvider {
  resolveModelName(settings: AppSettings, mode: string, area: string): string;
  generate(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    mode: string,
    signal?: AbortSignal,
    onComplete?: (scratchpad?: string) => void
  ): Promise<string>;
  stream(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    mode: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    onComplete?: (scratchpad?: string) => void
  ): Promise<string>;
  extractJson(
    built: BuiltPrompt,
    settings: AppSettings,
    area: string,
    signal?: AbortSignal
  ): Promise<any>;
}

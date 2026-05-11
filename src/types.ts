// Tipos centrais do sistema de laudos

export type ExamArea =
  | 'medicina-interna'
  | 'ginecologia'
  | 'medicina-fetal'
  | 'pequenas-partes'
  | 'musculoesqueletico'
  | 'vascular'
  | 'reumatologico'
  | 'pediatria'
  | 'procedimentos';

export const EXAM_AREAS: { id: ExamArea; label: string; color: string }[] = [
  { id: 'medicina-interna', label: 'Medicina Interna', color: 'bg-blue-100 text-blue-700' },
  { id: 'ginecologia', label: 'Ginecologia', color: 'bg-pink-100 text-pink-700' },
  { id: 'medicina-fetal', label: 'Medicina Fetal', color: 'bg-purple-100 text-purple-700' },
  { id: 'pequenas-partes', label: 'Pequenas Partes', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'musculoesqueletico', label: 'Musculoesquelético', color: 'bg-amber-100 text-amber-700' },
  { id: 'vascular', label: 'Vascular', color: 'bg-rose-100 text-rose-700' },
  { id: 'reumatologico', label: 'Reumatológico', color: 'bg-orange-100 text-orange-700' },
  { id: 'pediatria', label: 'Pediatria', color: 'bg-teal-100 text-teal-700' },
  { id: 'procedimentos', label: 'Procedimentos', color: 'bg-slate-100 text-slate-700' },
];

export type ExamStatus = 'pendente' | 'em-andamento' | 'finalizado';

export interface Patient {
  id: string;
  name: string;
  birthDate?: string;
  cpf?: string;
  rg?: string;
  gender?: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  insurance?: string;
  insuranceNumber?: string;
  history?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExamRequest {
  id: string;
  patientId: string;
  clinicId?: string;           // ← NOVO: clínica onde o exame foi realizado
  area: ExamArea;
  examType: string; // ex: "Ultrassom Obstétrico Morfológico 1º Tri"
  templateId?: string;
  scheduledAt?: number;
  requestingPhysician?: string;
  clinicalIndication?: string;
  status: ExamStatus;
  formData?: Record<string, unknown>;
  reportContent?: string; // HTML do laudo
  googleDocId?: string;        // ← NOVO: ID do Google Doc gerado
  googleDocUrl?: string;       // ← NOVO: URL do Google Doc
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  unlockHistory?: { date: number; reason: string }[]; // Histórico de desbloqueios do laudo
}

// Estrutura de uma máscara/template
export interface ReportTemplate {
  id: string;
  area: ExamArea;
  clinicId?: string;           // ← NOVO: template específico de uma clínica
  name: string; // ex: "USG Obstétrico - 2º Trimestre"
  description?: string;

  // Estrutura do laudo
  title: string;          // TÍTULO
  technique: string;      // TÉCNICA padrão
  analysisTemplate: string;  // ANÁLISE com placeholders
  conclusionTemplate: string; // CONCLUSÃO
  classificationTemplate?: string; // CLASSIFICAÇÃO (quando houver)
  recommendationsTemplate: string; // RECOMENDAÇÕES

  // Campos do formulário
  formFields: FormField[];

  // Prompt customizado para IA
  aiInstructions?: string;

  createdAt: number;
  updatedAt: number;
}

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'separator'
  | 'measurement' // valor + unidade
  | 'calculator'; // NOVO: Calculadora integrada

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[]; // para select/radio
  unit?: string; // para measurement
  group?: string; // agrupamento visual
  conditionalOn?: { fieldId: string; value: unknown }; // mostrar somente se outro campo == valor
  calculatorId?: string; // NOVO: ID da calculadora integrada
}

export interface AppSettings {
  geminiApiKey?: string;
  geminiModel: string;
  physicianName?: string;
  physicianCRM?: string;
  physicianRQE?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  defaultSignature?: string;
  defaultClinicId?: string;    // ← NOVO: clínica padrão selecionada
  aiMasterPrompt?: string;     // Prompt mestre global
  aiAreaPrompts?: Partial<Record<ExamArea, string>>; // Configurações de IA específicas por área
  aiExamPrompts?: Record<string, string>; // Instruções específicas por tipo de exame
  aiTemperature?: number;       // Temperatura do modelo (0-1)
  aiGlobalInstructions?: string; // Instruções globais adicionais
  aiStructurePrompt?: string;    // Estrutura obrigatória do laudo
  aiRigidRules?: string;        // Regras rígidas de geração
  snippets?: { id: string; title: string; content: string; area?: string }[]; // Frases prontas
}

// ═══════════════════════════════════════════
// NOVO: Tipo Clinic
// ═══════════════════════════════════════════

export interface Clinic {
  id: string;
  name: string;
  cnpj?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  phone?: string;
  email?: string;
  logoUrl?: string;                // URL da logo (Firebase Storage)
  googleDocsTemplateId?: string;   // ID do template padrão no Google Docs
  googleDriveFolderId?: string;    // Pasta no Drive para laudos gerados
  headerHtml?: string;             // HTML do cabeçalho customizado
  footerHtml?: string;             // HTML do rodapé customizado
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

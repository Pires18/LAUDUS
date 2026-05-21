// Tipos centrais do sistema de laudos

/** Áreas de especialidade médica suportadas pelo sistema */
export type ExamArea =
  | 'medicina-interna'
  | 'ginecologia'
  | 'medicina-fetal'
  | 'pequenas-partes'
  | 'musculoesqueletico'
  | 'vascular'
  | 'reumatologico'
  | 'pediatria'
  | 'procedimentos'
  | 'mastologia';

export const EXAM_AREAS: { id: ExamArea; label: string; color: string; icon: string }[] = [
  { id: 'medicina-interna', label: 'Medicina Interna', color: 'bg-blue-100 text-blue-700', icon: 'Stethoscope' },
  { id: 'ginecologia', label: 'Ginecologia', color: 'bg-pink-100 text-pink-700', icon: 'Flower2' },
  { id: 'medicina-fetal', label: 'Medicina Fetal', color: 'bg-purple-100 text-purple-700', icon: 'Baby' },
  { id: 'pequenas-partes', label: 'Pequenas Partes', color: 'bg-emerald-100 text-emerald-700', icon: 'ScanSearch' },
  { id: 'musculoesqueletico', label: 'Musculoesquelético', color: 'bg-orange-100 text-orange-700', icon: 'Bone' },
  { id: 'vascular', label: 'Vascular', color: 'bg-red-100 text-red-700', icon: 'Waves' },
  { id: 'pediatria', label: 'Pediatria', color: 'bg-cyan-100 text-cyan-700', icon: 'ToyBrick' },
  { id: 'procedimentos', label: 'Procedimentos', color: 'bg-slate-100 text-slate-700', icon: 'Syringe' },
  { id: 'reumatologico', label: 'Reumatológico', color: 'bg-amber-100 text-amber-700', icon: 'Dna' },
  { id: 'mastologia', label: 'Mastologia', color: 'bg-rose-100 text-rose-700', icon: 'Ribbon' },
];

/** Status possíveis de um exame no fluxo de trabalho */
export type ExamStatus = 'pendente' | 'em-andamento' | 'finalizado';

/** Cadastro de paciente */
export interface Patient {
  id: string;
  /** Nome completo do paciente */
  name: string;
  /** Data de nascimento no formato ISO (YYYY-MM-DD) */
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
  /** Histórico clínico relevante */
  history?: string;
  /** Observações gerais */
  notes?: string;
  /** Timestamp de criação */
  createdAt: number;
  /** Timestamp da última atualização */
  updatedAt: number;
}

/** Mensagem do chat do Copiloto */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** Requisição de exame (Laudo) */
export interface ExamRequest {
  id: string;
  /** ID amigável e curto para o laudo (ex: 100234) */
  friendlyId?: string;
  patientId: string;
  /** ID da clínica onde o exame foi realizado */
  clinicId?: string;
  /** Área médica do exame */
  area: ExamArea;
  /** Nome descritivo do tipo de exame */
  examType: string;
  /** ID da máscara de laudo utilizada */
  templateId?: string;
  /** Data/hora agendada */
  scheduledAt?: number;
  /** Nome do médico que solicitou o exame */
  requestingPhysician?: string;
  /** Motivo ou indicação clínica do exame */
  clinicalIndication?: string;
  /** Status atual na worklist */
  status: ExamStatus;
  /** Conteúdo final do laudo em HTML */
  reportContent?: string;
  /** ID do documento gerado no Google Docs */
  googleDocId?: string;
  /** URL pública ou de edição do Google Doc */
  googleDocUrl?: string;
  createdAt: number;
  updatedAt: number;
  /** Timestamp de finalização (conclusão) */
  finalizedAt?: number;
  /** Histórico de por que o laudo foi reaberto para edição */
  unlockHistory?: { date: number; reason: string }[];
  /** Histórico de mensagens do Copiloto IA */
  chatHistory?: ChatMessage[];
  /** Valor preenchido do formulário de caixa de texto */
  customFormValue?: string;
  /** Texto da anamnese preenchida do exame */
  anamnesis?: string;
  /** Texto do termo de consentimento gerado para o exame */
  consentTerm?: string;
  /** Se o paciente assinou/consentiu com o termo */
  consentAccepted?: boolean;
  /** Quando o termo foi assinado */
  consentAcceptedAt?: number;
}

/** Estrutura de uma máscara (template) de laudo */
export interface ReportTemplate {
  id: string;
  area: ExamArea;
  /** Se definido, este template é exclusivo de uma clínica */
  clinicId?: string;
  /** Nome do template (ex: USG Abdome Superior) */
  name: string;
  description?: string;

  // Estrutura visual do laudo
  title: string;
  technique: string;
  /** Template da análise com placeholders (ex: {{medida}}) */
  analysisTemplate: string;
  conclusionTemplate: string;
  classificationTemplate?: string;
  recommendationsTemplate: string;

  /** Instruções específicas para o motor de IA */
  aiInstructions?: string;
  /** Estrutura de texto padrão do formulário do copiloto */
  customForm?: string;
  /** Texto de anamnese padrão para o exame */
  anamnesisTemplate?: string;
  /** Texto de termo de consentimento padrão para o exame */
  consentTemplate?: string;

  createdAt: number;
  updatedAt: number;
}

/** Papéis de usuário do sistema (RBAC) */
export type UserRole = 'admin' | 'medico' | 'recepcao';

/** Configurações globais do aplicativo/usuário */
export interface AppSettings {
  /** Papel atual do usuário no sistema (para fins de simulação/teste) */
  currentRole?: UserRole;
  geminiApiKey?: string;
  geminiModel: string;
  aiProvider?: 'gemini' | 'anthropic';
  anthropicApiKey?: string;
  anthropicModel?: string;
  /** Nome completo do médico (para assinatura) */
  physicianName?: string;
  physicianCRM?: string;
  physicianRQE?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  /** Doutrina de Normalidade Habitual (Instrução mestre para IA) */
  normalDoctrine?: string;
  /** Assinatura padrão em texto ou HTML */
  defaultSignature?: string;
  /** Clínica padrão selecionada ao abrir o sistema */
  defaultClinicId?: string;
  /** Prompt principal que rege o comportamento da IA */
  aiMasterPrompt?: string;
  /** Prompts customizados por área médica */
  aiAreaPrompts?: Partial<Record<ExamArea, string>>;
  /** Criatividade da IA (0 a 1) */
  aiTemperature?: number;
  /** Instruções que devem ser seguidas globalmente */
  aiGlobalInstructions?: string;
  /** Definição da estrutura obrigatória do laudo */
  aiStructurePrompt?: string;
  /** Regras que a IA jamais deve quebrar */
  aiRigidRules?: string;
  /** Se a IA deve usar laudos anteriores para treinamento de estilo */
  aiTrainingEnabled?: boolean;
  /** Quantidade de laudos anteriores a serem enviados como contexto (1 a 10) */
  aiTrainingContextSize?: number;
  /** Banco de frases prontas do usuário */
  snippets?: { id: string; title: string; content: string; area?: string }[];
}

/** Cadastro de clínica (Unidade de atendimento) */
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
  /** URL do logo da clínica */
  logoUrl?: string;
  /** ID do documento template do Google Docs para esta clínica */
  googleDocsTemplateId?: string;
  /** ID da pasta no Drive onde os laudos serão salvos */
  googleDriveFolderId?: string;
  /** HTML para o cabeçalho do documento impresso */
  headerHtml?: string;
  /** HTML para o rodapé do documento impresso */
  footerHtml?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Registro de auditoria do sistema */
export interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  action: string;
  details: string;
  module: string;
  timestamp: number;
}

/** Plano de assinatura */
export interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  examLimit?: number; // null = ilimitado
  clinicLimit?: number;
  active: boolean;
  
  // Recursos e adequações clínicas do sistema
  iaLimit?: number;         // Créditos Laud.IA/mês (null = ilimitado)
  storageLimitGb?: number;  // Armazenamento de Imagens em GB (null = ilimitado)
  voiceDictation: boolean;  // Permite Ditado por Voz clínico
  customMasks: boolean;     // Permite criação de máscaras personalizadas
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  messages: SupportMessage[];
  createdAt: number;
  updatedAt: number;
}

/** Código de Licença comercial atrelado a planos */
export interface License {
  id: string;             // Ex: LAUD-XXXX-XXXX-XXXX
  planId: string;         // ID do plano associado
  planName: string;       // Nome do plano associado
  durationMonths: number; // Duração (1, 3, 6, 12, 24 meses)
  active: boolean;        // Se está ativa (não revogada)
  createdAt: number;      // Data de geração
  usedAt?: number;        // Data de ativação pelo usuário
  usedByUid?: string;     // UID do médico que ativou
  usedByEmail?: string;   // E-mail do médico que ativou
  expiresAt?: number;     // Timestamp exato do fim do acesso
}


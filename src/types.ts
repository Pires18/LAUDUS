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
  { id: 'procedimentos', label: 'Procedimentos', color: 'bg-ink-100 text-ink-700', icon: 'Syringe' },
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
interface ChatMessage {
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
  /** Data real do exame (pode diferir da data de criação no sistema) */
  examDate?: number;
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
  /** Histórico de versões do laudo para diff/rollback */
  reportVersions?: Array<{
    timestamp: number;
    content: string;
    trigger: 'generation' | 'refine' | 'copilot' | 'manual';
  }>;
  /** Aparelho de ultrassom (dicomDevices[].id) escolhido na criação — reutilizado
   * ao reenviar a worklist depois, para não redirecionar o exame ao aparelho
   * errado quando há mais de um cadastrado. */
  dicomDeviceId?: string;
  /** Dados salvos das calculadoras para este exame */
  calculatorData?: Record<string, any>;
  /** Valores preenchidos na aba "Estruturado" do Copiloto (por fieldId) */
  structuredValue?: Record<string, StructuredFieldValue>;
  /** StudyInstanceUID(s) de estudos DICOM enviados manualmente (exame feito em
   * local externo, sem aparelho conectado ao sistema) e vinculados a este exame. */
  externalStudyInstanceUids?: string[];
}

/**
 * Formulário Estruturado (aba "Estruturado" do Copiloto) — campos tipados
 * derivados da máscara, integrados às calculadoras, compilados numa instrução
 * padronizada `[DADOS ESTRUTURADOS]` para a IA inserir nos compartimentos.
 */
export type StructuredFieldKind = 'measure' | 'triplet' | 'text' | 'select' | 'multiselect' | 'toggle' | 'calc';

/** Chave de descritor para escore inline (ex.: ACR TI-RADS). */
export type StructuredScoreKey = 'composition' | 'echogenicity' | 'shape' | 'margin' | 'foci';

export interface StructuredFieldDef {
  id: string;
  label: string;
  kind: StructuredFieldKind;
  /** Unidade exibida/anexada ao valor (ex: 'mm', 'cm', 'bpm', 'cm/s') */
  unit?: string;
  /** Opções para kind='select' */
  options?: string[];
  /** Calculadora ligada (kind='calc' ou campo com atalho de cálculo) */
  calcId?: string;
  /** Dica curta exibida abaixo do campo (thresholds, referência) */
  hint?: string;
  /** Placeholder do input */
  placeholder?: string;
  /** Marca este select como descritor de um escore inline (TI-RADS). */
  scoreKey?: StructuredScoreKey;
  /** Ocupa a linha inteira no grid. */
  fullWidth?: boolean;
  /** Só exibe o campo quando outro campo estiver preenchido (ou com valor `equals`). */
  showIf?: { field: string; equals?: string };
  /**
   * Valor/faixa de referência de NORMALIDADE (ex.: '≤ 6 mm', '9–12 cm'). Exibido
   * como referência no campo e usado pelo botão "Normal" da seção para
   * pré-preencher medidas dentro da faixa habitual.
   */
  normal?: string;
  /**
   * Campo exibido MESMO com a seção em 'Normal' — biometria que se registra na
   * normalidade (dimensões, volume, índices Doppler). Continua calculando ao
   * vivo e é compilado junto da frase de normalidade.
   */
  alwaysShow?: boolean;
}

/**
 * Grupo REPETÍVEL aninhado numa seção (lesões/nódulos/cistos com suas próprias
 * calculadoras e escore). Aparece dentro do estado 'Alterado' quando a seção é
 * `normalable`; caso contrário, aparece sempre. Cada item é escopado por
 * instância com um id de container próprio (`<sectionId>#<groupId>`), sem
 * colidir com os campos fixos da seção.
 */
export interface StructuredRepeatGroup {
  id: string;
  /** Rótulo de cada item (ex.: 'Nódulo', 'Lesão', 'Cisto'). */
  itemLabel?: string;
  /** Rótulo do botão de adicionar (ex.: 'Adicionar nódulo'). */
  addLabel?: string;
  /** Escore/sugestão inline a partir dos descritores de cada item. */
  score?: 'tirads' | 'birads' | 'orads' | 'bosniak';
  fields: StructuredFieldDef[];
}

export interface StructuredSection {
  id: string;
  label: string;
  fields: StructuredFieldDef[];
  /** Calculadora aplicável à seção inteira (atalho no cabeçalho) */
  calcId?: string;
  /** Mostra toggle Normal/Alterado; campos só aparecem quando 'Alterado'. */
  normalable?: boolean;
  /** Texto compilado quando a seção está 'Normal'. */
  normalText?: string;
  /** Seção com múltiplas instâncias (nódulos, lesões, linfonodos). */
  repeatable?: boolean;
  /** Rótulo de cada item repetível (ex: 'Nódulo'). */
  itemLabel?: string;
  /** Escore/sugestão inline a partir dos descritores desta seção. */
  score?: 'tirads' | 'birads' | 'orads' | 'bosniak';
  /**
   * Lista de lesões/nódulos repetíveis ANINHADA na seção (com calculadoras e
   * escore próprios). Fica dentro do estado 'Alterado' quando a seção é
   * `normalable` — é o lugar correto para inserir lesões e cálculos sob o órgão.
   */
  repeatGroup?: StructuredRepeatGroup;
}

export interface StructuredSchema {
  area: ExamArea | string;
  examName?: string;
  sections: StructuredSection[];
}

/** Valor de um campo estruturado. Objeto para 'triplet'/'calc' (com métricas). */
export type StructuredFieldValue = string | {
  /** Texto compilável exibido/injetado (ex: resumo da calculadora, "8,2 x 5,1 x 4,8 cm") */
  text?: string;
  /** Métricas cruas quando veio de calculadora */
  metrics?: Record<string, any>;
  /** id da calculadora de origem, se aplicável */
  calcId?: string;
};

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
  observationsTemplate?: string;

  /** Instruções específicas para o motor de IA */
  aiInstructions?: string;
  /** Estrutura de texto padrão do formulário do copiloto */
  customForm?: string;
  /** Texto de anamnese padrão para o exame */
  anamnesisTemplate?: string;
  /** Texto de termo de consentimento padrão para o exame */
  consentTemplate?: string;

  /**
   * Formulário estruturado PERSONALIZADO desta máscara (editado na aba
   * "Estruturado" do editor de máscaras). Quando presente, substitui o esquema
   * derivado automaticamente do analysisTemplate — inclusive no Copiloto.
   * `sections: []` desativa o formulário estruturado deste exame;
   * `null`/ausente volta ao modo automático.
   */
  structuredSchema?: { sections: StructuredSection[] } | null;

  createdAt: number;
  updatedAt: number;

  /**
   * Marcador em tempo de execução (NÃO persistido): indica que esta máscara veio
   * da coleção do admin (padrão do sistema), mesclada na biblioteca do usuário.
   * Máscaras vinculadas são somente-leitura para não-admin.
   */
  isSystem?: boolean;
}

/** Papéis de usuário do sistema (RBAC) */
export type UserRole = 'admin' | 'medico' | 'recepcao';

export interface DicomDevice {
  id: string;
  name: string;
  aeTitle: string;
  modality: string;
  /** IP local do aparelho — usado para autorizá-lo no Orthanc (DicomModalities). */
  ip?: string;
  /** Clínica a que este aparelho pertence. Vazio/undefined = compartilhado entre todas as clínicas. */
  clinicId?: string;
}

/** Estado do provisionamento do PACS gerenciado (VM/container por usuário). */
export type PacsInstanceStatus =
  | 'none'          // nunca provisionado
  | 'provisioning'  // criando a VM/container
  | 'ready'         // no ar e configurado
  | 'error'         // falha no provisionamento
  | 'suspended';    // pausado (ex: cobrança)

/** Instância PACS gerenciada de um usuário (grava-se em settings.pacsInstance). */
export interface PacsInstance {
  status: PacsInstanceStatus;
  /** 'mock' (simulado), 'gcp' (VM dedicada real) ou 'shared' (tenant na VM compartilhada). */
  provider?: 'mock' | 'gcp' | 'shared';
  /** ID do tenant quando provider = 'shared'. */
  tenantId?: string;
  /** Porta DICOM exclusiva do tenant (ex: 43xx) — o aparelho aponta para ela. */
  dicomPort?: number;
  /** Plano contratado (define modelo/quota). */
  plan?: 'starter' | 'pro' | 'dedicado';
  region?: string;
  /** Nome/host da instância (para o admin). */
  instanceName?: string;
  /** URL pública do Agente (Funnel) — espelhada em dicomLocalAgentUrl. */
  agentUrl?: string;
  orthancVersion?: string;
  diskGb?: number;
  diskUsedGb?: number;
  /** epoch ms */
  createdAt?: number;
  updatedAt?: number;
  lastHealthAt?: number;
  /** Mensagem de erro amigável quando status = 'error'. */
  error?: string;
  /**
   * epoch ms — quando status = 'suspended' (assinatura cancelada/expirada),
   * data a partir da qual o CRON de lifecycle destrói de vez a VM/tenant.
   * Limpo automaticamente se a assinatura for reativada antes desse prazo.
   */
  scheduledDeletionAt?: number;
  /**
   * Auth-key do Tailscale para o CLIENTE logar o PRÓPRIO relé (roteador
   * GL.iNet ou PC) na tailnet, sem precisar da conta do operador. Gerada uma
   * vez no provisionamento (tag `tag:pacs-client`, reutilizável).
   */
  relayAuthKey?: string;
  /** Tag Tailscale associada à `relayAuthKey` (hoje sempre `tag:pacs-client`). */
  relayTag?: string;
}

/** Configurações globais do aplicativo/usuário */
export interface AppSettings {
  /** Papel atual do usuário no sistema (para fins de simulação/teste) */
  currentRole?: UserRole;
  /** Preferência de tema da interface */
  theme?: 'light' | 'dark' | 'system';
  geminiApiKey?: string;
  geminiModel: string;
  geminiModelPro?: string;
  geminiModelByMode?: {
    generation?: string;
    refine?: string;
    copilot?: string;
    template?: string;
  };
  aiProvider?: 'gemini';
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
  /** Prompts para Geração de Máscara de Laudo e Anexos */
  aiTemplateGenerationPrompt?: string;
  aiCustomFormPrompt?: string;
  aiAnamnesisPrompt?: string;
  aiConsentPrompt?: string;
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
  /** Se o Refinador Automático deve ser ativado por padrão em todo laudo após as alterações do Copiloto */
  aiAutoRefineEnabled?: boolean;
  /** Se o Modo Rápido (sem scratchpad) está ativo */
  aiFastMode?: boolean;

  // ── Curadoria pessoal de máscaras (LAUD.IA) ──
  /**
   * IDs das máscaras padrão do sistema (do admin) que o usuário ativou para uso.
   * As ativadas ficam VINCULADAS (recebem atualizações do admin, não editáveis).
   * `undefined` = usuário legado (mostra todas as padrão + dispara migração);
   * `[]` = usuário em branco (só vê as próprias + as que ativar no catálogo).
   */
  enabledSystemMaskIds?: string[];
  /** Se as RECOMENDAÇÕES devem ser incluídas no laudo gerado (default: sim). */
  laudIaRecommendationsEnabled?: boolean;
  /** Se as OBSERVAÇÕES METODOLÓGICAS devem ser incluídas no laudo (default: sim). */
  laudIaMethodologicalObsEnabled?: boolean;
  /** Se a seção de CLASSIFICAÇÃO (BI-RADS, TI-RADS, etc.) deve ser incluída (default: sim). */
  laudIaClassificationEnabled?: boolean;

  /** Banco de frases prontas do usuário */
  snippets?: { id: string; title: string; content: string; area?: string }[];
  
  // Configurações de Integração DICOM / PACS Worklist
  dicomSyncEnabled?: boolean;
  dicomWorklistFolder?: string;
  dicomModalityAETitle?: string;
  dicomModalityIp?: string;
  dicomModalityType?: string;
  dicomDevices?: DicomDevice[];
  /** id do aparelho marcado como principal quando ele NÃO pertence a uma clínica específica (compartilhado). */
  dicomDefaultDeviceId?: string;
  /** Aparelho principal por clínica: clinicId -> DicomDevice.id (pré-selecionado ao criar exame/confirmar agendamento daquela clínica). */
  dicomDefaultDeviceIdByClinic?: Record<string, string>;
  dicomOrthancAETitle?: string;
  dicomViewerUrl?: string;
  dicomTailscalePublicUrl?: string;
  dicomViewerType?: 'stone' | 'oe2' | 'ohif' | 'custom';
  dicomViewerUrlPattern?: string;
  dicomPreset?: 'macmini' | 'notebook' | 'custom';
  dicomUsername?: string;
  dicomPassword?: string;
  dicomLocalAgentUrl?: string;
  /** Segredo do Agente Local (per-usuário) — exigido pelo agente exposto via
   *  Tailscale Funnel. Enviado como x-agent-secret / ?agentSecret. Criptografado. */
  dicomAgentSecret?: string;
  /** PACS gerenciado (self-service): estado do provisionamento da VM/container. */
  pacsInstance?: PacsInstance;
  /** Tier de PACS escolhido pelo usuário para o pacote (starter/pro/dedicado).
   *  Sincroniza a escolha entre o Centro de Assinatura e o card da área DICOM. */
  pacsSelectedPlan?: 'starter' | 'pro' | 'dedicado';
  /** ID do tenant na VM compartilhada (planos Starter/Pro). Enviado ao agente
   *  como ?tenantId= para rotear ao Orthanc/pasta isolados do cliente. Vazio no
   *  modo dedicado (VM própria) ou local (single-tenant). */
  dicomTenantId?: string;

  // Configurações do PACS de Backup (Redundância)
  dicomBackupViewerUrl?: string;
  dicomBackupTailscalePublicUrl?: string;
  dicomBackupUsername?: string;
  dicomBackupPassword?: string;
  dicomBackupSyncEnabled?: boolean;
  dicomBackupWorklistFolder?: string;
  dicomBackupLocalAgentUrl?: string;
  dicomBackupOrthancAETitle?: string;
  dicomBackupAgentSecret?: string;

  /** Criatividade da IA por modo operacional */
  aiTemperatureByMode?: {
    generation?: number;  // default 0.35
    refine?: number;      // default 0.10
    copilot?: number;     // default 0.20
    template?: number;    // default 0.20
  };
  /** Regras de ouro do refinamento (Bloco 5) — editável pelo admin */
  aiRefinementGoldenRules?: string;
  /** Override do copiloto (formato de saída CONVERSA/PROPOSTA) — editável pelo admin */
  aiCopilotOverride?: string;
  /** Taxa de conversão USD → BRL para exibição de custos (default: 5.50) */
  aiConversionRateBRL?: number;

  // Motor de IA selecionado pelo usuário (Lite ou Pro)
  selectedMotor?: 'lite' | 'pro';

  // Preferências do Sistema
  soundNotifications?: boolean;
  autoSave?: boolean;
  signatureImageUrl?: string;

  // Configurações de Layout de Laudo PDF
  pdfFontFamily?: string;
  pdfFontSize?: string;
  pdfLineHeight?: string;
  pdfTextAlign?: 'justify' | 'left';
  pdfMarginTop?: number;
  pdfMarginBottom?: number;
  pdfMarginLeft?: number;
  pdfMarginRight?: number;
  pdfShowHeader?: boolean;
  pdfShowFooter?: boolean;

  // Margens (mm) da documentação fotográfica (PDF de imagens). Default: 10mm.
  pdfImagesMarginTop?: number;
  pdfImagesMarginBottom?: number;
  pdfImagesMarginLeft?: number;
  pdfImagesMarginRight?: number;
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
  /** URL do cabeçalho da clínica como imagem */
  headerImageUrl?: string;
  /** URL do rodapé da clínica como imagem */
  footerImageUrl?: string;
  /** ID do documento template do Google Docs para esta clínica */
  googleDocsTemplateId?: string;
  /** ID da pasta no Drive onde os laudos serão salvos */
  googleDriveFolderId?: string;
  /** HTML para o cabeçalho do documento impresso */
  headerHtml?: string;
  /** HTML para o rodapé do documento impresso */
  footerHtml?: string;
  active: boolean;
  schedulingConfig?: {
    weekdayShifts: {
      day: number; // 0 (Sunday) to 6 (Saturday)
      active: boolean;
      shifts: {
        id: string;
        name: string; // e.g. "Manhã", "Tarde", "Noite"
        start: string; // e.g. "08:00"
        end: string; // e.g. "12:00"
        slotDurationMinutes: number;
      }[];
    }[];
  };
  createdAt: number;
  updatedAt: number;
}

/** Papel de um membro de equipe convidado para uma clínica (não o dono). */
export type ClinicMemberRole = 'editor' | 'viewer';

/** Doc em clinic_memberships/ (coleção global), id = `${ownerId}_${clinicId}_${memberUid}`. */
export interface ClinicMembership {
  id: string;
  ownerId: string;
  clinicId: string;
  memberUid: string;
  memberEmail: string;
  role: ClinicMemberRole;
  invitedByUid: string;
  createdAt: number;
  updatedAt: number;
}

/** Registro de agendamento de exames */
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientBirthDate?: string;
  patientGender?: 'M' | 'F' | 'O';
  patientPhone?: string;
  patientCPF?: string;
  patientInsurance?: string;
  requestingPhysician?: string;
  priority?: 'normal' | 'urgente';
  rescheduledFrom?: string;
  clinicId?: string;
  area: ExamArea;
  examType: string;
  templateId?: string;
  scheduledAt: number; // Timestamp da data/hora do agendamento
  status: 'agendado' | 'confirmado' | 'cancelado';
  notes?: string;
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

/** Assinatura ativa de um usuário */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
export type SubscriptionAddon = 'pacs' | 'calculators' | 'appointments' | 'clinics';

export interface Subscription {
  id: string;
  userId: string;
  userEmail: string;
  plan: string;
  planId?: string;
  addons: SubscriptionAddon[];
  status: SubscriptionStatus;
  paymentMethod: 'pix' | 'credit_card' | 'manual';
  abacatePayCustomerId?: string;
  abacatePaySubscriptionId?: string;
  price?: number;
  interval?: 'month' | 'semester' | 'year';
  installments?: number;
  /**
   * Modo de cobrança para planos mensais:
   * 'subscription' = AbacatePay gerencia PIX Automático ou Cartão recorrente.
   * 'invoice'      = CRON cria faturas mensais automaticamente (fallback).
   * Ausente em planos semestrais/anuais (checkouts avulsos).
   */
  billingMode?: 'subscription' | 'invoice';
  /** Valor (R$) da última fatura — usado pelo CRON para criar a próxima. */
  lastInvoiceAmount?: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  /** Plano vitalício: sempre ativo, sem expiração/recorrência (definido pelo admin). */
  lifetime?: boolean;
  /** Gratuidade/cortesia: acesso sem cobrança (não conta como receita/MRR). */
  comp?: boolean;
  /** Auto-renova (recorrente). Falso em vitalício e em avulso. */
  autoRenew?: boolean;
  trialEndsAt?: number;
  canceledAt?: number;
  reportsUsedThisMonth: number;
  reportsQuota: number;
  clinicsQuota: number;
  lastResetAt: number;
  createdAt: number;
  updatedAt: number;
}
/** Configuração de funcionalidades extras (add-ons) */
/** Preços por intervalo (R$) de um add-on de módulo recorrente. */
export type AddonPrices = { month: number; semester: number; year: number };

export interface SaasAddonsConfig {
  calculators: { price: number; prices?: AddonPrices; description: string; enabled: boolean; abacatePayProductId?: string; };
  pacs: { price: number; prices?: AddonPrices; description: string; enabled: boolean; assisted: boolean; abacatePayProductId?: string; };
  appointments: { price: number; prices?: AddonPrices; description: string; enabled: boolean; abacatePayProductId?: string; };
  clinics: { price: number; prices?: AddonPrices; description: string; enabled: boolean; abacatePayProductId?: string; };
  extraReport: { price: number; description: string; enabled: boolean; abacatePayProductId?: string; };
  extraClinic: { price: number; description: string; enabled: boolean; abacatePayProductId?: string; };
  tokenLite: { price: number; bundleSize: number; description: string; enabled: boolean; abacatePayProductId?: string; };
  tokenPro: { price: number; bundleSize: number; description: string; enabled: boolean; abacatePayProductId?: string; };
  updatedAt?: number;
}

/** Configuração dos motores de IA (Lite / Pro) definida pelo admin */
export interface MotorTierConfig {
  provider: 'gemini';
  model: string;
  tokensPerReport: number;
  costPerThousandTokens: number;
}

export interface MotorConfig {
  lite: MotorTierConfig;
  pro: MotorTierConfig;
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
  type?: string;
  category?: 'ia_help' | 'billing' | 'pacs_setup' | 'technical_issue' | 'other';
  rating?: number;
  ratingComment?: string;
  adminNotes?: Array<{ timestamp: number; author: string; text: string }>;
  diagnostics?: {
    browser: string;
    os: string;
    screenResolution: string;
    reportsRemaining: number;
    activePlan: string;
  };
}

/** Plano de assinatura SaaS */
export interface Plan {
  id: string;
  name: string;
  description: string;
  /**
   * Os 3 preços do plano (R$) — um único plano cobre mensal/semestral/anual.
   * O usuário escolhe o intervalo no checkout; ver planPrices()/planPriceBrl().
   */
  prices?: { month: number; semester: number; year: number };
  /** @deprecated Legado — preço único. Use `prices`. Mantido para compat. */
  price: number;
  /** @deprecated Legado — intervalo único do plano. O plano agora cobre os 3. */
  interval: 'month' | 'semester' | 'year';
  /** Recorrência (auto-renova). Derivado do intervalo (só 'year'); persistido p/ o webhook. */
  autoRenew?: boolean;
  /** Agrupador da vitrine (mesmo tier em intervalos diferentes). */
  tier?: string;
  /** 'subscription' (padrão) | 'pacs' (planos de infra PACS gerenciados no Financeiro). */
  category?: 'subscription' | 'pacs';
  active: boolean;
  featured?: boolean;

  // Quotas
  reportsQuota: number;       // 0 = ilimitado
  clinicsQuota: number;       // 0 = ilimitado
  trialDays: number;

  // Funcionalidades incluídas
  includesCalculators: boolean;
  includesPacs: boolean;
  includesAppointments?: boolean;
  includesClinics?: boolean;
  motorProDefault: boolean;

  // AbacatePay
  abacatePayProductId?: string;

  // Legacy compatibility
  features?: string[];
  examLimit?: number;
  clinicLimit?: number;
  iaLimit?: number;
  storageLimitGb?: number;
  voiceDictation?: boolean;
  customMasks?: boolean;

  createdAt?: number;
  updatedAt?: number;
}




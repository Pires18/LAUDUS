import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send, Loader2, Sparkles, Bot, User, Mic, MicOff, Calculator,
  Lightbulb, Zap, ClipboardList, RotateCcw, CheckCircle2,
  Trash2, StopCircle, Brain, Pencil, FileText, Lock, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { useApp } from '../../store/app';
import { updateItem, saveVersionSnapshot, getRecentFinalizedReports } from '../../store/db';
import { logger } from '../../utils/logger';
import { ExamRequest, Patient, ReportTemplate } from '../../types';
import { generateReportStream, stripScratchpad } from '../ai/engine';
import { routeMotor } from '../ai/router';
import { ReportQualityPanel } from './components/ReportQualityPanel';
import { classNames } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '../../hooks/useConfirm';
import { useSubscription } from '../../hooks/useSubscription';

const AREA_SUGGESTIONS: Record<string, Array<{ label: string; text: string }>> = {
  'medicina-fetal': [
    { label: 'Biometria', text: 'Preencher biometria fetal com os dados fornecidos e calcular PFE e percentil' },
    { label: 'Doppler Fetal', text: 'Integrar valores Doppler (AU, ACM, RCP) e classificar resistência' },
    { label: 'Líquido Amniótico', text: 'Classificar volume de líquido amniótico pelo ILA/MBV fornecido' },
    { label: 'Datação', text: 'Calcular idade gestacional e DPP pela DUM fornecida' },
    { label: 'Placenta', text: 'Descrever morfologia e localização placentária' },
  ],
  'ginecologia': [
    { label: 'Útero + Miométrio', text: 'Descrever útero com dimensões, posição, miométrio e endométrio' },
    { label: 'Ovários', text: 'Descrever ovários com dimensões e folículos' },
    { label: 'O-RADS', text: 'Aplicar classificação O-RADS para formação anexial descrita' },
    { label: 'MUSA', text: 'Classificar achados conforme critérios MUSA para adenomiose' },
    { label: 'Pelve Normal', text: 'Marcar pelve feminina como dentro dos limites da normalidade' },
  ],
  'vascular': [
    { label: 'Velocidades', text: 'Inserir velocidades Doppler (VPS, VDF, IR, IP) nos campos correspondentes' },
    { label: 'Carótidas', text: 'Descrever carótidas com EIM, velocidades e classificar grau de estenose' },
    { label: 'Aorta', text: 'Descrever calibre e morfologia da aorta abdominal' },
    { label: 'Compressibilidade', text: 'Registrar compressibilidade venosa e sinais de trombose' },
    { label: 'IMT Médio', text: 'Calcular IMT médio das carótidas e classificar risco' },
  ],
  'mama': [
    { label: 'BI-RADS', text: 'Aplicar classificação BI-RADS para nódulo ou área descrita' },
    { label: 'Nódulo Sólido', text: 'Descrever morfologia completa do nódulo sólido e aplicar BI-RADS' },
    { label: 'Linfonodos', text: 'Descrever linfonodos axilares e infraclaviculares' },
    { label: 'Normal Bilateral', text: 'Descrever mamas bilaterais sem alterações com BI-RADS 1' },
  ],
  'tireoide': [
    { label: 'TI-RADS', text: 'Aplicar classificação TI-RADS para nódulo tireoidiano descrito' },
    { label: 'Volume', text: 'Calcular volume tireoidiano com as dimensões fornecidas' },
    { label: 'Nódulo', text: 'Descrever nódulo hipoecoico sólido e classificar pelo TI-RADS' },
    { label: 'Tireoidite', text: 'Descrever padrão de tireoidite com ecotextura heterogênea difusa' },
  ],
  'default': [
    { label: 'Achado Patológico', text: 'Adicionar achado patológico com descrição morfológica completa' },
    { label: 'Normalidade', text: 'Marcar todas as estruturas avaliadas como dentro dos limites da normalidade' },
    { label: 'Refinar Texto', text: 'Refinar o estilo e a terminologia clínica deste laudo mantendo os achados' },
    { label: 'Conclusão', text: 'Revisar e aprimorar a seção de conclusão e recomendações' },
  ],
};

interface StructuredField {
  id: string;
  label: string;
  placeholder: string;
  unit?: string;
  type?: 'text' | 'select';
  options?: string[];
}

const FETAL_FIELDS: StructuredField[] = [
  { id: 'dum', label: 'DUM', placeholder: 'ex: 10/01/2025' },
  { id: 'dbp', label: 'DBP', placeholder: 'ex: 75', unit: 'mm' },
  { id: 'dof', label: 'DOF', placeholder: 'ex: 95', unit: 'mm' },
  { id: 'cc', label: 'CC', placeholder: 'ex: 285', unit: 'mm' },
  { id: 'ca', label: 'CA', placeholder: 'ex: 270', unit: 'mm' },
  { id: 'cf', label: 'CF', placeholder: 'ex: 54', unit: 'mm' },
  { id: 'pfe', label: 'PFE / Percentil', placeholder: 'ex: 1888 g / P45' },
  { id: 'bcf', label: 'BCF', placeholder: 'ex: 148', unit: 'bpm' },
  { id: 'ip_au', label: 'IP Art. Umbilical', placeholder: 'ex: 0.92' },
  { id: 'ip_acm', label: 'IP ACM', placeholder: 'ex: 1.45' },
  { id: 'placenta', label: 'Placenta', placeholder: 'ex: posterior grau I' },
  { id: 'ila', label: 'ILA / MBV', placeholder: 'ex: 14.2 cm / 52 mm' },
  { id: 'apresentacao', label: 'Apresentação', placeholder: 'ex: cefálica' },
];

const GYNECO_FIELDS: StructuredField[] = [
  { id: 'utero_pos', label: 'Posição Uterina', placeholder: 'ex: anteversoflexão', type: 'select', options: ['anteversoflexão', 'retroversão', 'retroflexão', 'medioversão'] },
  { id: 'utero_dims', label: 'Dimensões Uterinas', placeholder: 'ex: 8.2 x 5.1 x 4.8 cm' },
  { id: 'endometrio', label: 'Endométrio', placeholder: 'ex: 9 mm, homogêneo' },
  { id: 'miometrio', label: 'Miométrio', placeholder: 'ex: homogêneo, sem nódulos' },
  { id: 'ovario_d', label: 'Ovário Direito', placeholder: 'ex: 3.2 x 2.1 x 1.8 cm' },
  { id: 'ovario_e', label: 'Ovário Esquerdo', placeholder: 'ex: 3.0 x 2.0 x 1.6 cm' },
  { id: 'anexos', label: 'Anexos / Formações', placeholder: 'ex: cisto simples 2 cm à esquerda' },
  { id: 'douglas', label: 'Fundo de Saco', placeholder: 'ex: livre, sem líquido' },
];

const VASCULAR_FIELDS: StructuredField[] = [
  { id: 'vps_acd', label: 'VPS ACD', placeholder: 'ex: 0.98', unit: 'm/s' },
  { id: 'vdf_acd', label: 'VDF ACD', placeholder: 'ex: 0.24', unit: 'm/s' },
  { id: 'ir_acd', label: 'IR ACD', placeholder: 'ex: 0.75' },
  { id: 'vps_ace', label: 'VPS ACE', placeholder: 'ex: 1.10', unit: 'm/s' },
  { id: 'vdf_ace', label: 'VDF ACE', placeholder: 'ex: 0.28', unit: 'm/s' },
  { id: 'ir_ace', label: 'IR ACE', placeholder: 'ex: 0.74' },
  { id: 'imt_d', label: 'EIM Direita', placeholder: 'ex: 0.8', unit: 'mm' },
  { id: 'imt_e', label: 'EIM Esquerda', placeholder: 'ex: 0.7', unit: 'mm' },
  { id: 'placa', label: 'Placas', placeholder: 'ex: sem placas visíveis' },
  { id: 'veias', label: 'Veias', placeholder: 'ex: compressíveis, sem trombo' },
];

function StructuredFormField({ field, value, onChange }: { field: StructuredField; value: string; onChange: (v: string) => void }) {
  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest">{field.label}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 px-2 bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-xs font-medium text-ink-800 outline-none transition-all"
        >
          <option value="">—</option>
          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-black text-ink-500 uppercase tracking-widest">
        {field.label}{field.unit && <span className="text-ink-400 normal-case font-normal ml-1">({field.unit})</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="h-8 px-2 bg-white border border-ink-200 focus:border-brand-400 rounded-lg text-xs font-medium text-ink-800 placeholder-ink-300 outline-none transition-all"
      />
    </div>
  );
}

interface LaudCopilotProps {
  reportContent: string;
  onUpdate: (html: string) => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  exam: ExamRequest;
  template: ReportTemplate | null;
  patient: Patient | null;
  chatHistory: Array<{ role: 'user' | 'assistant', content: string }>;
  onChatUpdate: (history: Array<{ role: 'user' | 'assistant', content: string }>) => void;
  onShowCalculators: (calcId?: string) => void;
  prompt: string;
  onChangePrompt: (val: string) => void;
  /**
   * Mensagem técnica (resultado de calculadora / formulário) injetada por um
   * componente externo. Diferente de `prompt` (texto livre do usuário), é
   * enviada automaticamente sem passar pela caixa de texto — evita que o
   * marcador seja concatenado a um rascunho e nunca disparado.
   */
  injectedMessage?: string | null;
  onInjectionConsumed?: () => void;
  isDocked?: boolean;
}

export function LaudCopilot({
  reportContent,
  onUpdate,
  isGenerating,
  setIsGenerating,
  exam,
  template,
  patient,
  chatHistory,
  onChatUpdate,
  onShowCalculators,
  prompt,
  onChangePrompt,
  injectedMessage,
  onInjectionConsumed,
  isDocked
}: LaudCopilotProps) {
  const { settings, updateSettings, showToast } = useApp();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');
  const [formText, setFormText] = useState(exam.customFormValue ?? template?.customForm ?? '');
  const [anamnesisText, setAnamnesisText] = useState(exam.anamnesis ?? '');
  const [appliedIndices, setAppliedIndices] = useState<number[]>([]);
  const [refinePhase, setRefinePhase] = useState<'idle' | 'integrating' | 'refining'>('idle');
  const [genPhase, setGenPhase] = useState<'idle' | 'reasoning' | 'writing'>('idle');

  const autoRefineEnabled = settings.aiAutoRefineEnabled ?? false;
  const handleToggleAutoRefine = (val: boolean) => {
    updateSettings({ ...settings, aiAutoRefineEnabled: val });
  };

  const aiFastMode = settings.aiFastMode ?? false;
  const handleToggleFastMode = (val: boolean) => {
    updateSettings({ ...settings, aiFastMode: val });
  };

  const { reportsUsed, reportsQuota, motorProEnabled } = useSubscription();
  const selectedMotor = settings.selectedMotor || 'lite';
  const handleMotorChange = (val: 'lite' | 'pro') => {
    if (val === 'pro' && !motorProEnabled) return;
    updateSettings({ ...settings, selectedMotor: val });
  };

  const isDirtyRef = useRef(false);
  const prevExamIdRef = useRef(exam.id);
  const formSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(formText);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFormFocusedRef = useRef(false);

  const isAnamnesisDirtyRef = useRef(false);
  const anamnesisSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAnamnesisRef = useRef(anamnesisText);
  const isAnamnesisFocusedRef = useRef(false);

  const cancelActiveRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    cancelActiveRequest();
    setIsGenerating(false);
    setRefinePhase('idle');
    setGenPhase('idle');
    showToast('Geração cancelada.', 'info');
  };

  useEffect(() => {
    return () => {
      if (formSaveTimerRef.current) {
        clearTimeout(formSaveTimerRef.current);
      }
      if (anamnesisSaveTimerRef.current) {
        clearTimeout(anamnesisSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (prevExamIdRef.current !== exam.id) {
      if (formSaveTimerRef.current) {
        clearTimeout(formSaveTimerRef.current);
        formSaveTimerRef.current = null;
      }
      if (anamnesisSaveTimerRef.current) {
        clearTimeout(anamnesisSaveTimerRef.current);
        anamnesisSaveTimerRef.current = null;
      }
      const val = exam.customFormValue ?? template?.customForm ?? '';
      setFormText(val);
      latestValueRef.current = val;
      isDirtyRef.current = false;

      const anamVal = exam.anamnesis ?? '';
      setAnamnesisText(anamVal);
      latestAnamnesisRef.current = anamVal;
      isAnamnesisDirtyRef.current = false;

      prevExamIdRef.current = exam.id;
    } else {
      if (!isDirtyRef.current && !isFormFocusedRef.current) {
        const val = exam.customFormValue ?? template?.customForm ?? '';
        setFormText(val);
        latestValueRef.current = val;
      }
      if (!isAnamnesisDirtyRef.current && !isAnamnesisFocusedRef.current) {
        const anamVal = exam.anamnesis ?? '';
        setAnamnesisText(anamVal);
        latestAnamnesisRef.current = anamVal;
      }
    }
  }, [exam.id, exam.customFormValue, exam.anamnesis, template?.customForm]);



  const areaSuggestions = useMemo(() => {
    const area = exam.area || template?.area || '';
    return AREA_SUGGESTIONS[area] || AREA_SUGGESTIONS['default'];
  }, [exam.area, template?.area]);

  // Consciência do roteador: detecta red flags na instrução atual + clínica
  // para sinalizar quando o Motor Pro será acionado por segurança.
  const routerDecision = useMemo(() => routeMotor({
    area: exam.area || template?.area || '',
    examType: exam.examType,
    clinicalIndication: exam.clinicalIndication,
    anamnesis: [exam.anamnesis, prompt].filter(Boolean).join(' '),
    userMotor: selectedMotor,
  }), [exam.area, template?.area, exam.examType, exam.clinicalIndication, exam.anamnesis, prompt, selectedMotor]);

  const handleFormTextChange = (val: string) => {
    setFormText(val);
    latestValueRef.current = val;
    isDirtyRef.current = true;

    if (formSaveTimerRef.current) {
      clearTimeout(formSaveTimerRef.current);
    }

    formSaveTimerRef.current = setTimeout(async () => {
      try {
        await updateItem('exams', exam.id, { customFormValue: val });
        if (latestValueRef.current === val) {
          isDirtyRef.current = false;
        }
      } catch (err) {
        logger.error('Erro ao salvar customFormValue', err);
      }
    }, 800);
  };

  const handleBlurFormText = async (val: string) => {
    isFormFocusedRef.current = false;
    if (isDirtyRef.current) {
      if (formSaveTimerRef.current) clearTimeout(formSaveTimerRef.current);
      try {
        await updateItem('exams', exam.id, { customFormValue: val });
      } finally {
        if (latestValueRef.current === val) {
          isDirtyRef.current = false;
        }
      }
    }
  };

  const handleAnamnesisTextChange = (val: string) => {
    setAnamnesisText(val);
    latestAnamnesisRef.current = val;
    isAnamnesisDirtyRef.current = true;

    if (anamnesisSaveTimerRef.current) {
      clearTimeout(anamnesisSaveTimerRef.current);
    }

    anamnesisSaveTimerRef.current = setTimeout(async () => {
      try {
        await updateItem('exams', exam.id, { anamnesis: val });
        if (latestAnamnesisRef.current === val) {
          isAnamnesisDirtyRef.current = false;
        }
      } catch (err) {
        logger.error('Erro ao salvar anamnese', err);
      }
    }, 800);
  };

  const handleBlurAnamnesisText = async (val: string) => {
    isAnamnesisFocusedRef.current = false;
    if (isAnamnesisDirtyRef.current) {
      if (anamnesisSaveTimerRef.current) clearTimeout(anamnesisSaveTimerRef.current);
      try {
        await updateItem('exams', exam.id, { anamnesis: val });
      } finally {
        if (latestAnamnesisRef.current === val) {
          isAnamnesisDirtyRef.current = false;
        }
      }
    }
  };

  const handleResetForm = async () => {
    if (!template?.customForm) return;
    const ok = await confirm({
      title: 'Restaurar Formulário',
      message: 'Deseja restaurar o formulário padrão da máscara? Isso apagará as alterações locais.',
      confirmLabel: 'Restaurar',
      variant: 'warning',
    });
    if (ok) {
      if (formSaveTimerRef.current) {
        clearTimeout(formSaveTimerRef.current);
        formSaveTimerRef.current = null;
      }
      const val = template.customForm;
      setFormText(val);
      latestValueRef.current = val;
      isDirtyRef.current = false;
      await updateItem('exams', exam.id, { customFormValue: val });
      showToast('Formulário restaurado!', 'success');
    }
  };

  const handleClearChat = async () => {
    if (chatHistory.length === 0) return;
    const ok = await confirm({
      title: 'Limpar Conversa',
      message: 'Deseja limpar o histórico desta conversa com o copiloto?',
      confirmLabel: 'Limpar',
      variant: 'warning',
    });
    if (ok) {
      onChatUpdate([]);
      showToast('Conversa limpa.', 'info');
    }
  };

  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const lastCallRef = useRef<number>(0);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const onChangePromptRef = useRef(onChangePrompt);
  onChangePromptRef.current = onChangePrompt;
  const handleSendRef = useRef<(customPrompt?: string, preserveDraft?: boolean) => Promise<void>>(async () => {});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isGenerating]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      if (event.results[0].isFinal) {
        const current = promptRef.current;
        onChangePromptRef.current(current ? `${current} ${transcript}` : transcript);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== 'no-speech') {
        showToast('Erro na captura de voz', 'error');
      }
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [showToast]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      onChangePrompt('');
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // Envia automaticamente uma mensagem técnica injetada (resultado de
  // calculadora ou formulário). Roda no mount do copiloto e sempre que uma
  // nova injeção chega — independentemente do que houver na caixa de texto.
  // O ref garante idempotência: evita envio duplicado sob StrictMode (effect
  // executa 2× no mount) sem bloquear reenvio legítimo do mesmo resultado
  // (o pai zera `injectedMessage` entre injeções, resetando o ref).
  const lastInjectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!injectedMessage || !injectedMessage.trim()) {
      lastInjectionRef.current = null;
      return;
    }
    if (injectedMessage === lastInjectionRef.current) return;
    lastInjectionRef.current = injectedMessage;
    handleSendRef.current(injectedMessage, true);
    onInjectionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectedMessage]);

  const parseCalculatorMessage = (content: string) => {
    if (!content.startsWith('[RESULTADO TÉCNICO:')) return null;

    const titleMatch = content.match(/\[RESULTADO TÉCNICO:\s*(.*?)\]/);
    let title = 'Calculadora';
    let calcId: string | undefined;
    if (titleMatch) {
      const fullTitle = titleMatch[1];
      if (fullTitle.includes(' | ID: ')) {
        const parts = fullTitle.split(' | ID: ');
        title = parts[0];
        calcId = parts[1];
      } else {
        title = fullTitle;
      }
    }

    const conclusionMatch = content.match(/CONCLUSÃO:\s*(.*?)(?=\n\nMÉTRICAS|$)/s);
    const conclusion = conclusionMatch ? conclusionMatch[1].trim() : '';

    const metricsSection = content.split('MÉTRICAS COLETADAS:\n');
    const metrics: Array<{ key: string, value: string }> = [];
    if (metricsSection.length > 1) {
      const lines = metricsSection[1].split('\n');
      lines.forEach(line => {
        if (line.startsWith('- ')) {
          const parts = line.substring(2).split(': ');
          if (parts.length >= 2) {
            metrics.push({ key: parts[0].trim(), value: parts.slice(1).join(': ').trim() });
          }
        }
      });
    }

    return { title, conclusion, metrics, calcId };
  };

  const parseFormMessage = (content: string) => {
    if (!content.startsWith('[DADOS DE FORMULÁRIO COMPILADOS:')) return null;

    const titleMatch = content.match(/\[DADOS DE FORMULÁRIO COMPILADOS:\s*(.*?)\]/);
    const title = titleMatch ? titleMatch[1] : 'Formulário';

    const separator = 'DADOS DO FORMULÁRIO:\n';
    const bodyStart = content.indexOf(separator);
    let body = '';
    
    if (bodyStart !== -1) {
      body = content.substring(bodyStart + separator.length);
    } else {
      const fallbackStart = content.indexOf(']\n\n');
      body = fallbackStart !== -1 ? content.substring(fallbackStart + 3) : '';
    }

    return { title, body: body.trim() };
  };

  const parseMessageContent = (content: string) => {
    let conversation = content;
    let proposal = '';

    const conversaRegex = /^[=*\-#]*\s*CONVERSA\s*[=*\-#]*\s*$/im;
    const propostaRegex = /^[=*\-#]*\s*PROPOSTA\s*[=*\-#]*\s*$/im;

    const conversaMatch = content.match(conversaRegex);
    const propostaMatch = content.match(propostaRegex);

    if (conversaMatch && propostaMatch) {
      const conversaIndex = conversaMatch.index!;
      const propostaIndex = propostaMatch.index!;
      
      if (conversaIndex < propostaIndex) {
        conversation = content.substring(conversaIndex + conversaMatch[0].length, propostaIndex).trim();
        proposal = content.substring(propostaIndex + propostaMatch[0].length).trim();
      } else {
        proposal = content.substring(propostaIndex + propostaMatch[0].length, conversaIndex).trim();
        conversation = content.substring(conversaIndex + conversaMatch[0].length).trim();
      }
    } else if (conversaMatch) {
      conversation = content.substring(conversaMatch.index! + conversaMatch[0].length).trim();
    } else if (propostaMatch) {
      proposal = content.substring(propostaMatch.index! + propostaMatch[0].length).trim();
      conversation = content.substring(0, propostaMatch.index!).trim();
    } else {
      const htmlBlockMatch = content.match(/```html\s*([\s\S]*?)\s*```/i) || content.match(/```\s*(<h1[\s\S]*?)\s*```/i);
      if (htmlBlockMatch) {
        proposal = htmlBlockMatch[1].trim();
        conversation = content.substring(0, htmlBlockMatch.index).trim();
      } else {
        const firstTagMatch = content.match(/<h[1-6][\s>]|<p[\s>]/i);
        if (firstTagMatch && firstTagMatch.index !== undefined) {
          conversation = content.substring(0, firstTagMatch.index).trim();
          proposal = content.substring(firstTagMatch.index).trim();
        } else {
          conversation = content.trim();
        }
      }
    }

    if (proposal) {
      proposal = proposal
        .replace(/^```html\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    }

    conversation = stripScratchpad(conversation);
    proposal = stripScratchpad(proposal, true);

    if (!conversation && !proposal && content) {
      conversation = stripScratchpad(content, true) || content;
    }

    return { conversation, proposal };
  };

  const renderInlineFormat = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\d+(?:,\d+)?\s*(?:mm|cm³|cm|g|ml|cc|mL))/gi);

    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-extrabold text-ink-900 bg-brand-50/60 px-1 py-0.5 rounded border border-brand-100/30">
            {part.slice(2, -2)}
          </strong>
        );
      }

      const metricRegex = /^(\d+(?:,\d+)?)\s*(mm|cm³|cm|g|ml|cc|mL)$/i;
      const match = part.match(metricRegex);
      if (match) {
        const [, val, unit] = match;
        const isMm = unit.toLowerCase() === 'mm';
        return (
          <span
            key={idx}
            className={classNames(
              "px-1.5 py-0.5 rounded-md font-black text-[10px] inline-flex items-center border shadow-sm mx-0.5 whitespace-nowrap",
              isMm
                ? "bg-amber-50 text-amber-800 border-amber-200/50 shadow-amber-500/[0.03]"
                : "bg-brand-50 text-brand-800 border-brand-200/50 shadow-brand-500/[0.03]"
            )}
          >
            {val} {unit}
          </span>
        );
      }

      return part;
    });
  };

  const renderRichClinicalContent = (text: string, isUser: boolean) => {
    if (isUser) {
      return <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{text}</p>;
    }

    const paragraphs = text.split('\n\n');

    return (
      <div className="space-y-3">
        {paragraphs.map((para, pIdx) => {
          const lines = para.split('\n');
          const isBulletList = lines.length > 0 && lines.every(line => {
            const trimmed = line.trim();
            return !trimmed || trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
          });

          if (isBulletList) {
            return (
              <ul key={pIdx} className="space-y-2 my-1.5">
                {lines.map((line, lIdx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  const cleanLine = trimmed.replace(/^[•\-*]\s*/, '').trim();
                  return (
                    <li key={lIdx} className="flex items-start gap-2.5 text-xs text-ink-700 font-semibold leading-relaxed">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0 shadow-sm shadow-brand-500/30" />
                      <span className="flex-1">{renderInlineFormat(cleanLine)}</span>
                    </li>
                  );
                })}
              </ul>
            );
          }

          return (
            <p key={pIdx} className="text-xs text-ink-700 font-semibold leading-relaxed">
              {renderInlineFormat(para)}
            </p>
          );
        })}
      </div>
    );
  };

  const handleSend = async (customPrompt?: string, preserveDraft = false) => {
    const messageToSend = customPrompt || prompt;
    if (!messageToSend.trim() || isGenerating) return;

    // Mensagens técnicas (calculadora/formulário) são ações deliberadas do
    // médico — não devem ser barradas pelo anti-flood nem descartadas.
    const isTechnical =
      messageToSend.startsWith('[RESULTADO TÉCNICO:') ||
      messageToSend.startsWith('[DADOS DE FORMULÁRIO COMPILADOS:');

    const now = Date.now();
    if (!isTechnical && now - lastCallRef.current < 2000) {
      showToast('Aguarde um momento antes de enviar nova mensagem.', 'info');
      return;
    }
    lastCallRef.current = now;

    const hasKey = true; // Sempre tenta usar a API (chaves de fallback integradas no servidor)

    cancelActiveRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Preserva o rascunho do usuário quando o envio veio de uma injeção técnica.
    if (!preserveDraft) onChangePrompt('');
    const newHistory = [...chatHistory, { role: 'user' as const, content: messageToSend }];
    onChatUpdate(newHistory);
    setIsGenerating(true);
    setGenPhase('reasoning');
    setRefinePhase('idle');

    const historyWithAssistant = [...newHistory, { role: 'assistant' as const, content: '__thinking__' }];
    onChatUpdate(historyWithAssistant);

    // Roteador de segurança: red flag na instrução força o Motor Pro
    // (se disponível), ignorando a escolha do usuário.
    const decision = routeMotor({
      area: exam.area || template?.area || '',
      examType: exam.examType,
      clinicalIndication: exam.clinicalIndication,
      anamnesis: [exam.anamnesis, messageToSend].filter(Boolean).join(' '),
      userMotor: selectedMotor,
    });
    const effectiveSettings = (decision.forcedPro && motorProEnabled && settings.selectedMotor !== 'pro')
      ? { ...settings, selectedMotor: 'pro' as const }
      : settings;
    if (decision.forcedPro && motorProEnabled && settings.selectedMotor !== 'pro') {
      showToast('Motor Pro ativado: sinal clínico de alerta detectado.', 'info');
    }

    try {
      const previousExams = settings.aiTrainingEnabled
        ? await getRecentFinalizedReports(template?.id || '', settings.aiTrainingContextSize || 3)
        : [];

      let currentResponse = '';
      let hasSwitchedPhase = false;

      const finalHtml = await generateReportStream({
        examId: exam.id,
        instruction: messageToSend,
        currentReport: reportContent,
        patient,
        exam: {
          examType: exam.examType,
          area: exam.area,
          clinicalIndication: exam.clinicalIndication,
          requestingPhysician: exam.requestingPhysician,
          anamnesis: exam.anamnesis,
          createdAt: exam.examDate || exam.createdAt
        },
        template,
        settings: effectiveSettings,
        previousExams,
        signal: controller.signal
      }, (chunk, rawText) => {
        currentResponse = chunk;
        const textToAnalyze = rawText || chunk;

        if (!hasSwitchedPhase && textToAnalyze.includes('</scratchpad>')) {
          hasSwitchedPhase = true;
          setGenPhase('writing');
        } else if (!hasSwitchedPhase && textToAnalyze.includes('<scratchpad>')) {
          setGenPhase('reasoning');
        }

        const displayResponse = currentResponse.trim() || '__thinking__';
        onChatUpdate([...newHistory, { role: 'assistant', content: displayResponse }]);
      });

      setGenPhase('idle');
      onChatUpdate([...newHistory, { role: 'assistant', content: finalHtml }]);

      const { proposal } = parseMessageContent(finalHtml);
      if (proposal && proposal.trim().length > 10) {
        const cleanProposal = sanitizeHtml(proposal);
        if (cleanProposal && cleanProposal.trim().length > 10) {
          await saveVersionSnapshot(exam.id, reportContent, 'copilot');
          onUpdate(cleanProposal);

          const assistantMsgIndex = newHistory.length;
          setAppliedIndices(prev => [...prev, assistantMsgIndex]);

          if (template && autoRefineEnabled) {
            setRefinePhase('integrating');
            showToast('Alterações integradas! Refinando...', 'info');

            const chatWithRefining = [
              ...newHistory,
              { role: 'assistant' as const, content: finalHtml },
            ];
            onChatUpdate(chatWithRefining);

            await new Promise(r => setTimeout(r, 400));
            setRefinePhase('refining');

            let refinedHtml = '';
            const finalRefined = await generateReportStream({
              examId: exam.id,
              currentReport: cleanProposal,
              template,
              patient,
              settings: effectiveSettings,
              clinicalIndication: exam.clinicalIndication,
              requestingPhysician: exam.requestingPhysician,
              anamnesis: exam.anamnesis,
              previousExams,
              examDateMs: exam.examDate || exam.createdAt,
              signal: controller.signal
            }, (chunk) => {
              refinedHtml = chunk;
              if (refinedHtml.trim().length > 10) {
                onUpdate(sanitizeHtml(refinedHtml));
              }
            });

            setRefinePhase('idle');

            if (finalRefined && finalRefined.trim().length > 10) {
              const cleanRefined = sanitizeHtml(finalRefined);
              if (cleanRefined && cleanRefined.trim().length > 10) {
                onUpdate(cleanRefined);
                showToast('Laudo integrado e refinado com sucesso! ✓', 'success');
              } else {
                showToast('Falha no refinamento: laudo vazio gerado.', 'error');
                onUpdate(cleanProposal);
              }
            } else {
              showToast('Falha no refinamento: resposta vazia da IA.', 'error');
              onUpdate(cleanProposal);
            }

            onChatUpdate([
              ...newHistory,
              { role: 'assistant' as const, content: finalHtml }
            ]);
          } else {
            showToast('Alterações integradas com sucesso! ✓', 'success');
          }
        }
      }
    } catch (error: any) {
      setGenPhase('idle');
      setRefinePhase('idle');
      if (error && (error.name === 'AbortError' || String(error).toLowerCase().includes('abort'))) {
        logger.info('[LaudCopilot] Requisição cancelada pelo usuário.');
        setIsGenerating(false);
        return;
      }
      logger.error('[LaudCopilot] handleSend error', error);
      const msg = error instanceof Error ? error.message : String(error) || 'Erro desconhecido';
      const friendlyMsg = msg.includes('API Key') || msg.includes('api key') || msg.includes('apiKey')
        ? `Chave de API não configurada. Acesse Configurações para adicionar. (Detalhe: ${msg})`
        : msg.includes('403') || msg.includes('unauthorized') || msg.includes('Unauthorized')
          ? 'API Key inválida ou sem permissão. Verifique em Configurações.'
          : msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
            ? 'Limite de requisições da API atingido. Aguarde alguns segundos.'
            : msg.includes('network') || msg.includes('Failed to fetch') || msg.includes('CORS')
              ? 'Erro de conexão com a API. Verifique sua internet e a chave configurada.'
              : msg.includes('404') || msg.includes('not found') || msg.includes('models/')
                ? `Modelo de IA não encontrado. Verifique o nome do modelo em Configurações.`
                : `Erro na IA: ${msg.substring(0, 150)}`;
      showToast(friendlyMsg, 'error');
      onChatUpdate([...chatHistory, { role: 'assistant', content: `❌ ${friendlyMsg}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  handleSendRef.current = handleSend;



  const handleCompileForm = () => {
    const textToSend = formText;

    if (!textToSend.trim() && !anamnesisText.trim()) {
      showToast('Preencha a anamnese ou os dados do formulário antes de processar.', 'info');
      return;
    }

    if (formSaveTimerRef.current) {
      clearTimeout(formSaveTimerRef.current);
      formSaveTimerRef.current = null;
      isDirtyRef.current = false;
      updateItem('exams', exam.id, { customFormValue: textToSend });
    }

    if (anamnesisSaveTimerRef.current) {
      clearTimeout(anamnesisSaveTimerRef.current);
      anamnesisSaveTimerRef.current = null;
      isAnamnesisDirtyRef.current = false;
      updateItem('exams', exam.id, { anamnesis: anamnesisText });
    }

    const templateName = template?.name || exam.examType || 'Formulário';
    const area = exam.area || template?.area || '';

    let areaInstruction = '';
    if (area === 'medicina-fetal') {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA DE INSERÇÃO — MEDICINA FETAL:\nEstes são os dados biométricos, obstétricos e de vitalidade do exame coletados via formulário. Você DEVE:\n1. Inserir cada dado fornecido no campo correspondente da ANÁLISE.\n2. Calcular automaticamente: RCP = IP ACM / IP umbilical; IG atual e DPP se DUM fornecida.\n3. Classificar o PFE: AIG/GIG/PIG/RCIU se fornecido.\n4. Substituir todos os placeholders pelos dados reais.\n5. NÃO inventar dados não fornecidos.\n6. Atualizar CONCLUSÃO e RECOMENDAÇÕES.`;
    } else if (area === 'ginecologia') {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA — GINECOLOGIA:\nInserir dados nos campos correspondentes, aplicar O-RADS/MUSA se indicado, substituir placeholders, não inventar dados ausentes, atualizar conclusão e recomendações.`;
    } else if (area === 'vascular') {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA — VASCULAR:\nInserir valores Doppler nos campos correspondentes, substituir placeholders, não inventar dados, atualizar conclusão e recomendações.`;
    } else {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA:\nInserir cada achado no campo correspondente da ANÁLISE, substituir placeholders, não inventar dados, atualizar CONCLUSÃO e RECOMENDAÇÕES.`;
    }

    let findingsSummary = `[DADOS DE FORMULÁRIO COMPILADOS: ${templateName}]${areaInstruction}`;
    if (anamnesisText.trim()) {
      findingsSummary += `\n\nANAMNESE DO PACIENTE:\n${anamnesisText.trim()}`;
    }
    if (textToSend.trim()) {
      findingsSummary += `\n\nDADOS DO FORMULÁRIO:\n${textToSend.trim()}`;
    }

    setActiveTab('chat');
    handleSend(findingsSummary);
  };

  const phaseLabel = genPhase === 'reasoning'
    ? 'Raciocínando clinicamente...'
    : genPhase === 'writing'
    ? 'Redigindo proposta...'
    : 'IA Processando...';

  return (
    <div className={classNames(
      "flex flex-col h-full min-h-0 bg-white relative overflow-hidden",
      isDocked ? "" : ""
    )}>

      {/* ── Tab Bar ── */}
      <div className="flex border-b border-ink-100 bg-white shrink-0 select-none z-10">
        <button
          onClick={() => setActiveTab('chat')}
          className={classNames(
            "flex-1 flex items-center justify-center gap-1.5 py-3 px-3 text-[11px] font-black uppercase tracking-widest transition-all relative",
            activeTab === 'chat' ? "text-brand-700" : "text-ink-400 hover:text-ink-700"
          )}
        >
          <Sparkles size={12} className={activeTab === 'chat' ? "text-brand-500" : ""} />
          Chat Laud.IA
          {chatHistory.filter(m => m.role === 'user').length > 0 && (
            <span className="w-4 h-4 bg-brand-500 text-white text-[8px] font-black rounded-full flex items-center justify-center ml-0.5">
              {chatHistory.filter(m => m.role === 'user').length}
            </span>
          )}
          {activeTab === 'chat' && (
            <motion.div
              layoutId="copilot-tab-indicator"
              className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-600 rounded-full"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('form')}
          className={classNames(
            "flex-1 flex items-center justify-center gap-1.5 py-3 px-3 text-[11px] font-black uppercase tracking-widest transition-all relative",
            activeTab === 'form' ? "text-brand-700" : "text-ink-400 hover:text-ink-700"
          )}
        >
          <ClipboardList size={12} className={activeTab === 'form' ? "text-brand-500" : ""} />
          Formulário
          {activeTab === 'form' && (
            <motion.div
              layoutId="copilot-tab-indicator"
              className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-600 rounded-full"
            />
          )}
        </button>
      </div>

      {activeTab === 'chat' && (
        <>
          {/* ── Status header inteligente ── */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-ink-100 bg-gradient-to-r from-brand-50/50 via-white to-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Bot size={15} className="text-white" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white">
                  <span className="absolute inset-0.5 rounded-full bg-emerald-300 animate-pulse" />
                </span>
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[11px] font-black text-ink-800 tracking-tight">Copiloto LAUD.IA</div>
                <div className="flex items-center gap-1 text-[9px] text-ink-400 font-bold">
                  <ShieldCheck size={9} className="text-emerald-500" />
                  Verificação ativa
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {routerDecision.forcedPro && selectedMotor !== 'pro' && (
                <span
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-[9px] font-black uppercase tracking-widest"
                  title={routerDecision.reason}
                >
                  <ShieldAlert size={9} /> Pro auto
                </span>
              )}
              <span className={classNames(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border',
                (routerDecision.forcedPro || selectedMotor === 'pro')
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-indigo-600 text-white border-indigo-600'
              )}>
                {(routerDecision.forcedPro || selectedMotor === 'pro') ? <Sparkles size={9} /> : <Zap size={9} />}
                {(routerDecision.forcedPro || selectedMotor === 'pro') ? 'Pro' : 'Lite'}
              </span>
            </div>
          </div>

          {/* Refine phase banner */}
          <AnimatePresence>
            {refinePhase !== 'idle' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden shrink-0"
              >
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1 items-center">
                    <div className={classNames(
                      "w-2 h-2 rounded-full transition-all",
                      refinePhase === 'integrating' ? 'bg-violet-500 animate-pulse' : 'bg-emerald-500'
                    )} />
                    <div className={classNames(
                      "w-2 h-2 rounded-full transition-all",
                      refinePhase === 'refining' ? 'bg-violet-500 animate-pulse' : 'bg-ink-200'
                    )} />
                  </div>
                  <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                    {refinePhase === 'integrating' ? 'Etapa 1/2 — Integrando...' : 'Etapa 2/2 — Refinando...'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar bg-ink-50/40">
            <AnimatePresence mode="popLayout">
              {chatHistory.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center py-12 px-4"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200/80 flex items-center justify-center mb-5 shadow-sm">
                    <Sparkles size={26} className="text-brand-600" />
                  </div>
                  <h4 className="font-bold text-base text-ink-800 mb-1.5 tracking-tight">Como posso ajudar?</h4>
                  <p className="text-xs text-ink-500 max-w-[240px] text-center mb-6 leading-relaxed">
                    Descreva os achados, solicite um refino ou use as sugestões abaixo.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-[300px]">
                    <button
                      onClick={() => onShowCalculators()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 hover:border-amber-300 hover:bg-amber-100 text-amber-700 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                    >
                      <Calculator size={13} />
                      Calculadoras
                    </button>
                    {areaSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => { onChangePrompt(sug.text); handleSend(sug.text); }}
                        className="px-3 py-2 bg-white border border-ink-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 rounded-xl text-[11px] font-medium text-ink-600 transition-all shadow-sm active:scale-95"
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                chatHistory.map((msg, idx) => {
                  const isUser = msg.role === 'user';

                  if (!isUser && msg.content === '__thinking__') {
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2.5 items-start"
                      >
                        <div className="w-7 h-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shrink-0 mt-0.5">
                          <Bot size={14} />
                        </div>
                        <div className="bg-white border border-ink-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2.5">
                          {genPhase === 'reasoning'
                            ? <Brain size={13} className="text-violet-500 shrink-0" />
                            : genPhase === 'writing'
                            ? <Pencil size={13} className="text-brand-500 shrink-0" />
                            : <Loader2 size={13} className="animate-spin text-brand-400 shrink-0" />
                          }
                          <span className={classNames(
                            "text-[10px] font-black uppercase tracking-widest",
                            genPhase === 'reasoning' ? 'text-violet-700' : 'text-brand-700'
                          )}>
                            {phaseLabel}
                          </span>
                          <div className="flex gap-0.5 items-center h-3 ml-1">
                            {[0, 1, 2].map(i => (
                              <motion.div
                                key={i}
                                animate={{ scaleY: [1, 2.5, 1], opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                                className={classNames(
                                  "w-0.5 h-2.5 rounded-full",
                                  genPhase === 'reasoning' ? 'bg-violet-400' : 'bg-brand-400'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  if (isUser && msg.content.startsWith('[RESULTADO TÉCNICO:')) {
                    const calcData = parseCalculatorMessage(msg.content);
                    if (calcData) {
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="flex gap-2.5 flex-row-reverse items-start"
                        >
                          <div className="w-7 h-7 rounded-full bg-ink-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <User size={13} />
                          </div>
                          <div className="flex flex-col gap-2 max-w-[85%]">
                            <div className="bg-white border border-ink-100 rounded-2xl rounded-tr-none p-4 shadow-sm space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                  <Calculator size={14} />
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-ink-400 block">Calculadora</span>
                                  <span className="text-xs text-ink-800 font-bold block">{calcData.title}</span>
                                </div>
                              </div>
                              {calcData.conclusion && (
                                <div className="p-3 bg-ink-50 rounded-xl border border-ink-100">
                                  <p className="text-xs font-medium text-ink-700 leading-relaxed">{calcData.conclusion}</p>
                                </div>
                              )}
                              {calcData.metrics.length > 0 && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  {calcData.metrics.map((m, i) => (
                                    <div key={i} className="p-2.5 bg-white border border-ink-100 rounded-xl flex flex-col shadow-sm">
                                      <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest">{m.key}</span>
                                      <span className="text-xs font-bold text-ink-800 mt-0.5">{m.value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {calcData.calcId && (
                                <button
                                  onClick={() => onShowCalculators(calcData.calcId)}
                                  className="w-full h-8 rounded-xl bg-ink-50 border border-ink-200 hover:border-brand-300 hover:bg-brand-50 text-ink-500 hover:text-brand-600 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <RotateCcw size={11} />
                                  Reabrir Calculadora
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    }
                  }

                  if (isUser && msg.content.startsWith('[DADOS DE FORMULÁRIO COMPILADOS:')) {
                    const formData = parseFormMessage(msg.content);
                    if (formData) {
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="flex gap-2.5 flex-row-reverse items-start"
                        >
                          <div className="w-7 h-7 rounded-full bg-ink-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <User size={13} />
                          </div>
                          <div className="flex flex-col gap-2 max-w-[85%]">
                            <div className="bg-white border border-ink-100 rounded-2xl rounded-tr-none p-4 shadow-sm space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                                  <ClipboardList size={14} />
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-ink-400 block">Formulário</span>
                                  <span className="text-xs text-ink-800 font-bold block">{formData.title}</span>
                                </div>
                              </div>
                              <div className="p-3 bg-ink-50 rounded-xl border border-ink-100 max-h-[180px] overflow-y-auto custom-scrollbar">
                                <p className="text-xs font-medium text-ink-700 whitespace-pre-wrap leading-relaxed">{formData.body}</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }
                  }

                  const { conversation, proposal } = parseMessageContent(msg.content);

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={classNames(
                        "flex gap-2.5 items-start",
                        isUser ? "flex-row-reverse" : ""
                      )}
                    >
                      <div className={classNames(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border",
                        isUser
                          ? "bg-ink-900 text-white border-ink-800"
                          : "bg-brand-50 text-brand-600 border-brand-100"
                      )}>
                        {isUser ? <User size={13} /> : <Bot size={14} />}
                      </div>

                      <div className={classNames(
                        "flex flex-col gap-2",
                        isUser ? "items-end max-w-[84%]" : "items-start max-w-[88%]"
                      )}>
                        <div className={classNames(
                          "px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                          isUser
                            ? "bg-ink-900 text-white rounded-tr-none"
                            : "bg-white border border-ink-100 text-ink-800 rounded-tl-none"
                        )}>
                          {isUser
                            ? <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{conversation}</p>
                            : renderRichClinicalContent(conversation, false)
                          }
                        </div>

                        {!isUser && proposal && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full bg-gradient-to-br from-brand-50 to-brand-100/40 border border-brand-200/70 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm"
                          >
                            <div className="flex items-center gap-1.5">
                              <Sparkles size={11} className="text-brand-500" />
                              <span className="text-[10px] font-black text-brand-800 uppercase tracking-widest">
                                {appliedIndices.includes(idx) ? 'Laudo Atualizado' : 'Proposta Pronta'}
                              </span>
                              {appliedIndices.includes(idx) && (
                                <CheckCircle2 size={11} className="text-emerald-500 ml-auto" />
                              )}
                            </div>

                            {/* Avaliação da proposta (auditoria + anti-alucinação) */}
                            <ReportQualityPanel
                              html={proposal}
                              area={exam.area || template?.area}
                              anamnesis={exam.anamnesis}
                              clinicalIndication={exam.clinicalIndication}
                              compact
                            />

                            <button
                              disabled={isGenerating}
                              onClick={async () => {
                                if (isGenerating) return;
                                await saveVersionSnapshot(exam.id, reportContent, 'copilot');
                                onUpdate(sanitizeHtml(proposal));
                                if (!appliedIndices.includes(idx)) {
                                  setAppliedIndices(prev => [...prev, idx]);
                                }
                                showToast('Alterações aplicadas com sucesso.', 'success');
                              }}
                              className={classNames(
                                "h-9 w-full rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98]",
                                isGenerating
                                  ? "bg-ink-100 text-ink-400 cursor-not-allowed"
                                  : appliedIndices.includes(idx)
                                    ? "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    : "bg-ink-900 hover:bg-ink-700 text-white shadow-sm"
                              )}
                            >
                              {isGenerating
                                ? <><Loader2 size={13} className="animate-spin" /> Processando...</>
                                : appliedIndices.includes(idx)
                                  ? <><RotateCcw size={13} /> Reaplicar ao Laudo</>
                                  : <><Zap size={13} /> Aplicar ao Laudo</>
                              }
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>

            {/* Follow-up suggestions after last AI response */}
            <AnimatePresence>
              {!isGenerating && chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'assistant' && chatHistory[chatHistory.length - 1]?.content !== '__thinking__' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-1 pt-1 pb-1"
                >
                  <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Lightbulb size={9} className="text-amber-500" />
                    Próximos passos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {areaSuggestions.slice(0, 3).map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => { onChangePrompt(sug.text); handleSend(sug.text); }}
                        className="px-2.5 py-1.5 bg-white border border-ink-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 text-ink-600 rounded-full text-[10px] font-semibold transition-all active:scale-95 shadow-sm"
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 pb-4 bg-white border-t border-ink-100 shrink-0 flex flex-col gap-2.5">
            <div className="flex items-end gap-1.5 bg-ink-50 border border-ink-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/10 rounded-2xl px-2 py-1.5 transition-all">
              <button
                onClick={() => onShowCalculators()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-400 hover:bg-white hover:text-amber-600 hover:shadow-sm transition-all shrink-0"
                title="Calculadoras"
              >
                <Calculator size={16} />
              </button>

              <textarea
                value={prompt}
                onChange={(e) => onChangePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isGenerating ? 'IA processando...' : 'Descreva achados ou peça um ajuste...'}
                disabled={isGenerating}
                className="flex-1 bg-transparent outline-none text-sm font-medium text-ink-800 placeholder-ink-400 resize-none max-h-28 min-h-[34px] py-1.5 px-1 disabled:opacity-50"
                rows={prompt.split('\n').length > 1 ? Math.min(prompt.split('\n').length, 4) : 1}
              />

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={toggleListening}
                  title={isListening ? 'Parar ditado' : 'Ditado por voz'}
                  className={classNames(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-500 text-white shadow-sm animate-pulse"
                      : "text-ink-400 hover:bg-white hover:text-ink-700 hover:shadow-sm"
                  )}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>

                {isGenerating ? (
                  <button
                    onClick={handleCancelGeneration}
                    className="w-8 h-8 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                    title="Cancelar"
                  >
                    <StopCircle size={15} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-8 h-8 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                    title="Enviar (Enter)"
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Toggles row */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => handleToggleAutoRefine(!autoRefineEnabled)}
                  className="flex items-center gap-1.5 group animate-fade-in"
                >
                  <div className={classNames(
                    "w-7 h-4 rounded-full transition-colors relative shrink-0",
                    autoRefineEnabled ? "bg-brand-500" : "bg-ink-200"
                  )}>
                    <div className={classNames(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                      autoRefineEnabled ? "translate-x-3.5" : "translate-x-0.5"
                    )} />
                  </div>
                  <span className="text-[10px] text-ink-500 font-medium group-hover:text-ink-700 transition-colors select-none">
                    Refino Auto
                  </span>
                </button>

                <button
                  onClick={() => handleToggleFastMode(!aiFastMode)}
                  className="flex items-center gap-1.5 group animate-fade-in"
                >
                  <div className={classNames(
                    "w-7 h-4 rounded-full transition-colors relative shrink-0",
                    aiFastMode ? "bg-brand-500" : "bg-ink-200"
                  )}>
                    <div className={classNames(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                      aiFastMode ? "translate-x-3.5" : "translate-x-0.5"
                    )} />
                  </div>
                  <span className="text-[10px] text-ink-500 font-medium group-hover:text-ink-700 transition-colors select-none">
                    Modo Rápido
                  </span>
                </button>

                {/* AI Motor toggle */}
                <div className="flex items-center gap-0.5 bg-ink-100 border border-ink-200 rounded-xl p-0.5 shrink-0">
                  <button
                    onClick={() => handleMotorChange('lite')}
                    className={classNames(
                      'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                      selectedMotor === 'lite' ? 'bg-indigo-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-700'
                    )}
                  >
                    <Zap size={8} />
                    Lite
                  </button>
                  <button
                    disabled={!motorProEnabled}
                    onClick={() => handleMotorChange('pro')}
                    className={classNames(
                      'flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                      !motorProEnabled ? 'text-ink-300 cursor-not-allowed' :
                      selectedMotor === 'pro' ? 'bg-violet-600 text-white shadow-sm' :
                      'text-ink-500 hover:text-ink-700'
                    )}
                  >
                    <Sparkles size={8} />
                    Pro
                    {!motorProEnabled && <Lock size={8} />}
                  </button>
                </div>

                {/* Quota Progress */}
                <span className="text-[9px] text-ink-400 font-black tracking-wider uppercase shrink-0">
                  {reportsUsed}/{reportsQuota === 9999 ? '∞' : reportsQuota} laudos
                </span>
              </div>

              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-red-500 transition-colors font-medium"
                >
                  <Trash2 size={10} />
                  Limpar
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'form' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">

            {/* Anamnese section */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 overflow-hidden shadow-sm shrink-0">
              <div className="px-3.5 pt-3 pb-2.5 flex items-center gap-2 border-b border-indigo-100/60">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileText size={12} />
                </div>
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Anamnese / Clínica</span>
              </div>
              <div className="p-3">
                <textarea
                  value={anamnesisText}
                  onFocus={() => isAnamnesisFocusedRef.current = true}
                  onBlur={(e) => handleBlurAnamnesisText(e.target.value)}
                  onChange={(e) => handleAnamnesisTextChange(e.target.value)}
                  placeholder="Histórico clínico, queixas ou sintomas do paciente..."
                  className="w-full text-xs font-medium text-ink-700 bg-white border border-indigo-100 focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-300 rounded-xl p-3 resize-y outline-none transition-colors leading-relaxed"
                  style={{ minHeight: '60px', height: '90px' }}
                />
              </div>
            </div>

            {/* Findings / Form text */}
            <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-sm">
              <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between border-b border-ink-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center shrink-0">
                    <ClipboardList size={12} />
                  </div>
                  <span className="text-[10px] font-black text-ink-600 uppercase tracking-widest">Achados Clínicos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onShowCalculators()}
                    className="h-6 px-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 active:scale-95"
                  >
                    <Calculator size={10} />
                    Calc.
                  </button>
                  {template?.customForm && (
                    <button
                      onClick={handleResetForm}
                      className="h-6 px-2 rounded-lg bg-ink-50 border border-ink-200 text-ink-500 text-[9px] font-bold hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors flex items-center gap-1 active:scale-95"
                    >
                      <RotateCcw size={10} />
                      Restaurar
                    </button>
                  )}
                </div>
              </div>
              <div className="p-3">
                <textarea
                  value={formText}
                  onFocus={() => isFormFocusedRef.current = true}
                  onBlur={(e) => handleBlurFormText(e.target.value)}
                  onChange={(e) => handleFormTextChange(e.target.value)}
                  placeholder="Digite de forma livre ou cole os achados para que a IA integre ao laudo..."
                  className="w-full p-3 bg-ink-50 border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/10 focus:bg-white rounded-xl outline-none transition-colors text-xs font-mono text-ink-700 resize-y leading-relaxed"
                  style={{ minHeight: '80px', height: '160px' }}
                />
              </div>
            </div>
          </div>

          <div className="p-3 pb-4 bg-white border-t border-ink-100 shrink-0">
            <button
              onClick={handleCompileForm}
              disabled={isGenerating}
              className="w-full h-11 rounded-2xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            >
              {isGenerating
                ? <><Loader2 size={15} className="animate-spin" /> Processando...</>
                : <><Sparkles size={15} /> Processar e Integrar ao Laudo</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

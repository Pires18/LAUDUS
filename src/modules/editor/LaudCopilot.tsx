import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send, Loader2, Sparkles, Bot, User, Mic, MicOff, Calculator,
  Lightbulb, Zap, Command, ChevronRight, ClipboardList, RotateCcw, CheckCircle2, AlertCircle,
  X, Trash2, MessageSquare, ChevronDown, StopCircle, Brain, Pencil, ChevronUp
} from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { useApp } from '../../store/app';
import { updateItem, saveVersionSnapshot } from '../../store/db';
import { logger } from '../../utils/logger';
import { ExamRequest, Patient, ReportTemplate } from '../../types';
import { generateReportStream, stripScratchpad } from '../ai/engine';
import { classNames } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceAnalyzer } from './hooks/useVoiceAnalyzer';

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
  isDocked
}: LaudCopilotProps) {
  const { settings, updateSettings, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');
  const [formText, setFormText] = useState(exam.customFormValue ?? template?.customForm ?? '');
  const [appliedIndices, setAppliedIndices] = useState<number[]>([]);
  const [structuredValues, setStructuredValues] = useState<Record<string, string>>({});
  const [useStructuredForm, setUseStructuredForm] = useState(false);
  const [refinePhase, setRefinePhase] = useState<'idle' | 'integrating' | 'refining'>('idle');
  const [genPhase, setGenPhase] = useState<'idle' | 'reasoning' | 'writing'>('idle');

  const autoRefineEnabled = settings.aiAutoRefineEnabled ?? false;
  const handleToggleAutoRefine = (val: boolean) => {
    updateSettings({ ...settings, aiAutoRefineEnabled: val });
  };

  const isDirtyRef = useRef(false);
  const prevExamIdRef = useRef(exam.id);
  const formSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(formText);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFormFocusedRef = useRef(false);

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
    };
  }, []);

  useEffect(() => {
    if (prevExamIdRef.current !== exam.id) {
      if (formSaveTimerRef.current) {
        clearTimeout(formSaveTimerRef.current);
        formSaveTimerRef.current = null;
      }
      const val = exam.customFormValue ?? template?.customForm ?? '';
      setFormText(val);
      latestValueRef.current = val;
      isDirtyRef.current = false;
      prevExamIdRef.current = exam.id;
      setStructuredValues({});
    } else {
      if (!isDirtyRef.current && !isFormFocusedRef.current) {
        const val = exam.customFormValue ?? template?.customForm ?? '';
        setFormText(val);
        latestValueRef.current = val;
      }
    }
  }, [exam.id, exam.customFormValue, template?.customForm]);

  const structuredFields: StructuredField[] | null = useMemo(() => {
    const area = exam.area || template?.area || '';
    if (area === 'medicina-fetal') return FETAL_FIELDS;
    if (area === 'ginecologia') return GYNECO_FIELDS;
    if (area === 'vascular') return VASCULAR_FIELDS;
    return null;
  }, [exam.area, template?.area]);

  const areaSuggestions = useMemo(() => {
    const area = exam.area || template?.area || '';
    return AREA_SUGGESTIONS[area] || AREA_SUGGESTIONS['default'];
  }, [exam.area, template?.area]);

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

  const handleResetForm = async () => {
    if (!template?.customForm) return;
    if (window.confirm('Deseja restaurar o formulário padrão da máscara? Isso apagará as alterações locais.')) {
      if (formSaveTimerRef.current) {
        clearTimeout(formSaveTimerRef.current);
        formSaveTimerRef.current = null;
      }
      const val = template.customForm;
      setFormText(val);
      latestValueRef.current = val;
      isDirtyRef.current = false;
      setStructuredValues({});
      await updateItem('exams', exam.id, { customFormValue: val });
      showToast('Formulário restaurado!', 'success');
    }
  };

  const handleClearChat = () => {
    if (chatHistory.length === 0) return;
    if (window.confirm('Deseja limpar o histórico desta conversa com o copiloto?')) {
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
  const handleSendRef = useRef<(customPrompt?: string) => Promise<void>>(async () => {});

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

  useEffect(() => {
    if (prompt && prompt.startsWith('[RESULTADO TÉCNICO:')) {
      handleSendRef.current(prompt);
    }
  }, [prompt]);

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

  const handleSend = async (customPrompt?: string) => {
    const messageToSend = customPrompt || prompt;
    if (!messageToSend.trim() || isGenerating) return;

    const now = Date.now();
    if (now - lastCallRef.current < 2000) {
      showToast('Aguarde um momento antes de enviar nova mensagem.', 'info');
      return;
    }
    lastCallRef.current = now;

    const hasKey = settings.aiProvider === 'anthropic' ? !!settings.anthropicApiKey : !!settings.geminiApiKey;
    if (!hasKey) {
      showToast(`Configure a API do ${settings.aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'}`, 'error');
      return;
    }

    cancelActiveRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    onChangePrompt('');
    const newHistory = [...chatHistory, { role: 'user' as const, content: messageToSend }];
    onChatUpdate(newHistory);
    setIsGenerating(true);
    setGenPhase('reasoning');
    setRefinePhase('idle');

    const historyWithAssistant = [...newHistory, { role: 'assistant' as const, content: '__thinking__' }];
    onChatUpdate(historyWithAssistant);

    try {
      const { getRecentFinalizedReports } = await import('../../store/db');
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
        settings,
        previousExams,
        signal: controller.signal
      }, (chunk) => {
        currentResponse = chunk;

        if (!hasSwitchedPhase && chunk.includes('</scratchpad>')) {
          hasSwitchedPhase = true;
          setGenPhase('writing');
        } else if (!hasSwitchedPhase && chunk.includes('<scratchpad>')) {
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
              settings,
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
        ? 'Chave de API não configurada. Acesse Configurações para adicionar.'
        : msg.includes('403') || msg.includes('unauthorized') || msg.includes('Unauthorized')
          ? 'API Key inválida ou sem permissão. Verifique em Configurações.'
          : msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
            ? 'Limite de requisições da API atingido. Aguarde alguns segundos.'
            : msg.includes('network') || msg.includes('Failed to fetch') || msg.includes('CORS')
              ? 'Erro de conexão com a API. Verifique sua internet e a chave configurada.'
              : msg.includes('404') || msg.includes('not found') || msg.includes('models/')
                ? `Modelo de IA não encontrado. Verifique o nome do modelo em Configurações.`
                : `Erro na IA: ${msg.substring(0, 100)}`;
      showToast(friendlyMsg, 'error');
      onChatUpdate([...chatHistory, { role: 'assistant', content: `❌ ${friendlyMsg}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  handleSendRef.current = handleSend;

  const buildStructuredFormText = (): string => {
    if (!structuredFields) return '';
    const lines: string[] = [];
    for (const field of structuredFields) {
      const val = structuredValues[field.id];
      if (val && val.trim()) {
        lines.push(`${field.label}: ${val.trim()}${field.unit ? ' ' + field.unit : ''}`);
      }
    }
    return lines.join('\n');
  };

  const handleCompileForm = () => {
    let textToSend = '';

    if (useStructuredForm && structuredFields) {
      textToSend = buildStructuredFormText();
      if (!textToSend.trim()) {
        showToast('Preencha pelo menos um campo do formulário.', 'info');
        return;
      }
    } else {
      textToSend = formText;
      if (!textToSend.trim()) {
        showToast('Preencha o formulário antes de compilar.', 'info');
        return;
      }
    }

    if (formSaveTimerRef.current) {
      clearTimeout(formSaveTimerRef.current);
      formSaveTimerRef.current = null;
      isDirtyRef.current = false;
      updateItem('exams', exam.id, { customFormValue: textToSend });
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

    const findingsSummary = `[DADOS DE FORMULÁRIO COMPILADOS: ${templateName}]${areaInstruction}\n\nDADOS DO FORMULÁRIO:\n${textToSend.trim()}`;
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
      "flex flex-col h-full min-h-0 bg-ink-50 relative overflow-hidden",
      isDocked ? "shadow-none" : "rounded-none md:rounded-b-[2.5rem]"
    )}>
      <div className="flex border-b border-ink-100 bg-white p-1.5 shrink-0 select-none z-10 shadow-sm">
        <button
          onClick={() => setActiveTab('chat')}
          className={classNames(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === 'chat'
              ? "bg-ink-900 text-white shadow-md shadow-ink-900/10"
              : "text-ink-500 hover:text-ink-800 hover:bg-ink-50"
          )}
        >
          <Sparkles size={14} className={classNames(activeTab === 'chat' && "animate-pulse")} />
          Chat Laud.IA
          {chatHistory.filter(m => m.role === 'user').length > 0 && (
            <span className="text-[9px] bg-brand-500 text-white rounded-full px-1.5 py-0.5 font-black ml-0.5">
              {chatHistory.filter(m => m.role === 'user').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('form')}
          className={classNames(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === 'form'
              ? "bg-ink-900 text-white shadow-md shadow-ink-900/10"
              : "text-ink-500 hover:text-ink-800 hover:bg-ink-50"
          )}
        >
          <ClipboardList size={14} />
          Formulário Rápido
        </button>
      </div>

      {activeTab === 'chat' && (
        <>
          <AnimatePresence>
            {refinePhase !== 'idle' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden shrink-0"
              >
                <div className="bg-violet-50 border-b border-violet-100 px-4 py-2 flex items-center gap-3">
                  <div className="flex gap-1 items-center">
                    <div className={classNames(
                      "w-2 h-2 rounded-full",
                      refinePhase === 'integrating' ? 'bg-violet-500 animate-pulse' : 'bg-emerald-500'
                    )} />
                    <div className={classNames(
                      "w-2 h-2 rounded-full",
                      refinePhase === 'refining' ? 'bg-violet-500 animate-pulse' : 'bg-ink-200'
                    )} />
                  </div>
                  <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                    {refinePhase === 'integrating' ? 'Etapa 1/2 — Integrando alteração...' : 'Etapa 2/2 — Refinando e padronizando...'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth bg-gradient-to-b from-white/40 to-ink-50/60 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {chatHistory.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full flex flex-col items-center justify-center py-10"
                >
                  <div className="w-12 h-12 rounded-2xl bg-ink-100/80 text-brand-600 flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="font-semibold text-lg text-ink-800 tracking-tight mb-2">Como posso ajudar?</h4>
                  <p className="text-xs text-ink-500 max-w-[260px] text-center mb-6">
                    Descreva alterações, solicite refinos ou clique nas sugestões abaixo.
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
                    <button
                      onClick={() => onShowCalculators()}
                      className="px-3 py-2 bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-200 hover:border-brand-400 text-brand-700 rounded-full text-[11px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                    >
                      <Calculator size={14} />
                      Calculadoras
                    </button>
                    {areaSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onChangePrompt(sug.text);
                          handleSend(sug.text);
                        }}
                        className="px-3 py-2 bg-white border border-ink-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 rounded-full text-[11px] font-medium text-ink-600 transition-colors shadow-sm active:scale-95"
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
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-sm shrink-0">
                          <Loader2 size={18} className="animate-spin text-brand-500" />
                        </div>
                        <div className="bg-white border border-ink-100 px-5 py-3.5 rounded-2xl rounded-tl-none text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-sm">
                          {genPhase === 'reasoning'
                            ? <Brain size={14} className="text-violet-500 shrink-0" />
                            : genPhase === 'writing'
                            ? <Pencil size={14} className="text-brand-500 shrink-0" />
                            : <Loader2 size={14} className="animate-spin text-brand-500 shrink-0" />
                          }
                          <span className={genPhase === 'reasoning' ? 'text-violet-700' : 'text-brand-700'}>
                            {phaseLabel}
                          </span>
                          <div className="flex gap-1 items-center h-4 ml-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                animate={{ scaleY: [1, 2, 1], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                                className={classNames(
                                  "w-0.5 h-3 rounded-full",
                                  genPhase === 'reasoning' ? 'bg-violet-500' : 'bg-brand-500'
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
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="flex gap-3 w-full flex-row-reverse"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border-2 bg-brand-600 text-white border-brand-500 shadow-brand-500/10">
                            <User size={18} />
                          </div>
                          <div className="flex flex-col gap-2 max-w-[82%]">
                            <div className="bg-white border border-brand-100 rounded-2xl rounded-tr-none p-4 shadow-sm space-y-4 relative overflow-hidden">
                              <div className="flex items-center gap-2.5 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center shadow-sm">
                                  <Calculator size={16} />
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest block text-ink-400">Calculadora</span>
                                  <span className="text-[11px] text-ink-800 font-bold uppercase tracking-tight block">{calcData.title}</span>
                                </div>
                              </div>
                              {calcData.conclusion && (
                                <div className="p-3 bg-ink-50 border border-ink-100 rounded-xl relative z-10">
                                  <p className="text-[11px] font-bold text-ink-700 leading-relaxed">{calcData.conclusion}</p>
                                </div>
                              )}
                              {calcData.metrics.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                  {calcData.metrics.map((m, i) => (
                                    <div key={i} className="p-2.5 bg-white border border-ink-100 rounded-xl flex flex-col shadow-sm">
                                      <span className="text-[8px] font-black text-ink-400 uppercase tracking-widest">{m.key}</span>
                                      <span className="text-[11px] font-bold text-ink-800 mt-1">{m.value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {calcData.calcId && (
                                <button
                                  onClick={() => onShowCalculators(calcData.calcId)}
                                  className="mt-2 w-full py-2 bg-white border border-brand-200 hover:border-brand-400 hover:bg-brand-50 text-brand-600 rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                  <RotateCcw size={12} />
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
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className="flex gap-3 w-full flex-row-reverse"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border-2 bg-brand-600 text-white border-brand-500 shadow-brand-500/10">
                            <User size={18} />
                          </div>
                          <div className="flex flex-col gap-2 max-w-[82%]">
                            <div className="bg-white border border-brand-100 rounded-2xl rounded-tr-none p-4 shadow-sm space-y-4 relative overflow-hidden">
                              <div className="flex items-center gap-2.5 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-sm">
                                  <ClipboardList size={16} />
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest block text-ink-400">Achados do Formulário</span>
                                  <span className="text-[11px] text-ink-800 font-bold uppercase tracking-tight block">{formData.title}</span>
                                </div>
                              </div>
                              <div className="relative z-10 p-4 bg-ink-50 border border-ink-100 rounded-xl max-h-[220px] overflow-y-auto custom-scrollbar">
                                <p className="text-[11px] font-medium text-ink-700 whitespace-pre-wrap leading-relaxed">{formData.body}</p>
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
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={classNames(
                        "flex gap-3 w-full",
                        isUser ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div className={classNames(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border-2",
                        isUser ? "bg-ink-900 text-white border-ink-800 shadow-ink-900/10" : "bg-white border-ink-100 text-brand-600 shadow-sm"
                      )}>
                        {isUser ? <User size={18} /> : <Bot size={18} />}
                      </div>

                      <div className="flex flex-col gap-2 max-w-[82%]">
                        <div className={classNames(
                          "p-4 rounded-2xl text-xs leading-relaxed shadow-sm border transition-all hover:shadow-md",
                          isUser
                            ? "bg-brand-50 text-brand-900 border-brand-100 rounded-tr-none shadow-md shadow-brand-500/5"
                            : "bg-white border-ink-200 text-ink-800 rounded-tl-none shadow-sm"
                        )}>
                          {renderRichClinicalContent(conversation, isUser)}
                        </div>

                        {!isUser && proposal && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-brand-50 border border-brand-200/60 rounded-2xl p-3 flex flex-col gap-2 shadow-sm relative mt-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-brand-800 flex items-center gap-1.5">
                                <Sparkles size={12} className="text-brand-500" />
                                {appliedIndices.includes(idx) ? 'Laudo Modificado' : 'Sugestão Pronta'}
                              </span>
                            </div>
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
                                "h-8 px-3 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-2 group",
                                isGenerating
                                  ? "bg-ink-200 text-ink-500 cursor-not-allowed"
                                  : appliedIndices.includes(idx)
                                    ? "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    : "bg-ink-900 hover:bg-ink-800 text-white shadow-sm hover:shadow active:scale-95"
                              )}
                            >
                              {isGenerating ? (
                                <><Loader2 size={14} className="animate-spin" /> Processando...</>
                              ) : appliedIndices.includes(idx) ? (
                                <><CheckCircle2 size={14} /> Aplicado (Clique para reaplicar)</>
                              ) : (
                                <><Zap size={14} /> Aplicar ao Laudo</>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 pb-8 sm:pb-4 bg-white border-t border-ink-100 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] shrink-0 flex flex-col gap-3">
            <div className="flex items-end gap-2 bg-ink-50 border border-ink-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/10 rounded-2xl p-1.5 transition-all">
              <button
                onClick={() => onShowCalculators()}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-400 hover:bg-ink-200/50 hover:text-ink-700 transition-colors shrink-0"
                title="Calculadoras Clínicas"
              >
                <Calculator size={18} />
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
                placeholder={isGenerating ? 'IA processando...' : 'Ex: cisto de 15 mm no rim direito...'}
                disabled={isGenerating}
                className="flex-1 w-full bg-transparent outline-none text-sm font-medium text-ink-800 placeholder-ink-400 resize-none max-h-32 min-h-[36px] py-2 px-1 disabled:opacity-50"
                rows={prompt.split('\n').length > 1 ? Math.min(prompt.split('\n').length, 4) : 1}
              />

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={toggleListening}
                  className={classNames(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-50 text-red-600"
                      : "text-ink-400 hover:bg-ink-200/50 hover:text-ink-700"
                  )}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {isGenerating ? (
                  <button
                    onClick={handleCancelGeneration}
                    className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-sm active:scale-95"
                    title="Cancelar geração"
                  >
                    <StopCircle size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={autoRefineEnabled}
                  onChange={(e) => handleToggleAutoRefine(e.target.checked)}
                />
                <div className={classNames(
                  "w-6 h-3.5 rounded-full p-0.5 transition-colors",
                  autoRefineEnabled ? "bg-brand-500" : "bg-ink-300"
                )}>
                  <div className={classNames(
                    "w-2.5 h-2.5 rounded-full bg-white transition-transform shadow-sm",
                    autoRefineEnabled && "translate-x-2.5"
                  )} />
                </div>
                <span className="text-[10px] text-ink-500 font-medium group-hover:text-ink-800 transition-colors">
                  Refino Automático
                </span>
              </label>

              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-red-500 transition-colors font-medium"
                  title="Limpar conversa"
                >
                  <Trash2 size={11} />
                  Limpar
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'form' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white animate-fade-in">
          <div className="flex-1 flex flex-col p-4 space-y-3 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-600">
                {useStructuredForm && structuredFields ? 'Formulário Estruturado' : 'Anotações Livres'}
              </span>
              <div className="flex items-center gap-2">
                {structuredFields && (
                  <button
                    onClick={() => setUseStructuredForm(!useStructuredForm)}
                    className={classNames(
                      "flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1.5 rounded-lg border transition-all",
                      useStructuredForm
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "bg-white border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-600"
                    )}
                  >
                    <ClipboardList size={12} />
                    {useStructuredForm ? 'Modo Livre' : 'Campos Guiados'}
                  </button>
                )}
                <button
                  onClick={() => onShowCalculators()}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-ink-600 hover:text-brand-600 hover:bg-brand-50 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Calculator size={14} />
                  Calculadoras
                </button>
                {template?.customForm && !useStructuredForm && (
                  <button
                    onClick={handleResetForm}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-ink-600 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-md transition-colors"
                  >
                    <RotateCcw size={14} />
                    Restaurar
                  </button>
                )}
              </div>
            </div>

            {useStructuredForm && structuredFields ? (
              <div className="grid grid-cols-2 gap-3">
                {structuredFields.map(field => (
                  <StructuredFormField
                    key={field.id}
                    field={field}
                    value={structuredValues[field.id] || ''}
                    onChange={v => setStructuredValues(prev => ({ ...prev, [field.id]: v }))}
                  />
                ))}
              </div>
            ) : (
              <textarea
                value={formText}
                onFocus={() => isFormFocusedRef.current = true}
                onBlur={(e) => handleBlurFormText(e.target.value)}
                onChange={(e) => handleFormTextChange(e.target.value)}
                placeholder="Digite de forma livre ou cole os achados para que a IA os organize e integre ao laudo..."
                className="flex-1 w-full p-4 bg-ink-50 border border-ink-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/10 focus:bg-white rounded-xl outline-none transition-all text-sm font-mono text-ink-700 resize-none shadow-inner"
                style={{ minHeight: '200px' }}
              />
            )}
          </div>

          <div className="p-4 bg-white border-t border-ink-100 shrink-0">
            <button
              onClick={handleCompileForm}
              disabled={isGenerating}
              className="w-full h-11 rounded-xl bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? 'Processando...' : 'Processar e Atualizar Laudo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

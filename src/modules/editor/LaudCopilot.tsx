import { useState, useRef, useEffect } from 'react';
import { 
  Send, Loader2, Sparkles, Bot, User, Mic, MicOff, Calculator, 
  Lightbulb, Zap, Command, ChevronRight, Search, ShieldCheck,
  ClipboardList, CheckCircle2
} from 'lucide-react';
import { useApp } from '../../store/app';
import { ExamRequest, Patient, ReportTemplate } from '../../types';
import { generateReportStream, stripScratchpad } from '../ai/gemini';
import { classNames } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';

interface FormField {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  currentValue: string;
}

interface StructureFields {
  name: string;
  status: 'Normal' | 'Alterado';
  notes: string;
  fields: FormField[];
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
  onShowCalculators: () => void;
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
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');
  const [formStructures, setFormStructures] = useState<StructureFields[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedIndices, setAppliedIndices] = useState<number[]>([]);

  // Parser avançado de máscara HTML para formulário com múltiplos inputs por placeholders
  const parseTemplateToFormFields = (html: string, area: string): StructureFields[] => {
    const parsedStructures: StructureFields[] = [];
    const blocks = html.split(/<\/p>|<\/li>|<br\s*\/?>/i);
    
    // Lista auxiliar para fallback
    const extractDefaultStructuresForArea = (a: string): string[] => {
      if (a === 'ginecologia') {
        return ['Útero', 'Endométrio', 'Ovário Direito', 'Ovário Esquerdo', 'Fundo de Saco'];
      } else if (a === 'medicina-fetal') {
        return ['Batimentos Cardíacos', 'Líquido Amniótico', 'Placenta', 'DBS/Biometria', 'Movimentos Fetais'];
      } else if (a === 'pequenas-partes') {
        return ['Glândula Tireoide', 'Lóbulo Direito', 'Lóbulo Esquerdo', 'Ístmo', 'Linfonodos Cervicais'];
      } else if (a === 'vascular') {
        return ['Carótida Comum Dir', 'Carótida Interna Dir', 'Carótida Comum Esq', 'Carótida Interna Esq', 'Fluxo Diastólico'];
      } else {
        return ['Fígado', 'Vesícula Biliar', 'Vias Biliares', 'Pâncreas', 'Baço', 'Rim Direito', 'Rim Esquerdo', 'Bexiga'];
      }
    };

    blocks.forEach((block, blockIdx) => {
      const cleanBlock = block.trim();
      if (!cleanBlock) return;
      
      const strongMatch = cleanBlock.match(/<(strong|b)>(.*?)<\/\1>/i);
      if (!strongMatch) return;
      
      const name = strongMatch[2].replace(/[:：]/g, '').trim();
      
      if (name.length < 2 || name.length > 35 || /ANÁLISE|TÉCNICA|CONCLUSÃO|CLASSIFICAÇÕES|RECOMENDAÇÕES/i.test(name)) {
        return;
      }
      
      const remainingText = cleanBlock.replace(/<[^>]*>/g, '').replace(name, '').trim();
      const placeholderRegex = /(\(\.\.\.\)|\[\.\.\.\]|___|\{\{.*?\}\})/g;
      const placeholders = remainingText.match(placeholderRegex) || [];
      const fields: FormField[] = [];
      
      const isTripleDimension = remainingText.includes('(...) x (...) x (...)') || 
                                remainingText.includes('___ x ___ x ___');
      
      if (isTripleDimension) {
        fields.push({
          id: `field_${blockIdx}_dim1`,
          label: 'Comprimento (mm)',
          placeholder: 'Ex: 110',
          defaultValue: '',
          currentValue: ''
        });
        fields.push({
          id: `field_${blockIdx}_dim2`,
          label: 'Largura (mm)',
          placeholder: 'Ex: 45',
          defaultValue: '',
          currentValue: ''
        });
        fields.push({
          id: `field_${blockIdx}_dim3`,
          label: 'Espessura (mm)',
          placeholder: 'Ex: 40',
          defaultValue: '',
          currentValue: ''
        });
      } else {
        placeholders.forEach((ph, phIdx) => {
          const phPos = remainingText.indexOf(ph);
          if (phPos !== -1) {
            const prevSlice = remainingText.substring(Math.max(0, phPos - 35), phPos).trim();
            let label = prevSlice
              .replace(/[,;.:(]/g, '')
              .replace(/medindo|de|com|médio|aproximadamente/gi, '')
              .trim();
            
            const labelWords = label.split(/\s+/);
            if (labelWords.length > 3) {
              label = labelWords.slice(-3).join(' ');
            }
            
            label = label.charAt(0).toUpperCase() + label.slice(1);
            
            if (!label || label.length < 3) {
              label = `Medida ${phIdx + 1}`;
            }
            
            fields.push({
              id: `field_${blockIdx}_${phIdx}`,
              label: label,
              placeholder: 'Ex: 15',
              defaultValue: '',
              currentValue: ''
            });
          }
        });
      }
      
      if (!parsedStructures.some(s => s.name === name)) {
        if (fields.length === 0) {
          fields.push({
            id: `field_${blockIdx}_desc`,
            label: 'Descrição / Achados',
            placeholder: 'Ex: Aspecto habitual',
            defaultValue: '',
            currentValue: ''
          });
        }
        parsedStructures.push({
          name,
          status: 'Normal',
          notes: '',
          fields
        });
      }
    });

    if (parsedStructures.length === 0) {
      const fallbacks = extractDefaultStructuresForArea(area);
      fallbacks.forEach((name, idx) => {
        const fields: FormField[] = [];
        if (name.includes('Rim') || name === 'Útero' || name === 'Glândula Tireoide' || name === 'Baço' || name === 'Fígado') {
          fields.push({ id: `fb_${idx}_dim1`, label: 'Comprimento (mm)', placeholder: 'Ex: 110', defaultValue: '', currentValue: '' });
          fields.push({ id: `fb_${idx}_dim2`, label: 'Largura (mm)', placeholder: 'Ex: 45', defaultValue: '', currentValue: '' });
          fields.push({ id: `fb_${idx}_dim3`, label: 'Espessura (mm)', placeholder: 'Ex: 40', defaultValue: '', currentValue: '' });
        } else {
          fields.push({ id: `fb_${idx}_med1`, label: 'Diâmetro/Medida (mm)', placeholder: 'Ex: 15', defaultValue: '', currentValue: '' });
        }
        parsedStructures.push({
          name,
          status: 'Normal',
          notes: '',
          fields
        });
      });
    }
    
    return parsedStructures;
  };

  useEffect(() => {
    if (template) {
      const parsed = parseTemplateToFormFields(template.analysisTemplate || '', template.area || exam.area);
      setFormStructures(parsed);
    }
  }, [template]);

  const { settings, showToast } = useApp();
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [voiceVolume, setVoiceVolume] = useState(0);

  // Sugestões inteligentes removidas para interface limpa

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isGenerating]);

  // Voice Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        
        if (event.results[0].isFinal) {
          onChangePrompt(prompt ? `${prompt} ${transcript}` : transcript);
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          showToast('Erro na captura de voz', 'error');
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, [showToast, prompt, onChangePrompt]);

  // Simulate volume for animation
  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => {
        setVoiceVolume(Math.random() * 100);
      }, 100);
    } else {
      setVoiceVolume(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      onChangePrompt('');
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // Auto-submit de resultados das Calculadoras
  useEffect(() => {
    if (prompt && prompt.startsWith('[RESULTADO TÉCNICO:')) {
      handleSend(prompt);
    }
  }, [prompt]);

  // Parser para converter resultados brutos de calculadora em dados estruturados
  const parseCalculatorMessage = (content: string) => {
    if (!content.startsWith('[RESULTADO TÉCNICO:')) return null;
    
    const titleMatch = content.match(/\[RESULTADO TÉCNICO:\s*(.*?)\]/);
    const title = titleMatch ? titleMatch[1] : 'Calculadora';
    
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
    
    return { title, conclusion, metrics };
  };

  // Parser para converter dados do formulário rápido em itens do chat
  const parseFormMessage = (content: string) => {
    if (!content.startsWith('[DADOS DE FORMULÁRIO COMPILADOS:')) return null;
    
    const titleMatch = content.match(/\[DADOS DE FORMULÁRIO COMPILADOS:\s*(.*?)\]/);
    const title = titleMatch ? titleMatch[1] : 'Formulário';
    
    const lines = content.split('\n');
    const items: Array<{ structure: string; status: 'Normal' | 'Alterado'; details: string }> = [];
    
    lines.forEach(line => {
      if (line.startsWith('- ')) {
        const text = line.substring(2);
        const parts = text.split(': ');
        if (parts.length >= 2) {
          const structure = parts[0].trim();
          const rest = parts.slice(1).join(': ').trim();
          const isAlterado = rest.toLowerCase().includes('alterado');
          const details = rest.replace(/alterado/i, '').replace(/normal/i, '').replace(/^(\s*-\s*|\s*\(\s*\)\s*)/, '').trim();
          items.push({
            structure,
            status: isAlterado ? 'Alterado' : 'Normal',
            details
          });
        }
      }
    });
    
    return { title, items };
  };

  // Parser helper para separar a conversa amigável da proposta de alteração HTML
  const parseMessageContent = (content: string) => {
    let conversation = content;
    let proposal = '';

    if (content.includes('=== PROPOSTA ===')) {
      const parts = content.split('=== PROPOSTA ===');
      conversation = parts[0].replace('=== CONVERSA ===', '').trim();
      let rawProposal = parts[1].trim();
      // Limpa delimitadores de código markdown residual (como ```html ... ```)
      proposal = rawProposal
        .replace(/^```html\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    } else if (content.includes('=== CONVERSA ===')) {
      conversation = content.replace('=== CONVERSA ===', '').trim();
    }

    // Strip scratchpad case-insensitively from both conversation and proposal
    conversation = stripScratchpad(conversation);
    proposal = stripScratchpad(proposal);

    return { conversation, proposal };
  };

  const renderInlineFormat = (text: string) => {
    // Highlight bold text **bold** and metrics like "X,X mm" or "X,XX cm" or "X,XX cm³" or "X,XX mL" or "X,XX g" or "X,XX cc"
    const parts = text.split(/(\*\*.*?\*\*|\d+(?:,\d+)?\s*(?:mm|cm³|cm|g|ml|cc|mL))/gi);
    
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-extrabold text-slate-900 bg-brand-50/60 px-1 py-0.5 rounded border border-brand-100/30">
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
      return <p className="text-xs font-bold leading-relaxed">{text}</p>;
    }

    // Split text into paragraphs
    const paragraphs = text.split('\n\n');

    return (
      <div className="space-y-3">
        {paragraphs.map((para, pIdx) => {
          // If the paragraph is a list of items starting with • or - or *
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
                    <li key={lIdx} className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold leading-relaxed">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0 shadow-sm shadow-brand-500/30" />
                      <span className="flex-1">{renderInlineFormat(cleanLine)}</span>
                    </li>
                  );
                })}
              </ul>
            );
          }

          // Regular paragraph
          return (
            <p key={pIdx} className="text-xs text-slate-700 font-semibold leading-relaxed">
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
    if (!settings.geminiApiKey) {
      showToast('Configure a API do Gemini', 'error');
      return;
    }

    onChangePrompt('');
    const newHistory = [...chatHistory, { role: 'user' as const, content: messageToSend }];
    onChatUpdate(newHistory);
    setIsGenerating(true);

    // Adiciona o balão temporário do assistente no histórico
    const historyWithAssistant = [...newHistory, { role: 'assistant' as const, content: 'Pensando e analisando laudo...' }];
    onChatUpdate(historyWithAssistant);

    try {
      // Carrega os últimos laudos finalizados do mesmo modelo para alinhar estilo
      const { getRecentFinalizedReports } = await import('../../store/db');
      const previousExams = settings.aiTrainingEnabled 
        ? await getRecentFinalizedReports(template?.id || '', settings.aiTrainingContextSize || 3)
        : [];

      let currentResponse = '';

      const finalHtml = await generateReportStream({
        instruction: messageToSend,
        currentReport: reportContent,
        patient,
        exam: {
          examType: exam.examType,
          area: exam.area,
          clinicalIndication: exam.clinicalIndication,
          requestingPhysician: exam.requestingPhysician
        },
        settings,
        previousExams
      }, (chunk) => {
        currentResponse = chunk;
        onChatUpdate([...newHistory, { role: 'assistant', content: currentResponse }]);
      });

      onChatUpdate([...newHistory, { role: 'assistant', content: finalHtml }]);

      // AUTO-APPLY: Se o copiloto gerou uma proposta, aplica ela automaticamente no editor
      const { proposal } = parseMessageContent(finalHtml);
      if (proposal) {
        onUpdate(proposal);
        const assistantMsgIndex = newHistory.length;
        setAppliedIndices(prev => [...prev, assistantMsgIndex]);
        showToast('Alterações integradas automaticamente ao laudo!', 'success');
      }
    } catch (error) {
      console.error(error);
      showToast('Erro no processamento IA', 'error');
      onChatUpdate([...newHistory, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao tentar processar sua solicitação.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompileForm = () => {
    let findingsSummary = `[DADOS DE FORMULÁRIO COMPILADOS: ${template?.name || 'Exame'}]\n\n`;
    
    let hasAlteration = false;
    formStructures.forEach(s => {
      const filledFields = s.fields
        .filter(f => f.currentValue.trim() !== '')
        .map(f => `${f.label}: ${f.currentValue.trim()}`)
        .join(', ');
      
      const fieldDesc = filledFields ? ` [Medidas: ${filledFields}]` : '';
      
      if (s.status === 'Alterado') {
        hasAlteration = true;
        let desc = `${s.name}: Alterado${fieldDesc}`;
        if (s.notes.trim()) desc += ` - ${s.notes.trim()}`;
        findingsSummary += `- ${desc}\n`;
      } else {
        let desc = `${s.name}: Normal${fieldDesc}`;
        findingsSummary += `- ${desc}\n`;
      }
    });
    
    if (!hasAlteration) {
      findingsSummary += `\nNOTA: Todas as estruturas foram marcadas como normais.`;
    }
    
    setActiveTab('chat');
    handleSend(findingsSummary);
  };

  return (
    <div className={classNames(
      "flex flex-col h-full bg-slate-50 relative overflow-hidden",
      isDocked ? "shadow-none" : "rounded-none md:rounded-b-[2.5rem]"
    )}>
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-100 bg-white p-1.5 shrink-0 select-none z-10 shadow-sm">
        <button
          onClick={() => setActiveTab('chat')}
          className={classNames(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === 'chat'
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <Sparkles size={14} className={classNames(activeTab === 'chat' && "animate-pulse")} />
          Chat Laud.IA
        </button>
        <button
          onClick={() => setActiveTab('form')}
          className={classNames(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === 'form'
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <ClipboardList size={14} />
          Formulário Rápido
        </button>
      </div>

      {activeTab === 'chat' && (
        <>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth bg-gradient-to-b from-white/40 to-slate-50/60 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {chatHistory.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col items-center justify-center space-y-8 py-12"
            >
               <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center mx-auto shadow-2xl shadow-brand-500/25 relative border border-white/20">
                     <Bot size={40} />
                     <motion.div 
                        animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute inset-0 bg-brand-400 rounded-[2.5rem]" 
                     />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest">Inteligência Laud.IA</h4>
                    <p className="text-[10px] text-slate-400 max-w-[240px] mx-auto leading-relaxed font-bold uppercase tracking-tight">
                      Assistente cognitivo para refino diagnóstico e automação de laudos.
                    </p>
                  </div>
               </div>

               <div className="w-full max-w-[320px] space-y-3 px-4">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center mb-1">
                   Sugestões de Comandos Clínicos
                 </span>
                 <div className="grid grid-cols-2 gap-2">
                   {[
                     { label: 'Cisto Renal', text: 'Adicionar cisto renal simples de 15 mm no rim direito.' },
                     { label: 'Histerectomia', text: 'Alterar o status do útero para ausente por cirurgia prévia.' },
                     { label: 'Colelitíase', text: 'Descrever vesícula biliar contendo cálculo móvel de 12 mm, sem inflamação.' },
                     { label: 'Refino de Estilo', text: 'Refinar o tom deste laudo inteiro para um padrão acadêmico sênior.' },
                   ].map((sug, i) => (
                     <button
                       key={i}
                       onClick={() => {
                         onChangePrompt(sug.text);
                         handleSend(sug.text);
                       }}
                       className="p-3 bg-white hover:bg-brand-50 border border-slate-100 hover:border-brand-200 rounded-xl text-left transition-all active:scale-95 group shadow-sm flex flex-col justify-between min-h-[72px]"
                     >
                       <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight group-hover:text-brand-700 transition-colors">
                         {sug.label}
                       </span>
                       <span className="text-[8px] text-slate-400 font-bold leading-normal mt-1 line-clamp-2">
                         {sug.text}
                       </span>
                     </button>
                   ))}
                 </div>
               </div>
            </motion.div>
          ) : (
            chatHistory.map((msg, idx) => {
              const isUser = msg.role === 'user';
              
              // Se for mensagem do usuário contendo resultado de calculadora, renderiza como card tático
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
                        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl rounded-tr-none p-5 shadow-lg space-y-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
                          <div className="flex items-center gap-2.5 relative z-10">
                            <div className="w-7 h-7 rounded-lg bg-brand-500/25 border border-brand-500/35 flex items-center justify-center shadow-inner">
                              <Calculator size={14} className="text-brand-400" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider block text-brand-400">Métricas Coletadas</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block">{calcData.title}</span>
                            </div>
                          </div>
                          
                          {calcData.conclusion && (
                            <div className="p-3 bg-white/5 border border-white/10 rounded-xl relative z-10">
                              <p className="text-[11px] font-bold text-slate-200 leading-relaxed">
                                {calcData.conclusion}
                              </p>
                            </div>
                          )}

                          {calcData.metrics.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 relative z-10">
                              {calcData.metrics.map((m, i) => (
                                <div key={i} className="p-2 bg-white/5 border border-white/10 rounded-lg flex flex-col shadow-inner">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight">{m.key}</span>
                                  <span className="text-[10px] font-bold text-white mt-0.5">{m.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                }
              }

              // Se for mensagem de formulário compilado, renderiza como card de formulário premium
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
                        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl rounded-tr-none p-5 shadow-lg space-y-4 relative overflow-hidden">
                          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
                          <div className="flex items-center gap-2.5 relative z-10">
                            <div className="w-7 h-7 rounded-lg bg-brand-500/25 border border-brand-500/35 flex items-center justify-center shadow-inner">
                              <ClipboardList size={14} className="text-brand-400" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider block text-brand-400">Achados do Formulário</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block">{formData.title}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2.5 relative z-10 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                            {formData.items.map((item, i) => (
                              <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-1 hover:bg-white/10 transition-all">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-100">{item.structure}</span>
                                  <span className={classNames(
                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                                    item.status === 'Alterado'
                                      ? "bg-red-500/25 text-red-400 border border-red-500/30"
                                      : "bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                                  )}>
                                    {item.status}
                                  </span>
                                </div>
                                {item.details && (
                                  <span className="text-[9px] font-medium text-slate-300 italic pt-0.5 border-t border-white/5 mt-0.5">
                                    {item.details}
                                  </span>
                                )}
                              </div>
                            ))}
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
                    isUser ? "bg-slate-900 text-white border-slate-800 shadow-slate-900/10" : "bg-white border-slate-100 text-brand-600 shadow-sm"
                  )}>
                    {isUser ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  
                  <div className="flex flex-col gap-2 max-w-[82%]">
                    {/* Balão de Conversa Premium */}
                    <div className={classNames(
                      "p-4 rounded-2xl text-xs leading-relaxed shadow-sm border transition-all hover:shadow-md",
                      isUser 
                        ? "bg-gradient-to-br from-slate-800 to-slate-950 text-slate-100 border-slate-900 rounded-tr-none shadow-md shadow-slate-950/10" 
                        : "bg-white border-slate-100 text-slate-850 rounded-tl-none shadow-slate-500/[0.02]"
                    )}>
                      {renderRichClinicalContent(conversation, isUser)}
                    </div>

                    {/* Proposta de laudo interativa e elegante (Apenas para respostas do Assistente com proposta gerada) */}
                    {!isUser && proposal && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-br from-brand-50/50 to-brand-100/20 border border-brand-100/50 rounded-2xl p-4 flex flex-col gap-3 shadow-sm relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
                        <div className="flex items-center justify-between relative z-10">
                          <span className="text-[9px] font-black text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={11} className="text-brand-500 animate-pulse" />
                            Alteração Proposta da Laud.IA
                          </span>
                          <span className={classNames(
                            "text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider border transition-all duration-300",
                            appliedIndices.includes(idx)
                              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-800"
                              : "bg-brand-500/20 border-brand-500/30 text-brand-800"
                          )}>
                            {appliedIndices.includes(idx) ? "Aplicado Automaticamente" : "Revisão Disponível"}
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed relative z-10">
                          {appliedIndices.includes(idx)
                            ? "Estas alterações já foram integradas ao laudo. Você pode reaplicar se tiver feito edições adicionais no chat."
                            : "A IA estruturou e refinou as novas informações diagnósticas. Clique no botão abaixo para consolidar essas alterações no editor de laudo principal."
                          }
                        </p>

                        <button
                          disabled={isGenerating}
                          onClick={() => {
                            if (isGenerating) return;
                            onUpdate(proposal);
                            if (!appliedIndices.includes(idx)) {
                              setAppliedIndices(prev => [...prev, idx]);
                            }
                            showToast('Alterações do Copiloto consolidadas no laudo!', 'success');
                          }}
                          className={classNames(
                            "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 group relative z-10",
                            isGenerating
                              ? "bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed shadow-none active:scale-100"
                              : "active:scale-95",
                            !isGenerating && appliedIndices.includes(idx)
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                              : !isGenerating
                                ? "bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white shadow-brand-500/25"
                                : ""
                          )}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 size={13} className="animate-spin text-slate-400" />
                              Processando Alterações...
                            </>
                          ) : appliedIndices.includes(idx) ? (
                            <>
                              <CheckCircle2 size={13} className="text-white" />
                              Reaplicar Alterações
                            </>
                          ) : (
                            <>
                              <Zap size={13} className="fill-white group-hover:scale-115 transition-transform" />
                              Aplicar Alterações ao Laudo
                            </>
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
        
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-sm shrink-0">
              <Loader2 size={18} className="animate-spin text-brand-500" />
            </div>
            <div className="bg-brand-50/50 text-brand-700 px-5 py-3.5 rounded-2xl rounded-tl-none text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border border-brand-100 shadow-inner">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [1, 2, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="w-0.5 h-3 bg-brand-500 rounded-full"
                  />
                ))}
              </div>
              IA Processando Contexto...
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="p-6 bg-white border-t border-slate-100 space-y-4 shadow-[0_-15px_40px_rgba(0,0,0,0.03)] shrink-0 relative">
        <AnimatePresence>
          {isListening && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col items-center gap-4 py-2"
            >
               <div className="flex items-center gap-1.5 h-12 justify-center">
                  {[...Array(16)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      animate={{ 
                        height: [12, Math.random() * 40 + 10, 12],
                      }}
                      transition={{ 
                        duration: 0.35, 
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.05
                      }}
                      className="w-1.5 bg-brand-500 rounded-full"
                    />
                  ))}
               </div>
               <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest animate-pulse">Escutando Ditado Clínico...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Action Pills removidos para interface limpa */}

        <div className="flex items-end gap-3">
          <button 
            onClick={toggleListening}
            className={classNames(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0 border-2 relative overflow-hidden",
              isListening 
                ? "bg-red-500 text-white border-red-400 shadow-xl shadow-red-500/25" 
                : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-100 active:scale-95"
            )}
          >
            {isListening ? (
              <>
                <span className="absolute inset-0 rounded-2xl bg-red-400/30 animate-ping" />
                <MicOff size={24} className="relative z-10" />
              </>
            ) : (
              <Mic size={24} />
            )}
          </button>

          <div className="flex-1 relative group">
            <textarea
              value={prompt}
              onChange={(e) => onChangePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Digite um comando (ex: cisto de 15 mm no rim direito) ou clique no microfone para ditar..."
              className="w-full p-4 pr-14 bg-slate-50 border border-slate-100 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:bg-white rounded-[1.8rem] outline-none transition-all text-xs font-bold leading-relaxed resize-none max-h-40 min-h-[56px] shadow-inner text-slate-800"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!prompt.trim() || isGenerating}
              className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-20 disabled:scale-100 transition-all shadow-lg shadow-brand-600/10 active:scale-95"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
           <div className="flex items-center gap-5">
              <button 
                onClick={onShowCalculators}
                className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-colors group"
              >
                <Calculator size={14} className="group-hover:rotate-12 transition-transform" /> 
                Calculadoras
              </button>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Command size={14} /> 
                <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-500">Enter</span>
              </div>
           </div>
           <div className="flex items-center gap-2 px-2.5 py-1.5 bg-brand-50 rounded-xl border border-brand-100/50">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-[9px] font-black text-brand-700 uppercase tracking-wider">Laud.IA Core v8.0</span>
           </div>
        </div>
      </div>
      
      </>
      )}

      {/* Formulário Clínico Rápido */}
      {activeTab === 'form' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white animate-fade-in">
          <div className="flex-grow overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* Search Filter & Batch Normal Actions Bar */}
            <div className="flex gap-2.5 items-center mb-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
              <div className="relative flex-1 group">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar estrutura (ex: Fígado)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200/80 focus:border-brand-500 rounded-xl text-[10px] font-bold text-slate-700 outline-none transition-all shadow-inner"
                />
              </div>
              <button
                onClick={() => {
                  setFormStructures(prev => prev.map(s => ({ ...s, status: 'Normal' })));
                  showToast('Todas as estruturas marcadas como normais!', 'success');
                }}
                className="px-3 h-8.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/60 rounded-xl text-[9px] font-black text-emerald-700 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0"
              >
                <CheckCircle2 size={11} className="text-emerald-600" />
                Tudo Normal
              </button>
            </div>

            {formStructures
              .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((structure, idx) => {
                const isAlterado = structure.status === 'Alterado';
                return (
                  <div 
                    key={idx} 
                    className={classNames(
                      "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                      isAlterado
                        ? "border-red-500/20 bg-red-500/[0.01] shadow-sm shadow-red-500/5"
                        : "border-slate-100/80 bg-slate-50/10 hover:border-slate-200 hover:bg-white hover:shadow-md hover:shadow-slate-500/[0.02]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={classNames(
                        "text-[11px] font-extrabold tracking-tight",
                        isAlterado ? "text-red-700" : "text-slate-800"
                      )}>{structure.name}</span>
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                          onClick={() => setFormStructures(prev => prev.map(s => 
                            s.name === structure.name ? { ...s, status: 'Normal' } : s
                          ))}
                          className={classNames(
                            "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                            !isAlterado
                              ? "bg-white text-emerald-600 shadow-sm border border-emerald-500/10"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          Normal
                        </button>
                        <button
                          onClick={() => setFormStructures(prev => prev.map(s => 
                            s.name === structure.name ? { ...s, status: 'Alterado' } : s
                          ))}
                          className={classNames(
                            "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                            isAlterado
                              ? "bg-slate-900 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          Alterado
                        </button>
                      </div>
                    </div>

                    {structure.fields.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-2 bg-white/40 p-3 rounded-xl border border-slate-100/40">
                        {structure.fields.map(field => (
                          <div key={field.id} className="flex flex-col">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{field.label}</label>
                            <input
                              type="text"
                              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand-500 text-[11px] font-bold text-slate-700 shadow-inner"
                              placeholder={field.placeholder}
                              value={field.currentValue}
                              onChange={(e) => {
                                setFormStructures(prev => prev.map(s => {
                                  if (s.name === structure.name) {
                                    return {
                                      ...s,
                                      fields: s.fields.map(f => f.id === field.id ? { ...f, currentValue: e.target.value } : f)
                                    };
                                  }
                                  return s;
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {isAlterado && (
                      <div className="mt-3 animate-in slide-in-from-top-1 duration-200">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Detalhes da Alteração</label>
                        <textarea
                          className="w-full p-3 bg-red-500/[0.02] border border-red-500/10 focus:border-red-500/30 focus:ring-1 focus:ring-red-500/10 rounded-xl outline-none text-[11px] font-bold text-slate-700 shadow-inner resize-none h-16"
                          placeholder={`Descreva o achado patológico de ${structure.name}...`}
                          value={structure.notes}
                          onChange={(e) => {
                            setFormStructures(prev => prev.map(s => {
                              if (s.name === structure.name) {
                                return { ...s, notes: e.target.value };
                              }
                              return s;
                            }));
                          }}
                        />
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          <div className="p-5 bg-slate-50 border-t border-slate-100 shrink-0">
            <button
              onClick={handleCompileForm}
              className="w-full py-4 rounded-[1.8rem] bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
            >
              <Sparkles size={16} className="text-brand-400 fill-brand-400/25 animate-pulse" />
              Compilar com Laud.IA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Loader2, Sparkles, Bot, User, Mic, MicOff, Calculator, 
  Lightbulb, Info, CheckCircle2, RotateCcw, AlertCircle, Volume2,
  Waves, Zap, Command, ChevronRight, FileText, Search, ShieldCheck, Languages, Eye
} from 'lucide-react';
import { useApp } from '../../store/app';
import { ExamRequest, Patient, ReportTemplate } from '../../types';
import { generateReportStream } from '../ai/gemini';
import { classNames } from '../../utils/format';
import { CalculatorModal } from '../calculators/CalculatorModal';
import { getRecentFinalizedReports } from '../../store/db';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { settings, showToast } = useApp();
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [voiceVolume, setVoiceVolume] = useState(0);

  // Sugestões inteligentes baseadas na área
  const hints = {
    'abdomen': ['Fígado de dimensões normais', 'Vesícula biliar normodistendida', 'Rins sem hidronefrose'],
    'obstetrico': ['BCF presente e rítmico', 'Placenta normoinserida', 'ILA normal'],
    'mamas': ['BI-RADS 1 - Ausência de achados', 'Nódulo sólido QSE', 'Cistos simples esparsos'],
    'tireoide': ['Volume normal', 'Nódulo TI-RADS 3', 'Vascularização preservada']
  }[exam.area.toLowerCase()] || ['Refinar conclusão', 'Corrigir termos', 'Nota clínica'];

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

    try {
      const previousExams = settings.aiTrainingEnabled 
        ? await getRecentFinalizedReports(template?.id || '', settings.aiTrainingContextSize || 3)
        : [];

      const finalHtml = await generateReportStream({
        instruction: messageToSend,
        currentReport: reportContent,
        patient,
        exam: {
          examType: exam.examType,
          area: exam.area,
          clinicalIndication: exam.clinicalIndication
        },
        settings,
        previousExams
      }, (chunk) => {
        onUpdate(chunk);
      });

      onUpdate(finalHtml);
      onChatUpdate([...newHistory, { role: 'assistant', content: 'O laudo foi atualizado com base no seu comando.' }]);
    } catch (error) {
      console.error(error);
      showToast('Erro no processamento IA', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const powerActions = [
    { 
      id: 'formalize', 
      label: 'Formalizar', 
      icon: ShieldCheck, 
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      prompt: "Torne a linguagem deste laudo extremamente formal e técnica, seguindo padrões acadêmicos de radiologia e CBR."
    },
    { 
      id: 'simplify', 
      label: 'Simplificar', 
      icon: Lightbulb, 
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      prompt: "Reescreva o laudo de forma mais clara e didática para o paciente, mantendo todos os termos técnicos necessários na descrição mas suavizando a linguagem."
    },
    { 
      id: 'verify', 
      label: 'Verificar', 
      icon: Search, 
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      prompt: "Analise o laudo atual em busca de inconsistências técnicas, erros de lateralidade ou contradições entre descrição e conclusão. Aplique as correções necessárias."
    }
  ];

  return (
    <div className={classNames(
      "flex flex-col h-full bg-white relative overflow-hidden",
      isDocked ? "shadow-none" : "rounded-b-[2.5rem]"
    )}>
      {/* Power Toolbar */}
      <div className="px-4 py-3 bg-ink-50 border-b border-ink-100 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest mr-1 shrink-0">Power Actions:</span>
        {powerActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleSend(action.prompt)}
            disabled={isGenerating}
            className={classNames(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 shrink-0",
              action.color,
              isGenerating ? "opacity-50 grayscale cursor-not-allowed" : "hover:shadow-md hover:-translate-y-0.5"
            )}
          >
            <action.icon size={13} />
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth bg-white custom-scrollbar">
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
                  <div className="w-20 h-20 rounded-[2.5rem] bg-brand-600 text-white flex items-center justify-center mx-auto shadow-2xl relative">
                     <Bot size={40} />
                     <motion.div 
                        animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute inset-0 bg-brand-400 rounded-[2.5rem]" 
                     />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-sm text-ink-900 uppercase tracking-widest">Inteligência Laud.IA</h4>
                    <p className="text-[10px] text-ink-500 max-w-[240px] mx-auto leading-relaxed font-bold uppercase tracking-tight">
                      Assistente cognitivo para refino diagnóstico e automação de laudos.
                    </p>
                  </div>
               </div>

               <div className="w-full space-y-4 px-4">
                  <div className="flex items-center gap-2 mb-1">
                     <Zap size={14} className="text-amber-500 fill-amber-500" />
                     <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Achados Rápidos (Atalhos)</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                     {hints.map((hint, i) => (
                       <motion.button
                         key={i}
                         initial={{ opacity: 0, x: -10 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: i * 0.1 }}
                         onClick={() => handleSend(hint)}
                         className="flex items-center justify-between p-4 rounded-2xl bg-white border border-ink-100 hover:border-brand-500 hover:bg-brand-50/50 transition-all text-left group shadow-sm"
                       >
                         <span className="text-[11px] font-bold text-ink-700 group-hover:text-brand-700 truncate pr-4">{hint}</span>
                         <div className="w-6 h-6 rounded-lg bg-ink-50 flex items-center justify-center text-ink-300 group-hover:bg-brand-500 group-hover:text-white transition-all">
                           <ChevronRight size={14} />
                         </div>
                       </motion.button>
                     ))}
                  </div>
               </div>
            </motion.div>
          ) : (
            chatHistory.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={classNames(
                  "flex gap-3",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={classNames(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border-2",
                  msg.role === 'user' ? "bg-brand-600 text-white border-brand-500" : "bg-white border-ink-100 text-brand-600"
                )}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={classNames(
                  "max-w-[85%] p-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm",
                  msg.role === 'user' 
                    ? "bg-brand-600 text-white rounded-tr-none shadow-brand-100" 
                    : "bg-white border-2 border-ink-50 text-ink-800 rounded-tl-none"
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border-2 border-brand-100">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <div className="bg-brand-50/50 text-brand-700 px-5 py-3 rounded-2xl rounded-tl-none text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border-2 border-brand-100 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [1, 1.8, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="w-0.5 h-4 bg-brand-500 rounded-full"
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
      <div className="p-6 bg-white border-t border-ink-100 space-y-4 shadow-[0_-15px_40px_rgba(0,0,0,0.03)] shrink-0 relative">
        
        <AnimatePresence>
          {isListening && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col items-center gap-4 py-2"
            >
               <div className="flex items-center gap-1.5 h-12">
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

        <div className="flex items-end gap-3">
          <button 
            onClick={toggleListening}
            className={classNames(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0 border-2",
              isListening 
                ? "bg-red-500 text-white border-red-400 shadow-xl shadow-red-200" 
                : "bg-ink-50 text-ink-400 border-ink-100 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200"
            )}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
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
              placeholder="Descreva o achado técnico..."
              className="w-full p-5 pr-14 bg-ink-50 border-2 border-ink-100 rounded-[2rem] focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white outline-none transition-all text-sm font-bold resize-none max-h-40 min-h-[60px] leading-relaxed shadow-inner"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!prompt.trim() || isGenerating}
              className="absolute right-3.5 bottom-3.5 w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-20 transition-all shadow-lg shadow-brand-100 active:scale-95"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
           <div className="flex items-center gap-5">
              <button 
                onClick={onShowCalculators}
                className="flex items-center gap-2 text-[10px] font-black text-ink-400 hover:text-brand-600 uppercase tracking-widest transition-colors group"
              >
                <Calculator size={14} className="group-hover:rotate-12 transition-transform" /> 
                Calculadoras
              </button>
              <div className="h-3 w-px bg-ink-200" />
              <div className="flex items-center gap-2 text-[10px] font-black text-ink-300 uppercase tracking-widest">
                <Command size={14} /> 
                <span className="bg-ink-100 px-2 py-0.5 rounded-lg text-[9px]">Enter</span>
              </div>
           </div>
           <div className="flex items-center gap-2.5 px-3 py-1.5 bg-brand-50 rounded-xl border border-brand-100">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-[10px] font-black text-brand-700 uppercase tracking-tighter">AI Core v7.0</span>
           </div>
        </div>
      </div>
    </div>
  );
}

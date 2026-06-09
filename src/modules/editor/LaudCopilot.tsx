import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send, Loader2, Sparkles, Bot, User, Mic, MicOff, Calculator,
  Lightbulb, Zap, Command, ChevronRight, ClipboardList, RotateCcw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { useApp } from '../../store/app';
import { updateItem, saveVersionSnapshot } from '../../store/db';
import { ExamRequest, Patient, ReportTemplate } from '../../types';
import { generateReportStream, stripScratchpad } from '../ai/engine';
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
  const { settings, updateSettings, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');
  const [formText, setFormText] = useState(exam.customFormValue ?? template?.customForm ?? '');
  const [appliedIndices, setAppliedIndices] = useState<number[]>([]);
  
  // Refino Auto: agora controlado globalmente pelas configurações
  const autoRefineEnabled = settings.aiAutoRefineEnabled ?? false;
  const handleToggleAutoRefine = (val: boolean) => {
    updateSettings({ ...settings, aiAutoRefineEnabled: val });
  };

  // Referências para controle de sincronização e digitação no formulário
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

  useEffect(() => {
    return () => {
      // NÃO cancelar a requisição ativa ao desmontar o componente
      // Isso permite que o Copiloto continue gerando o laudo em background mesmo se minimizado
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
    } else {
      if (!isDirtyRef.current && !isFormFocusedRef.current) {
        const val = exam.customFormValue ?? template?.customForm ?? '';
        setFormText(val);
        latestValueRef.current = val;
      }
    }
  }, [exam.id, exam.customFormValue, template?.customForm]);

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
        console.error('Erro ao salvar customFormValue:', err);
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
      await updateItem('exams', exam.id, { customFormValue: val });
      showToast('Formulário restaurado!', 'success');
    }
  };

  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const lastCallRef = useRef<number>(0);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const onChangePromptRef = useRef(onChangePrompt);
  onChangePromptRef.current = onChangePrompt;
  // Ref para evitar stale closure no useEffect de auto-submit da calculadora
  const handleSendRef = useRef<(customPrompt?: string) => Promise<void>>(async () => {});

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

  // Real voice volume analyzer using Web Audio API
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animationId: number | null = null;
    // Fix 18: cancelled flag prevents MediaStream leak if isListening toggles quickly
    let cancelled = false;

    const getVolume = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // If already cancelled while awaiting, stop the stream immediately
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          if (!analyser || cancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVoiceVolume(Math.min(100, Math.round(average * 2.5)));
          animationId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        console.warn('[Voice Analyser] Microfone não acessível ou permissão negada:', err);
        // Fallback para volume simulado caso falhe
        let mockInterval = setInterval(() => {
          if (cancelled) { clearInterval(mockInterval); return; }
          setVoiceVolume(Math.random() * 100);
        }, 100);
        return () => clearInterval(mockInterval);
      }
    };

    if (isListening) {
      getVolume();
    } else {
      setVoiceVolume(0);
    }

    return () => {
      cancelled = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
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
  // Usa handleSendRef para evitar stale closure (handleSend captura chatHistory, etc.)
  useEffect(() => {
    if (prompt && prompt.startsWith('[RESULTADO TÉCNICO:')) {
      handleSendRef.current(prompt);
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

    // Extrai a parte do conteúdo após as instruções internas da IA
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

    // Procura os marcadores de forma case-insensitive e tolerante a espaços
    const conversaRegex = /===\s*CONVERSA\s*===/i;
    const propostaRegex = /===\s*PROPOSTA\s*===/i;

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
      // ESTRATÉGIA DE FALLBACK: Se não houver marcadores explícitos
      // 1. Tentar encontrar blocos de código HTML
      const htmlBlockMatch = content.match(/```html\s*([\s\S]*?)\s*```/i) || content.match(/```\s*(<h1[\s\S]*?)\s*```/i);
      if (htmlBlockMatch) {
        proposal = htmlBlockMatch[1].trim();
        conversation = content.substring(0, htmlBlockMatch.index).trim();
      } else {
        // 2. Se não houver bloco de código, procurar primeira tag HTML útil de título ou parágrafo
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

    // Strip scratchpad: use disableHtmlExtraction=true for proposal to avoid cutting valid tags
    conversation = stripScratchpad(conversation);
    proposal = stripScratchpad(proposal, true);

    if (!conversation && !proposal && content) {
      // Fallback extremo: se os marcadores falharem ou a IA omitir tudo
      conversation = stripScratchpad(content, true) || content;
    }

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
      return <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{text}</p>;
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
    // handleSendRef.current é atualizado abaixo para que o useEffect não tenha stale closure
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
        // Durante o stream: o parseMessageContent já sabe lidar com texto parcial
        // (o marcador === CONVERSA === é removido, === PROPOSTA === ainda não apareceu)
        // → o usuário vê a frase clínica sendo digitada em tempo real, sem ruído de markup
        // Evita esvaziar o balão de chat se o chunk estiver vazio (ainda no scratchpad)
        const displayResponse = currentResponse.trim() || 'Pensando e analisando laudo...';
        onChatUpdate([...newHistory, { role: 'assistant', content: displayResponse }]);
      });

      // Garante que o estado final use o texto completo retornado (idêntico ao último chunk)
      onChatUpdate([...newHistory, { role: 'assistant', content: finalHtml }]);

      // AUTO-APPLY: Se o copiloto gerou uma proposta, aplica ela automaticamente no editor
      const { proposal } = parseMessageContent(finalHtml);
      if (proposal && proposal.trim().length > 10) {
        const cleanProposal = sanitizeHtml(proposal);
        if (cleanProposal && cleanProposal.trim().length > 10) {
          // Salva versão anterior antes de aplicar!
          await saveVersionSnapshot(exam.id, reportContent, 'copilot');
          onUpdate(cleanProposal);
          
          const assistantMsgIndex = newHistory.length;
          setAppliedIndices(prev => [...prev, assistantMsgIndex]);

          if (template && autoRefineEnabled) {
            showToast('Alterações integradas! Refinando...', 'info');
            // Adiciona balão de status no chat
            const chatWithRefining = [
              ...newHistory,
              { role: 'assistant' as const, content: finalHtml },
              { role: 'assistant' as const, content: 'Refinando e higienizando laudo para garantir padrões de máscara...' }
            ];
            onChatUpdate(chatWithRefining);

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
              // Apenas atualiza se houver conteúdo no chunk para evitar apagar o texto antigo
              if (refinedHtml.trim().length > 10) {
                onUpdate(sanitizeHtml(refinedHtml));
              }
            });

            if (finalRefined && finalRefined.trim().length > 10) {
              const cleanRefined = sanitizeHtml(finalRefined);
              if (cleanRefined && cleanRefined.trim().length > 10) {
                onUpdate(cleanRefined);
                showToast('Laudo integrado e refinado com sucesso! ✓', 'success');
              } else {
                showToast('Falha no refinamento: laudo vazio gerado.', 'error');
                onUpdate(cleanProposal); // Restaura proposta antes do refinamento
              }
            } else {
              showToast('Falha no refinamento: resposta vazia da IA.', 'error');
              onUpdate(cleanProposal); // Restaura proposta antes do refinamento
            }

            // Restaura o histórico de chat normal sem o balão temporário de refinamento
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
      if (error && (error.name === 'AbortError' || String(error).toLowerCase().includes('abort'))) {
        console.log('[LaudCopilot] Requisição cancelada pelo usuário.');
        setIsGenerating(false);
        return;
      }
      console.error('[LaudCopilot] handleSend error:', error);
      const msg = error instanceof Error ? error.message : String(error) || 'Erro desconhecido';
      // Mensagem amigável para erros comuns de API
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
      onChatUpdate([...newHistory, { role: 'assistant', content: `❌ ${friendlyMsg}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Mantém ref sempre atualizado com a versão mais recente de handleSend
  handleSendRef.current = handleSend;
  const handleCompileForm = () => {
    if (!formText.trim()) {
      showToast('Preencha o formulário antes de compilar.', 'info');
      return;
    }
    if (formSaveTimerRef.current) {
      clearTimeout(formSaveTimerRef.current);
      formSaveTimerRef.current = null;
      // Fix 9: mark as clean immediately to prevent double Firestore write
      // (handleBlurFormText would write again otherwise)
      isDirtyRef.current = false;
      updateItem('exams', exam.id, { customFormValue: formText });
    }

    // Prefix DEVE corresponder ao que parseFormMessage espera (startsWith check na linha 199)
    const templateName = template?.name || exam.examType || 'Formulário';
    const area = exam.area || template?.area || '';

    // Gera instrução contextual baseada na área para guiar a IA
    let areaInstruction = '';
    if (area === 'medicina-fetal') {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA DE INSERÇÃO — MEDICINA FETAL:
Estes são os dados biométricos, obstétricos e de vitalidade do exame coletados via formulário. Você DEVE:
1. Inserir cada dado fornecido no campo correspondente da ANÁLISE (biometria: DBP, DOF, CC, CA, CF, úmero, cerebelo, cisterna magna, ventrículos; PFE e percentil; vitalidade/BCF; Doppler: AU, ACM, RCP, DV, uterinas; placenta; líquido amniótico: MBV/ILA; colo uterino; apresentação/situação).
2. Calcular automaticamente: RCP = IP ACM / IP umbilical (se ambos fornecidos); IP médio uterinas = (D+E)/2 (se ambas fornecidas); IG atual e DPP se DUM ou datação precoce for fornecida.
3. Classificar o PFE: AIG (P10–P90), GIG (>P90), PIG (P3–P10), RCIU (<P3 ou critérios Delphi) — apenas se PFE e percentil forem fornecidos.
4. Substituir todos os placeholders (…) e [___] na ANÁLISE pelos dados reais fornecidos.
5. NÃO inventar nenhum dado não fornecido — manter (…) ou descrição qualitativa de normalidade para campos sem dados.
6. Atualizar CONCLUSÃO e RECOMENDAÇÕES conforme os achados reais inseridos.`;
    } else if (area === 'ginecologia') {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA DE INSERÇÃO — GINECOLOGIA:
Estes são os dados do exame coletados via formulário. Você DEVE:
1. Inserir cada dado fornecido no campo correspondente da ANÁLISE (útero: posição, dimensões, miométrio, endométrio; ovários: dimensões, folículos, cistos; anexos; Douglas).
2. Substituir todos os placeholders (…) e [___] pelos dados reais fornecidos.
3. Aplicar classificações obrigatórias: O-RADS para massas anexiais, MUSA para adenomiose/miomas, BI-RADS para mama (se aplicável).
4. NÃO inventar dados não fornecidos — manter descrição qualitativa de normalidade.
5. Atualizar CONCLUSÃO e RECOMENDAÇÕES conforme os achados reais.`;
    } else if (area === 'vascular') {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA DE INSERÇÃO — VASCULAR:
Estes são os dados do exame coletados via formulário. Você DEVE:
1. Inserir cada valor Doppler no campo correspondente da ANÁLISE (VPS, VDF, IR, IP, EIM das carótidas; compressibilidade venosa; calibre da aorta; etc.).
2. Substituir todos os placeholders (…) e [___] pelos dados reais fornecidos.
3. NÃO inventar dados não fornecidos.
4. Atualizar CONCLUSÃO e RECOMENDAÇÕES conforme os achados.`;
    } else {
      areaInstruction = `\n\nINSTRUÇÃO OBRIGATÓRIA DE INSERÇÃO:
Estes são os achados do exame coletados via formulário. Você DEVE:
1. Inserir cada dado/achado fornecido no campo correspondente da ANÁLISE.
2. Substituir todos os placeholders (…) e [___] pelos dados reais fornecidos.
3. NÃO inventar dados não fornecidos — manter normalidade qualitativa para campos sem dados.
4. Atualizar CONCLUSÃO e RECOMENDAÇÕES conforme os achados reais.`;
    }

    const findingsSummary = `[DADOS DE FORMULÁRIO COMPILADOS: ${templateName}]${areaInstruction}\n\nDADOS DO FORMULÁRIO:\n${formText.trim()}`;
    setActiveTab('chat');
    handleSend(findingsSummary);
  };

  return (
    <div className={classNames(
      "flex flex-col h-full min-h-0 bg-slate-50 relative overflow-hidden",
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
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-full flex flex-col items-center justify-center py-10"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-100/80 text-brand-600 flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="font-semibold text-lg text-slate-800 tracking-tight mb-2">Como posso ajudar?</h4>
                  <p className="text-xs text-slate-500 max-w-[260px] text-center mb-8">
                    Descreva alterações, solicite refinos ou clique nas sugestões abaixo.
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
                    {[
                      { label: 'Adicionar Cisto', text: 'Adicionar cisto simples de 15 mm' },
                      { label: 'Refinar Texto', text: 'Refinar o tom deste laudo' },
                      { label: 'Normalidade', text: 'Marcar todas as estruturas como normais' }
                    ].map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onChangePrompt(sug.text);
                          handleSend(sug.text);
                        }}
                        className="px-3 py-2 bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 rounded-full text-[11px] font-medium text-slate-600 transition-colors shadow-sm active:scale-95"
                      >
                        {sug.label}
                      </button>
                    ))}
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
                            <div className="bg-white border border-brand-100 rounded-2xl rounded-tr-none p-4 shadow-sm space-y-4 relative overflow-hidden">
                              <div className="flex items-center gap-2.5 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center shadow-sm">
                                  <Calculator size={16} />
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest block text-slate-400">Calculadora</span>
                                  <span className="text-[11px] text-slate-800 font-bold uppercase tracking-tight block">{calcData.title}</span>
                                </div>
                              </div>

                              {calcData.conclusion && (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl relative z-10">
                                  <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                                    {calcData.conclusion}
                                  </p>
                                </div>
                              )}

                              {calcData.metrics.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                  {calcData.metrics.map((m, i) => (
                                    <div key={i} className="p-2.5 bg-white border border-slate-100 rounded-xl flex flex-col shadow-sm">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.key}</span>
                                      <span className="text-[11px] font-bold text-slate-800 mt-1">{m.value}</span>
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
                            <div className="bg-white border border-brand-100 rounded-2xl rounded-tr-none p-4 shadow-sm space-y-4 relative overflow-hidden">
                              <div className="flex items-center gap-2.5 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-sm">
                                  <ClipboardList size={16} />
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest block text-slate-400">Achados do Formulário</span>
                                  <span className="text-[11px] text-slate-800 font-bold uppercase tracking-tight block">{formData.title}</span>
                                </div>
                              </div>

                              <div className="relative z-10 p-4 bg-slate-50 border border-slate-100 rounded-xl max-h-[220px] overflow-y-auto custom-scrollbar">
                                <p className="text-[11px] font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                  {formData.body}
                                </p>
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
                            ? "bg-brand-50 text-brand-900 border-brand-100 rounded-tr-none shadow-md shadow-brand-500/5"
                            : "bg-white border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                        )}>
                          {renderRichClinicalContent(conversation, isUser)}
                        </div>

                        {/* Proposta de laudo interativa e elegante (Apenas para respostas do Assistente com proposta gerada) */}
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
                                // Salva versão anterior antes de aplicar!
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
                                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                  : appliedIndices.includes(idx)
                                    ? "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow active:scale-95"
                              )}
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  Processando...
                                </>
                              ) : appliedIndices.includes(idx) ? (
                                <>
                                  <CheckCircle2 size={14} />
                                  Aplicado (Clique para reaplicar)
                                </>
                              ) : (
                                <>
                                  <Zap size={14} />
                                  Aplicar ao Laudo
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
          <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] shrink-0 flex flex-col gap-3">
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-2 text-brand-600"
                >
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [8, 16, 8] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1 bg-current rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold">Ouvindo...</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/10 rounded-2xl p-1.5 transition-all">
              <button
                onClick={onShowCalculators}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 transition-colors shrink-0"
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
                placeholder="Ex: cisto de 15 mm no rim direito..."
                className="flex-1 w-full bg-transparent outline-none text-sm font-medium text-slate-800 placeholder-slate-400 resize-none max-h-32 min-h-[36px] py-2 px-1"
                rows={prompt.split('\n').length > 1 ? Math.min(prompt.split('\n').length, 4) : 1}
              />
              
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={toggleListening}
                  className={classNames(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-50 text-red-600"
                      : "text-slate-400 hover:bg-slate-200/50 hover:text-slate-700"
                  )}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                
                <button
                  onClick={() => handleSend()}
                  disabled={!prompt.trim() || isGenerating}
                  className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
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
                  autoRefineEnabled ? "bg-brand-500" : "bg-slate-300"
                )}>
                  <div className={classNames(
                    "w-2.5 h-2.5 rounded-full bg-white transition-transform shadow-sm",
                    autoRefineEnabled && "translate-x-2.5"
                  )} />
                </div>
                <span className="text-[10px] text-slate-500 font-medium group-hover:text-slate-800 transition-colors">
                  Refino Automático
                </span>
              </label>
            </div>
          </div>

        </>
      )}

      {/* Formulário Clínico Rápido */}
      {activeTab === 'form' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white animate-fade-in">
          <div className="flex-1 flex flex-col p-4 space-y-3 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Anotações Livres
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onShowCalculators}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-brand-600 hover:bg-brand-50 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Calculator size={14} />
                  Calculadoras
                </button>
                {template?.customForm && (
                  <button
                    onClick={handleResetForm}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-md transition-colors"
                  >
                    <RotateCcw size={14} />
                    Restaurar
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={formText}
              onFocus={() => isFormFocusedRef.current = true}
              onBlur={(e) => handleBlurFormText(e.target.value)}
              onChange={(e) => handleFormTextChange(e.target.value)}
              placeholder="Digite de forma livre ou cole os achados para que a IA os organize e integre ao laudo..."
              className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/10 focus:bg-white rounded-xl outline-none transition-all text-sm font-mono text-slate-700 resize-none shadow-inner"
              style={{ minHeight: 0 }}
            />
          </div>

          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <button
              onClick={handleCompileForm}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
            >
              <Sparkles size={16} />
              Processar e Atualizar Laudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

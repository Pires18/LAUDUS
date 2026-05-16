import { useState, useEffect } from 'react';
import { ExamRequest } from '../../../types';
import { getAll, where } from '../../../store/db';
import { X, History, Clock, FileText, ChevronRight, FileOutput } from 'lucide-react';
import { formatDateTime } from '../../../utils/format';
import { classNames } from '../../../utils/format';

interface ExamHistoryModalProps {
  patientId: string;
  templateId: string;
  currentExamId: string;
  currentContent: string;
  onClose: () => void;
}

export function ExamHistoryModal({ patientId, templateId, currentExamId, currentContent, onClose }: ExamHistoryModalProps) {
  const [history, setHistory] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPastExam, setSelectedPastExam] = useState<ExamRequest | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const exams = await getAll<ExamRequest>(
          'exams', 
          where('patientId', '==', patientId), 
          where('templateId', '==', templateId)
        );
        // Filter out current exam and only show finalized
        const pastExams = exams
          .filter((e: ExamRequest) => e.id !== currentExamId && e.status === 'finalizado' && e.reportContent)
          .sort((a: ExamRequest, b: ExamRequest) => (b.createdAt || 0) - (a.createdAt || 0)); // Newest first
        
        setHistory(pastExams);
        if (pastExams.length > 0) {
          setSelectedPastExam(pastExams[0]);
        }
      } catch (e) {
        console.error('Error loading history:', e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [patientId, templateId, currentExamId]);

  return (
    <div className="fixed inset-0 z-[100] bg-ink-900/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-8 animate-fade-in">
      <div className="bg-ink-50 rounded-3xl w-full h-full max-w-[1400px] flex flex-col shadow-2xl overflow-hidden animate-scale-up border border-ink-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-ink-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink-900 leading-tight">Histórico Clínico e Comparador</h2>
              <p className="text-xs text-ink-500 font-medium">Analise a evolução dos laudos para a mesma área/máscara.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Timeline */}
          <div className="w-72 bg-white border-r border-ink-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-ink-100 bg-ink-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Exames Anteriores</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-ink-100 rounded-xl"></div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <FileText size={32} className="mx-auto text-ink-300 mb-3" />
                  <p className="text-sm text-ink-500 font-medium">Nenhum exame finalizado encontrado para esta máscara.</p>
                </div>
              ) : (
                history.map(exam => (
                  <button
                    key={exam.id}
                    onClick={() => setSelectedPastExam(exam)}
                    className={classNames(
                      "w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                      selectedPastExam?.id === exam.id
                        ? "bg-brand-50 border-brand-200 shadow-sm"
                        : "bg-white border-ink-100 hover:border-brand-200 hover:shadow-soft"
                    )}
                  >
                    {selectedPastExam?.id === exam.id && (
                      <div className="absolute left-0 top-0 w-1 h-full bg-brand-500" />
                    )}
                    <div className="flex items-center gap-2 mb-1 text-ink-900 font-bold">
                      <Clock size={14} className={selectedPastExam?.id === exam.id ? "text-brand-600" : "text-ink-400"} />
                      {formatDateTime(exam.createdAt).split(' - ')[0]}
                    </div>
                    <div className="text-[10px] text-ink-500 flex justify-between items-center">
                      <span>{formatDateTime(exam.createdAt).split(' - ')[1]}</span>
                      <ChevronRight size={12} className={classNames(
                        "transition-transform",
                        selectedPastExam?.id === exam.id ? "text-brand-500 translate-x-1" : "text-ink-300 opacity-0 group-hover:opacity-100"
                      )} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Comparison Area */}
          <div className="flex-1 flex overflow-hidden bg-ink-100/50">
            {selectedPastExam ? (
              <>
                {/* Left Side: Past Exam */}
                <div className="flex-1 flex flex-col border-r border-ink-200 shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10">
                  <div className="p-3 bg-white border-b border-ink-200 flex justify-between items-center shrink-0">
                    <span className="text-xs font-bold uppercase text-ink-500 tracking-wider">Laudo Anterior</span>
                    <span className="badge bg-ink-100 text-ink-600">{formatDateTime(selectedPastExam.createdAt)}</span>
                  </div>
                  <div className="flex-1 overflow-auto bg-white p-6 md:p-10">
                    <div 
                      className="prose prose-sm prose-ink max-w-none opacity-80"
                      dangerouslySetInnerHTML={{ __html: selectedPastExam.reportContent || '' }}
                    />
                  </div>
                </div>

                {/* Right Side: Current Exam */}
                <div className="flex-1 flex flex-col z-20">
                  <div className="p-3 bg-white border-b border-ink-200 flex justify-between items-center shrink-0 shadow-sm">
                    <span className="text-xs font-black uppercase text-brand-600 tracking-wider flex items-center gap-1.5">
                      <FileOutput size={14} /> Laudo Atual (Edição)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                  </div>
                  <div className="flex-1 overflow-auto bg-white p-6 md:p-10 relative">
                    <div className="absolute inset-0 bg-brand-50/20 pointer-events-none" />
                    <div 
                      className="prose prose-sm prose-ink max-w-none"
                      dangerouslySetInnerHTML={{ __html: currentContent }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ink-400">
                <p>Selecione um exame anterior para comparar.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

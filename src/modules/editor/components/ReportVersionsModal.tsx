import { useState, useMemo, useEffect } from 'react';
import { ExamRequest } from '../../../types';
import { X, Clock, FileText, SplitSquareHorizontal, CheckCircle2 } from 'lucide-react';
import { formatDateTime, classNames } from '../../../utils/format';
import { useConfirm } from '../../../hooks/useConfirm';

interface ReportVersionsModalProps {
  exam: ExamRequest;
  currentContent: string;
  onRestore: (content: string) => void;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const TRIGGER_LABELS: Record<string, { label: string; className: string }> = {
  'generation': { label: 'Geração Inicial', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  'refine':     { label: 'Refinamento',    className: 'bg-purple-50 text-purple-700 border-purple-200' },
  'copilot':    { label: 'Laud.IA Copilot', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'manual':     { label: 'Edição Manual',   className: 'bg-ink-50 text-ink-700 border-ink-200' },
  'restore':    { label: 'Antes de Restaurar', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

/** Contagem de palavras a partir do HTML — proxy simples e rápida pra saber o
 * tamanho de uma versão sem precisar de um diff completo. */
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  return text ? text.split(/\s+/).length : 0;
}

export function ReportVersionsModal({
  exam,
  currentContent,
  onRestore,
  onClose,
  showToast,
}: ReportVersionsModalProps) {
  const confirm = useConfirm();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  // Histórico de versões revertido para mostrar as mais recentes primeiro
  const versions = useMemo(() => {
    const list = exam.reportVersions || [];
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [exam.reportVersions]);

  // Fix 5: proper useEffect instead of invalid useState initializer
  useEffect(() => {
    if (versions.length > 0 && selectedIdx === null) {
      setSelectedIdx(0);
    }
  }, [versions.length, selectedIdx]);

  const selectedVersion = selectedIdx !== null ? versions[selectedIdx] : null;

  const handleRestoreClick = async () => {
    if (!selectedVersion) return;
    const ok = await confirm({
      title: 'Restaurar Versão',
      message: 'Tem certeza de que deseja restaurar esta versão do laudo? Seu conteúdo atual será arquivado.',
      confirmLabel: 'Restaurar',
      variant: 'warning',
    });
    if (ok) {
      onRestore(selectedVersion.content);
      showToast('Versão anterior restaurada com sucesso! ✓', 'success');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-ink-900/75 backdrop-blur-md flex items-center justify-center p-0 lg:p-6 animate-fade-in">
      <div className="bg-white w-full h-full lg:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-w-[1300px] max-h-[850px] border border-ink-100">
        
        {/* Header */}
        <div className="bg-ink-900 px-6 py-4 flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-700/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-4 z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner">
              <Clock size={20} className="text-teal-300" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tight leading-tight">
                Versões do Laudo
              </h2>
              <p className="text-[11px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">
                {exam.examType} · {versions.length} versão/versões salvas
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            {selectedVersion && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                title={compareMode ? 'Ver versão selecionada' : 'Comparar com o laudo atual'}
                className={classNames(
                  "flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  compareMode
                    ? "bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/25"
                    : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                )}
              >
                <SplitSquareHorizontal size={14} />
                <span>{compareMode ? 'Comparando' : 'Comparar'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar - Timeline de Versões */}
          <aside className="w-[280px] lg:w-[320px] bg-ink-50 border-r border-ink-100 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
            <span className="text-[9px] font-black text-ink-400 uppercase tracking-[0.15em] block mb-2 px-1">
              Linha do Tempo
            </span>

            {versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center">
                  <FileText size={20} className="text-ink-300" />
                </div>
                <div>
                  <p className="text-xs font-black text-ink-500 uppercase tracking-wider">
                    Sem Histórico de Versões
                  </p>
                  <p className="text-[10px] text-ink-400 font-semibold mt-1 leading-relaxed">
                    Novas versões serão criadas automaticamente ao modificar o laudo com Laud.IA.
                  </p>
                </div>
              </div>
            ) : (
              versions.map((ver, idx) => {
                const triggerStyle = TRIGGER_LABELS[ver.trigger] || TRIGGER_LABELS['manual'];
                const isSelected = selectedIdx === idx;
                // `versions` está do mais novo pro mais antigo — o vizinho em
                // idx+1 é a versão anterior no tempo, base pro delta.
                const wordCount = countWords(ver.content);
                const prevWordCount = idx + 1 < versions.length ? countWords(versions[idx + 1].content) : null;
                const delta = prevWordCount !== null ? wordCount - prevWordCount : null;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={classNames(
                      "w-full text-left p-3.5 rounded-xl border transition-all relative overflow-hidden group flex flex-col gap-1.5",
                      isSelected
                        ? "bg-white border-teal-200 shadow-md shadow-teal-500/5"
                        : "bg-white/60 border-transparent hover:bg-white hover:border-ink-200 hover:shadow-sm"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-teal-500 rounded-full" />
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className={classNames(
                        "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider",
                        triggerStyle.className
                      )}>
                        {triggerStyle.label}
                      </span>
                      {idx === 0 && (
                        <span className="text-[8px] font-black text-teal-600 bg-teal-50 px-1 rounded uppercase">
                          Recente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-ink-500">
                      <Clock size={11} className="text-ink-300" />
                      <span className="text-[10px] font-black">
                        {formatDateTime(ver.timestamp)}
                      </span>
                    </div>

                    <span className="text-[9px] text-ink-400 font-bold uppercase truncate max-w-[240px] flex items-center gap-1.5">
                      {wordCount} palavra{wordCount !== 1 ? 's' : ''}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </aside>

          {/* Content Area */}
          <main className="flex-1 flex flex-col min-h-0 bg-ink-50/30">
            {!selectedVersion ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
                <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center">
                  <FileText size={28} className="text-ink-300" />
                </div>
                <div>
                  <p className="text-xs font-black text-ink-400 uppercase tracking-widest">
                    Histórico Vazio
                  </p>
                  <p className="text-[10px] text-ink-400 font-medium mt-1 leading-relaxed">
                    Nenhum snapshot de versão prévia foi gerado para este laudo ainda.
                  </p>
                </div>
              </div>
            ) : compareMode ? (
              /* Compare Split View */
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Versão Selecionada (esquerda) */}
                <div className="flex-1 flex flex-col border-r border-ink-200 min-w-0">
                  <div className="px-5 py-3 border-b bg-white border-ink-100 flex items-center justify-between shrink-0">
                    <div>
                      <p className="text-[11px] font-black text-ink-900 uppercase tracking-tight">Versão Selecionada</p>
                      <p className="text-[9px] text-ink-400 font-medium mt-0.5">{formatDateTime(selectedVersion.timestamp)}</p>
                    </div>
                    <button
                      onClick={handleRestoreClick}
                      className="h-7 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-teal-500/10 active:scale-95"
                    >
                      <CheckCircle2 size={11} />
                      Restaurar esta versão
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 lg:p-10 bg-white custom-scrollbar">
                    <div
                      className="prose prose-sm prose-slate max-w-none opacity-90"
                      dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                    />
                  </div>
                </div>

                {/* Versão Atual (direita) */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="px-5 py-3 border-b bg-white border-ink-100 flex items-center justify-between shrink-0">
                    <div>
                      <p className="text-[11px] font-black text-ink-900 uppercase tracking-tight">Estado Atual do Editor</p>
                      <p className="text-[9px] text-ink-400 font-medium mt-0.5">Laudo em edição</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-6 lg:p-10 bg-teal-50/[0.03] custom-scrollbar relative">
                    <div className="absolute inset-0 bg-teal-500/[0.01] pointer-events-none" />
                    <div
                      className="prose prose-sm prose-slate max-w-none relative z-10"
                      dangerouslySetInnerHTML={{ __html: currentContent }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Simple View */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 py-3 border-b bg-white border-ink-100 flex items-center justify-between shrink-0">
                  <div>
                    <p className="text-[11px] font-black text-ink-900 uppercase tracking-tight">Conteúdo da Versão</p>
                    <p className="text-[9px] text-ink-400 font-medium mt-0.5">
                      Criado em {formatDateTime(selectedVersion.timestamp)} via {TRIGGER_LABELS[selectedVersion.trigger]?.label || 'Edição'}
                    </p>
                  </div>
                  <button
                    onClick={handleRestoreClick}
                    className="h-8 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-teal-500/10 active:scale-95"
                  >
                    <CheckCircle2 size={13} />
                    Restaurar esta versão
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                  <div className="max-w-[800px] mx-auto p-8 lg:p-12">
                    <div
                      className="prose prose-sm prose-slate max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

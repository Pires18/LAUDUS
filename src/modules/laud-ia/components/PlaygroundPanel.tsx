import { Loader2, Play, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { classNames } from '../../../utils/format';
import type { ReportTemplate, ExamArea } from '../../../types';

interface PlaygroundPanelProps {
  templateSubTab: 'exams' | 'area';
  selectedAreaFilter: ExamArea | '';
  templates: ReportTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onRun: () => void;
  isTesting: boolean;
  result: string;
  /** { score: number; issues: {severity;message}[] } — mantido loose (fonte: auditoria). */
  score: any;
  scratchpad: string;
}

/**
 * Playground do LAUD.IA — sandbox para o admin testar uma máscara com notas
 * clínicas simuladas e ver o laudo gerado, a nota da auditoria e o raciocínio.
 * Extraído de SharedLaudIA para reduzir o tamanho do componente.
 */
export function PlaygroundPanel({
  templateSubTab,
  selectedAreaFilter,
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  notes,
  setNotes,
  onRun,
  isTesting,
  result,
  score,
  scratchpad,
}: PlaygroundPanelProps) {
  return (
    <div className="p-5 space-y-5 border-t border-zinc-900 text-zinc-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Esquerda: entrada de notas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-mono">Notas Clínicas (Input)</label>
            {templateSubTab === 'area' && selectedAreaFilter && (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-xl text-[10px] px-2 py-1 focus:ring-1 focus:ring-violet-500/30 font-bold"
              >
                <option value="">Exame de teste...</option>
                {templates.filter((t) => t.area === selectedAreaFilter).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 text-xs p-3 focus:ring-2 focus:ring-violet-500/30 placeholder-zinc-700 resize-none font-medium leading-relaxed"
            placeholder="Digite notas médicas de teste..."
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-mono">Paciente Simulado: F, 41a</span>
            <button
              type="button"
              onClick={onRun}
              disabled={isTesting || !selectedTemplateId}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isTesting ? (
                <><Loader2 size={12} className="animate-spin" /> Simulando...</>
              ) : (
                <><Play size={12} /> Simular Laudo</>
              )}
            </button>
          </div>
        </div>

        {/* Direita: auditoria/nota */}
        <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-center min-h-[140px]">
          {isTesting ? (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-500 font-mono text-[11px]">
              <Loader2 size={24} className="animate-spin text-violet-500 mb-2" />
              <span>Chamando IA...</span>
            </div>
          ) : result ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest font-mono">Auditoria</span>
                {score && (
                  <span className={classNames(
                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                    score.score >= 90 ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" :
                    score.score >= 75 ? "bg-amber-950/60 text-amber-400 border border-amber-900/50" :
                    "bg-rose-950/60 text-rose-400 border border-rose-900/50"
                  )}>
                    Nota: {score.score}/100
                  </span>
                )}
              </div>
              {score && score.issues.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {score.issues.map((issue: any, index: number) => (
                    <div key={index} className={classNames(
                      "flex items-start gap-2 p-2 rounded-lg text-[10px] font-medium border",
                      issue.severity === 'error' ? "bg-rose-950/30 text-rose-300 border-rose-900/20" : "bg-amber-950/30 text-amber-300 border-amber-900/20"
                    )}>
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 rounded-xl text-xs font-semibold">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>Sem erros de conformidade detectados!</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-zinc-600 font-mono text-[11px] text-center">
              <Sparkles size={20} className="text-zinc-800 mb-2" />
              <span>Simule o laudo para ver os resultados.</span>
            </div>
          )}
        </div>
      </div>

      {/* Laudo gerado + scratchpad */}
      {result && !isTesting && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-zinc-900">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Laudo Gerado</span>
            <div className="bg-white text-zinc-900 rounded-2xl border border-zinc-200 p-5 shadow-inner max-h-[300px] overflow-y-auto prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: result }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Raciocínio (Scratchpad)</span>
            <div className="bg-zinc-900/60 text-zinc-400 font-mono text-[10px] rounded-2xl border border-zinc-800 p-5 max-h-[300px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {scratchpad || "Nenhum bloco de pensamento foi capturado."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

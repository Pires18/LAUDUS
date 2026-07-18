import { Eye, X, Copy } from 'lucide-react';
import { buildPrompt } from '../../ai/engine';
import type { ReportTemplate, Patient, ExamRequest, AppSettings } from '../../../types';

interface PromptPreviewModalProps {
  template: ReportTemplate;
  patient: Patient;
  exam: ExamRequest | undefined;
  settings: AppSettings;
  onClose: () => void;
  onCopied: () => void;
}

/**
 * Modal (admin) que mostra o prompt EXATO enviado ao modelo — system context +
 * user message — com opção de copiar. Extraído de ExamEditor; o prompt é
 * montado uma única vez (antes era duplicado entre exibir e copiar).
 */
export function PromptPreviewModal({ template, patient, exam, settings, onClose, onCopied }: PromptPreviewModalProps) {
  const model = settings.geminiModel || 'gemini-3.5-flash';

  const { universalContext, areaContext, userMessage } = buildPrompt({
    template,
    patient,
    settings,
    clinicalIndication: exam?.clinicalIndication,
    requestingPhysician: exam?.requestingPhysician,
    anamnesis: exam?.anamnesis,
  });
  const systemContext = universalContext + (areaContext ? '\n\n' + areaContext : '');
  const fullPrompt = `══ SYSTEM CONTEXT ══\n${systemContext}\n\n══ USER MESSAGE ══\n${userMessage}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-ink-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Eye size={16} className="text-brand-500" /> Prompt Preview</h3>
            <p className="text-xs text-ink-500 mt-0.5">Prompt exato enviado ao modelo {model}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs font-mono text-ink-700 whitespace-pre-wrap leading-relaxed bg-ink-50 p-4 rounded-xl border border-ink-200">
            {fullPrompt}
          </pre>
        </div>
        <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-between bg-ink-50/50 shrink-0">
          <span className="text-[10px] text-ink-400">
            Temperatura: {settings.aiTemperature ?? 0.3} · Modelo: {model}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(fullPrompt); onCopied(); }}
            className="btn-secondary text-xs py-1.5"
          >
            <Copy size={12} /> Copiar Prompt
          </button>
        </div>
      </div>
    </div>
  );
}

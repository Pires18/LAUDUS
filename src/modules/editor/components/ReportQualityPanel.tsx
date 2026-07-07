import { useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, Info, ChevronDown, CheckCircle2, Gauge,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { auditReportQuality } from '../../ai/engine';
import { verifyReport } from '../../ai/verification';
import type { FeedbackRating } from '../../ai/training/feedbackStore';

// ═══════════════════════════════════════════════════════════════
// ReportQualityPanel — avaliação + feedback humano em tempo real
// ═══════════════════════════════════════════════════════════════
// Surfacia a auditoria estrutural + verificação anti-alucinação e permite
// ao médico dar feedback explícito (👍/👎) na própria barra — fechando o
// ciclo de padronização e confiabilidade (o sistema aprende o que o médico
// considera correto).

interface Issue { type: string; severity: 'error' | 'warning' | 'info'; message: string; }

interface Props {
  html: string;
  area?: string;
  anamnesis?: string;
  clinicalIndication?: string;
  /** Inicia expandido (default: colapsado). */
  defaultOpen?: boolean;
  /** Variante compacta para uso embutido (ex.: no copiloto). */
  compact?: boolean;
  /** Habilita botões de feedback 👍/👎 na barra. */
  onRate?: (rating: FeedbackRating, auditScore: number) => void;
}

export function ReportQualityPanel({ html, area, anamnesis, clinicalIndication, defaultOpen = false, compact = false, onRate }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [rated, setRated] = useState<FeedbackRating | null>(null);

  const { score, errors, warnings, infos } = useMemo(() => {
    const audit = auditReportQuality(html || '', area);
    const verification = verifyReport(html || '', { area, anamnesis, clinicalIndication });
    const all: Issue[] = [...audit.issues, ...verification.issues];
    return {
      score: audit.score,
      errors: all.filter((i) => i.severity === 'error'),
      warnings: all.filter((i) => i.severity === 'warning'),
      infos: all.filter((i) => i.severity === 'info'),
    };
  }, [html, area, anamnesis, clinicalIndication]);

  const hasIssues = errors.length > 0 || warnings.length > 0;
  const tone: 'emerald' | 'amber' | 'rose' = errors.length > 0 ? 'rose' : warnings.length > 0 ? 'amber' : 'emerald';

  const toneStyles = {
    emerald: 'border-emerald-100 bg-emerald-50/50',
    amber: 'border-amber-100 bg-amber-50/50',
    rose: 'border-rose-100 bg-rose-50/50',
  }[tone];
  const toneText = { emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }[tone];

  const scoreColor = score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600';

  const rate = (r: FeedbackRating) => {
    if (!onRate) return;
    setRated(r);
    onRate(r, score);
  };

  return (
    <div className={classNames('shrink-0 border-b animate-fade-in', toneStyles, compact && 'rounded-xl border')}>
      {/* Barra resumo */}
      <div className="w-full px-4 py-2 flex items-center justify-between gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
          <ShieldCheck size={13} className={toneText} />
          <span className="text-[10px] font-black uppercase tracking-widest text-ink-600">Avaliação</span>
          <div className="flex items-center gap-1.5">
            <Gauge size={11} className="text-ink-400" />
            <span className={classNames('text-[11px] font-black', scoreColor)}>{score}<span className="text-ink-400 font-bold">/100</span></span>
          </div>
          <div className="h-3 w-px bg-ink-200 mx-0.5" />
          {!hasIssues ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 size={12} /> Sem pendências
            </span>
          ) : (
            <span className="flex items-center gap-2 text-[10px] font-bold">
              {errors.length > 0 && <span className="flex items-center gap-1 text-rose-700"><XCircle size={11} /> {errors.length} erro{errors.length > 1 ? 's' : ''}</span>}
              {warnings.length > 0 && <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={11} /> {warnings.length} aviso{warnings.length > 1 ? 's' : ''}</span>}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {/* Feedback humano */}
          {onRate && (
            <div className="flex items-center gap-0.5 mr-0.5">
              <button
                onClick={() => rate('positive')}
                title="Bom laudo — a IA acertou o padrão"
                className={classNames(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90',
                  rated === 'positive' ? 'bg-emerald-500 text-white shadow-sm' : 'text-ink-400 hover:bg-emerald-50 hover:text-emerald-600'
                )}
              >
                <ThumbsUp size={13} />
              </button>
              <button
                onClick={() => rate('negative')}
                title="Precisa melhorar — sinaliza para o aprendizado"
                className={classNames(
                  'w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90',
                  rated === 'negative' ? 'bg-rose-500 text-white shadow-sm' : 'text-ink-400 hover:bg-rose-50 hover:text-rose-600'
                )}
              >
                <ThumbsDown size={13} />
              </button>
            </div>
          )}
          <button onClick={() => setOpen((o) => !o)} className="w-6 h-6 flex items-center justify-center">
            <ChevronDown size={14} className={classNames('text-ink-400 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Lista detalhada */}
      {open && (errors.length > 0 || warnings.length > 0 || infos.length > 0) && (
        <div className="px-4 pb-3 space-y-1.5">
          {errors.map((i, k) => <IssueRow key={`e${k}`} severity="error" message={i.message} />)}
          {warnings.map((i, k) => <IssueRow key={`w${k}`} severity="warning" message={i.message} />)}
          {infos.map((i, k) => <IssueRow key={`i${k}`} severity="info" message={i.message} />)}
        </div>
      )}
      {open && !hasIssues && infos.length === 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-emerald-700">Laudo aprovado: estrutura completa, classificações presentes, unidades e coerência verificadas.</p>
        </div>
      )}
    </div>
  );
}

function IssueRow({ severity, message }: { severity: 'error' | 'warning' | 'info'; message: string }) {
  const cfg = {
    error: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    info: { icon: Info, color: 'text-ink-400', bg: 'bg-ink-50' },
  }[severity];
  const Icon = cfg.icon;
  return (
    <div className={classNames('flex items-start gap-2 px-2.5 py-1.5 rounded-lg', cfg.bg)}>
      <Icon size={12} className={classNames('mt-0.5 shrink-0', cfg.color)} />
      <span className="text-[11px] text-ink-700 leading-snug">{message}</span>
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, Info, ChevronDown, CheckCircle2, Gauge,
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { auditReportQuality } from '../../ai/engine';
import { verifyReport } from '../../ai/verification';

// ═══════════════════════════════════════════════════════════════
// ReportQualityPanel — feedback de qualidade visível no editor
// ═══════════════════════════════════════════════════════════════
// Surfacia, em tempo real, a auditoria estrutural (auditReportQuality)
// e a verificação anti-alucinação (verifyReport) que antes rodavam
// invisíveis. Dá ao médico um retorno imediato: estrutura completa?
// classificações obrigatórias presentes? unidades corretas? ALERTA com
// base? medidas rastreáveis?

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
}

export function ReportQualityPanel({ html, area, anamnesis, clinicalIndication, defaultOpen = false, compact = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

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
    emerald: { bar: 'border-emerald-100 bg-emerald-50/50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    amber: { bar: 'border-amber-100 bg-amber-50/50', text: 'text-amber-700', dot: 'bg-amber-500' },
    rose: { bar: 'border-rose-100 bg-rose-50/50', text: 'text-rose-700', dot: 'bg-rose-500' },
  }[tone];

  const scoreColor = score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className={classNames('shrink-0 border-b animate-fade-in', toneStyles.bar, compact && 'rounded-xl border')}>
      {/* Barra resumo (clicável) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2 flex items-center justify-between gap-3 group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck size={13} className={toneStyles.text} />
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
        </div>
        <ChevronDown size={14} className={classNames('text-ink-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

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

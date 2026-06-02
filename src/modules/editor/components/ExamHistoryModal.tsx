import { useState, useEffect, useMemo } from 'react';
import { ExamRequest, ExamArea, EXAM_AREAS, Patient } from '../../../types';
import { getAll, where } from '../../../store/db';
import {
  X, History, Clock, FileText, Search, SplitSquareHorizontal,
  Eye, AlertCircle, Loader2, CalendarDays, Filter
} from 'lucide-react';
import { formatDateTime, classNames } from '../../../utils/format';
import { AreaIcon } from '../../../components/AreaIcon';

interface ExamHistoryModalProps {
  patient: Patient;
  currentExamId: string;
  currentContent: string;
  onClose: () => void;
}

// Mapeia área → cor de destaque para as pills e bordas
const AREA_ACCENT: Record<string, { pill: string; badge: string; dot: string }> = {
  'medicina-interna':  { pill: 'bg-blue-100 text-blue-700 border-blue-200',   badge: 'bg-blue-50 text-blue-600 border-blue-100',   dot: 'bg-blue-500'    },
  'ginecologia':       { pill: 'bg-pink-100 text-pink-700 border-pink-200',   badge: 'bg-pink-50 text-pink-600 border-pink-100',   dot: 'bg-pink-500'    },
  'medicina-fetal':    { pill: 'bg-purple-100 text-purple-700 border-purple-200', badge: 'bg-purple-50 text-purple-600 border-purple-100', dot: 'bg-purple-500' },
  'pequenas-partes':   { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', badge: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500' },
  'musculoesqueletico':{ pill: 'bg-orange-100 text-orange-700 border-orange-200', badge: 'bg-orange-50 text-orange-600 border-orange-100', dot: 'bg-orange-500' },
  'vascular':          { pill: 'bg-red-100 text-red-700 border-red-200',      badge: 'bg-red-50 text-red-600 border-red-100',      dot: 'bg-red-500'     },
  'pediatria':         { pill: 'bg-cyan-100 text-cyan-700 border-cyan-200',   badge: 'bg-cyan-50 text-cyan-600 border-cyan-100',   dot: 'bg-cyan-500'    },
  'procedimentos':     { pill: 'bg-slate-100 text-slate-700 border-slate-200',badge: 'bg-slate-50 text-slate-600 border-slate-100',dot: 'bg-slate-500'   },
  'reumatologico':     { pill: 'bg-amber-100 text-amber-700 border-amber-200',badge: 'bg-amber-50 text-amber-600 border-amber-100',dot: 'bg-amber-500'   },
  'mastologia':        { pill: 'bg-rose-100 text-rose-700 border-rose-200',   badge: 'bg-rose-50 text-rose-600 border-rose-100',   dot: 'bg-rose-500'    },
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  'finalizado':    { label: 'Finalizado',    className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'em-andamento':  { label: 'Em andamento',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  'pendente':      { label: 'Pendente',      className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function groupByMonth(exams: ExamRequest[]): { label: string; exams: ExamRequest[] }[] {
  const map = new Map<string, ExamRequest[]>();
  for (const exam of exams) {
    const date = new Date(exam.createdAt || 0);
    const key = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    if (!map.has(cap)) map.set(cap, []);
    map.get(cap)!.push(exam);
  }
  return Array.from(map.entries()).map(([label, exams]) => ({ label, exams }));
}

export function ExamHistoryModal({
  patient,
  currentExamId,
  currentContent,
  onClose,
}: ExamHistoryModalProps) {
  const [allExams, setAllExams] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExamRequest | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<ExamArea | 'todas'>('todas');

  // Carrega TODOS os exames do paciente de uma vez.
  // Usa APENAS where() sem orderBy() para evitar exigência de índice composto
  // no Firestore (users/{uid}/exams). A ordenação é feita no cliente.
  useEffect(() => {
    async function load() {
      try {
        const exams = await getAll<ExamRequest>(
          'exams',
          where('patientId', '==', patient.id)
        );
        // Ordena por data de criação (mais recente primeiro) no cliente
        const sorted = [...exams].sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        // Remove o exame atualmente aberto do histórico
        const past = sorted.filter(e => e.id !== currentExamId);
        setAllExams(past);
        // Auto-seleciona o exame mais recente que tenha laudo gerado
        const withReport = past.find(e => !!e.reportContent);
        if (withReport) setSelected(withReport);
      } catch (err) {
        console.error('[ExamHistoryModal] Erro ao carregar histórico:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patient.id, currentExamId]);

  // Áreas presentes no histórico para montar os filtros
  const presentAreas = useMemo(() => {
    const set = new Set<ExamArea>();
    allExams.forEach(e => { if (e.area) set.add(e.area); });
    return Array.from(set);
  }, [allExams]);

  // Aplica filtros de busca e área
  const filtered = useMemo(() => {
    return allExams.filter(e => {
      if (areaFilter !== 'todas' && e.area !== areaFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.examType?.toLowerCase().includes(q) ||
          e.area?.toLowerCase().includes(q) ||
          e.clinicalIndication?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allExams, areaFilter, search]);

  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  const areaLabel = (area: string) =>
    EXAM_AREAS.find(a => a.id === area)?.label || area;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-0 lg:p-6 animate-fade-in">
      <div className="bg-white w-full h-full lg:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-w-[1400px] max-h-[920px] border border-slate-100">

        {/* ── Header ── */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-700/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-4 z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner">
              <History size={20} className="text-brand-300" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tight leading-tight">
                Histórico Clínico
              </h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {patient.name} · {allExams.length} exame{allExams.length !== 1 ? 's' : ''} encontrado{allExams.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            {/* Toggle comparação */}
            <button
              onClick={() => setCompareMode(!compareMode)}
              title={compareMode ? 'Visualizar laudo selecionado' : 'Comparar com laudo atual'}
              className={classNames(
                "flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                compareMode
                  ? "bg-brand-500 text-white border-brand-400 shadow-lg shadow-brand-500/25"
                  : "bg-white/10 text-white border-white/10 hover:bg-white/20"
              )}
            >
              <SplitSquareHorizontal size={14} />
              <span className="hidden sm:inline">{compareMode ? 'Comparando' : 'Comparar'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Sidebar Timeline ── */}
          <aside className="w-[280px] lg:w-[300px] bg-slate-50 border-r border-slate-100 flex flex-col shrink-0">

            {/* Search + filter de área */}
            <div className="p-3 border-b border-slate-100 space-y-2 bg-white">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar exame..."
                  className="w-full pl-8 pr-3 py-2 text-[11px] font-semibold bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/10 text-slate-700 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Pills de área */}
              {presentAreas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setAreaFilter('todas')}
                    className={classNames(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all",
                      areaFilter === 'todas'
                        ? "bg-slate-900 text-white border-slate-800 shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    Todas
                  </button>
                  {presentAreas.map(area => {
                    const acc = AREA_ACCENT[area];
                    return (
                      <button
                        key={area}
                        onClick={() => setAreaFilter(area === areaFilter ? 'todas' : area)}
                        className={classNames(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all",
                          areaFilter === area
                            ? (acc?.pill || 'bg-brand-100 text-brand-700 border-brand-200')
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {areaLabel(area).split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lista de exames */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={20} className="animate-spin text-brand-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Carregando histórico...
                  </span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <FileText size={24} className="text-slate-300" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      {search || areaFilter !== 'todas' ? 'Nenhum exame encontrado' : 'Sem histórico'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">
                      {search || areaFilter !== 'todas'
                        ? 'Tente ajustar os filtros de busca.'
                        : 'Este paciente não possui exames anteriores no sistema.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="px-2 space-y-4">
                  {groups.map(({ label, exams: groupExams }) => (
                    <div key={label}>
                      {/* Label do mês */}
                      <div className="flex items-center gap-2 px-2 py-1 mb-1">
                        <CalendarDays size={11} className="text-slate-400 shrink-0" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                          {label}
                        </span>
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[9px] text-slate-300 font-bold">
                          {groupExams.length}
                        </span>
                      </div>

                      {/* Cards do exame */}
                      <div className="space-y-1">
                        {groupExams.map(exam => {
                          const acc = AREA_ACCENT[exam.area] || AREA_ACCENT['medicina-interna'];
                          const statusStyle = STATUS_STYLES[exam.status] || STATUS_STYLES['pendente'];
                          const isSelected = selected?.id === exam.id;

                          return (
                            <button
                              key={exam.id}
                              onClick={() => setSelected(exam)}
                              className={classNames(
                                "w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden",
                                isSelected
                                  ? "bg-white border-brand-200 shadow-md shadow-brand-500/5"
                                  : "bg-white/60 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm"
                              )}
                            >
                              {/* Linha de destaque lateral */}
                              {isSelected && (
                                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-brand-500 rounded-full" />
                              )}

                              <div className="flex items-start gap-2.5">
                                {/* Ícone da área */}
                                <div className={classNames(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                                  isSelected ? acc.badge : "bg-slate-50 text-slate-400 border-slate-100"
                                )}>
                                  <AreaIcon area={exam.area} size={15} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className={classNames(
                                    "text-[11px] font-black leading-tight truncate",
                                    isSelected ? "text-slate-900" : "text-slate-700"
                                  )}>
                                    {exam.examType}
                                  </p>

                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className={classNames(
                                      "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                      acc.badge
                                    )}>
                                      {areaLabel(exam.area).split(' ')[0]}
                                    </span>
                                    <span className={classNames(
                                      "text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider",
                                      statusStyle.className
                                    )}>
                                      {statusStyle.label}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 mt-1.5">
                                    <Clock size={9} className="text-slate-300 shrink-0" />
                                    <span className="text-[9px] text-slate-400 font-medium">
                                      {formatDateTime(exam.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Indicador de sem laudo */}
                              {!exam.reportContent && (
                                <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                                  <AlertCircle size={9} className="text-amber-500 shrink-0" />
                                  <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">
                                    Sem laudo gerado
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé com contagem */}
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <Filter size={10} className="text-slate-400" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {filtered.length} de {allExams.length} exames
                  </span>
                </div>
                {selected?.reportContent && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                      Laudo carregado
                    </span>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ── Área de conteúdo ── */}
          <main className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-10">
                <div className="w-20 h-20 rounded-[2rem] bg-slate-100 flex items-center justify-center">
                  <Eye size={32} className="text-slate-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                    Selecione um exame
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto leading-relaxed font-medium">
                    Escolha um exame na linha do tempo para visualizar o laudo ou comparar com o atual.
                  </p>
                </div>
              </div>
            ) : compareMode ? (
              /* ── Modo Comparação: Split view ── */
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Laudo anterior (esq) */}
                <div className="flex-1 flex flex-col border-r border-slate-200 min-w-0">
                  <ReportPanelHeader
                    title="Laudo Anterior"
                    subtitle={`${selected.examType} · ${formatDateTime(selected.createdAt)}`}
                    area={selected.area}
                    status={selected.status}
                    accent={AREA_ACCENT[selected.area]}
                    isActive={false}
                  />
                  <div className="flex-1 overflow-auto p-6 lg:p-10 bg-white custom-scrollbar">
                    {selected.reportContent ? (
                      <div
                        className="prose prose-sm prose-slate max-w-none opacity-90"
                        dangerouslySetInnerHTML={{ __html: selected.reportContent }}
                      />
                    ) : (
                      <NoReportPlaceholder />
                    )}
                  </div>
                </div>

                {/* Laudo atual (dir) */}
                <div className="flex-1 flex flex-col min-w-0">
                  <ReportPanelHeader
                    title="Laudo Atual"
                    subtitle="Em edição"
                    area={null}
                    status="em-andamento"
                    accent={null}
                    isActive
                  />
                  <div className="flex-1 overflow-auto p-6 lg:p-10 bg-brand-50/10 custom-scrollbar relative">
                    <div className="absolute inset-0 bg-brand-500/[0.02] pointer-events-none" />
                    <div
                      className="prose prose-sm prose-slate max-w-none relative z-10"
                      dangerouslySetInnerHTML={{ __html: currentContent }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Modo Visualização simples ── */
              <div className="flex-1 flex flex-col min-h-0">
                <ReportPanelHeader
                  title={selected.examType}
                  subtitle={`${areaLabel(selected.area)} · ${formatDateTime(selected.createdAt)}`}
                  area={selected.area}
                  status={selected.status}
                  accent={AREA_ACCENT[selected.area]}
                  isActive={false}
                  extraAction={
                    <button
                      onClick={() => setCompareMode(true)}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-brand-50 text-brand-700 border border-brand-100 text-[9px] font-black uppercase tracking-wider hover:bg-brand-100 transition-colors"
                    >
                      <SplitSquareHorizontal size={11} />
                      Comparar
                    </button>
                  }
                />
                <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                  <div className="max-w-[850px] mx-auto p-8 lg:p-14">
                    {selected.reportContent ? (
                      <div
                        className="prose prose-sm prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: selected.reportContent }}
                      />
                    ) : (
                      <NoReportPlaceholder />
                    )}
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

/* ── Sub-components ── */

interface ReportPanelHeaderProps {
  title: string;
  subtitle: string;
  area: string | null;
  status: string;
  accent: { pill: string; badge: string; dot: string } | null;
  isActive: boolean;
  extraAction?: React.ReactNode;
}

function ReportPanelHeader({ title, subtitle, area, status, accent, isActive, extraAction }: ReportPanelHeaderProps) {
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES['pendente'];
  return (
    <div className={classNames(
      "px-5 py-3 border-b flex items-center justify-between shrink-0 gap-3",
      isActive ? "bg-white border-brand-100 shadow-sm" : "bg-white border-slate-100"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {area && (
          <div className={classNames(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
            accent?.badge || "bg-slate-50 border-slate-100 text-slate-400"
          )}>
            <AreaIcon area={area} size={15} />
          </div>
        )}
        {isActive && (
          <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{title}</p>
          <p className="text-[9px] text-slate-400 font-medium mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {extraAction}
        <span className={classNames(
          "text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider",
          isActive ? "bg-brand-50 text-brand-700 border-brand-100" : statusStyle.className
        )}>
          {isActive ? 'Edição' : statusStyle.label}
        </span>
      </div>
    </div>
  );
}

function NoReportPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
        <FileText size={24} className="text-slate-200" />
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Laudo não gerado</p>
        <p className="text-[10px] text-slate-300 font-medium mt-1 max-w-[200px] mx-auto leading-relaxed">
          Este exame não possui um laudo registrado no sistema.
        </p>
      </div>
    </div>
  );
}

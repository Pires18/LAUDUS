import { useMemo, useState } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { ExamRequest, Patient, Clinic, EXAM_AREAS } from '../../types';
import {
  LayoutList, FilePlus, Clock, CheckCircle2, CircleDot, TrendingUp,
  Users, FileText, Activity, Building2, Sparkles,
  Zap, ChevronRight, Briefcase, Terminal, Loader2
} from 'lucide-react';
import { AreaIcon } from '../../components/AreaIcon';
import { classNames, formatDateTime } from '../../utils/format';
import { motion } from 'framer-motion';
import { Skeleton } from '../../components/SkeletonLoader';

export function Dashboard() {
  const { user } = useAuth();
  const { setView, selectedClinicId, settings, showToast, setShowCreateExamModal } = useApp();
  const currentRole = settings.currentRole || 'medico';
  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const [showAllRecent, setShowAllRecent] = useState(false);

  // Apply clinic filter
  const filteredExams = useMemo(() =>
    selectedClinicId ? exams.filter(e => e.clinicId === selectedClinicId) : exams,
    [exams, selectedClinicId]
  );

  // Stats
  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart); monthStart.setDate(1);

    const today = filteredExams.filter(e => e.createdAt >= todayStart.getTime());
    const week = filteredExams.filter(e => e.createdAt >= weekStart.getTime());
    const month = filteredExams.filter(e => e.createdAt >= monthStart.getTime());
    const pending = filteredExams.filter(e => e.status === 'pendente');
    const inProgress = filteredExams.filter(e => e.status === 'em-andamento');
    const finalized = filteredExams.filter(e => e.status === 'finalizado');
    const finalizedToday = today.filter(e => e.status === 'finalizado');

    // Area distribution
    const areaMap = new Map<string, number>();
    filteredExams.forEach(e => {
      areaMap.set(e.area, (areaMap.get(e.area) || 0) + 1);
    });

    // Last 7 days activity
    const dailyActivity: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const dEnd = new Date(d); dEnd.setDate(dEnd.getDate() + 1);
      const count = filteredExams.filter(e => e.createdAt >= d.getTime() && e.createdAt < dEnd.getTime()).length;
      dailyActivity.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
        count
      });
    }
    const maxDaily = Math.max(...dailyActivity.map(d => d.count), 1);

    return {
      total: filteredExams.length,
      today: today.length,
      week: week.length,
      month: month.length,
      pending: pending.length,
      inProgress: inProgress.length,
      finalized: finalized.length,
      finalizedToday: finalizedToday.length,
      areaMap,
      dailyActivity,
      maxDaily,
    };
  }, [filteredExams]);

  // Recent exams
  const recentExams = useMemo(() =>
    [...filteredExams].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, showAllRecent ? 15 : 5),
    [filteredExams, showAllRecent]
  );

  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);
  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [clinics, selectedClinicId]);

  const displayName = settings.physicianName || user?.displayName || 'Especialista';
  const hasDrPrefix = /^(dr|dra)\.?\s+/i.test(displayName);
  const greetingHeader = hasDrPrefix ? "Olá," : "Olá, Dr.";

  return (
    <div className="module-container">
      {/* Clean & Professional Hero Banner */}
      <section className="relative overflow-hidden shrink-0 rounded-3xl bg-white p-6 sm:p-10 shadow-sm border border-slate-200 mb-6 sm:mb-10 group">
        <div className="relative flex flex-col xl:flex-row items-center justify-between gap-10">
          <div className="text-center xl:text-left space-y-5">
            <div className="flex flex-wrap items-center justify-center xl:justify-start gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                <Sparkles size={14} className="text-brand-500" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">LAUD.IA CORE V16.0</span>
              </div>
              {selectedClinic ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 animate-fade-in">
                  <Building2 size={12} className="text-brand-500" />
                  <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">Unidade: {selectedClinic.name}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                  <Building2 size={12} className="text-slate-500" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Multiclínicas Ativo</span>
                </div>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              {greetingHeader} <br />
              <span className="text-brand-600">
                {displayName}
              </span>
            </h1>

            <p className="text-slate-500 text-lg max-w-md mx-auto xl:mx-0 font-medium">
              Você possui <span className="text-slate-800 font-bold">{stats.pending} exames</span> aguardando laudo na fila hoje.
            </p>

            <div className="flex flex-wrap items-center justify-center xl:justify-start gap-3 pt-2">
              <button 
                onClick={() => setShowCreateExamModal(true)}
                className="h-12 px-6 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 active:scale-95 shadow-sm"
              >
                <FilePlus size={16} />
                Novo Laudo IA
              </button>
              <button 
                onClick={() => setView({ name: 'worklist' })}
                className="h-12 px-6 rounded-xl bg-white text-slate-700 font-bold text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95"
              >
                <LayoutList size={16} />
                Worklist
              </button>
            </div>
          </div>

          {/* Quick Metrics Panel */}
          <div className="hidden xl:flex items-center gap-12 bg-slate-50 p-8 rounded-3xl border border-slate-200">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hoje</p>
              <p className="text-4xl font-black text-slate-800 tracking-tight">{stats.today}</p>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mês</p>
              <p className="text-4xl font-black text-slate-800 tracking-tight">{stats.month}</p>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Finalização</p>
              <p className="text-4xl font-black text-emerald-500 tracking-tight">
                {stats.total > 0 ? Math.round((stats.finalized / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Stats Neon Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-10 shrink-0">
        <StatCard
          label="Aguardando"
          value={stats.pending}
          icon={<Clock size={22} />}
          color="amber"
          loading={examsLoading}
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Em Andamento"
          value={stats.inProgress}
          icon={<CircleDot size={22} />}
          color="brand"
          loading={examsLoading}
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Laudados Hoje"
          value={stats.finalizedToday}
          icon={<CheckCircle2 size={22} />}
          color="emerald"
          loading={examsLoading}
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Pacientes Ativos"
          value={patients.length}
          icon={<Users size={22} />}
          color="indigo"
          loading={examsLoading}
          onClick={() => setView({ name: 'patients' })}
        />
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-10 items-start">
        
        {/* Left Column (2 cols) - Charts and Feeds */}
        <div className="xl:col-span-2 space-y-10">
          
          {/* Visual Activity Chart Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-none">Distribuição de Exames</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1.5">Últimos 7 dias de produção</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Sincronizado</span>
              </div>
            </div>

            {/* Styled Flex Bar Chart */}
            <div className="flex items-end justify-between gap-3 h-52 pt-4 px-2">
              {stats.dailyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar relative">
                  <div className="w-full flex flex-col items-center">
                    <motion.div 
                      initial={{ height: 4 }}
                      animate={{ height: Math.max((day.count / (stats.maxDaily || 1)) * 140, 4) }}
                      transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                      className={classNames(
                        "w-full max-w-[40px] rounded-t-lg transition-colors duration-300 relative group-hover/bar:brightness-95 cursor-pointer",
                        day.count > 0 ? "bg-brand-500" : "bg-slate-100"
                      )}
                    >
                      {/* Floating tooltip */}
                      {day.count > 0 && (
                        <div 
                          role="tooltip"
                          aria-label={`${day.count} exames em ${day.label}`}
                          className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap pointer-events-none"
                        >
                          {day.count} {day.count === 1 ? 'exame' : 'exames'}
                        </div>
                      )}
                    </motion.div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold tracking-widest">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Premium Recent Exams List Card */}
          <div className="bg-white border border-ink-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/10">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner">
                  <LayoutList size={22} />
                </div>
                <div>
                  <h3 className="font-black text-ink-900 text-lg leading-none">Atividade Recente</h3>
                  <p className="text-xs text-ink-400 uppercase font-black tracking-widest mt-1.5">Últimos laudos criados ou alterados</p>
                </div>
              </div>
              <button 
                onClick={() => setView({ name: 'worklist' })}
                className="h-10 px-4 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 text-ink-600 hover:text-brand-700 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 group"
              >
                Ver Worklist
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="divide-y divide-ink-50">
              {recentExams.length === 0 ? (
                <div className="p-16 text-center">
                  <FileText size={44} className="mx-auto text-ink-200 mb-4 animate-bounce" />
                  <p className="text-ink-500 font-bold italic">Nenhum exame recente registrado.</p>
                </div>
              ) : (
                recentExams.map(exam => {
                  const patient = patientMap.get(exam.patientId);
                  const area = EXAM_AREAS.find(a => a.id === exam.area);
                  const genderGlow = patient?.gender === 'F' 
                    ? 'ring-2 ring-pink-400/30 bg-pink-50 text-pink-700' 
                    : patient?.gender === 'M' 
                    ? 'ring-2 ring-blue-400/30 bg-blue-50 text-blue-700' 
                    : 'ring-2 ring-brand-400/20 bg-brand-50 text-brand-700';

                  return (
                    <button
                      key={exam.id}
                      onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                      className="w-full flex items-center gap-5 p-6 hover:bg-ink-50/40 transition-all text-left group"
                    >
                      {/* Safety avatar initial with safe fallback optional chaining */}
                      <div className={classNames("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 group-hover:scale-105 transition-transform shadow-inner", genderGlow)}>
                        {patient?.name?.charAt(0) || '?'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-ink-900 truncate group-hover:text-brand-600 transition-colors">{patient?.name || 'Paciente'}</h4>
                          {area && <span className={classNames("text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border shrink-0", area.color)}>{area.label}</span>}
                        </div>
                        <p className="text-xs text-ink-500 flex items-center gap-2 truncate">
                          <AreaIcon area={exam.area} size={12} className="text-ink-400" />
                          {exam.examType}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                         <span className={classNames(
                           "text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border",
                           exam.status === 'finalizado' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                           exam.status === 'em-andamento' ? "bg-brand-50 text-brand-700 border-brand-100" :
                           "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                         )}>
                           {exam.status}
                         </span>
                         <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tighter">{formatDateTime(exam.updatedAt || exam.createdAt)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            
            {!showAllRecent && filteredExams.length > 5 && (
              <div className="px-6 py-4 border-t border-ink-50 bg-ink-50/10 text-center">
                <button 
                  onClick={() => setShowAllRecent(true)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-colors"
                >
                  Ver Mais Antigos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col) - Sandboxes & Specialties */}
        <div className="space-y-10">
          


          {/* Specialty Progression Dial Card */}
          <div className="bg-white rounded-[2.5rem] border border-ink-100 p-8 shadow-sm">
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <TrendingUp size={14} className="text-brand-500 animate-pulse" /> Produção por Especialidade
            </h3>
            
            <div className="space-y-5">
              {EXAM_AREAS.map(area => {
                const count = stats.areaMap.get(area.id) || 0;
                if (count === 0 && stats.total > 0) return null;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                
                return (
                  <div key={area.id} className="group">
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span className="font-black text-ink-800 uppercase tracking-tight group-hover:text-brand-600 transition-colors flex items-center gap-2">
                        <AreaIcon area={area.id} size={12} className="text-ink-400" />
                        {area.label}
                      </span>
                      <span className="text-ink-400 font-bold">{count} {count === 1 ? 'laudo' : 'laudos'}</span>
                    </div>
                    <div className="h-2 bg-ink-50 rounded-full overflow-hidden border border-ink-100/50">
                      <div
                        className={classNames("h-full rounded-full transition-all duration-1000 ease-out", area.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Security/Licensing info */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden group">
            <div className="relative flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-200">
                <Briefcase size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-lg tracking-tight">Resumo da Conta</h4>
                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">Sessão Autenticada</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Total Geral</p>
                <p className="text-2xl font-black text-slate-800">{exams.length}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Clínicas</p>
                <p className="text-2xl font-black text-slate-800">{clinics.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, loading, onClick }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'amber' | 'brand' | 'emerald' | 'indigo';
  loading?: boolean;
  onClick?: () => void;
}) {
  const borderColors = {
    amber: 'border-amber-200 hover:border-amber-400',
    brand: 'border-brand-200 hover:border-brand-400',
    emerald: 'border-emerald-200 hover:border-emerald-400',
    indigo: 'border-indigo-200 hover:border-indigo-400',
  };
  const iconColors = {
    amber: 'bg-amber-50 text-amber-600',
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <button
      onClick={onClick}
      className={classNames(
        "p-4 sm:p-5 rounded-2xl border bg-white transition-all text-left shadow-sm hover:shadow active:scale-95",
        borderColors[color]
      )}
    >
      <div className={classNames("w-10 h-10 rounded-xl flex items-center justify-center mb-3", iconColors[color])}>
        {icon}
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-16 mb-1.5 rounded-lg" />
        ) : (
          <p className="text-3xl font-bold text-slate-800 leading-none mb-1.5">{value}</p>
        )}
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
    </button>
  );
}

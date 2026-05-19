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

export function Dashboard() {
  const { user } = useAuth();
  const { setView, selectedClinicId, settings, showToast } = useApp();
  const currentRole = settings.currentRole || 'medico';
  const { data: exams } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');



  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart); monthStart.setDate(1);

  // Apply clinic filter
  const filteredExams = useMemo(() =>
    selectedClinicId ? exams.filter(e => e.clinicId === selectedClinicId) : exams,
    [exams, selectedClinicId]
  );

  // Stats
  const stats = useMemo(() => {
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
    [...filteredExams].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 5),
    [filteredExams]
  );

  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);
  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [clinics, selectedClinicId]);

  const displayName = settings.physicianName || user?.displayName || 'Especialista';
  const hasDrPrefix = /^(dr|dra)\.?\s+/i.test(displayName);
  const greetingHeader = hasDrPrefix ? "Olá," : "Olá, Dr.";

  return (
    <div className="module-container">
      {/* Premium Glassmorphic Hero Welcome Banner */}
      <section className="relative overflow-hidden shrink-0 rounded-[2rem] sm:rounded-[2.5rem] bg-[#0c0c0e] p-6 sm:p-12 shadow-[0_24px_60px_rgba(0,0,0,0.4)] border border-white/5 mb-6 sm:mb-10 group">
        {/* Ambient Glows */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[120%] bg-brand-600 rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[-30%] right-[-10%] w-[60%] h-[120%] bg-indigo-600 rounded-full blur-[140px] animate-pulse delay-700" />
        </div>

        <div className="relative flex flex-col xl:flex-row items-center justify-between gap-10">
          <div className="text-center xl:text-left space-y-5">
            <div className="flex flex-wrap items-center justify-center xl:justify-start gap-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <Sparkles size={14} className="text-brand-400 animate-spin animate-duration-1000" />
                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">LAUD.IA ACTIVE CORE 6.2</span>
              </div>
              {selectedClinic ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 backdrop-blur-md animate-fade-in shadow-[0_0_15px_rgba(var(--brand-500-rgb),0.3)]">
                  <Building2 size={12} className="text-brand-300" />
                  <span className="text-[10px] font-black text-brand-200 uppercase tracking-[0.2em]">Unidade: {selectedClinic.name}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                  <Building2 size={12} className="text-ink-400" />
                  <span className="text-[10px] font-black text-ink-300 uppercase tracking-[0.2em]">Multiclínicas Ativo</span>
                </div>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              {greetingHeader} <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-indigo-300 to-emerald-400 animate-gradient-x">
                {displayName}
              </span>
            </h1>

            <p className="text-ink-300 text-lg max-w-md mx-auto xl:mx-0 font-medium">
              Você possui <span className="text-brand-400 font-black">{stats.pending} exames</span> aguardando laudo na fila hoje.
            </p>

            <div className="flex flex-wrap items-center justify-center xl:justify-start gap-4 pt-2">
              <button 
                onClick={() => setView({ name: 'worklist' })}
                className="h-14 px-8 rounded-2xl bg-brand-600 text-white font-black text-xs uppercase tracking-widest hover:bg-brand-500 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 group shadow-[0_12px_24px_rgba(99,102,241,0.3)]"
              >
                <FilePlus size={18} className="group-hover:translate-x-0.5 transition-transform" />
                Acessar Worklist
              </button>
              <button 
                onClick={() => setView({ name: 'templates' })}
                className="h-14 px-8 rounded-2xl bg-white/5 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 hover:border-white/20 backdrop-blur-md border border-white/10 hover:scale-[1.02] transition-all flex items-center gap-3"
              >
                <LayoutList size={18} />
                Minhas Máscaras
              </button>
            </div>
          </div>

          {/* Quick Metrics Circle Panel */}
          <div className="hidden xl:flex items-center gap-12 bg-white/[0.03] p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-md shadow-inner relative overflow-hidden group/panel">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/5 to-transparent pointer-events-none" />
            <div className="text-center">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2">Hoje</p>
              <p className="text-5xl font-black text-white leading-none tracking-tighter">{stats.today}</p>
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2">Mês</p>
              <p className="text-5xl font-black text-white leading-none tracking-tighter">{stats.month}</p>
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2">Finalização</p>
              <p className="text-5xl font-black text-emerald-400 leading-none tracking-tighter">
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
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Em Andamento"
          value={stats.inProgress}
          icon={<CircleDot size={22} />}
          color="brand"
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Laudados Hoje"
          value={stats.finalizedToday}
          icon={<CheckCircle2 size={22} />}
          color="emerald"
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Pacientes Ativos"
          value={patients.length}
          icon={<Users size={22} />}
          color="indigo"
          onClick={() => setView({ name: 'patients' })}
        />
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-10 items-start">
        
        {/* Left Column (2 cols) - Charts and Feeds */}
        <div className="xl:col-span-2 space-y-10">
          
          {/* Visual Activity Chart Card */}
          <div className="bg-white border border-ink-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 shadow-inner">
                  <Activity size={22} />
                </div>
                <div>
                  <h3 className="font-black text-ink-900 text-lg leading-none">Distribuição de Exames</h3>
                  <p className="text-xs text-ink-400 uppercase font-black tracking-widest mt-1.5">Últimos 7 dias de produção</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] font-black uppercase tracking-widest">Sincronizado</span>
              </div>
            </div>

            {/* Styled Flex Bar Chart */}
            <div className="flex items-end justify-between gap-3 h-52 pt-6 px-2">
              {stats.dailyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar relative">
                  <div className="w-full flex flex-col items-center">
                    {/* Glowing bar background halo for active days */}
                    {day.count > 0 && (
                      <div className="absolute bottom-10 w-full max-w-[44px] bg-brand-500/5 rounded-t-2xl filter blur-sm pointer-events-none transition-all" style={{ height: `${(day.count / (stats.maxDaily || 1)) * 140}px` }} />
                    )}
                    {/* Actual Bar */}
                    <div 
                      className={classNames(
                        "w-full max-w-[44px] rounded-t-2xl transition-all duration-700 relative group-hover/bar:scale-x-105 group-hover/bar:brightness-110 cursor-pointer",
                        day.count > 0 ? "bg-gradient-to-t from-brand-600 via-brand-500 to-indigo-500 shadow-lg shadow-brand-500/10" : "bg-ink-50/70"
                      )}
                      style={{ height: `${Math.max((day.count / (stats.maxDaily || 1)) * 140, 10)}px` }}
                    >
                      {/* Floating tooltip */}
                      {day.count > 0 && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 scale-95 group-hover/bar:scale-100 bg-ink-900 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl shadow-xl z-20 whitespace-nowrap border border-white/5">
                          {day.count} {day.count === 1 ? 'exame' : 'exames'}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-ink-400 font-black tracking-widest">{day.label}</span>
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
          <div className="bg-ink-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl group-hover:scale-120 transition-transform" />
            <div className="relative flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-brand-400 border border-white/10 shadow-inner">
                <Briefcase size={22} />
              </div>
              <div>
                <h4 className="font-black text-lg tracking-tight">Status da Licença</h4>
                <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest">Médico Autenticado</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mb-1.5">Total Geral</p>
                <p className="text-2xl font-black">{exams.length}</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mb-1.5">Clínicas</p>
                <p className="text-2xl font-black">{clinics.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, onClick }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'amber' | 'brand' | 'emerald' | 'indigo';
  onClick?: () => void;
}) {
  const colorMap = {
    amber: 'bg-white border-amber-100 hover:border-amber-400 hover:shadow-[0_20px_40px_rgba(245,158,11,0.08)]',
    brand: 'bg-white border-brand-100 hover:border-brand-400 hover:shadow-[0_20px_40px_rgba(99,102,241,0.08)]',
    emerald: 'bg-white border-emerald-100 hover:border-emerald-400 hover:shadow-[0_20px_40px_rgba(16,185,129,0.08)]',
    indigo: 'bg-white border-indigo-100 hover:border-indigo-400 hover:shadow-[0_20px_40px_rgba(79,70,229,0.08)]',
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
        "p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.2rem] border text-left group hover:-translate-y-1.5 transition-all duration-300",
        colorMap[color]
      )}
    >
      <div className={classNames("w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 shadow-inner group-hover:scale-105 transition-transform", iconColors[color])}>
        {icon}
      </div>
      <div>
        <p className="text-4xl font-black text-ink-900 leading-none mb-2 tracking-tighter">{value}</p>
        <p className="text-[11px] font-black text-ink-400 uppercase tracking-widest">{label}</p>
      </div>
    </button>
  );
}

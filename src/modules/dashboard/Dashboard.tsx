import { useMemo, useState } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { ExamRequest, Patient, Clinic, EXAM_AREAS, ExamStatus } from '../../types';
import {
  LayoutList, FilePlus, Clock, CheckCircle2, CircleDot, TrendingUp,
  Users, FileText, Activity, ArrowRight, Calendar, Building2, Sparkles,
  Zap, ChevronRight, Briefcase
} from 'lucide-react';
import { AreaIcon } from '../../components/AreaIcon';
import { classNames, formatDateTime } from '../../utils/format';
import { CreateExamModal } from '../../components/CreateExamModal';

export function Dashboard() {
  const { setView, selectedClinicId, settings, showToast } = useApp();
  const currentRole = settings.currentRole || 'medico';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: exams } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const now = Date.now();
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
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
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
    [...filteredExams].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 6),
    [filteredExams]
  );

  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6 animate-in fade-in duration-500">
      
      {/* Premium Hero Welcome */}
      <section className="relative overflow-hidden rounded-[2rem] bg-ink-900 p-6 sm:p-10 shadow-2xl">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-brand-600 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-0 -right-1/4 w-1/2 h-full bg-indigo-600 rounded-full blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
              <Sparkles size={12} className="text-brand-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Clinical AI Core v6.0</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {greeting}, <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-indigo-300">
                {settings.physicianName || 'Especialista'}
              </span>
            </h1>
            <p className="text-ink-300 text-base max-w-md mx-auto lg:mx-0">
              Você possui <span className="text-brand-400 font-bold">{stats.pending} exames</span> aguardando laudo hoje. Pronto para iniciar?
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-3">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="h-12 px-6 rounded-2xl bg-brand-500 text-white font-black text-sm uppercase tracking-widest hover:bg-brand-400 hover:shadow-premium transition-all flex items-center gap-2 group"
              >
                <FilePlus size={18} className="group-hover:scale-110 transition-transform" />
                Novo Laudo
              </button>
              <button 
                onClick={() => setView({ name: 'worklist' })}
                className="h-12 px-6 rounded-2xl bg-white/10 text-white font-black text-sm uppercase tracking-widest hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all flex items-center gap-2"
              >
                <LayoutList size={18} />
                Worklist
              </button>
            </div>
          </div>

          {/* Quick Metrics Circle */}
          <div className="hidden xl:flex items-center gap-12 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Hoje</p>
              <p className="text-4xl font-black text-white">{stats.today}</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Mês</p>
              <p className="text-4xl font-black text-white">{stats.month}</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Produtividade</p>
              <p className="text-4xl font-black text-emerald-400">
                {stats.total > 0 ? Math.round((stats.finalized / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
          label="Finalizados (Hoje)"
          value={stats.finalizedToday}
          icon={<CheckCircle2 size={22} />}
          color="emerald"
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Pacientes Atendidos"
          value={patients.length}
          icon={<Users size={22} />}
          color="indigo"
          onClick={() => setView({ name: 'patients' })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Activity & Areas */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Chart Section */}
          <div className="bg-white rounded-[2rem] border border-ink-100 p-8 shadow-sm group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 shadow-inner">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="font-black text-ink-900 text-lg">Atividade de Exames</h3>
                  <p className="text-xs text-ink-400 uppercase font-bold tracking-widest">Últimos 7 dias</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-brand-500 animate-pulse" />
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Live Updates</span>
              </div>
            </div>

            <div className="flex items-end justify-between gap-4 h-48 pt-4">
              {stats.dailyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar">
                  <div className="relative w-full flex flex-col items-center">
                    <div 
                      className={classNames(
                        "w-full max-w-[40px] rounded-t-2xl transition-all duration-500 relative group-hover/bar:brightness-110",
                        day.count > 0 ? "bg-gradient-to-t from-brand-600 to-brand-400 shadow-lg shadow-brand-500/20" : "bg-ink-50"
                      )}
                      style={{ height: `${Math.max((day.count / (stats.maxDaily || 1)) * 140, 8)}px` }}
                    >
                      {day.count > 0 && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-ink-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">
                          {day.count}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-ink-400 font-black uppercase tracking-widest">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Exams List */}
          <div className="bg-white rounded-[2rem] border border-ink-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-ink-100 flex items-center justify-between bg-ink-50/30">
              <h3 className="font-black text-ink-900 text-lg flex items-center gap-3">
                <LayoutList size={20} className="text-brand-500" /> Atividade Recente
              </h3>
              <button 
                onClick={() => setView({ name: 'worklist' })} 
                className="text-xs font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest flex items-center gap-1 group"
              >
                Ver tudo <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <div className="divide-y divide-ink-50">
              {recentExams.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText size={40} className="mx-auto text-ink-100 mb-4" />
                  <p className="text-ink-400 font-medium italic">Nenhum exame recente registrado.</p>
                </div>
              ) : (
                recentExams.map(exam => {
                  const patient = patientMap.get(exam.patientId);
                  const area = EXAM_AREAS.find(a => a.id === exam.area);
                  return (
                    <button
                      key={exam.id}
                      onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                      className="w-full flex items-center gap-4 p-6 hover:bg-ink-50/50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-lg shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                        {patient?.name.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-ink-900 truncate group-hover:text-brand-600 transition-colors">{patient?.name || 'Paciente'}</h4>
                          {area && <span className={classNames("text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border", area.color.replace('bg-', 'bg-').replace('text-', 'text-'))}>{area.label}</span>}
                        </div>
                        <p className="text-xs text-ink-500 flex items-center gap-2 truncate">
                          <AreaIcon area={exam.area} size={12} className="text-ink-400" />
                          {exam.examType}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                         <span className={classNames(
                           "text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border",
                           exam.status === 'finalizado' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                           exam.status === 'em-andamento' ? "bg-brand-50 text-brand-700 border-brand-100" :
                           "bg-amber-50 text-amber-700 border-amber-100"
                         )}>
                           {exam.status}
                         </span>
                         <p className="text-[10px] text-ink-400 mt-2 font-bold uppercase tracking-tighter">{formatDateTime(exam.updatedAt || exam.createdAt)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & System Info */}
        <div className="space-y-8">
          
          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-4 p-6 rounded-[2rem] bg-brand-600 text-white shadow-premium hover:bg-brand-700 hover:shadow-xl transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
                <Zap size={24} />
              </div>
              <div className="text-left">
                <p className="font-black text-lg leading-tight">Novo Laudo IA</p>
                <p className="text-xs text-white/70">Fluxo ultra-rápido</p>
              </div>
            </button>

            <button 
              onClick={() => setView({ name: 'patients' })}
              className="flex items-center gap-4 p-6 rounded-[2rem] bg-white border border-ink-100 shadow-sm hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:-rotate-6 transition-transform">
                <UserPlus size={24} />
              </div>
              <div className="text-left">
                <p className="font-black text-ink-900 text-lg leading-tight">Meus Pacientes</p>
                <p className="text-xs text-ink-400">Gerenciar cadastros</p>
              </div>
            </button>
          </div>

          {/* Distribution Section */}
          <div className="bg-white rounded-[2rem] border border-ink-100 p-8 shadow-sm">
            <h3 className="font-black text-ink-900 uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <TrendingUp size={14} className="text-brand-500" /> Especialidades
            </h3>
            <div className="space-y-5">
              {EXAM_AREAS.map(area => {
                const count = stats.areaMap.get(area.id) || 0;
                if (count === 0 && stats.total > 0) return null;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={area.id} className="group">
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span className="font-black text-ink-800 uppercase tracking-tight group-hover:text-brand-600 transition-colors">{area.label}</span>
                      <span className="text-ink-400 font-bold">{count}</span>
                    </div>
                    <div className="h-1.5 bg-ink-50 rounded-full overflow-hidden border border-ink-100/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.3)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Info */}
          <div className="bg-ink-900 rounded-[2rem] p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
            <div className="relative flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-brand-400 border border-white/10">
                <Briefcase size={24} />
              </div>
              <div>
                <h4 className="font-black text-xl tracking-tight">Status Global</h4>
                <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest">Workspace v6.2</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mb-1">Total Exames</p>
                <p className="text-2xl font-black">{exams.length}</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mb-1">Unidades</p>
                <p className="text-2xl font-black">{clinics.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && <CreateExamModal onClose={() => setShowCreateModal(false)} />}
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
    amber: 'bg-white border-amber-100 hover:border-amber-400',
    brand: 'bg-white border-brand-100 hover:border-brand-400',
    emerald: 'bg-white border-emerald-100 hover:border-emerald-400',
    indigo: 'bg-white border-indigo-100 hover:border-indigo-400',
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
        "p-6 rounded-[2rem] border text-left group hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300",
        colorMap[color]
      )}
    >
      <div className={classNames("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform", iconColors[color])}>
        {icon}
      </div>
      <div>
        <p className="text-4xl font-black text-ink-900 leading-none mb-2">{value}</p>
        <p className="text-[11px] font-black text-ink-400 uppercase tracking-widest">{label}</p>
      </div>
    </button>
  );
}

function UserPlus({ size, className }: { size: number; className?: string }) {
  return <Users size={size} className={className} />;
}

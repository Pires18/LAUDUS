import { useMemo } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { ExamRequest, Patient, Clinic, EXAM_AREAS, ExamStatus } from '../../types';
import {
  LayoutList, FilePlus, Clock, CheckCircle2, CircleDot, TrendingUp,
  Users, FileText, Activity, ArrowRight, Calendar, Building2, Sparkles
} from 'lucide-react';
import { classNames, formatDateTime } from '../../utils/format';

export function Dashboard() {
  const { setView, selectedClinicId, settings } = useApp();
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
    const finalizedWeek = week.filter(e => e.status === 'finalizado');

    // Area distribution
    const areaMap = new Map<string, number>();
    filteredExams.forEach(e => {
      areaMap.set(e.area, (areaMap.get(e.area) || 0) + 1);
    });

    // Last 7 days activity (day-by-day)
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
      finalizedWeek: finalizedWeek.length,
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

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6 animate-in fade-in duration-300">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900">
            {greeting}, <span className="text-brand-600">{settings.physicianName?.split(' ')[0] || 'Doutor(a)'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => setView({ name: 'new-exam' })} className="btn-primary shadow-md hover:shadow-lg transition-shadow w-full sm:w-auto justify-center">
          <FilePlus size={16} /> Novo Laudo
        </button>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pendentes"
          value={stats.pending}
          icon={<Clock size={20} />}
          color="amber"
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Em Andamento"
          value={stats.inProgress}
          icon={<CircleDot size={20} />}
          color="brand"
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Finalizados Hoje"
          value={stats.finalizedToday}
          icon={<CheckCircle2 size={20} />}
          color="emerald"
          onClick={() => setView({ name: 'worklist' })}
        />
        <StatCard
          label="Total do Mês"
          value={stats.month}
          icon={<TrendingUp size={20} />}
          color="indigo"
          onClick={() => setView({ name: 'worklist' })}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 card p-6 shadow-soft hover:shadow-lg transition-shadow bg-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
          <div className="relative flex items-center justify-between mb-6">
            <h3 className="font-bold text-ink-900 flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-brand-100 text-brand-600">
                <Activity size={18} />
              </div>
              Atividade da Semana
            </h3>
            <span className="text-[10px] text-brand-600 bg-brand-50 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
              {stats.week} exames realizados
            </span>
          </div>
          <div className="flex items-end justify-between gap-3 h-40">
            {stats.dailyActivity.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar">
                <span className="text-[11px] font-black text-ink-600">
                  {day.count}
                </span>
                <div className="w-full relative h-32 flex items-end">
                  <div 
                    className={classNames(
                      "w-full rounded-t-xl transition-all duration-300 relative overflow-hidden",
                      day.count > 0 ? "bg-gradient-to-t from-brand-600 via-brand-500 to-brand-400" : "bg-ink-100"
                    )}
                    style={{ height: `${Math.max((day.count / stats.maxDaily) * 100, 8)}%` }}
                  >
                    {day.count > 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-white/30" />}
                  </div>
                </div>
                <span className="text-[10px] text-ink-400 font-bold uppercase tracking-tight">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Area Distribution */}
        <div className="card p-5 shadow-soft">
          <h3 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-brand-500" /> Por Área
          </h3>
          <div className="space-y-2.5">
            {EXAM_AREAS.map(area => {
              const count = stats.areaMap.get(area.id) || 0;
              if (count === 0 && stats.total > 0) return null;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={area.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-ink-700">{area.label}</span>
                    <span className="text-ink-400 font-mono">{count}</span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.total === 0 && (
              <div className="text-center py-6 text-ink-400 text-xs">
                Nenhum exame registrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Exams + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Recent Exams */}
        <div className="lg:col-span-2 card shadow-soft overflow-hidden">
          <div className="px-5 py-3.5 border-b border-ink-100 flex items-center justify-between bg-ink-50/50">
            <h3 className="font-semibold text-ink-900 flex items-center gap-2">
              <LayoutList size={16} className="text-brand-500" /> Últimos Laudos
            </h3>
            <button onClick={() => setView({ name: 'worklist' })} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          {recentExams.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">
              <Sparkles size={24} className="mx-auto mb-2 text-ink-300" />
              Nenhum laudo ainda. Comece criando o primeiro!
            </div>
          ) : (
            <div className="divide-y divide-ink-50">
              {recentExams.map(exam => {
                const patient = patientMap.get(exam.patientId);
                const area = EXAM_AREAS.find(a => a.id === exam.area);
                const StatusIcon = exam.status === 'finalizado' ? CheckCircle2 : exam.status === 'em-andamento' ? CircleDot : Clock;
                const statusColor = exam.status === 'finalizado' ? 'text-emerald-500' : exam.status === 'em-andamento' ? 'text-brand-500' : 'text-amber-500';
                return (
                  <button
                    key={exam.id}
                    onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                    className="w-full text-left px-5 py-3 hover:bg-ink-50/60 transition-colors flex items-center gap-3 group"
                  >
                    <StatusIcon size={16} className={classNames(statusColor, 'shrink-0')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-900 truncate">{patient?.name || 'Paciente'}</span>
                        {area && <span className={`chip text-[9px] py-0 px-1.5 ${area.color}`}>{area.label}</span>}
                      </div>
                      <span className="text-xs text-ink-400 truncate block">{exam.examType}</span>
                    </div>
                    <span className="text-[10px] text-ink-400 shrink-0">{formatDateTime(exam.updatedAt || exam.createdAt)}</span>
                    <ArrowRight size={14} className="text-ink-300 group-hover:text-brand-500 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="card p-5 shadow-soft">
            <h3 className="font-semibold text-ink-900 mb-3 text-sm">Ações Rápidas</h3>
            <div className="space-y-2">
              {[
                { label: 'Novo Laudo', icon: FilePlus, view: { name: 'new-exam' as const }, color: 'bg-brand-50 text-brand-600 hover:bg-brand-100' },
                { label: 'Cadastrar Paciente', icon: Users, view: { name: 'patients' as const }, color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
                { label: 'Gerenciar Máscaras', icon: FileText, view: { name: 'templates' as const }, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' },
                { label: 'Configurar IA', icon: Sparkles, view: { name: 'laud-ia' as const }, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => setView(action.view)}
                  className={classNames("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors", action.color)}
                >
                  <action.icon size={16} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="card p-5 shadow-soft bg-gradient-to-br from-brand-50 to-white border-brand-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                <Activity size={16} className="text-brand-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-900">LAUD.US 3.0</h4>
                <p className="text-[10px] text-brand-600">Cloud Edition</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/70 rounded-md px-2.5 py-1.5 border border-brand-100">
                <span className="block text-[10px] text-ink-400 uppercase font-bold">Pacientes</span>
                <span className="text-lg font-black text-ink-800">{patients.length}</span>
              </div>
              <div className="bg-white/70 rounded-md px-2.5 py-1.5 border border-brand-100">
                <span className="block text-[10px] text-ink-400 uppercase font-bold">Exames</span>
                <span className="text-lg font-black text-ink-800">{exams.length}</span>
              </div>
              <div className="bg-white/70 rounded-md px-2.5 py-1.5 border border-brand-100">
                <span className="block text-[10px] text-ink-400 uppercase font-bold">Clínicas</span>
                <span className="text-lg font-black text-ink-800">{clinics.length}</span>
              </div>
              <div className="bg-white/70 rounded-md px-2.5 py-1.5 border border-brand-100">
                <span className="block text-[10px] text-ink-400 uppercase font-bold">Modelo IA</span>
                <span className="text-[11px] font-bold text-ink-700 truncate block">{settings.geminiModel || '—'}</span>
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
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    brand: 'bg-brand-50 text-brand-600 border-brand-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  const iconBg = {
    amber: 'bg-amber-100 text-amber-600',
    brand: 'bg-brand-100 text-brand-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <button
      onClick={onClick}
      className={classNames(
        "card p-4 shadow-soft border text-left group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5",
        colorMap[color]
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={classNames("w-9 h-9 rounded-xl flex items-center justify-center", iconBg[color])}>
          {icon}
        </div>
        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="text-2xl font-black leading-none mb-1">{value}</div>
      <div className="text-[11px] font-medium opacity-80">{label}</div>
    </button>
  );
}

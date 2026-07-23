import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { getAiUsageStats } from '../../store/db';
import { motorForModel } from '../ai/geminiModels';
import { useSubscription } from '../../hooks/useSubscription';
import { ExamRequest, Patient, Clinic, EXAM_AREAS, Appointment } from '../../types';
import { LAUDIA_VERSION } from '../../version';
import { WeeklyCalendar } from '../appointments/components/WeeklyCalendar';
import { getLocalDateStr } from '../appointments/utils/scheduleUtils';
import {
  LayoutList, FilePlus, Clock, CheckCircle2, CircleDot, TrendingUp,
  Users, FileText, Activity, Building2, Sparkles,
  ChevronRight, Loader2, BrainCircuit,
  Timer, BarChart2, Zap, Lock, Brain
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  'pendente': 'Aguardando',
  'em-andamento': 'Em Andamento',
  'finalizado': 'Finalizado',
};
import { AreaIcon } from '../../components/AreaIcon';
import { classNames, formatDateTime } from '../../utils/format';
import { motion } from 'framer-motion';
import { Skeleton } from '../../components/SkeletonLoader';
import { SetupChecklist } from '../../components/SetupChecklist';

export function Dashboard() {
  const { user } = useAuth();
  const { setView, selectedClinicId, settings, updateSettings, setShowCreateExamModal } = useApp();
  // Recepção: o painel só considera laudos finalizados (mesma regra da fila).
  const { role } = useAdmin();
  const isReception = role === 'recepcao';
  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');
  const { data: appointments } = useCollection<Appointment>('appointments');
  const subscription = useSubscription();

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr(new Date()));
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [aiStats, setAiStats] = useState<{
    totalCost: number; totalCalls: number; todayCost: number;
    liteCost: number; proCost: number; liteCount: number; proCount: number;
  } | null>(null);

  const selectedDayAppointments = useMemo(() => {
    return appointments.filter(app => {
      if (app.status === 'cancelado') return false;
      if (selectedClinicId && app.clinicId !== selectedClinicId) return false;
      return getLocalDateStr(app.scheduledAt) === selectedDate;
    }).sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [appointments, selectedDate, selectedClinicId]);

  useEffect(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    getAiUsageStats(monthStart.getTime(), Date.now()).then(logs => {
      const isLiteModel = (model: string) => motorForModel(model) === 'lite';
      const isProModel = (model: string) => !!(model && model.includes('pro'));
      const totalCost = logs.reduce((s, l) => s + (l.costUsd || 0), 0);
      const todayCost = logs.filter(l => l.timestamp >= todayStart.getTime()).reduce((s, l) => s + (l.costUsd || 0), 0);
      const liteLogs = logs.filter(l => isLiteModel(l.model));
      const proLogs = logs.filter(l => isProModel(l.model));
      const liteCost = liteLogs.reduce((s, l) => s + (l.costUsd || 0), 0);
      const proCost = proLogs.reduce((s, l) => s + (l.costUsd || 0), 0);
      setAiStats({ totalCost, totalCalls: logs.length, todayCost, liteCost, proCost, liteCount: liteLogs.length, proCount: proLogs.length });
    }).catch(() => {});
  }, []);

  const filteredExams = useMemo(() => {
    let result = selectedClinicId ? exams.filter(e => e.clinicId === selectedClinicId) : exams;
    if (isReception) result = result.filter(e => e.status === 'finalizado');
    return result;
  }, [exams, selectedClinicId, isReception]);

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
 
    const areaMap = new Map<string, number>();
    filteredExams.forEach(e => { areaMap.set(e.area, (areaMap.get(e.area) || 0) + 1); });
 
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
 
    const finalizedThisMonth = month.filter(e => e.status === 'finalizado' && e.finalizedAt);
    const avgCompletionMinutes = finalizedThisMonth.length > 0
      ? finalizedThisMonth.reduce((s, e) => s + (e.finalizedAt! - e.createdAt), 0) / finalizedThisMonth.length / 60_000
      : null;
 
    const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekCount = filteredExams.filter(e => e.createdAt >= prevWeekStart.getTime() && e.createdAt < weekStart.getTime()).length;
 
    const monthFinalized = month.filter(e => e.status === 'finalizado');
    const monthFinalizedRate = month.length > 0
      ? Math.round((monthFinalized.length / month.length) * 100)
      : 0;
 
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
      avgCompletionMinutes,
      prevWeekCount,
      monthFinalizedRate,
    };
  }, [filteredExams]);

  const recentExams = useMemo(() =>
    [...filteredExams].sort((a, b) => {
      const valA = a.status === 'finalizado' && a.finalizedAt ? a.finalizedAt : (a.updatedAt || a.createdAt);
      const valB = b.status === 'finalizado' && b.finalizedAt ? b.finalizedAt : (b.updatedAt || b.createdAt);
      return valB - valA;
    }).slice(0, showAllRecent ? 15 : 5),
    [filteredExams, showAllRecent]
  );

  const patientMap = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients]);
  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [clinics, selectedClinicId]);

  const displayName = settings.physicianName || user?.displayName || 'Especialista';
  const hasDrPrefix = /^(dr|dra)\.?\s+/i.test(displayName);
  const isClinicalRole = (settings.currentRole || 'medico') !== 'recepcao';
  const greetingName = hasDrPrefix || !isClinicalRole ? displayName : `Dr. ${displayName}`;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="module-container">

      <SetupChecklist />

      {/* ─── COMPACT HERO ─── */}
      <div className="bg-white border border-ink-200 rounded-2xl mb-5 shadow-sm overflow-hidden">
        <div className="px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-50 border border-ink-100">
                <Sparkles size={12} className="text-brand-500" />
                <span className="text-[9px] font-black text-ink-600 uppercase tracking-widest">LAUD.IA CORE v{LAUDIA_VERSION}</span>
              </div>
              {selectedClinic && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-100">
                  <Building2 size={11} className="text-brand-500" />
                  <span className="text-[9px] font-black text-brand-700 uppercase tracking-widest">{selectedClinic.name}</span>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight leading-tight">
              {timeGreeting}, <span className="text-brand-600">{greetingName}</span>
            </h1>
            {stats.pending > 0 && (
              <p className="text-xs text-ink-500 mt-1 font-medium">
                <span className="text-amber-600 font-bold">{stats.pending} {stats.pending === 1 ? 'exame aguarda' : 'exames aguardam'}</span> laudo na fila
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setView({ name: 'worklist' })}
              className="h-9 px-4 rounded-xl bg-white text-ink-700 font-bold text-xs uppercase tracking-widest border border-ink-200 hover:bg-ink-50 transition-all flex items-center gap-2 active:scale-95"
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">Worklist</span>
            </button>
            {!isReception && (
              <button
                onClick={() => setShowCreateExamModal(true)}
                className="h-9 px-4 rounded-xl bg-ink-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-ink-800 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
              >
                <FilePlus size={14} />
                <span className="hidden sm:inline">Novo Laudo</span>
              </button>
            )}
          </div>
        </div>

        {/* Mini stat strip */}
        <div className="border-t border-ink-100 grid grid-cols-4 divide-x divide-ink-100">
          {[
            { label: 'Aguardando', value: stats.pending, color: 'text-amber-600', action: () => setView({ name: 'worklist' }) },
            { label: 'Em Andamento', value: stats.inProgress, color: 'text-brand-600', action: () => setView({ name: 'worklist' }) },
            { label: 'Hoje', value: stats.finalizedToday, color: 'text-emerald-600', action: () => setView({ name: 'worklist' }) },
            { label: 'Pacientes', value: patients.length, color: 'text-indigo-600', action: () => setView({ name: 'patients' }) },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="py-3 px-4 text-center hover:bg-ink-50 transition-colors group"
            >
              {examsLoading ? (
                <Skeleton className="h-6 w-10 mx-auto mb-1 rounded-lg" />
              ) : (
                <p className={classNames('text-xl font-black leading-none', item.color)}>{item.value}</p>
              )}
              <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mt-0.5">{item.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── MAIN GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick Weekly Calendar & Day Appointments */}
          <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm space-y-4">
            <WeeklyCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              appointments={appointments}
              clinicId={selectedClinicId || undefined}
            />
            
            <div className="space-y-3 border-t border-ink-100 pt-4">
              <h4 className="text-[10px] font-black text-ink-400 uppercase tracking-widest pl-1">
                Agendamentos do Dia
              </h4>
              {selectedDayAppointments.length === 0 ? (
                <p className="text-xs text-ink-400 text-center py-4 bg-ink-50/20 rounded-xl border border-dashed border-ink-100">
                  Nenhum agendamento para esta data.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDayAppointments.map(app => {
                    const appTime = new Date(app.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={app.id} className="flex items-center justify-between p-3.5 bg-ink-50/50 rounded-xl border border-ink-100 shadow-sm">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink-900 truncate">{app.patientName}</p>
                          <p className="text-[9px] text-ink-500 font-bold uppercase mt-0.5 truncate">
                            {appTime} · {app.examType}
                          </p>
                        </div>
                        <span className={classNames(
                          "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border shrink-0",
                          app.status === 'confirmado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          app.status === 'cancelado' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                          'bg-blue-50 text-blue-700 border-blue-100'
                        )}>
                          {app.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Activity Chart */}
          <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <Activity size={16} />
                </div>
                <div>
                  <h3 className="font-black text-ink-800 text-sm leading-none">Distribuição Semanal</h3>
                  <p className="text-[9px] text-ink-400 font-black uppercase tracking-widest mt-0.5">Últimos 7 dias</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Ao Vivo</span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 h-40 px-1">
              {stats.dailyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group/bar relative">
                  <div className="w-full flex flex-col items-center">
                    <motion.div
                      initial={{ height: 4 }}
                      animate={{ height: Math.max((day.count / (stats.maxDaily || 1)) * 120, 4) }}
                      transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' }}
                      className={classNames(
                        'w-full max-w-[36px] rounded-t-lg transition-colors duration-300 relative cursor-pointer',
                        day.count > 0 ? 'bg-brand-500 group-hover/bar:bg-brand-400' : 'bg-ink-100'
                      )}
                    >
                      {day.count > 0 && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 bg-ink-800 text-white text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap pointer-events-none">
                          {day.count} {day.count === 1 ? 'exame' : 'exames'}
                        </div>
                      )}
                    </motion.div>
                  </div>
                  <span className="text-[9px] text-ink-400 font-bold tracking-widest">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Exams */}
          <div className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <LayoutList size={16} />
                </div>
                <div>
                  <h3 className="font-black text-ink-900 text-sm leading-none">Atividade Recente</h3>
                  <p className="text-[9px] text-ink-400 font-black uppercase tracking-widest mt-0.5">Últimos laudos</p>
                </div>
              </div>
              <button
                onClick={() => setView({ name: 'worklist' })}
                className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors group"
              >
                Worklist
                <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="divide-y divide-ink-50">
              {recentExams.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText size={24} className="mx-auto text-ink-200 mb-3" />
                  <p className="text-ink-400 font-bold text-sm">Nenhum exame recente.</p>
                </div>
              ) : (
                recentExams.map(exam => {
                  const patient = patientMap.get(exam.patientId);
                  const area = EXAM_AREAS.find(a => a.id === exam.area);
                  const genderColor = patient?.gender === 'F'
                    ? 'bg-pink-50 text-pink-700 border-pink-100'
                    : patient?.gender === 'M'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-brand-50 text-brand-700 border-brand-100';

                  return (
                    <button
                      key={exam.id}
                      onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                      className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-ink-50/40 transition-all text-left group"
                    >
                      <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border', genderColor)}>
                        {patient?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-ink-900 truncate text-sm group-hover:text-brand-600 transition-colors">{patient?.name || 'Paciente'}</h4>
                          {area && <span className={classNames('text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter border shrink-0', area.color)}>{area.label}</span>}
                        </div>
                        <p className="text-xs text-ink-500 flex items-center gap-1.5 truncate">
                          <AreaIcon area={exam.area} size={11} className="text-ink-400 shrink-0" />
                          {exam.examType}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className={classNames(
                          'text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest border',
                          exam.status === 'finalizado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          exam.status === 'em-andamento' ? 'bg-brand-50 text-brand-700 border-brand-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        )}>
                          {STATUS_LABELS[exam.status] ?? exam.status}
                        </span>
                        <p className="text-[9px] text-ink-400 font-bold">
                          {exam.status === 'finalizado' && exam.finalizedAt
                            ? formatDateTime(exam.finalizedAt)
                            : formatDateTime(exam.updatedAt || exam.createdAt)
                          }
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {!showAllRecent && filteredExams.length > 5 && (
              <div className="px-5 py-3 border-t border-ink-100 text-center">
                <button
                  onClick={() => setShowAllRecent(true)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-colors"
                >
                  Ver mais antigos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col) */}
        <div className="space-y-5">

          {/* Specialty Distribution */}
          <div className="bg-white rounded-2xl border border-ink-200 p-5 shadow-sm">
            <h3 className="font-black text-ink-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
              <TrendingUp size={13} className="text-brand-500" />
              Por Especialidade
            </h3>
            <div className="space-y-3.5">
              {EXAM_AREAS.map(area => {
                const count = stats.areaMap.get(area.id) || 0;
                if (count === 0 && stats.total > 0) return null;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={area.id} className="group">
                    <div className="flex items-center justify-between text-[10px] mb-1.5">
                      <span className="font-bold text-ink-700 flex items-center gap-1.5 group-hover:text-brand-600 transition-colors">
                        <AreaIcon area={area.id} size={11} className="text-ink-400" />
                        {area.label}
                      </span>
                      <span className="text-ink-400 font-bold">{count}</span>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className={classNames('h-full rounded-full transition-all duration-1000 ease-out', area.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {stats.total === 0 && (
                <p className="text-xs text-ink-400 text-center py-4">Nenhum exame registrado.</p>
              )}
            </div>
          </div>

          {/* Productivity */}
          <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <BarChart2 size={15} />
              </div>
              <div>
                <h4 className="font-black text-ink-800 text-sm leading-none">Produtividade</h4>
                <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">Mês atual</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 col-span-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Timer size={10} className="text-emerald-500" />
                  <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">Tempo Médio</p>
                </div>
                {stats.avgCompletionMinutes === null ? (
                  <p className="text-sm font-bold text-emerald-800">— min</p>
                ) : stats.avgCompletionMinutes < 60 ? (
                  <p className="text-lg font-black text-emerald-800">{Math.round(stats.avgCompletionMinutes)} min</p>
                ) : (
                  <p className="text-lg font-black text-emerald-800">
                    {Math.floor(stats.avgCompletionMinutes / 60)}h {Math.round(stats.avgCompletionMinutes % 60)}min
                  </p>
                )}
              </div>
              <div className="bg-ink-50 rounded-xl p-3 border border-ink-100">
                <p className="text-[9px] text-ink-400 font-black uppercase tracking-widest mb-0.5">Taxa Mês</p>
                <p className="text-lg font-black text-ink-800">
                  {stats.monthFinalizedRate}%
                </p>
              </div>
              <div className="bg-ink-50 rounded-xl p-3 border border-ink-100">
                <p className="text-[9px] text-ink-400 font-black uppercase tracking-widest mb-0.5">Sem. Ant.</p>
                <p className="text-lg font-black text-ink-800">{stats.prevWeekCount}</p>
                <p className="text-[8px] mt-0.5">
                  {stats.week >= stats.prevWeekCount
                    ? <span className="text-emerald-600 font-bold">↑ {stats.week} esta sem.</span>
                    : <span className="text-rose-500 font-bold">↓ {stats.week} esta sem.</span>
                  }
                </p>
              </div>
            </div>
          </div>

          {/* LAUD.IA — Quota + Financeiro + Seletor de Motor */}
          <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 border border-violet-100">
                <BrainCircuit size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-ink-800 text-sm leading-none">LAUD.IA</h4>
                <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">Uso &amp; custo mensal</p>
              </div>
              <button
                onClick={() => setView({ name: 'settings', activeTab: 'assinatura' } as any)}
                className="text-[9px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-colors shrink-0"
              >
                Detalhes
              </button>
            </div>

            {subscription.loading ? (
              <div className="flex items-center gap-2 text-ink-400 py-1">
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs font-medium">Carregando...</span>
              </div>
            ) : (
              <>
                {/* Quota bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-ink-700">
                      {subscription.reportsUsed} / {subscription.reportsQuota === 9999 ? '∞' : subscription.reportsQuota} laudos
                    </span>
                    <span className={classNames(
                      'text-[9px] font-black px-1.5 py-0.5 rounded-lg border',
                      subscription.reportsQuota === 9999 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      !subscription.canGenerateReport ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      subscription.reportsUsed / subscription.reportsQuota > 0.8 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border-emerald-100'
                    )}>
                      {subscription.reportsQuota === 9999 ? 'Ilimitado' :
                       !subscription.canGenerateReport ? 'Esgotado' :
                       `${subscription.reportsRemaining} restam`}
                    </span>
                  </div>
                  {subscription.reportsQuota !== 9999 && (
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className={classNames(
                        'h-full rounded-full transition-all duration-700',
                        !subscription.canGenerateReport ? 'bg-rose-500' :
                        subscription.reportsUsed / subscription.reportsQuota > 0.8 ? 'bg-amber-500' :
                        'bg-brand-500'
                      )} style={{ width: `${Math.min(100, (subscription.reportsUsed / subscription.reportsQuota) * 100)}%` }} />
                    </div>
                  )}
                </div>

                {/* Seletor de Motor */}
                <div>
                  <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-1.5">Motor ativo</p>
                  <div className="flex gap-1 p-1 bg-ink-100 border border-ink-200 rounded-xl">
                    {(['lite', 'pro'] as const).map((tier) => {
                      const isActive = (settings.selectedMotor || 'lite') === tier;
                      const isPro = tier === 'pro';
                      const blocked = isPro && !subscription.motorProEnabled;
                      return (
                        <button
                          key={tier}
                          disabled={blocked}
                          onClick={() => {
                            if (!blocked) updateSettings({ ...settings, selectedMotor: tier });
                          }}
                          className={classNames(
                            'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                            blocked ? 'text-ink-300 cursor-not-allowed' :
                            isActive && !isPro ? 'bg-indigo-600 text-white shadow-sm' :
                            isActive && isPro ? 'bg-violet-600 text-white shadow-sm' :
                            'text-ink-500 hover:text-ink-700 hover:bg-white/70'
                          )}
                        >
                          {isPro ? <Sparkles size={10} /> : <Zap size={10} />}
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                          {blocked && <Lock size={9} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Laudos por Motor (Lite / Pro) — sem custo, apenas contagem.
                    O total vem de `subscription.reportsUsed` (o mesmo contador
                    oficial de todo o resto do app); o ai_usage (aiStats, janela
                    de mês calendário) só fornece a PROPORÇÃO Lite/Pro, nunca o
                    total — evita esta tela mostrar um número diferente do
                    badge do editor/SubscriptionCenter/Admin para a mesma conta. */}
                {aiStats === null ? (
                  <div className="flex items-center gap-2 text-ink-400 py-1">
                    <Loader2 size={11} className="animate-spin" />
                    <span className="text-[10px]">Carregando...</span>
                  </div>
                ) : (() => {
                  const proShare = aiStats.totalCalls > 0 ? aiStats.proCount / aiStats.totalCalls : 0;
                  const proUsed  = Math.round(subscription.reportsUsed * proShare);
                  const liteUsed = subscription.reportsUsed - proUsed;
                  return (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Laudos gerados este mês</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-indigo-50 rounded-xl p-2.5 border border-indigo-100">
                        <div className="flex items-center gap-1 mb-1">
                          <Zap size={9} className="text-indigo-500" />
                          <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Lite</span>
                        </div>
                        <span className="text-sm font-black text-indigo-800">
                          {liteUsed} laudos
                        </span>
                      </div>
                      <div className={classNames(
                        'rounded-xl p-2.5 border',
                        subscription.motorProEnabled ? 'bg-violet-50 border-violet-100' : 'bg-ink-50 border-ink-100 opacity-60'
                      )}>
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles size={9} className={subscription.motorProEnabled ? 'text-violet-500' : 'text-ink-400'} />
                          <span className={classNames('text-[8px] font-black uppercase tracking-widest', subscription.motorProEnabled ? 'text-violet-600' : 'text-ink-400')}>Pro</span>
                        </div>
                        <span className={classNames('text-sm font-black', subscription.motorProEnabled ? 'text-violet-800' : 'text-ink-400')}>
                          {proUsed} laudos
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-ink-100">
                      <span className="text-[9px] font-black text-ink-500 uppercase tracking-widest">Total este mês</span>
                      <span className="text-sm font-black text-ink-800">{subscription.reportsUsed} laudos</span>
                    </div>
                  </div>
                  );
                })()}

                {/* Quota esgotada */}
                {!subscription.canGenerateReport && subscription.reportsQuota !== 9999 && (
                  <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-semibold flex items-start gap-2">
                    <Lock size={11} className="mt-0.5 shrink-0 text-rose-500" />
                    <span>Geração de IA bloqueada. Aguarde o reset mensal ou contate o suporte.</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Account Summary */}
          <div className="bg-white border border-ink-200 rounded-2xl p-5 shadow-sm">
            <h4 className="font-black text-ink-800 text-xs uppercase tracking-widest mb-3">Resumo da Conta</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-ink-50 rounded-xl p-3 border border-ink-100">
                <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mb-0.5">Total</p>
                <p className="text-lg font-black text-ink-800">{exams.length}</p>
              </div>
              <div className="bg-ink-50 rounded-xl p-3 border border-ink-100">
                <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mb-0.5">Clínicas</p>
                <p className="text-lg font-black text-ink-800">{clinics.length}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

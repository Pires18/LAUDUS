import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EXAM_AREAS, ExamStatus, ExamRequest, Patient, Clinic } from '../../types';
import { deleteItem } from '../../store/db';
import { formatDateTime, classNames } from '../../utils/format';
import { useState, useMemo } from 'react';
import { where } from 'firebase/firestore';
import {
  CircleDot, CheckCircle2, Clock, Search, FilePlus2, Trash2,
  LayoutList, Building2, Filter, Calendar, SlidersHorizontal, ArrowRight
} from 'lucide-react';
import { Skeleton } from '../../components/PageTransition';
import type { LucideIcon } from 'lucide-react';

const STATUS_META: Record<ExamStatus, { label: string; icon: LucideIcon; class: string }> = {
  'pendente': { label: 'Pendente', icon: Clock, class: 'bg-amber-50 text-amber-700' },
  'em-andamento': { label: 'Em Andamento', icon: CircleDot, class: 'bg-brand-50 text-brand-700' },
  'finalizado': { label: 'Finalizado', icon: CheckCircle2, class: 'bg-emerald-50 text-emerald-700' },
};

export function Worklist() {
  const { setView, showToast, selectedClinicId } = useApp();
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'todos'>('todos');
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('todos');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Realtime listeners
  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');

  // Build lookup maps
  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );
  const clinicMap = useMemo(
    () => new Map(clinics.map((c) => [c.id, c])),
    [clinics]
  );

  // Sort by createdAt descending
  const sortedExams = useMemo(
    () => [...exams].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [exams]
  );

  // Apply filters
  const filtered = sortedExams.filter((e) => {
    // Clinic filter
    if (selectedClinicId && e.clinicId !== selectedClinicId) return false;
    // Status filter
    if (statusFilter !== 'todos' && e.status !== statusFilter) return false;
    // Area filter
    if (areaFilter !== 'todas' && e.area !== areaFilter) return false;
    // Date filter
    if (dateFilter !== 'todos') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (dateFilter === 'hoje' && e.createdAt < todayStart) return false;
      if (dateFilter === 'semana' && e.createdAt < todayStart - 7 * 86400000) return false;
      if (dateFilter === 'mes' && e.createdAt < todayStart - 30 * 86400000) return false;
    }
    // Search
    if (search) {
      const q = search.toLowerCase();
      const patient = patientMap.get(e.patientId);
      return (
        patient?.name.toLowerCase().includes(q) ||
        e.examType.toLowerCase().includes(q) ||
        e.requestingPhysician?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    todos: sortedExams.filter((e) => !selectedClinicId || e.clinicId === selectedClinicId).length,
    pendente: sortedExams.filter((e) => e.status === 'pendente' && (!selectedClinicId || e.clinicId === selectedClinicId)).length,
    'em-andamento': sortedExams.filter((e) => e.status === 'em-andamento' && (!selectedClinicId || e.clinicId === selectedClinicId)).length,
    finalizado: sortedExams.filter((e) => e.status === 'finalizado' && (!selectedClinicId || e.clinicId === selectedClinicId)).length,
  };

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteItem('exams', deleteId);
      showToast('Exame excluído', 'success');
    } catch {
      showToast('Erro ao excluir exame', 'error');
    } finally {
      setDeleteId(null);
    }
  }

  // Find the selected clinic name for display
  const selectedClinic = selectedClinicId ? clinicMap.get(selectedClinicId) : null;

  return (
    <div>
      <PageHeader
        title="Worklist"
        subtitle={
          selectedClinic
            ? `Exames — ${selectedClinic.name}`
            : 'Lista de exames e laudos'
        }
        actions={
          <button className="btn-primary" onClick={() => setView({ name: 'new-exam' })}>
            <FilePlus2 size={16} /> Novo Laudo
          </button>
        }
      />

      {/* Clinic filter indicator */}
      {selectedClinic && (
        <div className="mb-3 flex items-center gap-2 text-xs bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
          <Building2 size={13} className="text-brand-600" />
          <span className="text-brand-700 font-medium">Filtrando: {selectedClinic.name}</span>
          <button
            onClick={() => {
              const { setSelectedClinic } = useApp.getState();
              setSelectedClinic(null);
            }}
            className="ml-auto text-brand-600 hover:text-brand-800 font-medium"
          >
            Limpar filtro ×
          </button>
        </div>
      )}

      <div className="card mb-4 p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente, tipo de exame, médico..."
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={classNames(
              'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors',
              showFilters || areaFilter !== 'todas' || dateFilter !== 'todos'
                ? 'bg-brand-50 text-brand-700 border-brand-200'
                : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'
            )}
          >
            <SlidersHorizontal size={14} /> Filtros
            {(areaFilter !== 'todas' || dateFilter !== 'todos') && (
              <span className="w-2 h-2 rounded-full bg-brand-500" />
            )}
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1">
          {(['todos', 'pendente', 'em-andamento', 'finalizado'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={classNames(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                statusFilter === s
                  ? 'bg-ink-900 text-white shadow-soft'
                  : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
              )}
            >
              {s === 'todos' ? 'Todos' : STATUS_META[s].label}
              <span className={classNames('ml-1.5', statusFilter === s ? 'opacity-80' : 'opacity-50')}>
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-ink-100 animate-in slide-in-from-top-1 duration-200">
            <div>
              <label className="text-[10px] font-bold uppercase text-ink-400 block mb-1">Área</label>
              <select className="input text-xs py-1.5 w-44" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
                <option value="todas">Todas as áreas</option>
                {EXAM_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-ink-400 block mb-1">Período</label>
              <select className="input text-xs py-1.5 w-36" value={dateFilter} onChange={e => setDateFilter(e.target.value as any)}>
                <option value="todos">Todos</option>
                <option value="hoje">Hoje</option>
                <option value="semana">Última semana</option>
                <option value="mes">Último mês</option>
              </select>
            </div>
            {(areaFilter !== 'todas' || dateFilter !== 'todos') && (
              <div className="flex items-end">
                <button
                  onClick={() => { setAreaFilter('todas'); setDateFilter('todos'); }}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium py-1.5"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Result counter */}
        <div className="text-[11px] text-ink-400 font-medium">
          {filtered.length} exame{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="card overflow-hidden">
        {examsLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-ink-50 flex items-center justify-center mx-auto mb-4">
              <LayoutList size={28} className="text-ink-300" />
            </div>
            <p className="text-sm text-ink-600 font-medium mb-1">
              {exams.length === 0 ? 'Nenhum exame ainda' : 'Nenhum resultado'}
            </p>
            <p className="text-xs text-ink-400 mb-4">
              {exams.length === 0
                ? 'Comece criando seu primeiro laudo ultrassonográfico.'
                : 'Tente ajustar os filtros ou termo de busca.'}
            </p>
            {exams.length === 0 && (
              <button className="btn-primary" onClick={() => setView({ name: 'new-exam' })}>
                <FilePlus2 size={15} /> Criar Primeiro Laudo
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="text-left px-4 py-3 font-medium">Paciente</th>
                    <th className="text-left px-4 py-3 font-medium">Exame</th>
                    <th className="text-left px-4 py-3 font-medium">Área</th>
                    <th className="text-left px-4 py-3 font-medium">Clínica</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Atualizado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exam) => {
                    const area = EXAM_AREAS.find((a) => a.id === exam.area);
                    const patient = patientMap.get(exam.patientId);
                    const clinic = exam.clinicId ? clinicMap.get(exam.clinicId) : null;
                    const StatusIcon = STATUS_META[exam.status].icon;
                    return (
                      <tr
                        key={exam.id}
                        onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                        className="border-b border-ink-50 hover:bg-ink-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink-900">{patient?.name ?? '—'}</div>
                          {exam.requestingPhysician && (
                            <div className="text-xs text-ink-500">Solic.: {exam.requestingPhysician}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-700">{exam.examType}</td>
                        <td className="px-4 py-3">
                          {area && <span className={classNames('chip', area.color)}>{area.label}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {clinic ? (
                            <span className="text-xs text-ink-600 flex items-center gap-1">
                              <Building2 size={11} className="text-ink-400" />
                              {clinic.name}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={classNames('chip', STATUS_META[exam.status].class)}>
                            <StatusIcon size={12} />
                            {STATUS_META[exam.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-500 text-xs">{formatDateTime(exam.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(exam.id); }}
                            className="text-ink-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-ink-50">
              {filtered.map((exam) => {
                const area = EXAM_AREAS.find((a) => a.id === exam.area);
                const patient = patientMap.get(exam.patientId);
                const clinic = exam.clinicId ? clinicMap.get(exam.clinicId) : null;
                const StatusIcon = STATUS_META[exam.status].icon;
                
                return (
                  <div
                    key={exam.id}
                    onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                    className="p-5 active:bg-ink-50 transition-colors relative group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-0.5">
                          {area?.label || 'Exame'}
                        </div>
                        <div className="font-black text-ink-900 text-base truncate leading-tight">
                          {patient?.name ?? '—'}
                        </div>
                        <div className="text-sm text-ink-500 truncate mt-0.5">{exam.examType}</div>
                      </div>
                      <div className={classNames(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm',
                        STATUS_META[exam.status].class
                      )}>
                        <StatusIcon size={12} strokeWidth={3} />
                        {STATUS_META[exam.status].label}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-4">
                      {clinic && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-500 font-medium">
                          <Building2 size={14} className="text-ink-400" />
                          <span className="truncate max-w-[150px]">{clinic.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-ink-400 font-medium">
                        <Calendar size={14} />
                        {formatDateTime(exam.updatedAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-ink-50/50">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(exam.id); }}
                        className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-red-600 transition-colors py-1"
                      >
                        <Trash2 size={14} />
                        <span>Excluir</span>
                      </button>
                      
                      <div className="flex items-center gap-1 text-brand-600 font-black text-xs uppercase tracking-widest bg-brand-50 px-3 py-1.5 rounded-lg group-active:bg-brand-100 transition-colors">
                        Editar Laudo <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        title="Excluir exame"
        message="Tem certeza que deseja excluir este exame? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
}

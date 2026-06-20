import { useApp } from '../../store/app';
import { useCollection, orderBy, where } from '../../hooks/useFirestore';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EXAM_AREAS, ExamStatus, ExamRequest, Patient, Clinic } from '../../types';
import { deleteItem, addAuditLog, deleteWorklistEntry, updateItem } from '../../store/db';
import { formatDateTime, classNames } from '../../utils/format';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CircleDot, CheckCircle2, Clock, Search, FilePlus, Trash2, FileText,
  LayoutList, Building2, SlidersHorizontal, UserCog, Loader2, X,
  ChevronRight, RefreshCw, ChevronDown
} from 'lucide-react';
import { Skeleton } from '../../components/SkeletonLoader';
import { AreaIcon } from '../../components/AreaIcon';
import { syncExamToOrthancWorklist } from '../../utils/dicom';
import { logger } from '../../utils/logger';
import type { LucideIcon } from 'lucide-react';

const STATUS_META: Record<ExamStatus, { label: string; icon: LucideIcon; class: string; dot: string }> = {
  'pendente':      { label: 'Aguardando',   icon: Clock,        class: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  'em-andamento':  { label: 'Em Andamento', icon: CircleDot,    class: 'bg-brand-50 text-brand-700 border-brand-200',   dot: 'bg-brand-500 animate-pulse' },
  'finalizado':    { label: 'Finalizado',   icon: CheckCircle2, class: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

export function Worklist() {
  const { 
    setView, showToast, selectedClinicId, setShowCreateExamModal, settings,
    worklistStatusFilter: statusFilter, setWorklistStatusFilter: setStatusFilter,
    worklistAreaFilter: areaFilter, setWorklistAreaFilter: setAreaFilter,
    worklistDateFilter: dateFilter, setWorklistDateFilter: setDateFilter,
    worklistSearch: search, setWorklistSearch: setSearch
  } = useApp();
  
  const PAGE_SIZE = 50;
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAreaFilter, setShowAreaFilter] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    requestingPhysician: '',
    clinicalIndication: '',
    clinicId: '',
    status: 'pendente' as ExamStatus
  });
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);

  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams', {
    constraints: [
      ...(selectedClinicId ? [where('clinicId', '==', selectedClinicId)] : []),
      orderBy('createdAt', 'desc')
    ]
  });

  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  // Sound notification for new exams
  const prevExamIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (examsLoading) return;
    const currentIds = exams.map(e => e.id);
    if (prevExamIdsRef.current.length === 0) {
      prevExamIdsRef.current = currentIds;
      return;
    }
    const newExams = exams.filter(e => !prevExamIdsRef.current.includes(e.id));
    if (newExams.length > 0) {
      const hasNewPendente = newExams.some(e => e.status === 'pendente');
      if (hasNewPendente && settings.soundNotifications !== false) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1); gain1.connect(ctx.destination);
            osc1.frequency.value = 523.25; osc1.type = 'sine';
            gain1.gain.setValueAtTime(0, ctx.currentTime);
            gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.3);
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.frequency.value = 659.25; osc2.type = 'sine';
            gain2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
            gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.17);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.52);
            osc2.start(ctx.currentTime + 0.12); osc2.stop(ctx.currentTime + 0.52);
          }
        } catch (err) {
          logger.warn('[Worklist Sound] Falha ao sintetizar áudio:', err);
        }
      }
    }
    prevExamIdsRef.current = currentIds;
  }, [exams, examsLoading, settings.soundNotifications]);

  const filteredWithoutStatus = useMemo(() => {
    let result = [...exams];
    if (selectedClinicId) result = result.filter(e => e.clinicId === selectedClinicId);
    if (areaFilter !== 'todas') result = result.filter(e => e.area === areaFilter);
    if (dateFilter !== 'todos') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (dateFilter === 'hoje') result = result.filter(e => e.createdAt >= todayStart);
      if (dateFilter === 'semana') result = result.filter(e => e.createdAt >= todayStart - 7 * 86400000);
      if (dateFilter === 'mes') result = result.filter(e => e.createdAt >= todayStart - 30 * 86400000);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => {
        const patient = patientMap.get(e.patientId);
        return (
          patient?.name.toLowerCase().includes(q) ||
          e.examType.toLowerCase().includes(q) ||
          e.friendlyId?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [exams, areaFilter, dateFilter, search, selectedClinicId, patientMap]);

  const filtered = useMemo(() => {
    let result = filteredWithoutStatus;
    if (statusFilter !== 'todos') result = result.filter(e => e.status === statusFilter);
    return result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [filteredWithoutStatus, statusFilter]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [statusFilter, areaFilter, dateFilter, search, selectedClinicId]);

  const visibleExams = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleCount;

  const counts = {
    todos:         filteredWithoutStatus.length,
    pendente:      filteredWithoutStatus.filter(e => e.status === 'pendente').length,
    'em-andamento': filteredWithoutStatus.filter(e => e.status === 'em-andamento').length,
    finalizado:    filteredWithoutStatus.filter(e => e.status === 'finalizado').length,
  };

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const examToDelete = exams.find(e => e.id === deleteId);
      await deleteWorklistEntry(deleteId, settings);
      await deleteItem('exams', deleteId);
      await addAuditLog({
        action: 'EXCLUIR_EXAME',
        details: `Exame ${examToDelete?.examType} do paciente ID ${examToDelete?.patientId} foi excluído.`,
        module: 'Worklist'
      });
      showToast('Exame excluído com sucesso', 'success');
    } catch {
      showToast('Erro ao excluir exame', 'error');
    } finally {
      setDeleteId(null);
    }
  }

  async function handleSyncOrthanc(exam: ExamRequest, patientName: string, patientBirthDate?: string, patientSex?: 'M' | 'F' | 'O') {
    if (syncingExamId) return;
    try {
      setSyncingExamId(exam.id);
      const { success, backupSuccess, error } = await syncExamToOrthancWorklist(
        exam.id, exam.examType,
        { id: exam.patientId, name: patientName, birthDate: patientBirthDate, gender: patientSex },
        settings
      );
      if (success && backupSuccess !== false) {
        showToast('Enviado para a Worklist do Orthanc' + (settings.dicomBackupSyncEnabled ? ' e Backup!' : '!'), 'success');
      } else if (success && backupSuccess === false) {
        showToast('Enviado para o principal, mas falhou no backup.', 'error');
      } else {
        showToast('Erro ao sincronizar: ' + (error || 'Desconhecido'), 'error');
      }
    } catch {
      showToast('Erro de conexão ao tentar sincronizar', 'error');
    } finally {
      setSyncingExamId(null);
    }
  }

  async function handleSaveMetadata() {
    if (!editExamId) return;
    try {
      setLoadingMetadata(true);
      await updateItem('exams', editExamId, {
        requestingPhysician: editData.requestingPhysician,
        clinicalIndication: editData.clinicalIndication,
        clinicId: editData.clinicId,
        status: editData.status as ExamStatus,
        finalizedAt: editData.status === 'finalizado' ? Date.now() : null
      });
      if (editData.status === 'finalizado') {
        deleteWorklistEntry(editExamId, settings).catch(err => {
          logger.warn('[Worklist] Falha silenciosa ao remover worklist do PACS após edição de status:', err);
        });
      }
      setEditExamId(null);
      showToast('Dados de exame atualizados com sucesso!', 'success');
    } catch {
      showToast('Erro ao atualizar dados do exame', 'error');
    } finally {
      setLoadingMetadata(false);
    }
  }

  return (
    <div className="module-container">

      {/* ─── COMPACT HEADER ─── */}
      <div className="relative mb-5 rounded-2xl overflow-hidden border border-ink-200 shadow-sm bg-white">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 flex items-center justify-center shadow-sm shrink-0">
              <LayoutList size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Fila de Exames</h1>
              <p className="text-[11px] text-ink-500 font-medium mt-0.5 truncate">
                {counts.todos} exame{counts.todos !== 1 ? 's' : ''}
                {counts.pendente > 0 && (
                  <span className="ml-1.5 text-amber-600 font-bold">· {counts.pendente} aguardando</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateExamModal(true)}
            className="h-9 px-4 rounded-xl bg-ink-900 hover:bg-ink-800 text-white font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 active:scale-95"
          >
            <FilePlus size={14} />
            <span className="hidden sm:inline">Novo Laudo</span>
          </button>
        </div>
      </div>

      {/* ─── STATUS FILTER + SEARCH BAR em linha ─── */}
      <div className="bg-white border border-ink-200 rounded-2xl shadow-sm mb-4 overflow-hidden">
        {/* Status pills */}
        <div className="px-4 pt-4 flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-ink-100">
          {(['todos', 'pendente', 'em-andamento', 'finalizado'] as const).map(s => {
            const isActive = statusFilter === s;
            const activeColors: Record<string, string> = {
              todos: 'bg-ink-900 text-white border-ink-900',
              pendente: 'bg-amber-500 text-white border-amber-500',
              'em-andamento': 'bg-brand-600 text-white border-brand-600',
              finalizado: 'bg-emerald-600 text-white border-emerald-600',
            };
            const inactiveColors: Record<string, string> = {
              todos: 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
              pendente: counts.pendente > 5
                ? 'bg-amber-50 text-amber-800 border-amber-200 animate-[pulse_3s_ease-in-out_infinite]'
                : 'bg-white text-ink-600 border-ink-200 hover:border-amber-300',
              'em-andamento': 'bg-white text-ink-600 border-ink-200 hover:border-brand-300',
              finalizado: 'bg-white text-ink-600 border-ink-200 hover:border-emerald-300',
            };

            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={classNames(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[11px] font-black transition-all whitespace-nowrap flex-shrink-0',
                  isActive ? activeColors[s] : inactiveColors[s]
                )}
              >
                {s === 'todos' ? <LayoutList size={12} /> : s === 'finalizado' ? <CheckCircle2 size={12} /> : s === 'em-andamento' ? <CircleDot size={12} /> : <Clock size={12} />}
                <span>{s === 'todos' ? 'Todos' : STATUS_META[s as ExamStatus].label}</span>
                <span className={classNames(
                  'px-1.5 py-0.5 rounded-md text-[9px] font-black',
                  isActive ? 'bg-white/20' : 'bg-ink-100 text-ink-500'
                )}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Date + Area toggle */}
        <div className="px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente, exame ou ID..."
              className="w-full h-9 pl-9 pr-3 bg-ink-50 border border-ink-200 focus:border-brand-400 rounded-xl focus:ring-2 focus:ring-brand-400/10 outline-none transition-all text-sm text-ink-800 placeholder-ink-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date pills */}
          <div className="flex gap-1 p-0.5 bg-ink-100 rounded-xl shrink-0">
            {(['hoje', 'semana', 'mes', 'todos'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={classNames(
                  'px-3 py-1.5 rounded-lg text-[10px] font-black transition-all whitespace-nowrap',
                  dateFilter === d ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                )}
              >
                {d === 'todos' ? 'Histórico' : d === 'hoje' ? 'Hoje' : d === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          {/* Area filter toggle */}
          <button
            onClick={() => setShowAreaFilter(!showAreaFilter)}
            className={classNames(
              'h-9 px-3 rounded-xl border flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shrink-0',
              showAreaFilter || areaFilter !== 'todas'
                ? 'bg-brand-50 border-brand-200 text-brand-600'
                : 'bg-white border-ink-200 text-ink-500 hover:bg-ink-50'
            )}
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Área</span>
            {areaFilter !== 'todas' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
            <ChevronDown size={11} className={classNames('transition-transform', showAreaFilter ? 'rotate-180' : '')} />
          </button>
        </div>

        {/* Area filter expandable */}
        {showAreaFilter && (
          <div className="px-4 pb-3 pt-1 border-t border-ink-100 animate-fade-in">
            <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-2">Especialidade</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setAreaFilter('todas')}
                className={classNames(
                  'px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border',
                  areaFilter === 'todas'
                    ? 'bg-ink-900 border-ink-900 text-white'
                    : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                )}
              >
                Todas
              </button>
              {EXAM_AREAS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setAreaFilter(a.id)}
                  className={classNames(
                    'px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border flex items-center gap-1.5',
                    areaFilter === a.id
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                  )}
                >
                  <AreaIcon area={a.id} size={12} className={areaFilter === a.id ? 'text-white' : 'text-ink-400'} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── TABLE ─── */}
      <div className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Desktop Table */}
        <table className="hidden md:table w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-ink-50/30 border-b border-ink-100">
              <th className="px-4 xl:px-5 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[22%]">Paciente</th>
              <th className="px-4 xl:px-5 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[22%]">Exame & Área</th>
              <th className="px-4 xl:px-5 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] text-center w-[13%]">Status</th>
              <th className="px-4 xl:px-5 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[14%]">Unidade</th>
              <th className="px-4 xl:px-5 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[13%]">Data</th>
              <th className="px-4 xl:px-5 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] text-right w-[16%]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {examsLoading ? (
              [1, 2, 3, 4].map(i => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 xl:px-5 py-4"><Skeleton className="h-10 w-full rounded-xl" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 xl:px-5 py-20 text-center">
                  <LayoutList size={28} className="mx-auto text-ink-200 mb-3" />
                  <p className="text-sm font-bold text-ink-400">Nenhum exame nos filtros ativos.</p>
                </td>
              </tr>
            ) : (
              visibleExams.map(exam => {
                const patient = exam.patientId === 'ANONIMO'
                  ? { id: 'ANONIMO', name: 'Laudo Avulso / Sem Identificação', gender: 'O' } as Patient
                  : patientMap.get(exam.patientId);
                const clinic = clinicMap.get(exam.clinicId || '');
                const area = EXAM_AREAS.find(a => a.id === exam.area);
                const status = STATUS_META[exam.status];

                return (
                  <tr
                    key={exam.id}
                    className="group hover:bg-ink-50/40 transition-colors cursor-pointer"
                    onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={classNames(
                          'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border',
                          patient?.gender === 'F' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                          patient?.gender === 'M' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          'bg-ink-100 text-ink-700 border-ink-200'
                        )}>
                          {patient?.name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-900 group-hover:text-brand-600 transition-colors truncate max-w-[160px] text-sm">{patient?.name || 'Não identificado'}</p>
                          <p className="text-[9px] font-mono text-ink-400 mt-0.5">ID: {exam.friendlyId || '—'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-ink-800 text-sm mb-1 truncate max-w-[180px]">{exam.examType}</p>
                      {area && <span className={classNames('text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border shrink-0', area.color)}>{area.label}</span>}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className={classNames('badge shadow-sm border scale-90 lg:scale-100', status.class)}>
                        <div className={classNames('w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full shrink-0', status.dot)} />
                        {status.label}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-ink-600 text-xs font-bold min-w-0">
                        <Building2 className="w-3 h-3 text-ink-400 shrink-0" />
                        <span className="truncate max-w-full">{clinic?.name || 'Geral'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="text-xs font-black text-ink-800 leading-none">{formatDateTime(exam.createdAt).split(' - ')[0]}</p>
                      <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">{formatDateTime(exam.createdAt).split(' - ')[1]}</p>
                    </td>

                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {exam.googleDocUrl && (
                          <a
                            href={exam.googleDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all"
                            title="Abrir no Google Docs"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setEditData({
                              requestingPhysician: exam.requestingPhysician || '',
                              clinicalIndication: exam.clinicalIndication || '',
                              clinicId: exam.clinicId || '',
                              status: exam.status
                            });
                            setEditExamId(exam.id);
                          }}
                          className="p-2 rounded-xl text-ink-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-100 transition-all"
                          title="Ajustar Metadados"
                        >
                          <UserCog className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleSyncOrthanc(exam, patient?.name || '', patient?.birthDate, patient?.gender); }}
                          disabled={syncingExamId === exam.id}
                          className="p-2 rounded-xl text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 disabled:opacity-50 transition-all"
                          title="Enviar para Worklist Orthanc"
                        >
                          {syncingExamId === exam.id ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeleteId(exam.id)}
                          className="p-2 rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="hidden xl:flex w-8 h-8 rounded-xl bg-ink-50 text-ink-400 items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Desktop load more */}
        {hasMore && (
          <div className="hidden md:flex justify-center py-3 border-t border-ink-100">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="h-9 px-5 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-600 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2"
            >
              Ver mais ({filtered.length - visibleCount} restantes)
            </button>
          </div>
        )}

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-ink-50">
          {examsLoading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="p-4"><Skeleton className="h-20 w-full rounded-xl" /></div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <LayoutList size={28} className="mx-auto text-ink-200 mb-3" />
              <p className="text-sm font-bold text-ink-400">Nenhum exame nos filtros ativos.</p>
            </div>
          ) : (
            visibleExams.map(exam => {
              const patient = exam.patientId === 'ANONIMO'
                ? { id: 'ANONIMO', name: 'Laudo Avulso / Sem Identificação', gender: 'O' } as Patient
                : patientMap.get(exam.patientId);
              const clinic = clinicMap.get(exam.clinicId || '');
              const area = EXAM_AREAS.find(a => a.id === exam.area);
              const status = STATUS_META[exam.status];
              const genderHalo = patient?.gender === 'F'
                ? 'ring-2 ring-pink-400/30 bg-pink-50 text-pink-700'
                : patient?.gender === 'M'
                ? 'ring-2 ring-blue-400/30 bg-blue-50 text-blue-700'
                : 'ring-2 ring-brand-400/20 bg-brand-50 text-brand-700';

              return (
                <div
                  key={exam.id}
                  onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                  className="p-4 hover:bg-brand-50/20 transition-all cursor-pointer"
                >
                  {/* Row 1: Patient + Status */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0', genderHalo)}>
                        {patient?.name?.charAt(0) || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-ink-900 truncate text-sm">{patient?.name || 'Não identificado'}</p>
                        <p className="text-[9px] font-mono text-ink-400">ID: {exam.friendlyId || '—'}</p>
                      </div>
                    </div>
                    <div className={classNames('badge shadow-sm border shrink-0', status.class)}>
                      <div className={classNames('w-1 h-1 rounded-full shrink-0', status.dot)} />
                      {status.label}
                    </div>
                  </div>

                  {/* Row 2: Exam + Date */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink-800 truncate text-sm">{exam.examType}</p>
                      {area && <span className={classNames('inline-block text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight border mt-1', area.color)}>{area.label}</span>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-ink-800 text-xs">{formatDateTime(exam.createdAt).split(' - ')[0]}</p>
                      <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-0.5">{formatDateTime(exam.createdAt).split(' - ')[1]}</p>
                    </div>
                  </div>

                  {/* Row 3: Clinic + Actions */}
                  <div className="flex items-center justify-between border-t border-ink-50 pt-2.5 mt-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 text-ink-500 text-xs min-w-0">
                      <Building2 size={11} className="shrink-0" />
                      <span className="truncate max-w-[120px] font-medium">{clinic?.name || 'Geral'}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {exam.googleDocUrl && (
                        <a href={exam.googleDocUrl} target="_blank" rel="noopener noreferrer"
                          className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
                          <FileText size={14} />
                        </a>
                      )}
                      <button onClick={() => { setEditData({ requestingPhysician: exam.requestingPhysician || '', clinicalIndication: exam.clinicalIndication || '', clinicId: exam.clinicId || '', status: exam.status }); setEditExamId(exam.id); }}
                        className="p-2 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <UserCog size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleSyncOrthanc(exam, patient?.name || '', patient?.birthDate, patient?.gender); }}
                        disabled={syncingExamId === exam.id}
                        className="p-2 rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors">
                        {syncingExamId === exam.id ? <Loader2 size={14} className="animate-spin text-emerald-500" /> : <RefreshCw size={14} />}
                      </button>
                      <button onClick={() => setDeleteId(exam.id)}
                        className="p-2 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Mobile load more */}
          {hasMore && (
            <div className="flex justify-center py-3 px-4 border-t border-ink-100">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full h-10 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-600 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                Ver mais ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── METADATA EDIT MODAL ─── */}
      {editExamId && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90dvh] border border-ink-100">
            <div className="px-5 py-4 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
              <h3 className="font-black text-ink-900 text-sm flex items-center gap-2.5">
                <AreaIcon area={exams.find(e => e.id === editExamId)?.area || ''} size={16} className="text-brand-500" />
                Ajustar Informações do Exame
              </h3>
              <button onClick={() => setEditExamId(null)} className="p-1.5 hover:bg-ink-100 rounded-xl text-ink-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[9px] font-black uppercase text-ink-400 mb-1.5 block tracking-widest">Médico Solicitante</label>
                <input
                  className="input h-11"
                  placeholder="Dr(a). ..."
                  value={editData.requestingPhysician}
                  onChange={e => setEditData({ ...editData, requestingPhysician: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-ink-400 mb-1.5 block tracking-widest">Indicação Clínica</label>
                <textarea
                  className="input p-3 text-sm min-h-[80px] resize-none"
                  placeholder="Indicação diagnóstica..."
                  value={editData.clinicalIndication}
                  onChange={e => setEditData({ ...editData, clinicalIndication: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-ink-400 mb-1.5 block tracking-widest">Unidade</label>
                  <select className="input h-10 text-sm" value={editData.clinicId} onChange={e => setEditData({ ...editData, clinicId: e.target.value })}>
                    <option value="">Geral / Sem Unidade</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-ink-400 mb-1.5 block tracking-widest">Estado</label>
                  <select className="input h-10 text-sm" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value as ExamStatus })}>
                    <option value="pendente">Aguardando</option>
                    <option value="em-andamento">Em Andamento</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-ink-100 flex justify-end gap-2 bg-ink-50/30">
              <button className="h-9 px-4 rounded-xl text-ink-500 font-bold text-xs uppercase tracking-widest hover:bg-ink-100 transition-all" onClick={() => setEditExamId(null)}>
                Cancelar
              </button>
              <button
                className="h-9 px-5 rounded-xl bg-brand-600 text-white font-black text-xs uppercase tracking-widest hover:bg-brand-500 transition-all flex items-center gap-2 shadow-sm"
                onClick={handleSaveMetadata}
                disabled={loadingMetadata}
              >
                {loadingMetadata ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        title="Excluir Registro de Exame"
        message="Deseja realmente excluir este exame do histórico? Esta operação expurgará permanentemente o relatório clínico."
        confirmLabel="Sim, Excluir"
        variant="danger"
      />
    </div>
  );
}

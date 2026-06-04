import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EXAM_AREAS, ExamStatus, ExamRequest, Patient, Clinic } from '../../types';
import { deleteItem, addAuditLog, deleteWorklistEntry, updateItem } from '../../store/db';
import { formatDateTime, classNames } from '../../utils/format';
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CircleDot, CheckCircle2, Clock, Search, FilePlus, Trash2, FileText,
  LayoutList, Building2, SlidersHorizontal, UserCog, Loader2, X,
  ChevronRight, RefreshCw
} from 'lucide-react';
import { Skeleton } from '../../components/SkeletonLoader';
import { AreaIcon } from '../../components/AreaIcon';
import { syncExamToOrthancWorklist } from '../../utils/dicom';
import type { LucideIcon } from 'lucide-react';

const STATUS_META: Record<ExamStatus, { label: string; icon: LucideIcon; class: string; dot: string }> = {
  'pendente': { label: 'Aguardando', icon: Clock, class: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'em-andamento': { label: 'Em Andamento', icon: CircleDot, class: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-500' },
  'finalizado': { label: 'Finalizado', icon: CheckCircle2, class: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

export function Worklist() {
  const { setView, showToast, selectedClinicId, setShowCreateExamModal, settings } = useApp();
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'todos'>(() => {
    return (localStorage.getItem('laudus_worklist_status') as ExamStatus | 'todos') || 'todos';
  });
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoje' | 'semana' | 'mes'>(() => {
    return (localStorage.getItem('laudus_worklist_date_v2') as 'todos' | 'hoje' | 'semana' | 'mes') || 'todos';
  });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    requestingPhysician: '',
    clinicalIndication: '',
    clinicId: '',
    status: 'pendente' as ExamStatus
  });
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);

  // Persist filters
  useEffect(() => {
    localStorage.setItem('laudus_worklist_status', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('laudus_worklist_date_v2', dateFilter);
  }, [dateFilter]);

  // Realtime listeners
  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');

  // Build lookup maps
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  // Notificação sonora de novos exames na Fila
  const prevExamIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (examsLoading) return;
    const currentIds = exams.map(e => e.id);

    // Na primeira carga, apenas armazena os IDs sem tocar o chime
    if (prevExamIdsRef.current.length === 0) {
      prevExamIdsRef.current = currentIds;
      return;
    }

    // Identifica exames recém-adicionados que não estavam na lista anterior
    const newExams = exams.filter(e => !prevExamIdsRef.current.includes(e.id));
    if (newExams.length > 0) {
      const hasNewPendente = newExams.some(e => e.status === 'pendente');
      if (hasNewPendente && settings.soundNotifications !== false) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            
            // Tom 1: C5
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.frequency.value = 523.25;
            osc1.type = 'sine';
            gain1.gain.setValueAtTime(0, ctx.currentTime);
            gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.3);

            // Tom 2: E5
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 659.25;
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
            gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.17);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.52);
            osc2.start(ctx.currentTime + 0.12);
            osc2.stop(ctx.currentTime + 0.52);
          }
        } catch (err) {
          console.warn('[Worklist Sound] Falha ao sintetizar áudio:', err);
        }
      }
    }
    prevExamIdsRef.current = currentIds;
  }, [exams, examsLoading, settings.soundNotifications]);

  // Apply filters (excluding status) to get base counts
  const filteredWithoutStatus = useMemo(() => {
    let result = [...exams];

    // Clinic filter
    if (selectedClinicId) {
      result = result.filter(e => e.clinicId === selectedClinicId);
    }

    // Area filter
    if (areaFilter !== 'todas') {
      result = result.filter(e => e.area === areaFilter);
    }

    // Date filter
    if (dateFilter !== 'todos') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      if (dateFilter === 'hoje') result = result.filter(e => e.createdAt >= todayStart);
      if (dateFilter === 'semana') result = result.filter(e => e.createdAt >= todayStart - 7 * 86400000);
      if (dateFilter === 'mes') result = result.filter(e => e.createdAt >= todayStart - 30 * 86400000);
    }

    // Search
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

  // Final filtered list including status and sorted
  const filtered = useMemo(() => {
    let result = filteredWithoutStatus;

    if (statusFilter !== 'todos') {
      result = result.filter(e => e.status === statusFilter);
    }

    // Sort by createdAt descending (most recent first)
    return result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [filteredWithoutStatus, statusFilter]);

  const counts = {
    todos: filteredWithoutStatus.length,
    pendente: filteredWithoutStatus.filter((e) => e.status === 'pendente').length,
    'em-andamento': filteredWithoutStatus.filter((e) => e.status === 'em-andamento').length,
    finalizado: filteredWithoutStatus.filter((e) => e.status === 'finalizado').length,
  };

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const examToDelete = exams.find(e => e.id === deleteId);

      // Remove o arquivo .wl da Worklist do Orthanc (primário + backup)
      // antes de excluir do Firestore para garantir consistência.
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
        exam.id,
        exam.examType,
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
    } catch (err: any) {
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

      // Se o status foi alterado para finalizado, remove da Worklist do Orthanc
      if (editData.status === 'finalizado') {
        deleteWorklistEntry(editExamId, settings).catch((err) => {
          console.warn('[Worklist] Falha silenciosa ao remover worklist do PACS após edição de status:', err);
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
      {/* Sleek Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 sm:mb-8 bg-white border border-ink-100 p-6 sm:p-8 rounded-3xl shadow-soft">
        <div>
          <h1 className="text-3xl font-black text-ink-900 tracking-tight leading-none">Fila de Exames</h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Gerencie, acompanhe e redija laudos clínicos assistidos por IA em tempo real.</p>
        </div>
        <button 
          onClick={() => setShowCreateExamModal(true)}
          className="h-12 px-6 rounded-xl bg-ink-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-ink-800 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 shadow-soft"
        >
          <FilePlus size={16} /> Novo Laudo IA
        </button>
      </div>

      {/* Stats Quick Filter Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {(['todos', 'pendente', 'em-andamento', 'finalizado'] as const).map(s => {
          const isActive = statusFilter === s;
          const sColors = {
            todos: isActive ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900',
            pendente: isActive 
              ? 'bg-amber-500 border-amber-500 text-white' 
              : counts.pendente > 5 
                ? 'bg-red-50 border-red-200 hover:border-red-400 text-red-900 animate-[pulse_3s_ease-in-out_infinite]' 
                : 'bg-white border-slate-200 hover:border-amber-300 text-slate-900',
            'em-andamento': isActive ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 hover:border-brand-300 text-slate-900',
            finalizado: isActive ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-900',
          };
          const countBadgeColor = isActive ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400';

          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={classNames(
                "p-4 sm:p-5 rounded-2xl border transition-all text-left shadow-sm hover:shadow active:scale-95",
                sColors[s]
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 opacity-80">
                {s === 'todos' ? 'Volume Total' : STATUS_META[s].label}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black tracking-tight">{counts[s]}</span>
                <div className={classNames("w-10 h-10 rounded-xl flex items-center justify-center", countBadgeColor)}>
                  {s === 'todos' ? <LayoutList size={20} /> : s === 'finalizado' ? <CheckCircle2 size={20} /> : s === 'em-andamento' ? <CircleDot size={20} /> : <Clock size={20} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Advanced Clinical Filter Panel */}
      <div className="bg-white border border-ink-100 rounded-3xl p-6 mb-6 shadow-soft">
        <div className="flex flex-col xl:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente, tipo de exame ou ID..."
              className="w-full h-12 pl-12 pr-4 bg-ink-50 border border-ink-100 focus:border-brand-500 rounded-xl focus:ring-2 focus:ring-brand-500/10 outline-none transition-all font-medium text-sm text-ink-800 placeholder-ink-400"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
             <div className="tab-group flex-1 xl:flex-none p-1 bg-ink-100 rounded-xl">
               {(['hoje', 'semana', 'mes', 'todos'] as const).map(d => (
                 <button
                   key={d}
                   onClick={() => setDateFilter(d)}
                   className={classNames(
                     "px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                     dateFilter === d ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-700"
                   )}
                 >
                   {d === 'todos' ? 'Histórico' : d.charAt(0).toUpperCase() + d.slice(1)}
                 </button>
               ))}
             </div>
             
             <button
               onClick={() => setShowFilters(!showFilters)}
               className={classNames(
                 "h-12 w-12 rounded-xl border flex items-center justify-center transition-all shrink-0",
                 showFilters ? "bg-brand-50 border-brand-200 text-brand-600" : "bg-white border-ink-100 text-ink-500 hover:bg-ink-50"
               )}
             >
               <SlidersHorizontal size={18} />
             </button>
          </div>
        </div>

        {/* Expandable Specialty Filter */}
        {showFilters && (
          <div className="pt-4 mt-4 border-t border-ink-50 animate-slide-down">
            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-3 ml-1">Filtrar por Especialidade</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAreaFilter('todas')}
                className={classNames(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all border",
                  areaFilter === 'todas' 
                    ? "bg-ink-900 border-ink-900 text-white" 
                    : "bg-white border-ink-100 text-ink-600 hover:bg-ink-50"
                )}
              >
                Todas as Especialidades
              </button>
              {EXAM_AREAS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setAreaFilter(a.id)}
                  className={classNames(
                    "px-4 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center gap-2",
                    areaFilter === a.id 
                      ? "bg-brand-600 border-brand-600 text-white" 
                      : "bg-white border-ink-100 text-ink-600 hover:bg-ink-50"
                  )}
                >
                  <AreaIcon area={a.id} size={14} className={areaFilter === a.id ? "text-white" : "text-ink-400"} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clean Table Workstation */}
      <div className="bg-white border border-ink-100 rounded-3xl overflow-hidden shadow-soft">
        <div className="w-full overflow-hidden">
          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-ink-50/20 border-b border-ink-100">
                <th className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-[9px] lg:text-[10px] font-black text-ink-400 uppercase tracking-[0.2em] w-[20%]">Paciente</th>
                <th className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-[9px] lg:text-[10px] font-black text-ink-400 uppercase tracking-[0.2em] w-[20%]">Exame & Especialidade</th>
                <th className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-[9px] lg:text-[10px] font-black text-ink-400 uppercase tracking-[0.2em] text-center w-[12%]">Status</th>
                <th className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-[9px] lg:text-[10px] font-black text-ink-400 uppercase tracking-[0.2em] w-[14%]">Unidade</th>
                <th className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-[9px] lg:text-[10px] font-black text-ink-400 uppercase tracking-[0.2em] w-[14%]">Data / Hora</th>
                <th className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-[9px] lg:text-[10px] font-black text-ink-400 uppercase tracking-[0.2em] text-right w-[20%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {examsLoading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 xl:px-6 py-6"><Skeleton className="h-12 w-full rounded-xl" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 xl:px-6 py-24 text-center">
                    <div className="empty-state border-none shadow-none bg-transparent py-0">
                      <div className="empty-state-icon bg-ink-50/50">
                        <LayoutList size={36} />
                      </div>
                      <h3 className="empty-state-title">Sem Exames na Fila</h3>
                      <p className="empty-state-text">Nenhum laudo clínico preenche os critérios dos filtros ativos.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(exam => {
                  const patient = exam.patientId === 'ANONIMO'
                    ? { id: 'ANONIMO', name: 'Laudo Avulso / Sem Identificação', gender: 'O' } as Patient
                    : patientMap.get(exam.patientId);
                  const clinic = clinicMap.get(exam.clinicId || '');
                  const area = EXAM_AREAS.find(a => a.id === exam.area);
                  const status = STATUS_META[exam.status];
                  
                  return (
                    <tr 
                      key={exam.id} 
                      className="group hover:bg-ink-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setView({ name: 'exam-editor', examId: exam.id });
                      }}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={classNames("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border", 
                            patient?.gender === 'F' ? 'bg-pink-50 text-pink-700 border-pink-100' : 
                            patient?.gender === 'M' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                            'bg-slate-100 text-slate-700 border-slate-200'
                          )}>
                            {patient?.name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate max-w-[200px] text-sm">{patient?.name || 'Não identificado'}</p>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {exam.friendlyId || '—'}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-800 text-sm mb-1 truncate max-w-[200px]">{exam.examType}</p>
                        {area && <span className={classNames("text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border shrink-0", area.color)}>{area.label}</span>}
                      </td>
                      
                      <td className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-center">
                         <div className={classNames("badge shadow-sm border scale-90 lg:scale-100", status.class)}>
                           <div className={classNames("w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full shrink-0", status.dot)} />
                           {status.label}
                         </div>
                      </td>
                      
                      <td className="px-2 md:px-3 lg:px-4 xl:px-6 py-5">
                        <div className="flex items-center gap-1.5 lg:gap-2 text-ink-600 text-[10px] lg:text-xs font-bold min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                          <span className="truncate max-w-full">{clinic?.name || 'Geral / Sem Unidade'}</span>
                        </div>
                      </td>
                      
                      <td className="px-2 md:px-3 lg:px-4 xl:px-6 py-5">
                        <p className="text-[10px] lg:text-xs font-black text-ink-800 leading-none">{formatDateTime(exam.createdAt).split(' - ')[0]}</p>
                        <p className="text-[8px] lg:text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-1">{formatDateTime(exam.createdAt).split(' - ')[1]}</p>
                      </td>
                      
                      <td className="px-2 md:px-3 lg:px-4 xl:px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 lg:gap-2">
                             {exam.googleDocUrl && (
                              <a
                                href={exam.googleDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 lg:p-3 rounded-xl lg:rounded-2xl text-blue-500 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all shadow-sm shrink-0 flex items-center justify-center"
                                title="Abrir no Google Docs"
                              >
                                <FileText className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
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
                              className="p-2 lg:p-3 rounded-xl lg:rounded-2xl text-ink-400 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-100 transition-all shadow-sm shrink-0"
                              title="Ajustar Metadados"
                            >
                              <UserCog className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSyncOrthanc(exam, patient?.name || '', patient?.birthDate, patient?.gender);
                              }}
                              disabled={syncingExamId === exam.id}
                              className="p-2 lg:p-3 rounded-xl lg:rounded-2xl text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 disabled:opacity-50 transition-all shadow-sm shrink-0"
                              title="Enviar para Worklist Orthanc"
                            >
                              {syncingExamId === exam.id ? <Loader2 className="w-4 h-4 lg:w-[18px] lg:h-[18px] animate-spin text-emerald-500" /> : <RefreshCw className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />}
                            </button>
                            <button
                              onClick={() => setDeleteId(exam.id)}
                              className="p-2 lg:p-3 rounded-xl lg:rounded-2xl text-ink-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all shadow-sm shrink-0"
                              title="Excluir Registro"
                            >
                              <Trash2 className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                            </button>
                            <div className="hidden xl:flex w-9 h-9 rounded-xl bg-ink-50 text-ink-400 items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
                              <ChevronRight className="w-[18px] h-[18px]" />
                            </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-ink-50">
            {examsLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="p-4"><Skeleton className="h-24 w-full rounded-xl" /></div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="empty-state border-none shadow-none bg-transparent py-0">
                  <div className="empty-state-icon bg-ink-50/50 mx-auto">
                    <LayoutList size={36} />
                  </div>
                  <h3 className="empty-state-title mt-4">Sem Exames na Fila</h3>
                  <p className="empty-state-text text-sm text-ink-400">Nenhum laudo clínico preenche os critérios dos filtros ativos.</p>
                </div>
              </div>
            ) : (
              filtered.map(exam => {
                const patient = exam.patientId === 'ANONIMO'
                  ? { id: 'ANONIMO', name: 'Laudo Avulso / Sem Identificação', gender: 'O' } as Patient
                  : patientMap.get(exam.patientId);
                const clinic = clinicMap.get(exam.clinicId || '');
                const area = EXAM_AREAS.find(a => a.id === exam.area);
                const status = STATUS_META[exam.status];
                const genderHalo = patient?.gender === 'F'
                  ? 'ring-2 ring-pink-400/40 bg-pink-50 text-pink-700'
                  : patient?.gender === 'M'
                  ? 'ring-2 ring-blue-400/40 bg-blue-50 text-blue-700'
                  : 'ring-2 ring-brand-400/20 bg-brand-50 text-brand-700';

                return (
                  <div 
                    key={exam.id}
                    onClick={() => setView({ name: 'exam-editor', examId: exam.id })}
                    className="p-5 hover:bg-brand-50/30 active:bg-brand-50/50 transition-all duration-300 cursor-pointer flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={classNames("w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner shrink-0", genderHalo)}>
                          {patient?.name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-ink-900 truncate text-sm leading-snug">{patient?.name || 'Não identificado'}</p>
                          <p className="text-[9px] font-mono text-ink-400 font-bold uppercase tracking-tight mt-0.5">ID: {exam.friendlyId || '—'}</p>
                        </div>
                      </div>
                      <div className={classNames("badge shadow-sm border shrink-0 scale-90 origin-top-right", status.class)}>
                        <div className={classNames("w-1 h-1 rounded-full shrink-0", status.dot)} />
                        {status.label}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-ink-600 gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-ink-800 truncate text-sm leading-snug">{exam.examType}</p>
                        {area && <span className={classNames("inline-block text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border mt-1.5 shrink-0", area.color)}>{area.label}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-ink-800 leading-none">{formatDateTime(exam.createdAt).split(' - ')[0]}</p>
                        <p className="text-[9px] text-ink-400 font-bold uppercase tracking-widest mt-1">{formatDateTime(exam.createdAt).split(' - ')[1]}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-ink-50 pt-3 text-[10px] text-ink-400 font-bold uppercase tracking-wide">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 size={12} className="text-ink-400 shrink-0" />
                        <span className="truncate max-w-[140px] text-ink-600 font-bold text-xs">{clinic?.name || 'Geral / Sem Unidade'}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {exam.googleDocUrl && (
                          <a
                            href={exam.googleDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Abrir no Google Docs"
                          >
                            <FileText size={16} />
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
                          className="p-2.5 rounded-xl text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Ajustar Metadados"
                        >
                          <UserCog size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncOrthanc(exam, patient?.name || '', patient?.birthDate, patient?.gender);
                          }}
                          disabled={syncingExamId === exam.id}
                          className="p-2.5 rounded-xl text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                          title="Enviar para Worklist Orthanc"
                        >
                          {syncingExamId === exam.id ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : <RefreshCw size={16} />}
                        </button>
                        <button
                          onClick={() => setDeleteId(exam.id)}
                          className="p-2.5 rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir Registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* High-Fidelity Metadados Modal Overlay */}
      {editExamId && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4 animate-in fade-in duration-200 backdrop-blur-md">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden overflow-y-auto max-h-[90dvh] md:max-h-none transform animate-slide-in-up md:animate-scale-in duration-200 border border-ink-100">
            <div className="px-8 py-6 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
              <h3 className="font-black text-ink-900 flex items-center gap-3">
                <AreaIcon area={exams.find(e => e.id === editExamId)?.area || ''} size={18} className="text-brand-500" />
                Ajustar Informações do Exame
              </h3>
              <button onClick={() => setEditExamId(null)} className="p-2 hover:bg-ink-100 rounded-2xl text-ink-400 transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                 <div>
                   <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Médico Solicitante</label>
                   <input 
                     className="w-full h-12 px-4 bg-ink-50/50 border border-ink-200 rounded-2xl focus:border-brand-500 outline-none transition-all font-bold text-sm" 
                     placeholder="Dr(a). ..."
                     value={editData.requestingPhysician} 
                     onChange={e => setEditData({...editData, requestingPhysician: e.target.value})} 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Indicação Clínica</label>
                   <textarea 
                     className="w-full p-4 bg-ink-50/50 border border-ink-200 rounded-2xl focus:border-brand-500 outline-none transition-all font-bold text-sm min-h-[100px] resize-none" 
                     placeholder="Escreva a indicação diagnóstica do exame..."
                     value={editData.clinicalIndication} 
                     onChange={e => setEditData({...editData, clinicalIndication: e.target.value})} 
                   />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Unidade Clínica</label>
                  <select 
                    className="w-full h-12 px-3 bg-ink-50/50 border border-ink-200 rounded-2xl focus:border-brand-500 outline-none font-bold text-sm"
                    value={editData.clinicId}
                    onChange={e => setEditData({...editData, clinicId: e.target.value})}
                  >
                    <option value="">Geral / Sem Unidade</option>
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Estado Clínico</label>
                  <select 
                    className="w-full h-12 px-3 bg-ink-50/50 border border-ink-200 rounded-2xl focus:border-brand-500 outline-none font-bold text-sm"
                    value={editData.status}
                    onChange={e => setEditData({...editData, status: e.target.value as ExamStatus})}
                  >
                    <option value="pendente">Aguardando</option>
                    <option value="em-andamento">Em Andamento</option>
                    <option value="finalizado">Finalizado</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 border-t border-ink-100 flex justify-end gap-3 bg-ink-50/50">
              <button className="h-12 px-6 rounded-2xl text-ink-500 font-bold hover:bg-ink-100 transition-all text-xs uppercase tracking-widest" onClick={() => setEditExamId(null)}>Cancelar</button>
              <button 
                className="h-12 px-8 rounded-2xl bg-brand-600 text-white font-black text-xs uppercase tracking-widest hover:bg-brand-500 transition-all flex items-center gap-2 shadow-[0_8px_16px_rgba(99,102,241,0.2)]" 
                onClick={handleSaveMetadata} 
                disabled={loadingMetadata}
              >
                {loadingMetadata ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmar Alterações
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

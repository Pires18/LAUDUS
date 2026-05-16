import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EXAM_AREAS, ExamStatus, ExamRequest, Patient, Clinic } from '../../types';
import { deleteItem } from '../../store/db';
import { formatDateTime, classNames } from '../../utils/format';
import { useState, useMemo } from 'react';
import {
  CircleDot, CheckCircle2, Clock, Search, FilePlus2, Trash2,
  LayoutList, Building2, Filter, Calendar, SlidersHorizontal, ArrowRight, UserCog, Loader2, X,
  MoreHorizontal, ChevronRight
} from 'lucide-react';
import { Skeleton } from '../../components/SkeletonLoader';
import { AreaIcon } from '../../components/AreaIcon';
import type { LucideIcon } from 'lucide-react';

const STATUS_META: Record<ExamStatus, { label: string; icon: LucideIcon; class: string; dot: string }> = {
  'pendente': { label: 'Aguardando', icon: Clock, class: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-400' },
  'em-andamento': { label: 'Em Andamento', icon: CircleDot, class: 'bg-brand-50 text-brand-700 border-brand-100', dot: 'bg-brand-500' },
  'finalizado': { label: 'Finalizado', icon: CheckCircle2, class: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
};

export function Worklist() {
  const { setView, showToast, selectedClinicId, setShowCreateExamModal, settings } = useApp();
  const currentRole = settings.currentRole || 'medico';
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'todos'>('todos');
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [dateFilter, setDateFilter] = useState<'todos' | 'hoje' | 'semana' | 'mes'>('hoje');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    patientName: '',
    birthDate: '',
    requestingPhysician: '',
    clinicalIndication: '',
    clinicId: '',
    status: 'pendente' as ExamStatus
  });
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Realtime listeners
  const { data: exams, loading: examsLoading } = useCollection<ExamRequest>('exams');
  const { data: patients } = useCollection<Patient>('patients');
  const { data: clinics } = useCollection<Clinic>('clinics');

  // Build lookup maps
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const clinicMap = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  // Apply filters and sort
  const filtered = useMemo(() => {
    let result = [...exams];

    // Clinic filter
    if (selectedClinicId) {
      result = result.filter(e => e.clinicId === selectedClinicId);
    }

    // Status filter
    if (statusFilter !== 'todos') {
      result = result.filter(e => e.status === statusFilter);
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

    // Sort by createdAt descending (most recent first)
    return result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [exams, statusFilter, areaFilter, dateFilter, search, selectedClinicId, patientMap]);

  const counts = {
    todos: exams.filter((e) => !selectedClinicId || e.clinicId === selectedClinicId).length,
    pendente: exams.filter((e) => e.status === 'pendente' && (!selectedClinicId || e.clinicId === selectedClinicId)).length,
    'em-andamento': exams.filter((e) => e.status === 'em-andamento' && (!selectedClinicId || e.clinicId === selectedClinicId)).length,
    finalizado: exams.filter((e) => e.status === 'finalizado' && (!selectedClinicId || e.clinicId === selectedClinicId)).length,
  };

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteItem('exams', deleteId);
      showToast('Exame excluído com sucesso', 'success');
    } catch {
      showToast('Erro ao excluir exame', 'error');
    } finally {
      setDeleteId(null);
    }
  }

  async function handleSaveMetadata() {
    if (!editExamId) return;
    try {
      setLoadingMetadata(true);
      const { updateItem: dbUpdate } = await import('../../store/db');
      await dbUpdate('exams', editExamId, {
        requestingPhysician: editData.requestingPhysician,
        clinicalIndication: editData.clinicalIndication,
        clinicId: editData.clinicId,
        status: editData.status as ExamStatus,
        finalizedAt: editData.status === 'finalizado' ? Date.now() : null
      });
      setEditExamId(null);
      showToast('Dados atualizados!');
    } catch {
      showToast('Erro ao atualizar', 'error');
    } finally {
      setLoadingMetadata(false);
    }
  }

  return (
    <div className="module-container">
      <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-ink-900 tracking-tight">Worklist Profissional</h1>
          <p className="text-sm text-ink-500">Gestão centralizada de exames e laudos clínicos.</p>
        </div>
        <button 
          onClick={() => setShowCreateExamModal(true)}
          className="h-12 px-6 rounded-2xl bg-brand-600 text-white font-black text-sm uppercase tracking-widest hover:bg-brand-700 hover:shadow-premium transition-all flex items-center justify-center gap-2"
        >
          <FilePlus2 size={18} /> Novo Laudo
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['todos', 'pendente', 'em-andamento', 'finalizado'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={classNames(
              "p-4 rounded-2xl border transition-all text-left group",
              statusFilter === s ? "bg-ink-900 border-ink-900 shadow-lg" : "bg-white border-ink-100 hover:border-brand-200"
            )}
          >
            <p className={classNames("text-[10px] font-black uppercase tracking-widest mb-1", statusFilter === s ? "text-ink-400" : "text-ink-400")}>
              {s === 'todos' ? 'Total' : STATUS_META[s].label}
            </p>
            <div className="flex items-center justify-between">
              <span className={classNames("text-2xl font-black", statusFilter === s ? "text-white" : "text-ink-900")}>
                {counts[s]}
              </span>
              <div className={classNames(
                "w-8 h-8 rounded-xl flex items-center justify-center",
                statusFilter === s ? "bg-white/10 text-white" : "bg-ink-50 text-ink-400"
              )}>
                {s === 'todos' ? <LayoutList size={16} /> : <Clock size={16} />}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-[2rem] border border-ink-100 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente, exame ou ID..."
              className="w-full h-11 pl-10 pr-4 bg-ink-50 border border-ink-100 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium text-xs"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto">
             <div className="flex bg-ink-50 p-1 rounded-xl border border-ink-100">
               {(['hoje', 'semana', 'mes', 'todos'] as const).map(d => (
                 <button
                   key={d}
                   onClick={() => setDateFilter(d)}
                   className={classNames(
                     "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                     dateFilter === d ? "bg-white text-brand-600 shadow-sm" : "text-ink-500 hover:text-ink-700"
                   )}
                 >
                   {d === 'todos' ? 'Tudo' : d}
                 </button>
               ))}
             </div>
             
             <button
               onClick={() => setShowFilters(!showFilters)}
               className={classNames(
                 "h-12 w-12 rounded-2xl border flex items-center justify-center transition-all",
                 showFilters ? "bg-brand-50 border-brand-200 text-brand-600" : "bg-white border-ink-100 text-ink-400 hover:border-brand-200"
               )}
             >
               <SlidersHorizontal size={20} />
             </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-ink-50 animate-in slide-in-from-top-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-ink-400 tracking-widest ml-1">Especialidade</label>
              <select 
                className="w-full h-11 bg-ink-50 border border-ink-100 rounded-xl px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                value={areaFilter}
                onChange={e => setAreaFilter(e.target.value)}
              >
                <option value="todas">Todas as Áreas</option>
                {EXAM_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            {/* Additional filters can go here */}
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] border border-ink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50/50 border-b border-ink-100">
                <th className="px-6 py-4 text-[10px] font-black text-ink-400 uppercase tracking-widest">Paciente</th>
                <th className="px-6 py-4 text-[10px] font-black text-ink-400 uppercase tracking-widest">Exame / Área</th>
                <th className="px-6 py-4 text-[10px] font-black text-ink-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-ink-400 uppercase tracking-widest">Unidade</th>
                <th className="px-6 py-4 text-[10px] font-black text-ink-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-ink-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {examsLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <LayoutList size={40} className="text-ink-100" />
                      <p className="text-ink-400 font-medium italic">Nenhum exame encontrado para os filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(exam => {
                  const patient = patientMap.get(exam.patientId);
                  const clinic = clinicMap.get(exam.clinicId || '');
                  const area = EXAM_AREAS.find(a => a.id === exam.area);
                  const status = STATUS_META[exam.status];

                  return (
                    <tr 
                      key={exam.id} 
                      className="group hover:bg-ink-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (currentRole === 'recepcao') {
                          showToast('Acesso negado: Apenas médicos podem laudar.', 'error');
                          return;
                        }
                        setView({ name: 'exam-editor', examId: exam.id });
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black shadow-inner">
                            {patient?.name.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-ink-900 group-hover:text-brand-600 transition-colors">{patient?.name || 'Não identificado'}</p>
                            <p className="text-[10px] font-mono text-ink-400">ID: {exam.friendlyId || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-ink-700 text-sm leading-tight mb-1">{exam.examType}</p>
                        {area && <span className={classNames("text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter", area.color)}>{area.label}</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className={classNames(
                           "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                           status.class
                         )}>
                           <div className={classNames("w-1.5 h-1.5 rounded-full", status.dot)} />
                           {status.label}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-ink-600 text-sm">
                          <Building2 size={14} className="text-ink-300" />
                          <span className="truncate max-w-[120px] font-medium">{clinic?.name || 'Geral'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-ink-700">{formatDateTime(exam.createdAt).split(' - ')[0]}</p>
                        <p className="text-[10px] text-ink-400 font-medium">{formatDateTime(exam.createdAt).split(' - ')[1]}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               setEditData({
                                 patientName: patient?.name || '',
                                 birthDate: patient?.birthDate || '',
                                 requestingPhysician: exam.requestingPhysician || '',
                                 clinicalIndication: exam.clinicalIndication || '',
                                 clinicId: exam.clinicId || '',
                                 status: exam.status
                               });
                               setEditExamId(exam.id);
                             }}
                             className="p-2 rounded-xl text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                           >
                             <UserCog size={18} />
                           </button>
                           <button
                             onClick={(e) => { e.stopPropagation(); setDeleteId(exam.id); }}
                             className="p-2 rounded-xl text-ink-400 hover:text-red-600 hover:bg-red-50 transition-all"
                           >
                             <Trash2 size={18} />
                           </button>
                           <div className="w-8 h-8 rounded-xl bg-ink-50 text-ink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                             <ChevronRight size={18} />
                           </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição de Metadados */}
      {editExamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden transform animate-in zoom-in-95 duration-200 border border-ink-100">
            <div className="px-8 py-6 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
              <h3 className="font-black text-ink-900 flex items-center gap-3">
                <AreaIcon area={exams.find(e => e.id === editExamId)?.area || ''} size={20} className="text-brand-500" />
                Ajustar Metadados
              </h3>
              <button onClick={() => setEditExamId(null)} className="p-2 hover:bg-ink-100 rounded-2xl text-ink-400 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                 <div>
                   <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Médico Solicitante</label>
                   <input 
                     className="w-full h-12 px-4 bg-ink-50 border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium" 
                     placeholder="Dr(a). ..."
                     value={editData.requestingPhysician} 
                     onChange={e => setEditData({...editData, requestingPhysician: e.target.value})} 
                   />
                 </div>
                 <div>
                   <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Indicação Clínica</label>
                   <textarea 
                     className="w-full p-4 bg-ink-50 border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium min-h-[100px] resize-none" 
                     placeholder="Descreva a indicação..."
                     value={editData.clinicalIndication} 
                     onChange={e => setEditData({...editData, clinicalIndication: e.target.value})} 
                   />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Unidade</label>
                  <select 
                    className="w-full h-12 px-3 bg-ink-50 border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium"
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
                  <label className="text-[10px] font-black uppercase text-ink-400 mb-2 block ml-1 tracking-widest">Status do Exame</label>
                  <select 
                    className="w-full h-12 px-3 bg-ink-50 border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium"
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
              <button className="h-12 px-6 rounded-2xl text-ink-500 font-bold hover:bg-ink-100 transition-all" onClick={() => setEditExamId(null)}>Descartar</button>
              <button 
                className="h-12 px-8 rounded-2xl bg-brand-600 text-white font-black text-sm uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center gap-2 shadow-lg" 
                onClick={handleSaveMetadata} 
                disabled={loadingMetadata}
              >
                {loadingMetadata ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Confirmar Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        title="Excluir Exame"
        message="Tem certeza que deseja excluir este registro? Todas as informações vinculadas serão perdidas."
        confirmLabel="Excluir Registro"
        variant="danger"
      />
    </div>
  );
}

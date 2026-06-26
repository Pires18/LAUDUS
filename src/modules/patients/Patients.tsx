import { useApp } from '../../store/app';
import { usePaginatedCollection, orderBy, where } from '../../hooks/useFirestore';
import { CollectionError } from '../../components/CollectionError';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Patient } from '../../types';
import { addItemWithId, deleteItem, generateStandardId, countWhere } from '../../store/db';
import { useState, useMemo } from 'react';
import { UserPlus, Search, Trash2, Users as UsersIcon, Loader2, X } from 'lucide-react';
import { calculateAge, formatDate, formatCPF, formatPhone, classNames } from '../../utils/format';
import { PatientForm } from './PatientForm';
import { ListSkeleton } from '../../components/SkeletonLoader';

export function Patients() {
  const { setView, showToast, patientsSearch: search, setPatientsSearch: setSearch } = useApp();
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; examCount: number } | null>(null);

  // Capitaliza a primeira letra para melhorar as chances de match na busca prefixada do Firebase
  const searchPrefix = search.charAt(0).toUpperCase() + search.slice(1);
  const constraints = search 
    ? [orderBy('name', 'asc'), where('name', '>=', searchPrefix), where('name', '<=', searchPrefix + '\uf8ff')] 
    : [orderBy('name', 'asc')];

  const { data: patients, loading, error: patientsError, hasMore, loadMore } = usePaginatedCollection<Patient>('patients', {
    constraints,
    initialLimit: 50,
    // Re-subscreve quando o termo de busca muda (toString de constraints é inútil).
    queryKey: search ? `search:${searchPrefix}` : 'all'
  });

  // Filtro local adicional caso a busca prefixada traga maiúsculas/minúsculas diferentes, ou para buscar por CPF
  const filtered = useMemo(() => {
    return patients.filter((p) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf?.includes(search)
    );
  }, [patients, search]);

  // Sort alphabetically
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  async function handleCreate(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = generateStandardId('PAC');
    await addItemWithId('patients', id, data);
    setCreating(false);
    showToast('Paciente cadastrado', 'success');
    setView({ name: 'patient-detail', patientId: id });
  }

  async function handleRequestDelete(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const examCount = await countWhere('exams', 'patientId', id);
    setDeleteTarget({ id, name, examCount });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.examCount > 0) {
      showToast(`Paciente tem ${deleteTarget.examCount} exame(s) vinculado(s). Exclua-os antes.`, 'error');
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteItem('patients', deleteTarget.id);
      showToast('Paciente excluído', 'success');
    } catch {
      showToast('Erro ao excluir paciente', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">
        
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
                <UsersIcon size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Pacientes</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Gerenciamento e prontuários cadastrados</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCreating(true)}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <UserPlus size={11} />
                Novo Paciente
              </button>
            </div>
          </div>
        </div>

        {/* ─── SEARCH BAR ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm p-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="w-full h-9 pl-9 pr-3 bg-ink-50 border border-ink-200 focus:border-brand-400 rounded-xl focus:ring-2 focus:ring-brand-400/10 outline-none transition-all text-sm text-ink-800 placeholder-ink-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ─── PATIENTS TABLE ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-sm">
          {patientsError ? (
            <CollectionError message={patientsError} />
          ) : loading ? (
            <div className="p-4">
              <ListSkeleton count={4} />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-ink-50 flex items-center justify-center mx-auto mb-3 border border-ink-100">
                <UsersIcon size={20} className="text-ink-300" />
              </div>
              <p className="text-sm font-bold text-ink-400">
                {patients.length === 0 ? 'Nenhum paciente cadastrado' : 'Nenhum resultado'}
              </p>
              <p className="text-xs text-ink-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                {patients.length === 0
                  ? 'Cadastre seu primeiro paciente para começar.'
                  : 'Tente ajustar o termo de busca.'}
              </p>
              {patients.length === 0 && (
                <button
                  onClick={() => setCreating(true)}
                  className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95 mt-4"
                >
                  <UserPlus size={11} />
                  Cadastrar Primeiro Paciente
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-ink-50/30 border-b border-ink-100">
                      <th className="px-4 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[28%]">Nome</th>
                      <th className="px-4 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[14%]">Prontuário</th>
                      <th className="px-4 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[18%]">Contato</th>
                      <th className="px-4 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[10%]">Idade</th>
                      <th className="px-4 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[14%]">CPF</th>
                      <th className="px-4 py-3.5 text-[9px] font-black text-ink-400 uppercase tracking-[0.2em] w-[16%]">Convênio</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {sorted.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setView({ name: 'patient-detail', patientId: p.id })}
                        className="group hover:bg-ink-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={classNames(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border",
                              p.gender === 'F' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                              p.gender === 'M' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              'bg-ink-100 text-ink-700 border-ink-200'
                            )}>
                              {p.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="font-semibold text-ink-900 group-hover:text-brand-600 transition-colors truncate max-w-[200px] text-sm">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-700 font-mono text-xs font-bold">{p.id}</td>
                        <td className="px-4 py-3 text-sm">
                          {p.phone ? (
                            <span className="text-ink-700">{formatPhone(p.phone)}</span>
                          ) : p.email ? (
                            <span className="text-ink-500 text-xs truncate block max-w-full">{p.email}</span>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-600 text-sm">{calculateAge(p.birthDate)}</td>
                        <td className="px-4 py-3 text-ink-600 font-mono text-xs">{p.cpf ? formatCPF(p.cpf) : '—'}</td>
                        <td className="px-4 py-3 text-ink-600 text-sm truncate">{p.insurance || '—'}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleRequestDelete(p.id, p.name, e)}
                            className="text-ink-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-xl hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
   
              {/* Mobile View */}
              <div className="md:hidden divide-y divide-ink-50">
                {sorted.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setView({ name: 'patient-detail', patientId: p.id })}
                    className="p-4 active:bg-ink-50 transition-colors flex items-center gap-3"
                  >
                    <div className={classNames(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border",
                      p.gender === 'F' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                      p.gender === 'M' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-ink-100 text-ink-700 border-ink-200'
                    )}>
                      {p.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-ink-900 truncate">{p.name}</div>
                      <div className="text-[10px] font-mono text-brand-600 font-bold mt-0.5">Prontuário: {p.id}</div>
                      <div className="flex items-center gap-2 text-xs text-ink-500 mt-1">
                        <span>{calculateAge(p.birthDate)}</span>
                        {p.cpf && <><span>·</span><span className="font-mono">{formatCPF(p.cpf)}</span></>}
                        {p.phone && <><span>·</span><span>{formatPhone(p.phone)}</span></>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRequestDelete(p.id, p.name, e); }}
                      className="p-2 text-ink-400 hover:text-red-600 active:bg-red-50 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
  
              {hasMore && (
                <div className="p-3 flex justify-center border-t border-ink-100">
                  <button 
                    onClick={loadMore} 
                    className="h-9 px-4 rounded-xl border border-ink-200 hover:bg-ink-50 text-ink-600 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                    disabled={loading}
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                    Carregar mais pacientes
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
  
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo Paciente" size="lg">
        <PatientForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>
  
      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir paciente"
        message={
          deleteTarget?.examCount ? (
            <span>
              O paciente <strong>{deleteTarget.name}</strong> tem{' '}
              <strong>{deleteTarget.examCount} exame(s)</strong> vinculado(s).
              Exclua os exames antes de remover o paciente.
            </span>
          ) : (
            <span>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
              Esta ação não pode ser desfeita.
            </span>
          )
        }
        confirmLabel={deleteTarget?.examCount ? 'Entendido' : 'Excluir'}
        variant={deleteTarget?.examCount ? 'warning' : 'danger'}
      />
    </div>
  );
}

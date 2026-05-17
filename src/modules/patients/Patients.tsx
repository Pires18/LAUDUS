import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Patient } from '../../types';
import { addItemWithId, deleteItem, generateStandardId, countWhere } from '../../store/db';
import { useState } from 'react';
import { UserPlus, Search, User as UserIcon, Trash2, Users as UsersIcon } from 'lucide-react';
import { calculateAge, formatDate, formatCPF, formatPhone } from '../../utils/format';
import { PatientForm } from './PatientForm';
import { ListSkeleton } from '../../components/SkeletonLoader';

export function Patients() {
  const { setView, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; examCount: number } | null>(null);

  const { data: patients, loading } = useCollection<Patient>('patients');

  const filtered = patients.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.cpf?.includes(search)
  );

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
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
        <PageHeader
        title="Pacientes"
        subtitle={`${patients.length} paciente(s) cadastrado(s)`}
        icon={UsersIcon}
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <UserPlus size={16} /> Novo Paciente
          </button>
        }
      />

      <div className="search-box">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="input pl-10 h-12"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <ListSkeleton count={4} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <UsersIcon size={32} className="text-ink-300" />
            </div>
            <p className="empty-state-title">
              {patients.length === 0 ? 'Nenhum paciente cadastrado' : 'Nenhum resultado'}
            </p>
            <p className="empty-state-text">
              {patients.length === 0
                ? 'Cadastre seu primeiro paciente para começar.'
                : 'Tente ajustar o termo de busca.'}
            </p>
            {patients.length === 0 && (
              <button className="btn-primary" onClick={() => setCreating(true)}>
                <UserPlus size={15} /> Cadastrar Primeiro Paciente
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                    <th className="text-left px-4 py-3 font-medium w-[30%]">Nome</th>
                    <th className="text-left px-4 py-3 font-medium">Contato</th>
                    <th className="text-left px-4 py-3 font-medium">Idade</th>
                    <th className="text-left px-4 py-3 font-medium">CPF</th>
                    <th className="text-left px-4 py-3 font-medium">Convênio</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Cadastro</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setView({ name: 'patient-detail', patientId: p.id })}
                      className="border-b border-ink-50 hover:bg-ink-50/40 cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center text-ink-500">
                            <UserIcon size={14} />
                          </div>
                          <span className="font-medium text-ink-900">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.phone ? (
                          <span className="text-ink-700">{formatPhone(p.phone)}</span>
                        ) : p.email ? (
                          <span className="text-ink-500 text-xs">{p.email}</span>
                        ) : (
                          <span className="text-ink-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{calculateAge(p.birthDate)}</td>
                      <td className="px-4 py-3 text-ink-600 font-mono text-xs">{p.cpf ? formatCPF(p.cpf) : '—'}</td>
                      <td className="px-4 py-3 text-ink-600">{p.insurance || '—'}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs hidden lg:table-cell">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleRequestDelete(p.id, p.name, e)}
                          className="text-ink-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 size={15} />
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
                  <div className="w-10 h-10 rounded-full bg-ink-100 flex items-center justify-center text-ink-500 shrink-0">
                    <UserIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-ink-900 truncate">{p.name}</div>
                    <div className="flex items-center gap-2 text-xs text-ink-500">
                      <span>{calculateAge(p.birthDate)}</span>
                      {p.cpf && <><span>·</span><span className="font-mono">{formatCPF(p.cpf)}</span></>}
                      {p.phone && <><span>·</span><span>{formatPhone(p.phone)}</span></>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRequestDelete(p.id, p.name, e)}
                    className="p-2 text-ink-300 active:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
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
    </div>
  );
}

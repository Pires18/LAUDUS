import { useState } from 'react';
import { useCollection } from '../../../hooks/useFirestore';
import { UserRole } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useApp } from '../../../store/app';
import { addAuditLog } from '../../../store/db';
import {
  updateUserRole,
  setUserActiveStatus,
  deleteUserDocument
} from '../../../store/adminUsers';
import {
  Search, Shield, MoreVertical,
  CheckCircle2, XCircle, Loader2,
  ChevronDown, Trash2, Filter, Sparkles, Edit2, Calculator, Database
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLogin?: number;
  subscriptionStatus?: string;
  motorProEnabled?: boolean;
  reportsUsedThisMonth?: number;
  reportsQuota?: number;
  subscriptionId?: string;
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Modal/Dialog States
  const [roleChangeTarget, setRoleChangeTarget] = useState<SystemUser | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<SystemUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);

  const { data: users, loading } = useCollection<SystemUser>('users', { isGlobal: true });
  const { data: subscriptions } = useCollection<any>('subscriptions', { isGlobal: true });

  const filtered = users.filter(u => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  async function handleRoleChange(newRole: UserRole) {
    if (!roleChangeTarget || !currentUser) return;
    setIsProcessing(roleChangeTarget.id);
    try {
      await updateUserRole(
        roleChangeTarget.id,
        newRole,
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Admin'
      );
      await addAuditLog({ action: 'ALTERAR_CARGO', details: `Cargo de ${roleChangeTarget.name} alterado para ${newRole}.`, module: 'AdminUsers' });
      showToast(`Papel de ${roleChangeTarget.name} alterado para ${newRole}`, 'success');
    } catch {
      showToast('Erro ao alterar papel', 'error');
    } finally {
      setIsProcessing(null);
      setRoleChangeTarget(null);
    }
  }

  async function handleStatusToggle() {
    if (!statusChangeTarget || !currentUser) return;
    setIsProcessing(statusChangeTarget.id);
    const newStatus = !statusChangeTarget.active;
    try {
      await setUserActiveStatus(
        statusChangeTarget.id,
        newStatus,
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Admin'
      );
      await addAuditLog({ action: 'ALTERAR_STATUS_USUARIO', details: `Status de ${statusChangeTarget.name} alterado para ${newStatus ? 'Ativo' : 'Inativo'}.`, module: 'AdminUsers' });
      showToast(`Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso`, 'success');
    } catch {
      showToast('Erro ao alterar status', 'error');
    } finally {
      setIsProcessing(null);
      setStatusChangeTarget(null);
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget || !currentUser) return;
    setIsProcessing(deleteTarget.id);
    try {
      await deleteUserDocument(
        deleteTarget.id,
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Admin'
      );
      await addAuditLog({ action: 'EXCLUIR_USUARIO', details: `Usuário ${deleteTarget.name} excluído do sistema.`, module: 'AdminUsers' });
      showToast(`Usuário ${deleteTarget.name} removido com sucesso`, 'success');
    } catch {
      showToast('Erro ao remover usuário', 'error');
    } finally {
      setIsProcessing(null);
      setDeleteTarget(null);
    }
  }

  async function handleToggleMotorPro(u: SystemUser) {
    setIsProcessing(u.id);
    setOpenMenu(null);
    try {
      const userRef = doc(firestore, 'users', u.id);
      await updateDoc(userRef, { motorProEnabled: !u.motorProEnabled, updatedAt: Date.now() });
      showToast('Permissão de Motor Pro alterada.', 'success');
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setIsProcessing(null);
    }
  }

  async function handleEditQuota(u: SystemUser) {
    setOpenMenu(null);
    const newValStr = window.prompt('Informe a nova quota de laudos mensais:', String(u.reportsQuota || 100));
    if (newValStr === null) return;
    const newVal = parseInt(newValStr, 10);
    if (isNaN(newVal) || newVal < 0) { showToast('Valor de quota inválido.', 'error'); return; }
    setIsProcessing(u.id);
    try {
      const userRef = doc(firestore, 'users', u.id);
      await updateDoc(userRef, { reportsQuota: newVal, updatedAt: Date.now() });
      showToast('Quota mensal atualizada.', 'success');
    } catch (err: any) {
      showToast('Erro: ' + err.message, 'error');
    } finally {
      setIsProcessing(null);
    }
  }

  function getSubStatusBadge(status: string | undefined) {
    if (!status) return <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-ink-100 text-ink-500">—</span>;
    const map: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700',
      trialing: 'bg-indigo-50 text-indigo-700',
      past_due: 'bg-rose-50 text-rose-700',
      canceled: 'bg-ink-100 text-ink-500',
      paused: 'bg-amber-50 text-amber-700',
    };
    const cls = map[status] || 'bg-ink-100 text-ink-500';
    return <span className={classNames('px-2 py-0.5 rounded text-[9px] font-black uppercase', cls)}>{status}</span>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">Gestão de Profissionais</h3>
          <p className="text-sm text-ink-500">Controle de acesso e níveis de permissão da plataforma.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-ink-100 bg-ink-50/10 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full h-14 pl-12 pr-4 bg-white border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-ink-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="h-14 bg-white border border-ink-100 rounded-2xl px-4 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">TODOS OS CARGOS</option>
              <option value="admin">ADMINISTRADORES</option>
              <option value="medico">MÉDICOS</option>
              <option value="recepcao">RECEPÇÃO</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-ink-50/30 text-[10px] font-black uppercase tracking-widest text-ink-400 border-b border-ink-100">
                <th className="px-6 py-5">Usuário & Contato</th>
                <th className="px-6 py-5">Nível de Acesso</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Assinatura</th>
                <th className="px-6 py-5">Laudos</th>
                <th className="px-6 py-5 text-center">Motor Pro</th>
                <th className="px-6 py-5">Atividade</th>
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-10"><div className="h-12 bg-ink-50 rounded-2xl w-full" /></td>
                  </tr>
                ))
              ) : filtered.map((u) => {
                const subId = `sub_${u.id}`;
                const sub = subscriptions.find((s: any) => s.id === subId);
                const used = u.reportsUsedThisMonth || 0;
                const quota = u.reportsQuota || 100;
                const pct = Math.min(100, Math.round((used / quota) * 100));
                const isExpanded = expandedRow === u.id;

                return (
                  <>
                    <tr
                      key={u.id}
                      className="hover:bg-ink-50/20 transition-colors group cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : u.id)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-black shadow-inner border border-brand-100 text-sm">
                            {u.name?.charAt(0) || u.email?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-ink-900 group-hover:text-brand-700 transition-colors">{u.name || 'Usuário sem nome'}</p>
                            <p className="text-xs text-ink-500 font-medium">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setRoleChangeTarget(u); }}
                          className={classNames(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                            u.role === 'admin' ? "bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 shadow-sm" :
                            u.role === 'medico' ? "bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100 shadow-sm" :
                            "bg-ink-50 text-ink-700 border-ink-100 hover:bg-ink-100 shadow-sm"
                          )}
                        >
                          <Shield size={12} />
                          {u.role}
                          <ChevronDown size={10} />
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setStatusChangeTarget(u); }}
                          className={classNames(
                            "flex items-center gap-2 text-xs font-bold transition-all px-3 py-1.5 rounded-xl border",
                            u.active !== false
                              ? "text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-100 shadow-sm"
                              : "text-red-500 bg-red-50 border-red-100 hover:bg-red-100 shadow-sm"
                          )}
                        >
                          {u.active !== false ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          {u.active !== false ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
                        {getSubStatusBadge(u.subscriptionStatus)}
                      </td>
                      <td className="px-6 py-5" onClick={e => e.stopPropagation()}>
                        <div className="space-y-1 min-w-[80px]">
                          <span className="text-[10px] font-bold text-ink-700">{used} / {quota}</span>
                          <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                            <div
                              className={classNames('h-full rounded-full transition-all', pct >= 85 ? 'bg-rose-500' : 'bg-emerald-500')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleMotorPro(u)}
                          disabled={isProcessing === u.id}
                          className={classNames(
                            "w-10 h-6 rounded-full relative transition-all cursor-pointer inline-block",
                            u.motorProEnabled ? "bg-indigo-600" : "bg-ink-300"
                          )}
                        >
                          <div className={classNames(
                            "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                            u.motorProEnabled ? "left-5" : "left-1"
                          )} />
                        </button>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs text-ink-600 font-medium">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nenhuma'}
                        </p>
                        <p className="text-[10px] text-ink-400 uppercase font-bold tracking-widest mt-0.5">Último Login</p>
                      </td>
                      <td className="px-6 py-5 text-right" onClick={e => e.stopPropagation()}>
                        {isProcessing === u.id ? (
                          <Loader2 size={18} className="animate-spin text-brand-500 ml-auto" />
                        ) : (
                          <div className="relative flex items-center justify-end gap-2">
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              title="Remover Usuário"
                            >
                              <Trash2 size={18} />
                            </button>
                            <button
                              onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                              className="p-2 text-ink-400 hover:bg-ink-100 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical size={18} />
                            </button>
                            {openMenu === u.id && (
                              <div className="absolute right-0 top-full z-50 bg-white rounded-xl border border-ink-200 shadow-xl mt-1 min-w-[200px] py-1 text-xs">
                                <button className="w-full px-4 py-2.5 text-left hover:bg-ink-50 font-semibold flex items-center gap-2 text-ink-700"
                                  onClick={() => { setOpenMenu(null); setRoleChangeTarget(u); }}>
                                  <Shield size={13} /> Alterar Cargo
                                </button>
                                <button className="w-full px-4 py-2.5 text-left hover:bg-ink-50 font-semibold flex items-center gap-2 text-ink-700"
                                  onClick={() => { setOpenMenu(null); setStatusChangeTarget(u); }}>
                                  <CheckCircle2 size={13} /> Ativar / Desativar
                                </button>
                                <button className="w-full px-4 py-2.5 text-left hover:bg-ink-50 font-semibold flex items-center gap-2 text-indigo-700"
                                  onClick={() => handleToggleMotorPro(u)}>
                                  <Sparkles size={13} /> {u.motorProEnabled ? 'Desabilitar' : 'Habilitar'} Motor Pro
                                </button>
                                <button className="w-full px-4 py-2.5 text-left hover:bg-ink-50 font-semibold flex items-center gap-2 text-ink-700"
                                  onClick={() => handleEditQuota(u)}>
                                  <Edit2 size={13} /> Editar Quota de Laudos
                                </button>
                                <hr className="border-ink-100 my-1" />
                                <button className="w-full px-4 py-2.5 text-left hover:bg-red-50 font-semibold flex items-center gap-2 text-rose-600"
                                  onClick={() => { setOpenMenu(null); setDeleteTarget(u); }}>
                                  <Trash2 size={13} /> Excluir Usuário
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expanded row: inline detail panel */}
                    {isExpanded && (
                      <tr key={`${u.id}-detail`} className="bg-ink-50/30">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Subscription info */}
                            <div className="bg-white rounded-xl border border-ink-100 p-4 space-y-2">
                              <div className="text-[9px] font-black uppercase text-ink-400 tracking-widest mb-2">Assinatura</div>
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between"><span className="text-ink-500">Status</span><span className="font-bold">{u.subscriptionStatus || '—'}</span></div>
                                <div className="flex justify-between"><span className="text-ink-500">ID Sub</span><span className="font-mono text-[10px]">{sub?.id || '—'}</span></div>
                                <div className="flex justify-between"><span className="text-ink-500">Método</span><span className="font-bold">{sub?.paymentMethod || '—'}</span></div>
                                {sub?.currentPeriodEnd && (
                                  <div className="flex justify-between"><span className="text-ink-500">Vence em</span><span className="font-bold">{new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')}</span></div>
                                )}
                              </div>
                            </div>

                            {/* Quota & Motor */}
                            <div className="bg-white rounded-xl border border-ink-100 p-4 space-y-2">
                              <div className="text-[9px] font-black uppercase text-ink-400 tracking-widest mb-2">Uso & Motor</div>
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between"><span className="text-ink-500">Laudos usados</span><span className="font-bold">{used} / {quota}</span></div>
                                <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden mt-1">
                                  <div className={classNames('h-full rounded-full', pct >= 85 ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex justify-between mt-2"><span className="text-ink-500">Motor Pro</span><span className={classNames('font-bold', u.motorProEnabled ? 'text-indigo-600' : 'text-ink-400')}>{u.motorProEnabled ? 'Habilitado' : 'Desabilitado'}</span></div>
                              </div>
                            </div>

                            {/* Add-ons */}
                            <div className="bg-white rounded-xl border border-ink-100 p-4 space-y-2">
                              <div className="text-[9px] font-black uppercase text-ink-400 tracking-widest mb-2">Add-ons</div>
                              <div className="flex gap-2 flex-wrap">
                                <span className={classNames(
                                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border',
                                  sub?.addons?.includes('calculators') ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-ink-50 border-ink-200 text-ink-400'
                                )}>
                                  <Calculator size={11} /> Calculadoras
                                </span>
                                <span className={classNames(
                                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border',
                                  sub?.addons?.includes('pacs') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-ink-50 border-ink-200 text-ink-400'
                                )}>
                                  <Database size={11} /> PACS
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal */}
      <Modal
        open={roleChangeTarget !== null}
        onClose={() => setRoleChangeTarget(null)}
        title="Alterar Permissão"
        size="sm"
      >
        {roleChangeTarget && (
          <div className="space-y-6">
            <p className="text-sm text-ink-500">Defina o novo nível de acesso para <strong>{roleChangeTarget.name}</strong>.</p>
            <div className="space-y-3">
              {(['admin', 'medico', 'recepcao'] as UserRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={classNames(
                    "w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group",
                    roleChangeTarget.role === role
                      ? "border-brand-500 bg-brand-50 shadow-sm"
                      : "border-ink-50 hover:border-brand-200 hover:bg-ink-50"
                  )}
                >
                  <div>
                    <p className={classNames("font-black uppercase tracking-widest text-xs", roleChangeTarget.role === role ? "text-brand-700" : "text-ink-900")}>
                      {role}
                    </p>
                    <p className="text-[10px] text-ink-400 font-medium mt-1">
                      {role === 'admin' ? 'Controle total do sistema e IA.' :
                       role === 'medico' ? 'Criação de laudos e gestão de máscaras.' :
                       'Acesso à worklist e cadastro de pacientes.'}
                    </p>
                  </div>
                  {roleChangeTarget.role === role && <CheckCircle2 size={20} className="text-brand-600" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Status Toggle Modal */}
      <ConfirmDialog
        open={statusChangeTarget !== null}
        onConfirm={handleStatusToggle}
        onCancel={() => setStatusChangeTarget(null)}
        title={statusChangeTarget?.active !== false ? "Desativar Usuário" : "Ativar Usuário"}
        message={`Deseja realmente ${statusChangeTarget?.active !== false ? 'desativar' : 'ativar'} o acesso de ${statusChangeTarget?.name}?`}
        confirmLabel={statusChangeTarget?.active !== false ? "Sim, Desativar" : "Sim, Ativar"}
        variant={statusChangeTarget?.active !== false ? "danger" : "info"}
      />

      {/* Delete User Modal */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
        title="Remover Usuário"
        message={`AVISO: Esta ação é irreversível. Todas as permissões de ${deleteTarget?.name} serão revogadas e seu registro removido do banco.`}
        confirmLabel="Sim, Remover Permanentemente"
        variant="danger"
      />
    </div>
  );
}

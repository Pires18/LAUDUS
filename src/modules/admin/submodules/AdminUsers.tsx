import { useState } from 'react';
import { useCollection } from '../../../hooks/useFirestore';
import { UserRole } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useApp } from '../../../store/app';
import { addAuditLog } from '../../../store/db';
import { 
  updateUserRole, 
  setUserActiveStatus, 
  createUserDocument, 
  deleteUserDocument 
} from '../../../store/adminUsers';
import { 
  Search, UserPlus, Shield, MoreVertical, 
  CheckCircle2, XCircle, AlertCircle, Loader2,
  ChevronDown, Trash2, Mail, User, Filter
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLogin?: number;
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Modal/Dialog States
  const [roleChangeTarget, setRoleChangeTarget] = useState<SystemUser | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<SystemUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('medico');

  const { data: users, loading } = useCollection<SystemUser>('users', { isGlobal: true });

  const filtered = users.filter(u => {
    const matchesSearch = 
      u.name?.toLowerCase().includes(search.toLowerCase()) || 
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  async function handleCreateUser() {
    if (!newName || !newEmail || !currentUser) return;
    setIsProcessing('creating');
    try {
      await createUserDocument(
        { name: newName, email: newEmail, role: newRole },
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Admin'
      );
      await addAuditLog({ action: 'CRIAR_USUARIO', details: `Usuário ${newName} (${newEmail}) criado como ${newRole}.`, module: 'AdminUsers' });
      showToast(`Usuário ${newName} criado com sucesso!`, 'success');
      setIsCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
    } catch (err) {
      showToast('Erro ao criar usuário', 'error');
    } finally {
      setIsProcessing(null);
    }
  }

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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      showToast('Erro ao remover usuário', 'error');
    } finally {
      setIsProcessing(null);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">Gestão de Profissionais</h3>
          <p className="text-sm text-ink-500">Controle de acesso e níveis de permissão da plataforma.</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary group">
          <UserPlus size={18} className="group-hover:scale-110 transition-transform" />
          Cadastrar Profissional
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-ink-100 bg-ink-50/10 flex flex-col md:flex-row gap-4">
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
                <th className="px-8 py-5">Usuário & Contato</th>
                <th className="px-8 py-5">Nível de Acesso</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Atividade</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                 [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-10"><div className="h-12 bg-ink-50 rounded-2xl w-full" /></td>
                  </tr>
                ))
              ) : filtered.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50/20 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-black shadow-inner border border-brand-100">
                        {u.name?.charAt(0) || u.email?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-ink-900 group-hover:text-brand-700 transition-colors">{u.name || 'Usuário sem nome'}</p>
                        <p className="text-xs text-ink-500 font-medium">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <button 
                      onClick={() => setRoleChangeTarget(u)}
                      className={classNames(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                        u.role === 'admin' ? "bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 shadow-sm" :
                        u.role === 'medico' ? "bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100 shadow-sm" :
                        "bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100 shadow-sm"
                      )}
                    >
                      <Shield size={12} />
                      {u.role}
                      <ChevronDown size={10} />
                    </button>
                  </td>
                  <td className="px-8 py-6">
                    <button
                      onClick={() => setStatusChangeTarget(u)}
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
                  <td className="px-8 py-6">
                    <p className="text-xs text-ink-600 font-medium">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nenhuma'}
                    </p>
                    <p className="text-[10px] text-ink-400 uppercase font-bold tracking-widest mt-0.5">Último Login</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {isProcessing === u.id ? (
                      <Loader2 size={18} className="animate-spin text-brand-500 ml-auto" />
                    ) : (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setDeleteTarget(u)}
                          className="p-2.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                          title="Remover Usuário"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button className="p-2.5 text-ink-400 hover:bg-ink-100 rounded-xl transition-all">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-ink-100 animate-fade-in-up">
              <h4 className="text-2xl font-black text-ink-900 mb-2">Novo Profissional</h4>
              <p className="text-sm text-ink-500 mb-8 font-medium">Cadastre manualmente os dados de um novo colaborador.</p>
              
              <div className="space-y-6">
                 <div>
                    <label className="label text-[10px] font-black uppercase tracking-widest text-ink-400 mb-2 flex items-center gap-2">
                       <User size={14} /> Nome Completo
                    </label>
                    <input 
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Ex: Dr. Lucas Ribeiro"
                      className="input h-14"
                    />
                 </div>
                 <div>
                    <label className="label text-[10px] font-black uppercase tracking-widest text-ink-400 mb-2 flex items-center gap-2">
                       <Mail size={14} /> E-mail Profissional
                    </label>
                    <input 
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="lucas@clinica.com"
                      className="input h-14"
                    />
                 </div>
                 <div>
                    <label className="label text-[10px] font-black uppercase tracking-widest text-ink-400 mb-2 flex items-center gap-2">
                       <Shield size={14} /> Nível de Acesso
                    </label>
                    <select 
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as any)}
                      className="input h-14 font-bold"
                    >
                       <option value="medico">MÉDICO (Diagnósticos)</option>
                       <option value="admin">ADMIN (Gestão Total)</option>
                       <option value="recepcao">RECEPÇÃO (Agenda)</option>
                    </select>
                 </div>
              </div>

              <div className="flex gap-4 mt-10">
                 <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-ink-400 hover:bg-ink-50 rounded-2xl transition-all"
                 >Cancelar</button>
                 <button 
                  onClick={handleCreateUser}
                  disabled={isProcessing === 'creating' || !newName || !newEmail}
                  className="flex-[2] btn-primary h-14 uppercase text-xs tracking-widest shadow-lg shadow-brand-500/30"
                 >
                    {isProcessing === 'creating' ? <Loader2 size={18} className="animate-spin" /> : 'Finalizar Cadastro'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-ink-100">
            <h4 className="text-xl font-black text-ink-900 mb-2">Alterar Permissão</h4>
            <p className="text-sm text-ink-500 mb-8">Defina o novo nível de acesso para <strong>{roleChangeTarget.name}</strong>.</p>
            
            <div className="space-y-3">
              {(['admin', 'medico', 'recepcao'] as UserRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={classNames(
                    "w-full p-5 rounded-[1.5rem] border-2 text-left transition-all flex items-center justify-between group",
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
            
            <button 
              onClick={() => setRoleChangeTarget(null)}
              className="w-full mt-6 py-4 rounded-2xl text-ink-400 font-black uppercase tracking-widest text-[10px] hover:bg-ink-50 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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

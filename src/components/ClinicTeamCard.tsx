import { useState } from 'react';
import { where, deleteDoc, doc } from 'firebase/firestore';
import { Users, UserPlus, Loader2, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useApp } from '../store/app';
import { auth, firestore } from '../lib/firebase';
import { ClinicMembership, ClinicMemberRole } from '../types';

interface Props {
  clinicId: string;
}

/**
 * Convite e gestão de equipe de uma clínica (multiusuário). O convite em si
 * passa por api/clinic-invite.ts (Admin SDK resolve e-mail→uid e valida
 * posse da clínica); a remoção é permitida direto pelo cliente pelas regras
 * do Firestore (dono ou o próprio membro pode apagar o vínculo).
 */
export function ClinicTeamCard({ clinicId }: Props) {
  const { user, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ClinicMemberRole>('editor');
  const [inviting, setInviting] = useState(false);

  const { data: members, loading } = useCollection<ClinicMembership>('clinic_memberships', {
    isGlobal: true,
    constraints: user ? [where('ownerId', '==', user.uid), where('clinicId', '==', clinicId)] : [],
    queryKey: clinicId,
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/clinic-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ clinicId, inviteEmail: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao convidar usuário.');
      showToast('Convite enviado — a pessoa já tem acesso à clínica.', 'success');
      setEmail('');
    } catch (err: any) {
      showToast(err.message || 'Erro ao convidar usuário.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (membershipId: string) => {
    try {
      await deleteDoc(doc(firestore, 'clinic_memberships', membershipId));
      showToast('Membro removido da clínica.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover membro.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-ink-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-brand-600" />
        <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Equipe da Clínica</h3>
      </div>

      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="email"
          required
          placeholder="e-mail do colaborador"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-sm font-medium outline-none focus:border-brand-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ClinicMemberRole)}
          className="h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-sm font-bold outline-none"
        >
          <option value="editor">Editor</option>
          <option value="viewer">Somente leitura</option>
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="h-10 px-4 bg-brand-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-brand-700 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Convidar
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-ink-400 font-medium">Carregando equipe...</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-ink-400 font-medium">Nenhum colaborador convidado ainda — só você tem acesso a esta clínica.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-ink-50 rounded-xl">
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink-900 truncate">{m.memberEmail}</p>
                <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{m.role === 'editor' ? 'Editor' : 'Somente leitura'}</p>
              </div>
              <button onClick={() => handleRemove(m.id)} className="text-ink-400 hover:text-rose-600 p-1.5 shrink-0" title="Remover">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

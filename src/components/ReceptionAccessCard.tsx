import { useState } from 'react';
import { where, deleteDoc, doc } from 'firebase/firestore';
import { ConciergeBell, Loader2, Trash2, Eye, EyeOff, KeyRound, Dices, CheckCircle2, ClipboardList, CalendarDays, Users, Image as ImageIcon } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useApp } from '../store/app';
import { auth, firestore } from '../lib/firebase';
import { ClinicMembership } from '../types';

interface Props {
  clinicId: string;
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 10; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
}

/**
 * Cadastro do login de RECEPÇÃO da clínica: o dono cria a conta (e-mail +
 * senha) direto daqui — sem a pessoa precisar se registrar antes. A conta
 * nasce com papel 'recepcao': worklist só com laudos finalizados, imagens
 * PACS, agenda completa e pacientes (listar/cadastrar/editar, sem excluir).
 */
export function ReceptionAccessCard({ clinicId }: Props) {
  const { user, showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const { data: members, loading } = useCollection<ClinicMembership>('clinic_memberships', {
    isGlobal: true,
    constraints: user ? [where('ownerId', '==', user.uid), where('clinicId', '==', clinicId)] : [],
    queryKey: `recepcao:${clinicId}`,
  });

  const receptionMembers = members.filter((m) => m.role === 'recepcao');

  async function callReceptionApi(payload: { email: string; password: string; displayName?: string }) {
    const idToken = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/clinic-reception', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ clinicId, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar login de recepção.');
    return data;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      showToast('Informe o e-mail e uma senha com pelo menos 6 caracteres.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await callReceptionApi({
        email: email.trim(),
        password,
        displayName: name.trim() || undefined,
      });
      showToast(
        data.created
          ? 'Login da recepção criado — anote a senha e entregue à equipe.'
          : 'Login da recepção atualizado (senha redefinida).',
        'success'
      );
      setName('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
    } catch (err: any) {
      showToast(err.message || 'Erro ao cadastrar login de recepção.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (m: ClinicMembership) => {
    const newPassword = generatePassword();
    setResettingId(m.id);
    try {
      await callReceptionApi({ email: m.memberEmail, password: newPassword });
      // Mostra a nova senha no próprio formulário para o dono copiar/anotar.
      setEmail(m.memberEmail);
      setPassword(newPassword);
      setShowPassword(true);
      showToast('Nova senha gerada — está visível no formulário acima. Anote e entregue à recepção.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao redefinir a senha.', 'error');
    } finally {
      setResettingId(null);
    }
  };

  const handleRemove = async (membershipId: string) => {
    try {
      await deleteDoc(doc(firestore, 'clinic_memberships', membershipId));
      showToast('Acesso da recepção removido desta clínica.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover acesso.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-ink-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <ConciergeBell size={16} className="text-violet-600" />
        <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Login da Recepção</h3>
      </div>
      <p className="text-xs text-ink-500 mb-3 leading-relaxed">
        Crie aqui a conta que a recepção usa para entrar no LAUD.US. O acesso é restrito ao papel de recepção:
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          { icon: ClipboardList, label: 'Worklist (só finalizados)' },
          { icon: ImageIcon, label: 'Imagens PACS' },
          { icon: CalendarDays, label: 'Agendamentos' },
          { icon: Users, label: 'Pacientes (sem excluir)' },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-100 text-[10px] font-bold text-violet-700">
            <Icon size={11} />
            {label}
          </span>
        ))}
      </div>

      <form onSubmit={handleCreate} className="space-y-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Nome (ex: Recepção Matriz)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400"
          />
          <input
            type="email"
            required
            placeholder="e-mail de acesso da recepção"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 pl-3 pr-16 bg-ink-50 border border-ink-200 rounded-xl text-sm font-medium outline-none focus:border-violet-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}
                className="p-1.5 text-ink-400 hover:text-violet-600 rounded-lg hover:bg-violet-50"
                title="Gerar senha forte"
              >
                <Dices size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="p-1.5 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-ink-100"
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-4 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-violet-500 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Cadastrar Login
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-xs text-ink-400 font-medium">Carregando acessos...</p>
      ) : receptionMembers.length === 0 ? (
        <p className="text-xs text-ink-400 font-medium">Nenhum login de recepção cadastrado para esta clínica.</p>
      ) : (
        <ul className="space-y-2">
          {receptionMembers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-violet-50/50 border border-violet-100 rounded-xl">
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink-900 truncate">{m.memberEmail}</p>
                <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Recepção</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => handleResetPassword(m)}
                  disabled={resettingId === m.id}
                  className="text-ink-400 hover:text-violet-600 p-1.5 rounded-lg hover:bg-violet-100 disabled:opacity-50"
                  title="Gerar nova senha"
                >
                  {resettingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                </button>
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-ink-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50"
                  title="Remover acesso"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

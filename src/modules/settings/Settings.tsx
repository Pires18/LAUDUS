import { useState, FormEvent, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/PageHeader';
import { Settings as SettingsIcon, Save, User, LogOut } from 'lucide-react';

export function Settings() {
  const { settings, updateSettings, showToast } = useApp();
  const { user, signOut } = useAuth();
  
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function u<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(draft);
      showToast('Configurações salvas', 'success');
    } catch {
      showToast('Erro ao salvar', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Configurações"
        subtitle="Preferências do sistema, IA e exportação"
        actions={
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        }
      />

      <div className="space-y-6">
        {/* Account Info */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-3 bg-ink-50/50">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
              <User size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Conta Google</h3>
              <p className="text-xs text-ink-500">Logado no Firebase Cloud</p>
            </div>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User avatar" className="w-12 h-12 rounded-full border border-ink-200" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center text-ink-400">
                  <User size={24} />
                </div>
              )}
              <div>
                <div className="font-medium text-ink-900">{user?.displayName || 'Usuário'}</div>
                <div className="text-sm text-ink-500">{user?.email}</div>
              </div>
            </div>
            <button onClick={signOut} className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50">
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4 text-ink-900">
              <User size={18} className="text-ink-400" />
              <h3 className="font-semibold text-sm uppercase tracking-wide">Dados do Médico Responsável</h3>
            </div>
            <p className="text-xs text-ink-500 mb-5 max-w-2xl">
              Estes dados serão usados para preencher a assinatura padrão no rodapé dos laudos (quando não substituídos pelas configurações de uma clínica específica).
            </p>
            
            <div className="grid grid-cols-2 gap-5 max-w-2xl">
              <div className="col-span-2">
                <label className="label">Nome do Médico</label>
                <input
                  className="input"
                  value={draft.physicianName || ''}
                  onChange={(e) => u('physicianName', e.target.value)}
                  placeholder="Ex: Dr. João da Silva"
                />
              </div>
              <div>
                <label className="label">CRM</label>
                <input
                  className="input"
                  value={draft.physicianCRM || ''}
                  onChange={(e) => u('physicianCRM', e.target.value)}
                  placeholder="Ex: 123456-SP"
                />
              </div>
              <div>
                <label className="label">RQE (Opcional)</label>
                <input
                  className="input"
                  value={draft.physicianRQE || ''}
                  onChange={(e) => u('physicianRQE', e.target.value)}
                  placeholder="Ex: 12345"
                />
              </div>
              <div className="col-span-2">
                <label className="label">Assinatura / Informações Adicionais (Rodapé)</label>
                <textarea
                  className="input min-h-[80px]"
                  value={draft.defaultSignature || ''}
                  onChange={(e) => u('defaultSignature', e.target.value)}
                  placeholder={"Ex: Médico Radiologista\nMembro do Colégio Brasileiro de Radiologia"}
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

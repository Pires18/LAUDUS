import { useState, FormEvent, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/PageHeader';
import { 
  Save, User, LogOut, Sliders, ShieldCheck, 
  Signature, Building2, Bell, Shield, Mail,
  RotateCcw, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { AuditDashboard } from './AuditDashboard';

type SettingsTab = 'perfil' | 'assinatura' | 'sistema' | 'audit';

export function Settings() {
  const { settings, updateSettings, showToast } = useApp();
  const { user, signOut } = useAuth();
  
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function u<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateSettings(draft);
      showToast('Configurações aplicadas com sucesso', 'success');
    } catch {
      showToast('Falha ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  const tabs = [
    { id: 'perfil', label: 'Meu Perfil', icon: User },
    { id: 'assinatura', label: 'Assinatura Médica', icon: Signature },
    { id: 'sistema', label: 'Preferências', icon: Sliders },
    { id: 'audit', label: 'Auditoria & Saúde', icon: ShieldCheck },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie seu perfil, assinatura digital e parâmetros globais."
        actions={
          <div className="flex items-center gap-3">
             <button onClick={() => setDraft(settings)} className="btn-ghost text-ink-400 h-11 px-5 rounded-2xl">
              <RotateCcw size={16} /> <span className="font-bold text-xs uppercase tracking-widest">Descartar</span>
            </button>
            <button className="btn-primary h-11 px-6 rounded-2xl shadow-brand" onClick={handleSave} disabled={isSaving}>
              <Save size={18} /> <span className="font-bold text-xs uppercase tracking-widest">{isSaving ? 'Salvando...' : 'Salvar'}</span>
            </button>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:flex flex-col gap-1 w-64 shrink-0 bg-white p-2 rounded-3xl border border-ink-100 shadow-sm sticky top-24">
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest px-4 py-3">Menu</p>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={classNames(
                "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3",
                activeTab === tab.id 
                  ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-100" 
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <div className={classNames("p-1.5 rounded-lg", activeTab === tab.id ? "bg-brand-100 text-brand-600" : "bg-ink-50 text-ink-400")}>
                <tab.icon size={16} />
              </div>
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 w-full space-y-6">
          {/* Mobile Tabs */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={classNames(
                  "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border flex items-center gap-2",
                  activeTab === tab.id ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-600 border-ink-100"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: PERFIL */}
          {activeTab === 'perfil' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                  <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-6">Informações Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="label">Nome de Exibição</label>
                      <input
                        className="input h-14"
                        value={draft.physicianName || ''}
                        onChange={(e) => u('physicianName', e.target.value)}
                        placeholder="Ex: Dr. João da Silva"
                      />
                    </div>
                    <div>
                      <label className="label">E-mail de Contato</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          className="input pl-11 h-14 bg-ink-50 cursor-not-allowed"
                          readOnly
                          value={user?.email || ''}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Clínica Padrão</label>
                      <div className="relative">
                        <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                        <select
                          className="input pl-11 h-14"
                          value={draft.defaultClinicId || ''}
                          onChange={(e) => u('defaultClinicId', e.target.value)}
                        >
                          <option value="">Nenhuma (Global)</option>
                          {/* Clinics are loaded from DB, assuming they are available in a provider or hook */}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-3xl border border-amber-200 p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Shield size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900">Modo de Acesso (RBAC)</h4>
                      <p className="text-sm text-amber-700 mb-4 leading-relaxed">
                        Defina o seu perfil de acesso para simular as permissões do sistema.
                      </p>
                      <select
                        className="input border-amber-300 bg-white h-12"
                        value={draft.currentRole || 'medico'}
                        onChange={(e) => u('currentRole', e.target.value as any)}
                      >
                        <option value="admin">Administrador (Acesso Total)</option>
                        <option value="medico">Médico (Worklist e Laudos)</option>
                        <option value="recepcao">Recepção (Apenas Worklist)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden text-center p-8 sticky top-24">
                  <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 p-1 shadow-lg">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-full h-full rounded-full border-2 border-white object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-brand-500 font-black text-3xl">
                          {user?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <h3 className="font-black text-ink-900 text-xl">{user?.displayName || 'Usuário'}</h3>
                  <p className="text-sm text-ink-500 mb-8">{user?.email}</p>
                  
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-ink-50 border border-ink-100 text-xs text-ink-600 font-bold uppercase tracking-widest">
                      Assinatura: {draft.physicianCRM ? 'Ativa' : 'Pendente'}
                    </div>
                    <button onClick={signOut} className="w-full py-3 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-bold text-sm hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
                      <LogOut size={16} /> Encerrar Sessão
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ASSINATURA */}
          {activeTab === 'assinatura' && (
            <div className="max-w-3xl space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Signature size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-ink-900">Cédula de Identidade Médica</h3>
                    <p className="text-sm text-ink-500">Dados usados no rodapé e selo de autenticidade dos laudos.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="label">Número do CRM</label>
                    <input
                      className="input h-14"
                      value={draft.physicianCRM || ''}
                      onChange={(e) => u('physicianCRM', e.target.value)}
                      placeholder="Ex: 123456-SP"
                    />
                  </div>
                  <div>
                    <label className="label">RQE (Especialidade)</label>
                    <input
                      className="input h-14"
                      value={draft.physicianRQE || ''}
                      onChange={(e) => u('physicianRQE', e.target.value)}
                      placeholder="Ex: 12345"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-ink-50">
                  <label className="label">Texto da Assinatura Digital</label>
                  <textarea
                    className="input min-h-[120px] p-6 text-sm leading-relaxed"
                    value={draft.defaultSignature || ''}
                    onChange={(e) => u('defaultSignature', e.target.value)}
                    placeholder={"Ex: Médico Radiologista\nMembro Titular do CBR"}
                  />
                  <p className="text-[11px] text-ink-400 italic">Este texto aparecerá centralizado no final de todos os seus laudos gerados.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIT */}
          {activeTab === 'audit' && (
            <div className="animate-fade-in">
              <AuditDashboard />
            </div>
          )}

          {/* TAB: SISTEMA */}
          {activeTab === 'sistema' && (
            <div className="max-w-3xl space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-6">Preferências Globais</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-ink-50 border border-ink-100">
                    <div className="flex items-center gap-3">
                      <Bell size={20} className="text-brand-600" />
                      <div>
                        <p className="text-sm font-bold text-ink-900">Notificações Sonoras</p>
                        <p className="text-xs text-ink-500">Alertas ao receber novos exames na worklist.</p>
                      </div>
                    </div>
                    <div className="w-10 h-6 bg-ink-200 rounded-full relative cursor-pointer opacity-50">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-ink-50 border border-ink-100">
                    <div className="flex items-center gap-3">
                      <Clock size={20} className="text-indigo-600" />
                      <div>
                        <p className="text-sm font-bold text-ink-900">Salvamento Automático</p>
                        <p className="text-xs text-ink-500">Persistir rascunhos a cada 30 segundos no editor.</p>
                      </div>
                    </div>
                    <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, FormEvent, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useFirestore';
import { Clinic } from '../../types';
import { PageHeader } from '../../components/PageHeader';
import { 
  Save, User, LogOut, Sliders, ShieldCheck, 
  Signature, Building2, Bell, Mail,
  RotateCcw, Clock, Database, Info, Upload, Loader2,
  Server, Wifi, Monitor, HardDrive, Plus, Trash2, Shield
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { AuditDashboard } from './AuditDashboard';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, firestore, auth } from '../../lib/firebase';
import { addAuditLog } from '../../store/db';

type SettingsTab = 'perfil' | 'assinatura' | 'sistema' | 'dicom' | 'audit';

export function Settings() {
  const { settings, updateSettings, showToast } = useApp();
  const { user, signOut } = useAuth();
  const { data: clinics } = useCollection<Clinic>('clinics');
  
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil');

  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  const [pacsTestState, setPacsTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pacsTestResults, setPacsTestResults] = useState<{
    primaryOk: boolean;
    backupOk: boolean;
    primaryMsg?: string;
    backupMsg?: string;
  } | null>(null);

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
      
      // Grava log de auditoria
      await addAuditLog({
        action: 'ATUALIZAR_CONFIGURACOES',
        details: `Configurações do médico ${draft.physicianName || user?.displayName || user?.email} atualizadas com sucesso.`,
        module: 'PERFIL'
      });

      showToast('Configurações aplicadas com sucesso', 'success');
    } catch {
      showToast('Falha ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProfilePictureUpload(file: File) {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      showToast('Selecione uma imagem válida', 'error');
      return;
    }
    setIsUploadingProfile(true);
    try {
      const path = `users/${user.uid}/profile-picture/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Atualiza o Firebase Auth User Profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
      }
      
      // Atualiza o documento de usuário no Firestore
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, { photoURL: url, updatedAt: Date.now() });

      showToast('Foto de perfil atualizada com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro de upload da foto:', err);
      showToast('Erro ao atualizar foto de perfil no Storage.', 'error');
    } finally {
      setIsUploadingProfile(false);
    }
  }

  async function handleSignatureImageUpload(file: File) {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      showToast('Selecione uma imagem válida', 'error');
      return;
    }
    setIsUploadingSignature(true);
    try {
      const path = `users/${user.uid}/signatures/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Atualiza o draft local
      u('signatureImageUrl', url);
      showToast('Imagem de assinatura carregada! Clique em Salvar para gravar.', 'success');
    } catch (err: any) {
      console.error('Erro de upload da assinatura:', err);
      showToast('Erro ao carregar assinatura digitalizada.', 'error');
    } finally {
      setIsUploadingSignature(false);
    }
  }

  async function handleTestPacsConnection() {
    setPacsTestState('testing');
    setPacsTestResults(null);
    try {
      const primaryUrl = draft.dicomViewerUrl || 'http://localhost:8042';
      const primaryAuth = `&username=${encodeURIComponent(draft.dicomUsername || '')}&password=${encodeURIComponent(draft.dicomPassword || '')}`;
      
      const backupUrl = draft.dicomBackupViewerUrl;
      const backupAuth = backupUrl ? `&username=${encodeURIComponent(draft.dicomBackupUsername || '')}&password=${encodeURIComponent(draft.dicomBackupPassword || '')}` : '';

      // Test Primary
      const testPrimary = async () => {
        const pingUrl = `${primaryUrl.replace(/\/$/, '')}/system`;
        try {
          const res = await fetch(`/api/orthanc-proxy?url=${encodeURIComponent(pingUrl)}${primaryAuth}`);
          if (res.ok) {
            const data = await res.json();
            return { ok: true, msg: `Conectado! Versão Orthanc: ${data.Version || 'OK'}` };
          }
          return { ok: false, msg: `Erro HTTP ${res.status}: ${res.statusText || 'Falha de Autenticação/Proxy'}` };
        } catch (e: any) {
          return { ok: false, msg: e.message || 'Erro de rede ou conexão recusada' };
        }
      };

      // Test Backup
      const testBackup = async () => {
        if (!backupUrl) return { ok: false, msg: 'Servidor backup não configurado' };
        const pingUrl = `${backupUrl.replace(/\/$/, '')}/system`;
        try {
          const res = await fetch(`/api/orthanc-proxy?url=${encodeURIComponent(pingUrl)}${backupAuth}`);
          if (res.ok) {
            const data = await res.json();
            return { ok: true, msg: `Conectado! Versão Orthanc: ${data.Version || 'OK'}` };
          }
          return { ok: false, msg: `Erro HTTP ${res.status}: ${res.statusText || 'Falha de Autenticação/Proxy'}` };
        } catch (e: any) {
          return { ok: false, msg: e.message || 'Erro de rede ou conexão recusada' };
        }
      };

      const [primaryRes, backupRes] = await Promise.all([
        testPrimary(),
        backupUrl ? testBackup() : Promise.resolve({ ok: false, msg: 'Nenhum backup configurado' })
      ]);

      setPacsTestResults({
        primaryOk: primaryRes.ok,
        backupOk: backupRes.ok,
        primaryMsg: primaryRes.msg,
        backupMsg: backupUrl ? backupRes.msg : undefined
      });
      
      const success = primaryRes.ok && (!backupUrl || backupRes.ok);
      setPacsTestState(success ? 'success' : 'error');
      
      if (primaryRes.ok) {
        showToast('PACS Principal conectado com sucesso!', 'success');
      } else {
        showToast('Erro de conexão com o PACS Principal.', 'error');
      }
    } catch (err: any) {
      setPacsTestState('error');
      setPacsTestResults({
        primaryOk: false,
        backupOk: false,
        primaryMsg: err.message || 'Falha crítica ao testar conexão.'
      });
      showToast('Erro crítico ao testar conexões.', 'error');
    }
  }

  const handleAddDevice = () => {
    const newDevice = { id: Date.now().toString(), name: 'Novo Aparelho', aeTitle: 'AETITLE', modality: 'US' };
    setDraft(d => ({ ...d, dicomDevices: [...(d.dicomDevices || []), newDevice] }));
  };
  const handleRemoveDevice = (id: string) => {
    setDraft(d => ({ ...d, dicomDevices: (d.dicomDevices || []).filter(x => x.id !== id) }));
  };
  const handleUpdateDevice = (id: string, field: string, value: string) => {
    setDraft(d => ({ ...d, dicomDevices: (d.dicomDevices || []).map(x => x.id === id ? { ...x, [field]: value } : x) }));
  };

  const tabs = [
    { id: 'perfil', label: 'Meu Perfil', icon: User },
    { id: 'assinatura', label: 'Assinatura Médica', icon: Signature },
    { id: 'sistema', label: 'Preferências', icon: Sliders },
    { id: 'dicom', label: 'Integração PACS', icon: Database },
    { id: 'audit', label: 'Auditoria & Saúde', icon: ShieldCheck },
  ] as const;

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
      <PageHeader
        title="Meu Perfil"
        subtitle="Gerencie sua identidade médica, assinatura digital e preferências de sistema."
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
                          {clinics.filter(c => c.active).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-3xl border border-ink-100 shadow-sm overflow-hidden text-center p-8 sticky top-24">
                  <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 p-1 shadow-lg overflow-hidden relative">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-full h-full rounded-full border-2 border-white object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-brand-500 font-black text-3xl">
                          {user?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isUploadingProfile && (
                        <div className="absolute inset-0 bg-white/85 flex items-center justify-center rounded-full">
                          <Loader2 className="animate-spin text-brand-600" size={24} />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>

                  <label className="mx-auto max-w-[160px] mb-6 py-2 px-3 rounded-xl bg-ink-50 hover:bg-ink-100 text-ink-600 border border-ink-100 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload size={12} />
                    {isUploadingProfile ? 'Enviando...' : 'Alterar Foto'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      disabled={isUploadingProfile} 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProfilePictureUpload(file);
                      }} 
                    />
                  </label>
                  
                  <h3 className="font-black text-ink-900 text-xl">{draft.physicianName || user?.displayName || 'Usuário'}</h3>
                  <p className="text-sm text-ink-500 mb-8">{user?.email}</p>
                  
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-100 text-xs text-brand-700 font-black uppercase tracking-widest leading-relaxed">
                      Assinatura Médica: {draft.physicianCRM ? '✓ Ativa e Vinculada' : '⚠️ Pendente de Configuração'}
                    </div>
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

                <div className="space-y-4 py-6 border-t border-ink-50">
                  <label className="label">Assinatura Digitalizada (Imagem)</label>
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-ink-50/50 rounded-2xl border border-ink-100">
                    <div className="w-40 h-20 bg-white border border-ink-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 relative">
                      {draft.signatureImageUrl ? (
                        <img src={draft.signatureImageUrl} alt="Assinatura" className="max-w-full max-h-full object-contain p-2" />
                      ) : (
                        <span className="text-[10px] font-bold text-ink-400 uppercase">Sem Imagem</span>
                      )}
                      {isUploadingSignature && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="animate-spin text-brand-600" size={20} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 w-full space-y-3 text-left">
                      <p className="text-xs text-ink-500 leading-relaxed">
                        Faça upload da imagem da sua assinatura manuscrita (preferencialmente com fundo transparente em formato PNG) para exibição direta nos laudos impressos ou copiados.
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <label className="py-2 px-4 rounded-xl bg-white hover:bg-ink-100 text-ink-700 border border-ink-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95">
                          <Upload size={14} />
                          {isUploadingSignature ? 'Enviando...' : 'Carregar Imagem'}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            disabled={isUploadingSignature} 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleSignatureImageUpload(file);
                            }} 
                          />
                        </label>
                        
                        {draft.signatureImageUrl && (
                          <button
                            type="button"
                            onClick={() => u('signatureImageUrl', '')}
                            className="py-2 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
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
                    <button
                      type="button"
                      onClick={() => u('soundNotifications', draft.soundNotifications === false)}
                      className={classNames(
                        "w-12 h-7 rounded-full transition-all relative shrink-0",
                        draft.soundNotifications !== false ? "bg-emerald-500" : "bg-ink-300"
                      )}
                    >
                      <div className={classNames(
                        "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                        draft.soundNotifications !== false ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-ink-50 border border-ink-100">
                    <div className="flex items-center gap-3">
                      <Clock size={20} className="text-indigo-600" />
                      <div>
                        <p className="text-sm font-bold text-ink-900">Salvamento Automático</p>
                        <p className="text-xs text-ink-500">Persistir rascunhos automaticamente no editor conforme digitação.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => u('autoSave', draft.autoSave === false)}
                      className={classNames(
                        "w-12 h-7 rounded-full transition-all relative shrink-0",
                        draft.autoSave !== false ? "bg-emerald-500" : "bg-ink-300"
                      )}
                    >
                      <div className={classNames(
                        "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                        draft.autoSave !== false ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DICOM/PACS */}
          {activeTab === 'dicom' && (
            <div className="max-w-4xl space-y-6 animate-fade-in mx-auto">
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Database size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-ink-900">Integração PACS / DICOM</h3>
                    <p className="text-sm text-ink-500">Gestão de Servidores PACS, Equipamentos Médicos e Envio de Worklist.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  
                  {/* CARD 1: SERVIDOR PACS PRINCIPAL */}
                  <div className="p-6 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-ink-50">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                        <Server size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Servidor PACS Principal (Matriz)</h4>
                        <p className="text-xs text-ink-500">Configurações do Orthanc e agente local de Worklist principal.</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-xl bg-ink-50 border border-ink-100 mb-6">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-ink-900">Sincronização de Worklist Local</p>
                        <p className="text-xs text-ink-500">Gerar arquivos .wl na pasta de destino sempre que um exame for criado.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => u('dicomSyncEnabled', !draft.dicomSyncEnabled)}
                        className={classNames(
                          "w-12 h-7 rounded-full transition-all relative",
                          draft.dicomSyncEnabled ? "bg-emerald-500" : "bg-ink-300"
                        )}
                      >
                        <div className={classNames(
                          "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                          draft.dicomSyncEnabled ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <label className="label">URL Base do Servidor Orthanc</label>
                        <input
                          className="input h-12 text-sm"
                          value={draft.dicomViewerUrl || ''}
                          onChange={(e) => u('dicomViewerUrl', e.target.value)}
                          placeholder="Ex: https://servidor-mac.tail861dda.ts.net"
                        />
                      </div>
                      <div>
                        <label className="label">Usuário Orthanc</label>
                        <input
                          className="input h-12 text-sm"
                          value={draft.dicomUsername || ''}
                          onChange={(e) => u('dicomUsername', e.target.value)}
                          placeholder="Ex: admin"
                        />
                      </div>
                      <div>
                        <label className="label">Senha Orthanc</label>
                        <input
                          type="password"
                          className="input h-12 text-sm"
                          value={draft.dicomPassword || ''}
                          onChange={(e) => u('dicomPassword', e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">URL do Agente Local (Vercel para Local)</label>
                        <input
                          className="input h-12 text-sm"
                          value={draft.dicomLocalAgentUrl || ''}
                          onChange={(e) => u('dicomLocalAgentUrl', e.target.value)}
                          placeholder="Ex: https://servidor-mac.tail861dda.ts.net"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Diretório da Worklist no Servidor (Caminho Absoluto)</label>
                        <input
                          className="input h-12 text-sm"
                          value={draft.dicomWorklistFolder || ''}
                          onChange={(e) => u('dicomWorklistFolder', e.target.value)}
                          placeholder="Ex: C:\OrthancServer\db\WorklistsDatabase\"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Tipo de Visualizador DICOM</label>
                        <select
                          className="input h-12 text-sm"
                          value={draft.dicomViewerType || 'stone'}
                          onChange={(e) => {
                            const type = e.target.value as any;
                            u('dicomViewerType', type);
                            if (type === 'stone') {
                              u('dicomViewerUrlPattern', '{{baseUrl}}/stone-webviewer/index.html?study=1.2.276.0.7230010.3.1.2.{{examId}}');
                            } else if (type === 'oe2') {
                              u('dicomViewerUrlPattern', '{{baseUrl}}/ui/app/retrieve-and-view.html?StudyInstanceUID=1.2.276.0.7230010.3.1.2.{{examId}}');
                            } else if (type === 'ohif') {
                              u('dicomViewerUrlPattern', '{{baseUrl}}/viewer?StudyInstanceUIDs=1.2.276.0.7230010.3.1.2.{{examId}}');
                            }
                          }}
                        >
                          <option value="stone">Stone Web Viewer</option>
                          <option value="oe2">Orthanc Explorer 2</option>
                          <option value="ohif">OHIF Viewer</option>
                          <option value="custom">Personalizado (Padrão de URL)</option>
                        </select>
                      </div>
                      {draft.dicomViewerType === 'custom' && (
                        <div className="md:col-span-2">
                          <label className="label">Padrão da URL do Visualizador</label>
                          <input
                            className="input h-12 text-sm"
                            value={draft.dicomViewerUrlPattern || ''}
                            onChange={(e) => u('dicomViewerUrlPattern', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2: SERVIDOR PACS DE BACKUP */}
                  <div className="p-6 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-ink-50">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <HardDrive size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Servidor PACS de Backup (Redundância)</h4>
                        <p className="text-xs text-ink-500">Sincronização em tempo real para um servidor Orthanc secundário (ex: Notebook).</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-xl bg-ink-50 border border-ink-100 mb-6">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-ink-900">Habilitar Servidor de Redundância</p>
                        <p className="text-xs text-ink-500">Enviar worklists paralelamente para o servidor de backup.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => u('dicomBackupSyncEnabled', !draft.dicomBackupSyncEnabled)}
                        className={classNames(
                          "w-12 h-7 rounded-full transition-all relative",
                          draft.dicomBackupSyncEnabled ? "bg-emerald-500" : "bg-ink-300"
                        )}
                      >
                        <div className={classNames(
                          "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                          draft.dicomBackupSyncEnabled ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>

                    {draft.dicomBackupSyncEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                        <div className="md:col-span-2">
                          <label className="label">URL Base do Servidor Orthanc Backup</label>
                          <input
                            className="input h-12 text-sm"
                            value={draft.dicomBackupViewerUrl || ''}
                            onChange={(e) => u('dicomBackupViewerUrl', e.target.value)}
                            placeholder="Ex: https://servidor-notebook.tail861dda.ts.net:8043"
                          />
                        </div>
                        <div>
                          <label className="label">Usuário Orthanc Backup</label>
                          <input
                            className="input h-12 text-sm"
                            value={draft.dicomBackupUsername || ''}
                            onChange={(e) => u('dicomBackupUsername', e.target.value)}
                            placeholder="Ex: admin"
                          />
                        </div>
                        <div>
                          <label className="label">Senha Orthanc Backup</label>
                          <input
                            type="password"
                            className="input h-12 text-sm"
                            value={draft.dicomBackupPassword || ''}
                            onChange={(e) => u('dicomBackupPassword', e.target.value)}
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">URL do Agente Local do Backup</label>
                          <input
                            className="input h-12 text-sm"
                            value={draft.dicomBackupLocalAgentUrl || ''}
                            onChange={(e) => u('dicomBackupLocalAgentUrl', e.target.value)}
                            placeholder="Ex: https://servidor-notebook.tail861dda.ts.net"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Diretório da Worklist do Backup (Caminho Absoluto)</label>
                          <input
                            className="input h-12 text-sm"
                            value={draft.dicomBackupWorklistFolder || ''}
                            onChange={(e) => u('dicomBackupWorklistFolder', e.target.value)}
                            placeholder="Ex: C:\OrthancServer\db\WorklistsDatabase\"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TESTE DE REDE */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Validar Conexões de Rede</p>
                      <p className="text-xs text-slate-400">Verifique se os servidores Orthanc (Principal e Backup) estão respondendo.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestPacsConnection}
                      disabled={pacsTestState === 'testing'}
                      className="py-2.5 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-brand-400 text-white font-bold text-xs tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
                    >
                      {pacsTestState === 'testing' ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                      {pacsTestState === 'testing' ? 'TESTANDO...' : 'TESTAR PACS'}
                    </button>
                  </div>
                  {pacsTestResults && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in -mt-4">
                      <div className={classNames("p-4 rounded-xl border text-xs", pacsTestResults.primaryOk ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-red-50/50 border-red-100 text-red-800")}>
                        <p className="font-bold mb-1 flex items-center gap-1.5"><span className={classNames("w-2 h-2 rounded-full", pacsTestResults.primaryOk ? "bg-emerald-500 animate-pulse" : "bg-red-500")} /> PACS Principal</p>
                        <p className="mt-1 text-[11px] opacity-80">{pacsTestResults.primaryMsg}</p>
                      </div>
                      {draft.dicomBackupViewerUrl && (
                        <div className={classNames("p-4 rounded-xl border text-xs", pacsTestResults.backupOk ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-red-50/50 border-red-100 text-red-800")}>
                          <p className="font-bold mb-1 flex items-center gap-1.5"><span className={classNames("w-2 h-2 rounded-full", pacsTestResults.backupOk ? "bg-emerald-500 animate-pulse" : "bg-red-500")} /> PACS Backup</p>
                          <p className="mt-1 text-[11px] opacity-80">{pacsTestResults.backupMsg}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD 3: APARELHOS MÉDICOS */}
                  <div className="p-6 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                          <Monitor size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-ink-900">Aparelhos e Equipamentos</h4>
                          <p className="text-xs text-ink-500">Cadastre seus aparelhos de ultrassom, ressonância, etc.</p>
                        </div>
                      </div>
                      <button type="button" onClick={handleAddDevice} className="btn-ghost bg-brand-50 hover:bg-brand-100 text-brand-700 h-9 px-3 rounded-xl flex items-center gap-1 text-xs font-bold">
                        <Plus size={14} /> NOVO
                      </button>
                    </div>

                    {(!draft.dicomDevices || draft.dicomDevices.length === 0) ? (
                      <div className="text-center py-8 bg-ink-50 rounded-xl border border-ink-100 border-dashed">
                        <Monitor size={32} className="mx-auto text-ink-300 mb-3" />
                        <p className="text-sm font-bold text-ink-900">Nenhum aparelho cadastrado</p>
                        <p className="text-xs text-ink-500 max-w-sm mx-auto mt-1">Adicione seus aparelhos para poder selecionar o destino correto ao criar um laudo.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {draft.dicomDevices.map((device, index) => (
                          <div key={device.id} className="p-4 rounded-xl border border-ink-150 bg-ink-50/50 flex flex-col md:flex-row gap-4 items-start md:items-center relative animate-fade-in group">
                            {index === 0 && (
                              <span className="absolute -top-2 -left-2 bg-brand-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                                Padrão
                              </span>
                            )}
                            
                            <div className="flex-1 w-full space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-[10px] font-black uppercase text-ink-400 block mb-1">Nome do Aparelho</label>
                                  <input 
                                    className="input h-10 text-xs w-full bg-white" 
                                    value={device.name} 
                                    onChange={(e) => handleUpdateDevice(device.id, 'name', e.target.value)} 
                                    placeholder="Ex: GE Voluson S10"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-ink-400 block mb-1">AE Title</label>
                                  <input 
                                    className="input h-10 text-xs w-full bg-white font-mono" 
                                    value={device.aeTitle} 
                                    onChange={(e) => handleUpdateDevice(device.id, 'aeTitle', e.target.value.toUpperCase())} 
                                    placeholder="Ex: GE_VOLUSON"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-ink-400 block mb-1">Modalidade</label>
                                  <select 
                                    className="input h-10 text-xs w-full bg-white" 
                                    value={device.modality} 
                                    onChange={(e) => handleUpdateDevice(device.id, 'modality', e.target.value)}
                                  >
                                    <option value="US">US (Ultrassom)</option>
                                    <option value="CR">CR (Raio-X CR)</option>
                                    <option value="CT">CT (Tomografia)</option>
                                    <option value="MR">MR (Ressonância)</option>
                                    <option value="DX">DX (Raio-X DX)</option>
                                    <option value="MG">MG (Mamografia)</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            
                            <button 
                              type="button" 
                              onClick={() => handleRemoveDevice(device.id)}
                              className="md:mt-5 p-2.5 rounded-lg text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CARD 4: CONFIGURAÇÕES GLOBAIS E MANUAL */}
                  <div className="p-6 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-ink-50">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                        <Shield size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Configurações Globais DICOM</h4>
                        <p className="text-xs text-ink-500">AE Title do seu servidor Orthanc.</p>
                      </div>
                    </div>
                    
                    <div className="mb-8 max-w-sm">
                      <label className="label">AE Title do Servidor Orthanc</label>
                      <input
                        className="input h-12 text-sm font-mono"
                        value={draft.dicomOrthancAETitle || ''}
                        onChange={(e) => u('dicomOrthancAETitle', e.target.value.toUpperCase())}
                        placeholder="Ex: ORTHANC"
                      />
                    </div>

                    <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-inner">
                      <div className="flex items-center gap-3 mb-4">
                        <Info size={18} className="text-brand-400" />
                        <h4 className="text-sm font-bold text-white">Manual de Conexão no Aparelho</h4>
                      </div>
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                        No seu aparelho de Ultrassom, cadastre o Servidor DICOM Worklist utilizando os dados abaixo para puxar a lista de pacientes gerada pelo Laud.us.
                      </p>
                      <ul className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800/50 text-brand-400">
                        <li>
                          <span className="text-slate-500">IP do Servidor:</span> {(() => {
                            try { return draft.dicomViewerUrl ? new URL(draft.dicomViewerUrl).hostname : 'IP_DO_SERVIDOR'; } catch { return 'IP_DO_SERVIDOR'; }
                          })()}
                        </li>
                        <li><span className="text-slate-500">Porta DICOM:</span> 4242</li>
                        <li><span className="text-slate-500">AE Title:</span> {draft.dicomOrthancAETitle || 'ORTHANC'}</li>
                      </ul>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      </div>
    </div>
  );
}

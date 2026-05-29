import { useState, FormEvent, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useFirestore';
import { Clinic } from '../../types';
import { PageHeader } from '../../components/PageHeader';
import { 
  Save, User, LogOut, Sliders, ShieldCheck, 
  Signature, Building2, Bell, Mail,
  RotateCcw, Clock, Database, Info, Upload, Loader2
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
            <div className="max-w-3xl space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl border border-ink-100 shadow-sm p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Database size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-ink-900">Integração PACS / DICOM Worklist</h3>
                    <p className="text-sm text-ink-500">Configure como o Laud.us exporta os exames para a sua worklist local do Orthanc.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Habilitar Sincronização */}
                  <div className="flex items-center justify-between p-5 rounded-2xl bg-ink-50 border border-ink-100">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-ink-900">Sincronização com Worklist do Orthanc</p>
                      <p className="text-xs text-ink-500">Salvar arquivos .wl na pasta de destino na criação/exclusão de exames.</p>
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

                  {/* Teste de Conectividade PACS */}
                  <div className="p-5 rounded-2xl bg-ink-50 border border-ink-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-ink-900">Validar Conectividade PACS</p>
                        <p className="text-xs text-ink-500">Testa a comunicação em tempo real com as URLs de rede configuradas.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestPacsConnection}
                        disabled={pacsTestState === 'testing'}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {pacsTestState === 'testing' ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Testando...</span>
                          </>
                        ) : (
                          <>
                            <Database size={14} />
                            <span>Testar Conexão</span>
                          </>
                        )}
                      </button>
                    </div>

                    {pacsTestResults && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-ink-150 animate-fade-in">
                        {/* Principal results */}
                        <div className={classNames(
                          "p-4 rounded-xl border text-xs leading-relaxed",
                          pacsTestResults.primaryOk ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-red-50/50 border-red-100 text-red-800"
                        )}>
                          <p className="font-bold flex items-center gap-1.5 mb-1.5">
                            <span className={classNames("w-2 h-2 rounded-full", pacsTestResults.primaryOk ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                            PACS Principal (Porta HTTP)
                          </p>
                          <p className="font-mono text-[10px] break-all">{draft.dicomViewerUrl || 'http://localhost:8042'}</p>
                          <p className="mt-1 text-[11px] font-medium italic">{pacsTestResults.primaryMsg}</p>
                        </div>

                        {/* Backup results */}
                        {draft.dicomBackupViewerUrl && (
                          <div className={classNames(
                            "p-4 rounded-xl border text-xs leading-relaxed",
                            pacsTestResults.backupOk ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-red-50/50 border-red-100 text-red-800"
                          )}>
                            <p className="font-bold flex items-center gap-1.5 mb-1.5">
                              <span className={classNames("w-2 h-2 rounded-full", pacsTestResults.backupOk ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                              PACS Backup (Porta HTTP)
                            </p>
                            <p className="font-mono text-[10px] break-all">{draft.dicomBackupViewerUrl}</p>
                            <p className="mt-1 text-[11px] font-medium italic">{pacsTestResults.backupMsg}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Predefinições Rápidas (Presets) */}
                  <div className="p-5 rounded-2xl bg-brand-50/40 border border-brand-100">
                    <p className="text-sm font-bold text-ink-900 mb-1">Predefinição de Servidor (Preset)</p>
                    <p className="text-xs text-ink-500 mb-4">Escolha rapidamente entre as configurações do Servidor Principal ou do Backup do Notebook.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dicomPreset: 'macmini',
                            dicomWorklistFolder: '/Users/matheuskistenmackerpires/Documents/OrthancServer/db/WorklistsDatabase/',
                            dicomViewerUrl: 'http://100.93.111.95:8042',
                            dicomOrthancAETitle: 'ORTHANCPACS',
                            dicomViewerType: 'stone',
                            dicomViewerUrlPattern: '{{baseUrl}}/stone-webviewer/index.html?study=1.2.276.0.7230010.3.1.2.{{examId}}'
                          }));
                        }}
                        className={classNames(
                          "p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-24",
                          draft.dicomPreset === 'macmini'
                            ? "bg-white border-brand-500 shadow-sm"
                            : "bg-white/50 border-ink-150 hover:bg-white"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-600">Servidor Principal</span>
                        <div>
                          <p className="text-xs font-black text-ink-900 leading-tight">Mac Mini</p>
                          <p className="text-[9px] text-ink-400 mt-0.5">IP 100.93.111.95</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dicomPreset: 'notebook',
                            dicomWorklistFolder: 'C:\\OrthancServer\\db\\WorklistsDatabase\\',
                            dicomViewerUrl: 'http://localhost:8043',
                            dicomOrthancAETitle: 'ORTHANCBACKUP',
                            dicomViewerType: 'stone',
                            dicomViewerUrlPattern: '{{baseUrl}}/stone-webviewer/index.html?study=1.2.276.0.7230010.3.1.2.{{examId}}'
                          }));
                        }}
                        className={classNames(
                          "p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-24",
                          draft.dicomPreset === 'notebook'
                            ? "bg-white border-brand-500 shadow-sm"
                            : "bg-white/50 border-ink-150 hover:bg-white"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-600">Servidor Backup</span>
                        <div>
                          <p className="text-xs font-black text-ink-900 leading-tight">Notebook Local</p>
                          <p className="text-[9px] text-ink-400 mt-0.5">Porta 8043 (Docker)</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraft((d) => ({
                            ...d,
                            dicomPreset: 'custom'
                          }));
                        }}
                        className={classNames(
                          "p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-24",
                          draft.dicomPreset === 'custom' || (!draft.dicomPreset)
                            ? "bg-white border-brand-500 shadow-sm"
                            : "bg-white/50 border-ink-150 hover:bg-white"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">Personalizado</span>
                        <div>
                          <p className="text-xs font-black text-ink-900 leading-tight">Outro Servidor</p>
                          <p className="text-[9px] text-ink-400 mt-0.5">Definir campos abaixo</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Caminho da Pasta */}
                  <div>
                    <label className="label">Diretório da Worklist no Servidor (Caminho Absoluto)</label>
                    <input
                      className="input h-14"
                      value={draft.dicomWorklistFolder || ''}
                      onChange={(e) => {
                        u('dicomWorklistFolder', e.target.value);
                        u('dicomPreset', 'custom');
                      }}
                      placeholder="Ex: /Users/usuario/Documents/OrthancServer/db/WorklistsDatabase/"
                    />
                    <p className="text-[11px] text-ink-400 mt-1">Diretório onde o Orthanc lê os arquivos .wl. A aplicação deve ter permissão de escrita.</p>
                  </div>

                  {/* URL do Visualizador Orthanc */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">URL Base do Servidor Orthanc</label>
                      <input
                        className="input h-14"
                        value={draft.dicomViewerUrl || ''}
                        onChange={(e) => {
                          u('dicomViewerUrl', e.target.value);
                          u('dicomPreset', 'custom');
                        }}
                        placeholder="Ex: http://localhost:8042"
                      />
                      <p className="text-[11px] text-ink-400 mt-1">Endereço HTTP do servidor Orthanc (ex: IP local ou Tailscale).</p>
                    </div>

                    <div>
                      <label className="label">Tipo de Visualizador DICOM</label>
                      <select
                        className="input h-14"
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
                        <option value="stone">Stone Web Viewer (Orthanc)</option>
                        <option value="oe2">Orthanc Explorer 2</option>
                        <option value="ohif">OHIF Viewer</option>
                        <option value="custom">Personalizado (Padrão de URL)</option>
                      </select>
                      <p className="text-[11px] text-ink-400 mt-1">Formato do link gerado para abrir exames diretamente.</p>
                    </div>

                    <div>
                      <label className="label">Usuário do Orthanc (PACS)</label>
                      <input
                        className="input h-14"
                        value={draft.dicomUsername || ''}
                        onChange={(e) => {
                          u('dicomUsername', e.target.value);
                          u('dicomPreset', 'custom');
                        }}
                        placeholder="Ex: orthanc"
                      />
                      <p className="text-[11px] text-ink-400 mt-1">Usuário para autenticação básica no servidor Orthanc local.</p>
                    </div>

                    <div>
                      <label className="label">Senha do Orthanc (PACS)</label>
                      <input
                        type="password"
                        className="input h-14"
                        value={draft.dicomPassword || ''}
                        onChange={(e) => {
                          u('dicomPassword', e.target.value);
                          u('dicomPreset', 'custom');
                        }}
                        placeholder="Ex: orthanc"
                      />
                      <p className="text-[11px] text-ink-400 mt-1">Senha para autenticação básica no servidor Orthanc local.</p>
                    </div>
                  </div>

                  {draft.dicomViewerType === 'custom' && (
                    <div className="animate-fade-in">
                      <label className="label">Padrão da URL do Visualizador</label>
                      <input
                        className="input h-14"
                        value={draft.dicomViewerUrlPattern || ''}
                        onChange={(e) => u('dicomViewerUrlPattern', e.target.value)}
                        placeholder="Ex: {{baseUrl}}/viewer/{{StudyInstanceUID}}"
                      />
                      <p className="text-[11px] text-ink-400 mt-1">
                        Use variáveis para montagem do link: <code className="bg-ink-50 px-1 py-0.5 rounded text-brand-600 font-mono font-bold text-[10px]">{"{{baseUrl}}"}</code>, <code className="bg-ink-50 px-1 py-0.5 rounded text-brand-600 font-mono font-bold text-[10px]">{"{{StudyInstanceUID}}"}</code>, <code className="bg-ink-50 px-1 py-0.5 rounded text-brand-600 font-mono font-bold text-[10px]">{"{{examId}}"}</code>.
                      </p>
                    </div>
                  )}

                  {/* Preview da URL Gerada */}
                  <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-100/50 text-brand-900">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-700 mb-1">Visualização do Link do Exame</p>
                    <p className="text-xs font-mono font-bold break-all text-brand-600">
                      {(() => {
                        const baseUrl = (draft.dicomViewerUrl || 'http://localhost:8042').replace(/\/$/, '');
                        const sampleExamId = 'EXEMPLO123';
                        const sampleStudyUid = `1.2.276.0.7230010.3.1.2.${sampleExamId}`;
                        const pattern = draft.dicomViewerUrlPattern || '{{baseUrl}}/stone-webviewer/index.html?study=1.2.276.0.7230010.3.1.2.{{examId}}';
                        return pattern
                          .replace('{{baseUrl}}', baseUrl)
                          .replace('{{StudyInstanceUID}}', sampleStudyUid)
                          .replace('{{examId}}', sampleExamId);
                      })()}
                    </p>
                  </div>

                  {/* Servidor PACS de Backup */}
                  <div className="border-t border-ink-100 pt-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-ink-500 mb-4">Servidor PACS de Backup (Redundância em Tempo Real)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="label">URL Base do Orthanc Backup</label>
                        <input
                          className="input h-14"
                          value={draft.dicomBackupViewerUrl || ''}
                          onChange={(e) => u('dicomBackupViewerUrl', e.target.value)}
                          placeholder="Ex: http://localhost:8043"
                        />
                        <p className="text-[11px] text-ink-400 mt-1">URL do servidor Orthanc secundário para redundância em tempo real.</p>
                      </div>

                      <div className="hidden md:block" />

                      <div>
                        <label className="label">Usuário do Orthanc Backup</label>
                        <input
                          className="input h-14"
                          value={draft.dicomBackupUsername || ''}
                          onChange={(e) => u('dicomBackupUsername', e.target.value)}
                          placeholder="Ex: admin"
                        />
                        <p className="text-[11px] text-ink-400 mt-1">Usuário de autenticação básica para o servidor de backup.</p>
                      </div>

                      <div>
                        <label className="label">Senha do Orthanc Backup</label>
                        <input
                          type="password"
                          className="input h-14"
                          value={draft.dicomBackupPassword || ''}
                          onChange={(e) => u('dicomBackupPassword', e.target.value)}
                          placeholder="Ex: 123456789"
                        />
                        <p className="text-[11px] text-ink-400 mt-1">Senha de autenticação básica para o servidor de backup.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Modalidade */}
                    <div>
                      <label className="label">Modalidade</label>
                      <select
                        className="input h-14"
                        value={draft.dicomModalityType || 'US'}
                        onChange={(e) => u('dicomModalityType', e.target.value)}
                      >
                        <option value="US">US (Ultrassonografia)</option>
                        <option value="CR">CR (Radiologia Computadorizada)</option>
                        <option value="CT">CT (Tomografia Computadorizada)</option>
                        <option value="MR">MR (Ressonância Magnética)</option>
                        <option value="DX">DX (Radiografia Digital)</option>
                      </select>
                    </div>

                    {/* Modality AE Title */}
                    <div>
                      <label className="label">AE Title do Equipamento</label>
                      <input
                        className="input h-14"
                        value={draft.dicomModalityAETitle || ''}
                        onChange={(e) => u('dicomModalityAETitle', e.target.value)}
                        placeholder="Ex: MINDRAYMX7"
                      />
                    </div>

                    {/* Orthanc AE Title */}
                    <div>
                      <label className="label">AE Title do Orthanc (Remote)</label>
                      <input
                        className="input h-14"
                        value={draft.dicomOrthancAETitle || ''}
                        onChange={(e) => {
                          u('dicomOrthancAETitle', e.target.value);
                          u('dicomPreset', 'custom');
                        }}
                        placeholder="Ex: ORTHANC"
                      />
                    </div>
                  </div>
                </div>

                {/* Passo a Passo Configuração no Aparelho */}
                <div className="mt-6 bg-slate-900 text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-lg space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20 shrink-0">
                      <Info size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-white">Manual de Configuração do Aparelho</h4>
                      <p className="text-xs text-slate-400">Como vincular seu equipamento de ultrassonografia (Mindray, GE, Samsung, etc.) ao sistema.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
                    {/* Passo 1 */}
                    <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-black flex items-center justify-center select-none shrink-0">1</span>
                        <h5 className="font-black text-slate-200 uppercase tracking-wide">Dados de Rede</h5>
                      </div>
                      <p className="text-slate-400 text-[11px]">Identifique os dados de rede do seu servidor Orthanc local:</p>
                      <ul className="space-y-1 text-[11px] font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-850 mt-2 text-brand-400">
                        <li>
                          <strong>IP:</strong> {(() => {
                            try {
                              return draft.dicomViewerUrl ? new URL(draft.dicomViewerUrl).hostname : 'IP_DO_SERVIDOR';
                            } catch {
                              return 'IP_DO_SERVIDOR';
                            }
                          })()}
                        </li>
                        <li><strong>Porta DICOM:</strong> 4242</li>
                        <li><strong>AE Title:</strong> {draft.dicomOrthancAETitle || 'ORTHANC'}</li>
                      </ul>
                    </div>

                    {/* Passo 2 */}
                    <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center select-none shrink-0">2</span>
                        <h5 className="font-black text-slate-200 uppercase tracking-wide">DICOM Store (Envio)</h5>
                      </div>
                      <p className="text-slate-400 text-[11px]">No aparelho de ultrassom (Configurações de Rede / DICOM Storage):</p>
                      <ol className="list-decimal pl-4 text-slate-400 text-[11px] space-y-1 mt-2">
                        <li>Adicione um novo servidor de armazenamento (Storage/Store).</li>
                        <li>Insira o <strong>IP</strong>, a <strong>Porta 4242</strong> e o <strong>AE Title</strong> indicados no Passo 1.</li>
                        <li>Clique em <strong>Ping/Echo/Verify</strong> para testar a comunicação.</li>
                      </ol>
                    </div>

                    {/* Passo 3 */}
                    <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center select-none shrink-0">3</span>
                        <h5 className="font-black text-slate-200 uppercase tracking-wide">DICOM Worklist</h5>
                      </div>
                      <p className="text-slate-400 text-[11px]">No aparelho de ultrassom (Configurações de DICOM Worklist):</p>
                      <ol className="list-decimal pl-4 text-slate-400 text-[11px] space-y-1 mt-2">
                        <li>Adicione um novo serviço de consulta de Worklist.</li>
                        <li>Insira o mesmo <strong>IP</strong>, a <strong>Porta 4242</strong> e o <strong>AE Title</strong> do servidor.</li>
                        <li>Faça uma busca (Query/Search) para puxar os pacientes da fila.</li>
                      </ol>
                    </div>
                  </div>

                  <div className="bg-slate-955 border border-slate-800/80 p-4 rounded-2xl text-[11px] text-slate-400 flex items-start gap-2.5">
                    <span className="text-brand-500 text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                    <p>
                      <strong>Dica de Integração:</strong> Certifique-se de que a rede do aparelho e a do servidor Orthanc consigam se comunicar (mesmo Wi-Fi ou roteador). Caso o aparelho não possua suporte a Worklist direta, o preenchimento de ID do Paciente no aparelho deve ser exatamente o mesmo ID numérico do Laudus para que as imagens se vinculem automaticamente.
                    </p>
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

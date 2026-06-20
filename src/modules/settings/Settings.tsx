import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { logger } from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useFirestore';
import { Clinic } from '../../types';
import {
  Save, User, Sliders, ShieldCheck,
  Signature, Building2, Bell, Mail,
  RotateCcw, Clock, Database, Info, Upload, Loader2,
  Server, Wifi, HardDrive, Shield, Cloud, Coins
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { AuditDashboard } from './AuditDashboard';
import { FinancialControl } from './FinancialControl';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, firestore, auth } from '../../lib/firebase';
import { addAuditLog, getActivePacsUrl, getProxyEndpoint } from '../../store/db';

type SettingsTab = 'perfil' | 'assinatura' | 'dicom' | 'audit' | 'financeiro';

export function Settings() {
  const { settings, updateSettings, showToast } = useApp();
  const { user } = useAuth();
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
      logger.error('Erro de upload da foto:', err);
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
      logger.error('Erro de upload da assinatura:', err);
      showToast('Erro ao carregar assinatura digitalizada.', 'error');
    } finally {
      setIsUploadingSignature(false);
    }
  }

  async function handleTestPacsConnection() {
    setPacsTestState('testing');
    setPacsTestResults(null);
    try {
      const primaryUrl = getActivePacsUrl(draft, false);
      const primaryAuth = `&username=${encodeURIComponent(draft.dicomUsername || '')}&password=${encodeURIComponent(draft.dicomPassword || '')}`;
      
      const backupUrl = draft.dicomBackupViewerUrl ? getActivePacsUrl(draft, true) : null;
      const backupAuth = backupUrl ? `&username=${encodeURIComponent(draft.dicomBackupUsername || '')}&password=${encodeURIComponent(draft.dicomBackupPassword || '')}` : '';

      // Test Primary
      const testPrimary = async () => {
        const pingUrl = `${primaryUrl.replace(/\/$/, '')}/system`;
        const proxyPath = getProxyEndpoint(draft, false);
        try {
          const res = await fetch(`${proxyPath}?url=${encodeURIComponent(pingUrl)}${primaryAuth}`);
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
        const proxyPath = getProxyEndpoint(draft, true);
        try {
          const res = await fetch(`${proxyPath}?url=${encodeURIComponent(pingUrl)}${backupAuth}`);
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
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'assinatura', label: 'Assinatura', icon: Signature },
    { id: 'dicom', label: 'PACS / DICOM', icon: Database },
    { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
    { id: 'financeiro', label: 'Financeiro IA', icon: Coins },
  ] as const;

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">

      {/* ─── COMPACT HEADER ─── */}
      <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
              <User size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Configurações</h1>
              <p className="text-[11px] text-ink-500 font-medium mt-0.5">Perfil médico, assinatura, PACS e preferências</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDraft(settings)}
              className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-ink-700 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5"
            >
              <RotateCcw size={11} />
              <span className="hidden sm:inline">Descartar</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Salvar
            </button>
          </div>
        </div>
      </div>

      {/* ─── PILL TAB BAR ─── */}
      <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={classNames(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
              )}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

        <div className="w-full space-y-5">

          {/* TAB: PERFIL */}
          {activeTab === 'perfil' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                  <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-4">Informações Pessoais</h3>
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
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden text-center p-5 sticky top-24">
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

              {/* Preferências inline no perfil */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 sticky top-36">
                <div className="flex items-center gap-3 mb-4">
                  <Sliders size={15} className="text-ink-500" />
                  <h4 className="text-xs font-black text-ink-700 uppercase tracking-widest">Preferências</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-100">
                    <div className="flex items-center gap-2.5">
                      <Bell size={15} className="text-brand-600" />
                      <div>
                        <p className="text-xs font-bold text-ink-900">Notificações Sonoras</p>
                        <p className="text-[10px] text-ink-500">Alertas ao receber novos exames.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => u('soundNotifications', draft.soundNotifications === false)}
                      className={classNames(
                        "w-10 h-6 rounded-full transition-all relative shrink-0",
                        draft.soundNotifications !== false ? "bg-emerald-500" : "bg-ink-300"
                      )}
                    >
                      <div className={classNames(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                        draft.soundNotifications !== false ? "left-5" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-100">
                    <div className="flex items-center gap-2.5">
                      <Clock size={15} className="text-indigo-600" />
                      <div>
                        <p className="text-xs font-bold text-ink-900">Salvamento Automático</p>
                        <p className="text-[10px] text-ink-500">Persistir rascunhos no editor.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => u('autoSave', draft.autoSave === false)}
                      className={classNames(
                        "w-10 h-6 rounded-full transition-all relative shrink-0",
                        draft.autoSave !== false ? "bg-emerald-500" : "bg-ink-300"
                      )}
                    >
                      <div className={classNames(
                        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                        draft.autoSave !== false ? "left-5" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ASSINATURA */}
          {activeTab === 'assinatura' && (
            <div className="max-w-3xl space-y-5 animate-fade-in">
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Signature size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink-900">Cédula de Identidade Médica</h3>
                    <p className="text-xs text-ink-500">Dados usados no rodapé e selo de autenticidade dos laudos.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
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

                <div className="space-y-3 py-5 border-t border-ink-50">
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

                <div className="space-y-3 pt-5 border-t border-ink-50">
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

          {/* TAB: DICOM/PACS */}
          {activeTab === 'dicom' && (
            <div className="max-w-4xl space-y-5 animate-fade-in mx-auto">
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink-900">Integração PACS / DICOM</h3>
                    <p className="text-xs text-ink-500">Gestão de Servidores PACS, Equipamentos Médicos e Envio de Worklist.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  
                  {/* CARD 1: SERVIDOR PACS PRINCIPAL */}
                  <div className="p-5 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-ink-50">
                      <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                        <Server size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Servidor PACS Principal (Matriz)</h4>
                        <p className="text-xs text-ink-500">Configurações do Orthanc e agente local de Worklist principal.</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-ink-50 border border-ink-100 mb-4">
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
                        <label className="label text-ink-600">URL do Servidor PACS (IP do Tailscale)</label>
                        <input
                          className="input h-11 text-sm bg-white"
                          value={draft.dicomViewerUrl || ''}
                          onChange={(e) => u('dicomViewerUrl', e.target.value)}
                          placeholder="Ex: http://100.93.111.95:8042"
                        />
                        <p className="text-[10px] text-ink-400 mt-1">Usado localmente para carregar imagens.</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="label text-ink-600">URL Pública Tailscale (Nuvem Vercel)</label>
                        <div className="relative">
                          <Cloud size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
                          <input
                            className="input h-11 text-sm bg-white pl-9"
                            value={draft.dicomTailscalePublicUrl || ''}
                            onChange={(e) => u('dicomTailscalePublicUrl', e.target.value)}
                            placeholder="Ex: https://servidor-mac.tail861dda.ts.net:8443"
                          />
                        </div>
                        <p className="text-[10px] text-ink-400 mt-1">Obrigatório para que a nuvem consiga acessar o PACS.</p>
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
                        <label className="label">URL do Agente Local (Proxy Vercel/Tailscale)</label>
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
                              u('dicomViewerUrlPattern', '{{baseUrl}}/stone-webviewer/index.html?study={{StudyInstanceUID}}');
                            } else if (type === 'oe2') {
                              u('dicomViewerUrlPattern', '{{baseUrl}}/ui/app/retrieve-and-view.html?StudyInstanceUID={{StudyInstanceUID}}');
                            } else if (type === 'ohif') {
                              u('dicomViewerUrlPattern', '{{baseUrl}}/viewer?StudyInstanceUIDs={{StudyInstanceUID}}');
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
                  <div className="p-5 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-ink-50">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <HardDrive size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Servidor PACS de Backup (Redundância)</h4>
                        <p className="text-xs text-ink-500">Sincronização em tempo real para um servidor Orthanc secundário (ex: Notebook).</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-ink-50 border border-ink-100 mb-4">
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
                          <label className="label text-ink-600">URL do Servidor de Backup (IP do Tailscale)</label>
                          <input
                            className="input h-11 text-sm bg-white"
                            value={draft.dicomBackupViewerUrl || ''}
                            onChange={(e) => u('dicomBackupViewerUrl', e.target.value)}
                            placeholder="Ex: http://100.124.187.11:8042"
                          />
                          <p className="text-[10px] text-ink-400 mt-1">Usado localmente para fallback de imagens.</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="label text-ink-600">URL Pública Backup (Nuvem Vercel)</label>
                          <div className="relative">
                            <Cloud size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
                            <input
                              className="input h-11 text-sm bg-white pl-9"
                              value={draft.dicomBackupTailscalePublicUrl || ''}
                              onChange={(e) => u('dicomBackupTailscalePublicUrl', e.target.value)}
                              placeholder="Ex: https://servidor-notebook.tail861dda.ts.net:8443"
                            />
                          </div>
                          <p className="text-[10px] text-ink-400 mt-1">Obrigatório para que a nuvem consiga acessar o PACS Backup.</p>
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
                          <label className="label">AE Title do Servidor Backup</label>
                          <input
                            className="input h-12 text-sm font-mono"
                            value={draft.dicomBackupOrthancAETitle || ''}
                            onChange={(e) => u('dicomBackupOrthancAETitle', e.target.value.toUpperCase())}
                            placeholder="Ex: ORTHANC"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">URL do Agente Local do Backup (Proxy Vercel/Tailscale)</label>
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
                  <div className="p-5 rounded-2xl bg-ink-900 border border-ink-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">Validar Conexões de Rede</p>
                      <p className="text-xs text-ink-400">Verifique se os servidores Orthanc (Principal e Backup) estão respondendo.</p>
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



                  {/* CARD 4: CONFIGURAÇÕES GLOBAIS E MANUAL */}
                  <div className="p-5 rounded-2xl border border-ink-150 bg-white shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-ink-50">
                      <div className="w-9 h-9 rounded-xl bg-ink-100 text-ink-600 flex items-center justify-center">
                        <Shield size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink-900">Configurações Globais DICOM</h4>
                        <p className="text-xs text-ink-500">AE Title do seu servidor Orthanc.</p>
                      </div>
                    </div>
                    
                    <div className="mb-5 max-w-sm">
                      <label className="label">AE Title do Servidor Orthanc</label>
                      <input
                        className="input h-12 text-sm font-mono"
                        value={draft.dicomOrthancAETitle || ''}
                        onChange={(e) => u('dicomOrthancAETitle', e.target.value.toUpperCase())}
                        placeholder="Ex: ORTHANC"
                      />
                    </div>

                    <div className="bg-ink-900 text-ink-100 rounded-2xl p-5 border border-ink-800 shadow-xl space-y-5">
                      <div className="flex items-center gap-3 pb-4 border-b border-ink-800/80">
                        <Info size={20} className="text-brand-400 shrink-0" />
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">Manual de Integração com o Equipamento</h4>
                          <p className="text-[10px] text-ink-400 font-bold uppercase tracking-tight mt-0.5 font-sans">Siga as etapas abaixo para configurar seu aparelho de ultrassom ou console.</p>
                        </div>
                      </div>

                      {/* Dados de Endereçamento DICOM */}
                      <div className="space-y-3 font-sans">
                        <span className="text-[10px] font-black text-ink-450 uppercase tracking-widest block">Parâmetros de Conexão DICOM</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono bg-ink-950 p-4 rounded-2xl border border-ink-800/50 text-brand-400">
                          <div className="space-y-1">
                            <p><span className="text-ink-500">IP Servidor Principal:</span> <strong className="text-white select-all">{(() => {
                              try { return draft.dicomViewerUrl ? new URL(draft.dicomViewerUrl).hostname : 'IP_DO_SERVIDOR'; } catch { return 'IP_DO_SERVIDOR'; }
                            })()}</strong></p>
                            {draft.dicomBackupSyncEnabled && (
                              <p><span className="text-ink-500">IP Servidor Backup:</span> <strong className="text-white select-all">{(() => {
                                try { return draft.dicomBackupViewerUrl ? new URL(draft.dicomBackupViewerUrl).hostname : 'IP_DO_SERVIDOR_BACKUP'; } catch { return 'IP_DO_SERVIDOR_BACKUP'; }
                              })()}</strong></p>
                            )}
                            <p><span className="text-ink-500">Porta DICOM (Worklist/Store):</span> <strong className="text-white select-all">4242</strong></p>
                          </div>
                          <div className="space-y-1">
                            <p><span className="text-ink-500">AE Title Principal (Orthanc):</span> <strong className="text-white select-all">{draft.dicomOrthancAETitle || 'ORTHANC'}</strong></p>
                            {draft.dicomBackupSyncEnabled && (
                              <p><span className="text-ink-500">AE Title Backup (Orthanc):</span> <strong className="text-white select-all">{draft.dicomBackupOrthancAETitle || 'ORTHANC'}</strong></p>
                            )}
                            <p><span className="text-ink-500">AE Title Local do Aparelho:</span> <span className="text-ink-400 italic">Livre (ex: US_SALA_01)</span></p>
                          </div>
                        </div>
                      </div>

                      {/* Guia Passo a Passo */}
                      <div className="space-y-4 font-sans">
                        <span className="text-[10px] font-black text-ink-450 uppercase tracking-widest block">Guia de Configuração Passo a Passo</span>
                        
                        <div className="space-y-3.5 text-xs text-ink-300 leading-relaxed">
                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-mono font-bold shrink-0">1</span>
                            <div>
                              <strong className="text-white block font-bold mb-0.5">Conectividade e Rede Física</strong>
                              Certifique-se de que o aparelho de ultrassom está conectado à mesma rede local (rede cabeada ou Wi-Fi clínico) em que está hospedado o seu servidor PACS Orthanc local/virtual.
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-mono font-bold shrink-0">2</span>
                            <div>
                              <strong className="text-white block font-bold mb-0.5">Configuração do Worklist (MWL - Modality Worklist)</strong>
                              No painel do equipamento (geralmente em <code className="bg-zinc-800 text-zinc-150 px-1 py-0.5 rounded text-[10px]">Setup/System Config</code> &gt; <code className="bg-zinc-800 text-zinc-150 px-1 py-0.5 rounded text-[10px]">DICOM Settings</code> &gt; <code className="bg-zinc-800 text-zinc-150 px-1 py-0.5 rounded text-[10px]">Worklist</code>), cadastre um novo serviço com o **IP do Servidor**, **Porta 4242** e o **AE Title Principal** acima. Isso habilitará o botão "Worklist" no teclado do aparelho para sincronizar a lista de pacientes em tempo real.
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-mono font-bold shrink-0">3</span>
                            <div>
                              <strong className="text-white block font-bold mb-0.5">Configuração do Destino de Imagens (C-STORE / Storage)</strong>
                              Para que o ultrassom envie as capturas e exames gravados de volta para o visualizador do Laud.us, adicione outro serviço sob a aba <code className="bg-zinc-800 text-zinc-150 px-1 py-0.5 rounded text-[10px]">Storage/C-STORE</code>. Use exatamente os mesmos parâmetros de IP, Porta 4242 e AE Title configurados no Worklist.
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-mono font-bold shrink-0">4</span>
                            <div>
                              <strong className="text-white block font-bold mb-0.5">Autorização de AE Title do Equipamento no Servidor</strong>
                              O servidor PACS Orthanc requer que os aparelhos conectados sejam previamente autorizados. Informe à equipe técnica ou TI da sua clínica o **AE Title**, **IP local** e **Porta local** do aparelho de ultrassom para que possamos registrá-lo nas regras de roteamento e escuta do servidor central.
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-mono font-bold shrink-0">5</span>
                            <div>
                              <strong className="text-white block font-bold mb-0.5">Validação do Link DICOM (C-ECHO / Ping)</strong>
                              No equipamento de imagem, selecione os perfis de Worklist e Storage salvos e acione a opção **Verify** (ou **DICOM Ping/Echo**). A resposta deve ser "Success" ou "Conexão Estabelecida". A partir disso, o aparelho já estará integrado!
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Suporte Técnico */}
                      <div className="pt-4 border-t border-ink-800/80 text-[11px] text-ink-400 leading-relaxed font-sans">
                        <p className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                          <span>⚠️</span> Importante para Administradores de TI:
                        </p>
                        Se precisar de suporte com a parametrização de rede, configurações de firewall na porta 4242 ou cadastro de AETitles personalizados no arquivo de configuração do Orthanc, acione o canal de suporte técnico do Laud.us diretamente pelo menu inferior.
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB: FINANCEIRO */}
          {activeTab === 'financeiro' && (
            <div className="animate-fade-in">
              <FinancialControl />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

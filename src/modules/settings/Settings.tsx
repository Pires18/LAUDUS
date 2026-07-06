import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { logger } from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useFirestore';
import { Clinic, Patient } from '../../types';
import { ReportPreview } from '../export/ReportDocument';
import {
  Save, User, Sliders, ShieldCheck,
  Signature, Building2, Bell, Mail,
  RotateCcw, Clock, Info, Upload, Loader2,
  Printer, Receipt, Sparkles, ListChecks, ClipboardList, Wand2, Award
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { AuditDashboard } from './AuditDashboard';
import { SubscriptionCenter } from './SubscriptionCenter';
import { useSubscription } from '../../hooks/useSubscription';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, firestore, auth } from '../../lib/firebase';
import { addAuditLog, getActivePacsUrl, getProxyEndpoint } from '../../store/db';

type SettingsTab = 'perfil' | 'laudia' | 'pdf' | 'audit' | 'assinatura';

// Limite de tamanho para upload de foto de perfil/assinatura — sem isso, um
// arquivo grande travava a UI em "Enviando..." sem explicar o motivo.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Dados de amostra da prévia do Centro de PDF (WYSIWYG do laudo real) ──
const PDF_PREVIEW_DATE = Date.UTC(2025, 2, 14);
const PDF_PREVIEW_PATIENT: Patient = {
  id: 'preview',
  name: 'Maria da Silva Oliveira',
  gender: 'F',
  birthDate: '1985-06-20',
  insurance: 'Particular',
  cpf: '123.456.789-00',
  createdAt: PDF_PREVIEW_DATE,
  updatedAt: PDF_PREVIEW_DATE,
} as Patient;
const PDF_PREVIEW_CONTENT = `<h1>ULTRASSONOGRAFIA DE ABDOME SUPERIOR</h1>
<h2>TÉCNICA</h2>
<p>Exame realizado com transdutor convexo multifrequencial, em cortes longitudinais e transversais.</p>
<h2>ANÁLISE</h2>
<p>Fígado com dimensões normais, contornos regulares e ecotextura do parênquima homogênea, sem evidências de lesões focais ou difusas. Vias biliares intra e extra-hepáticas de calibre normal. Vesícula biliar normodistendida, de paredes finas, sem cálculos em seu interior.</p>
<h2>CONCLUSÃO</h2>
<p>Exame ultrassonográfico de abdome superior sem alterações significativas.</p>`;
const PDF_PREVIEW_OBS = `<p>Método operador-dependente, sujeito a limitações técnicas inerentes (interposição gasosa, biotipo). Correlação clínico-laboratorial recomendada.</p>`;

function getFontFamilyFallback(family?: string) {
  if (!family) return 'Arial, sans-serif';
  switch (family) {
    case 'Times New Roman': return '"Times New Roman", Times, serif';
    case 'Courier New': return '"Courier New", Courier, monospace';
    case 'Inter': return '"Inter", sans-serif';
    case 'Calibri': return 'Calibri, Candara, Segoe, "Segoe UI", sans-serif';
    case 'Georgia': return 'Georgia, serif';
    case 'Lora': return '"Lora", Georgia, serif';
    default: return `${family}, sans-serif`;
  }
}

export function Settings() {
  const { settings, updateSettings, showToast, view } = useApp();
  const { user } = useAuth();
  const { hasPacs } = useSubscription();
  const { data: clinics } = useCollection<Clinic>('clinics');
  
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('perfil');

  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);



  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (view.name === 'settings' && view.activeTab) {
      setActiveTab(view.activeTab as SettingsTab);
    }
  }, [view]);

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
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('Imagem muito grande (máx. 5 MB). Escolha um arquivo menor.', 'error');
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
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('Imagem muito grande (máx. 5 MB). Escolha um arquivo menor.', 'error');
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





  const tabs = [
    { id: 'perfil',    label: 'Perfil',        icon: User       },
    { id: 'laudia',    label: 'LAUD.IA',        icon: Sparkles   },
    { id: 'pdf',       label: 'Centro de PDF',  icon: Printer    },
    { id: 'audit',     label: 'Auditoria',      icon: ShieldCheck },
    { id: 'assinatura',label: 'Assinatura & Faturamento',     icon: Receipt },
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
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-300 transform active:scale-95 whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-indigo-650 text-white shadow-md shadow-indigo-500/20 scale-[1.02] border border-indigo-750/10'
                  : 'text-ink-500 hover:text-ink-900 hover:bg-white/70 hover:scale-[1.01]'
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

          {/* TAB: LAUD.IA — ajustes individuais da IA e das máscaras */}
          {activeTab === 'laudia' && (
            <div className="max-w-3xl animate-fade-in space-y-5">
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white/70 text-indigo-600 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-ink-900">Preferências da LAUD.IA</h4>
                  <p className="text-[11px] text-ink-500 font-medium mt-1 leading-relaxed">
                    Ajustes pessoais que controlam quais seções a IA inclui nos seus laudos e como
                    o motor de refinamento se comporta. Valem apenas para a sua conta.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Sliders size={15} className="text-ink-500" />
                  <h4 className="text-xs font-black text-ink-700 uppercase tracking-widest">Seções do Laudo</h4>
                </div>
                <div className="space-y-3">
                  {([
                    {
                      key: 'laudIaRecommendationsEnabled' as const,
                      icon: ListChecks,
                      color: 'text-emerald-600',
                      title: 'Recomendações',
                      desc: 'Incluir a seção de RECOMENDAÇÕES nos laudos gerados.',
                    },
                    {
                      key: 'laudIaMethodologicalObsEnabled' as const,
                      icon: ClipboardList,
                      color: 'text-brand-600',
                      title: 'Observações Metodológicas',
                      desc: 'Incluir a seção de OBSERVAÇÕES METODOLÓGICAS nos laudos.',
                    },
                    {
                      key: 'laudIaClassificationEnabled' as const,
                      icon: Award,
                      color: 'text-amber-600',
                      title: 'Classificação (BI-RADS, TI-RADS…)',
                      desc: 'Incluir a seção de CLASSIFICAÇÃO quando a máscara tiver.',
                    },
                  ]).map(({ key, icon: Icon, color, title, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-100">
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className={color} />
                        <div>
                          <p className="text-xs font-bold text-ink-900">{title}</p>
                          <p className="text-[10px] text-ink-500">{desc}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => u(key, draft[key] === false)}
                        className={classNames(
                          "w-10 h-6 rounded-full transition-all relative shrink-0",
                          draft[key] !== false ? "bg-emerald-500" : "bg-ink-300"
                        )}
                      >
                        <div className={classNames(
                          "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                          draft[key] !== false ? "left-5" : "left-1"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Wand2 size={15} className="text-ink-500" />
                  <h4 className="text-xs font-black text-ink-700 uppercase tracking-widest">Motor de IA</h4>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-100">
                  <div className="flex items-center gap-2.5">
                    <Wand2 size={15} className="text-violet-600" />
                    <div>
                      <p className="text-xs font-bold text-ink-900">Refinador Automático</p>
                      <p className="text-[10px] text-ink-500">Executa um passe de refino estrutural após a geração inicial quando detecta falhas.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => u('aiAutoRefineEnabled', !draft.aiAutoRefineEnabled)}
                    className={classNames(
                      "w-10 h-6 rounded-full transition-all relative shrink-0",
                      draft.aiAutoRefineEnabled ? "bg-emerald-500" : "bg-ink-300"
                    )}
                  >
                    <div className={classNames(
                      "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                      draft.aiAutoRefineEnabled ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-ink-400 flex items-center gap-1.5 px-1">
                <Info size={12} /> As alterações passam a valer nos próximos laudos gerados. Clique em Salvar para aplicar.
              </p>
            </div>
          )}

          {/* TAB: CENTRO DE PDF & ASSINATURA */}
          {activeTab === 'pdf' && (
            <div className="space-y-5 animate-fade-in">

              {/* ── Card 1: Cédula Médica & Assinatura ── */}
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
                    <label className="label flex items-center gap-1.5 relative">
                      Número do CRM
                      <span className="group relative cursor-help">
                        <Info size={12} className="text-ink-400 hover:text-indigo-600 transition-colors inline-block" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-ink-900 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
                          O CRM é obrigatório para validade jurídica de seus laudos. Insira no formato Número-UF (ex: 123456-SP).
                        </span>
                      </span>
                    </label>
                    <input
                      className="input h-14"
                      value={draft.physicianCRM || ''}
                      onChange={(e) => u('physicianCRM', e.target.value)}
                      placeholder="Ex: 123456-SP"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5 relative">
                      RQE (Especialidade)
                      <span className="group relative cursor-help">
                        <Info size={12} className="text-ink-400 hover:text-indigo-600 transition-colors inline-block" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-ink-900 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
                          O RQE (Registro de Qualificação de Especialidade) serve para certificar legalmente a sua especialidade nos laudos.
                        </span>
                      </span>
                    </label>
                    <input
                      className="input h-14"
                      value={draft.physicianRQE || ''}
                      onChange={(e) => u('physicianRQE', e.target.value)}
                      placeholder="Ex: 12345"
                    />
                  </div>
                </div>

                <div className="space-y-3 py-5 border-t border-ink-50">
                  <label className="label flex items-center gap-1.5 relative">
                    Assinatura Digitalizada (Imagem)
                    <span className="group relative cursor-help">
                      <Info size={12} className="text-ink-400 hover:text-indigo-600 transition-colors inline-block" />
                      <span className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-ink-900 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
                        Faça upload da imagem da sua assinatura manuscrita (PNG com fundo transparente) para inserção nítida nos laudos em PDF.
                      </span>
                    </span>
                  </label>
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

              {/* ── Card 2: Tipografia ── */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Printer size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-ink-900">Tipografia do Laudo</h3>
                      <p className="text-xs text-ink-500">Fonte, tamanho e espaçamento do texto impresso.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(d => ({
                        ...d,
                        pdfFontFamily: 'Arial',
                        pdfFontSize: '14px',
                        pdfLineHeight: '1.5',
                        pdfTextAlign: 'justify',
                      }));
                    }}
                    className="text-[10px] font-black text-ink-500 hover:text-ink-700 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-50 hover:bg-ink-100 border border-ink-200 transition-all"
                  >
                    <RotateCcw size={11} /> Restaurar Padrões
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="label">Fonte do Laudo</label>
                    <select
                      className="input h-12 text-sm"
                      value={draft.pdfFontFamily || 'Arial'}
                      onChange={(e) => u('pdfFontFamily', e.target.value)}
                    >
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Inter">Inter</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tamanho da Fonte</label>
                    <select
                      className="input h-12 text-sm"
                      value={draft.pdfFontSize || '14px'}
                      onChange={(e) => u('pdfFontSize', e.target.value)}
                    >
                      <option value="12px">12px</option>
                      <option value="13px">13px</option>
                      <option value="14px">14px</option>
                      <option value="15px">15px</option>
                      <option value="16px">16px</option>
                      <option value="18px">18px</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Espaçamento de Linhas</label>
                    <select
                      className="input h-12 text-sm"
                      value={draft.pdfLineHeight || '1.5'}
                      onChange={(e) => u('pdfLineHeight', e.target.value)}
                    >
                      <option value="1.2">1.2</option>
                      <option value="1.3">1.3</option>
                      <option value="1.4">1.4</option>
                      <option value="1.5">1.5</option>
                      <option value="1.6">1.6</option>
                      <option value="1.8">1.8</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Alinhamento do Texto</label>
                    <select
                      className="input h-12 text-sm"
                      value={draft.pdfTextAlign || 'justify'}
                      onChange={(e) => u('pdfTextAlign', e.target.value as 'justify' | 'left')}
                    >
                      <option value="justify">Justificado</option>
                      <option value="left">Esquerda</option>
                    </select>
                  </div>
                </div>

                {/* Live typography preview */}
                <div className="mt-2 p-5 bg-ink-50/50 rounded-2xl border border-ink-100">
                  <p className="text-[9px] font-black text-ink-400 uppercase tracking-widest mb-3">Prévia Tipográfica</p>
                  <p
                    style={{
                      fontFamily: getFontFamilyFallback(draft.pdfFontFamily),
                      fontSize: draft.pdfFontSize || '14px',
                      lineHeight: draft.pdfLineHeight || '1.5',
                      textAlign: draft.pdfTextAlign || 'justify',
                    }}
                    className="text-ink-800 transition-all duration-200"
                  >
                    Fígado com dimensões normais, contornos regulares e ecotextura do parênquima homogênea, sem evidências de lesões focais ou difusas. Vias biliares intra e extra-hepáticas de calibre normal.
                  </p>
                </div>
              </div>

              {/* ── Card 3: Margens & Elementos ── */}
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Sliders size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-ink-900">Margens & Elementos</h3>
                      <p className="text-xs text-ink-500">Espaçamento da página e visibilidade de cabeçalho/rodapé.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(d => ({
                        ...d,
                        pdfMarginTop: 15,
                        pdfMarginBottom: 15,
                        pdfMarginLeft: 15,
                        pdfMarginRight: 15,
                        pdfImagesMarginTop: 10,
                        pdfImagesMarginBottom: 10,
                        pdfImagesMarginLeft: 10,
                        pdfImagesMarginRight: 10,
                      }));
                    }}
                    className="text-[10px] font-black text-ink-500 hover:text-ink-700 uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-50 hover:bg-ink-100 border border-ink-200 transition-all"
                  >
                    <RotateCcw size={11} /> Restaurar Padrões
                  </button>
                </div>

                {/* Margens do laudo (primário) */}
                <div className="space-y-4">
                  <span className="text-xs font-black text-ink-700 uppercase tracking-wider block">Margens do Laudo (mm)</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="label">Superior</label>
                      <input type="number" className="input h-12" value={draft.pdfMarginTop !== undefined ? draft.pdfMarginTop : 15} onChange={(e) => u('pdfMarginTop', Number(e.target.value))} min={0} max={100} />
                    </div>
                    <div>
                      <label className="label">Inferior</label>
                      <input type="number" className="input h-12" value={draft.pdfMarginBottom !== undefined ? draft.pdfMarginBottom : 15} onChange={(e) => u('pdfMarginBottom', Number(e.target.value))} min={0} max={100} />
                    </div>
                    <div>
                      <label className="label">Esquerda</label>
                      <input type="number" className="input h-12" value={draft.pdfMarginLeft !== undefined ? draft.pdfMarginLeft : 15} onChange={(e) => u('pdfMarginLeft', Number(e.target.value))} min={0} max={100} />
                    </div>
                    <div>
                      <label className="label">Direita</label>
                      <input type="number" className="input h-12" value={draft.pdfMarginRight !== undefined ? draft.pdfMarginRight : 15} onChange={(e) => u('pdfMarginRight', Number(e.target.value))} min={0} max={100} />
                    </div>
                  </div>
                </div>

                {/* Elementos de layout */}
                <div className="space-y-3 pt-5 mt-5 border-t border-ink-50">
                  <span className="text-xs font-black text-ink-700 uppercase tracking-wider block">Elementos do Layout</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-100">
                      <div>
                        <p className="text-xs font-bold text-ink-900">Cabeçalho da Clínica</p>
                        <p className="text-[10px] text-ink-500">Exibir no topo do PDF.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => u('pdfShowHeader', draft.pdfShowHeader === false)}
                        className={classNames("w-10 h-6 rounded-full transition-all relative shrink-0", draft.pdfShowHeader !== false ? "bg-emerald-500" : "bg-ink-300")}
                      >
                        <div className={classNames("w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm", draft.pdfShowHeader !== false ? "left-5" : "left-1")} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-ink-50 border border-ink-100">
                      <div>
                        <p className="text-xs font-bold text-ink-900">Rodapé da Clínica</p>
                        <p className="text-[10px] text-ink-500">Exibir na base do PDF.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => u('pdfShowFooter', draft.pdfShowFooter === false)}
                        className={classNames("w-10 h-6 rounded-full transition-all relative shrink-0", draft.pdfShowFooter !== false ? "bg-emerald-500" : "bg-ink-300")}
                      >
                        <div className={classNames("w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm", draft.pdfShowFooter !== false ? "left-5" : "left-1")} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Documentação fotográfica (secundário) */}
                <div className="space-y-3 pt-5 mt-5 border-t border-ink-50">
                  <div>
                    <span className="text-[11px] font-black text-ink-500 uppercase tracking-wider block">Margens — Documentação Fotográfica (mm)</span>
                    <p className="text-[10px] text-ink-400 mt-0.5">Aplicadas apenas ao PDF de imagens, não ao laudo.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="label">Superior</label>
                      <input type="number" className="input h-11" value={draft.pdfImagesMarginTop !== undefined ? draft.pdfImagesMarginTop : 10} onChange={(e) => u('pdfImagesMarginTop', Number(e.target.value))} min={0} max={50} />
                    </div>
                    <div>
                      <label className="label">Inferior</label>
                      <input type="number" className="input h-11" value={draft.pdfImagesMarginBottom !== undefined ? draft.pdfImagesMarginBottom : 10} onChange={(e) => u('pdfImagesMarginBottom', Number(e.target.value))} min={0} max={50} />
                    </div>
                    <div>
                      <label className="label">Esquerda</label>
                      <input type="number" className="input h-11" value={draft.pdfImagesMarginLeft !== undefined ? draft.pdfImagesMarginLeft : 10} onChange={(e) => u('pdfImagesMarginLeft', Number(e.target.value))} min={0} max={50} />
                    </div>
                    <div>
                      <label className="label">Direita</label>
                      <input type="number" className="input h-11" value={draft.pdfImagesMarginRight !== undefined ? draft.pdfImagesMarginRight : 10} onChange={(e) => u('pdfImagesMarginRight', Number(e.target.value))} min={0} max={50} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Live Preview (Full width) ── */}
              <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2 border-b border-ink-150 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Sliders size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-ink-950 uppercase tracking-widest leading-none">Pré-visualização do Laudo</h3>
                    <p className="text-[11px] text-ink-500 font-medium mt-0.5">Prévia com fonte, margens e assinatura configuradas.</p>
                  </div>
                </div>

                <div className="bg-ink-50/50 p-6 rounded-2xl border border-ink-100 flex justify-center overflow-x-auto">
                  {/* Prévia real: mesma renderização do PDF final (ReportDocument).
                      Reflete fielmente fonte, margens, cabeçalho, barra do paciente
                      e assinatura. */}
                  <ReportPreview
                    patient={PDF_PREVIEW_PATIENT}
                    clinic={null}
                    settings={draft}
                    examType="Ultrassonografia de Abdome Superior"
                    reportContent={PDF_PREVIEW_CONTENT + (draft.laudIaMethodologicalObsEnabled !== false ? `<h2>OBSERVAÇÕES METODOLÓGICAS</h2>${PDF_PREVIEW_OBS}` : '')}
                    physicianName="Dr. Médico Solicitante"
                    examDate={PDF_PREVIEW_DATE}
                  />
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

          {/* TAB: ASSINATURA */}
          {activeTab === 'assinatura' && (
            <SubscriptionCenter />
          )}

        </div>
      </div>
    </div>
  );
}

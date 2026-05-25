import { useState, FormEvent, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useFirestore';
import { Clinic } from '../../types';
import { PageHeader } from '../../components/PageHeader';
import { 
  Save, User, LogOut, Sliders, ShieldCheck, 
  Signature, Building2, Bell, Mail,
  RotateCcw, Clock, Database
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { AuditDashboard } from './AuditDashboard';

type SettingsTab = 'perfil' | 'assinatura' | 'sistema' | 'dicom' | 'audit';

export function Settings() {
  const { settings, updateSettings, showToast } = useApp();
  const { user, signOut } = useAuth();
  const { data: clinics } = useCollection<Clinic>('clinics');
  
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
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

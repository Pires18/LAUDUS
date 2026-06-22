import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import {
  Save, RotateCcw, Loader2, Database, Server, Wifi,
  HardDrive, Shield, Cloud, Info, Network, BookOpen,
  Cpu, FileText, CheckCircle2, AlertTriangle, HelpCircle,
  Copy, Check
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { addAuditLog, getActivePacsUrl, getProxyEndpoint } from '../../store/db';

const JSON_TEMPLATE = `{
  "Name" : "PACS LAUDUS Principal",
  "StorageDirectory" : "C:\\\\OrthancServer\\\\db\\\\OrthancStorage",
  "IndexDirectory" : "C:\\\\OrthancServer\\\\db\\\\OrthancStorage",
  "StorageCompression" : true,
  "DicomServerEnabled" : true,
  "DicomPort" : 4242,
  "DicomAet" : "ORTHANC",
  "HttpPort" : 8042,
  "HttpServerEnabled" : true,
  "AuthenticationEnabled" : true,
  "RegisteredUsers" : {
    "admin" : "sua_senha_segura_aqui"
  },
  "DicomModalities" : {
    "US_SALA_01" : [ "MINDRAYMX7", "192.168.1.150", 104 ],
    "US_SALA_02" : [ "GE_LOGIQ", "192.168.1.151", 4100 ]
  },
  "Worklists" : {
    "Enable" : true,
    "Database" : "C:\\\\OrthancServer\\\\db\\\\WorklistsDatabase\\\\"
  },
  "Plugins" : [
    "C:\\\\Program Files\\\\Orthanc Server\\\\Plugins"
  ],
  "ConcurrentJobs" : 4,
  "DicomAlwaysAllowEcho" : true,
  "DicomAlwaysAllowStore" : true
}`;

type ControlTab = 'config' | 'guides';
type GuideMethod = 'local' | 'tailscale';

export function DicomControlCenter() {
  const { settings, updateSettings, showToast } = useApp();
  const { user } = useAuth();
  const { hasPacs } = useSubscription();

  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ControlTab>('config');
  const [selectedSection, setSelectedSection] = useState<'architecture' | 'prereq' | 'orthanc_json' | 'agent' | 'tailscale' | 'ultrasound' | 'troubleshoot'>('architecture');
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      await addAuditLog({
        action: 'ATUALIZAR_CONFIGURACOES',
        details: `Configurações de PACS/DICOM atualizadas com sucesso pelo médico ${draft.physicianName || user?.displayName || user?.email}.`,
        module: 'PACS'
      });
      showToast('Configurações PACS salvas com sucesso', 'success');
    } catch {
      showToast('Falha ao salvar configurações PACS', 'error');
    } finally {
      setIsSaving(false);
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

  function handleCopy(text: string, fieldId: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    showToast('Copiado para a área de transferência', 'success');
    setTimeout(() => setCopiedField(null), 2000);
  }

  // Se não possuir o add-on PACS, mostra tela de bloqueio
  if (!hasPacs) {
    return (
      <div className="module-container">
        <div className="max-w-4xl mx-auto w-full animate-fade-in my-12">
          <div className="bg-white rounded-2xl border border-ink-150 shadow-sm p-12 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Database size={38} />
            </div>
            <h3 className="text-xl font-black text-ink-900 mb-3">Recurso Adicional PACS / DICOM</h3>
            <p className="text-sm text-ink-500 mb-8 leading-relaxed">
              A integração em tempo real com equipamentos de ultrassom, sincronização local de worklists e redundância de servidores PACS/Orthanc exigem a contratação do add-on PACS na sua assinatura.
            </p>
            <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 text-xs text-ink-600 mb-8 text-left leading-relaxed">
              <strong>O que este recurso inclui:</strong>
              <ul className="list-disc pl-5 mt-2 space-y-1.5 font-medium">
                <li>Visualização de exames diretamente no editor de laudos</li>
                <li>Importação automática de dados do paciente via Modality Worklist (MWL)</li>
                <li>Sincronização com servidores Orthanc locais ou virtuais via VPN</li>
                <li>Redundância completa com servidor de backup</li>
              </ul>
            </div>
            <p className="text-xs text-ink-400 italic mb-4">Entre em contato com o suporte ou gerencie sua assinatura nas configurações de faturamento.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-5">

        {/* ─── PREMIUM HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
                <Database size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Centro de Controle PACS / DICOM</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Gerenciamento de servidores Orthanc, modulação de rede e guias de conectividade</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={() => setDraft(settings)}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-500 hover:text-ink-700 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={11} />
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              >
                {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>

        {/* ─── TAB NAVIGATION ─── */}
        <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50">
          <button
            onClick={() => setActiveTab('config')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-1 justify-center sm:flex-none sm:justify-start',
              activeTab === 'config'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <Network size={13} />
            Servidores & Conexão
          </button>
          <button
            onClick={() => setActiveTab('guides')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-1 justify-center sm:flex-none sm:justify-start',
              activeTab === 'guides'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <BookOpen size={13} />
            Guia de Configuração (Manual)
          </button>
        </div>

        {/* ─── TAB CONTENT ─── */}
        <div className="w-full">
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
              {/* Form de Configuração Principal (Esquerda - 2 colunas) */}
              <div className="lg:col-span-2 space-y-5">
                {/* Servidor PACS Principal */}
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-ink-50">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Server size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink-900">Servidor PACS Principal (Matriz)</h3>
                      <p className="text-xs text-ink-500 font-medium">Parametrização do Orthanc ativo na rede ou VPN.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-ink-50 border border-ink-100">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-ink-900">Sincronização de Worklist Local</p>
                      <p className="text-[10px] text-ink-500">Persiste arquivos .wl de exames automaticamente no diretório mapeado.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => u('dicomSyncEnabled', !draft.dicomSyncEnabled)}
                      className={classNames(
                        "w-12 h-7 rounded-full transition-all relative shrink-0",
                        draft.dicomSyncEnabled ? "bg-emerald-500" : "bg-ink-300"
                      )}
                    >
                      <div className={classNames(
                        "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                        draft.dicomSyncEnabled ? "left-6" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="label">URL do Servidor PACS (IP Local ou VPN)</label>
                      <input
                        className="input h-11 text-sm bg-white"
                        value={draft.dicomViewerUrl || ''}
                        onChange={(e) => u('dicomViewerUrl', e.target.value)}
                        placeholder="Ex: http://192.168.1.100:8042 ou http://100.93.111.95:8042"
                      />
                      <p className="text-[10px] text-ink-400 mt-1">Utilizado para carregar imagens em ambiente local.</p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">URL Pública Tailscale / Proxy HTTPS (Nuvem Vercel)</label>
                      <div className="relative">
                        <Cloud size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                        <input
                          className="input h-11 text-sm bg-white pl-9"
                          value={draft.dicomTailscalePublicUrl || ''}
                          onChange={(e) => u('dicomTailscalePublicUrl', e.target.value)}
                          placeholder="Ex: https://servidor-mac.tail861dda.ts.net:8443"
                        />
                      </div>
                      <p className="text-[10px] text-ink-400 mt-1">Necessário com SSL ativo para acesso remoto seguro a partir da nuvem.</p>
                    </div>

                    <div>
                      <label className="label">Usuário Orthanc</label>
                      <input
                        className="input h-11 text-sm"
                        value={draft.dicomUsername || ''}
                        onChange={(e) => u('dicomUsername', e.target.value)}
                        placeholder="Ex: admin"
                      />
                    </div>
                    <div>
                      <label className="label">Senha Orthanc</label>
                      <input
                        type="password"
                        className="input h-11 text-sm"
                        value={draft.dicomPassword || ''}
                        onChange={(e) => u('dicomPassword', e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">URL do Agente Local (Proxy de Envio / Worklist)</label>
                      <input
                        className="input h-11 text-sm"
                        value={draft.dicomLocalAgentUrl || ''}
                        onChange={(e) => u('dicomLocalAgentUrl', e.target.value)}
                        placeholder="Ex: https://servidor-mac.tail861dda.ts.net"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">Diretório Absoluto da Worklist (Servidor Local)</label>
                      <input
                        className="input h-11 text-sm"
                        value={draft.dicomWorklistFolder || ''}
                        onChange={(e) => u('dicomWorklistFolder', e.target.value)}
                        placeholder="Ex: C:\OrthancServer\db\WorklistsDatabase\"
                      />
                    </div>

                    <div>
                      <label className="label">AE Title do Servidor (Orthanc)</label>
                      <input
                        className="input h-11 text-sm font-mono"
                        value={draft.dicomOrthancAETitle || ''}
                        onChange={(e) => u('dicomOrthancAETitle', e.target.value.toUpperCase())}
                        placeholder="Ex: ORTHANC"
                      />
                    </div>
                    <div>
                      <label className="label flex items-center gap-1.5 relative">
                        Tipo de Visualizador DICOM
                        <span className="group relative cursor-help">
                          <Info size={12} className="text-ink-400 hover:text-emerald-600 transition-colors inline-block" />
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-ink-950 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
                            Selecione o visualizador PACS integrado de sua preferência. Stone Web Viewer é o padrão recomendado.
                          </span>
                        </span>
                      </label>
                      <select
                        className="input h-11 text-sm"
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
                        <option value="custom">Personalizado (URL customizada)</option>
                      </select>
                    </div>

                    {draft.dicomViewerType === 'custom' && (
                      <div className="md:col-span-2">
                        <label className="label flex items-center gap-1.5 relative">
                          Padrão da URL do Visualizador
                          <span className="group relative cursor-help">
                            <Info size={12} className="text-ink-400 hover:text-emerald-600 transition-colors inline-block" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-ink-950 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
                              Use os placeholders de substituição como {"{{baseUrl}}"} e {"{{StudyInstanceUID}}"} para montar a rota do visualizador personalizado.
                            </span>
                          </span>
                        </label>
                        <input
                          className="input h-11 text-sm"
                          value={draft.dicomViewerUrlPattern || ''}
                          onChange={(e) => u('dicomViewerUrlPattern', e.target.value)}
                          placeholder="Ex: {{baseUrl}}/viewer?StudyInstanceUIDs={{StudyInstanceUID}}"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Servidor PACS de Backup (Redundância) */}
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-ink-50">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <HardDrive size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink-900">Servidor PACS de Backup (Redundância)</h3>
                      <p className="text-xs text-ink-500 font-medium">Servidor secundário (ex: Notebook) para espelhamento em tempo real.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-ink-50 border border-ink-100">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-ink-900">Habilitar Servidor de Redundância</p>
                      <p className="text-[10px] text-ink-500">Enviar e sincronizar exames e worklist em paralelo no backup.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => u('dicomBackupSyncEnabled', !draft.dicomBackupSyncEnabled)}
                      className={classNames(
                        "w-12 h-7 rounded-full transition-all relative shrink-0",
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                      <div className="md:col-span-2">
                        <label className="label">URL do Servidor Backup (IP Local ou VPN)</label>
                        <input
                          className="input h-11 text-sm bg-white"
                          value={draft.dicomBackupViewerUrl || ''}
                          onChange={(e) => u('dicomBackupViewerUrl', e.target.value)}
                          placeholder="Ex: http://100.124.187.11:8042"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">URL Pública Backup (Nuvem Vercel)</label>
                        <div className="relative">
                          <Cloud size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                          <input
                            className="input h-11 text-sm bg-white pl-9"
                            value={draft.dicomBackupTailscalePublicUrl || ''}
                            onChange={(e) => u('dicomBackupTailscalePublicUrl', e.target.value)}
                            placeholder="Ex: https://servidor-notebook.tail861dda.ts.net:8443"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Usuário Orthanc Backup</label>
                        <input
                          className="input h-11 text-sm"
                          value={draft.dicomBackupUsername || ''}
                          onChange={(e) => u('dicomBackupUsername', e.target.value)}
                          placeholder="Ex: admin"
                        />
                      </div>
                      <div>
                        <label className="label">Senha Orthanc Backup</label>
                        <input
                          type="password"
                          className="input h-11 text-sm"
                          value={draft.dicomBackupPassword || ''}
                          onChange={(e) => u('dicomBackupPassword', e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="label">AE Title do Servidor Backup</label>
                        <input
                          className="input h-11 text-sm font-mono"
                          value={draft.dicomBackupOrthancAETitle || ''}
                          onChange={(e) => u('dicomBackupOrthancAETitle', e.target.value.toUpperCase())}
                          placeholder="Ex: ORTHANC_BACKUP"
                        />
                      </div>
                      <div>
                        <label className="label">URL do Agente Local do Backup</label>
                        <input
                          className="input h-11 text-sm"
                          value={draft.dicomBackupLocalAgentUrl || ''}
                          onChange={(e) => u('dicomBackupLocalAgentUrl', e.target.value)}
                          placeholder="Ex: https://servidor-notebook.tail861dda.ts.net"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Diretório Absoluto da Worklist de Backup</label>
                        <input
                          className="input h-11 text-sm"
                          value={draft.dicomBackupWorklistFolder || ''}
                          onChange={(e) => u('dicomBackupWorklistFolder', e.target.value)}
                          placeholder="Ex: C:\OrthancServer\db\WorklistsDatabaseBackup\"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Barra Lateral de Diagnóstico e Parâmetros (Direita - 1 coluna) */}
              <div className="lg:col-span-1 space-y-5">
                {/* Testador de Rede */}
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Wifi size={16} className="text-emerald-500 animate-pulse" />
                    <h3 className="text-xs font-black text-ink-900 uppercase tracking-wider">Diagnóstico de Rede</h3>
                  </div>
                  <p className="text-[10px] text-ink-500 leading-normal">Verifique instantaneamente se a conexão com os servidores Orthanc principal e backup está respondendo.</p>
                  
                  <button
                    type="button"
                    onClick={handleTestPacsConnection}
                    disabled={pacsTestState === 'testing'}
                    className="w-full h-11 rounded-xl bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-black text-xs tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    {pacsTestState === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <Network size={13} />}
                    {pacsTestState === 'testing' ? 'TESTANDO...' : 'TESTAR PACS'}
                  </button>

                  {pacsTestResults && (
                    <div className="space-y-2.5 pt-2">
                      <div className={classNames(
                        "p-3 rounded-xl border text-xs leading-normal",
                        pacsTestResults.primaryOk ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-rose-50/50 border-rose-100 text-rose-800"
                      )}>
                        <div className="flex items-center gap-1.5 font-bold">
                          <div className={classNames("w-2 h-2 rounded-full", pacsTestResults.primaryOk ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                          PACS Principal
                        </div>
                        <p className="mt-1 text-[10px] text-ink-650 opacity-90">{pacsTestResults.primaryMsg}</p>
                      </div>

                      {draft.dicomBackupSyncEnabled && draft.dicomBackupViewerUrl && (
                        <div className={classNames(
                          "p-3 rounded-xl border text-xs leading-normal",
                          pacsTestResults.backupOk ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-rose-50/50 border-rose-100 text-rose-800"
                        )}>
                          <div className="flex items-center gap-1.5 font-bold">
                            <div className={classNames("w-2 h-2 rounded-full", pacsTestResults.backupOk ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                            PACS Backup
                          </div>
                          <p className="mt-1 text-[10px] text-ink-650 opacity-90">{pacsTestResults.backupMsg}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Parâmetros Rápidos para Ultrassom */}
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-teal-600" />
                    <h3 className="text-xs font-black text-ink-900 uppercase tracking-wider">Parâmetros DICOM</h3>
                  </div>
                  <p className="text-[10px] text-ink-500 leading-normal">
                    Utilize os valores abaixo na configuração do painel do seu aparelho de ultrassom:
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-ink-50 border border-ink-100 rounded-xl relative group">
                      <span className="text-[9px] font-bold text-ink-400 uppercase tracking-widest block">IP Servidor PACS (Principal)</span>
                      <strong className="text-ink-800 text-[11px] break-all select-all font-mono">
                        {(() => {
                          try { return draft.dicomViewerUrl ? new URL(draft.dicomViewerUrl).hostname : '127.0.0.1'; } catch { return '127.0.0.1'; }
                        })()}
                      </strong>
                      <button
                        onClick={() => handleCopy(draft.dicomViewerUrl ? new URL(draft.dicomViewerUrl).hostname : '', 'ip')}
                        className="absolute right-2.5 top-2.5 p-1 bg-white hover:bg-ink-100 rounded-md border border-ink-200 text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copiar IP"
                      >
                        {copiedField === 'ip' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>

                    <div className="p-3 bg-ink-50 border border-ink-100 rounded-xl relative group">
                      <span className="text-[9px] font-bold text-ink-400 uppercase tracking-widest block">AE Title (Orthanc)</span>
                      <strong className="text-ink-800 text-[11px] select-all font-mono">
                        {draft.dicomOrthancAETitle || 'ORTHANC'}
                      </strong>
                      <button
                        onClick={() => handleCopy(draft.dicomOrthancAETitle || 'ORTHANC', 'aet')}
                        className="absolute right-2.5 top-2.5 p-1 bg-white hover:bg-ink-100 rounded-md border border-ink-200 text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copiar AE Title"
                      >
                        {copiedField === 'aet' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>

                    <div className="p-3 bg-ink-50 border border-ink-100 rounded-xl">
                      <span className="text-[9px] font-bold text-ink-400 uppercase tracking-widest block">Porta DICOM</span>
                      <strong className="text-ink-800 text-[11px] font-mono">4242</strong>
                    </div>
                  </div>
                </div>

                {/* Arquivos de Manual Físicos */}
                <div className="p-4 bg-ink-900 border border-ink-800 rounded-2xl text-white space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Manual Físico Completo</span>
                  </div>
                  <p className="text-[10px] text-ink-300 leading-relaxed">
                    Você pode acessar um manual de rede completo e detalhado com exemplos de arquivos de configuração em:
                  </p>
                  <div className="bg-ink-950 p-2 rounded-xl border border-ink-800 font-mono text-[9px] text-brand-300 break-all select-all">
                    PACS_MANUAL.md
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guides' && (
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
                {/* Menu Lateral de Seções */}
                <div className="col-span-1 border-r border-ink-100 bg-ink-50/50 p-4 space-y-1">
                  <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest px-3 block mb-3">Tópicos do Manual</span>
                  {[
                    { id: 'architecture', label: '1. Fluxo & Arquitetura', icon: Network },
                    { id: 'prereq', label: '2. Preparação do Servidor', icon: Cpu },
                    { id: 'orthanc_json', label: '3. Configuração do Orthanc', icon: FileText },
                    { id: 'agent', label: '4. Agente Local (Laudus Agent)', icon: Server },
                    { id: 'tailscale', label: '5. Tailscale VPN & SSL', icon: Cloud },
                    { id: 'ultrasound', label: '6. Configuração no Aparelho', icon: Database },
                    { id: 'troubleshoot', label: '7. Resolução de Problemas', icon: HelpCircle }
                  ].map(sec => {
                    const isSelected = selectedSection === sec.id;
                    const Icon = sec.icon;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => setSelectedSection(sec.id as any)}
                        className={classNames(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left',
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50'
                            : 'text-ink-600 hover:bg-ink-100/50 hover:text-ink-900'
                        )}
                      >
                        <Icon size={14} className={isSelected ? 'text-emerald-600' : 'text-ink-400'} />
                        {sec.label}
                      </button>
                    );
                  })}
                </div>

                {/* Conteúdo da Seção Selecionada */}
                <div className="col-span-3 p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
                  {selectedSection === 'architecture' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">📐 Fluxo de Trabalho & Arquitetura</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Entenda como os dados trafegam entre o ultrassom, o servidor PACS local e a nuvem.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {/* Método 1 */}
                        <div className="p-5 rounded-2xl border border-ink-150 bg-ink-50/20 space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-ink-100">
                            <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black">1</span>
                            <h4 className="text-xs font-black text-ink-900 uppercase tracking-wider">Método 1: Rede Local (Intranet Física)</h4>
                          </div>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Adequado quando o computador médico e o ultrassom estão conectados na mesma rede local física do PACS.
                          </p>
                          <div className="flex flex-col gap-2.5">
                            {[
                              { step: "Aparelho de Ultrassom", desc: "Envia requisições C-FIND e envia exames C-STORE na porta 4242 para o Orthanc." },
                              { step: "Navegador do Médico", desc: "Acessa o sistema LAUD.US localmente e interage com o Orthanc via HTTP (porta 8042)." },
                              { step: "Laudus Local Agent", desc: "Escuta na porta 3000 e grava fisicamente os arquivos de worklist (.wl) na pasta configurada." },
                              { step: "Servidor Orthanc", desc: "Lê os arquivos .wl da pasta e disponibiliza a fila de trabalho atualizada para o ultrassom." }
                            ].map((item, idx) => (
                              <div key={idx} className="flex gap-3 text-xs">
                                <span className="font-mono text-ink-400 font-bold">{idx + 1}.</span>
                                <div className="space-y-0.5">
                                  <strong className="text-ink-800 font-bold">{item.step}</strong>
                                  <p className="text-ink-500 text-[11px] font-medium leading-normal">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Método 2 */}
                        <div className="p-5 rounded-2xl border border-ink-150 bg-ink-50/20 space-y-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-ink-100">
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">2</span>
                            <h4 className="text-xs font-black text-ink-900 uppercase tracking-wider">Método 2: Tailscale VPN (Recomendado para Nuvem/Vercel)</h4>
                          </div>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Obrigatório para acesso seguro fora da clínica ou a partir de plataformas seguras HTTPS (como Vercel) para contornar o bloqueio de conteúdo misto (Mixed Content) e dispensar redirecionamento de portas.
                          </p>
                          <div className="flex flex-col gap-2.5">
                            {[
                              { step: "Navegador Seguro (HTTPS Vercel)", desc: "Comunica-se via túnel criptografado seguro com a URL pública ts.net do servidor na porta 8443." },
                              { step: "Laudus Local Agent (HTTPS)", desc: "Funciona como a ponte segura local, gravando arquivos de worklist no servidor." },
                              { step: "Orthanc Local", desc: "Fica isolado e recebe exames localmente via C-STORE (porta 4242) vindos do ultrassom." },
                              { step: "Segurança de Certificado", desc: "A criptografia ponta a ponta SSL é gerada de forma automatizada com certificados Let's Encrypt do próprio Tailscale." }
                            ].map((item, idx) => (
                              <div key={idx} className="flex gap-3 text-xs">
                                <span className="font-mono text-ink-400 font-bold">{idx + 1}.</span>
                                <div className="space-y-0.5">
                                  <strong className="text-ink-800 font-bold">{item.step}</strong>
                                  <p className="text-ink-500 text-[11px] font-medium leading-normal">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'prereq' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🛠️ Preparação do Servidor</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Instalação das dependências fundamentais e pacotes básicos no servidor local.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">1. Instalar Python 3</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            A compilação de arquivos Modality Worklist (<code>.wl</code>) necessita do interpretador Python. Ao instalar no Windows, certifique-se de marcar a opção <strong>"Add python.exe to PATH"</strong> na tela inicial de instalação.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-3">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">2. Instalar a biblioteca pydicom</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Abra o terminal/prompt de comando no servidor e execute o instalador do pacote:
                          </p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                            <span>pip install pydicom</span>
                            <button
                              onClick={() => handleCopy('pip install pydicom', 'pip')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'pip' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">3. Instalar o Orthanc</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Baixe o instalador oficial do Orthanc Server. No Windows, instale-o marcando a opção <strong>"Install Orthanc as a Windows Service"</strong>. No macOS, use o Homebrew:
                          </p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all mb-2">
                            <span>brew install orthanc && brew services start orthanc</span>
                            <button
                              onClick={() => handleCopy('brew install orthanc && brew services start orthanc', 'brew')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'brew' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'orthanc_json' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">📄 Arquivo de Configuração orthanc.json</h3>
                        <p className="text-[11px] text-ink-500 font-medium font-mono">C:\Program Files\Orthanc Server\Configuration\orthanc.json</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-ink-500">Modelo recomendado pré-configurado:</span>
                          <button
                            onClick={() => handleCopy(JSON_TEMPLATE, 'json_tpl')}
                            className="h-8 px-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5"
                          >
                            {copiedField === 'json_tpl' ? <Check size={11} /> : <Copy size={11} />}
                            Copiar orthanc.json Completo
                          </button>
                        </div>
                        <pre className="p-4 bg-zinc-950 text-emerald-400 rounded-xl font-mono text-[10px] overflow-y-auto max-h-[350px] leading-relaxed custom-scrollbar select-all">
                          {JSON_TEMPLATE}
                        </pre>
                        <p className="text-[10px] text-ink-400 italic">Nota: Lembre-se de reiniciar o serviço do Orthanc no gerenciador do Windows após salvar as edições.</p>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'agent' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🤖 O Agente Local (Laudus Local Agent)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Executando o script agent.js como serviço persistente em segundo plano.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">1. Execução Manual Temporária</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            No diretório raiz do projeto LAUDUS no servidor, execute:
                          </p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                            <span>node scripts/agent.js</span>
                            <button
                              onClick={() => handleCopy('node scripts/agent.js', 'agent_run')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'agent_run' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-3">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">2. Rodando como Serviço no Windows (NSSM)</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Para evitar interrupção quando o usuário deslogar da máquina PACS:
                          </p>
                          <div className="text-xs text-ink-700 space-y-1.5 pl-1.5">
                            <p>a. Faça o download do <strong>NSSM</strong> em <a href="https://nssm.cc" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline">nssm.cc</a>.</p>
                            <p>b. Abra o prompt do Windows como Administrador e execute:</p>
                            <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all my-2">
                              <span>nssm install LaudusLocalAgent</span>
                              <button
                                onClick={() => handleCopy('nssm install LaudusLocalAgent', 'nssm_cmd')}
                                className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                                title="Copiar Comando"
                              >
                                {copiedField === 'nssm_cmd' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <p>c. Na interface do NSSM:</p>
                            <ul className="list-disc pl-5 space-y-1 text-ink-600 font-medium">
                              <li><strong>Path:</strong> Aponte para o <code>node.exe</code> local.</li>
                              <li><strong>Startup Directory:</strong> Selecione a pasta do projeto <code>LAUDUS</code>.</li>
                              <li><strong>Arguments:</strong> Digite <code>scripts/agent.js</code></li>
                            </ul>
                            <p className="mt-1">d. Salve e inicialize o serviço <code>LaudusLocalAgent</code> pelo gerenciador de Serviços (<code>services.msc</code>).</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-3">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">3. Rodando como Serviço no macOS (launchd)</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Crie o arquivo <code>/Library/LaunchDaemons/com.laudus.agent.plist</code> com o seguinte conteúdo estrutural:
                          </p>
                          <pre className="p-3 bg-zinc-950 text-emerald-400 rounded-xl font-mono text-[9px] overflow-x-auto select-all max-h-[150px]">
{`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.laudus.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/usuario/Documents/LAUDUS/scripts/agent.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>`}
                          </pre>
                          <p className="text-xs text-ink-650">Carregue o serviço com privilégios administrativos:</p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                            <span>sudo launchctl load -w /Library/LaunchDaemons/com.laudus.agent.plist</span>
                            <button
                              onClick={() => handleCopy('sudo launchctl load -w /Library/LaunchDaemons/com.laudus.agent.plist', 'mac_cmd')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'mac_cmd' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'tailscale' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🛡️ Método 2: Tailscale VPN (MagicDNS & SSL)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Bypass completo de Mixed Content no navegador e HTTPS obrigatório.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-violet-50/30 border border-violet-100 text-violet-850 text-xs leading-relaxed space-y-1">
                          <strong className="block font-bold">Por que o Tailscale VPN é obrigatório na nuvem?</strong>
                          As requisições HTTPS feitas pelo aplicativo na Vercel para servidores HTTP puros na rede local (ex: port 8042) são abortadas pelo navegador. O Tailscale VPN cria um túnel e emite chaves Let's Encrypt reais para suas máquinas.
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-ink-900 uppercase">Passo 1: Habilitar DNS HTTPS</h4>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            No console web do Tailscale, acesse <strong>DNS</strong> e clique em <strong>Enable HTTPS Certificates</strong>. Em seguida, no console do servidor, execute:
                          </p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                            <span>tailscale cert nome-do-seu-servidor.tail861dda.ts.net</span>
                            <button
                              onClick={() => handleCopy('tailscale cert nome-do-seu-servidor.tail861dda.ts.net', 'ts_cert')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'ts_cert' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase">Passo 2: Concatenar Chaves combinadas para o Orthanc (.pem)</h4>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            O Orthanc necessita que o certificado Let's Encrypt e a chave privada estejam no mesmo arquivo PEM.
                          </p>
                          <div className="space-y-2">
                            <span className="text-[10px] text-ink-500 block">No Windows:</span>
                            <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                              <span>copy /b servidor.crt + servidor.key certificado_combinado.pem</span>
                              <button
                                onClick={() => handleCopy('copy /b servidor.crt + servidor.key certificado_combinado.pem', 'win_cat')}
                                className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                                title="Copiar Comando"
                              >
                                {copiedField === 'win_cat' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <span className="text-[10px] text-ink-500 block">No macOS / Linux:</span>
                            <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                              <span>cat servidor.crt servidor.key &gt; certificado_combinado.pem</span>
                              <button
                                onClick={() => handleCopy('cat servidor.crt servidor.key > certificado_combinado.pem', 'mac_cat')}
                                className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                                title="Copiar Comando"
                              >
                                {copiedField === 'mac_cat' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase">Passo 3: Configurar SSL Nativo no orthanc.json</h4>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            No seu arquivo <code>orthanc.json</code>, aponte a porta para <code>8443</code> e informe o caminho do PEM gerado:
                          </p>
                          <pre className="p-4 bg-zinc-950 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed">
                            {`"HttpPort": 8443,\n"SslEnabled": true,\n"SslCertificate": "C:\\\\OrthancServer\\\\config\\\\certificado_combinado.pem"`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'ultrasound' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🖥️ Parametrização no Ultrassom (Modalidade)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Configuração no teclado e console físico do aparelho de imagem.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">1. Cadastro da Fila de Trabalho (Worklist - C-FIND)</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            No menu de configurações DICOM do equipamento, adicione um serviço de Worklist. Preencha o IP do servidor PACS, a porta <strong>4242</strong> e o AE Title <strong>{draft.dicomOrthancAETitle || 'ORTHANC'}</strong>. O local AE Title do equipamento deve coincidir com o configurado em DicomModalities do servidor.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">2. Cadastro de Destino das Imagens (C-STORE)</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            No menu DICOM, configure o serviço de Storage. Utilize as mesmas credenciais: IP do servidor PACS, porta <strong>4242</strong> e o AE Title <strong>{draft.dicomOrthancAETitle || 'ORTHANC'}</strong>.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">3. Verificação de Conexão (C-ECHO / Ping)</h4>
                          <p className="text-xs text-ink-600 leading-relaxed">
                            Selecione os perfis criados no console e clique em <strong>"Verify / Ping / Echo"</strong>. O status retornado pelo aparelho deve ser "Sucesso / Success".
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'troubleshoot' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">❓ Resolução de Problemas (Troubleshooting)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Identifique e resolva falhas comuns de comunicação com o PACS.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="overflow-x-auto border border-ink-150 rounded-xl">
                          <table className="w-full text-xs text-left text-ink-600 font-medium">
                            <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Sintoma</th>
                                <th className="px-4 py-3">Causa Provável</th>
                                <th className="px-4 py-3">Solução</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100 bg-white">
                              <tr>
                                <td className="px-4 py-3 font-bold text-ink-800">Ping do PACS falha na UI</td>
                                <td className="px-4 py-3">Senha de acesso Basic Auth ou URL do proxy incorretas.</td>
                                <td className="px-4 py-3">Confirme os dados cadastrados em `RegisteredUsers` no json do Orthanc.</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-bold text-ink-800">Erro de Mixed Content no navegador</td>
                                <td className="px-4 py-3">Browser em HTTPS tentando consumir IP em HTTP comum.</td>
                                <td className="px-4 py-3">Configure HTTPS no Tailscale e use a URL pública ts.net:8443 no painel.</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-bold text-ink-800">Ultrassom não localiza pacientes</td>
                                <td className="px-4 py-3">AE Title incorreto ou falta de permissão na pasta Worklist.</td>
                                <td className="px-4 py-3">Confirme se o AE Title do aparelho coincide exatamente com a entrada do servidor.</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-bold text-ink-800">Erro de Permissão no Laudus Local Agent</td>
                                <td className="px-4 py-3">Falta de acesso à pasta física mapeada de Worklists.</td>
                                <td className="px-4 py-3">Rode o prompt/Node como administrador ou ajuste as permissões de gravação da pasta.</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

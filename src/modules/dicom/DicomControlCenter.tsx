import { useState, useEffect, type ReactNode } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import {
  Save, RotateCcw, Loader2, Database, Server, Wifi,
  HardDrive, Shield, Cloud, Info, Network, BookOpen,
  Cpu, FileText, CheckCircle2, AlertTriangle, HelpCircle,
  Copy, Check, ArrowRight, Monitor, Radio
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { addAuditLog, getActivePacsUrl, getProxyEndpoint, getDicomAuthParams, getWorklistEndpoint } from '../../store/db';
import { getCachedIdToken } from '../../lib/authToken';

const JSON_TEMPLATE = `{
  "Name" : "PACS LAUDUS",
  "HttpPort" : 8042,
  "HttpServerEnabled" : true,
  "DicomServerEnabled" : true,
  "DicomPort" : 4242,
  "DicomAet" : "ORTHANC",

  "AuthenticationEnabled" : false,
  "RemoteAccessAllowed" : true,

  "DicomAlwaysAllowEcho" : true,
  "DicomAlwaysAllowStore" : true,
  "DicomAlwaysAllowFind" : true,

  "Worklists" : {
    "Enable" : true,
    "Database" : "C:\\\\OrthancServer\\\\db\\\\WorklistsDatabase\\\\"
  }
}`;

type ControlTab = 'config' | 'guides';
type GuideMethod = 'local' | 'tailscale';

/** Resultado de um teste de capacidade (imagens ou worklist) de um servidor. */
type CapResult = { ok: boolean; msg: string; skipped?: boolean };
/** Matriz de diagnóstico: imagens e worklist, para principal e backup. */
type DiagResults = {
  primaryImages: CapResult;
  primaryWorklist: CapResult;
  backupImages: CapResult;
  backupWorklist: CapResult;
};

export function DicomControlCenter() {
  const { settings, updateSettings, showToast } = useApp();
  const { user } = useAuth();
  const { hasPacs } = useSubscription();

  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ControlTab>('config');
  const [selectedSection, setSelectedSection] = useState<'walkthrough' | 'concepts' | 'architecture' | 'prereq' | 'orthanc_json' | 'agent' | 'tailscale' | 'ultrasound' | 'troubleshoot'>('walkthrough');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [pacsTestState, setPacsTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [diag, setDiag] = useState<DiagResults | null>(null);
  const [diagStep, setDiagStep] = useState<string>('');

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

  // Testa a VISUALIZAÇÃO DE IMAGENS (REST do Orthanc via /system) de um servidor.
  async function testImages(isBackup: boolean): Promise<CapResult> {
    const baseUrl = getActivePacsUrl(draft, isBackup);
    if (!baseUrl || baseUrl === 'http://localhost:8042') {
      return { ok: false, msg: 'URL do servidor não configurada' };
    }
    const auth = getDicomAuthParams(draft, isBackup);
    const proxyPath = getProxyEndpoint(draft, isBackup);
    const pingUrl = `${baseUrl.replace(/\/$/, '')}/system`;
    try {
      const res = await fetch(`${proxyPath}?url=${encodeURIComponent(pingUrl)}${auth}`);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, msg: `Orthanc v${data.Version || 'OK'}${data.Name ? ` · ${data.Name}` : ''}` };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, msg: `HTTP ${res.status} — usuário/senha do Orthanc incorretos` };
      return { ok: false, msg: `HTTP ${res.status} — ${res.statusText || 'falha de proxy/servidor'}` };
    } catch (e: any) {
      return { ok: false, msg: e.message || 'Servidor inacessível (offline ou fora do Funnel)' };
    }
  }

  // Testa a WORKLIST de ponta a ponta (agente/Vite → Python → pydicom → pasta)
  // via ping, sem gerar arquivo .wl.
  async function testWorklist(isBackup: boolean): Promise<CapResult> {
    const agent = isBackup ? draft.dicomBackupLocalAgentUrl : draft.dicomLocalAgentUrl;
    const dir = isBackup ? draft.dicomBackupWorklistFolder : draft.dicomWorklistFolder;
    const isVercel = typeof window !== 'undefined' &&
      (window.location.hostname.includes('laud.us') || window.location.hostname.includes('vercel.app'));
    if (isVercel && !agent) {
      return { ok: false, msg: 'URL do Agente Local não configurada (obrigatória na nuvem)' };
    }
    try {
      const res = await fetch(getWorklistEndpoint(draft, isBackup), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCachedIdToken()}`
        },
        body: JSON.stringify({ ping: true, localAgentUrl: agent, outputDir: dir })
      });
      const data = await res.json().catch(() => ({ success: false, error: 'Resposta inválida do agente' }));
      if (data.success) {
        return { ok: true, msg: `Pasta gravável · pydicom ${data.pydicom || 'ok'}` };
      }
      return { ok: false, msg: data.error || 'Falha no agente de worklist' };
    } catch (e: any) {
      return { ok: false, msg: e.message || 'Agente inacessível' };
    }
  }

  async function handleTestPacsConnection() {
    setPacsTestState('testing');
    setDiag(null);
    const backupOn = !!draft.dicomBackupSyncEnabled && !!(draft.dicomBackupViewerUrl || draft.dicomBackupTailscalePublicUrl);
    const skipped: CapResult = { ok: false, msg: 'Backup desabilitado', skipped: true };
    try {
      setDiagStep('Testando servidor principal…');
      const [primaryImages, primaryWorklist] = await Promise.all([testImages(false), testWorklist(false)]);
      setDiagStep(backupOn ? 'Testando servidor de backup…' : '');
      const [backupImages, backupWorklist] = backupOn
        ? await Promise.all([testImages(true), testWorklist(true)])
        : [skipped, skipped];

      const results: DiagResults = { primaryImages, primaryWorklist, backupImages, backupWorklist };
      setDiag(results);

      const primaryOk = primaryImages.ok && primaryWorklist.ok;
      const backupOk = !backupOn || (backupImages.ok && backupWorklist.ok);
      setPacsTestState(primaryOk && backupOk ? 'success' : 'error');

      if (primaryOk && backupOk) {
        showToast('Diagnóstico completo: tudo operacional!', 'success');
      } else if (primaryOk) {
        showToast('Principal OK, mas há falhas no backup.', 'error');
      } else {
        showToast('Falhas detectadas no servidor principal.', 'error');
      }
    } catch (err: any) {
      setPacsTestState('error');
      showToast(err.message || 'Erro crítico ao executar o diagnóstico.', 'error');
    } finally {
      setDiagStep('');
    }
  }

  // Renderiza um "chip" de status para uma capacidade (imagens ou worklist).
  function renderCap(label: string, Icon: typeof Server, r: CapResult) {
    const StatusIcon = r.skipped ? Info : r.ok ? CheckCircle2 : AlertTriangle;
    return (
      <div className={classNames(
        'flex items-start gap-2 p-2.5 rounded-lg border text-[10px] leading-snug',
        r.skipped ? 'bg-ink-50 border-ink-100 text-ink-400'
          : r.ok ? 'bg-emerald-50/60 border-emerald-100 text-emerald-800'
            : 'bg-rose-50/60 border-rose-100 text-rose-800'
      )}>
        <StatusIcon size={13} className={classNames('mt-0.5 shrink-0', r.skipped ? 'text-ink-300' : r.ok ? 'text-emerald-500' : 'text-rose-500')} />
        <div className="min-w-0">
          <div className="font-bold flex items-center gap-1"><Icon size={10} />{label}</div>
          <div className="opacity-90 mt-0.5 break-words">{r.msg}</div>
        </div>
      </div>
    );
  }

  // Renderiza um fluxo horizontal de nós (diagrama de arquitetura).
  function renderFlow(
    title: string,
    titleClass: string,
    nodes: { icon: typeof Server; label: string; sub: string }[]
  ) {
    return (
      <div className="space-y-2">
        <div className={classNames('text-[10px] font-black uppercase tracking-wider', titleClass)}>{title}</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5">
          {nodes.map((n, i) => {
            const NodeIcon = n.icon;
            return (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center justify-center gap-1 w-[88px] h-[68px] rounded-xl border border-ink-150 bg-white dark:bg-ink-800 px-1.5 text-center shadow-sm">
                  <NodeIcon size={16} className="text-ink-500 shrink-0" />
                  <div className="text-[10px] font-bold text-ink-800 leading-tight">{n.label}</div>
                  <div className="text-[8px] text-ink-400 leading-none font-mono">{n.sub}</div>
                </div>
                {i < nodes.length - 1 && <ArrowRight size={14} className="text-ink-300 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    );
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
                      <label className="label">Segredo do Agente (x-agent-secret) — recomendado ao expor via Tailscale</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="input h-11 text-sm font-mono"
                        value={draft.dicomAgentSecret || ''}
                        onChange={(e) => u('dicomAgentSecret', e.target.value)}
                        placeholder="Defina o mesmo valor de LAUDUS_AGENT_SECRET no agente"
                      />
                      <p className="text-[11px] text-ink-400 mt-1 leading-relaxed">
                        Fecha o acesso público ao seu agente. Inicie o agente com o mesmo segredo:
                        <code className="mx-1 px-1 bg-ink-100 rounded">LAUDUS_AGENT_SECRET=... node agent.js</code>. Vazio = agente aberto (não recomendado na nuvem).
                      </p>
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
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-ink-900 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
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
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-ink-900 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
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
                  <p className="text-[10px] text-ink-500 leading-normal">Testa <strong>Imagens</strong> (REST do Orthanc) e <strong>Worklist</strong> (agente → Python → pasta) separadamente, no principal e no backup.</p>

                  <button
                    type="button"
                    onClick={handleTestPacsConnection}
                    disabled={pacsTestState === 'testing'}
                    className="w-full h-11 rounded-xl bg-ink-900 hover:bg-ink-800 disabled:opacity-50 text-white font-black text-xs tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    {pacsTestState === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <Network size={13} />}
                    {pacsTestState === 'testing' ? (diagStep || 'TESTANDO…') : 'EXECUTAR DIAGNÓSTICO'}
                  </button>

                  {diag && (() => {
                    const backupConfigured = !!draft.dicomBackupSyncEnabled && !!(draft.dicomBackupViewerUrl || draft.dicomBackupTailscalePublicUrl);
                    const groups = [
                      { title: 'Servidor Principal', dot: 'bg-emerald-500', images: diag.primaryImages, worklist: diag.primaryWorklist, show: true },
                      { title: 'Servidor Backup', dot: 'bg-indigo-500', images: diag.backupImages, worklist: diag.backupWorklist, show: backupConfigured },
                    ];
                    return (
                      <div className="space-y-3 pt-1 animate-fade-in">
                        {groups.filter(g => g.show).map(g => {
                          const groupOk = g.images.ok && g.worklist.ok;
                          return (
                            <div key={g.title} className="rounded-xl border border-ink-100 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-ink-50/70 border-b border-ink-100">
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-ink-700">
                                  <span className={classNames('w-2 h-2 rounded-full', groupOk ? g.dot : 'bg-rose-500', groupOk && 'animate-pulse')} />
                                  {g.title}
                                </div>
                                <span className={classNames('text-[9px] font-black px-2 py-0.5 rounded-md', groupOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                  {groupOk ? 'OPERACIONAL' : 'COM FALHA'}
                                </span>
                              </div>
                              <div className="p-2 space-y-1.5">
                                {renderCap('Imagens (PACS)', Server, g.images)}
                                {renderCap('Worklist (.wl)', FileText, g.worklist)}
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[9px] text-ink-400 leading-normal px-0.5">
                          A Worklist é testada por <em>ping</em> (verifica agente, Python/pydicom e permissão de escrita na pasta) — nenhum arquivo é criado.
                        </p>
                      </div>
                    );
                  })()}
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
                  <div className="bg-ink-900 p-2 rounded-xl border border-ink-800 font-mono text-[9px] text-brand-300 break-all select-all">
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
                  {[
                    { group: '▶ Comece aqui', items: [
                      { id: 'walkthrough', label: 'Passo a passo (do zero)', icon: CheckCircle2 },
                    ]},
                    { group: 'Entender', items: [
                      { id: 'concepts', label: 'O que é PACS / DICOM', icon: BookOpen },
                      { id: 'architecture', label: 'Como funciona a rede', icon: Network },
                    ]},
                    { group: 'Configurar (detalhado)', items: [
                      { id: 'prereq', label: '1 · Instalar os programas', icon: Cpu },
                      { id: 'orthanc_json', label: '2 · Configurar o Orthanc', icon: FileText },
                      { id: 'agent', label: '3 · Ligar o Agente', icon: Server },
                      { id: 'tailscale', label: '4 · Tailscale (só nuvem)', icon: Cloud },
                      { id: 'ultrasound', label: '5 · Conectar o aparelho', icon: Database },
                    ]},
                    { group: 'Ajuda', items: [
                      { id: 'troubleshoot', label: 'Resolver problemas', icon: HelpCircle },
                    ]},
                  ].map(grp => (
                    <div key={grp.group} className="mb-3.5 space-y-1">
                      <span className="text-[9px] font-black text-ink-400 uppercase tracking-widest px-3 block mb-1.5">{grp.group}</span>
                      {grp.items.map(sec => {
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
                            <Icon size={14} className={classNames('shrink-0', isSelected ? 'text-emerald-600' : 'text-ink-400')} />
                            {sec.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Conteúdo da Seção Selecionada */}
                <div className="col-span-3 p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
                  {selectedSection === 'walkthrough' && (() => {
                    const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
                      <div className="flex gap-3.5">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">{n}</div>
                        <div className="flex-1 space-y-2 pb-1">
                          <h4 className="text-[13px] font-black text-ink-900 leading-tight pt-1">{title}</h4>
                          {children}
                        </div>
                      </div>
                    );
                    const Cmd = ({ text, id }: { text: string; id: string }) => (
                      <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-[11px] select-all">
                        <span className="break-all">{text}</span>
                        <button onClick={() => handleCopy(text, id)} className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 shrink-0" title="Copiar">
                          {copiedField === id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    );
                    const Check_ = ({ children }: { children: ReactNode }) => (
                      <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                        <CheckCircle2 size={13} className="shrink-0 mt-0.5" /><span className="leading-relaxed">{children}</span>
                      </div>
                    );
                    return (
                      <div className="space-y-5 animate-fade-in">
                        <div className="pb-3 border-b border-ink-100">
                          <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">★ Passo a Passo Completo — do Zero ao Funcionando</h3>
                          <p className="text-[11px] text-ink-500 font-medium">Siga de cima para baixo, sem pular. Após o último passo, seu PACS estará operando.</p>
                        </div>

                        {/* Escolha do cenário */}
                        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2.5">
                          <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5"><Info size={13} /> Antes de começar: qual é o seu caso?</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-white border border-ink-150">
                              <div className="font-black text-[11px] text-ink-800 uppercase mb-1">🏠 Cenário LOCAL</div>
                              <p className="text-[11px] text-ink-600 leading-relaxed">Você abre o LAUD.US <strong>no mesmo computador/rede</strong> da clínica. Não precisa de Tailscale. Faça os passos 1–4, 6, 7, 8 (pule o 5).</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-ink-150">
                              <div className="font-black text-[11px] text-ink-800 uppercase mb-1">☁️ Cenário NUVEM</div>
                              <p className="text-[11px] text-ink-600 leading-relaxed">Você acessa o LAUD.US pelo site (<strong>laud.us</strong>), de qualquer lugar. Precisa do Tailscale Funnel. Faça <strong>todos</strong> os passos (1 a 8).</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-ink-400">Todos os passos abaixo são feitos na <strong>máquina servidora</strong> (o computador da clínica que fica ligado com o Orthanc).</p>
                        </div>

                        <div className="space-y-5">
                          <Step n={1} title="Instalar os 3 programas na máquina servidora">
                            <p className="text-[11px] text-ink-600 leading-relaxed">Instale, na ordem: <strong>Orthanc</strong> (o PACS), <strong>Node.js</strong> (roda o Agente) e <strong>Python + pydicom</strong> (gera a worklist).</p>
                            <div className="text-[11px] text-ink-600 space-y-1.5">
                              <div><strong>Windows:</strong> instalador do Orthanc (marque <em>"Install as a Windows Service"</em>) · Node LTS em nodejs.org · Python 3 (marque <em>"Add python.exe to PATH"</em>).</div>
                              <Cmd text="pip install pydicom" id="wt_pip" />
                              <div className="pt-1"><strong>macOS:</strong></div>
                              <Cmd text="brew install orthanc node python && brew services start orthanc && pip3 install pydicom" id="wt_brew" />
                            </div>
                            <Check_>No terminal, <code>node --version</code> e <code>python --version</code> (ou <code>python3</code>) respondem com um número.</Check_>
                          </Step>

                          <Step n={2} title="Criar a pasta da Worklist">
                            <p className="text-[11px] text-ink-600 leading-relaxed">É onde os arquivos <code>.wl</code> serão gravados. Guarde este caminho — você vai usá-lo nos passos 3 e 6.</p>
                            <div className="text-[11px] text-ink-600 space-y-1.5">
                              <div><strong>Windows:</strong> crie a pasta <code>C:\OrthancServer\db\WorklistsDatabase\</code></div>
                              <div><strong>macOS:</strong></div>
                              <Cmd text="mkdir -p ~/OrthancServer/db/WorklistsDatabase" id="wt_mkdir" />
                            </div>
                            <Check_>A pasta existe no explorador de arquivos.</Check_>
                          </Step>

                          <Step n={3} title="Configurar o Orthanc (orthanc.json)">
                            <p className="text-[11px] text-ink-600 leading-relaxed">Abra o <code>orthanc.json</code>, apague o conteúdo e cole o modelo pronto (aba <strong>"3. Configuração do Orthanc"</strong> → botão <em>Copiar</em>). Troque o valor de <code>"Database"</code> pela pasta do passo 2. Salve e <strong>reinicie o Orthanc</strong> (Windows: services.msc → Orthanc → Reiniciar · macOS: <code>brew services restart orthanc</code>).</p>
                            <Check_>Abra <code>http://localhost:8042</code> no navegador da máquina servidora — a tela do Orthanc aparece (sem pedir senha, no modo prático).</Check_>
                          </Step>

                          <Step n={4} title="Ligar o Agente LAUD.US">
                            <p className="text-[11px] text-ink-600 leading-relaxed">Na pasta do projeto LAUDUS, rode e <strong>deixe a janela aberta</strong>:</p>
                            <Cmd text="node scripts/agent.js" id="wt_agent" />
                            <Check_>Aparece: <code>LAUD.US Local Agent rodando na porta 3000</code>. (Para não precisar deixar aberto, veja a seção 4 — rodar como serviço.)</Check_>
                          </Step>

                          <Step n={5} title="SÓ NO CENÁRIO NUVEM: expor o Agente via Tailscale Funnel">
                            <p className="text-[11px] text-ink-600 leading-relaxed">Instale o Tailscale e faça login. No painel web (Settings → DNS) habilite <strong>MagicDNS</strong> e <strong>HTTPS Certificates</strong> (uma vez). Depois, com o Agente rodando, exponha a <strong>porta 3000</strong>:</p>
                            <Cmd text="tailscale funnel --bg 3000" id="wt_funnel" />
                            <Check_>O Tailscale mostra uma URL pública tipo <code>https://servidor-mac.tailXXXX.ts.net</code>. <strong>Copie-a</strong> para o passo 6.</Check_>
                            <div className="text-[10px] text-amber-700 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5">⚠️ No cenário LOCAL, pule este passo inteiro.</div>
                          </Step>

                          <Step n={6} title="Preencher no LAUD.US (Configurações → PACS/DICOM → aba Servidores)">
                            <p className="text-[11px] text-ink-600 leading-relaxed">Preencha conforme o seu cenário e clique em <strong>"Testar Conexão PACS"</strong>:</p>
                            <div className="overflow-x-auto border border-ink-150 rounded-xl">
                              <table className="w-full text-[11px] text-left">
                                <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                                  <tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2">🏠 Local</th><th className="px-3 py-2">☁️ Nuvem</th></tr>
                                </thead>
                                <tbody className="divide-y divide-ink-100 bg-white text-ink-700">
                                  <tr><td className="px-3 py-2 font-bold">URL do Agente Local</td><td className="px-3 py-2 text-ink-400">(vazio)</td><td className="px-3 py-2 font-mono">a URL do Funnel</td></tr>
                                  <tr><td className="px-3 py-2 font-bold">URL do Orthanc</td><td className="px-3 py-2 font-mono">http://localhost:8042</td><td className="px-3 py-2 font-mono">http://localhost:8042</td></tr>
                                  <tr><td className="px-3 py-2 font-bold">URL Pública Tailscale</td><td className="px-3 py-2 text-ink-400">(vazio)</td><td className="px-3 py-2 text-ink-400 font-bold">(vazio!)</td></tr>
                                  <tr><td className="px-3 py-2 font-bold">Usuário / Senha</td><td className="px-3 py-2 text-ink-400">(vazio)</td><td className="px-3 py-2 text-ink-400">(vazio)</td></tr>
                                  <tr><td className="px-3 py-2 font-bold">Pasta da Worklist</td><td className="px-3 py-2" colSpan={2}>o mesmo caminho do passo 2</td></tr>
                                  <tr><td className="px-3 py-2 font-bold">AE Title do Orthanc</td><td className="px-3 py-2 font-mono" colSpan={2}>ORTHANC</td></tr>
                                </tbody>
                              </table>
                            </div>
                            <Check_>Ao testar, aparece a <strong>versão do Orthanc</strong> = conexão OK. Se falhar, veja a seção 7 (Problemas).</Check_>
                          </Step>

                          <Step n={7} title="Configurar o aparelho de ultrassom (uma vez)">
                            <p className="text-[11px] text-ink-600 leading-relaxed">No menu DICOM do aparelho, cadastre <strong>Worklist</strong> e <strong>Storage</strong> com os mesmos dados (o aparelho fala direto com o Orthanc na rede local):</p>
                            <ul className="text-[11px] text-ink-600 space-y-0.5 list-disc pl-4">
                              <li><strong>IP:</strong> o IP local da máquina servidora (ex: 192.168.1.100)</li>
                              <li><strong>Porta:</strong> 4242 · <strong>AE Title remoto:</strong> ORTHANC</li>
                              <li><strong>AE Title local:</strong> o nome do aparelho (ex: MINDRAYMX7)</li>
                            </ul>
                            <Check_>O botão <strong>Verify/Test</strong> do aparelho acusa "Sucesso".</Check_>
                          </Step>

                          <Step n={8} title="Testar tudo de ponta a ponta">
                            <ul className="text-[11px] text-ink-600 space-y-1 list-disc pl-4">
                              <li>Crie um exame no LAUD.US → confira se surgiu um arquivo <code>agendamento_XXX.wl</code> na pasta da worklist.</li>
                              <li>No aparelho, busque a worklist → o paciente deve aparecer, sem digitar.</li>
                              <li>Faça o exame → as imagens voltam e aparecem no editor de laudos.</li>
                            </ul>
                            <Check_>Funcionou os três? PACS configurado com sucesso. 🎉</Check_>
                          </Step>
                        </div>

                        <div className="p-3.5 rounded-xl bg-ink-900 text-white text-[11px] leading-relaxed">
                          <strong className="text-emerald-400">Segurança (opcional):</strong> no cenário nuvem, o Funnel deixa o Agente público. Para fechá-lo, veja a seção 4 (variável <code>LAUDUS_AGENT_SECRET</code> + campo "Segredo do Agente"). No caminho prático, pode deixar aberto.
                        </div>
                      </div>
                    );
                  })()}

                  {selectedSection === 'concepts' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🎓 Conceitos Básicos — Comece Por Aqui</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Nunca mexeu com PACS/DICOM? Sem problema. Esta página explica tudo em linguagem simples, sem termos técnicos.</p>
                      </div>

                      {/* O que é, em uma frase */}
                      <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                        <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5"><Info size={13} /> Em uma frase</h4>
                        <p className="text-xs text-ink-700 leading-relaxed">
                          Este módulo conecta o <strong>LAUD.US</strong> ao seu <strong>aparelho de ultrassom</strong>: ele <strong>envia os dados do paciente</strong> para a tela do aparelho (para você não redigitar nome/data) e <strong>traz as imagens capturadas</strong> de volta para dentro do laudo. É a ponte entre o computador e o ultrassom.
                        </p>
                      </div>

                      {/* Analogia */}
                      <div className="p-4 rounded-2xl border border-ink-150 bg-ink-50/30 space-y-2.5">
                        <h4 className="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5">🍽️ Uma analogia simples (restaurante)</h4>
                        <ul className="text-xs text-ink-600 leading-relaxed space-y-1.5">
                          <li><strong>A Worklist</strong> é como a <strong>comanda de pedidos</strong> que vai para a cozinha: você anota o pedido (o exame do paciente) e ele aparece na tela do ultrassom, prontinho, sem o operador digitar nada.</li>
                          <li><strong>O PACS (Orthanc)</strong> é como o <strong>álbum de fotos</strong> do restaurante: guarda todas as imagens que o ultrassom "fotografou" e as organiza por paciente.</li>
                          <li><strong>O Ultrassom</strong> é a <strong>câmera</strong>: lê a comanda, tira as fotos e as devolve para o álbum.</li>
                          <li><strong>O LAUD.US</strong> é o <strong>garçom</strong>: anota o pedido, entrega na cozinha e traz as fotos até a sua mesa (o laudo).</li>
                        </ul>
                      </div>

                      {/* As duas funções */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-blue-700 font-black text-xs uppercase tracking-wider"><FileText size={13} /> 1. Worklist (ida)</div>
                          <p className="text-[11px] text-ink-600 leading-relaxed">O LAUD.US cria um "cartão de identificação" digital do paciente (arquivo <code>.wl</code>) e o entrega ao aparelho. No ultrassom, o operador só seleciona o nome — sem digitar.</p>
                        </div>
                        <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-black text-xs uppercase tracking-wider"><Database size={13} /> 2. Imagens (volta)</div>
                          <p className="text-[11px] text-ink-600 leading-relaxed">Depois do exame, as imagens ficam guardadas no PACS. O LAUD.US as busca automaticamente e mostra dentro do editor de laudos, prontas para anexar.</p>
                        </div>
                      </div>

                      {/* Glossário */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><BookOpen size={13} /> Glossário — o que cada palavra significa</h4>
                        <div className="overflow-x-auto border border-ink-150 rounded-xl">
                          <table className="w-full text-xs text-left">
                            <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                              <tr><th className="px-3 py-2.5">Termo</th><th className="px-3 py-2.5">O que é (em português claro)</th></tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100 bg-white">
                              {[
                                ['DICOM', 'O "idioma" universal que aparelhos médicos usam para trocar imagens e dados. Como o PDF é para documentos, o DICOM é para exames.'],
                                ['PACS', 'O arquivo/servidor que guarda e organiza todas as imagens dos exames. É o "álbum de fotos" central.'],
                                ['Orthanc', 'O programa gratuito que usamos como PACS. Roda no computador da clínica guardando as imagens.'],
                                ['Worklist (MWL)', 'A "lista/fila de trabalho" que aparece no ultrassom com os pacientes agendados. Evita digitar dados no aparelho.'],
                                ['Arquivo .wl', 'O cartão de identificação de um paciente dentro da worklist. Cada exame vira um arquivo .wl.'],
                                ['AE Title', 'O "apelido" (nome de rede) de cada equipamento DICOM para que eles se reconheçam. Ex: ORTHANC, MINDRAYMX7.'],
                                ['Porta (ex: 4242, 8042)', 'Um "número de porta de entrada" no computador. Cada serviço usa a sua: imagens numa, site do Orthanc noutra.'],
                                ['C-STORE / C-FIND', 'Comandos DICOM: C-STORE = "guarde esta imagem"; C-FIND = "procure este paciente na lista".'],
                                ['Agente Local', 'Pequeno programa do LAUD.US que roda na clínica e cria os arquivos .wl na pasta certa do Orthanc.'],
                                ['Tailscale', 'Uma "rede privada segura" (VPN) que liga a clínica à internet com segurança, sem abrir portas no roteador.'],
                                ['Funnel', 'Recurso do Tailscale que publica um endereço https seguro para a nuvem (Vercel) conseguir falar com a clínica.'],
                                ['Proxy', 'Um "intermediário" que repassa pedidos. O LAUD.US usa um proxy para falar com o Orthanc com segurança.'],
                              ].map(([term, desc]) => (
                                <tr key={term}>
                                  <td className="px-3 py-2.5 font-bold text-ink-800 font-mono text-[11px] whitespace-nowrap align-top">{term}</td>
                                  <td className="px-3 py-2.5 text-ink-600 leading-relaxed">{desc}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Ordem recomendada */}
                      <div className="p-4 rounded-2xl bg-ink-900 text-white space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={13} /> Ordem recomendada de leitura</h4>
                        <p className="text-[11px] text-ink-300 leading-relaxed">
                          Siga os tópicos do menu na ordem: <strong className="text-white">1</strong> entenda o fluxo → <strong className="text-white">2</strong> prepare o servidor → <strong className="text-white">3</strong> configure o Orthanc → <strong className="text-white">4</strong> ligue o Agente → <strong className="text-white">5</strong> (nuvem) configure o Tailscale → <strong className="text-white">6</strong> ajuste o aparelho → <strong className="text-white">7</strong> resolva problemas. Ao final, use o botão <strong className="text-white">"Executar Diagnóstico"</strong> na aba de Servidores para conferir se está tudo verde.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'architecture' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🌐 Como Funciona a Rede</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Quem fala com quem — e quem precisa (ou não) do Tailscale.</p>
                      </div>

                      {/* Diagrama visual do fluxo de dados */}
                      <div className="rounded-2xl border border-ink-150 bg-ink-50/30 p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Network size={14} className="text-emerald-500" />
                          <span className="text-[10px] font-black text-ink-500 uppercase tracking-widest">Diagrama do Fluxo (modo nuvem via Tailscale)</span>
                        </div>
                        {renderFlow('① Imagens — visualização no editor', 'text-emerald-600', [
                          { icon: Monitor, label: 'Navegador', sub: 'LAUD.US' },
                          { icon: Cloud, label: 'Vercel', sub: 'proxy' },
                          { icon: Database, label: 'Orthanc', sub: ':8443' },
                        ])}
                        {renderFlow('② Worklist — envio de exames (.wl)', 'text-blue-600', [
                          { icon: Monitor, label: 'Navegador', sub: 'LAUD.US' },
                          { icon: Cloud, label: 'Vercel', sub: 'serverless' },
                          { icon: Cpu, label: 'Agente/Vite', sub: ':443' },
                          { icon: FileText, label: 'Pasta .wl', sub: 'grava' },
                          { icon: Database, label: 'Orthanc', sub: 'lê fila' },
                        ])}
                        {renderFlow('③ Ultrassom — captura de imagens', 'text-violet-600', [
                          { icon: Radio, label: 'Ultrassom', sub: 'modalidade' },
                          { icon: Database, label: 'Orthanc', sub: 'C-STORE :4242' },
                        ])}
                        <p className="text-[9px] text-ink-400 leading-normal pt-1 border-t border-ink-100">
                          No modo <strong>local/on-premise</strong>, o navegador e o Vite ficam na própria máquina do PACS — os passos "Vercel" são omitidos e o acesso ao Orthanc é direto por HTTP na porta 8042.
                        </p>
                      </div>

                      {/* A REDE — quem fala com quem / quem precisa de Tailscale */}
                      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-4 sm:p-5 space-y-4">
                        <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5"><Network size={14} /> A Rede — Quem fala com quem (leia isto)</h4>

                        <p className="text-[11px] text-ink-700 leading-relaxed">
                          Existem <strong>duas conversas separadas</strong> e independentes. Entender isso resolve 90% da confusão:
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-3.5 rounded-xl bg-white border border-ink-150 space-y-1.5">
                            <div className="font-black text-[11px] text-violet-700 uppercase flex items-center gap-1.5"><Radio size={13} /> Conversa 1 — Aparelho ↔ Orthanc (SEMPRE local)</div>
                            <p className="text-[11px] text-ink-600 leading-relaxed">
                              O ultrassom conversa com o Orthanc <strong>pela rede local (Wi-Fi/cabo)</strong>, usando o <strong>IP local</strong> do servidor e a <strong>porta 4242</strong> (protocolo DICOM). Isso <strong>nunca</strong> passa pela internet nem pelo Tailscale. Os dois só precisam estar na <strong>mesma rede</strong> (mesma sub-rede, ex: ambos <code>192.168.1.x</code>).
                            </p>
                          </div>
                          <div className="p-3.5 rounded-xl bg-white border border-ink-150 space-y-1.5">
                            <div className="font-black text-[11px] text-emerald-700 uppercase flex items-center gap-1.5"><Cloud size={13} /> Conversa 2 — Nuvem ↔ Agente (só no cenário nuvem)</div>
                            <p className="text-[11px] text-ink-600 leading-relaxed">
                              Quando você abre o LAUD.US pela internet (site laud.us), o navegador precisa alcançar a clínica. O <strong>Tailscale Funnel</strong> dá um endereço HTTPS público ao <strong>Agente</strong>. Este é o <strong>único</strong> ponto que sai para a internet. No cenário 100% local, essa conversa não existe.
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-amber-200 rounded-xl bg-white">
                          <table className="w-full text-[11px] text-left">
                            <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                              <tr><th className="px-3 py-2">Componente</th><th className="px-3 py-2">Precisa de Tailscale?</th></tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100 text-ink-700">
                              <tr><td className="px-3 py-2 font-bold">Servidor (Orthanc + Agente)</td><td className="px-3 py-2"><strong className="text-emerald-700">Sim — só no cenário nuvem.</strong> A máquina do servidor entra na tailnet e roda o Funnel.</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Aparelho de ultrassom</td><td className="px-3 py-2"><strong className="text-rose-700">❌ NÃO, nunca.</strong> Só precisa estar na mesma rede local do servidor. Aparelhos de US nem instalam Tailscale.</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Navegador do médico</td><td className="px-3 py-2"><strong className="text-rose-700">❌ Não.</strong> Acessa o site normalmente; o app alcança a clínica sozinho via Funnel.</td></tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="p-3 rounded-xl bg-ink-900 text-white text-[11px] leading-relaxed">
                          <strong className="text-amber-400">Resposta direta:</strong> o <strong>aparelho de ultrassom NÃO precisa de Tailscale</strong> e não fica "conectado à rede Tailscale". Ele só precisa estar na <strong>mesma rede local</strong> do servidor Orthanc, apontando para o IP local dele na porta 4242. O Tailscale existe apenas para a <strong>nuvem alcançar a clínica</strong> — só a máquina servidora entra na tailnet.
                        </div>

                        <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-[11px] text-ink-700 leading-relaxed">
                          <strong className="text-blue-800">Rede local feita do jeito certo:</strong> deixe o servidor com <strong>IP fixo</strong> (reserve o IP no roteador por DHCP, ou configure IP estático) — se o IP mudar, o aparelho perde o servidor. Garanta que aparelho e servidor estão na <strong>mesma sub-rede</strong> e libere a <strong>porta 4242</strong> (entrada) no firewall da máquina servidora.
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

                      <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 flex gap-2.5">
                        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-ink-700 leading-relaxed">
                          <strong className="text-blue-800">Em palavras simples:</strong> antes de conectar, o computador da clínica precisa de 3 programas — <strong>Python</strong> (o motor que cria os cartões de paciente <code>.wl</code>), a biblioteca <strong>pydicom</strong> (ensina o Python a "falar DICOM") e o <strong>Orthanc</strong> (o PACS que guarda as imagens). Instale-os uma única vez.
                        </div>
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

                      <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 flex gap-2.5">
                        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-ink-700 leading-relaxed">
                          <strong className="text-blue-800">Em palavras simples:</strong> o Orthanc lê todas as suas configurações de um único arquivo de texto, o <code>orthanc.json</code> — é o "painel de controle" dele. O modelo abaixo é o <strong>prático (sem senha)</strong>: define as <strong>portas</strong> e a <strong>pasta da worklist</strong>. Copie, ajuste o caminho da worklist e reinicie o Orthanc. <em>(Para exigir senha, troque <code>"AuthenticationEnabled": true</code> e adicione <code>"RegisteredUsers"</code> — veja a seção Segurança.)</em>
                        </div>
                      </div>

                      {/* Como o Orthanc funciona */}
                      <div className="rounded-2xl border border-ink-150 bg-ink-50/30 p-4 space-y-2.5">
                        <h4 className="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><Info size={13} /> Como o Orthanc funciona</h4>
                        <p className="text-[11px] text-ink-600 leading-relaxed">
                          O Orthanc é um servidor PACS que faz três coisas ao mesmo tempo, cada uma numa "porta":
                        </p>
                        <ul className="text-[11px] text-ink-600 leading-relaxed space-y-1.5">
                          <li><strong className="font-mono">:4242 (DICOM)</strong> — a porta que o <strong>aparelho de ultrassom</strong> usa. Por ela o Orthanc recebe imagens (<strong>C-STORE</strong>) e responde à busca de worklist (<strong>C-FIND</strong>). É sempre acesso na rede local.</li>
                          <li><strong className="font-mono">:8042 (HTTP/API)</strong> — a porta que o <strong>LAUD.US/Agente</strong> usa para ler imagens e informações. É também a interface web do Orthanc (abra <code>http://localhost:8042</code>).</li>
                          <li><strong>Plugin de Worklist</strong> — o Orthanc lê os arquivos <code>.wl</code> de uma pasta (a que você define em <code>Worklists.Database</code>) e os oferece ao aparelho. O <strong>Agente LAUD.US</strong> é quem grava esses <code>.wl</code> ali.</li>
                        </ul>
                        <div className="p-2.5 rounded-lg bg-white border border-ink-150 text-[11px] text-ink-700 leading-relaxed">
                          Fluxo completo: LAUD.US → Agente grava <code>.wl</code> → Orthanc oferece na worklist (4242) → aparelho lê e faz o exame → aparelho envia imagens (4242, C-STORE) → Orthanc guarda → LAUD.US busca as imagens (8042) e mostra no laudo.
                        </div>
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

                      <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 flex gap-2.5">
                        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-ink-700 leading-relaxed">
                          <strong className="text-blue-800">Em palavras simples:</strong> um site, por segurança, não pode gravar arquivos direto no seu computador. O <strong>Agente</strong> é um programinha do LAUD.US que fica rodando na clínica e faz esse trabalho por ele — recebe o pedido e grava o arquivo <code>.wl</code> na pasta que o Orthanc vigia. Ele precisa estar <strong>sempre ligado</strong>.
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 text-emerald-900 text-xs leading-relaxed space-y-1">
                          <strong className="block font-bold">Gateway único (worklist + imagens)</strong>
                          O agente agora também faz proxy do Orthanc em <code>/api/orthanc-proxy</code>. Basta expor o agente via <strong>Tailscale Funnel (HTTPS)</strong> e preencher a "URL do Agente Local" — uma única exposição atende tanto a gravação de worklist (.wl) quanto a visualização de imagens na nuvem. Sem o agente exposto em HTTPS, a Worklist funciona no localhost mas falha no Vercel.
                        </div>

                        <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
                          <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5"><Shield size={13} /> Segurança: proteja o agente antes de expor</h4>
                          <p className="text-xs text-ink-700 leading-relaxed">
                            Exponha via Funnel o <strong>Agente</strong> — <strong>nunca</strong> o servidor de desenvolvimento (<code>npm run dev</code>), que não tem autenticação. Antes de publicar o agente, defina um segredo compartilhado (o Vercel envia esse mesmo segredo automaticamente):
                          </p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                            <span>export LAUDUS_AGENT_SECRET="uma-senha-longa-aleatoria"</span>
                            <button
                              onClick={() => handleCopy('export LAUDUS_AGENT_SECRET="uma-senha-longa-aleatoria"', 'agent_secret')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'agent_secret' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <p className="text-[10px] text-ink-500 leading-relaxed">
                            Defina a MESMA variável <code>LAUDUS_AGENT_SECRET</code> nas <strong>Environment Variables do Vercel</strong>. Sem o segredo, o agente aceita qualquer requisição (ok só em rede local isolada).
                          </p>
                        </div>

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

                      <div className="p-3.5 rounded-xl bg-ink-50 border border-ink-150 text-[11px] text-ink-700 leading-relaxed space-y-1.5">
                        <strong className="block text-ink-900">Variáveis opcionais do Agente</strong>
                        <div><code>LAUDUS_AGENT_SECRET</code> — exige um segredo (feche o Agente na internet; cole o mesmo valor no campo "Segredo do Agente").</div>
                        <div><code>LAUDUS_WORKLIST_DIR</code> — força a pasta onde grava a worklist.</div>
                        <div><code>LAUDUS_ALLOWED_HOSTS</code> — restringe o proxy ao seu Orthanc (ex: <code>localhost,127.0.0.1</code>).</div>
                        <div className="text-ink-400">Sem elas, o Agente roda aberto. Pasta padrão: <code>~/OrthancServer/db/WorklistsDatabase/</code> (macOS) ou <code>C:\OrthancServer\db\WorklistsDatabase\</code> (Windows).</div>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'tailscale' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider">🛡️ Método 2: Tailscale Funnel (Nuvem / Vercel)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">HTTPS público para o Agente em 1 comando — sem certificados manuais.</p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 flex gap-2.5">
                        <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-ink-700 leading-relaxed">
                          <strong className="text-blue-800">Em palavras simples:</strong> quando o LAUD.US roda na nuvem (site <strong>laud.us</strong>), o navegador está "na internet" e o Orthanc está "trancado dentro da clínica". O <strong>Tailscale</strong> cria um túnel seguro com cadeado (HTTPS) entre os dois — <strong>sem precisar mexer no roteador</strong> nem abrir portas perigosas. Só é necessário se você usa a versão na nuvem.
                        </div>
                      </div>

                      {/* Como funciona o Tailscale */}
                      <div className="rounded-2xl border border-ink-150 bg-ink-50/30 p-4 space-y-2.5">
                        <h4 className="text-xs font-black text-ink-800 uppercase tracking-wider flex items-center gap-1.5"><Info size={13} /> Como o Tailscale funciona (3 ideias)</h4>
                        <ul className="text-[11px] text-ink-600 leading-relaxed space-y-1.5">
                          <li><strong>1. VPN mesh:</strong> cada computador em que você instala o Tailscale e faz login com a mesma conta ganha um IP privado <code>100.x.y.z</code> e passa a "se enxergar" com os outros, de forma criptografada, <strong>sem abrir portas no roteador</strong>.</li>
                          <li><strong>2. MagicDNS:</strong> em vez de decorar IPs, cada máquina ganha um nome <code>nome.tailXXXX.ts.net</code>.</li>
                          <li><strong>3. Funnel:</strong> por padrão o Tailscale é <strong>privado</strong> (só entre as suas máquinas). O <strong>Funnel</strong> é o que <strong>publica um serviço na internet pública</strong> com HTTPS — é isso que a Vercel (que não está na sua tailnet) usa para alcançar o Agente.</li>
                        </ul>
                        <div className="p-2.5 rounded-lg bg-white border border-ink-150 text-[11px] text-ink-700 leading-relaxed">
                          <strong>O que entra na tailnet:</strong> apenas a <strong>máquina servidora</strong> da clínica (a do Orthanc + Agente). <strong>NÃO</strong> o aparelho de ultrassom, <strong>NÃO</strong> o computador/celular do médico — o navegador acessa o site normalmente e o app faz a ponte via Funnel.
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 text-emerald-900 text-xs leading-relaxed space-y-1">
                          <strong className="block font-bold">Jeito simples: exponha só o Agente (Funnel)</strong>
                          Em vez de gerar certificados e habilitar SSL no Orthanc, dê um endereço HTTPS público ao <strong>Agente</strong> com o Tailscale Funnel. O Agente já conversa com o Orthanc em <code>localhost</code> — você expõe <strong>um só</strong> componente, sem mexer no roteador e sem arquivos <code>.pem</code>.
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-ink-900 uppercase">Passo 1: Habilitar HTTPS na tailnet (uma vez)</h4>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            No console web do Tailscale, em <strong>Settings → DNS</strong>, habilite <strong>MagicDNS</strong> e <strong>HTTPS Certificates</strong>.
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase">Passo 2: Expor o Agente (porta 3000) via Funnel</h4>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            No servidor, com o Agente rodando, execute (⚠️ o Agente, <strong>não</strong> o Orthanc nem o Vite):
                          </p>
                          <div className="flex items-center justify-between p-3 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-xs select-all">
                            <span>tailscale funnel --bg 3000</span>
                            <button
                              onClick={() => handleCopy('tailscale funnel --bg 3000', 'ts_funnel')}
                              className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 ml-2"
                              title="Copiar Comando"
                            >
                              {copiedField === 'ts_funnel' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            O Tailscale devolve uma URL pública, tipo <code>https://servidor-mac.tailXXXX.ts.net</code>.
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h4 className="text-xs font-bold text-ink-900 uppercase">Passo 3: Preencher no LAUD.US</h4>
                          <p className="text-xs text-ink-500 leading-relaxed">
                            Na aba de configuração, use: <strong>URL do Agente Local</strong> = a URL do Funnel; <strong>URL do Orthanc</strong> = <code>http://localhost:8042</code>; deixe a <strong>URL Pública Tailscale vazia</strong> (assim as imagens passam pelo Agente). Clique em <strong>Testar Conexão</strong>.
                          </p>
                          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-[11px] text-amber-800 leading-relaxed">
                            O Funnel deixa o Agente <strong>público</strong>. Para fechá-lo, defina um <strong>Segredo do Agente</strong> (campo na configuração) e inicie o Agente com <code>LAUDUS_AGENT_SECRET=… node agent.js</code>. Opcional, mas recomendado na nuvem.
                          </div>
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

                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 text-[11px] text-ink-700 leading-relaxed">
                        <strong className="text-amber-900">Antes de tudo:</strong> esta conexão é <strong>100% rede local</strong>. O aparelho fala com o Orthanc pelo <strong>IP local</strong> do servidor, na porta <strong>4242</strong> — <strong>sem Tailscale, sem internet</strong>. Aparelho e servidor precisam estar na <strong>mesma rede</strong> (mesmo Wi-Fi/switch).
                      </div>

                      {/* Pré-requisitos */}
                      <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-2">
                        <h4 className="text-xs font-black text-ink-900 uppercase tracking-wider">✅ Pré-requisitos (confira antes)</h4>
                        <ul className="text-[11px] text-ink-600 space-y-1 list-disc pl-4">
                          <li>Orthanc <strong>rodando</strong> na máquina servidora (abra <code>http://localhost:8042</code> nela).</li>
                          <li>Aparelho e servidor na <strong>mesma rede local</strong>.</li>
                          <li>Servidor com <strong>IP fixo</strong> (reserve no roteador) — se mudar, o aparelho perde a conexão.</li>
                          <li><strong>Porta 4242 liberada</strong> no firewall da máquina servidora (entrada).</li>
                        </ul>
                      </div>

                      {/* Passo A: descobrir o IP */}
                      <div className="p-4 rounded-xl bg-white border border-ink-150 space-y-2.5">
                        <h4 className="text-xs font-black text-ink-900 uppercase tracking-wider">Passo A — Descubra o IP local do servidor</h4>
                        <p className="text-[11px] text-ink-600 leading-relaxed">Na <strong>máquina do Orthanc</strong>, rode:</p>
                        <div className="space-y-1.5 text-[11px] text-ink-600">
                          <div><strong>Windows:</strong></div>
                          <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-[11px] select-all">
                            <span>ipconfig</span>
                            <button onClick={() => handleCopy('ipconfig', 'us_ipcfg')} className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 shrink-0" title="Copiar">{copiedField === 'us_ipcfg' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}</button>
                          </div>
                          <div className="text-ink-400">→ procure "IPv4 Address" (ex: 192.168.1.100)</div>
                          <div className="pt-1"><strong>macOS:</strong></div>
                          <div className="flex items-center justify-between gap-2 p-2.5 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-[11px] select-all">
                            <span>ipconfig getifaddr en0</span>
                            <button onClick={() => handleCopy('ipconfig getifaddr en0', 'us_ipmac')} className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 shrink-0" title="Copiar">{copiedField === 'us_ipmac' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}</button>
                          </div>
                          <div className="text-ink-400">(Wi-Fi: <code>en0</code>; cabo: tente <code>en1</code>). Anote esse número — é o <strong>IP do servidor</strong>.</div>
                        </div>
                      </div>

                      {/* Os dados exatos */}
                      <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100 space-y-2">
                        <h4 className="text-xs font-black text-ink-900 uppercase tracking-wider">Os 4 dados que o aparelho precisa</h4>
                        <div className="overflow-x-auto border border-ink-150 rounded-xl bg-white">
                          <table className="w-full text-[11px] text-left">
                            <tbody className="divide-y divide-ink-100 text-ink-700">
                              <tr><td className="px-3 py-2 font-bold w-1/2">IP do servidor (Host)</td><td className="px-3 py-2 font-mono">o IP do Passo A (ex: 192.168.1.100)</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Porta</td><td className="px-3 py-2 font-mono">4242</td></tr>
                              <tr><td className="px-3 py-2 font-bold">AE Title do servidor (remoto)</td><td className="px-3 py-2 font-mono">{draft.dicomOrthancAETitle || 'ORTHANC'}</td></tr>
                              <tr><td className="px-3 py-2 font-bold">AE Title do aparelho (local)</td><td className="px-3 py-2 font-mono">o nome do aparelho (ex: MINDRAYMX7)</td></tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-ink-500 leading-relaxed">
                          <strong>AE Title?</strong> É o "apelido de rede" de cada equipamento DICOM. No modelo prático deste guia, o Orthanc está com <code>DicomAlwaysAllow*: true</code> — então ele <strong>aceita qualquer</strong> AE Title do aparelho, sem precisar cadastrar. (Se você ligou a validação por <code>DicomModalities</code>, aí o AE local do aparelho precisa estar cadastrado lá com o mesmo nome.)
                        </p>
                      </div>

                      {/* Passos B, C, D */}
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-1.5">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">Passo B — Teste a conexão primeiro (C-ECHO)</h4>
                          <p className="text-[11px] text-ink-600 leading-relaxed">No menu DICOM do aparelho, crie um destino com os 4 dados acima e clique em <strong>Verify / Ping / Echo</strong>. <strong>Comece por aqui</strong>: se o Echo falhar, nada mais funciona (é rede/firewall). Deve retornar <strong>"Success"</strong>.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-1.5">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">Passo C — Worklist / MWL (baixar a lista de pacientes)</h4>
                          <p className="text-[11px] text-ink-600 leading-relaxed">Em <strong>DICOM → Worklist / MWL</strong>, adicione um serviço com os mesmos 4 dados. É o que faz o paciente agendado aparecer na tela do aparelho (via <strong>C-FIND</strong>), sem digitar. Teste com <strong>Verify</strong>.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 space-y-1.5">
                          <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">Passo D — Storage (enviar as imagens)</h4>
                          <p className="text-[11px] text-ink-600 leading-relaxed">Em <strong>DICOM → Storage / Store SCP</strong>, adicione um destino com os mesmos 4 dados. É por onde o aparelho envia as fotos ao Orthanc (via <strong>C-STORE</strong>) ao finalizar o exame. Teste com <strong>Verify</strong>.</p>
                        </div>
                      </div>

                      {/* Onde fica no menu por marca */}
                      <div className="p-4 rounded-xl bg-white border border-ink-150 space-y-2">
                        <h4 className="text-xs font-black text-ink-900 uppercase tracking-wider">Onde fica no menu (por marca — pode variar por modelo)</h4>
                        <div className="overflow-x-auto border border-ink-150 rounded-xl">
                          <table className="w-full text-[11px] text-left">
                            <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider"><tr><th className="px-3 py-2">Marca</th><th className="px-3 py-2">Caminho aproximado</th></tr></thead>
                            <tbody className="divide-y divide-ink-100 text-ink-700">
                              <tr><td className="px-3 py-2 font-bold">Mindray</td><td className="px-3 py-2">Setup → DICOM/Network → Local + Worklist/Storage Server</td></tr>
                              <tr><td className="px-3 py-2 font-bold">GE (Logiq/Voluson)</td><td className="px-3 py-2">Utility/Config → Connectivity → Dataflow / Service (Worklist, Storage)</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Samsung</td><td className="px-3 py-2">Setup → DICOM → Servidor (Worklist / Storage)</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Philips (Affiniti/EPIQ)</td><td className="px-3 py-2">Setup → DICOM Settings → Worklist / Store destinations</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Canon/Toshiba</td><td className="px-3 py-2">Menu → DICOM → MWL + Storage SCU</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Troubleshooting da conexão */}
                      <div className="p-4 rounded-xl bg-rose-50/30 border border-rose-100 space-y-2">
                        <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Se não conectar</h4>
                        <ul className="text-[11px] text-ink-700 space-y-1.5">
                          <li><strong>Echo falha:</strong> IP errado / aparelho em outra rede / porta 4242 bloqueada no firewall. Teste um <code>ping IP_DO_SERVIDOR</code> do aparelho, se ele permitir.</li>
                          <li><strong>Echo OK, mas worklist vazia:</strong> não há <code>.wl</code> na pasta (crie um exame no LAUD.US) ou o AE Title local do aparelho não bate com o <code>DicomModalities</code> (se você ligou a validação).</li>
                          <li><strong>Imagens não chegam:</strong> destino de <strong>Storage</strong> não configurado ou AE/porta errados. Confira que o Store aponta para o mesmo IP:4242.</li>
                          <li><strong>Nome do paciente não casa:</strong> acentos/caracteres. O nome vai em maiúsculas sem acento; se o aparelho filtrar por nome, apague o filtro e busque "todos".</li>
                        </ul>
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
                                <td className="px-4 py-3 font-bold text-ink-800">Worklist falha só na nuvem (Vercel)</td>
                                <td className="px-4 py-3">Agente Local não exposto/HTTPS — a nuvem não alcança a porta 3000 da clínica.</td>
                                <td className="px-4 py-3">Exponha o agente via Tailscale Funnel em HTTPS e preencha a "URL do Agente Local" com o endereço <code>https://...ts.net</code>.</td>
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

import { useState, useEffect, type ReactNode } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import {
  Save, RotateCcw, Loader2, Database, Server, Wifi,
  HardDrive, Cloud, Info, Network, BookOpen,
  Cpu, FileText, CheckCircle2, AlertTriangle, HelpCircle,
  Copy, Check, ArrowRight, Monitor, Radio,
  Users, Image, RefreshCw, Sparkles,
  SlidersHorizontal, ChevronDown
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { addAuditLog, getActivePacsUrl, getProxyEndpoint, getDicomAuthParams, getWorklistEndpoint } from '../../store/db';
import { MyPacsCard } from './MyPacsCard';
import { UltrasoundSetupCard } from './UltrasoundSetupCard';
import { getIdToken } from '../../lib/authToken';

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

type ControlTab = 'config' | 'guides' | 'storage';

/** Estatísticas de armazenamento/quantidades de um servidor Orthanc (VM ou backup). */
type ServerStorage = {
  label: string;
  isBackup: boolean;
  ok: boolean;
  error?: string;
  version?: string;
  name?: string;
  countPatients?: number;
  countStudies?: number;
  countInstances?: number;
  diskMB?: number;
};

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
  // A VM autoconfigura tudo; os campos técnicos ficam recolhidos por padrão.
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedSection, setSelectedSection] = useState<'overview' | 'setup_vm' | 'app_config' | 'relay' | 'backup' | 'troubleshoot' | 'concepts'>('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [pacsTestState, setPacsTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [diag, setDiag] = useState<DiagResults | null>(null);
  const [diagStep, setDiagStep] = useState<string>('');

  const [storage, setStorage] = useState<ServerStorage[] | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageFetchedAt, setStorageFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function u<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  /**
   * Aplica um preset ao Servidor Principal. Preenche apenas os campos estruturais
   * (URL do Orthanc, AE Title, pasta da worklist, sync). NÃO sobrescreve a URL do
   * Agente nem o Segredo — esses são específicos da instalação do usuário.
   */
  function applyServerPreset(kind: 'cloud' | 'local') {
    setDraft((d) => ({
      ...d,
      dicomSyncEnabled: true,
      dicomViewerUrl: 'http://localhost:8042',
      dicomOrthancAETitle: 'ORTHANC',
      dicomWorklistFolder:
        kind === 'cloud'
          ? '/opt/orthanc-data/worklists'
          : 'C:\\OrthancServer\\db\\WorklistsDatabase\\',
      // Na nuvem, todo o tráfego passa pelo Agente (Funnel). A URL pública direta
      // do Orthanc não é usada — limpamos para o proxy mirar localhost:8042 na VM.
      ...(kind === 'cloud' ? { dicomTailscalePublicUrl: '' } : {}),
    }));
    showToast(
      kind === 'cloud'
        ? 'Preset "Servidor na Nuvem (VM)" aplicado. Preencha a URL do Agente (Funnel) e o Segredo, depois Salve.'
        : 'Preset "Servidor Local" aplicado. Ajuste a pasta da worklist se necessário e Salve.',
      'success'
    );
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
    const agent = isBackup ? draft.dicomBackupLocalAgentUrl : draft.dicomLocalAgentUrl;
    // No modelo de agente-proxy (nuvem), 'http://localhost:8042' é o valor CORRETO
    // (o agente encaminha ao Orthanc na própria VM). Só é "não configurado" se não
    // houver nem URL nem agente.
    if (!baseUrl || (baseUrl === 'http://localhost:8042' && !agent)) {
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

  // Busca estatísticas de armazenamento/quantidades (Orthanc /statistics + /system)
  // de um servidor via o mesmo proxy usado pelas imagens.
  async function fetchServerStorage(isBackup: boolean): Promise<ServerStorage> {
    const label = isBackup ? 'Servidor Backup' : 'Servidor Principal (VM)';
    const baseUrl = getActivePacsUrl(draft, isBackup);
    const auth = getDicomAuthParams(draft, isBackup);
    const proxyPath = getProxyEndpoint(draft, isBackup);
    const base = baseUrl.replace(/\/$/, '');
    try {
      const [statsRes, sysRes] = await Promise.all([
        fetch(`${proxyPath}?url=${encodeURIComponent(`${base}/statistics`)}${auth}`),
        fetch(`${proxyPath}?url=${encodeURIComponent(`${base}/system`)}${auth}`),
      ]);
      if (!statsRes.ok) {
        const msg = statsRes.status === 401 || statsRes.status === 403
          ? 'Usuário/senha do Orthanc incorretos'
          : `HTTP ${statsRes.status} — servidor inacessível`;
        return { label, isBackup, ok: false, error: msg };
      }
      const stats = await statsRes.json();
      const sys = sysRes.ok ? await sysRes.json().catch(() => ({})) : {};
      const num = (v: any) => (typeof v === 'number' ? v : parseInt(v, 10) || 0);
      return {
        label,
        isBackup,
        ok: true,
        version: sys.Version,
        name: sys.Name,
        countPatients: num(stats.CountPatients),
        countStudies: num(stats.CountStudies),
        countInstances: num(stats.CountInstances),
        diskMB: num(stats.TotalDiskSizeMB),
      };
    } catch (e: any) {
      return { label, isBackup, ok: false, error: e.message || 'Servidor inacessível (offline ou fora do Funnel)' };
    }
  }

  async function refreshStorage() {
    setStorageLoading(true);
    try {
      const backupOn = !!(draft.dicomBackupViewerUrl || draft.dicomBackupTailscalePublicUrl || draft.dicomBackupLocalAgentUrl);
      const results = await Promise.all([
        fetchServerStorage(false),
        ...(backupOn ? [fetchServerStorage(true)] : []),
      ]);
      setStorage(results);
      setStorageFetchedAt(Date.now());
    } finally {
      setStorageLoading(false);
    }
  }

  // Nada configurado ainda (nem PACS gerenciado, nem agente manual) — não faz
  // sentido consultar o Orthanc; mostramos direto o estado vazio guiado.
  const noPacsConfigured = (!settings.pacsInstance || settings.pacsInstance.status === 'none') && !settings.dicomLocalAgentUrl;

  // Carrega as estatísticas ao abrir a aba de Armazenamento (uma vez por abertura).
  useEffect(() => {
    if (activeTab === 'storage' && !storage && !storageLoading && !noPacsConfigured) {
      refreshStorage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, noPacsConfigured]);

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
    const secret = isBackup ? draft.dicomBackupAgentSecret : draft.dicomAgentSecret;
    try {
      const res = await fetch(getWorklistEndpoint(draft, isBackup), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Token FRESCO (verifyAuth do Vercel recusa o cache vazio/expirado).
          'Authorization': `Bearer ${await getIdToken()}`,
          // Segredo do agente: exigido pelo agente na VM (x-agent-secret).
          ...(secret ? { 'x-agent-secret': secret } : {})
        },
        body: JSON.stringify({ ping: true, localAgentUrl: agent, outputDir: dir, agentSecret: secret, tenantId: isBackup ? undefined : draft.dicomTenantId })
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
          <button
            onClick={() => setActiveTab('storage')}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-1 justify-center sm:flex-none sm:justify-start',
              activeTab === 'storage'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
            )}
          >
            <Database size={13} />
            Armazenamento & Exames
          </button>
        </div>

        {/* ─── TAB CONTENT ─── */}
        <div className="w-full">
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
              {/* Form de Configuração Principal (Esquerda - 2 colunas) */}
              <div className="lg:col-span-2 space-y-5">
                {/* PACS gerenciado (self-service) — provisiona e autoconfigura */}
                <MyPacsCard onOpenExams={() => setActiveTab('storage')} />

                {/* Conectar ultrassom — ajustes simples pessoais + aparelhos */}
                <UltrasoundSetupCard />

                {/* ── Configuração avançada (recolhida — a VM autoconfigura) ── */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white border border-ink-150 hover:border-ink-300 shadow-sm transition-all"
                >
                  <span className="flex items-center gap-2 text-xs font-black text-ink-600 uppercase tracking-wider">
                    <SlidersHorizontal size={14} className="text-ink-400" />
                    Configuração avançada (manual)
                  </span>
                  <ChevronDown size={16} className={classNames('text-ink-400 transition-transform', showAdvanced && 'rotate-180')} />
                </button>
                {!showAdvanced && (
                  <p className="text-[11px] text-ink-400 -mt-3 px-1 leading-relaxed">
                    Servidor, agente, segredo, pasta e backup são preenchidos automaticamente pelo "Criar meu PACS". Abra apenas para ajustes ou suporte.
                  </p>
                )}

                {showAdvanced && (<>
                {/* Servidor PACS Principal */}
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-ink-50">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Server size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink-900">Servidor PACS Principal (Matriz)</h3>
                      <p className="text-xs text-ink-500 font-medium">Parametrização do Orthanc ativo na nuvem (VM) ou rede local.</p>
                    </div>
                  </div>

                  {/* Presets rápidos: preenchem os campos estruturais conforme o cenário */}
                  <div className="rounded-xl bg-ink-50 border border-ink-100 p-3">
                    <p className="text-[10px] font-bold text-ink-500 uppercase tracking-wider mb-2">Preencher automaticamente</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => applyServerPreset('cloud')}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Cloud size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink-900">Servidor na Nuvem (VM)</p>
                          <p className="text-[10px] text-ink-500 leading-tight">Orthanc localhost · worklist /opt/orthanc-data/worklists</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyServerPreset('local')}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-ink-200 hover:border-ink-400 hover:bg-ink-50 transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center shrink-0">
                          <HardDrive size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink-900">Servidor Local (Windows)</p>
                          <p className="text-[10px] text-ink-500 leading-tight">Orthanc localhost · worklist C:\OrthancServer\…</p>
                        </div>
                      </button>
                    </div>
                    <p className="text-[10px] text-ink-400 mt-2 leading-relaxed">
                      Os presets preenchem só os campos estruturais. A <strong>URL do Agente</strong> (Funnel) e o <strong>Segredo</strong> continuam por sua conta.
                    </p>
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
                      <label className="label flex items-center gap-1.5 relative">
                        AE Title do Servidor (Orthanc)
                        <span className="group relative cursor-help">
                          <Info size={12} className="text-ink-400 hover:text-emerald-600 transition-colors inline-block" />
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-ink-900 text-white text-[10px] normal-case tracking-normal rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg leading-normal font-bold text-center">
                            É o "nome" que identifica o servidor PACS na rede DICOM — precisa ser o mesmo valor configurado no aparelho de ultrassom. Se não souber, pergunte ao suporte técnico do fabricante do aparelho.
                          </span>
                        </span>
                      </label>
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
                </>)}
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

                {/* Ajuda rápida — remete ao guia in-app em vez de repetir dados */}
                <div className="p-4 bg-ink-900 border border-ink-800 rounded-2xl text-white space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Precisa de ajuda?</span>
                  </div>
                  <p className="text-[10px] text-ink-300 leading-relaxed">
                    Os valores para o aparelho estão no card <strong className="text-white">"Conectar meu ultrassom"</strong>. O passo a passo completo está na aba <strong className="text-white">"Guia de Configuração"</strong>.
                  </p>
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
                      { id: 'overview', label: 'Visão geral', icon: BookOpen },
                      { id: 'setup_vm', label: '1 · Montar a VM (nuvem)', icon: Cloud },
                      { id: 'app_config', label: '2 · Configurar no LAUD.US', icon: Server },
                      { id: 'relay', label: '3 · Relé + ultrassom', icon: Radio },
                    ]},
                    { group: 'Extras', items: [
                      { id: 'backup', label: 'Backup local (opcional)', icon: HardDrive },
                    ]},
                    { group: 'Ajuda', items: [
                      { id: 'troubleshoot', label: 'Resolver problemas', icon: HelpCircle },
                      { id: 'concepts', label: 'Conceitos & glossário', icon: Info },
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

                  <div className="mt-4 p-3 rounded-xl bg-ink-900 text-white space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} className="text-emerald-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Projeto completo</span>
                    </div>
                    <p className="text-[10px] text-ink-300 leading-relaxed">Migração de exames, automação por usuário e riscos no documento:</p>
                    <code className="block bg-black/40 p-1.5 rounded-lg text-[9px] text-emerald-300 break-all">docs/PROJETO_PACS_NUVEM.md</code>
                  </div>
                </div>

                {/* Conteúdo da Seção Selecionada */}
                <div className="col-span-3 p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
                  {(() => {
                    const Cmd = ({ text, id }: { text: string; id: string }) => (
                      <div className="flex items-start justify-between gap-2 p-2.5 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-[11px]">
                        <span className="break-all whitespace-pre-wrap select-all leading-relaxed">{text}</span>
                        <button onClick={() => handleCopy(text, id)} className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-300 shrink-0" title="Copiar">
                          {copiedField === id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    );
                    const Step = ({ n, title, children }: { n: number | string; title: string; children: ReactNode }) => (
                      <div className="flex gap-3.5">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm">{n}</div>
                        <div className="flex-1 space-y-2 pb-1 min-w-0">
                          <h4 className="text-[13px] font-black text-ink-900 leading-tight pt-1">{title}</h4>
                          {children}
                        </div>
                      </div>
                    );
                    const P = ({ children }: { children: ReactNode }) => (
                      <p className="text-[11px] text-ink-600 leading-relaxed">{children}</p>
                    );
                    const Note = ({ tone = 'blue', children }: { tone?: 'blue' | 'amber' | 'emerald'; children: ReactNode }) => {
                      const map: Record<string, string> = {
                        blue: 'bg-blue-50/60 border-blue-100 text-blue-800',
                        amber: 'bg-amber-50/60 border-amber-100 text-amber-800',
                        emerald: 'bg-emerald-50/60 border-emerald-100 text-emerald-800',
                      };
                      return <div className={classNames('flex items-start gap-1.5 text-[11px] rounded-lg border px-2.5 py-2 leading-relaxed', map[tone])}><Info size={13} className="shrink-0 mt-0.5" /><span>{children}</span></div>;
                    };

                    return (
                    <>
                  {selectedSection === 'overview' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Cloud size={16} className="text-emerald-600" /> Visão geral — servidor PACS na nuvem</h3>
                        <p className="text-[11px] text-ink-500 font-medium">O servidor principal é uma VM (Google Cloud). A clínica só faz um relé Tailscale. O local vira backup opcional.</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase tracking-wider"><Sparkles size={13} /> O jeito fácil (self-service)</div>
                        <p className="text-[11px] text-ink-700 leading-relaxed">Na aba <strong>Servidores</strong>, o cartão <strong>“Criar meu PACS”</strong> provisiona e configura tudo sozinho — você só escolhe o plano. Depois é só apontar o ultrassom (passo 3). Este guia explica os bastidores.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg bg-white border border-ink-150">
                            <div className="text-[10px] font-black text-blue-700 uppercase">Compartilhado (Starter/Pro)</div>
                            <p className="text-[10px] text-ink-600 leading-relaxed">Seu cliente vira um “tenant” isolado numa VM compartilhada — barato e imediato.</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-ink-150">
                            <div className="text-[10px] font-black text-emerald-700 uppercase">Dedicado</div>
                            <p className="text-[10px] text-ink-600 leading-relaxed">Uma VM própria por cliente, criada automaticamente (~3 min) — isolamento máximo.</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-zinc-900 text-zinc-100 overflow-x-auto">
                        <pre className="text-[10px] leading-relaxed font-mono text-zinc-300 whitespace-pre">{`  CLÍNICA                          NUVEM — VM do usuário
  ┌───────────────────┐            ┌────────────────────────────┐
  │ Ultrassom         │            │ Debian + Tailscale         │
  │   │ DICOM :4242    │ Tailscale │  • Orthanc (Docker)        │
  │   ▼                │══cripto══▶│      :8042 HTTP :4242 DICOM │
  │ RELÉ              │            │  • Agente LAUD.US :3000    │
  │ (GL.iNet ou PC)   │            │  • Funnel HTTPS (público)  │
  └───────────────────┘            └─────────────┬──────────────┘
                                                  │
     LAUD.US (navegador) ── HTTPS via Funnel ─────┘`}</pre>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-white border border-ink-150 space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-700"><Cloud size={14} /><span className="text-[11px] font-black uppercase">VM (nuvem)</span></div>
                          <p className="text-[10px] text-ink-600 leading-relaxed">Orthanc + Agente + dados. Servidor <strong>principal</strong>, sempre ligado.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-ink-150 space-y-1">
                          <div className="flex items-center gap-1.5 text-ink-700"><Radio size={14} /><span className="text-[11px] font-black uppercase">Relé</span></div>
                          <p className="text-[10px] text-ink-600 leading-relaxed">GL.iNet ou o PC do dia a dia. Liga o ultrassom à VM. Sem dados locais.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-ink-150 space-y-1">
                          <div className="flex items-center gap-1.5 text-blue-700"><Monitor size={14} /><span className="text-[11px] font-black uppercase">Navegador</span></div>
                          <p className="text-[10px] text-ink-600 leading-relaxed">Abre o LAUD.US pelo site. Fala com a VM via Funnel. <strong>Sem Tailscale.</strong></p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-black text-ink-800 uppercase tracking-wider mb-2">Quem precisa de Tailscale?</h4>
                        <div className="overflow-x-auto border border-ink-150 rounded-xl">
                          <table className="w-full text-[11px] text-left text-ink-600">
                            <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                              <tr><th className="px-3 py-2">Peça</th><th className="px-3 py-2">Tailscale?</th></tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100 bg-white">
                              <tr><td className="px-3 py-2 font-bold">VM (Orthanc + Agente)</td><td className="px-3 py-2 text-emerald-700 font-bold">Sim — é o coração da rede.</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Relé da clínica (GL.iNet / PC)</td><td className="px-3 py-2 text-emerald-700 font-bold">Sim — liga o ultrassom à VM.</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Ultrassom</td><td className="px-3 py-2 text-rose-700 font-bold">Não — fala só com o relé (LAN).</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Navegador do médico</td><td className="px-3 py-2 text-rose-700 font-bold">Não — usa o site + Funnel.</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <Note tone="emerald">Fluxo: criar exame no LAUD.US → Agente grava a worklist na VM → ultrassom lê e faz o exame → imagens sobem à VM (4242) → LAUD.US mostra as imagens no laudo (via Agente/Funnel).</Note>
                    </div>
                  )}

                  {selectedSection === 'setup_vm' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Cloud size={16} className="text-emerald-600" /> 1 · Montar a VM (Google Cloud)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Um único comando configura tudo. Rode por SSH numa VM Debian/Ubuntu. Região sugerida: southamerica-east1.</p>
                      </div>

                      <Step n={1} title="Um comando faz tudo (turnkey)">
                        <P>Como <strong>root</strong> na VM. Ele baixa os scripts, instala Docker/Node/pydicom, sobe o agente em <strong>modo multi-tenant</strong>, ativa o <strong>Funnel</strong> e aplica o <strong>hardening</strong>:</P>
                        <Cmd id="vm-turnkey" text="curl -fsSL https://laudus.vercel.app/pacs/pacs-vm-setup.sh | sudo bash" />
                        <Note>Com disco de dados dedicado (recomendado): <code>curl -fsSL .../pacs-vm-setup.sh | sudo DATA_DISK=/dev/sdb bash</code>. Ao final, o script imprime o que colar na Vercel e o IP para o relé.</Note>
                      </Step>

                      <Step n={2} title="Colar na Vercel + Redeploy">
                        <P>O script mostra estes dois valores. Em <strong>Vercel → Settings → Environment Variables</strong>, adicione-os e faça <strong>Redeploy</strong>:</P>
                        <Cmd id="vm-vercel" text={`PACS_SHARED_AGENT_URL=https://orthanc-server.<tailnet>.ts.net
PACS_ADMIN_SECRET=<o segredo que o script gerou>`} />
                        <Note>Com isso, o botão <strong>“Criar meu PACS”</strong> (Starter/Pro) provisiona o cliente sozinho na VM.</Note>
                      </Step>

                      <Step n={3} title="Provisão de clientes (automática ou manual)">
                        <P><strong>Automática:</strong> cada cliente clica em “Criar meu PACS” e o tenant nasce isolado, com o app autoconfigurado. <strong>Manual</strong> (se quiser criar você mesmo):</P>
                        <Cmd id="vm-tenant" text="sudo /opt/pacs-tenant.sh create        # cria um tenant e mostra os dados" />
                        <Cmd id="vm-tenant-ls" text="/opt/pacs-tenant.sh list               # lista os tenants da VM" />
                      </Step>

                      <Note tone="amber">Setup manual detalhado (avançado) e o plano <strong>Dedicado</strong> (VM própria por cliente, criada automaticamente pelo app) estão documentados em <code>docs/PACS_TENANT_SETUP.md</code> e <code>docs/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md</code>.</Note>

                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2">
                        <ArrowRight size={14} /> VM pronta. Agora vá para <strong>2 · Configurar no LAUD.US</strong>.
                      </div>
                    </div>
                  )}

                  {selectedSection === 'app_config' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Server size={16} className="text-emerald-600" /> 2 · Configurar no LAUD.US</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Na aba <strong>Servidores &amp; Conexão</strong>, use o preset e preencha 2 campos.</p>
                      </div>

                      <Step n={1} title="Aplicar o preset">
                        <P>No topo do card "Servidor PACS Principal", clique em <strong>☁️ Servidor na Nuvem (VM)</strong>. Ele preenche Orthanc = <code>http://localhost:8042</code>, AE = <code>ORTHANC</code> e a pasta da worklist, e ativa a sincronização.</P>
                      </Step>

                      <Step n={2} title="Completar os 2 campos da sua VM">
                        <div className="overflow-x-auto border border-ink-150 rounded-xl">
                          <table className="w-full text-[11px] text-left text-ink-600">
                            <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                              <tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Valor</th></tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100 bg-white">
                              <tr><td className="px-3 py-2 font-bold">URL do Agente Local</td><td className="px-3 py-2 font-mono">a URL do Funnel (<code>https://…ts.net</code>)</td></tr>
                              <tr><td className="px-3 py-2 font-bold">Segredo do Agente</td><td className="px-3 py-2 font-mono">o mesmo <code>LAUDUS_AGENT_SECRET</code></td></tr>
                              <tr><td className="px-3 py-2 font-bold text-ink-400">URL do Orthanc</td><td className="px-3 py-2 text-ink-400">já vem <code>http://localhost:8042</code></td></tr>
                              <tr><td className="px-3 py-2 font-bold text-ink-400">Pasta da Worklist</td><td className="px-3 py-2 text-ink-400">já vem <code>/opt/orthanc-data/worklists</code></td></tr>
                            </tbody>
                          </table>
                        </div>
                      </Step>

                      <Step n={3} title="Salvar e testar">
                        <P>Clique em <strong>Salvar</strong> e depois em <strong>Executar Diagnóstico</strong> (aba Servidores). Imagens e Worklist do "Servidor Principal" devem ficar verdes.</P>
                      </Step>

                      <Note tone="emerald">Pronto: worklist e imagens já passam pela VM. Falta só o relé para o ultrassom (passo 3).</Note>
                    </div>
                  )}

                  {selectedSection === 'relay' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Radio size={16} className="text-emerald-600" /> 3 · Relé + ultrassom</h3>
                        <p className="text-[11px] text-ink-500 font-medium">O relé faz o ultrassom (que não roda Tailscale) alcançar a VM. Escolha o seu caso.</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-800"><Wifi size={14} /><span className="text-[11px] font-black uppercase tracking-wider">Modo A1 — Roteador GL.iNet (recomendado)</span></div>
                        <P>O GL.iNet já roda Tailscale e roteia a LAN para a tailnet. Sempre ligado, zero software extra.</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li>No admin da tailnet, <strong>aprove as rotas</strong> anunciadas pelo GL.iNet.</li>
                          <li>No ultrassom, aponte Worklist e Storage para o <strong>IP tailnet da VM (100.x):4242</strong>, AE <code>ORTHANC</code>.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2">
                        <div className="flex items-center gap-2 text-ink-800"><Cpu size={14} /><span className="text-[11px] font-black uppercase tracking-wider">Modo A2 — PC do dia a dia (com Tailscale)</span></div>
                        <P>O PC não é o gateway, então encaminhamos a porta 4242 dele para a VM. No ultrassom, aponte para o <strong>IP LAN do PC:4242</strong>.</P>
                        <p className="text-[10px] text-ink-500 font-bold">Windows (nativo):</p>
                        <Cmd id="relay-netsh" text="netsh interface portproxy add v4tov4 listenport=4242 listenaddress=0.0.0.0 connectport=4242 connectaddress=<IP-TAILNET-DA-VM>" />
                        <p className="text-[10px] text-ink-500 font-bold">macOS/Linux:</p>
                        <Cmd id="relay-socat" text="socat TCP-LISTEN:4242,fork,reuseaddr TCP:<IP-TAILNET-DA-VM>:4242" />
                        <Note tone="amber">Neste modo o ultrassom só alcança a VM com o PC ligado e no Tailscale.</Note>
                      </div>

                      <Step n="✓" title="Validar (nos dois modos)">
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li><strong>C-ECHO</strong> no ultrassom → sucesso.</li>
                          <li>Criar exame no LAUD.US → a worklist aparece no aparelho.</li>
                          <li>Fazer o exame → as imagens sobem à VM e aparecem no laudo.</li>
                        </ul>
                      </Step>
                    </div>
                  )}

                  {selectedSection === 'backup' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><HardDrive size={16} className="text-indigo-600" /> Backup local (opcional)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Um Orthanc local como redundância — útil se a internet cair na clínica.</p>
                      </div>

                      <P>A VM é o principal. Se quiser contingência offline, mantenha um Orthanc local e ative-o como backup:</P>
                      <Step n={1} title="Ligar um Orthanc local na clínica">
                        <P>Instale o Orthanc num PC da clínica (mesmo <code>orthanc.json</code> prático). Ele guarda uma cópia das imagens.</P>
                      </Step>
                      <Step n={2} title="Cadastrar como backup no LAUD.US">
                        <P>Na aba Servidores, ative <strong>"Habilitar Servidor de Redundância"</strong> e preencha a URL/agente do Orthanc local. O LAUD.US grava a worklist e busca imagens nos dois — se a VM cair, o backup cobre.</P>
                      </Step>
                      <Step n={3} title="Enviar imagens aos dois (no ultrassom)">
                        <P>Configure no aparelho <strong>dois destinos de Storage</strong>: a VM (via relé) e o Orthanc local. Assim cada exame é gravado em ambos automaticamente.</P>
                      </Step>
                      <Note>Sem backup, tudo bem: a VM já é o servidor de verdade. O backup é só para quem quer redundância.</Note>
                    </div>
                  )}

                  {selectedSection === 'troubleshoot' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><HelpCircle size={16} className="text-emerald-600" /> Resolver problemas</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Falhas comuns no cenário da VM e como resolver.</p>
                      </div>
                      <div className="overflow-x-auto border border-ink-150 rounded-xl">
                        <table className="w-full text-[11px] text-left text-ink-600">
                          <thead className="text-[10px] text-ink-400 uppercase bg-ink-50/50 border-b border-ink-150 font-black tracking-wider">
                            <tr><th className="px-3 py-3">Sintoma</th><th className="px-3 py-3">Causa provável</th><th className="px-3 py-3">Solução</th></tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100 bg-white">
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">Diagnóstico vermelho / imagens não carregam</td>
                              <td className="px-3 py-3">URL do Agente errada, agente parado, ou segredo diferente.</td>
                              <td className="px-3 py-3">Confira a URL do Funnel (<code>https://…ts.net</code>) e se o <strong>Segredo do Agente</strong> é idêntico ao <code>LAUDUS_AGENT_SECRET</code> da VM. Teste <code>curl https://…ts.net/</code>.</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">PDF/imagem cheia falha (401/403)</td>
                              <td className="px-3 py-3">Segredo do agente ausente na sessão.</td>
                              <td className="px-3 py-3">Preencha o <strong>Segredo do Agente</strong> e Salve. (Corrigido no app — recarrega sozinho ao salvar.)</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">Worklist não aparece no ultrassom</td>
                              <td className="px-3 py-3">Relé não alcança a VM, ou AE Title divergente.</td>
                              <td className="px-3 py-3">Verifique o relé (IP tailnet:4242 ou portproxy). AE do aparelho deve bater com o servidor. Faça um C-ECHO.</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">Ultrassom não envia imagens</td>
                              <td className="px-3 py-3">Porta 4242 fechada no caminho relé→VM.</td>
                              <td className="px-3 py-3">Confirme <code>0.0.0.0:4242</code> no docker-compose e o relé apontando para o IP tailnet da VM.</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">Botão "Viewer" externo sumiu</td>
                              <td className="px-3 py-3">É o esperado na nuvem.</td>
                              <td className="px-3 py-3">O Stone externo não é alcançável na VM; use o <strong>visualizador embutido</strong> (funciona via Agente).</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {selectedSection === 'concepts' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Info size={16} className="text-emerald-600" /> Conceitos &amp; glossário</h3>
                        <p className="text-[11px] text-ink-500 font-medium">O básico para entender cada peça do sistema.</p>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          ['PACS', 'Sistema que guarda e distribui imagens médicas. Aqui, o Orthanc é o PACS.'],
                          ['Orthanc', 'O servidor PACS (leve, open-source). Roda em Docker na VM. Guarda os estudos e oferece a worklist.'],
                          ['DICOM', 'O "idioma" das imagens médicas. Trafega pela porta 4242 (C-ECHO, C-STORE, C-FIND).'],
                          ['Worklist', 'A lista de exames pendentes que o aparelho lê. O Agente grava um arquivo .wl por exame.'],
                          ['Agente LAUD.US', 'Programa que roda na VM: grava as worklists e faz de ponte (proxy) para o Orthanc. Único ponto exposto à internet.'],
                          ['Tailscale', 'VPN privada que liga VM, relé e ultrassom com criptografia, sem abrir portas na internet.'],
                          ['Funnel', 'Recurso do Tailscale que dá um endereço https:// público ao Agente, para o site (Vercel) alcançar a VM.'],
                          ['Relé', 'Ponte na clínica (GL.iNet ou PC) que leva o tráfego DICOM do ultrassom até a VM pela tailnet.'],
                          ['AE Title', 'O "nome" de cada nó DICOM. O AE do aparelho e o do servidor precisam bater.'],
                        ].map(([term, desc]) => (
                          <div key={term} className="flex gap-3 p-2.5 rounded-lg bg-white border border-ink-150">
                            <span className="text-[11px] font-black text-emerald-700 shrink-0 w-28">{term}</span>
                            <span className="text-[11px] text-ink-600 leading-relaxed">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                    </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (() => {
            const fmtSize = (mb?: number) => {
              if (mb === undefined || mb === null) return '—';
              if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
              return `${mb.toLocaleString('pt-BR')} MB`;
            };
            const fmtNum = (n?: number) => (n === undefined || n === null ? '—' : n.toLocaleString('pt-BR'));
            const Metric = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) => (
              <div className="rounded-xl border border-ink-100 bg-white p-3 flex flex-col gap-1">
                <div className={classNames('w-8 h-8 rounded-lg flex items-center justify-center', tone)}>
                  <Icon size={16} />
                </div>
                <span className="text-lg font-black text-ink-900 leading-none mt-1">{value}</span>
                <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">{label}</span>
              </div>
            );
            return (
              <div className="animate-fade-in space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-ink-900 flex items-center gap-2"><Database size={16} className="text-emerald-600" /> Armazenamento &amp; Quantidade de Exames</h3>
                    <p className="text-[11px] text-ink-500 font-medium">Dados ao vivo do Orthanc (VM na nuvem e backup, se configurado).</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {storageFetchedAt && (
                      <span className="text-[10px] text-ink-400 font-medium">Atualizado às {new Date(storageFetchedAt).toLocaleTimeString('pt-BR')}</span>
                    )}
                    <button
                      onClick={refreshStorage}
                      disabled={storageLoading}
                      className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-ink-900 hover:bg-ink-800 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                    >
                      <RefreshCw size={12} className={storageLoading ? 'animate-spin' : ''} />
                      Atualizar
                    </button>
                  </div>
                </div>

                {noPacsConfigured ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 gap-3 bg-white rounded-2xl border border-dashed border-ink-200">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Cloud size={26} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-ink-900">Você ainda não tem um PACS configurado</p>
                      <p className="text-[11px] text-ink-500 mt-1 max-w-sm mx-auto leading-relaxed">Crie seu PACS na nuvem em um clique — nós provisionamos e configuramos tudo automaticamente.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('config')}
                      className="h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm transition-all flex items-center gap-2"
                    >
                      <Sparkles size={13} /> Criar meu PACS
                    </button>
                  </div>
                ) : storageLoading && !storage && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-ink-100">
                    <Loader2 size={28} className="animate-spin text-emerald-500" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-ink-400">Consultando os servidores…</span>
                  </div>
                )}

                {storage && storage.map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-ink-50 flex items-center gap-3">
                      <div className={classNames('w-9 h-9 rounded-xl flex items-center justify-center', s.isBackup ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>
                        {s.isBackup ? <HardDrive size={18} /> : <Cloud size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-ink-900">{s.label}</h4>
                        <p className="text-[11px] text-ink-500 font-medium truncate">
                          {s.ok ? `Orthanc v${s.version || '—'}${s.name ? ` · ${s.name}` : ''}` : 'Sem conexão'}
                        </p>
                      </div>
                      <span className={classNames('text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wider', s.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                        {s.ok ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {s.ok ? (
                      <div className="p-5 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <Metric icon={Database} label="Exames" value={fmtNum(s.countStudies)} tone="bg-emerald-50 text-emerald-600" />
                          <Metric icon={Users} label="Pacientes" value={fmtNum(s.countPatients)} tone="bg-blue-50 text-blue-600" />
                          <Metric icon={Image} label="Imagens" value={fmtNum(s.countInstances)} tone="bg-fuchsia-50 text-fuchsia-600" />
                        </div>
                        <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center shrink-0">
                            <HardDrive size={18} />
                          </div>
                          <div>
                            <span className="text-xl font-black text-ink-900 leading-none block">{fmtSize(s.diskMB)}</span>
                            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Espaço em disco usado</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col items-center text-center gap-3">
                        <AlertTriangle className="text-amber-500" size={26} />
                        <p className="text-[11px] text-ink-500 font-medium max-w-md leading-relaxed">{s.error}</p>
                        <button
                          onClick={refreshStorage}
                          className="h-8 px-4 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-700 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                        >
                          <RefreshCw size={11} /> Tentar novamente
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-start gap-1.5 text-[11px] text-ink-500 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2.5 leading-relaxed">
                  <Info size={13} className="shrink-0 mt-0.5 text-blue-500" />
                  <span>Os números vêm direto do Orthanc (<code>/statistics</code>). O "espaço em disco" é o total já armazenado na VM — o Orthanc não informa o espaço livre; acompanhe a capacidade do disco no painel do Google Cloud.</span>
                </div>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}

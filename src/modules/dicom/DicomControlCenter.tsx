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
  SlidersHorizontal, ChevronDown, Star, Upload, Printer
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
/** Matriz de diagnóstico: imagens, worklist e aparelhos, para principal e backup. */
type DiagResults = {
  primaryImages: CapResult;
  primaryWorklist: CapResult;
  primaryDevices: CapResult;
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
  const [selectedSection, setSelectedSection] = useState<'overview' | 'setup_vm' | 'app_config' | 'tailscale' | 'relay' | 'devices' | 'workflow' | 'backup' | 'troubleshoot' | 'concepts'>('overview');
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

  // Confere se os aparelhos cadastrados (Passo 3) estão de fato registrados
  // no `DicomModalities` do PACS que as settings apontam AGORA. Pega ativamente
  // a causa raiz mais sutil do incidente de 08/07/2026 (docs/pacs/
  // INCIDENTE_2026-07-08_TIMEOUT_MX7.md): `dicomTenantId`/URL do agente podem
  // "parecer" corretos (Imagens e Worklist testam OK) enquanto o relé físico
  // do usuário na verdade encaminha o aparelho pra um tenant diferente —
  // nesse caso, o aparelho nunca aparece no `/modalities` do tenant que o app
  // está de fato consultando, e é exatamente isso que este teste expõe.
  async function testDevices(): Promise<CapResult> {
    const devices = draft.dicomDevices || [];
    if (devices.length === 0) return { ok: true, msg: 'Nenhum aparelho cadastrado ainda (Passo 3)', skipped: true };
    const baseUrl = getActivePacsUrl(draft, false);
    const auth = getDicomAuthParams(draft, false);
    const proxyPath = getProxyEndpoint(draft, false);
    const target = `${baseUrl.replace(/\/$/, '')}/modalities?expand`;
    try {
      const res = await fetch(`${proxyPath}?url=${encodeURIComponent(target)}${auth}`);
      if (!res.ok) return { ok: false, msg: `HTTP ${res.status} — não foi possível consultar os aparelhos registrados` };
      const json = await res.json();
      const registered = new Set(Object.values(json || {}).map((m: any) => String(m?.AET || '').toUpperCase()));
      const missing = devices.filter((d) => !registered.has(d.aeTitle.toUpperCase()));
      if (missing.length === 0) return { ok: true, msg: `${devices.length} aparelho(s) registrado(s) neste PACS` };
      return {
        ok: false,
        msg: `${missing.map((d) => d.aeTitle).join(', ')} não registrado(s) aqui — Worklist vai falhar mesmo com Echo/Storage OK. Confira se dicomTenantId bate com o tenant que o relé físico alcança, ou clique "Reautorizar no PACS" no aparelho.`,
      };
    } catch (e: any) {
      return { ok: false, msg: e.message || 'Falha ao consultar aparelhos registrados' };
    }
  }

  async function handleTestPacsConnection() {
    setPacsTestState('testing');
    setDiag(null);
    const backupOn = !!draft.dicomBackupSyncEnabled && !!(draft.dicomBackupViewerUrl || draft.dicomBackupTailscalePublicUrl);
    const skipped: CapResult = { ok: false, msg: 'Backup desabilitado', skipped: true };
    try {
      setDiagStep('Testando servidor principal…');
      const [primaryImages, primaryWorklist, primaryDevices] = await Promise.all([testImages(false), testWorklist(false), testDevices()]);
      setDiagStep(backupOn ? 'Testando servidor de backup…' : '');
      const [backupImages, backupWorklist] = backupOn
        ? await Promise.all([testImages(true), testWorklist(true)])
        : [skipped, skipped];

      const results: DiagResults = { primaryImages, primaryWorklist, primaryDevices, backupImages, backupWorklist };
      setDiag(results);

      const primaryOk = primaryImages.ok && primaryWorklist.ok && primaryDevices.ok;
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
                  <p className="text-[10px] text-ink-500 leading-normal">Testa <strong>Imagens</strong> (REST do Orthanc), <strong>Worklist</strong> (agente → Python → pasta) e <strong>Aparelhos</strong> (registro no PACS ativo) separadamente, no principal e no backup.</p>

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
                      { title: 'Servidor Principal', dot: 'bg-emerald-500', images: diag.primaryImages, worklist: diag.primaryWorklist, devices: diag.primaryDevices, show: true },
                      { title: 'Servidor Backup', dot: 'bg-indigo-500', images: diag.backupImages, worklist: diag.backupWorklist, devices: null, show: backupConfigured },
                    ];
                    return (
                      <div className="space-y-3 pt-1 animate-fade-in">
                        {groups.filter(g => g.show).map(g => {
                          const groupOk = g.images.ok && g.worklist.ok && (!g.devices || g.devices.ok);
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
                                {g.devices && renderCap('Aparelhos registrados', Radio, g.devices)}
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[9px] text-ink-400 leading-normal px-0.5">
                          A Worklist é testada por <em>ping</em> (verifica agente, Python/pydicom e permissão de escrita na pasta) — nenhum arquivo é criado. Aparelhos é testado consultando o <code>DicomModalities</code> do PACS ativo — pega na hora se as settings apontam pra um tenant diferente do que o relé físico realmente alcança.
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
                    { group: '▶ Para você (cliente do PACS)', items: [
                      { id: 'overview', label: 'Visão geral', icon: BookOpen },
                      { id: 'relay', label: 'Conectar relé + ultrassom', icon: Radio },
                      { id: 'devices', label: 'Aparelhos por fabricante', icon: Monitor },
                      { id: 'workflow', label: 'No dia a dia (laudo)', icon: Image },
                    ]},
                    { group: 'Avançado (infraestrutura / operador)', items: [
                      { id: 'setup_vm', label: 'Montar a VM (nuvem)', icon: Cloud },
                      { id: 'app_config', label: 'Configurar no LAUD.US (manual)', icon: Server },
                      { id: 'tailscale', label: 'Administração da rede (Tailscale)', icon: Network },
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
                    <code className="block bg-black/40 p-1.5 rounded-lg text-[9px] text-emerald-300 break-all">docs/archive/PROJETO_PACS_NUVEM.md</code>
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
                  {selectedSection === 'overview' && (() => {
                    const inst = draft.pacsInstance;
                    const hasPacsReady = inst?.status === 'ready';
                    return (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Cloud size={16} className="text-emerald-600" /> Visão geral — servidor PACS na nuvem</h3>
                        <p className="text-[11px] text-ink-500 font-medium">O servidor principal é uma VM (Google Cloud). A clínica só faz um relé Tailscale. O local vira backup opcional.</p>
                      </div>

                      {hasPacsReady ? (
                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase tracking-wider"><CheckCircle2 size={13} /> Seu PACS já está pronto</div>
                          <p className="text-[11px] text-ink-700 leading-relaxed">
                            Plano <strong>{inst?.plan === 'dedicado' ? 'Dedicado' : inst?.plan === 'starter' ? 'Starter' : 'Pro'}</strong>
                            {inst?.provider === 'shared' ? ' (tenant isolado numa VM compartilhada)' : ' (VM própria)'} — tudo já provisionado e configurado. Você só precisa <strong>conectar o relé e o aparelho</strong>, ao lado. As seções em "Avançado" abaixo são só para quem administra a infraestrutura (não é o seu caso).
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase tracking-wider"><Sparkles size={13} /> O jeito fácil (self-service)</div>
                          <p className="text-[11px] text-ink-700 leading-relaxed">Na aba <strong>Servidores &amp; Conexão</strong>, o cartão <strong>"Criar meu PACS"</strong> provisiona e configura tudo sozinho — você só escolhe o plano. Depois é só conectar o relé e apontar o ultrassom (ao lado, em "Conectar relé + ultrassom"). O resto deste guia (seção "Avançado") explica os bastidores para quem administra a infraestrutura.</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-lg bg-white border border-ink-150">
                              <div className="text-[10px] font-black text-blue-700 uppercase">Compartilhado (Starter/Pro)</div>
                              <p className="text-[10px] text-ink-600 leading-relaxed">Seu cliente vira um "tenant" isolado numa VM compartilhada — barato e imediato.</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white border border-ink-150">
                              <div className="text-[10px] font-black text-emerald-700 uppercase">Dedicado</div>
                              <p className="text-[10px] text-ink-600 leading-relaxed">Uma VM própria por cliente, criada automaticamente (~3 min) — isolamento máximo.</p>
                            </div>
                          </div>
                        </div>
                      )}

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
                    );
                  })()}

                  {selectedSection === 'setup_vm' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Cloud size={16} className="text-emerald-600" /> Montar a VM (Google Cloud)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Um único comando configura tudo. Rode por SSH numa VM Debian/Ubuntu. Região sugerida: southamerica-east1.</p>
                      </div>

                      <Note tone="amber">
                        <strong>Isso é infraestrutura — só necessário se você administra a VM/tenant</strong> (ex: você opera o LAUD.US para outros clientes). Se você é cliente de um PACS gerenciado, sua VM já foi criada pelo "Criar meu PACS" — vá direto em <strong>"Conectar relé + ultrassom"</strong>.
                      </Note>

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

                      <Note tone="amber">Setup manual detalhado (avançado) e o plano <strong>Dedicado</strong> (VM própria por cliente, criada automaticamente pelo app) estão documentados em <code>docs/pacs/PACS_TENANT_SETUP.md</code> e <code>docs/roadmaps/PLANO_PACS_AUTOMACAO_SELF_SERVICE.md</code>.</Note>

                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2">
                        <ArrowRight size={14} /> VM pronta. Agora vá para <strong>"Configurar no LAUD.US (manual)"</strong>.
                      </div>
                    </div>
                  )}

                  {selectedSection === 'app_config' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Server size={16} className="text-emerald-600" /> Configurar no LAUD.US (manual)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Na aba <strong>Servidores &amp; Conexão</strong>, use o preset e preencha 2 campos.</p>
                      </div>

                      <Note tone="amber">
                        <strong>Só é necessário para instalações manuais</strong> (você mesmo montou uma VM/Orthanc). Quem usa "Criar meu PACS" tem tudo isso preenchido automaticamente — confira em "Servidores &amp; Conexão → Configuração avançada" que já está tudo certo, sem precisar mexer aqui.
                      </Note>

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

                      <Note tone="emerald">Pronto: worklist e imagens já passam pela VM. Falta só ligar o relé da clínica na tailnet e apontar o ultrassom — veja "Conectar relé + ultrassom".</Note>
                    </div>
                  )}

                  {selectedSection === 'tailscale' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Network size={16} className="text-emerald-600" /> Administração da rede (Tailscale)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Como a VM entra na tailnet, e como administrar contas/rotas/ACL — conteúdo de quem opera a infraestrutura.</p>
                      </div>

                      <Note tone="amber">
                        <strong>Se você é cliente de um PACS gerenciado, não precisa de nada aqui</strong> — vá direto em <strong>"Conectar relé + ultrassom"</strong>, onde já tem a chave de acesso pronta para o seu relé. O conteúdo abaixo é para quem administra a VM/tailnet.
                      </Note>

                      <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-2">
                        <div className="flex items-center gap-2 text-blue-800"><Info size={14} /><span className="text-[11px] font-black uppercase tracking-wider">Como pensar nisso</span></div>
                        <P>O Tailscale cria uma rede privada (uma "tailnet") entre dispositivos autorizados. Cada dispositivo vira um "nó" com um IP fixo tipo <code>100.x.y.z</code>, alcançável pelos outros nós como se estivessem na mesma rede local — mesmo estando em lugares diferentes do mundo. Aqui, 2 nós importam:</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li><strong>A VM</strong> — já entrou na tailnet sozinha, pelo script turnkey (passo 1).</li>
                          <li><strong>O relé da clínica</strong> — o roteador GL.iNet OU um computador — que você ainda precisa conectar.</li>
                        </ul>
                        <P>O <strong>ultrassom em si NÃO entra</strong> no Tailscale (a maioria dos aparelhos não suporta isso) — ele só fala com o relé pela rede local normal, como sempre fez. É o relé que faz a ponte até a VM.</P>
                      </div>

                      <Note tone="emerald">
                        Cada cliente do PACS gerenciado (self-service) recebe uma <strong>chave de autenticação</strong> própria no provisionamento — visível no card "Conectar meu ultrassom" dele. Isso é o que evita ter que dar sua conta Tailscale pra cada cliente (passo 1 abaixo é só pra você, o operador).
                      </Note>

                      <Step n={1} title="Sua própria conta Tailscale (para administrar a VM/tailnet)">
                        <P>Se ainda não tem: entre em <strong>tailscale.com</strong> → "Get Started" → crie a conta (dá pra usar login do Google/Microsoft/e-mail, é gratuito para uso pessoal/pequenas equipes). <strong>Use a MESMA conta</strong> em todos os dispositivos — VM, relé, e qualquer outro nó. Contas diferentes formam tailnets diferentes, que não se enxergam entre si.</P>
                      </Step>

                      <Step n={2} title="Conectar o relé — Opção A: roteador GL.iNet (recomendado)">
                        <P>Roteadores GL.iNet já trazem um cliente Tailscale embutido no firmware — não precisa instalar nada.</P>
                        <ul className="text-[11px] text-ink-700 space-y-1.5 leading-relaxed list-disc pl-4">
                          <li>Acesse o painel do roteador pelo navegador (geralmente <code>192.168.8.1</code>), com o login de admin.</li>
                          <li>Vá em <strong>Mais Configurações → VPN → Tailscale</strong> (alguns firmwares chamam de "Applications → Tailscale" — o caminho exato varia por modelo).</li>
                          <li>Clique em <strong>Ativar/Login</strong>. Se o firmware pedir uma <strong>Auth Key</strong>, cole a chave do card "Conectar meu ultrassom". Se só oferecer link/QR code (login interativo), use sua própria conta Tailscale (passo 1).</li>
                          <li>Depois de conectado, habilite o <strong>roteamento de sub-rede</strong> (nomes variam: "Subnet Router", "Advertise Routes", "Compartilhar rede local") e marque a faixa de IP da sua LAN (ex: <code>192.168.8.0/24</code>). É isso que deixa o ultrassom — que está nessa mesma rede local do roteador — alcançável pela VM através da tailnet.</li>
                        </ul>
                        <Note tone="amber">Não confunda com "Route all traffic" (isso faria TODO o tráfego da internet do roteador passar pela tailnet — não é o que você quer). O certo é só anunciar a própria LAN.</Note>
                      </Step>

                      <Step n={3} title="Conectar o relé — Opção B: computador (Windows/Mac/Linux)">
                        <P>Sem roteador com Tailscale? Um computador sempre ligado, na mesma rede do ultrassom, também funciona como relé.</P>
                        <p className="text-[10px] text-ink-500 font-bold">Instalar e logar com a chave do card "Conectar meu ultrassom" (sem precisar de conta):</p>
                        <Cmd id="ts-install-linux" text={`curl -fsSL https://tailscale.com/install.sh | sh\nsudo tailscale up --authkey=<CHAVE-DO-CARD>`} />
                        <p className="text-[10px] text-ink-500 leading-relaxed">Windows/Mac: baixe em <code>tailscale.com/download</code>, instale e, na hora de conectar, escolha "usar chave" e cole a mesma chave (ou faça login com sua própria conta, se for o caso do passo 1).</p>
                        <P>A partir daí, o PC pode agir de duas formas — escolha uma:</P>
                        <ul className="text-[11px] text-ink-700 space-y-1.5 leading-relaxed list-disc pl-4">
                          <li><strong>Encaminhamento simples (mais fácil de configurar):</strong> o PC só redireciona a porta DICOM para a VM. Não precisa mexer em rotas — veja os comandos <code>netsh</code>/<code>socat</code> em "Conectar relé + ultrassom" (Modo A2).</li>
                          <li><strong>Subnet router (mais robusto, igual ao GL.iNet):</strong> o PC anuncia a rede local inteira, e qualquer aparelho da LAN (não só o ultrassom) passa a alcançar a VM sem regra de porta:</li>
                        </ul>
                        <Cmd id="ts-advertise-routes" text="sudo tailscale up --advertise-routes=192.168.x.0/24" />
                        <Note>Troque <code>192.168.x.0/24</code> pela faixa real da sua rede local (confira no roteador ou nas configurações de rede do próprio PC).</Note>
                      </Step>

                      <Step n={4} title="Aprovar a rota anunciada (admin da tailnet — só quem opera a VM faz isso)">
                        <P>Rotas anunciadas por um relé (subnet router) normalmente exigem aprovação manual por segurança. Com <code>autoApprovers</code> configurado na ACL (recomendado — ver <code>PACS_PROVISION_SETUP.md</code> §2), a rota do <strong>relé do cliente</strong> (<code>tag:pacs-client</code>) é aprovada sozinha, sem você precisar entrar no admin console a cada cliente novo. Sem isso, aprove manualmente:</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li>Acesse <strong>login.tailscale.com/admin/machines</strong>.</li>
                          <li>Encontre o relé (o roteador GL.iNet ou o PC) na lista de dispositivos.</li>
                          <li>Clique nos <strong>"⋯"</strong> (três pontinhos) ao lado do nome dele → <strong>"Edit route settings"</strong>.</li>
                          <li>Marque a sub-rede anunciada (ex: <code>192.168.8.0/24</code>) como <strong>habilitada</strong>.</li>
                        </ul>
                        <Note tone="amber">Sem aprovação (manual ou automática), a rota fica "anunciada mas não aprovada" — nada flui, mesmo com tudo certo do lado do relé.</Note>
                      </Step>

                      <Step n={5} title="A VM também precisa ACEITAR a rota">
                        <P>Aprovar no admin da tailnet não é suficiente — a <strong>própria VM</strong> também precisa aceitar rotas anunciadas por outros nós. Sem isso, ela recebe a conexão do ultrassom mas não sabe o caminho de volta pra responder (o C-ECHO trava em "tempo esgotado", em vez de conectar ou rejeitar na hora).</P>
                        <Cmd id="ts-accept-routes-tab" text="sudo tailscale up --accept-routes" />
                        <Note tone="emerald">Já vem pronto se a VM foi montada com o script turnkey atual (<code>pacs-vm-setup.sh</code>). Só rode manualmente se a VM for de uma montagem antiga, ou se o diagnóstico indicar esse problema.</Note>
                      </Step>

                      <Step n={6} title="Confirmar que está tudo conectado">
                        <P>Na VM, rode:</P>
                        <Cmd id="ts-status" text="tailscale status" />
                        <P>O relé (GL.iNet ou PC) deve aparecer como <strong>"active"</strong> (não "offline"), e NÃO deve aparecer o aviso "peers are advertising routes but --accept-routes is false". A partir daqui, o card <strong>"Conectar meu ultrassom"</strong> no app já mostra o IP tailnet da VM automaticamente.</P>
                      </Step>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-white border border-ink-150 space-y-1">
                          <div className="text-[10px] font-black text-ink-700 uppercase">MagicDNS</div>
                          <p className="text-[10px] text-ink-600 leading-relaxed">Dá nomes amigáveis aos nós (ex: <code>orthanc-server</code>) em vez de só IPs numéricos. Ativa-se uma vez, na conta, em Admin console → DNS.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-ink-150 space-y-1">
                          <div className="text-[10px] font-black text-ink-700 uppercase">HTTPS Certificates + Funnel</div>
                          <p className="text-[10px] text-ink-600 leading-relaxed">Dão à VM um endereço público <code>https://…ts.net</code> — é assim que o navegador (sem Tailscale nenhum) alcança o Agente. Já vem ativado pelo turnkey.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2">
                        <ArrowRight size={14} /> Relé conectado à tailnet. Agora vá para <strong>"Conectar relé + ultrassom"</strong> para apontar o aparelho de vez.
                      </div>
                    </div>
                  )}

                  {selectedSection === 'relay' && (() => {
                    const port = draft.pacsInstance?.dicomPort || 4242;
                    const isSharedTenant = draft.pacsInstance?.provider === 'shared';
                    return (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Radio size={16} className="text-emerald-600" /> Conectar relé + ultrassom</h3>
                        <p className="text-[11px] text-ink-500 font-medium">É só isso que você precisa fazer. O relé faz o ultrassom (que não roda Tailscale) alcançar seu PACS. Escolha o seu caso.</p>
                      </div>

                      {isSharedTenant && (
                        <Note tone="amber">
                          Seu PACS é um <strong>tenant numa VM compartilhada</strong> — a porta DICOM NÃO é a 4242 padrão, é exclusiva do seu tenant: <strong className="font-mono">{port}</strong>. Use exatamente esse número em todo o relé/aparelho (o card "Conectar meu ultrassom" já mostra isso pronto). Apontar para 4242 é a causa mais comum de "aparelho não encontra o servidor".
                        </Note>
                      )}

                      <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-800"><Wifi size={14} /><span className="text-[11px] font-black uppercase tracking-wider">Modo A1 — Roteador GL.iNet (recomendado)</span></div>
                        <P>O GL.iNet já roda Tailscale e roteia a LAN para a tailnet. Sempre ligado, zero software extra.</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li>Cole a <strong>chave de autenticação</strong> do card "Conectar meu ultrassom" no login do Tailscale do roteador, e ligue o roteamento de sub-rede (ver "Administração da rede" para o passo a passo detalhado).</li>
                          <li>No ultrassom, aponte Worklist e Storage para o <strong>IP tailnet da VM (100.x):{port}</strong>, AE <code>ORTHANC</code>.</li>
                        </ul>
                        <Note>
                          Sua conexão é aprovada automaticamente — não precisa entrar em nenhum admin console. Se o C-ECHO travar em "tempo esgotado" (não rejeitando na hora), fale com o suporte: pode ser a rota ainda não aprovada do lado da VM.
                        </Note>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2">
                        <div className="flex items-center gap-2 text-ink-800"><Cpu size={14} /><span className="text-[11px] font-black uppercase tracking-wider">Modo A2 — PC do dia a dia (sem roteador com Tailscale)</span></div>
                        <P>Primeiro instale o Tailscale no PC e conecte com a chave do card "Conectar meu ultrassom" (comando completo em "Administração da rede", passo "Conectar o relé — Opção B"). Depois, como o PC não é o gateway da rede, encaminhamos a porta {port} dele para a VM. No ultrassom, aponte para o <strong>IP LAN do PC:{port}</strong>.</P>
                        <p className="text-[10px] text-ink-500 font-bold">Windows (nativo):</p>
                        <Cmd id="relay-netsh" text={`netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=<IP-TAILNET-DA-VM>`} />
                        <p className="text-[10px] text-ink-500 font-bold">macOS/Linux:</p>
                        <Cmd id="relay-socat" text={`socat TCP-LISTEN:${port},fork,reuseaddr TCP:<IP-TAILNET-DA-VM>:${port}`} />
                        <Note tone="amber">Neste modo o ultrassom só alcança a VM com o PC ligado e no Tailscale.</Note>
                      </div>

                      <Step n="✓" title="Validar (nos dois modos)">
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li><strong>C-ECHO</strong> no ultrassom → sucesso (isso sempre funciona, mesmo sem cadastrar o aparelho).</li>
                          <li>Criar exame no LAUD.US → a worklist aparece no aparelho.</li>
                          <li>Fazer o exame → as imagens sobem à VM e aparecem no laudo.</li>
                        </ul>
                      </Step>

                      <Note tone="amber">
                        <strong>C-ECHO funciona mas a Worklist dá erro no aparelho ("query error")?</strong> Diferente do Echo, a consulta de Worklist exige o aparelho <strong>autorizado</strong> no Orthanc (AE Title + IP). Cadastre-o no card <strong>"Conectar meu ultrassom" → Passo 3 — meus aparelhos</strong> — o app autoriza automaticamente, sem precisar de SSH.
                      </Note>
                    </div>
                    );
                  })()}

                  {selectedSection === 'devices' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Monitor size={16} className="text-emerald-600" /> Aparelhos por fabricante</h3>
                        <p className="text-[11px] text-ink-500 font-medium">A configuração DICOM é a mesma para qualquer marca — só muda onde os campos ficam no menu do aparelho.</p>
                      </div>

                      <Note tone="emerald">
                        Todo aparelho DICOM pede os <strong>mesmos 4 dados</strong>, só com nomes diferentes: quem ele é (<strong>AE Title local/próprio</strong>), quem é o servidor (<strong>AE Title remoto</strong> = <code>ORTHANC</code>), onde está o servidor (<strong>IP + Porta</strong> do relé) — e depois um teste de conexão (<strong>C-ECHO / Verify</strong>). O que muda entre marcas é só o nome da tela; o raciocínio é sempre o mesmo.
                      </Note>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2.5">
                        <div className="flex items-center gap-2 text-ink-800"><CheckCircle2 size={14} className="text-emerald-600" /><span className="text-[11px] font-black uppercase tracking-wider">Mindray MX7 — referência (já validado nesta clínica)</span></div>
                        <P>Configuração testada e funcionando de ponta a ponta. Menu típico: <strong>Setup → Network → DICOM</strong> (o caminho exato varia conforme a versão do software).</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li><strong>Local AE Title:</strong> o valor cadastrado no Passo 3 (card "Conectar meu ultrassom") para este aparelho.</li>
                          <li><strong>Server/Remote AE Title:</strong> <code>ORTHANC</code> (campo "AE Title do PACS", no Passo 2).</li>
                          <li><strong>Server IP + Port:</strong> IP do relé (GL.iNet/PC) e a porta DICOM do seu tenant.</li>
                          <li>Ative <strong>Worklist</strong> (Modality Worklist/MWL) e <strong>Storage (Send)</strong> — em alguns modelos Mindray ficam em abas separadas dentro do mesmo menu DICOM.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded-2xl bg-blue-50/30 border border-blue-100 space-y-2.5">
                        <div className="flex items-center gap-2 text-blue-800"><Monitor size={14} /><span className="text-[11px] font-black uppercase tracking-wider">Samsung (HS30, HM70 EVO)</span></div>
                        <P>A tela de rede DICOM costuma ficar em <strong>Setup → Connectivity → DICOM</strong> (ou <strong>System → Network → DICOM Setup</strong>, dependendo da versão).</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li>Cadastre primeiro o <strong>Local/My AE Title</strong> — o mesmo valor do Passo 3.</li>
                          <li>Depois adicione o servidor em <strong>Remote/Server AE Title</strong> (às vezes um cadastro separado, chamado "Query/Retrieve" ou "Worklist Server"), com IP, Porta e o AE Title do PACS.</li>
                          <li>A Samsung costuma exigir <strong>Verify (C-ECHO)</strong> antes de liberar o servidor cadastrado — rode-o logo após salvar.</li>
                          <li>Worklist (MWL) e envio de imagens (Storage) às vezes são cadastros separados nesses aparelhos — confirme os dois.</li>
                        </ul>
                        <Note tone="blue">Os nomes exatos de tela variam entre HS30, HM70 EVO e versões de software — a lógica (Local AE, Remote AE, IP, Porta, Verify) é sempre a mesma. Confirme o texto exato no seu aparelho antes de cadastrar.</Note>
                      </div>

                      <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100 space-y-2.5">
                        <div className="flex items-center gap-2 text-indigo-800"><Monitor size={14} /><span className="text-[11px] font-black uppercase tracking-wider">GE (Voluson, Versana)</span></div>
                        <P>Configuração DICOM normalmente em <strong>Utility → Connectivity → Service/DICOM Setup</strong>, com sub-telas separadas para "Local", "Remote" (servidores) e "Services" (quais funções cada servidor oferece).</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li><strong>Local:</strong> AE Title do próprio aparelho — o do Passo 3.</li>
                          <li><strong>Remote (novo servidor):</strong> AE Title <code>ORTHANC</code>, IP do relé e a porta do seu tenant.</li>
                          <li><strong>Services:</strong> marque <strong>Storage</strong> e <strong>Worklist</strong> para esse servidor remoto — na GE é comum precisar habilitar cada um explicitamente, não vem tudo junto.</li>
                          <li>Use o botão <strong>Verify</strong> da tela Remote para confirmar o C-ECHO antes de agendar o primeiro exame.</li>
                        </ul>
                        <Note tone="blue">Voluson e Versana têm interfaces parecidas mas não idênticas entre gerações — confirme os nomes exatos de tela na sua unidade antes de cadastrar.</Note>
                      </div>

                      <Note tone="amber">
                        <strong>Pontos que derrubam qualquer marca:</strong> AE Title tem até <strong>16 caracteres</strong>, sem espaços (padrão DICOM) — o LAUD.US já força maiúsculas ao cadastrar. Se o Worklist "não aparecer" mas o Storage funcionar (ou vice-versa), é quase sempre porque só um dos dois serviços foi marcado no aparelho. E o <strong>AE Title digitado no menu do aparelho precisa ser idêntico, caractere por caractere</strong>, ao cadastrado no Passo 3 do card "Conectar meu ultrassom" — é isso que autoriza no PACS.
                      </Note>

                      <Note tone="emerald">
                        Tem mais de um aparelho (ou mais de uma clínica)? Veja <strong>"No dia a dia"</strong>, ao lado, para aparelho principal por clínica, ver exames anteriores no laudo e importar estudo feito fora do sistema.
                      </Note>
                    </div>
                  )}

                  {selectedSection === 'workflow' && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="pb-3 border-b border-ink-100">
                        <h3 className="text-sm font-black text-ink-900 uppercase tracking-wider flex items-center gap-2"><Image size={16} className="text-emerald-600" /> No dia a dia (laudando um exame)</h3>
                        <p className="text-[11px] text-ink-500 font-medium">Depois que o PACS está configurado, é isso que você usa todo dia dentro do laudo.</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2">
                        <div className="flex items-center gap-2 text-ink-800"><Star size={14} className="text-amber-500" /><span className="text-[11px] font-black uppercase tracking-wider">Aparelho principal (por clínica)</span></div>
                        <P>No card "Conectar meu ultrassom" → Passo 3, cada aparelho pode ser associado a uma clínica específica (se você tem mais de uma). Clique na <strong>estrela</strong> de um aparelho pra marcá-lo como principal — ele vem pré-selecionado ao criar exame ou confirmar agendamento <strong>daquela clínica</strong>, sem precisar escolher toda vez. Um aparelho sem clínica marcada fica <strong>compartilhado</strong> entre todas.</P>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2">
                        <div className="flex items-center gap-2 text-ink-800"><SlidersHorizontal size={14} className="text-brand-500" /><span className="text-[11px] font-black uppercase tracking-wider">Ver o exame atual e os anteriores do paciente</span></div>
                        <P>Dentro do laudo, o painel lateral do DICOM tem um botão <strong>"Exames (N)"</strong> sempre que há mais de um estudo localizado para o paciente — inclui o exame que você está laudando e os estudos anteriores dele no PACS, ordenados do mais recente pro mais antigo. O que é "este exame" vem marcado; clique em qualquer outro pra trocar a visualização e comparar rapidamente.</P>
                        <Note>O botão que abre o painel lateral fica sempre clicável, mesmo quando o exame ainda não tem nenhuma imagem — é por ali que você acessa o "Importar" (abaixo) pra exames feitos fora do sistema.</Note>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2">
                        <div className="flex items-center gap-2 text-ink-800"><Upload size={14} className="text-violet-500" /><span className="text-[11px] font-black uppercase tracking-wider">Importar estudo externo (sem aparelho conectado)</span></div>
                        <P>Paciente fez o exame em outro lugar e trouxe os arquivos DICOM (pendrive/CD)? No painel lateral do DICOM, clique em <strong>"Importar"</strong>, selecione todos os arquivos <code>.dcm</code> do estudo de uma vez e envie. O sistema lê os dados do paciente gravados no arquivo pra você <strong>conferir antes de vincular</strong> — o PACS não faz essa checagem sozinho — e depois o estudo aparece no laudo como qualquer outro.</P>
                        <ul className="text-[11px] text-ink-700 space-y-1 leading-relaxed list-disc pl-4">
                          <li>Aceita vários arquivos de uma vez — um estudo real tem um <code>.dcm</code> por imagem/frame.</li>
                          <li>Arquivo grande tem barra de progresso e tentativa automática de novo em caso de timeout; falhando de vez, dá pra clicar em "tentar novamente" só naquele arquivo.</li>
                          <li>Se o <strong>Agente Local</strong> não estiver configurado com URL HTTPS, arquivos grandes podem esbarrar no limite de ~4,5MB do servidor da Vercel — configure-o (aba Servidores) pra enviar direto, sem esse limite.</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-ink-150 space-y-2">
                        <div className="flex items-center gap-2 text-ink-800"><Printer size={14} className="text-ink-600" /><span className="text-[11px] font-black uppercase tracking-wider">Gerar o PDF das imagens</span></div>
                        <P>No painel lateral, botão <strong>"PDF"</strong> abre a seleção de imagens e o layout de impressão (grade configurável). O download em si é o <strong>imprimir do navegador</strong> (Ctrl/Cmd+P → Salvar como PDF) — não um gerador de PDF separado.</P>
                        <Note tone="amber">Se alguma imagem específica falhar ao carregar (rede instável, arquivo pesado), ela é <strong>pulada automaticamente</strong> e um aviso mostra quantas — o PDF sai normalmente com as demais, em vez de travar tudo por causa de uma imagem só.</Note>
                      </div>
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
                              <td className="px-3 py-3">Relé não alcança a VM, porta errada, ou AE Title divergente.</td>
                              <td className="px-3 py-3">Verifique o relé (IP tailnet:porta ou portproxy). <strong>Numa VM compartilhada, a porta NÃO é 4242</strong> — é a exclusiva do seu tenant (card "Conectar meu ultrassom" ou <code>/opt/pacs-tenant.sh list</code> na VM). AE do aparelho deve bater com o servidor. Faça um C-ECHO.</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">C-ECHO trava em "tempo esgotado" (não rejeita, só não responde)</td>
                              <td className="px-3 py-3">A VM não aceita a rota de sub-rede anunciada pelo relé (GL.iNet/PC) — o pacote chega, mas a resposta não sabe o caminho de volta à LAN do aparelho.</td>
                              <td className="px-3 py-3">Na VM: <code>tailscale status</code> — se aparecer "peers are advertising routes but --accept-routes is false", rode <code>sudo tailscale up --accept-routes</code>.</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">C-ECHO dá sucesso, mas Worklist responde "query error"</td>
                              <td className="px-3 py-3">O Orthanc libera Echo sempre, mas exige o aparelho <strong>registrado</strong> (DicomModalities) para consultas de Worklist.</td>
                              <td className="px-3 py-3">Cadastre o aparelho (AE Title + IP) no card "Conectar meu ultrassom" — o app autoriza automaticamente no Orthanc, sem SSH. Use o botão de reautorizar se o aparelho já estava cadastrado antes dessa função existir.</td>
                            </tr>
                            <tr>
                              <td className="px-3 py-3 font-bold text-ink-800">Ultrassom não envia imagens</td>
                              <td className="px-3 py-3">Porta DICOM do tenant fechada no caminho relé→VM.</td>
                              <td className="px-3 py-3">Confirme <code>0.0.0.0:&lt;porta-do-tenant&gt;</code> publicado no container Docker e o relé apontando para o IP tailnet da VM nessa mesma porta.</td>
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
                          ['DicomModalities', 'Lista de aparelhos autorizados no Orthanc. C-ECHO funciona sem estar nela; consulta de Worklist não. O card "Conectar meu ultrassom" cadastra automaticamente.'],
                          ['Rotas de sub-rede', 'Como o Tailscale deixa a VM enxergar a LAN da clínica através do relé (GL.iNet/PC). Precisam ser aprovadas (admin da tailnet) E aceitas (--accept-routes na VM).'],
                          ['Auth key (chave de autenticação)', 'Senha de uso único/reutilizável que autoriza um dispositivo a entrar na tailnet sem login interativo. O card "Conectar meu ultrassom" já traz uma pronta para o relé do cliente — sem precisar da conta do operador da VM.'],
                          ['tag:pacs-client', 'Identidade do relé do cliente na tailnet. Uma regra de ACL restringe quem tem essa tag a só alcançar a porta DICOM das VMs — não enxerga outros clientes nem outros dispositivos do operador.'],
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

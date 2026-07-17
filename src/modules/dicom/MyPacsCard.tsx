import { useState, useEffect } from 'react';
import { useApp } from '../../store/app';
import { useConfirm } from '../../hooks/useConfirm';
import { getIdToken } from '../../lib/authToken';
import { classNames } from '../../utils/format';
import type { PacsInstance } from '../../types';
import { getActivePacsUrl, getProxyEndpoint, getDicomAuthParams } from '../../store/db';
import {
  Cloud, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Trash2,
  Server, HardDrive, MapPin, Sparkles, ShieldCheck, FolderOpen
} from 'lucide-react';
import { planPriceBrl } from '../../../api/_pricing';

// Endpoint real de provisionamento (GCP). Quando ausente, o card opera em
// modo MOCK (simula a criação da VM) — permite testar toda a experiência
// self-service sem nuvem configurada.
const PROVISION_ENDPOINT = (import.meta as any).env?.VITE_PACS_PROVISION_ENDPOINT || '';

type Plan = 'starter' | 'pro' | 'dedicado';
type PacsInterval = 'month' | 'semester' | 'year';
type PacsPlan = { label: string; price: number; prices?: { month: number; semester: number; year: number }; interval: PacsInterval; disk: number; model: string; badge?: string; active?: boolean };
type PacsPlans = Record<Plan, PacsPlan>;

// Defaults (retrocompat) — o admin sobrepõe em global_config/pacs_plans.
const DEFAULT_PLANS: PacsPlans = {
  starter:  { label: 'Starter',  price: 99,  prices: { month: 99,  semester: 534,  year: 950  }, interval: 'month', disk: 100, model: 'Compartilhado isolado' },
  pro:      { label: 'Pro',      price: 149, prices: { month: 149, semester: 804,  year: 1430 }, interval: 'month', disk: 300, model: 'Compartilhado isolado', badge: 'Popular' },
  dedicado: { label: 'Dedicado', price: 249, prices: { month: 249, semester: 1344, year: 2390 }, interval: 'month', disk: 300, model: 'VM exclusiva' },
};

const intervalShort = (i?: string) => (i === 'year' ? 'ano' : i === 'semester' ? 'sem' : 'mês');
const fmtBrl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  (globalThis.crypto || (window as any).crypto).getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Aguarda o Agente da VM responder (GET {agentUrl}/). Sem imagem dourada, o
// boot (apt + docker + pull do Orthanc) leva ~6 min; com imagem dourada, ~1 min.
async function pollAgentHealth(agentUrl: string, timeoutMs = 600000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const url = `${agentUrl.replace(/\/$/, '')}/`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch { /* DNS/Funnel ainda subindo — continua tentando */ }
    await new Promise((r) => setTimeout(r, 6000));
  }
  return false;
}

export function MyPacsCard({ onOpenExams }: { onOpenExams?: () => void }) {
  const { settings, updateSettings, showToast, setView } = useApp();
  const confirm = useConfirm();
  const inst: PacsInstance = settings.pacsInstance || { status: 'none' };
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>((settings.pacsSelectedPlan as Plan) || 'pro');
  const [pacsInterval, setPacsInterval] = useState<PacsInterval>('month');

  // Escolha do tier fica salva em settings.pacsSelectedPlan e sincroniza com o
  // seletor do Centro de Assinatura (mesma fonte de verdade).
  useEffect(() => {
    if (settings.pacsSelectedPlan && settings.pacsSelectedPlan !== selectedPlan) {
      setSelectedPlan(settings.pacsSelectedPlan as Plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pacsSelectedPlan]);

  const choosePlan = (p: Plan) => {
    setSelectedPlan(p);
    if (settings.pacsSelectedPlan !== p) updateSettings({ pacsSelectedPlan: p }).catch(() => {});
  };

  // Planos de PACS gerenciados no Admin → Financeiro (global_config/pacs_plans);
  // fallback para os defaults se o admin ainda não publicou.
  const [plans, setPlans] = useState<PacsPlans>(DEFAULT_PLANS);
  useEffect(() => {
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('../../lib/firebase');
        const snap = await getDoc(doc(firestore, 'global_config', 'pacs_plans'));
        if (snap.exists()) {
          const d = snap.data() as Partial<PacsPlans>;
          setPlans({
            starter: { ...DEFAULT_PLANS.starter, ...(d.starter || {}) },
            pro: { ...DEFAULT_PLANS.pro, ...(d.pro || {}) },
            dedicado: { ...DEFAULT_PLANS.dedicado, ...(d.dedicado || {}) },
          });
        }
      } catch { /* mantém defaults */ }
    })();
  }, []);

  // Uso de disco REAL (não o campo salvo no provisionamento, que fica parado em
  // 0) — consulta ao vivo o /statistics do Orthanc pelo mesmo proxy das imagens.
  const [liveDiskMB, setLiveDiskMB] = useState<number | null>(null);
  const [liveVersion, setLiveVersion] = useState<string | null>(null);
  useEffect(() => {
    if (inst.status !== 'ready') return;
    let cancelled = false;
    const baseUrl = getActivePacsUrl(settings, false);
    const auth = getDicomAuthParams(settings, false);
    const proxyPath = getProxyEndpoint(settings, false);
    const base = baseUrl.replace(/\/$/, '');
    Promise.all([
      fetch(`${proxyPath}?url=${encodeURIComponent(`${base}/statistics`)}${auth}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${proxyPath}?url=${encodeURIComponent(`${base}/system`)}${auth}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([stats, sys]) => {
      if (cancelled) return;
      if (stats?.TotalDiskSizeMB !== undefined) setLiveDiskMB(parseInt(stats.TotalDiskSizeMB, 10) || 0);
      if (sys?.Version) setLiveVersion(sys.Version);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst.status, settings.dicomLocalAgentUrl, settings.dicomTenantId]);

  async function provision(plan: Plan, opts?: { reprovision?: boolean }) {
    if (busy) return;
    setBusy(true);
    const region = 'southamerica-east1';
    // Starter/Pro → tenant na VM COMPARTILHADA; Dedicado → VM própria.
    const shared = plan !== 'dedicado';
    // O endpoint serverless decide o caminho pelo plano: Starter/Pro → tenant na
    // VM compartilhada; Dedicado → VM própria (GCP). Sem endpoint → mock local.
    const useReal = !!PROVISION_ENDPOINT;
    const providerVal: 'mock' | 'gcp' | 'shared' = shared ? 'shared' : (useReal ? 'gcp' : 'mock');
    try {
      await updateSettings({
        pacsInstance: { status: 'provisioning', provider: providerVal, plan, region, createdAt: Date.now(), updatedAt: Date.now() }
      });

      let result: Partial<PacsInstance> & { agentSecret?: string; tenantId?: string };
      if (useReal) {
        // Modo real — a função serverless cria a VM no GCP e devolve os dados.
        const token = await getIdToken();
        const res = await fetch(PROVISION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          // reprovision: o servidor bloqueia criar uma 2ª instância real na
          // mesma conta, a menos que o pedido seja explicitamente de
          // reprovisionamento (botões "Reprovisionar"/"Tentar novamente").
          body: JSON.stringify({ plan, region, token, reprovision: !!opts?.reprovision })
        });
        const data = await res.json();
        if (!res.ok || !data.agentUrl) {
          throw new Error(data.error || 'Falha no provisionamento.');
        }
        result = data;
        if (data.provider === 'gcp') {
          const up = await pollAgentHealth(data.agentUrl);
          if (!up) throw new Error('A VM foi criada, mas o Agente ainda não respondeu. Use "Tentar novamente" em alguns minutos.');
        }
      } else {
        // Modo MOCK — simula a criação (tenant compartilhado ou VM dedicada).
        await new Promise((r) => setTimeout(r, 2600));
        const id = randomHex(4);
        const relayAuthKey = `tskey-auth-demo${randomHex(8)}`;
        result = shared
          ? { provider: 'shared', instanceName: `tenant-${id}`, agentUrl: 'https://orthanc-server.tail861dda.ts.net', agentSecret: randomHex(24), tenantId: `t-${id}`, orthancVersion: '1.12.4', diskGb: plans[plan].disk, diskUsedGb: 0, relayAuthKey, relayTag: 'tag:pacs-client' }
          : { provider: 'mock', instanceName: `pacs-${id}`, agentUrl: `https://pacs-${id}.tailscale-demo.ts.net`, agentSecret: randomHex(24), orthancVersion: '1.12.4', diskGb: plans[plan].disk, diskUsedGb: 0, relayAuthKey, relayTag: 'tag:pacs-client' };
      }

      // Autoconfigura as settings DICOM (o usuário não digita nada).
      await updateSettings({
        dicomSyncEnabled: true,
        dicomViewerUrl: 'http://localhost:8042',
        dicomOrthancAETitle: 'ORTHANC',
        dicomWorklistFolder: '/opt/orthanc-data/worklists',
        dicomLocalAgentUrl: result.agentUrl,
        dicomTenantId: result.tenantId || '',
        ...(result.agentSecret ? { dicomAgentSecret: result.agentSecret } : {}),
        pacsInstance: {
          status: 'ready',
          provider: (result.provider as any) || providerVal,
          plan,
          region,
          instanceName: result.instanceName,
          tenantId: result.tenantId,
          agentUrl: result.agentUrl,
          dicomPort: result.dicomPort,
          relayAuthKey: result.relayAuthKey,
          relayTag: result.relayTag,
          orthancVersion: result.orthancVersion,
          diskGb: result.diskGb ?? plans[plan].disk,
          diskUsedGb: result.diskUsedGb ?? 0,
          createdAt: inst.createdAt || Date.now(),
          updatedAt: Date.now(),
          lastHealthAt: Date.now(),
        }
      });
      showToast(shared ? 'Seu PACS (compartilhado) está pronto! 🎉' : 'Seu PACS na nuvem está pronto! 🎉', 'success');
    } catch (err: any) {
      await updateSettings({
        pacsInstance: { ...inst, status: 'error', error: err.message || 'Erro ao provisionar', updatedAt: Date.now() }
      });
      showToast('Falha ao provisionar o PACS: ' + (err.message || ''), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deprovision() {
    if (busy) return;
    const ok = await confirm({
      title: 'Remover PACS na nuvem',
      message: 'As configurações do agente serão limpas e, no modo real, a VM/tenant é destruída de vez — mantenha um backup antes.',
      variant: 'danger',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    setBusy(true);
    try {
      // Destrói de fato a VM/tenant na nuvem ANTES de limpar o Firestore — sem
      // isso, a infraestrutura ficava órfã (rodando e cobrando) mesmo depois de
      // o usuário "remover" o PACS pelo app. Sem PROVISION_ENDPOINT configurado
      // (ambiente 100% mock), não há nada real para destruir.
      try {
        if (PROVISION_ENDPOINT && inst.provider && inst.provider !== 'mock' && inst.instanceName) {
          const idToken = await getIdToken();
          const res = await fetch(PROVISION_ENDPOINT, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
            body: JSON.stringify({ provider: inst.provider, instanceName: inst.instanceName, tenantId: inst.tenantId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Falha ao destruir a infraestrutura na nuvem.');
        }
      } catch (err: any) {
        showToast(err.message || 'Não foi possível destruir a infraestrutura na nuvem — as credenciais NÃO foram limpas, tente novamente.', 'error');
        setBusy(false);
        return;
      }

      await updateSettings({
        dicomLocalAgentUrl: '',
        dicomAgentSecret: '',
        dicomTenantId: '',
        pacsInstance: { status: 'none', updatedAt: Date.now() }
      });
      showToast('PACS na nuvem removido.', 'success');
    } finally {
      setBusy(false);
    }
  }

  const isMock = !PROVISION_ENDPOINT;

  // ── Estado: PROVISIONANDO ──
  if (inst.status === 'provisioning') {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-4">
        <Header isMock={isMock} />
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <Loader2 size={20} className="text-emerald-600 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-black text-emerald-800">Criando seu PACS na nuvem…</p>
            <p className="text-[11px] text-ink-500">Provisionando servidor, configurando Orthanc e conectando com segurança. Pode levar alguns minutos (até ~7 min na primeira vez). Mantenha esta aba aberta.</p>
          </div>
        </div>
        <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse" style={{ width: '66%' }} />
        </div>
      </div>
    );
  }

  // ── Estado: SUSPENSO (assinatura cancelada/expirada — período de graça) ──
  if (inst.status === 'suspended') {
    const daysLeft = inst.scheduledDeletionAt
      ? Math.max(0, Math.ceil((inst.scheduledDeletionAt - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;
    return (
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4">
        <Header isMock={isMock} />
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-100">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-800">PACS suspenso — assinatura inativa</p>
            <p className="text-[11px] text-ink-500 mt-1">
              {daysLeft !== null
                ? `Sua VM/tenant será destruída em ${daysLeft} dia${daysLeft === 1 ? '' : 's'} se a assinatura não for reativada. Depois disso, os dados armazenados no PACS não podem ser recuperados.`
                : 'Sua VM/tenant será destruída em breve se a assinatura não for reativada. Depois disso, os dados armazenados no PACS não podem ser recuperados.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setView({ name: 'settings', activeTab: 'assinatura' })}
          className="w-full h-11 bg-brand-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-brand-700 transition-all"
        >
          Reativar assinatura agora
        </button>
      </div>
    );
  }

  // ── Estado: PRONTO ──
  if (inst.status === 'ready') {
    const diskGb = inst.diskGb ?? plans[(inst.plan as Plan) || 'pro'].disk;
    const usedGb = liveDiskMB !== null ? liveDiskMB / 1024 : null;
    const usedPct = usedGb !== null && diskGb ? Math.min(100, Math.round((usedGb / diskGb) * 100)) : null;
    const version = liveVersion || inst.orthancVersion;
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-4">
        <Header isMock={isMock} />
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-black text-emerald-800">PACS operacional</p>
          <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
            {plans[(inst.plan as Plan) || 'pro']?.label || inst.plan}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <Info icon={MapPin} label="Região" value={inst.region || '—'} />
          <Info icon={Server} label="Orthanc" value={version ? `v${version}` : '—'} />
          <Info icon={ShieldCheck} label="Conexão" value="Segura (Funnel)" />
          <div className="p-2.5 rounded-lg bg-ink-50 border border-ink-100 col-span-2">
            <div className="flex items-center justify-between text-[9px] font-black text-ink-400 uppercase tracking-wider">
              <span className="flex items-center gap-1"><HardDrive size={10} />Armazenamento</span>
              <span>{usedGb !== null ? `${usedGb.toFixed(2)} / ${diskGb} GB` : `— / ${diskGb} GB`}</span>
            </div>
            <div className="h-1.5 mt-1.5 w-full bg-ink-200 rounded-full overflow-hidden">
              <div
                className={classNames('h-full rounded-full', usedPct !== null && usedPct >= 90 ? 'bg-rose-500' : 'bg-emerald-500')}
                style={{ width: `${usedPct ?? 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenExams && (
            <button
              onClick={onOpenExams}
              className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center gap-1.5"
            >
              <FolderOpen size={12} /> Ver meus exames
            </button>
          )}
          <button
            onClick={async () => {
              // Reprovisionar cria um tenant/VM NOVO (nunca repara o atual) —
              // sem aviso, isso abandonaria silenciosamente os exames já
              // migrados no tenant em uso. Confirmar antes é obrigatório aqui.
              const ok = await confirm({
                title: 'Reprovisionar PACS',
                message: 'Isso cria um PACS NOVO (novo tenant/VM) — não repara o atual. Os exames já armazenados no PACS de agora ficarão inacessíveis por aqui (continuam na VM, recuperáveis por suporte). Só use se o PACS atual estiver com erro irrecuperável.',
                variant: 'danger',
                confirmLabel: 'Reprovisionar',
              });
              if (!ok) return;
              provision((inst.plan as Plan) || 'pro', { reprovision: true });
            }}
            disabled={busy}
            className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-ink-600 bg-ink-100 border border-ink-200 hover:bg-ink-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Reprovisionar
          </button>
          <button
            onClick={deprovision}
            disabled={busy}
            className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={12} /> Remover
          </button>
        </div>
      </div>
    );
  }

  // ── Estado: ERRO ──
  if (inst.status === 'error') {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-5 space-y-3">
        <Header isMock={isMock} />
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/60 border border-rose-100">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-rose-800">Falha no provisionamento</p>
            <p className="text-[11px] text-ink-600">{inst.error || 'Erro desconhecido.'}</p>
          </div>
        </div>
        <button
          // reprovision: o provisionamento anterior pode ter chegado a criar a
          // instância (registro gravado) e falhado só no polling — sem a flag,
          // o retry bateria na trava de instância única (409).
          onClick={() => provision((inst.plan as Plan) || selectedPlan, { reprovision: true })}
          disabled={busy}
          className="h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest bg-ink-900 hover:bg-ink-800 text-white transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Tentar novamente
        </button>
      </div>
    );
  }

  // ── Estado: NENHUM (escolher plano e criar) ──
  return (
    <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-5 space-y-4">
      <Header isMock={isMock} />
      <p className="text-xs text-ink-600 leading-relaxed">
        Crie seu <strong>PACS na nuvem</strong> em um clique. Nós provisionamos e configuramos tudo — você só precisa depois <strong>apontar o ultrassom</strong> (assistente) e, se quiser, ligar o backup local.
      </p>
      {/* Seletor de intervalo — cada plano cobre os 3 (mensal/semestral/anual) */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 bg-ink-100 p-1 rounded-xl border border-ink-200">
          {([
            { iv: 'month' as const,    label: 'Mensal',    hint: '' },
            { iv: 'semester' as const, label: 'Semestral', hint: 'economize' },
            { iv: 'year' as const,     label: 'Anual',     hint: 'melhor preço' },
          ]).map(o => (
            <button
              key={o.iv}
              onClick={() => setPacsInterval(o.iv)}
              className={classNames(
                'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5',
                pacsInterval === o.iv ? 'bg-emerald-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800'
              )}
            >
              {o.label}
              {o.hint && <span className={classNames('text-[8px] font-bold normal-case', pacsInterval === o.iv ? 'text-white/80' : 'text-emerald-600')}>{o.hint}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {(Object.keys(plans) as Plan[]).filter((p) => plans[p].active !== false).map((p) => {
          const plan = plans[p];
          const active = selectedPlan === p;
          const price = planPriceBrl(plan, pacsInterval);
          return (
            <button
              key={p}
              onClick={() => choosePlan(p)}
              className={classNames(
                'relative text-left p-3 rounded-xl border transition-all',
                active ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-400/20' : 'border-ink-200 hover:border-ink-300 bg-white'
              )}
            >
              {plan.badge && (
                <span className="absolute -top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600 text-white">{plan.badge}</span>
              )}
              <p className="text-xs font-black text-ink-900">{plan.label}</p>
              <p className="text-sm font-black text-emerald-700">R$ {fmtBrl(price)}<span className="text-[9px] text-ink-400 font-bold">/{intervalShort(pacsInterval)}</span></p>
              <p className="text-[10px] text-ink-500 mt-1">{plan.disk} GB · {plan.model}</p>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => provision(selectedPlan)}
        disabled={busy}
        className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Criar meu PACS ({plans[selectedPlan].label})
      </button>
    </div>
  );
}

function Header({ isMock }: { isMock: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shrink-0">
        <Cloud size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-ink-900 tracking-tight leading-none flex items-center gap-2">
          Meu PACS na Nuvem
          {isMock && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">Demo</span>}
        </h3>
        <p className="text-[11px] text-ink-500 font-medium mt-0.5">Servidor de imagens gerenciado — provisionado e configurado automaticamente.</p>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-ink-50 border border-ink-100">
      <div className="flex items-center gap-1 text-[9px] font-black text-ink-400 uppercase tracking-wider"><Icon size={10} />{label}</div>
      <p className="text-[11px] font-bold text-ink-800 mt-0.5 break-words">{value}</p>
    </div>
  );
}

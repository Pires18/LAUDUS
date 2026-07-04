import { useState } from 'react';
import { useApp } from '../../store/app';
import { getCachedIdToken } from '../../lib/authToken';
import { classNames } from '../../utils/format';
import type { PacsInstance } from '../../types';
import {
  Cloud, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Trash2,
  Server, HardDrive, MapPin, Sparkles, ShieldCheck
} from 'lucide-react';

// Endpoint real de provisionamento (GCP). Quando ausente, o card opera em
// modo MOCK (simula a criação da VM) — permite testar toda a experiência
// self-service sem nuvem configurada.
const PROVISION_ENDPOINT = (import.meta as any).env?.VITE_PACS_PROVISION_ENDPOINT || '';

type Plan = 'starter' | 'pro' | 'dedicado';

const PLANS: Record<Plan, { label: string; price: string; disk: number; model: string; badge?: string }> = {
  starter:  { label: 'Starter',  price: 'R$ 99',  disk: 100, model: 'Compartilhado isolado' },
  pro:      { label: 'Pro',      price: 'R$ 149', disk: 300, model: 'Compartilhado isolado', badge: 'Popular' },
  dedicado: { label: 'Dedicado', price: 'R$ 249', disk: 300, model: 'VM exclusiva' },
};

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

export function MyPacsCard() {
  const { settings, updateSettings, showToast } = useApp();
  const inst: PacsInstance = settings.pacsInstance || { status: 'none' };
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro');

  async function provision(plan: Plan) {
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
        const res = await fetch(PROVISION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getCachedIdToken()}` },
          body: JSON.stringify({ plan, region })
        });
        const data = await res.json();
        if (!res.ok || !data.agentUrl) throw new Error(data.error || 'Falha no provisionamento.');
        result = data;
        if (data.provider === 'gcp') {
          const up = await pollAgentHealth(data.agentUrl);
          if (!up) throw new Error('A VM foi criada, mas o Agente ainda não respondeu. Use "Tentar novamente" em alguns minutos.');
        }
      } else {
        // Modo MOCK — simula a criação (tenant compartilhado ou VM dedicada).
        await new Promise((r) => setTimeout(r, 2600));
        const id = randomHex(4);
        result = shared
          ? { provider: 'shared', instanceName: `tenant-${id}`, agentUrl: 'https://orthanc-server.tail861dda.ts.net', agentSecret: randomHex(24), tenantId: `t-${id}`, orthancVersion: '1.12.4', diskGb: PLANS[plan].disk, diskUsedGb: 0 }
          : { provider: 'mock', instanceName: `pacs-${id}`, agentUrl: `https://pacs-${id}.tailscale-demo.ts.net`, agentSecret: randomHex(24), orthancVersion: '1.12.4', diskGb: PLANS[plan].disk, diskUsedGb: 0 };
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
          orthancVersion: result.orthancVersion,
          diskGb: result.diskGb ?? PLANS[plan].disk,
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
    if (!window.confirm('Remover seu PACS na nuvem? As configurações do agente serão limpas. (No modo real, a VM é destruída — mantenha um backup antes.)')) return;
    setBusy(true);
    try {
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

  // ── Estado: PRONTO ──
  if (inst.status === 'ready') {
    const usedPct = inst.diskGb ? Math.round(((inst.diskUsedGb || 0) / inst.diskGb) * 100) : 0;
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 space-y-4">
        <Header isMock={isMock} />
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-black text-emerald-800">PACS operacional</p>
          <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
            {PLANS[(inst.plan as Plan) || 'pro']?.label || inst.plan}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <Info icon={MapPin} label="Região" value={inst.region || '—'} />
          <Info icon={Server} label="Orthanc" value={`v${inst.orthancVersion || '—'}`} />
          <Info icon={HardDrive} label="Armazenamento" value={`${inst.diskUsedGb ?? 0} / ${inst.diskGb ?? '—'} GB (${usedPct}%)`} />
          <Info icon={ShieldCheck} label="Conexão" value="Segura (Funnel)" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => provision((inst.plan as Plan) || 'pro')}
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
          <p className="ml-auto text-[10px] text-ink-400">Agente e segredo configurados automaticamente.</p>
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
          onClick={() => provision((inst.plan as Plan) || selectedPlan)}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {(Object.keys(PLANS) as Plan[]).map((p) => {
          const plan = PLANS[p];
          const active = selectedPlan === p;
          return (
            <button
              key={p}
              onClick={() => setSelectedPlan(p)}
              className={classNames(
                'relative text-left p-3 rounded-xl border transition-all',
                active ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-400/20' : 'border-ink-200 hover:border-ink-300 bg-white'
              )}
            >
              {plan.badge && (
                <span className="absolute -top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-600 text-white">{plan.badge}</span>
              )}
              <p className="text-xs font-black text-ink-900">{plan.label}</p>
              <p className="text-sm font-black text-emerald-700">{plan.price}<span className="text-[9px] text-ink-400 font-bold">/mês</span></p>
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
        Criar meu PACS ({PLANS[selectedPlan].label})
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

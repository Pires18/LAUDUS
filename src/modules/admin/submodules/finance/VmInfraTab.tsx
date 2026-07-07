import { useEffect, useState, useCallback } from 'react';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import { useApp } from '../../../../store/app';
import { logger } from '../../../../utils/logger';
import { classNames, parseNonNegativeNumber } from '../../../../utils/format';
import { planPrices } from '../../../../../api/_pricing';
import { Spinner } from './Spinner';
import {
  Server, Save, Loader2, RefreshCw, ExternalLink, HardDrive, DollarSign,
  TrendingUp, Cpu, AlertTriangle, CheckCircle2, Clock, Cloud, Settings,
} from 'lucide-react';

// ─── Modelo de custo (editável, salvo em global_config/vm_costs) ───────────────

type Plan = 'starter' | 'pro' | 'dedicado';

interface VmCosts {
  gcpProjectId: string;
  gcpZone: string;
  /** Nosso custo GCP mensal estimado (R$) por plano. */
  costByPlan: Record<Plan, number>;
  /** Custo de disco por GB-mês (R$). */
  storagePerGbMonth: number;
  updatedAt?: number;
}

const DEFAULT_COSTS: VmCosts = {
  gcpProjectId: '',
  gcpZone: 'southamerica-east1-c',
  // Estimativas GCP São Paulo (e2-small ~R$70, e2-medium ~R$140) — o admin ajusta.
  costByPlan: { starter: 70, pro: 70, dedicado: 140 },
  storagePerGbMonth: 0.55,
};

// Specs espelham api/pacs-provision.ts (PLAN_SPEC).
const PLAN_MACHINE: Record<Plan, string> = { starter: 'e2-small', pro: 'e2-small', dedicado: 'e2-medium' };

interface VmRow {
  uid: string;
  userName: string;
  userEmail: string;
  plan: Plan;
  status: string;
  provider?: string;
  region?: string;
  instanceName?: string;
  tenantId?: string;
  diskGb: number;
  diskUsedGb: number;
  createdAt?: number;
}

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const daysSince = (ts?: number) => (ts ? Math.max(0, Math.floor((Date.now() - ts) / 86400000)) : 0);

export function VmInfraTab() {
  const { showToast } = useApp();
  const [costs, setCosts] = useState<VmCosts>(DEFAULT_COSTS);
  const [pacsPlans, setPacsPlans] = useState<Record<string, any>>({});
  const [rows, setRows] = useState<VmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aggError, setAggError] = useState<string | null>(null);

  const loadCosts = useCallback(async () => {
    try {
      const snap = await getDoc(doc(firestore, 'global_config', 'vm_costs'));
      if (snap.exists()) setCosts({ ...DEFAULT_COSTS, ...(snap.data() as VmCosts), costByPlan: { ...DEFAULT_COSTS.costByPlan, ...(snap.data() as any).costByPlan } });
    } catch (err) { logger.error('[VmInfraTab] custos:', err); }
  }, []);

  const loadPacsPlans = useCallback(async () => {
    try {
      const snap = await getDoc(doc(firestore, 'global_config', 'pacs_plans'));
      if (snap.exists()) setPacsPlans(snap.data() as any);
    } catch { /* fallback: sem receita configurada */ }
  }, []);

  const loadVms = useCallback(async () => {
    setAggError(null);
    try {
      // Mapa uid → {name,email} a partir da coleção de usuários (admin lê tudo).
      const usersSnap = await getDocs(collection(firestore, 'users'));
      const userMap: Record<string, { name: string; email: string }> = {};
      usersSnap.docs.forEach(u => { const d = u.data(); userMap[u.id] = { name: d.name || d.displayName || 'Médico', email: d.email || '' }; });

      // Agrega todas as instâncias PACS via collection group de settings.
      const settingsSnap = await getDocs(collectionGroup(firestore, 'settings'));
      const list: VmRow[] = [];
      settingsSnap.docs.forEach(s => {
        const inst = (s.data() as any).pacsInstance;
        if (!inst || !inst.status || inst.status === 'none') return;
        const uid = s.ref.parent.parent?.id || '';
        const um = userMap[uid] || { name: uid, email: '' };
        list.push({
          uid,
          userName: um.name,
          userEmail: um.email,
          plan: (inst.plan as Plan) || 'pro',
          status: inst.status,
          provider: inst.provider,
          region: inst.region,
          instanceName: inst.instanceName,
          tenantId: inst.tenantId,
          diskGb: inst.diskGb ?? 0,
          diskUsedGb: inst.diskUsedGb ?? 0,
          createdAt: inst.createdAt,
        });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRows(list);
    } catch (err: any) {
      logger.error('[VmInfraTab] agregação:', err);
      setRows([]);
      setAggError(err?.code === 'permission-denied'
        ? 'Sem permissão para agregar as VMs. Publique as regras do Firestore (firebase deploy --only firestore:rules) — a regra de collection group de settings foi adicionada.'
        : (err?.message || 'Falha ao carregar as VMs.'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadCosts(), loadPacsPlans(), loadVms()]);
      setLoading(false);
    })();
  }, [loadCosts, loadPacsPlans, loadVms]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPacsPlans(), loadVms()]);
    setRefreshing(false);
  };

  const handleSaveCosts = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'vm_costs'), { ...costs, updatedAt: Date.now() }, { merge: true });
      showToast('Modelo de custos das VMs salvo.', 'success');
    } catch (err: any) {
      showToast(`Erro ao salvar${err?.code ? ` (${err.code})` : ''}.`, 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  // ── Cálculos financeiros ──
  const revenueOf = (r: VmRow) => planPrices(pacsPlans[r.plan] || {}).month || 0;
  const costOf = (r: VmRow) => (costs.costByPlan[r.plan] || 0) + (r.diskGb * costs.storagePerGbMonth);
  const active = rows.filter(r => r.status === 'ready');
  const totalRevenue = active.reduce((a, r) => a + revenueOf(r), 0);
  const totalCost = active.reduce((a, r) => a + costOf(r), 0);
  const totalMargin = totalRevenue - totalCost;
  const totalDisk = rows.reduce((a, r) => a + r.diskGb, 0);
  const totalUsed = rows.reduce((a, r) => a + r.diskUsedGb, 0);

  const proj = costs.gcpProjectId;
  const consoleBase = 'https://console.cloud.google.com';
  const instancesUrl = `${consoleBase}/compute/instances${proj ? `?project=${proj}` : ''}`;
  const billingUrl = `${consoleBase}/billing${proj ? `?project=${proj}` : ''}`;
  const monitoringUrl = `${consoleBase}/monitoring${proj ? `?project=${proj}` : ''}`;
  const instanceUrl = (r: VmRow) =>
    proj && r.instanceName && r.region
      ? `${consoleBase}/compute/instancesDetail/zones/${costs.gcpZone}/instances/${r.instanceName}?project=${proj}`
      : instancesUrl;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <Cloud size={16} className="text-emerald-600" /> Controle Financeiro das VMs
          </h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">
            Custo (GCP) × receita (planos PACS) por VM, uso de disco e atalhos ao Google Cloud Console.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing}
            className="h-9 px-3 rounded-xl border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 flex items-center gap-1.5 disabled:opacity-50 transition-all">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </button>
          <a href={instancesUrl} target="_blank" rel="noopener noreferrer"
            className="h-9 px-3 rounded-xl bg-ink-900 hover:bg-ink-800 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all">
            <ExternalLink size={12} /> Cloud Console
          </a>
        </div>
      </div>

      {/* KPIs financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Receita / mês (ativas)', value: money(totalRevenue), icon: TrendingUp,  grad: 'from-emerald-500 to-teal-600' },
          { label: 'Custo GCP / mês',        value: money(totalCost),    icon: DollarSign,  grad: 'from-rose-500 to-pink-600' },
          { label: 'Margem / mês',           value: money(totalMargin),  icon: TrendingUp,  grad: totalMargin >= 0 ? 'from-brand-500 to-indigo-600' : 'from-rose-500 to-rose-700' },
          { label: 'VMs ativas',             value: `${active.length}/${rows.length}`, icon: Server, grad: 'from-violet-500 to-purple-600' },
        ].map(m => (
          <div key={m.label} className={classNames('rounded-2xl p-4 text-white shadow-md bg-gradient-to-br', m.grad)}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-white/80 truncate">{m.label}</div>
                <div className="text-xl font-black mt-1 tracking-tight truncate">{m.value}</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0"><m.icon size={16} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Config de custos + console */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-[11px] font-black text-ink-700 uppercase tracking-widest flex items-center gap-1.5"><Settings size={13} /> Modelo de Custos & Google Console</h4>
          <button onClick={handleSaveCosts} disabled={saving}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50 transition-all">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="GCP Project ID">
            <input className="input h-9 text-sm w-full" value={costs.gcpProjectId} placeholder="meu-projeto-123"
              onChange={e => setCosts(c => ({ ...c, gcpProjectId: e.target.value.trim() }))} />
          </Field>
          <Field label="Zona GCP">
            <input className="input h-9 text-sm w-full" value={costs.gcpZone} placeholder="southamerica-east1-c"
              onChange={e => setCosts(c => ({ ...c, gcpZone: e.target.value.trim() }))} />
          </Field>
          <Field label="Disco (R$/GB·mês)">
            <input type="number" step="0.01" min={0} className="input h-9 text-sm w-full" value={costs.storagePerGbMonth}
              onChange={e => setCosts(c => ({ ...c, storagePerGbMonth: parseNonNegativeNumber(e.target.value) }))} />
          </Field>
          <div className="flex items-end gap-2">
            <a href={billingUrl} target="_blank" rel="noopener noreferrer" className="flex-1 h-9 rounded-xl border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 flex items-center justify-center gap-1 transition-all"><DollarSign size={12} /> Billing</a>
            <a href={monitoringUrl} target="_blank" rel="noopener noreferrer" className="flex-1 h-9 rounded-xl border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 flex items-center justify-center gap-1 transition-all"><Cpu size={12} /> Monitor</a>
          </div>
        </div>

        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-ink-400 block mb-1.5">Custo GCP mensal por plano (R$)</span>
          <div className="grid grid-cols-3 gap-3">
            {(['starter', 'pro', 'dedicado'] as Plan[]).map(p => (
              <div key={p} className="rounded-xl border border-ink-100 bg-ink-50/40 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-500">{p}</span>
                  <span className="text-[9px] font-bold text-ink-400">{PLAN_MACHINE[p]}</span>
                </div>
                <input type="number" step="0.01" min={0} className="input h-9 text-sm w-full font-bold" value={costs.costByPlan[p]}
                  onChange={e => setCosts(c => ({ ...c, costByPlan: { ...c.costByPlan, [p]: parseNonNegativeNumber(e.target.value) } }))} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Uso agregado de disco */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-black text-ink-700 flex items-center gap-1.5"><HardDrive size={13} /> Armazenamento agregado</span>
          <span className="font-bold text-ink-600">{totalUsed.toFixed(1)} / {totalDisk} GB provisionados</span>
        </div>
        <div className="h-2 w-full bg-ink-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalDisk > 0 ? Math.min(100, (totalUsed / totalDisk) * 100) : 0}%` }} />
        </div>
      </div>

      {/* Tabela de VMs */}
      {aggError ? (
        <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-rose-800">Não foi possível listar as VMs</p>
            <p className="text-[11px] text-rose-600 font-medium mt-0.5">{aggError}</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-14 text-ink-400 bg-white rounded-2xl border border-ink-100">
          <Server size={30} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold">Nenhuma VM provisionada ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-ink-50/50 border-b border-ink-100 text-[10px] font-black text-ink-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Cliente / VM</th>
                  <th className="text-left px-4 py-3">Plano</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3 min-w-[150px]">Disco</th>
                  <th className="text-right px-4 py-3">Uptime</th>
                  <th className="text-right px-4 py-3">Receita/mês</th>
                  <th className="text-right px-4 py-3">Custo/mês</th>
                  <th className="text-right px-4 py-3">Margem</th>
                  <th className="text-right px-4 py-3">Console</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {rows.map((r, i) => {
                  const rev = revenueOf(r);
                  const cost = costOf(r);
                  const margin = rev - cost;
                  const pct = r.diskGb > 0 ? Math.min(100, Math.round((r.diskUsedGb / r.diskGb) * 100)) : 0;
                  const shared = r.provider === 'shared';
                  return (
                    <tr key={`${r.uid}-${i}`} className="hover:bg-ink-50/40">
                      <td className="px-4 py-3">
                        <p className="font-bold text-ink-950 truncate max-w-[180px]">{r.userName}</p>
                        <p className="text-[10px] text-ink-400 font-mono truncate max-w-[180px]">{r.instanceName || r.tenantId || r.userEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-ink-700 capitalize">{r.plan}</span>
                        <p className="text-[9px] text-ink-400">{shared ? 'tenant compart.' : PLAN_MACHINE[r.plan]}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="font-bold text-ink-700">{r.diskUsedGb.toFixed(1)} / {r.diskGb} GB</span>
                          <span className={classNames('font-black', pct >= 90 ? 'text-rose-600' : 'text-ink-400')}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                          <div className={classNames('h-full rounded-full', pct >= 90 ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink-600">{daysSince(r.createdAt)}d</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{money(rev)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{money(cost)}</td>
                      <td className={classNames('px-4 py-3 text-right font-black', margin >= 0 ? 'text-ink-900' : 'text-rose-600')}>{money(margin)}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={instanceUrl(r)} target="_blank" rel="noopener noreferrer" title="Abrir no Google Cloud Console"
                          className="inline-flex p-1.5 rounded-lg text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-400 leading-relaxed">
        Receita vem do preço mensal do plano PACS correspondente; custo é a estimativa configurada acima + disco. Planos <strong>Starter/Pro</strong> rodam como tenant em VM compartilhada (custo real rateado); <strong>Dedicado</strong> usa VM própria.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    ready:        { cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2, label: 'Ativa' },
    provisioning: { cls: 'bg-amber-50 text-amber-700',     icon: Clock,        label: 'Provisionando' },
    error:        { cls: 'bg-rose-50 text-rose-700',       icon: AlertTriangle, label: 'Erro' },
  };
  const s = map[status] || { cls: 'bg-ink-100 text-ink-500', icon: Server, label: status };
  const Icon = s.icon;
  return (
    <span className={classNames('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black', s.cls)}>
      <Icon size={10} /> {s.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-black uppercase tracking-widest text-ink-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

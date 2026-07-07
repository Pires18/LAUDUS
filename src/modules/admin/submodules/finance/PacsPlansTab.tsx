import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import { useApp } from '../../../../store/app';
import { logger } from '../../../../utils/logger';
import { parseNonNegativeNumber } from '../../../../utils/format';
import { Save, Database, Loader2, Server, Info } from 'lucide-react';
import { Spinner } from './Spinner';
import { planPrices } from '../../../../../api/_pricing';

/** Um plano de infra do PACS (VM/tenant) — controlado no Financeiro do admin. */
export interface PacsPlan {
  label: string;
  /** Preços por intervalo (R$) — um único plano cobre mensal/semestral/anual. */
  prices?: { month: number; semester: number; year: number };
  price: number;              // legado (espelha o mensal)
  interval: 'month' | 'semester' | 'year'; // legado
  disk: number;               // GB
  model: string;              // ex.: "Compartilhado isolado" | "VM exclusiva"
  badge?: string;
  active: boolean;
}
export type PacsPlansConfig = { starter: PacsPlan; pro: PacsPlan; dedicado: PacsPlan };

// Defaults = os valores que hoje estão hardcoded em MyPacsCard (retrocompat).
const DEFAULTS: PacsPlansConfig = {
  starter:  { label: 'Starter',  price: 99,  prices: { month: 99,  semester: 534,  year: 950  }, interval: 'month', disk: 100, model: 'Compartilhado isolado', active: true },
  pro:      { label: 'Pro',      price: 149, prices: { month: 149, semester: 804,  year: 1430 }, interval: 'month', disk: 300, model: 'Compartilhado isolado', badge: 'Popular', active: true },
  dedicado: { label: 'Dedicado', price: 249, prices: { month: 249, semester: 1344, year: 2390 }, interval: 'month', disk: 300, model: 'VM exclusiva', active: true },
};

const KEYS: (keyof PacsPlansConfig)[] = ['starter', 'pro', 'dedicado'];

export function PacsPlansTab() {
  const { showToast } = useApp();
  const [cfg, setCfg] = useState<PacsPlansConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'global_config', 'pacs_plans'));
        if (active && snap.exists()) {
          const d = snap.data() as Partial<PacsPlansConfig>;
          setCfg({
            starter: { ...DEFAULTS.starter, ...(d.starter || {}) },
            pro: { ...DEFAULTS.pro, ...(d.pro || {}) },
            dedicado: { ...DEFAULTS.dedicado, ...(d.dedicado || {}) },
          });
        }
      } catch (err) {
        logger.error('[PacsPlansTab] Falha ao carregar pacs_plans:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const upd = (key: keyof PacsPlansConfig, field: keyof PacsPlan, value: any) =>
    setCfg(c => ({ ...c, [key]: { ...c[key], [field]: value } }));

  const setPrice = (key: keyof PacsPlansConfig, iv: 'month' | 'semester' | 'year', v: number) =>
    setCfg(c => {
      const pr = planPrices(c[key]);
      return { ...c, [key]: { ...c[key], prices: { ...pr, [iv]: v } } };
    });

  async function handleSave() {
    setSaving(true);
    try {
      // price (legado) espelha o mensal; interval fica 'month' — cobre os 3.
      const synced: any = { ...cfg };
      KEYS.forEach(k => {
        const pr = planPrices(synced[k]);
        synced[k] = { ...synced[k], prices: pr, price: pr.month, interval: 'month' };
      });
      await setDoc(doc(firestore, 'global_config', 'pacs_plans'), { ...synced, updatedAt: Date.now() }, { merge: true });
      showToast('Planos de PACS salvos. O card de provisão passa a usar estes valores.', 'success');
    } catch (err) {
      logger.error('[PacsPlansTab] Falha ao salvar:', err);
      showToast('Erro ao salvar os planos de PACS.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <Database size={16} className="text-emerald-600" /> Planos PACS / DICOM (infra)
          </h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">
            Preço, disco e modelo das VMs de PACS. O card de provisão do usuário lê estes valores.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar planos PACS
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {KEYS.map((key) => {
          const p = cfg[key];
          return (
            <div key={key} className="bg-white rounded-2xl border border-ink-150 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={15} className="text-ink-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">{key}</span>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-ink-500">
                  <input type="checkbox" checked={p.active} onChange={e => upd(key, 'active', e.target.checked)} /> Ativo
                </label>
              </div>

              <Field label="Nome"><input className="input h-9 text-sm w-full" value={p.label} onChange={e => upd(key, 'label', e.target.value)} /></Field>
              {(() => {
                const pr = planPrices(p);
                return (
                  <Field label="Preço por intervalo (R$)">
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { iv: 'month' as const,    label: 'Mensal' },
                        { iv: 'semester' as const, label: 'Semestral' },
                        { iv: 'year' as const,     label: 'Anual' },
                      ]).map(x => (
                        <div key={x.iv}>
                          <span className="text-[8px] font-black uppercase tracking-widest text-ink-400 block mb-0.5">{x.label}</span>
                          <input type="number" step="0.01" min={0} className="input h-9 text-sm w-full font-bold" value={pr[x.iv]} onChange={e => setPrice(key, x.iv, parseNonNegativeNumber(e.target.value))} />
                        </div>
                      ))}
                    </div>
                  </Field>
                );
              })()}
              <Field label="Disco (GB)"><input type="number" min={0} className="input h-9 text-sm w-full" value={p.disk} onChange={e => upd(key, 'disk', Math.round(parseNonNegativeNumber(e.target.value)))} /></Field>
              <Field label="Modelo"><input className="input h-9 text-sm w-full" value={p.model} onChange={e => upd(key, 'model', e.target.value)} placeholder="Compartilhado isolado / VM exclusiva" /></Field>
              <Field label="Badge (opcional)"><input className="input h-9 text-sm w-full" value={p.badge || ''} onChange={e => upd(key, 'badge', e.target.value)} placeholder="Popular" /></Field>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-400 leading-relaxed flex items-start gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5" />
        Cada plano de PACS cobre os 3 intervalos — o usuário escolhe mensal, semestral ou anual no card de provisão. Os IDs de produto são gerados automaticamente; nada a criar na AbacatePay.
      </p>
    </div>
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

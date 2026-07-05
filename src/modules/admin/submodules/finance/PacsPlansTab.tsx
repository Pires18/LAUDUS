import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import { useApp } from '../../../../store/app';
import { logger } from '../../../../utils/logger';
import { Save, Database, Loader2, Server } from 'lucide-react';
import { Spinner } from './Spinner';

/** Um plano de infra do PACS (VM/tenant) — controlado no Financeiro do admin. */
export interface PacsPlan {
  label: string;
  price: number;              // R$
  interval: 'month' | 'semester' | 'year';
  disk: number;               // GB
  model: string;              // ex.: "Compartilhado isolado" | "VM exclusiva"
  badge?: string;
  active: boolean;
}
export type PacsPlansConfig = { starter: PacsPlan; pro: PacsPlan; dedicado: PacsPlan };

// Defaults = os valores que hoje estão hardcoded em MyPacsCard (retrocompat).
const DEFAULTS: PacsPlansConfig = {
  starter:  { label: 'Starter',  price: 99,  interval: 'month', disk: 100, model: 'Compartilhado isolado', active: true },
  pro:      { label: 'Pro',      price: 149, interval: 'month', disk: 300, model: 'Compartilhado isolado', badge: 'Popular', active: true },
  dedicado: { label: 'Dedicado', price: 249, interval: 'month', disk: 300, model: 'VM exclusiva', active: true },
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

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'pacs_plans'), { ...cfg, updatedAt: Date.now() }, { merge: true });
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
              <div className="grid grid-cols-2 gap-2">
                <Field label="Preço (R$)"><input type="number" step="0.01" className="input h-9 text-sm w-full" value={p.price} onChange={e => upd(key, 'price', parseFloat(e.target.value) || 0)} /></Field>
                <Field label="Disco (GB)"><input type="number" className="input h-9 text-sm w-full" value={p.disk} onChange={e => upd(key, 'disk', parseInt(e.target.value, 10) || 0)} /></Field>
              </div>
              <Field label="Periodicidade">
                <select className="input h-9 text-sm w-full" value={p.interval} onChange={e => upd(key, 'interval', e.target.value)}>
                  <option value="month">Mensal</option>
                  <option value="semester">Semestral</option>
                  <option value="year">Anual (recorrente)</option>
                </select>
              </Field>
              <Field label="Modelo"><input className="input h-9 text-sm w-full" value={p.model} onChange={e => upd(key, 'model', e.target.value)} placeholder="Compartilhado isolado / VM exclusiva" /></Field>
              <Field label="Badge (opcional)"><input className="input h-9 text-sm w-full" value={p.badge || ''} onChange={e => upd(key, 'badge', e.target.value)} placeholder="Popular" /></Field>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-400 leading-relaxed">
        Só o intervalo <strong>Anual</strong> é assinatura recorrente; Mensal/Semestral são pagamentos avulsos que expiram ao fim do período.
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

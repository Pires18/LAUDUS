import { useState, useEffect, useCallback, ReactNode } from 'react';
import { logger } from '../../../utils/logger';
import { FormLabel, NumInput, BoolToggle, MiniToggle, TextField, PasswordField } from './components/FinanceFormControls';
import { TransactionsTab } from './finance/TransactionsTab';
import { PacsPlansTab } from './finance/PacsPlansTab';
import { VmInfraTab } from './finance/VmInfraTab';
import { FinanceOverviewTab } from './finance/FinanceOverviewTab';
import { Spinner } from './finance/Spinner';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  deleteDoc, updateDoc, query, orderBy,
} from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { getIdToken } from '../../../lib/authToken';
import { useApp } from '../../../store/app';
import { useConfirm } from '../../../hooks/useConfirm';
import { getAllUsersAiUsageStats } from '../../../store/db';
import { classNames } from '../../../utils/format';
import type { Plan, SaasAddonsConfig } from '../../../types';
import { planPrices, addonPrices } from '../../../../api/_pricing';
import { Modal } from '../../../components/Modal';
import {
  DollarSign, Settings, Cpu, Loader2, Save, Plus, Trash2, Edit3,
  Info, BarChart3, Check, X, RefreshCw, Calculator, Database,
  FileText, Building2, Zap, Sparkles, Globe, Lock, Eye, EyeOff,
  Copy, CheckCheck, Terminal, Key, QrCode, CreditCard, ShieldCheck,
  AlertTriangle, CalendarDays, Hospital, Server, Wallet,
} from 'lucide-react';

type FinTab = 'overview' | 'plans' | 'pacs-plans' | 'vm-infra' | 'features' | 'extra-resources' | 'abacatepay' | 'ia-costs' | 'transactions';

// ─── Plan form ───────────────────────────────────────────────────────────────

type PlanForm = Omit<Plan, 'id' | 'examLimit' | 'clinicLimit' | 'iaLimit' | 'storageLimitGb' | 'voiceDictation' | 'customMasks'>;

const EMPTY_PLAN: PlanForm = {
  name: '',
  description: '',
  prices: { month: 149, semester: 149 * 6, year: 149 * 12 },
  price: 149,
  interval: 'month',
  active: true,
  featured: false,
  reportsQuota: 100,
  clinicsQuota: 5,
  tokenQuotaLite: 0,
  tokenQuotaPro: 0,
  trialDays: 14,
  includesCalculators: false,
  includesPacs: false,
  includesAppointments: false,
  includesClinics: false,
  motorProDefault: false,
  abacatePayProductId: '',
  features: [],
};

// ─── Add-ons config ──────────────────────────────────────────────────────────

const DEFAULT_EXTRAS: SaasAddonsConfig = {
  calculators:  { price: 49,    description: 'Calculadoras clínicas para biometria, volumes e scores.',                    enabled: true  },
  pacs:         { price: 0,     description: 'PACS/DICOM, worklist e agente local. Ativação assistida.',                   enabled: true,  assisted: true },
  appointments: { price: 39,    description: 'Agendamento de exames e gestão de agenda do médico.',                         enabled: true  },
  clinics:      { price: 49,    description: 'Módulo de clínicas para multi-unidades (centros).',                          enabled: true  },
  extraReport:  { price: 1.50,  description: 'Laudo extra além da quota — inclui geração de laudo e 1 Token (Lite ou Pro).', enabled: true  },
  extraClinic:  { price: 29,    description: 'Clínica adicional além da quota del plano.',                                  enabled: true  },
  tokenLite:    { price: 9.90,  bundleSize: 50,  description: 'Pacote de laudos adicionais do LAUD.IA (usável no Lite ou Pro).', enabled: true  },
  tokenPro:     { price: 24.90, bundleSize: 20,  description: 'Descontinuado — unificado no Pacote de Laudos LAUD.IA.',        enabled: false },
};

// ─── AbacatePay config ───────────────────────────────────────────────────────

interface AbacatePayConfig {
  apiKey: string;
  webhookSecret: string;
  pixEnabled: boolean;
  creditCardEnabled: boolean;
}

const DEFAULT_ABACATE: AbacatePayConfig = {
  apiKey: '',
  webhookSecret: '',
  pixEnabled: true,
  creditCardEnabled: false,
};

// ─── Gemini pricing reference table ──────────────────────────────────────────

const GEMINI_PRICING: Record<string, { inputPer1M: number; outputPer1M: number; tier: 'lite' | 'pro' }> = {
  'gemini-3.5-flash':       { inputPer1M: 0.075, outputPer1M: 0.30,  tier: 'lite' },
  'gemini-2.5-flash':       { inputPer1M: 0.075, outputPer1M: 0.30,  tier: 'lite' },
  'gemini-1.5-flash':       { inputPer1M: 0.075, outputPer1M: 0.30,  tier: 'lite' },
  'gemini-3.1-pro-preview': { inputPer1M: 1.25,  outputPer1M: 5.00,  tier: 'pro'  },
  'gemini-2.5-pro':         { inputPer1M: 1.25,  outputPer1M: 10.00, tier: 'pro'  },
  'gemini-1.5-pro':         { inputPer1M: 1.25,  outputPer1M: 5.00,  tier: 'pro'  },
};

// ─── Shared helper components ─────────────────────────────────────────────────

export function AdminFinanceiro() {
  const [activeTab, setActiveTab] = useState<FinTab>('overview');

  const tabs: { id: FinTab; label: string; icon: typeof DollarSign }[] = [
    { id: 'overview',        label: 'Central',           icon: Wallet     },
    { id: 'plans',           label: 'Planos',            icon: DollarSign },
    { id: 'pacs-plans',      label: 'Planos PACS',       icon: Database   },
    { id: 'vm-infra',        label: 'VMs / Infra',       icon: Server     },
    { id: 'features',        label: 'Funcionalidades',   icon: Settings   },
    { id: 'extra-resources', label: 'Recursos Extras',   icon: Plus       },
    { id: 'abacatepay',      label: 'AbacatePay',        icon: Settings   },
    { id: 'ia-costs',        label: 'Custos de IA',      icon: Cpu        },
    { id: 'transactions',    label: 'Histórico',         icon: FileText   },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-1.5 bg-ink-50 p-1 rounded-xl border border-ink-100 overflow-x-auto">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all whitespace-nowrap',
                isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800 hover:bg-white'
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview'         && <FinanceOverviewTab />}
      {activeTab === 'plans'            && <PlansTab />}
      {activeTab === 'pacs-plans'       && <PacsPlansTab />}
      {activeTab === 'vm-infra'         && <VmInfraTab />}
      {activeTab === 'features'         && <FeaturesTab />}
      {activeTab === 'extra-resources'  && <ExtraResourcesTab />}
      {activeTab === 'abacatepay'       && <AbacatePayTab />}
      {activeTab === 'ia-costs'         && <IACostsTab />}
      {activeTab === 'transactions'     && <TransactionsTab />}
    </div>
  );
}

// ─── Tab: Planos ──────────────────────────────────────────────────────────────

function PlansTab() {
  const { showToast } = useApp();
  const confirm = useConfirm();
  const [plans, setPlans]         = useState<(Plan & { id: string })[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<PlanForm>(EMPTY_PLAN);
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy]   = useState(false);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const loadPlans = useCallback(async () => {
    try {
      const snap = await getDocs(collection(firestore, 'saas_plans'));
      // O id do DOCUMENTO é autoritativo — vem depois do spread para nunca ser
      // sobrescrito por um campo `id` que tenha sido gravado nos dados por engano.
      setPlans(snap.docs.map(d => ({ ...d.data(), id: d.id } as any)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const openNew = () => { setForm(EMPTY_PLAN); setEditingId(null); setShowForm(true); };

  const openEdit = (plan: Plan & { id: string }) => {
    // Migra planos legados (price único) para o modelo de 3 preços embutidos.
    setForm({ ...EMPTY_PLAN, ...plan, prices: planPrices(plan) });
    setEditingId(plan.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Nome do plano é obrigatório.', 'error'); return; }
    setSaving(true);
    try {
      const prices = form.prices || { month: form.price || 0, semester: (form.price || 0) * 6, year: (form.price || 0) * 12 };
      // `price` (legado) espelha o mensal; `interval` fica 'month' — o plano cobre os 3.
      // Nunca gravamos `id` nos dados (o id é do documento) para não corromper a
      // identificação dos planos na listagem/seleção/exclusão.
      const { id: _omitId, ...formData } = form as any;
      const data = {
        ...formData,
        prices,
        price: prices.month,
        interval: 'month' as const,
        category: 'subscription' as const,
        // Cota ÚNICA em reportsQuota (LAUD.IA). Sem sub-cotas Lite/Pro — o Motor
        // Pro apenas habilita usar a mesma cota no Pro (motorProDefault).
        tokenQuotaLite: 0,
        tokenQuotaPro: 0,
        updatedAt: Date.now(),
      };
      if (editingId) {
        await updateDoc(doc(firestore, 'saas_plans', editingId), data);
        showToast('Plano atualizado!', 'success');
      } else {
        await addDoc(collection(firestore, 'saas_plans'), { ...data, createdAt: Date.now() });
        showToast('Plano criado!', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      await loadPlans();
    } catch {
      showToast('Erro ao salvar plano.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir plano',
      message: 'Excluir este plano permanentemente? Assinaturas existentes não são afetadas, mas o plano some do catálogo.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(firestore, 'saas_plans', id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      showToast('Plano removido.', 'info');
      await loadPlans();
    } catch (err: any) {
      // Surfacia o erro real (ex.: permission-denied → regras não publicadas).
      const code = err?.code ? ` (${err.code})` : '';
      showToast(`Erro ao remover plano${code}. ${err?.message || ''}`.trim(), 'error');
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${ids.length} plano(s)`,
      message: `Excluir permanentemente ${ids.length} plano(s) selecionado(s)? Assinaturas existentes não são afetadas. Ideal para remover as variantes de intervalo criadas automaticamente.`,
      variant: 'danger',
      confirmLabel: `Excluir ${ids.length}`,
    });
    if (!ok) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      ids.map(id => deleteDoc(doc(firestore, 'saas_plans', id)))
    );
    const failed = results.filter(r => r.status === 'rejected');
    const okCount = ids.length - failed.length;
    setSelected(new Set());
    await loadPlans();
    setBulkBusy(false);
    if (failed.length === 0) {
      showToast(`${okCount} plano(s) removido(s).`, 'success');
    } else {
      const firstErr = (failed[0] as PromiseRejectedResult).reason;
      const code = firstErr?.code ? ` (${firstErr.code})` : '';
      showToast(`${okCount} removido(s), ${failed.length} falhou/falharam${code}. ${firstErr?.message || ''}`.trim(), 'error');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Planos de Assinatura</h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">Cada plano cobre mensal, semestral e anual. Selecione para excluir vários de uma vez.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 h-10 px-4 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all"
        >
          <Plus size={13} /> Novo Plano
        </button>
      </div>

      {/* Barra de seleção múltipla — remover as variantes duplicadas rapidamente */}
      {plans.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-ink-50 border border-ink-100 rounded-xl px-3 py-2">
          <label className="flex items-center gap-2 text-[11px] font-bold text-ink-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.size === plans.length && plans.length > 0}
              ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < plans.length; }}
              onChange={e => setSelected(e.target.checked ? new Set(plans.map(p => p.id)) : new Set())}
              className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
            />
            Selecionar todos ({plans.length})
          </label>
          <div className="flex-1" />
          {selected.size > 0 && (
            <>
              <span className="text-[11px] font-black text-ink-600">{selected.size} selecionado(s)</span>
              <button
                onClick={() => setSelected(new Set())}
                className="h-8 px-3 rounded-lg border border-ink-200 text-ink-600 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all"
              >
                Limpar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
              >
                {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Excluir selecionados
              </button>
            </>
          )}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-center py-16 text-ink-400 bg-white rounded-2xl border border-ink-100">
          <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold">Nenhum plano configurado.</p>
          <p className="text-xs mt-0.5">Clique em "Novo Plano" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selected.has(plan.id)}
              onToggleSelect={() => toggleSelect(plan.id)}
              onEdit={() => openEdit(plan)}
              onDelete={() => handleDelete(plan.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <PlanFormModal
          form={form} setForm={setForm}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          saving={saving}
          isNew={!editingId}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, selected, onToggleSelect, onEdit, onDelete }: { plan: Plan & { id: string }; selected: boolean; onToggleSelect: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={classNames(
      'bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 relative transition-all',
      selected ? 'border-rose-400 ring-2 ring-rose-200' : plan.featured ? 'border-brand-400 ring-1 ring-brand-300/40' : 'border-ink-100',
      !plan.active && 'opacity-60'
    )}>
      {plan.featured && (
        <div className="absolute -top-2.5 left-4">
          <span className="text-[9px] font-black uppercase tracking-widest bg-brand-600 text-white px-2 py-0.5 rounded-full shadow-sm">Destaque</span>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          title="Selecionar para exclusão"
          className="w-4 h-4 mt-0.5 rounded accent-rose-600 cursor-pointer shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-black text-ink-950 truncate">{plan.name}</h4>
          {plan.description && <p className="text-[11px] text-ink-500 font-medium mt-0.5 line-clamp-2">{plan.description}</p>}
        </div>
        <span className={classNames(
          'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0',
          plan.active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'
        )}>
          {plan.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {(() => {
        const pr = planPrices(plan);
        const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        return (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Mensal',    value: pr.month },
              { label: 'Semestral', value: pr.semester },
              { label: 'Anual',     value: pr.year },
            ].map(x => (
              <div key={x.label} className="bg-ink-50/60 rounded-lg px-2 py-1.5 text-center">
                <div className="text-[8px] font-black text-ink-400 uppercase tracking-widest">{x.label}</div>
                <div className="text-sm font-black text-ink-950 leading-tight mt-0.5">
                  <span className="text-[9px] text-ink-400 font-bold">R$</span> {fmt(x.value)}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-1.5">
        <Pill label={plan.reportsQuota === 0 ? 'Laudos LAUD.IA ∞' : `${plan.reportsQuota} laudos LAUD.IA/mês`} on />
        <Pill label={plan.clinicsQuota === 0 ? 'Clínicas ∞' : `${plan.clinicsQuota} clínicas`}                on />
        <Pill label="Calculadoras" on={plan.includesCalculators} />
        <Pill label="PACS/DICOM"   on={plan.includesPacs} />
        <Pill label="Agendamentos" on={plan.includesAppointments ?? false} />
        <Pill label="Clínicas"     on={plan.includesClinics ?? false} />
        <Pill label="Motor Pro"     on={plan.motorProDefault} />
        <Pill label={`Trial ${plan.trialDays}d`} on />
      </div>

      {plan.features && plan.features.length > 0 && (
        <div className="space-y-1 mt-1 border-t border-ink-50 pt-2">
          <p className="text-[8px] font-black text-ink-400 uppercase tracking-widest">Recursos Extras:</p>
          <div className="flex flex-wrap gap-1">
            {plan.features.map((f, idx) => (
              <span key={idx} className="bg-indigo-50/50 text-indigo-700 text-[8px] font-bold px-2 py-0.5 rounded border border-indigo-100">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-ink-50 mt-auto">
        <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-ink-200 text-[10px] font-black uppercase tracking-widest text-ink-700 hover:bg-ink-50 transition-all">
          <Edit3 size={11} /> Editar
        </button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function Pill({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={classNames(
      'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold',
      on ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-50 text-ink-300'
    )}>
      {on ? <Check size={9} className="shrink-0" /> : <X size={9} className="shrink-0" />}
      <span className={on ? '' : 'line-through'}>{label}</span>
    </div>
  );
}

function PlanFormModal({ form, setForm, onSave, onCancel, saving, isNew }: {
  form: PlanForm; setForm: (f: PlanForm) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; isNew: boolean;
}) {
  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm({ ...form, [k]: v });
  const prices = form.prices || { month: form.price || 0, semester: (form.price || 0) * 6, year: (form.price || 0) * 12 };
  const setPrice = (k: 'month' | 'semester' | 'year', v: number) => set('prices', { ...prices, [k]: v });

  const modalFooter = (
    <>
      <button onClick={onCancel} className="h-10 px-4 rounded-xl border border-ink-200 text-ink-700 text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all">
        Cancelar
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 h-10 px-5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        {isNew ? 'Criar Plano' : 'Salvar'}
      </button>
    </>
  );

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={isNew ? 'Novo Plano' : 'Editar Plano'}
      size="lg"
      footer={modalFooter}
    >
      <div className="space-y-6">
        {/* Informações básicas */}
        <section className="space-y-4">
          <SectionTitle>Informações básicas</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormLabel>Nome do Plano</FormLabel>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="ex: Plano Base, Profissional, Premium"
                className="input h-10 text-sm w-full" />
            </div>
            <div className="md:col-span-2">
              <FormLabel>Descrição</FormLabel>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Breve descrição exibida ao usuário"
                className="input text-sm w-full resize-none" rows={2} />
            </div>
            <div>
              <FormLabel>Dias de Trial</FormLabel>
              <input type="number" min={0} value={form.trialDays} onChange={e => set('trialDays', parseInt(e.target.value) || 0)} className="input h-10 text-sm w-full" />
            </div>
          </div>
        </section>

        {/* Preços — os 3 intervalos no mesmo plano */}
        <section className="space-y-3">
          <SectionTitle>Preços por Intervalo</SectionTitle>
          <p className="text-[11px] text-ink-500 font-medium -mt-1">
            Um único plano cobre os 3 intervalos. O usuário escolhe mensal, semestral ou anual no checkout.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: 'month'    as const, label: 'Mensal',    hint: 'cobrado a cada mês' },
              { key: 'semester' as const, label: 'Semestral', hint: 'cobrado a cada 6 meses' },
              { key: 'year'     as const, label: 'Anual',     hint: 'cobrado a cada 12 meses' },
            ]).map(iv => (
              <div key={iv.key} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                <FormLabel>{iv.label} (R$)</FormLabel>
                <input type="number" min={0} step={0.01} value={prices[iv.key]}
                  onChange={e => setPrice(iv.key, parseFloat(e.target.value) || 0)}
                  className="input h-10 text-sm w-full font-black" />
                <p className="text-[9px] text-ink-400 mt-1">{iv.hint}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-ink-400 leading-relaxed flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-0.5" />
            Todos os intervalos são cobrados como assinatura recorrente na AbacatePay. Os IDs de produto são gerados automaticamente por intervalo.
          </p>
        </section>

        {/* Quotas */}
        <section className="space-y-3">
          <SectionTitle>Quotas e Limites</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Laudos LAUD.IA / mês" hint="0 = ilimitado · cota única do LAUD.IA" value={form.reportsQuota} onChange={v => set('reportsQuota', v)} />
            <NumInput label="Clínicas"             hint="0 = ilimitado" value={form.clinicsQuota} onChange={v => set('clinicsQuota', v)} />
          </div>
          <p className="text-[10px] text-ink-400 leading-relaxed flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-0.5" />
            Cota única de laudos LAUD.IA. Cada laudo consome 1 da cota, seja gerado no Motor Lite ou Pro. Com o <strong>Motor Pro</strong> ligado (abaixo), o usuário pode usar essa mesma cota no Pro; sem ele, só no Lite.
          </p>
        </section>

        {/* Funcionalidades */}
        <section className="space-y-3">
          <SectionTitle>Funcionalidades Incluídas</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <BoolToggle label="Calculadoras Clínicas" value={form.includesCalculators} onChange={v => set('includesCalculators', v)} />
            <BoolToggle label="PACS / DICOM"          value={form.includesPacs}        onChange={v => set('includesPacs', v)}        />
            <BoolToggle label="Agendamentos"          value={form.includesAppointments ?? false} onChange={v => set('includesAppointments', v)} />
            <BoolToggle label="Clínicas"              value={form.includesClinics ?? false}      onChange={v => set('includesClinics', v)} />
            <BoolToggle label="Motor Pro (padrão)"    value={form.motorProDefault}     onChange={v => set('motorProDefault', v)}     />
          </div>
        </section>

        {/* Funcionalidades Extras */}
        <section className="space-y-3">
          <SectionTitle>Funcionalidades Extras (uma por linha)</SectionTitle>
          <textarea
            value={form.features?.join('\n') || ''}
            onChange={e => set('features', e.target.value.split('\n').filter(Boolean))}
            placeholder="Ex: Suporte 24h&#10;Treinamento customizado"
            rows={3}
            className="input p-4 font-medium text-sm w-full"
          />
        </section>

        {/* Status */}
        <section className="space-y-3">
          <SectionTitle>Visibilidade</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <BoolToggle label="Plano Ativo"       value={form.active}         onChange={v => set('active', v)}   />
            <BoolToggle label="Plano em Destaque" value={form.featured ?? false} onChange={v => set('featured', v)} />
          </div>
        </section>
      </div>
    </Modal>
  );
}

// ─── Tabs: Funcionalidades & Recursos Extras ───────────────────────────────

const FEATURES_META = [
  { key: 'calculators' as const, label: 'Calculadoras Clínicas', icon: Calculator,   color: 'indigo',  priceLabel: 'R$/mês',                       hasBundle: false },
  { key: 'pacs'        as const, label: 'PACS / DICOM',          icon: Database,     color: 'emerald', priceLabel: 'R$/mês (0 = sob consulta)',    hasBundle: false },
  { key: 'appointments' as const, label: 'Agendamentos',         icon: CalendarDays, color: 'amber',   priceLabel: 'R$/mês',                       hasBundle: false },
  { key: 'clinics'      as const, label: 'Clínicas',             icon: Hospital,     color: 'teal',    priceLabel: 'R$/mês',                       hasBundle: false },
] as const;

const RESOURCES_META = [
  { key: 'extraReport' as const, label: 'Laudo Extra',              icon: FileText,  color: 'amber',  priceLabel: 'R$ por laudo (avulso)',     hasBundle: false },
  { key: 'tokenLite'   as const, label: 'Pacote de Laudos LAUD.IA', icon: Sparkles,  color: 'violet', priceLabel: 'R$ por pacote de laudos',   hasBundle: true  },
  { key: 'extraClinic' as const, label: 'Clínica Extra',            icon: Building2, color: 'teal',   priceLabel: 'R$/mês por clínica',        hasBundle: false },
] as const;

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
  amber: 'bg-amber-50 border-amber-100 text-amber-600',
  teal: 'bg-teal-50 border-teal-100 text-teal-600',
  violet: 'bg-violet-50 border-violet-100 text-violet-600',
  pink: 'bg-pink-50 border-pink-100 text-pink-600',
};

function FeaturesTab() {
  const { showToast } = useApp();
  const [extras, setExtras]   = useState<SaasAddonsConfig>(DEFAULT_EXTRAS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'global_config', 'addons_config'));
        if (snap.exists()) setExtras({ ...DEFAULT_EXTRAS, ...(snap.data() as SaasAddonsConfig) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // `price` (mensal) espelha prices.month para compat com quem lê só price.
      const synced: any = { ...extras };
      (['calculators', 'pacs', 'appointments', 'clinics'] as const).forEach(k => {
        const e: any = synced[k];
        if (e?.prices) synced[k] = { ...e, price: e.prices.month };
      });
      await setDoc(doc(firestore, 'global_config', 'addons_config'), { ...synced, updatedAt: Date.now() }, { merge: true });
      showToast('Configuração de funcionalidades salva!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSaving(false); }
  };

  const setField = <K extends keyof SaasAddonsConfig>(k: K, v: Partial<SaasAddonsConfig[K]>) =>
    setExtras(ex => ({ ...ex, [k]: { ...(ex[k] as object), ...v } }));

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Funcionalidades do Sistema</h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">Cada módulo tem preço mensal, semestral e anual. Os IDs de produto são gerados automaticamente.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 h-10 px-5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar Funcionalidades
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES_META.map(({ key, label, icon: Icon, color }) => {
          const extra = extras[key] as any || DEFAULT_EXTRAS[key];
          return (
            <div key={key} className={classNames('bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4 transition-all', !extra.enabled && 'opacity-60')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center border shrink-0', COLOR_MAP[color])}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-ink-950">{label}</h4>
                    <p className="text-[10px] text-ink-400 font-medium mt-0.5">{extra.description}</p>
                  </div>
                </div>
                <MiniToggle value={extra.enabled} onChange={v => setField(key, { enabled: v } as any)} />
              </div>

              {(() => {
                const pr = addonPrices(extra);
                const setPrice = (iv: 'month' | 'semester' | 'year', v: number) =>
                  setField(key, { prices: { ...pr, [iv]: v } } as any);
                return (
                  <div>
                    <FormLabel>Preço por intervalo (R$)</FormLabel>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {([
                        { iv: 'month' as const,    label: 'Mensal' },
                        { iv: 'semester' as const, label: 'Semestral' },
                        { iv: 'year' as const,     label: 'Anual' },
                      ]).map(x => (
                        <div key={x.iv}>
                          <span className="text-[9px] font-black uppercase tracking-widest text-ink-400 block mb-0.5">{x.label}</span>
                          <input type="number" min={0} step={0.01} value={pr[x.iv]}
                            onChange={e => setPrice(x.iv, parseFloat(e.target.value) || 0)}
                            className="input h-9 text-sm w-full font-bold" />
                        </div>
                      ))}
                    </div>
                    {key === 'pacs' && (
                      <p className="text-[10px] text-ink-400 mt-1.5">Preço mensal 0 = "sob consulta".</p>
                    )}
                  </div>
                );
              })()}

              {key === 'pacs' && (
                <div className="flex items-center gap-2">
                  <MiniToggle value={extra.assisted} onChange={v => setField('pacs', { assisted: v })} />
                  <span className="text-[10px] text-ink-500 font-medium">Ativação assistida</span>
                </div>
              )}

              <div>
                <FormLabel>Descrição exibida ao usuário</FormLabel>
                <input type="text" value={extra.description}
                  onChange={e => setField(key, { description: e.target.value } as any)}
                  className="input h-9 text-sm w-full" />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-400 leading-relaxed flex items-start gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5" />
        Todos os módulos são cobrados como assinatura recorrente. Os IDs de produto na AbacatePay são gerados automaticamente por módulo × intervalo — você não precisa criar nada lá.
      </p>
    </div>
  );
}

function ExtraResourcesTab() {
  const { showToast } = useApp();
  const [extras, setExtras]   = useState<SaasAddonsConfig>(DEFAULT_EXTRAS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'global_config', 'addons_config'));
        if (snap.exists()) setExtras({ ...DEFAULT_EXTRAS, ...(snap.data() as SaasAddonsConfig) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'addons_config'), { ...extras, updatedAt: Date.now() }, { merge: true });
      showToast('Configuração de recursos extras salva!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSaving(false); }
  };

  const setField = <K extends keyof SaasAddonsConfig>(k: K, v: Partial<SaasAddonsConfig[K]>) =>
    setExtras(ex => ({ ...ex, [k]: { ...(ex[k] as object), ...v } }));

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Recursos Extras</h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">Configure preços e quotas adicionais para usuários.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 h-10 px-5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar Recursos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RESOURCES_META.map(({ key, label, icon: Icon, color, priceLabel, hasBundle }) => {
          const extra = extras[key] as any || DEFAULT_EXTRAS[key];
          return (
            <div key={key} className={classNames('bg-white rounded-2xl border border-ink-100 shadow-sm p-5 space-y-4 transition-all', !extra.enabled && 'opacity-60')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center border shrink-0', COLOR_MAP[color])}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-ink-950">{label}</h4>
                    <p className="text-[10px] text-ink-400 font-medium mt-0.5">{extra.description}</p>
                  </div>
                </div>
                <MiniToggle value={extra.enabled} onChange={v => setField(key, { enabled: v } as any)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FormLabel>{priceLabel}</FormLabel>
                  <input type="number" min={0} step={0.01} value={extra.price}
                    onChange={e => setField(key, { price: parseFloat(e.target.value) || 0 } as any)}
                    className="input h-9 text-sm w-full" />
                </div>
                {hasBundle ? (
                  <div>
                    <FormLabel>Laudos por pacote</FormLabel>
                    <input type="number" min={1} step={1} value={extra.bundleSize || 50}
                      onChange={e => setField(key, { bundleSize: parseInt(e.target.value) || 50 } as any)}
                      className="input h-9 text-sm w-full" />
                  </div>
                ) : <div />}
              </div>

              <div>
                <FormLabel>Descrição exibida ao usuário</FormLabel>
                <input type="text" value={extra.description}
                  onChange={e => setField(key, { description: e.target.value } as any)}
                  className="input h-9 text-sm w-full" />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-400 leading-relaxed flex items-start gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5" />
        Pacotes de laudos/tokens são compra única; clínica extra é recorrente. Os IDs de produto na AbacatePay são gerados automaticamente — sem cadastro manual.
      </p>
    </div>
  );
}

// ─── Tab: AbacatePay ─────────────────────────────────────────────────────────

function AbacatePayTab() {
  const { showToast } = useApp();
  const [config, setConfig]       = useState<AbacatePayConfig>(DEFAULT_ABACATE);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [secretCopied, setSecretCopied]   = useState(false);

  const publicBase = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '');
  const webhookUrl = publicBase
    ? `${publicBase}/api/abacatepay-webhook`
    : typeof window !== 'undefined'
      ? `${window.location.origin}/api/abacatepay-webhook`
      : 'https://seu-dominio.vercel.app/api/abacatepay-webhook';
  const isNgrok = webhookUrl.includes('ngrok') || webhookUrl.includes('tunnel');
  const isVercelProd = webhookUrl.includes('vercel.app') || (webhookUrl.startsWith('https://') && !isNgrok && !webhookUrl.includes('localhost'));

  const isKeyConfigured    = config.apiKey.length > 10;
  const isSecretConfigured = config.webhookSecret.length > 10;
  const isFullyConfigured  = isKeyConfigured && isSecretConfigured;

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'global_config', 'abacatepay_config'));
        if (snap.exists()) setConfig({ ...DEFAULT_ABACATE, ...(snap.data() as AbacatePayConfig) });
      } finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'abacatepay_config'), { ...config, updatedAt: Date.now() }, { merge: true });
      showToast('Configuração AbacatePay salva com sucesso!', 'success');
    } catch { showToast('Erro ao salvar configuração.', 'error'); }
    finally { setSaving(false); }
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
    showToast('URL do webhook copiada!', 'success');
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(config.webhookSecret).catch(() => {});
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
    showToast('Segredo copiado!', 'success');
  };

  const generateSecret = () => {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    const secret = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    setConfig(c => ({ ...c, webhookSecret: secret }));
    showToast('Segredo HMAC gerado. Salve e copie para o AbacatePay!', 'info');
  };

  const testConnection = async () => {
    if (!config.apiKey) { showToast('Insira a API Key antes de testar.', 'error'); return; }
    setTesting(true);
    try {
      const res = await fetch('/api/abacatepay-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getIdToken()}`,
        },
        body: JSON.stringify({ apiKey: config.apiKey }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Conexão com AbacatePay estabelecida com sucesso!', 'success');
      } else {
        showToast(data.error || 'Falha ao conectar com AbacatePay.', 'error');
      }
    } catch {
      showToast('Erro interno ao testar conexão.', 'error');
    } finally { setTesting(false); }
  };

  if (loading) return <Spinner />;

  const STEPS = [
    {
      num: '01', color: 'brand',
      title: 'Criar conta no AbacatePay',
      desc: 'Acesse abacatepay.com e crie sua conta de lojista. Aguarde a aprovação KYC (geralmente até 24 horas úteis).',
      extra: null,
    },
    {
      num: '02', color: 'brand',
      title: 'Obter a Chave de API',
      desc: 'No painel AbacatePay, navegue até Configurações → Chaves de API → Gerar nova chave. Copie e cole no campo "Chave de API" abaixo.',
      extra: null,
    },
    {
      num: '03', color: 'emerald',
      title: 'Registrar a URL do Webhook',
      desc: 'Em AbacatePay → Webhooks → Adicionar Endpoint, use exatamente esta URL:',
      extra: (
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] font-mono bg-ink-900 text-brand-400 px-3 py-2 rounded-lg truncate border border-ink-700 select-all">
              {webhookUrl}
            </code>
            <button onClick={copyWebhookUrl} title="Copiar URL"
              className="shrink-0 h-8 w-8 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 border border-brand-200 text-brand-600 flex items-center justify-center transition-all cursor-pointer">
              {webhookCopied ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
          {!isNgrok && !isVercelProd && !webhookUrl.startsWith('https://') && (
            <div className="flex items-center gap-1.5 text-[9px] text-amber-600 font-bold">
              <AlertTriangle size={10} />
              URL local (HTTP) — AbacatePay exige HTTPS. Configure ngrok: defina <code className="font-mono bg-amber-50 px-1 rounded">VITE_PUBLIC_URL</code> no .env com a URL ngrok e reinicie o servidor.
            </div>
          )}
          {isNgrok && (
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold">
              <Check size={10} /> URL HTTPS via ngrok — pronta para usar no AbacatePay
            </div>
          )}
          {isVercelProd && (
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold">
              <Check size={10} /> URL de produção (Vercel) — registre esta URL no painel AbacatePay
            </div>
          )}
        </div>
      ),
    },
    {
      num: '04', color: 'violet',
      title: 'Configurar Segredo do Webhook',
      desc: 'Gere um segredo aleatório (botão abaixo), copie e cadastre em AbacatePay → Webhooks → Secret. Salve o mesmo valor no campo "Segredo do Webhook" abaixo. A validação aceita tanto o segredo via query string (?webhookSecret=...) quanto a assinatura HMAC-SHA256 no header X-Webhook-Signature — qualquer um autentica o evento.',
      extra: null,
    },
    {
      num: '05', color: 'amber',
      title: 'Criar Produtos no AbacatePay',
      desc: 'Para cada plano e add-on em Planos & Extras, crie um produto no AbacatePay (Produtos → Novo Produto). Copie o Product ID gerado e cole no campo "ID Produto AbacatePay" correspondente.',
      extra: null,
    },
    {
      num: '06', color: 'rose',
      title: 'Configurar Variáveis de Ambiente (Vercel)',
      desc: 'No painel Vercel (Settings → Environment Variables), adicione: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (credenciais de conta de serviço Firebase), ABACATEPAY_WEBHOOK_SECRET (segredo do passo 4) e CRON_SECRET (senha aleatória para proteger o reset mensal automático). Sem CRON_SECRET o job diário de reset de quotas não executa.',
      extra: null,
    },
  ];

  const stepColor = (color: string) => {
    const map: Record<string, string> = {
      brand:  'bg-brand-600/10 text-brand-600',
      emerald:'bg-emerald-500/10 text-emerald-600',
      violet: 'bg-violet-500/10 text-violet-600',
      amber:  'bg-amber-500/10 text-amber-600',
      rose:   'bg-rose-500/10 text-rose-600',
    };
    return map[color] || map.brand;
  };

  return (
    <div className="space-y-5">

      {/* Status banner */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${
        isFullyConfigured
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isFullyConfigured ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className={`text-xs font-black uppercase tracking-widest ${isFullyConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isFullyConfigured ? 'Gateway Ativo — Pagamentos Reais Habilitados' : 'Configuração Incompleta — Fluxo Simulado (Mock)'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-ink-500">
          <span className={`flex items-center gap-1 ${isKeyConfigured ? 'text-emerald-600' : 'text-ink-400'}`}>
            {isKeyConfigured ? <Check size={11} /> : <X size={11} />} API Key
          </span>
          <span className={`flex items-center gap-1 ${isSecretConfigured ? 'text-emerald-600' : 'text-ink-400'}`}>
            {isSecretConfigured ? <Check size={11} /> : <X size={11} />} Webhook Secret
          </span>
        </div>
      </div>

      {/* Step-by-step guide */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-ink-100 bg-ink-50/50">
          <Terminal size={15} className="text-brand-600" />
          <h3 className="text-[11px] font-black text-ink-700 uppercase tracking-widest">Passo a Passo — Configuração Completa</h3>
        </div>
        <div className="p-6 space-y-5">
          {STEPS.map((step) => (
            <div key={step.num} className="flex gap-4">
              <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${stepColor(step.color)}`}>
                <span className="text-[9px] font-black">{step.num}</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-[11px] font-black text-ink-800 mb-0.5">{step.title}</h4>
                <p className="text-[10px] text-ink-400 leading-relaxed">{step.desc}</p>
                {step.extra}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Key size={15} className="text-brand-600" />
          <h3 className="text-[11px] font-black text-ink-700 uppercase tracking-widest">Credenciais do Gateway</h3>
        </div>

        {/* API Key + test */}
        <div className="space-y-2">
          <PasswordField
            label="Chave de API AbacatePay"
            value={config.apiKey}
            onChange={v => setConfig(c => ({ ...c, apiKey: v }))}
          />
          <div className="flex justify-end">
            <button onClick={testConnection} disabled={testing || !config.apiKey}
              className="flex items-center gap-1.5 h-7 px-3 text-[9px] font-black uppercase tracking-widest text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 disabled:opacity-40 transition-all cursor-pointer">
              {testing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
              Testar Conexão
            </button>
          </div>
        </div>

        {/* Webhook Secret + generator + copy */}
        <div className="space-y-2">
          <FormLabel>Segredo do Webhook (HMAC-SHA256)</FormLabel>
          <div className="flex gap-2 items-center">
            <div className="flex-1 min-w-0">
              <PasswordField label="" value={config.webhookSecret} onChange={v => setConfig(c => ({ ...c, webhookSecret: v }))} />
            </div>
            <div className="flex gap-1 shrink-0 mt-1">
              <button onClick={generateSecret} title="Gerar segredo aleatório"
                className="flex items-center gap-1.5 h-9 px-3 text-[9px] font-black uppercase tracking-widest border border-ink-200 rounded-xl hover:bg-ink-50 text-ink-600 transition-all cursor-pointer whitespace-nowrap">
                <RefreshCw size={11} /> Gerar
              </button>
              {config.webhookSecret && (
                <button onClick={copySecret} title="Copiar segredo"
                  className="h-9 w-9 flex items-center justify-center border border-ink-200 rounded-xl hover:bg-ink-50 text-ink-500 transition-all cursor-pointer">
                  {secretCopied ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-ink-400 leading-relaxed">
            Clique em <strong>Gerar</strong> para criar um segredo aleatório seguro, depois copie e cadastre em <strong>AbacatePay → Webhooks → Secret</strong>. Mantenha o mesmo valor aqui.
          </p>
        </div>

        {/* Payment methods */}
        <div className="pt-2 border-t border-ink-100">
          <FormLabel>Métodos de Pagamento</FormLabel>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex items-center justify-between p-3 bg-ink-50 rounded-xl border border-ink-100">
              <div className="flex items-center gap-2">
                <QrCode size={13} className="text-ink-500" />
                <span className="text-[11px] font-bold text-ink-700">PIX</span>
              </div>
              <MiniToggle value={config.pixEnabled} onChange={v => setConfig(c => ({ ...c, pixEnabled: v }))} />
            </div>
            <div className="flex items-center justify-between p-3 bg-ink-50 rounded-xl border border-ink-100">
              <div className="flex items-center gap-2">
                <CreditCard size={13} className="text-ink-500" />
                <span className="text-[11px] font-bold text-ink-700">Cartão de Crédito</span>
              </div>
              <MiniToggle value={config.creditCardEnabled} onChange={v => setConfig(c => ({ ...c, creditCardEnabled: v }))} />
            </div>
          </div>
        </div>

        {/* Dev/prod note */}
        {!isFullyConfigured && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-900 leading-relaxed space-y-1">
              <p><strong>Modo Simulado Ativo:</strong> sem API Key configurada, o sistema usa fluxo mock para desenvolvimento.</p>
              <p>Para o mock funcionar localmente, o servidor precisa das credenciais Firebase Admin no arquivo <code className="font-mono bg-amber-100 px-1 rounded">.env</code>:{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">FIREBASE_CLIENT_EMAIL</code> e <code className="font-mono bg-amber-100 px-1 rounded">FIREBASE_PRIVATE_KEY</code>.
                Em produção no Vercel, configure esses valores nas variáveis de ambiente do projeto.
              </p>
              <p className="font-bold">Para testar sem AbacatePay, use o painel <em>Usuários &amp; Assinaturas</em> para ativar assinaturas manualmente.</p>
            </div>
          </div>
        )}

        {isFullyConfigured && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-emerald-900 leading-relaxed">
              <p><strong>Gateway configurado.</strong> Pagamentos via PIX e/ou cartão serão processados pelo AbacatePay. O webhook valida cada evento com HMAC-SHA256 antes de ativar qualquer assinatura no sistema.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-ink-100">
          <p className="text-[10px] text-ink-400 flex items-center gap-1.5">
            <Lock size={11} /> Chaves salvas com segurança no Firestore. Acesso restrito ao admin.
          </p>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 h-10 px-5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all cursor-pointer">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Tab: Custos de IA ────────────────────────────────────────────────────────

const LITE_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
const PRO_MODELS  = ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-1.5-pro'];

const DEFAULT_MOTOR = {
  lite: { model: 'gemini-3.5-flash',       tokensPerReport: 2000, costPerThousandTokens: 0.075 },
  pro:  { model: 'gemini-3.1-pro-preview',  tokensPerReport: 4000, costPerThousandTokens: 1.25  },
};

function IACostsTab() {
  const { showToast } = useApp();
  const [motorConfig, setMotorConfigState] = useState<typeof DEFAULT_MOTOR>(DEFAULT_MOTOR);
  const [conversionRate, setConversionRate] = useState(5.5);
  const [liveRate, setLiveRate]             = useState<number | null>(null);
  const [loadingRate, setLoadingRate]       = useState(false);
  const [loadingConfig, setLoadingConfig]   = useState(true);
  const [savingRate, setSavingRate]         = useState(false);
  const [savingMotor, setSavingMotor]       = useState(false);

  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const [statsLogs, setStatsLogs]   = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [userLabels, setUserLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'global_config', 'motor_config'));
        if (snap.exists()) {
          const d = snap.data();
          setMotorConfigState({ ...DEFAULT_MOTOR, ...d });
          if (d.aiConversionRateBRL) setConversionRate(d.aiConversionRateBRL);
        }
      } finally { setLoadingConfig(false); }
    })();
    fetchStats();
    fetchLiveRate();
  }, []);

  const fetchLiveRate = useCallback(async () => {
    setLoadingRate(true);
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const rate = parseFloat(data['USDBRL']?.bid);
      if (rate > 0) setLiveRate(rate);
    } catch {
      // silently ignore
    } finally { setLoadingRate(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const logs = await getAllUsersAiUsageStats(startOfMonth, Date.now());
      setStatsLogs(logs);
    } finally { setLoadingStats(false); }
  }, [startOfMonth]);

  const handleSaveRate = async () => {
    setSavingRate(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'motor_config'),
        { aiConversionRateBRL: conversionRate, updatedAt: Date.now() }, { merge: true });
      showToast('Taxa BRL/USD salva!', 'success');
    } catch { showToast('Erro ao salvar taxa.', 'error'); }
    finally { setSavingRate(false); }
  };

  const handleSaveMotor = async () => {
    setSavingMotor(true);
    try {
      await setDoc(doc(firestore, 'global_config', 'motor_config'),
        { ...motorConfig, updatedAt: Date.now() }, { merge: true });
      showToast('Configuração de motores salva!', 'success');
    } catch { showToast('Erro ao salvar configuração de motores.', 'error'); }
    finally { setSavingMotor(false); }
  };

  const setMotor = (tier: 'lite' | 'pro', field: string, value: any) =>
    setMotorConfigState(prev => ({ ...prev, [tier]: { ...prev[tier], [field]: value } }));

  if (loadingConfig) return <Spinner />;

  // Aggregate
  const totalCalls    = statsLogs.length;
  const totalTokensIn = statsLogs.reduce((s, l) => s + (l.inputTokens  || 0), 0);
  const totalTokensOut= statsLogs.reduce((s, l) => s + (l.outputTokens || 0), 0);
  const totalCostUsd  = statsLogs.reduce((s, l) => s + (l.costUsd      || 0), 0);
  const totalCostBrl  = totalCostUsd * conversionRate;

  const liteLogs = statsLogs.filter(l => (l.model || '').toLowerCase().includes('flash'));
  const proLogs  = statsLogs.filter(l => (l.model || '').toLowerCase().includes('pro'));
  const liteCostUsd = liteLogs.reduce((s, l) => s + (l.costUsd || 0), 0);
  const proCostUsd  = proLogs.reduce( (s, l) => s + (l.costUsd || 0), 0);

  const byModel: Record<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};
  statsLogs.forEach(l => {
    const m = l.model || 'unknown';
    if (!byModel[m]) byModel[m] = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
    byModel[m].calls    += 1;
    byModel[m].tokensIn += l.inputTokens  || 0;
    byModel[m].tokensOut+= l.outputTokens || 0;
    byModel[m].costUsd  += l.costUsd      || 0;
  });

  // Ranking de consumo por usuário — usa o `uid` que getAiUsageStats agora
  // preenche a partir do collection group (antes só refletia o próprio admin).
  const byUser: Record<string, { calls: number; costUsd: number }> = {};
  statsLogs.forEach(l => {
    const uid = l.uid || 'desconhecido';
    if (!byUser[uid]) byUser[uid] = { calls: 0, costUsd: 0 };
    byUser[uid].calls   += 1;
    byUser[uid].costUsd += l.costUsd || 0;
  });
  const topUsers = Object.entries(byUser)
    .sort((a, b) => b[1].costUsd - a[1].costUsd)
    .slice(0, 10);

  useEffect(() => {
    const missing = topUsers.map(([uid]) => uid).filter(uid => uid !== 'desconhecido' && !userLabels[uid]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(missing.map(async (uid) => {
        try {
          const snap = await getDoc(doc(firestore, 'users', uid));
          const data = snap.exists() ? snap.data() : null;
          return [uid, data?.email || data?.name || uid] as const;
        } catch {
          return [uid, uid] as const;
        }
      }));
      setUserLabels(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsLogs]);

  return (
    <div className="space-y-5">

      {/* USD/BRL em tempo real */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <Globe size={15} className="text-brand-600" /> Câmbio USD / BRL
          </h3>
          <button onClick={fetchLiveRate} disabled={loadingRate}
            className="flex items-center gap-1.5 h-8 px-3 bg-ink-100 text-ink-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-ink-200 disabled:opacity-50 transition-all">
            {loadingRate ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Atualizar
          </button>
        </div>

        {liveRate && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div>
              <div className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Cotação em Tempo Real (AwesomeAPI)</div>
              <div className="text-xl font-black text-emerald-800 mt-0.5">R$ {liveRate.toFixed(4)} <span className="text-sm font-medium text-emerald-600">por USD</span></div>
            </div>
            <button onClick={() => setConversionRate(parseFloat(liveRate.toFixed(2)))}
              className="ml-auto h-8 px-3 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap hover:bg-emerald-700 transition-all">
              Usar
            </button>
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <FormLabel>Taxa para cálculos (R$ / USD)</FormLabel>
            <input type="number" min={1} max={20} step={0.01} value={conversionRate}
              onChange={e => setConversionRate(parseFloat(e.target.value) || 5.5)}
              className="input h-10 text-sm w-full" />
          </div>
          <button onClick={handleSaveRate} disabled={savingRate}
            className="flex items-center gap-1.5 h-10 px-4 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all">
            {savingRate ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Salvar Taxa
          </button>
        </div>
      </div>

      {/* Tabela de preços Gemini */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
        <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Cpu size={15} className="text-brand-600" /> Referência de Preços Gemini
        </h3>
        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-ink-50/80 border-b border-ink-100 text-[9px] font-black uppercase text-ink-500 tracking-wider">
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3 text-right">Input / 1M tk</th>
                <th className="px-4 py-3 text-right">Output / 1M tk</th>
                <th className="px-4 py-3 text-right">Est. / laudo (1k tk)</th>
                <th className="px-4 py-3 text-right">Em BRL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {Object.entries(GEMINI_PRICING).map(([model, p]) => {
                const estUsd = (p.inputPer1M * 500 + p.outputPer1M * 500) / 1_000_000;
                const estBrl = estUsd * conversionRate;
                return (
                  <tr key={model} className="hover:bg-ink-50/40">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[10px] text-ink-700">{model}</div>
                      <span className={classNames(
                        'text-[9px] font-black uppercase',
                        p.tier === 'lite' ? 'text-indigo-500' : 'text-violet-600'
                      )}>● {p.tier === 'lite' ? 'Lite' : 'Pro'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${p.inputPer1M.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right font-mono">${p.outputPer1M.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-600">${estUsd.toFixed(5)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">R$ {estBrl.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-ink-400 mt-2">* Estimativa com 500 tokens de input + 500 de output por laudo. O custo real varia com o tamanho do conteúdo.</p>
      </div>

      {/* Análise mensal */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-600" /> Análise do Mês Atual
          </h3>
          <button onClick={fetchStats} disabled={loadingStats}
            className="flex items-center gap-1.5 h-8 px-3 bg-ink-100 text-ink-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-ink-200 disabled:opacity-50 transition-all">
            {loadingStats ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Chamadas',   value: totalCalls.toLocaleString('pt-BR')         },
            { label: 'Tokens IN',  value: totalTokensIn.toLocaleString('pt-BR')      },
            { label: 'Tokens OUT', value: totalTokensOut.toLocaleString('pt-BR')     },
            { label: 'Custo USD',  value: `$${totalCostUsd.toFixed(4)}`              },
            { label: 'Custo BRL',  value: `R$ ${totalCostBrl.toFixed(2)}`            },
          ].map(c => (
            <div key={c.label} className="bg-ink-50 rounded-xl p-3 text-center">
              <div className="text-[9px] font-black uppercase text-ink-500 tracking-widest mb-1">{c.label}</div>
              <div className="text-sm font-black text-ink-900">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <TierBox tier="lite" count={liteLogs.length} costUsd={liteCostUsd} rate={conversionRate} />
          <TierBox tier="pro"  count={proLogs.length}  costUsd={proCostUsd}  rate={conversionRate} />
        </div>

        {Object.keys(byModel).length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-ink-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-ink-50/80 border-b border-ink-100 text-[9px] font-black uppercase text-ink-500 tracking-wider">
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3 text-right">Laudos</th>
                  <th className="px-4 py-3 text-right">Tokens IN</th>
                  <th className="px-4 py-3 text-right">Tokens OUT</th>
                  <th className="px-4 py-3 text-right">USD</th>
                  <th className="px-4 py-3 text-right">BRL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {Object.entries(byModel).map(([model, data]) => (
                  <tr key={model} className="hover:bg-ink-50/30">
                    <td className="px-4 py-3 font-mono text-[10px] text-ink-700">{model}</td>
                    <td className="px-4 py-3 text-right font-bold">{data.calls}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-600">{data.tokensIn.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-600">{data.tokensOut.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right font-mono">${data.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">R$ {(data.costUsd * conversionRate).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {topUsers.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-widest mb-3">Top 10 consumidores de IA (mês atual)</h4>
            <div className="overflow-x-auto rounded-xl border border-ink-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-ink-50/80 border-b border-ink-100 text-[9px] font-black uppercase text-ink-500 tracking-wider">
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3 text-right">Laudos</th>
                    <th className="px-4 py-3 text-right">Custo USD</th>
                    <th className="px-4 py-3 text-right">Custo BRL</th>
                    <th className="px-4 py-3 text-right">% do total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {topUsers.map(([uid, data]) => (
                    <tr key={uid} className="hover:bg-ink-50/30">
                      <td className="px-4 py-3 text-ink-700 font-medium truncate max-w-[220px]">{userLabels[uid] || uid}</td>
                      <td className="px-4 py-3 text-right font-bold">{data.calls}</td>
                      <td className="px-4 py-3 text-right font-mono">${data.costUsd.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-700">R$ {(data.costUsd * conversionRate).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-500">{totalCostUsd > 0 ? ((data.costUsd / totalCostUsd) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Configuração de Motores — editável */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <Cpu size={15} className="text-brand-600" /> Configuração dos Motores LAUD.IA
          </h3>
          <button onClick={handleSaveMotor} disabled={savingMotor}
            className="flex items-center gap-1.5 h-9 px-4 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all">
            {savingMotor ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Salvar Motores
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(['lite', 'pro'] as const).map(tier => {
            const m = motorConfig[tier];
            const modelList = tier === 'lite' ? LITE_MODELS : PRO_MODELS;
            const costBrl = (m.costPerThousandTokens || 0) * (m.tokensPerReport || 0) / 1000 * conversionRate;
            return (
              <div key={tier} className={classNames(
                'p-5 rounded-xl border space-y-4',
                tier === 'lite' ? 'bg-indigo-50/40 border-indigo-200' : 'bg-violet-50/40 border-violet-200'
              )}>
                <div className="flex items-center justify-between">
                  <div className={classNames('text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5',
                    tier === 'lite' ? 'text-indigo-700' : 'text-violet-700')}>
                    {tier === 'lite' ? <Zap size={11} /> : <Sparkles size={11} />}
                    Motor {tier === 'lite' ? 'Lite' : 'Pro'}
                  </div>
                  <div className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                    R$ {costBrl.toFixed(5)} / laudo
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <FormLabel>Modelo Gemini</FormLabel>
                    <select value={m.model} onChange={e => setMotor(tier, 'model', e.target.value)}
                      className="input h-10 text-sm w-full font-mono">
                      {modelList.map(model => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Tokens / laudo (est.)</FormLabel>
                      <input type="number" min={100} step={100} value={m.tokensPerReport}
                        onChange={e => setMotor(tier, 'tokensPerReport', parseInt(e.target.value) || 1000)}
                        className="input h-9 text-sm w-full" />
                    </div>
                    <div>
                      <FormLabel>USD / 1k tokens</FormLabel>
                      <input type="number" min={0} step={0.001} value={m.costPerThousandTokens}
                        onChange={e => setMotor(tier, 'costPerThousandTokens', parseFloat(e.target.value) || 0)}
                        className="input h-9 text-sm w-full" />
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-ink-500 font-mono bg-white/70 rounded-lg px-3 py-2 border border-ink-100">
                  {m.model} · {m.tokensPerReport.toLocaleString('pt-BR')} tk/laudo
                  · ${(m.costPerThousandTokens * m.tokensPerReport / 1000).toFixed(5)} USD
                  · R$ {costBrl.toFixed(5)} BRL
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-ink-400 mt-3">
          1 laudo gerado = 1 Token Lite ou 1 Token Pro. O custo real da API varia conforme o tamanho do laudo.
        </p>
      </div>
    </div>
  );
}

function TierBox({ tier, count, costUsd, rate }: { tier: 'lite' | 'pro'; count: number; costUsd: number; rate: number }) {
  const isLite = tier === 'lite';
  return (
    <div className={classNames('p-4 rounded-xl border space-y-1', isLite ? 'bg-indigo-50/50 border-indigo-200/50' : 'bg-violet-50/50 border-violet-200/50')}>
      <div className={classNames('text-[10px] font-black uppercase tracking-widest', isLite ? 'text-indigo-700' : 'text-violet-700')}>
        Motor {isLite ? 'Lite (Flash)' : 'Pro'}
      </div>
      <div className="text-sm font-bold text-ink-800">{count} laudos · R$ {(costUsd * rate).toFixed(2)}</div>
      <div className="text-[10px] text-ink-500">
        Médio/laudo: <span className="font-bold text-ink-800">R$ {count > 0 ? ((costUsd / count) * rate).toFixed(4) : '—'}</span>
      </div>
    </div>
  );
}

// ─── Misc helpers ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-[10px] font-black uppercase tracking-widest text-ink-400 border-b border-ink-100 pb-2">{children}</h4>;
}


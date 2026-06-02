import { useState } from 'react';
import { useCollection } from '../../../hooks/useFirestore';
import { Plan } from '../../../types';
import { useApp } from '../../../store/app';
import { addItemGlobalWithId, updateGlobalItem, deleteGlobalItem, genId, addAuditLog } from '../../../store/db';
import { 
  Plus, Check, DollarSign, Settings2, 
  Trash2, Activity, Hospital, Loader2, X,
  Sparkles, HardDrive, Mic, Sliders
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

export function AdminPlans() {
  const { showToast } = useApp();
  const [editingPlan, setEditingPlan] = useState<Partial<Plan> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: rawPlans, loading } = useCollection<any>('plans', { isGlobal: true });
  const plans = rawPlans.filter((p: any) => !p.id.startsWith('LICENSE_')) as Plan[];

  async function handleSave() {
    if (!editingPlan?.name) {
      showToast('Nome do plano é obrigatório', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const id = editingPlan.id || genId();
      const planData = {
        ...editingPlan,
        price: Number(editingPlan.price) || 0,
        examLimit: editingPlan.examLimit !== undefined ? Number(editingPlan.examLimit) : null,
        clinicLimit: editingPlan.clinicLimit !== undefined ? Number(editingPlan.clinicLimit) : null,
        iaLimit: editingPlan.iaLimit !== undefined ? Number(editingPlan.iaLimit) : null,
        storageLimitGb: editingPlan.storageLimitGb !== undefined ? Number(editingPlan.storageLimitGb) : null,
        voiceDictation: !!editingPlan.voiceDictation,
        customMasks: !!editingPlan.customMasks,
        active: editingPlan.active !== false,
      };
      
      if (editingPlan.id) {
        await updateGlobalItem('plans', id, planData);
        await addAuditLog({ action: 'EDITAR_PLANO', details: `Plano ${planData.name} atualizado com novas adequações clínicas.`, module: 'AdminPlans' });
        showToast('Plano atualizado com sucesso', 'success');
      } else {
        await addItemGlobalWithId('plans', id, planData);
        await addAuditLog({ action: 'CRIAR_PLANO', details: `Plano ${planData.name} criado com adequações clínicas.`, module: 'AdminPlans' });
        showToast('Plano criado com sucesso', 'success');
      }
      setEditingPlan(null);
    } catch {
      showToast('Erro ao salvar plano', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteGlobalItem('plans', deleteTarget.id);
      await addAuditLog({ action: 'EXCLUIR_PLANO', details: `Plano ${deleteTarget.name} excluído.`, module: 'AdminPlans' });
      showToast('Plano removido', 'success');
    } catch {
      showToast('Erro ao remover plano', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">Planos & Assinaturas</h3>
          <p className="text-sm text-ink-500">Configure as ofertas e limites comerciais do LAUD.US.</p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setEditingPlan({ name: '', price: 0, interval: 'month', features: [], active: true })}
        >
          <Plus size={18} />
          Criar Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-96 bg-white rounded-[2.5rem] border border-ink-100 animate-pulse" />)
        ) : plans.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-ink-100 border-dashed">
            <DollarSign size={48} className="text-ink-200 mx-auto mb-4" />
            <p className="text-ink-400 font-bold">Nenhum plano configurado.</p>
            <button 
              onClick={() => setEditingPlan({ name: '', price: 0, interval: 'month', features: [], active: true })}
              className="text-brand-600 font-black text-xs uppercase tracking-widest mt-4 hover:underline"
            >
              + Criar Primeiro Plano
            </button>
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm p-8 flex flex-col hover:border-brand-300 hover:shadow-premium transition-all group relative overflow-hidden">
              {!plan.active && (
                <div className="absolute top-4 right-4 px-3 py-1 bg-ink-100 text-ink-500 rounded-full text-[8px] font-black uppercase tracking-widest">
                  Inativo
                </div>
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 border border-brand-100">
                  <DollarSign size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => setEditingPlan(plan)}
                    className="p-2.5 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl"
                  >
                    <Settings2 size={18} />
                  </button>
                  <button 
                    onClick={() => setDeleteTarget(plan)}
                    className="p-2.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h4 className="text-xl font-black text-ink-900 mb-1">{plan.name}</h4>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-black text-brand-600">R$ {plan.price}</span>
                <span className="text-[10px] text-ink-400 font-black uppercase tracking-widest">/ {plan.interval === 'month' ? 'mês' : 'ano'}</span>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-ink-50/50 p-3 rounded-2xl border border-ink-100">
                    <p className="text-[8px] font-black text-ink-400 uppercase tracking-widest mb-1">Exames/Mês</p>
                    <div className="flex items-center gap-2 text-xs font-black text-ink-900">
                      <Activity size={14} className="text-brand-500" />
                      {plan.examLimit ? plan.examLimit : 'Ilimitado'}
                    </div>
                  </div>
                  <div className="bg-ink-50/50 p-3 rounded-2xl border border-ink-100">
                    <p className="text-[8px] font-black text-ink-400 uppercase tracking-widest mb-1">Cotas Clínicas</p>
                    <div className="flex items-center gap-2 text-xs font-black text-ink-900">
                      <Hospital size={14} className="text-brand-500" />
                      {plan.clinicLimit ? plan.clinicLimit : '1'}
                    </div>
                  </div>
                  <div className="bg-ink-50/50 p-3 rounded-2xl border border-ink-100">
                    <p className="text-[8px] font-black text-ink-400 uppercase tracking-widest mb-1">Laud.IA / Mês</p>
                    <div className="flex items-center gap-2 text-xs font-black text-ink-900">
                      <Sparkles size={14} className="text-brand-500 animate-pulse-subtle" />
                      {plan.iaLimit ? `${plan.iaLimit} laudos` : 'Ilimitado'}
                    </div>
                  </div>
                  <div className="bg-ink-50/50 p-3 rounded-2xl border border-ink-100">
                    <p className="text-[8px] font-black text-ink-400 uppercase tracking-widest mb-1">Armazenamento</p>
                    <div className="flex items-center gap-2 text-xs font-black text-ink-900">
                      <HardDrive size={14} className="text-brand-500" />
                      {plan.storageLimitGb ? `${plan.storageLimitGb} GB` : 'Ilimitado'}
                    </div>
                  </div>
                </div>

                {/* Advanced Medical Options Indicators */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className={classNames(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all",
                    plan.voiceDictation 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm" 
                      : "bg-ink-50 text-ink-400 border-ink-100 opacity-60"
                  )}>
                    <Mic size={10} /> Ditado de Voz
                  </span>
                  <span className={classNames(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all",
                    plan.customMasks 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm" 
                      : "bg-ink-50 text-ink-400 border-ink-100 opacity-60"
                  )}>
                    <Sliders size={10} /> Máscaras Custom
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                   {plan.features?.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs text-ink-600 font-medium">
                      <div className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check size={10} strokeWidth={4} />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setEditingPlan(plan)}
                className="w-full py-4 rounded-2xl bg-ink-900 text-white font-black text-xs uppercase tracking-widest hover:bg-brand-600 transition-all shadow-md"
              >
                Gerenciar Definições
              </button>
            </div>
          ))
        )}
      </div>

      {/* Plan Editor Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl border border-ink-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="text-2xl font-black text-ink-900">Configurar Plano</h4>
                <p className="text-sm text-ink-500">Defina os termos comerciais e técnicos deste nível.</p>
              </div>
              <button onClick={() => setEditingPlan(null)} className="p-2 hover:bg-ink-50 rounded-full">
                <X size={24} className="text-ink-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Nome do Plano</label>
                  <input
                    value={editingPlan.name}
                    onChange={e => setEditingPlan({...editingPlan, name: e.target.value})}
                    placeholder="Ex: Clínica Premium"
                    className="input h-14"
                  />
                </div>
                <div>
                  <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Preço Mensal (R$)</label>
                  <input
                    type="number"
                    value={editingPlan.price}
                    onChange={e => setEditingPlan({...editingPlan, price: Number(e.target.value)})}
                    className="input h-14 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Limite de Exames/Mês</label>
                  <input
                    type="number"
                    value={editingPlan.examLimit || ''}
                    onChange={e => setEditingPlan({...editingPlan, examLimit: e.target.value ? Number(e.target.value) : undefined})}
                    placeholder="Vazio para Ilimitado"
                    className="input h-14 font-mono"
                  />
                </div>
                <div>
                  <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Limite de Clínicas</label>
                  <input
                    type="number"
                    value={editingPlan.clinicLimit || ''}
                    onChange={e => setEditingPlan({...editingPlan, clinicLimit: e.target.value ? Number(e.target.value) : undefined})}
                    placeholder="Ex: 1"
                    className="input h-14 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Laud.IA / Mês (Créditos AI)</label>
                  <input
                    type="number"
                    value={editingPlan.iaLimit || ''}
                    onChange={e => setEditingPlan({...editingPlan, iaLimit: e.target.value ? Number(e.target.value) : undefined})}
                    placeholder="Vazio para Ilimitado"
                    className="input h-14 font-mono"
                  />
                </div>
                <div>
                  <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Armazenamento de Imagens (GB)</label>
                  <input
                    type="number"
                    value={editingPlan.storageLimitGb || ''}
                    onChange={e => setEditingPlan({...editingPlan, storageLimitGb: e.target.value ? Number(e.target.value) : undefined})}
                    placeholder="Vazio para Ilimitado"
                    className="input h-14 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="label uppercase tracking-widest text-[10px] mb-2 font-black text-ink-400">Funcionalidades Extras (uma por linha)</label>
                <textarea
                  value={editingPlan.features?.join('\n')}
                  onChange={e => setEditingPlan({...editingPlan, features: e.target.value.split('\n').filter(Boolean)})}
                  placeholder="Ex: Suporte 24h&#10;Laud.IA Premium"
                  rows={3}
                  className="input p-4 font-medium"
                />
              </div>

              {/* Advanced Clinic Options Toggles */}
              <div className="space-y-3 p-4 bg-ink-50 rounded-3xl border border-ink-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-ink-400 mb-1">Permissões Especiais do Sistema</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-ink-150 cursor-pointer hover:bg-brand-50/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!editingPlan.voiceDictation}
                      onChange={e => setEditingPlan({...editingPlan, voiceDictation: e.target.checked})}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-[10px] font-bold text-ink-700 uppercase tracking-wider">Ditado de Voz</span>
                  </label>
                  
                  <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-ink-150 cursor-pointer hover:bg-brand-50/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!editingPlan.customMasks}
                      onChange={e => setEditingPlan({...editingPlan, customMasks: e.target.checked})}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-[10px] font-bold text-ink-700 uppercase tracking-wider">Máscaras Custom</span>
                  </label>

                  <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-ink-150 cursor-pointer hover:bg-brand-50/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={editingPlan.active !== false}
                      onChange={e => setEditingPlan({...editingPlan, active: e.target.checked})}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-[10px] font-bold text-ink-700 uppercase tracking-wider">Ativo</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-10">
              <button 
                onClick={() => setEditingPlan(null)}
                className="flex-1 py-4 rounded-2xl text-ink-600 font-black text-[10px] uppercase tracking-widest hover:bg-ink-50 transition-all border border-ink-100"
              >
                Descartar
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] py-4 rounded-2xl bg-brand-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Salvar Definições
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir Plano"
        message={`Deseja realmente excluir o plano "${deleteTarget?.name}"? Esta ação não afetará usuários já assinantes, mas impedirá novas adesões.`}
        confirmLabel="Confirmar Exclusão"
        variant="danger"
      />
    </div>
  );
}

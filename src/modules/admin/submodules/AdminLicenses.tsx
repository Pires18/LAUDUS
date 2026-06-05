import { useState } from 'react';
import { useCollection } from '../../../hooks/useFirestore';
import { License, Plan } from '../../../types';
import { useApp } from '../../../store/app';
import { addItemGlobalWithId, updateGlobalItem, deleteGlobalItem, genId, addAuditLog } from '../../../store/db';
import { 
  Key, Plus, Copy, Check, Trash2, ShieldOff,
  Search, Filter, Loader2, Calendar, Mail, 
  User, CheckCircle2, AlertCircle, XCircle, Sparkles
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

export function AdminLicenses() {
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used' | 'revoked'>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal / Dialog states
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);

  // Generator form states
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [quantity, setQuantity] = useState(1);

  // Firestore collections (Licenses are stored in the plans collection with LICENSE_ prefix due to rules permission)
  const { data: rawPlansAndLicenses, loading: loadingPlans } = useCollection<any>('plans', { isGlobal: true });
  
  const plans = rawPlansAndLicenses.filter(p => !p.id.startsWith('LICENSE_')) as Plan[];
  const licenses = rawPlansAndLicenses.filter(p => p.id.startsWith('LICENSE_')).map(l => ({
    ...l,
    id: l.id.replace('LICENSE_', '')
  })) as License[];

  const loadingLicenses = loadingPlans;

  // Filter licenses
  const filteredLicenses = licenses.filter(lic => {
    const matchesSearch = 
      lic.id.toLowerCase().includes(search.toLowerCase()) ||
      lic.planName.toLowerCase().includes(search.toLowerCase()) ||
      (lic.usedByEmail && lic.usedByEmail.toLowerCase().includes(search.toLowerCase()));

    const isUsed = !!lic.usedByUid;
    const isAvailable = lic.active && !lic.usedByUid;
    const isRevoked = !lic.active && !lic.usedByUid;

    let matchesStatus = true;
    if (statusFilter === 'available') matchesStatus = isAvailable;
    else if (statusFilter === 'used') matchesStatus = isUsed;
    else if (statusFilter === 'revoked') matchesStatus = isRevoked;

    return matchesSearch && matchesStatus;
  });

  // Gera chave aleatória formato LAUD-XXXX-XXXX-XXXX
  function generateRandomLicenseCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'LAUD-';
    for (let i = 0; i < 3; i++) {
      let part = '';
      for (let j = 0; j < 4; j++) {
        part += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code += part + (i < 2 ? '-' : '');
    }
    return code;
  }

  // Gera lote de licenças
  async function handleGenerate() {
    if (!selectedPlanId) {
      showToast('Selecione um plano de destino', 'error');
      return;
    }

    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    if (!selectedPlan) return;

    setIsGenerating(true);
    try {
      const now = Date.now();
      for (let i = 0; i < quantity; i++) {
        const code = generateRandomLicenseCode();
        const licensePayload: License = {
          id: code,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          durationMonths: durationMonths,
          active: true,
          createdAt: now
        };
        await addItemGlobalWithId('plans', `LICENSE_${code}`, licensePayload as any);
      }

      await addAuditLog({
        action: 'GERAR_LICENCAS',
        details: `Geradas ${quantity} licenças de ${durationMonths === 9999 ? 'validade eterna' : `${durationMonths} meses`} para o plano ${selectedPlan.name}.`,
        module: 'LICENCAS_ADMIN'
      });

      showToast(`${quantity} licença(s) gerada(s) com sucesso!`, 'success');
      setQuantity(1);
    } catch {
      showToast('Erro ao gerar chaves de licença.', 'error');
    } finally {
      setIsGenerating(false);
    }
  }

  // Copia código para clipboard
  function handleCopy(code: string) {
    const activationLink = `${window.location.origin}?code=${code}`;
    navigator.clipboard.writeText(activationLink);
    setCopiedCode(code);
    showToast('Link de ativação copiado!', 'success');
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  }

  // Revoga licença (desativa o acesso do usuário)
  async function handleRevoke() {
    if (!revokeTarget) return;
    try {
      // 1. Atualiza licença no DB global
      await updateGlobalItem('plans', `LICENSE_${revokeTarget.id}`, {
        active: false,
        revokedAt: Date.now()
      });

      // 2. Se a licença já estiver em uso por um usuário, desativa o usuário também!
      if (revokeTarget.usedByUid) {
        await updateGlobalItem('users', revokeTarget.usedByUid, {
          active: false,
          updatedAt: Date.now()
        });
      }

      await addAuditLog({
        action: 'REVOGAR_LICENCA',
        details: `Licença ${revokeTarget.id} foi revogada. Acesso do usuário associado desativado.`,
        module: 'LICENCAS_ADMIN'
      });

      showToast('Licença e acesso revogados com sucesso', 'success');
    } catch {
      showToast('Erro ao revogar licença', 'error');
    } finally {
      setRevokeTarget(null);
    }
  }

  // Exclui registro de licença
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteGlobalItem('plans', `LICENSE_${deleteTarget.id}`);
      await addAuditLog({
        action: 'EXCLUIR_LICENCA',
        details: `Registro de licença ${deleteTarget.id} deletado permanentemente.`,
        module: 'LICENCAS_ADMIN'
      });
      showToast('Licença excluída do registro', 'success');
    } catch {
      showToast('Erro ao excluir licença', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  // Estatísticas Rápidas
  const totalCount = licenses.length;
  const activeCount = licenses.filter(l => l.active && !l.usedByUid).length;
  const usedCount = licenses.filter(l => !!l.usedByUid).length;
  const revokedCount = licenses.filter(l => !l.active && !l.usedByUid).length;

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Header and Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-ink-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 border border-brand-100">
            <Key size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total Geradas</p>
            <p className="text-2xl font-black text-ink-900">{totalCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-ink-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Disponíveis</p>
            <p className="text-2xl font-black text-emerald-600">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-ink-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Ativadas / Em Uso</p>
            <p className="text-2xl font-black text-blue-600">{usedCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-ink-100 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Revogadas / Inativas</p>
            <p className="text-2xl font-black text-red-600">{revokedCount}</p>
          </div>
        </div>
      </div>

      {/* Generator & Configuration Card */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-ink-100 shadow-sm">
        <h4 className="text-lg font-black text-ink-900 mb-6 flex items-center gap-2">
          <Plus size={20} className="text-brand-600" /> Gerador de Licenças
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label className="label">Plano Associado</label>
            <select
              value={selectedPlanId}
              onChange={e => setSelectedPlanId(e.target.value)}
              className="input h-12 text-xs font-bold uppercase tracking-wider"
              disabled={loadingPlans}
            >
              <option value="">Selecione o Plano...</option>
              {plans.filter(p => p.active).map(p => (
                <option key={p.id} value={p.id}>{p.name} (R$ {p.price})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Validade contratada</label>
            <select
              value={durationMonths}
              onChange={e => setDurationMonths(Number(e.target.value))}
              className="input h-12 text-xs font-bold"
            >
              <option value={1}>1 Mês (Mensal)</option>
              <option value={3}>3 Meses (Trimestral)</option>
              <option value={6}>6 Meses (Semestral)</option>
              <option value={12}>12 Meses (Anual)</option>
              <option value={24}>24 Meses (Bienal)</option>
              <option value={9999}>Eterna / Vitalícia (Nunca Expira)</option>
            </select>
          </div>

          <div>
            <label className="label">Quantidade a gerar</label>
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={e => setQuantity(Math.min(50, Math.max(1, Number(e.target.value))))}
              className="input h-12 font-mono font-bold"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedPlanId}
            className="btn-primary h-12 uppercase text-xs tracking-widest font-black flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
            <span>Gerar Licença(s)</span>
          </button>
        </div>

        {/* Selected Plan Details Preview */}
        {selectedPlanId && plans.find(p => p.id === selectedPlanId) && (
          <div className="mt-6 p-4 bg-brand-50/50 rounded-2xl border border-brand-100 flex flex-wrap gap-x-6 gap-y-2">
            {(() => {
              const p = plans.find(p => p.id === selectedPlanId)!;
              return (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">
                    <span className="text-brand-400 mr-1">Laudos:</span> 
                    {p.examLimit || 'Ilimitado'}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">
                    <span className="text-brand-400 mr-1">IA Créditos:</span> 
                    {p.iaLimit || 'Ilimitado'}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">
                    <span className="text-brand-400 mr-1">Storage:</span> 
                    {p.storageLimitGb ? `${p.storageLimitGb} GB` : 'Ilimitado'}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">
                    <span className="text-brand-400 mr-1">Ditado:</span> 
                    {p.voiceDictation ? 'Sim' : 'Não'}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">
                    <span className="text-brand-400 mr-1">Máscaras:</span> 
                    {p.customMasks ? 'Custom' : 'Apenas Padrão'}
                  </p>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Licenses List Filter & Search Table */}
      <div className="bg-white rounded-[2.5rem] border border-ink-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-ink-100 bg-ink-50/10 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por licença, plano ou email de ativador..."
              className="w-full h-14 pl-12 pr-4 bg-white border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all font-medium"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-ink-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="h-14 bg-white border border-ink-100 rounded-2xl px-4 text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">TODOS OS STATUS</option>
              <option value="available">DISPONÍVEIS</option>
              <option value="used">ATIVADAS / EM USO</option>
              <option value="revoked">REVOGADAS / INATIVAS</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-ink-50/30 text-[10px] font-black uppercase tracking-widest text-ink-400 border-b border-ink-100">
                <th className="px-8 py-5">Chave da Licença</th>
                <th className="px-8 py-5">Plano Contratado</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Ativação & Usuário</th>
                <th className="px-8 py-5">Expiração</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loadingLicenses ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-10"><div className="h-12 bg-ink-50 rounded-2xl w-full" /></td>
                  </tr>
                ))
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-ink-400 font-bold">
                    Nenhuma licença encontrada correspondente aos filtros.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic) => {
                  const isUsed = !!lic.usedByUid;
                  const isAvailable = lic.active && !lic.usedByUid;
                  
                  return (
                    <tr key={lic.id} className="hover:bg-ink-50/20 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-sm text-ink-950 tracking-wider bg-ink-50 px-3 py-1.5 rounded-xl border border-ink-100">{lic.id}</span>
                          <button
                            onClick={() => handleCopy(lic.id)}
                            className="p-2 hover:bg-brand-50 hover:text-brand-600 rounded-xl text-ink-400 transition-colors"
                            title="Copiar Link de Ativação"
                          >
                            {copiedCode === lic.id ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-black text-ink-900">{lic.planName}</p>
                        <p className="text-[10px] text-ink-500 font-bold uppercase tracking-widest mt-0.5">
                          {lic.durationMonths === 9999 ? 'Vitalícia' : `${lic.durationMonths} meses`}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <span className={classNames(
                          "badge",
                          isAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          isUsed ? "bg-blue-50 text-blue-700 border border-blue-100" :
                          "bg-red-50 text-red-700 border border-red-100"
                        )}>
                          {isAvailable ? 'Disponível' : isUsed ? 'Ativada' : 'Revogada / Inativa'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-xs text-ink-700 font-medium">
                        {isUsed ? (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1.5 font-semibold text-ink-900"><Mail size={12} className="text-ink-400" /> {lic.usedByEmail}</p>
                            <p className="text-[10px] text-ink-400 font-medium">Em: {new Date(lic.usedAt!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-xs text-ink-700 font-medium">
                        {isUsed ? (
                          lic.expiresAt ? (
                            <div className="flex items-center gap-1.5 text-ink-900 font-semibold">
                              <Calendar size={12} className="text-ink-400" />
                              <span>{new Date(lic.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-black flex items-center gap-1"><Sparkles size={11} /> Eterna (Vitalícia)</span>
                          )
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {(isAvailable || isUsed) && (
                            <button
                              onClick={() => setRevokeTarget(lic)}
                              className="p-2 text-amber-500 hover:bg-amber-50 hover:text-amber-700 rounded-xl transition-all"
                              title="Revogar / Suspender Licença"
                            >
                              <ShieldOff size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(lic)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all"
                            title="Deletar Registro"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
        title="Revogar Acesso & Licença"
        message={`Deseja realmente revogar a licença "${revokeTarget?.id}"? Se o usuário já estiver ativo no sistema, o acesso dele será desativado IMEDIATAMENTE.`}
        confirmLabel="Sim, Revogar Acesso"
        variant="danger"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Excluir Registro de Licença"
        message={`Deseja realmente deletar o registro da licença "${deleteTarget?.id}"? Esta ação removerá a chave permanentemente da base de dados.`}
        confirmLabel="Confirmar Exclusão"
        variant="danger"
      />
    </div>
  );
}


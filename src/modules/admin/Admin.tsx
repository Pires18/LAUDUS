import { useState } from 'react';
import { useApp } from '../../store/app';
import { useCollection } from '../../hooks/useFirestore';
import { PageHeader } from '../../components/PageHeader';
import { 
  ShieldCheck, Users, CreditCard, History, 
  LifeBuoy, FileSignature, Sparkles, LayoutDashboard,
  Megaphone, Trash2, Loader2
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { setBroadcast } from '../../store/db';

// Submodules
import { AdminUsers } from './submodules/AdminUsers';
import { AdminPlans } from './submodules/AdminPlans';
import { AdminAudit } from './submodules/AdminAudit';
import { AdminSupport } from './submodules/AdminSupport';
import { AdminMasks } from './submodules/AdminMasks';
import { AdminLaudIA } from './submodules/AdminLaudIA';

type AdminTab = 'overview' | 'users' | 'plans' | 'audit' | 'support' | 'masks' | 'laud-ia';

export function Admin() {
  const { view, setView } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>((view.name === 'admin' && (view.activeTab as AdminTab)) || 'overview');

  const tabs = [
    { id: 'overview', label: 'Geral', icon: LayoutDashboard },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'plans', label: 'Planos', icon: CreditCard },
    { id: 'audit', label: 'Auditoria', icon: History },
    { id: 'support', label: 'Suporte', icon: LifeBuoy },
    { id: 'masks', label: 'Máscaras', icon: FileSignature },
    { id: 'laud-ia', label: 'Laud.IA', icon: Sparkles },
  ] as const;

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-8">
        <PageHeader 
          title="Painel de Controle Admin" 
          subtitle="Gerencie toda a infraestrutura, usuários e inteligência do LAUD.US."
          icon={ShieldCheck}
        />

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white p-1.5 rounded-3xl border border-ink-100 shadow-sm overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                "flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-ink-900 text-white shadow-lg scale-[1.02]" 
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="animate-fade-in-up">
          {activeTab === 'overview' && <AdminOverview onNavigate={setActiveTab} />}
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'plans' && <AdminPlans />}
          {activeTab === 'audit' && <AdminAudit />}
          {activeTab === 'support' && <AdminSupport />}
          {activeTab === 'masks' && <AdminMasks />}
          {activeTab === 'laud-ia' && <AdminLaudIA />}
        </div>
      </div>
    </div>
  );
}

function AdminOverview({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const { showToast } = useApp();
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'error'>('info');
  const [isSending, setIsSending] = useState(false);

  // Live Metrics
  const { data: users } = useCollection<any>('users', { isGlobal: true });
  const { data: plans } = useCollection<any>('plans', { isGlobal: true });
  const { data: tickets } = useCollection<any>('support_tickets', { isGlobal: true });
  const { data: auditLogs } = useCollection<any>('audit_logs', { isGlobal: true });

  const stats = [
    { 
      label: 'Total de Usuários', 
      value: users.length.toString(), 
      change: users.filter(u => u.active !== false).length + ' Ativos', 
      icon: Users, color: 'text-blue-600', tab: 'users' 
    },
    { 
      label: 'Planos Ativos', 
      value: plans.filter(p => p.active).length.toString(), 
      change: plans.length + ' Total', 
      icon: CreditCard, color: 'text-emerald-600', tab: 'plans' 
    },
    { 
      label: 'Chamados Abertos', 
      value: tickets.filter(t => t.status === 'open').length.toString(), 
      change: tickets.filter(t => t.status === 'resolved').length + ' Resolvidos', 
      icon: LifeBuoy, color: 'text-red-600', tab: 'support' 
    },
    { 
      label: 'Atividade (24h)', 
      value: auditLogs.filter(l => l.timestamp > Date.now() - 86400000).length.toString(), 
      change: 'Logs Reais', 
      icon: History, color: 'text-purple-600', tab: 'audit' 
    },
  ];

  async function handleSendBroadcast() {
    if (!broadcastMsg) return;
    setIsSending(true);
    try {
      await setBroadcast(broadcastMsg, broadcastType);
      showToast('Mensagem global enviada!', 'success');
      setBroadcastMsg('');
    } catch {
      showToast('Erro ao enviar mensagem', 'error');
    } finally {
      setIsSending(false);
    }
  }

  async function handleClearBroadcast() {
    try {
      await setBroadcast(null);
      showToast('Mensagem global removida', 'info');
    } catch {
      showToast('Erro ao limpar mensagem', 'error');
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <button 
            key={stat.label} 
            onClick={() => onNavigate(stat.tab as AdminTab)}
            className="bg-white p-6 rounded-[2.5rem] border border-ink-100 shadow-sm hover:shadow-premium hover:border-brand-300 transition-all text-left group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={classNames("p-3 rounded-2xl bg-ink-50 transition-colors group-hover:bg-brand-50", stat.color)}>
                <stat.icon size={24} />
              </div>
              <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                {stat.change}
              </span>
            </div>
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-ink-900">{stat.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Broadcast System */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-ink-100 shadow-sm">
           <h4 className="text-lg font-black text-ink-900 mb-6 flex items-center gap-2">
            <Megaphone size={20} className="text-brand-600" /> Sistema de Broadcast
          </h4>
          <div className="space-y-4">
             <p className="text-xs text-ink-500 mb-4">Envie uma notificação global para todos os usuários ativos do LAUD.US.</p>
             <textarea 
               value={broadcastMsg}
               onChange={e => setBroadcastMsg(e.target.value)}
               placeholder="Digite o aviso (ex: Manutenção em 10min...)"
               className="input h-24 p-4 text-sm"
             />
             <div className="flex gap-3">
                <select 
                  value={broadcastType}
                  onChange={e => setBroadcastType(e.target.value as any)}
                  className="input h-12 text-[10px] font-black uppercase tracking-widest"
                >
                  <option value="info">INFORMATIVO</option>
                  <option value="warning">AVISO / ALERTA</option>
                  <option value="error">ERRO CRÍTICO</option>
                </select>
                <button 
                  onClick={handleSendBroadcast}
                  disabled={isSending || !broadcastMsg}
                  className="flex-1 btn-primary h-12 uppercase text-[10px] tracking-widest"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : 'Publicar Aviso'}
                </button>
                <button 
                  onClick={handleClearBroadcast}
                  className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"
                  title="Remover Aviso Atual"
                >
                  <Trash2 size={18} />
                </button>
             </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-ink-100 shadow-sm">
          <h4 className="text-lg font-black text-ink-900 mb-6 flex items-center gap-2">
            <Sparkles size={20} className="text-brand-600" /> Status LAUD.IA
          </h4>
          <div className="space-y-4">
             <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 flex items-center justify-between">
                <div>
                   <p className="text-xs font-bold text-brand-900">Modelo em Produção</p>
                   <p className="text-[10px] text-brand-600 font-mono">gemini-2.5-flash</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             </div>
             <p className="text-sm text-ink-600 leading-relaxed">
               O motor de inteligência está operando normalmente com latência média de 1.2s. 
             </p>
             <button onClick={() => onNavigate('laud-ia')} className="btn-ghost text-xs font-black text-brand-600 uppercase tracking-widest">
               Gerenciar IA Command Center →
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

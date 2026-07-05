import { useState, useEffect } from 'react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { useApp } from '../../store/app';
import { useAdmin } from '../../hooks/useAdmin';
import {
  ShieldCheck, Users, History,
  LifeBuoy, FileSignature, Sparkles, LayoutDashboard,
  Megaphone, Trash2, Loader2, DollarSign, CreditCard, Activity,
  AlertTriangle, ChevronRight
} from 'lucide-react';
import { classNames } from '../../utils/format';
import { logger } from '../../utils/logger';
import { setBroadcast } from '../../store/db';

// Submodules
import { AdminUsersSubscriptions } from './submodules/AdminUsersSubscriptions';
import { AdminAudit } from './submodules/AdminAudit';
import { AdminSupport } from './submodules/AdminSupport';
import { AdminMasks } from './submodules/AdminMasks';
import { AdminFinanceiro } from './submodules/AdminFinanceiro';
import { AdminAnalytics } from './submodules/AdminAnalytics';
import { AdminHealth } from './submodules/AdminHealth';
import { AdminLaudIAInsights } from './submodules/AdminLaudIAInsights';
import { SharedLaudIA } from '../laud-ia/SharedLaudIA';

type AdminTab = 'overview' | 'users' | 'financeiro' | 'audit' | 'support' | 'masks' | 'laud-ia' | 'health';

export function Admin() {
  const { view } = useApp();
  const { isAdmin } = useAdmin();
  const [activeTab, setActiveTab] = useState<AdminTab>((view.name === 'admin' && (view.activeTab as AdminTab)) || 'overview');

  // Guarda de defesa-em-profundidade: mesmo que alguém navegue direto para a
  // view 'admin', só renderiza o painel para quem é admin de verdade (o Firestore
  // já barra os dados, mas evitamos expor a estrutura da tela a não-admins).
  if (!isAdmin) {
    return (
      <div className="module-container">
        <div className="max-w-md mx-auto w-full mt-20 text-center space-y-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-lg font-black text-ink-900">Acesso restrito</h1>
          <p className="text-sm text-ink-500 leading-relaxed">Esta área é exclusiva de administradores. Se você acredita que deveria ter acesso, contate o suporte.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview',    label: 'Geral',              icon: LayoutDashboard },
    { id: 'laud-ia',    label: 'LAUD.IA',            icon: Sparkles        },
    { id: 'users',      label: 'Central de Usuários', icon: Users           },
    { id: 'financeiro', label: 'Financeiro',          icon: DollarSign      },
    { id: 'audit',      label: 'Auditoria',           icon: History         },
    { id: 'support',    label: 'Suporte',             icon: LifeBuoy        },
    { id: 'masks',      label: 'Máscaras',            icon: FileSignature   },
    { id: 'health',     label: 'Saúde',               icon: Activity        },
  ] as const;

  return (
    <div className="module-container">
      <div className="max-w-7xl mx-auto w-full animate-fade-in space-y-6">
        {/* ─── COMPACT HEADER ─── */}
        <div className="bg-white border border-ink-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-ink-900 flex items-center justify-center shadow-sm shrink-0">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-ink-900 tracking-tight leading-none">Painel de Controle Admin</h1>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">Gerencie toda a infraestrutura, usuários e inteligência do LAUD.US.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-ink-100 p-1 rounded-2xl border border-ink-200/50 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all duration-200 whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-ink-500 hover:text-ink-800 hover:bg-white/70'
                )}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="animate-fade-in-up">
          {activeTab === 'overview'    && <AdminOverview onNavigate={setActiveTab} />}
          {activeTab === 'laud-ia'    && <><AdminLaudIAInsights /><SharedLaudIA /></>}
          {activeTab === 'users'      && <AdminUsersSubscriptions />}
          {activeTab === 'financeiro' && <AdminFinanceiro />}
          {activeTab === 'audit'      && <AdminAudit />}
          {activeTab === 'support'    && <AdminSupport />}
          {activeTab === 'masks'      && <AdminMasks />}
          {activeTab === 'health'     && <AdminHealth />}
        </div>
      </div>
    </div>
  );
}

function AdminOverview({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const { showToast, settings } = useApp();
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'error'>('info');
  const [isSending, setIsSending] = useState(false);

  // Métricas: contagem SERVER-SIDE (getCountFromServer) em vez de baixar as
  // coleções inteiras só para contar — barato e escalável.
  const [counts, setCounts] = useState({ users: 0, activeSubs: 0, trials: 0, pastDue: 0, openTickets: 0, resolvedTickets: 0, activity24h: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const usersCol = collection(firestore, 'users');
        const ticketsCol = collection(firestore, 'support_tickets');
        const logsCol = collection(firestore, 'audit_logs');
        const cutoff = Date.now() - 86400000;
        const [u, aSub, tr, pd, ot, rt, act] = await Promise.all([
          getCountFromServer(usersCol),
          getCountFromServer(query(usersCol, where('subscriptionStatus', '==', 'active'))),
          getCountFromServer(query(usersCol, where('subscriptionStatus', '==', 'trialing'))),
          getCountFromServer(query(usersCol, where('subscriptionStatus', '==', 'past_due'))),
          getCountFromServer(query(ticketsCol, where('status', '==', 'open'))),
          getCountFromServer(query(ticketsCol, where('status', '==', 'resolved'))),
          getCountFromServer(query(logsCol, where('timestamp', '>', cutoff))),
        ]);
        if (!active) return;
        setCounts({
          users: u.data().count,
          activeSubs: aSub.data().count,
          trials: tr.data().count,
          pastDue: pd.data().count,
          openTickets: ot.data().count,
          resolvedTickets: rt.data().count,
          activity24h: act.data().count,
        });
      } catch (err) {
        logger.error('[Admin] Falha ao carregar contadores do dashboard:', err);
      }
    })();
    return () => { active = false; };
  }, []);

  const stats = [
    {
      label: 'Total de Usuários',
      value: counts.users.toString(),
      change: (counts.activeSubs + counts.trials) + ' com assinatura',
      icon: Users, color: 'text-blue-600', tab: 'users'
    },
    {
      label: 'Assinaturas Ativas',
      value: counts.activeSubs.toString(),
      change: counts.trials + ' Trials',
      icon: Users, color: 'text-emerald-600', tab: 'users'
    },
    {
      label: 'Chamados Abertos',
      value: counts.openTickets.toString(),
      change: counts.resolvedTickets + ' Resolvidos',
      icon: LifeBuoy, color: 'text-red-600', tab: 'support'
    },
    {
      label: 'Atividade (24h)',
      value: counts.activity24h.toString(),
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <button 
            key={stat.label} 
            onClick={() => onNavigate(stat.tab as AdminTab)}
            className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm hover:shadow-md hover:border-brand-300 transition-all text-left group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={classNames("p-3 rounded-xl bg-ink-50 transition-colors group-hover:bg-brand-50", stat.color)}>
                <stat.icon size={20} />
              </div>
              <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                {stat.change}
              </span>
            </div>
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-ink-900">{stat.value}</p>
          </button>
        ))}
      </div>

      {/* Alertas operacionais — só aparece quando há algo a atender */}
      {(() => {
        const alerts = [
          counts.pastDue > 0 && { k: 'pastDue', tone: 'rose' as const, label: `${counts.pastDue} assinatura(s) em atraso`, hint: 'Regularize ou entre em contato', tab: 'users' as AdminTab },
          counts.openTickets > 0 && { k: 'tickets', tone: 'amber' as const, label: `${counts.openTickets} chamado(s) aguardando`, hint: 'Responda no Suporte', tab: 'support' as AdminTab },
          counts.trials > 0 && { k: 'trials', tone: 'indigo' as const, label: `${counts.trials} trial(s) ativo(s)`, hint: 'Oportunidade de conversão', tab: 'users' as AdminTab },
        ].filter(Boolean) as { k: string; tone: 'rose' | 'amber' | 'indigo'; label: string; hint: string; tab: AdminTab }[];
        if (alerts.length === 0) return null;
        const toneCls: Record<string, string> = {
          rose: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
          amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
          indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
        };
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-ink-400 flex items-center gap-1.5"><AlertTriangle size={13} /> Requer atenção</span>
            {alerts.map(a => (
              <button key={a.k} onClick={() => onNavigate(a.tab)} title={a.hint}
                className={classNames('flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all', toneCls[a.tone])}>
                {a.label}
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        );
      })()}

      {/* Analytics — séries reais (metrics_daily + finance_stats) */}
      <AdminAnalytics />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast System */}
        <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm">
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

        <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm">
          <h4 className="text-lg font-black text-ink-900 mb-6 flex items-center gap-2">
            <Sparkles size={20} className="text-brand-600" /> Status LAUD.IA
          </h4>
          <div className="space-y-4">
             <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 flex items-center justify-between">
                <div>
                   <p className="text-xs font-bold text-brand-900">Google Gemini</p>
                   <p className="text-[10px] text-brand-600 font-mono">
                     Lite: gemini-3.5-flash · Pro: gemini-3.1-pro-preview
                   </p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse animate-duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
             </div>
             <p className="text-sm text-ink-600 leading-relaxed">
               Motor operando normalmente. Os números reais de uso (laudos, custo, usuários ativos) estão no painel <strong>Analytics</strong> acima — dados persistidos de todo o sistema.
             </p>
             <p className="text-[10px] text-ink-400 font-semibold">Configurações avançadas disponíveis na aba LAUD.IA acima.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

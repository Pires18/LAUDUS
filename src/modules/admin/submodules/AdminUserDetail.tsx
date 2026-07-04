import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { getUserAiUsageStats } from '../../../store/db';
import { logger } from '../../../utils/logger';
import { classNames } from '../../../utils/format';
import { Modal } from '../../../components/Modal';
import {
  User, CreditCard, FileText, History, LifeBuoy, Cpu, Loader2, Mail, Calendar,
} from 'lucide-react';

interface UserLite {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  subscriptionStatus?: string;
  reportsUsedThisMonth?: number;
  reportsQuota?: number;
  motorProEnabled?: boolean;
  createdAt?: number;
  lastLogin?: number;
}

interface Props {
  user: UserLite | null;
  onClose: () => void;
}

const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const fmtDateTime = (ms?: number) => (ms ? new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

export function AdminUserDetail({ user, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [usage, setUsage] = useState<{ total: number; lite: number; pro: number; costUsd: number }>({ total: 0, lite: 0, pro: 0, costUsd: 0 });

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const monthStart = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const byTs = (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0);
        const [subSnap, txSnap, logSnap, tkSnap, aiLogs] = await Promise.all([
          getDoc(doc(firestore, 'subscriptions', `sub_${uid}`)),
          getDocs(query(collection(firestore, 'transactions'), where('userId', '==', uid))),
          getDocs(query(collection(firestore, 'audit_logs'), where('userId', '==', uid))),
          getDocs(query(collection(firestore, 'support_tickets'), where('userId', '==', uid))),
          getUserAiUsageStats(uid, monthStart, Date.now()),
        ]);
        if (!active) return;
        setSub(subSnap.exists() ? subSnap.data() : null);
        setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTs).slice(0, 15));
        setLogs(logSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byTs).slice(0, 15));
        setTickets(tkSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
        const lite = aiLogs.filter(l => !/pro/i.test(String((l as any).model || ''))).length;
        const pro = aiLogs.length - lite;
        const costUsd = aiLogs.reduce((s, l) => s + (Number((l as any).costUsd) || 0), 0);
        setUsage({ total: aiLogs.length, lite, pro, costUsd });
      } catch (err) {
        logger.error('[AdminUserDetail] Falha ao carregar 360º:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  if (!user) return null;
  const addons: string[] = (sub?.addons as string[]) || [];

  return (
    <Modal open={!!user} onClose={onClose} title="Visão 360º do Cliente" size="xl">
      <div className="space-y-5">
        {/* Cabeçalho do usuário */}
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-ink-50/60 border border-ink-100">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
            <User size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-ink-900 truncate">{user.name || '—'}</h3>
            <p className="text-xs text-ink-500 flex items-center gap-1.5"><Mail size={12} /> {user.email || '—'}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge tone="ink">{user.role || 'medico'}</Badge>
              <Badge tone={user.subscriptionStatus === 'active' ? 'emerald' : user.subscriptionStatus === 'trialing' ? 'blue' : 'amber'}>
                {user.subscriptionStatus || 'sem assinatura'}
              </Badge>
              {user.active === false && <Badge tone="rose">inativo</Badge>}
              {user.motorProEnabled && <Badge tone="violet">Motor Pro</Badge>}
            </div>
          </div>
          <div className="text-right text-[10px] text-ink-400 font-semibold shrink-0 space-y-0.5">
            <p className="flex items-center gap-1 justify-end"><Calendar size={11} /> Criado: {fmtDate(user.createdAt)}</p>
            <p>Último acesso: {fmtDate(user.lastLogin)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-brand-500" /></div>
        ) : (
          <>
            {/* Assinatura + Uso */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section icon={CreditCard} title="Assinatura">
                <Row label="Plano" value={sub?.plan || sub?.planId || '—'} />
                <Row label="Status" value={sub?.status || user.subscriptionStatus || '—'} />
                <Row label="Laudos no mês" value={`${user.reportsUsedThisMonth ?? 0} / ${user.reportsQuota ?? 100}`} />
                <div className="pt-1">
                  <span className="text-[10px] font-black text-ink-400 uppercase tracking-wider">Add-ons</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {addons.length ? addons.map(a => <Badge key={a} tone="emerald">{a}</Badge>) : <span className="text-xs text-ink-400">nenhum</span>}
                  </div>
                </div>
              </Section>
              <Section icon={Cpu} title="Uso de IA (30 dias)">
                <Row label="Laudos gerados" value={usage.total.toLocaleString('pt-BR')} />
                <Row label="Lite / Pro" value={`${usage.lite} / ${usage.pro}`} />
                <Row label="Custo estimado" value={`US$ ${usage.costUsd.toFixed(2)}`} />
              </Section>
            </div>

            {/* Pagamentos */}
            <Section icon={FileText} title={`Pagamentos (${transactions.length})`}>
              {transactions.length === 0 ? <Empty>Sem transações.</Empty> : (
                <div className="space-y-1.5">
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-ink-50 last:border-0">
                      <span className="text-ink-500 font-mono text-[10px]">{fmtDateTime(t.timestamp)}</span>
                      <span className="text-ink-700 font-medium flex-1 px-3 truncate">{t.description || t.type}</span>
                      <span className="font-mono font-bold text-ink-900">R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span className={classNames('ml-2 text-[9px] font-black uppercase', t.status === 'paid' ? 'text-emerald-600' : 'text-amber-600')}>{t.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Suporte + Atividade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Section icon={LifeBuoy} title={`Tickets (${tickets.length})`}>
                {tickets.length === 0 ? <Empty>Nenhum ticket.</Empty> : (
                  <div className="space-y-1.5">
                    {tickets.slice(0, 8).map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1">
                        <span className="text-ink-700 truncate flex-1">{t.subject || t.title || 'Ticket'}</span>
                        <Badge tone={t.status === 'open' ? 'rose' : t.status === 'resolved' ? 'emerald' : 'amber'}>{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
              <Section icon={History} title="Atividade recente">
                {logs.length === 0 ? <Empty>Sem atividade.</Empty> : (
                  <div className="space-y-1.5">
                    {logs.slice(0, 8).map(l => (
                      <div key={l.id} className="text-xs py-1">
                        <span className="text-ink-700 font-medium">{l.action}</span>
                        <span className="text-ink-400 text-[10px] ml-2">{fmtDateTime(l.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-brand-600" />
        <h4 className="text-xs font-black text-ink-800 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-400 font-semibold">{label}</span>
      <span className="text-ink-900 font-bold">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-ink-400 py-2">{children}</p>;
}

function Badge({ tone, children }: { tone: 'ink' | 'emerald' | 'blue' | 'amber' | 'rose' | 'violet'; children: React.ReactNode }) {
  const map: Record<string, string> = {
    ink: 'bg-ink-100 text-ink-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return <span className={classNames('px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider', map[tone])}>{children}</span>;
}

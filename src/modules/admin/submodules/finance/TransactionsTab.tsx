import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, query, orderBy, limit, startAfter, where } from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import { useApp } from '../../../../store/app';
import { logger } from '../../../../utils/logger';
import { classNames } from '../../../../utils/format';
import { estimateNetRevenue, type GatewayFeeConfig } from '../../../../../api/_pricing';
import {
  FileText, Loader2, RefreshCw, Search, Filter, Download,
  QrCode, CreditCard, Wallet, ChevronDown, X, TrendingUp,
  RefreshCcw, Tag, Calendar, Receipt,
} from 'lucide-react';
import { Spinner } from './Spinner';

const TX_PAGE = 100;
const RECALC_PAGE = 500;

type FinanceStats = {
  totalRevenue: number; paidCount: number;
  pixCount: number; ccCount: number; manualCount: number; otherCount?: number;
};

type Transaction = {
  id: string;
  userId?: string;
  userEmail?: string;
  type?: string;
  description?: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  timestamp?: number;
  interval?: string;
  billingMode?: string;
  installments?: number;
  addon?: string;
  planId?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) =>
  `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INTERVAL_LABELS: Record<string, string> = {
  month: 'Mensal', semester: 'Semestral', year: 'Anual',
};

const METHOD_LABEL: Record<string, string> = {
  pix: 'PIX', credit_card: 'Cartão', manual: 'Manual',
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  paid:      { label: 'Pago',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:    { label: 'Falhou',      cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  refunded:  { label: 'Reembolsado', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending:   { label: 'Pendente',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const TYPE_CFG: Record<string, { label: string; cls: string }> = {
  subscription: { label: 'Plano',    cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  addon:        { label: 'Add-on',   cls: 'bg-violet-50 text-violet-700 border-violet-100' },
  renewal:      { label: 'Renovação',cls: 'bg-teal-50 text-teal-700 border-teal-100' },
  one_time:     { label: 'Avulso',   cls: 'bg-ink-50 text-ink-600 border-ink-100' },
};

const PERIOD_OPTS = [
  { label: '7 dias',    days: 7   },
  { label: '30 dias',   days: 30  },
  { label: '90 dias',   days: 90  },
  { label: '6 meses',   days: 180 },
  { label: 'Tudo',      days: 0   },
];

type TxFilters = {
  period: number; status: string; method: string; type: string; interval: string; nf: string; search: string;
};

// Predicado único de filtro — usado tanto pela tabela em tela (sobre as
// páginas já carregadas) quanto pelo export CSV (sobre a coleção inteira),
// pra garantir que "exportar" sempre reflita exatamente o que está filtrado
// na tela, nunca o banco inteiro por engano.
function matchesTxFilters(t: Transaction, nfStatus: string, f: TxFilters): boolean {
  const cutoff = f.period > 0 ? Date.now() - f.period * 86400000 : 0;
  if (f.period > 0 && (t.timestamp || 0) < cutoff) return false;
  if (f.status !== 'all' && t.status !== f.status) return false;
  if (f.method !== 'all' && t.paymentMethod !== f.method) return false;
  if (f.type !== 'all' && t.type !== f.type) return false;
  if (f.interval !== 'all' && t.interval !== f.interval) return false;
  if (f.nf !== 'all' && nfStatus !== f.nf) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    return (
      (t.userEmail || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }
  return true;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionsTab() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [nfMap, setNfMap] = useState<Record<string, string>>({});
  const [gatewayFees, setGatewayFees] = useState<GatewayFeeConfig | null>(null);
  const lastDocRef = useRef<any>(null);
  const { showToast, user } = useApp();

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<number>(30);
  const [filterInterval, setFilterInterval] = useState<string>('all');
  const [filterNf, setFilterNf] = useState<string>('all');

  const loadStats = useCallback(async () => {
    try {
      const s = await getDoc(doc(firestore, 'global_config', 'finance_stats'));
      setStats(s.exists() ? (s.data() as FinanceStats) : null);
    } catch (err) { logger.error('Erro ao carregar métricas:', err); }
  }, []);

  const loadNfAndFees = useCallback(async () => {
    try {
      const [nfSnap, abacateSnap] = await Promise.all([
        getDocs(collectionGroup(firestore, 'nf')),
        getDoc(doc(firestore, 'global_config', 'abacatepay_config')),
      ]);
      const map: Record<string, string> = {};
      nfSnap.docs.forEach(d => {
        const txId = d.ref.parent.parent?.id;
        if (txId) map[txId] = (d.data() as any).status || 'pending';
      });
      setNfMap(map);
      setGatewayFees(abacateSnap.exists() ? (abacateSnap.data() as GatewayFeeConfig) : null);
    } catch (err) { logger.error('Erro ao carregar status de NF:', err); }
  }, []);

  const toggleNfStatus = useCallback(async (txId: string) => {
    const current = nfMap[txId] || 'pending';
    const next = current === 'issued' ? 'pending' : 'issued';
    setNfMap(prev => ({ ...prev, [txId]: next }));
    try {
      await setDoc(doc(firestore, 'transactions', txId, 'nf', 'status'), {
        status: next,
        updatedAt: Date.now(),
        updatedBy: user?.uid || 'unknown',
      }, { merge: true });
    } catch (err) {
      logger.error('Erro ao atualizar status de NF:', err);
      setNfMap(prev => ({ ...prev, [txId]: current }));
      showToast('Falha ao atualizar status de NF.', 'error');
    }
  }, [nfMap, user, showToast]);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc'), limit(TX_PAGE))
      );
      setAllTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === TX_PAGE);
    } catch (err) {
      logger.error('Erro ao carregar transações:', err);
      showToast('Erro ao carregar transações.', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  const loadMore = useCallback(async () => {
    if (!lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc'), startAfter(lastDocRef.current), limit(TX_PAGE))
      );
      setAllTransactions(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === TX_PAGE);
    } catch (err) { logger.error('Erro ao carregar mais:', err); }
    finally { setLoadingMore(false); }
  }, []);

  const recalcStats = useCallback(async () => {
    setRecalculating(true);
    try {
      // M2: lê em lotes (RECALC_PAGE por vez) em vez de um getDocs() sobre a
      // coleção inteira — evita carregar todo o histórico de transações de
      // uma vez em memória/rede conforme a base cresce. Os agregados são
      // acumulados incrementalmente entre lotes.
      let totalRevenue = 0, paidCount = 0, pixCount = 0, ccCount = 0, manualCount = 0, otherCount = 0;
      let cursor: any = null;
      let batchCount = 0;
      for (;;) {
        const base = query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc'), limit(RECALC_PAGE));
        const q = cursor ? query(base, startAfter(cursor)) : base;
        const batchSnap = await getDocs(q);
        if (batchSnap.empty) break;
        for (const d of batchSnap.docs) {
          const t = d.data() as any;
          if (t.status !== 'paid') continue;
          totalRevenue += t.amount || 0;
          paidCount++;
          if (t.paymentMethod === 'pix') pixCount++;
          else if (t.paymentMethod === 'credit_card') ccCount++;
          else if (t.paymentMethod === 'manual') manualCount++;
          else otherCount++;
        }
        cursor = batchSnap.docs[batchSnap.docs.length - 1];
        batchCount++;
        if (batchSnap.docs.length < RECALC_PAGE) break;
      }
      const agg = { totalRevenue, paidCount, pixCount, ccCount, manualCount, otherCount, updatedAt: Date.now() };
      await setDoc(doc(firestore, 'global_config', 'finance_stats'), agg, { merge: true });
      setStats(agg);
      showToast(`Métricas recalculadas (${batchCount} lote${batchCount === 1 ? '' : 's'} de até ${RECALC_PAGE}).`, 'success');
    } catch (err) {
      logger.error('Erro ao recalcular:', err);
      showToast('Falha ao recalcular métricas.', 'error');
    } finally { setRecalculating(false); }
  }, [showToast]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const [snap, nfSnap, abacateSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc'))),
        getDocs(collectionGroup(firestore, 'nf')),
        getDoc(doc(firestore, 'global_config', 'abacatepay_config')),
      ]);
      const nfByTx: Record<string, string> = {};
      nfSnap.docs.forEach(d => {
        const txId = d.ref.parent.parent?.id;
        if (txId) nfByTx[txId] = (d.data() as any).status || 'pending';
      });
      const fees: GatewayFeeConfig = abacateSnap.exists() ? (abacateSnap.data() as GatewayFeeConfig) : {};
      const cell = (v: unknown) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [
        'Data/Hora', 'Usuário', 'Tipo', 'Descrição', 'Intervalo', 'Parcelas',
        'Valor Bruto (R$)', 'Taxa Gateway Estimada (R$)', 'Valor Líquido Estimado (R$)',
        'Método', 'Status', 'Nota Fiscal',
      ];
      // Aplica o MESMO predicado de filtro usado na tabela em tela (busca,
      // período, status, método, tipo, intervalo, NF) sobre a coleção
      // inteira — antes exportava tudo, ignorando os filtros ativos.
      const activeFilters: TxFilters = {
        period: filterPeriod, status: filterStatus, method: filterMethod,
        type: filterType, interval: filterInterval, nf: filterNf, search,
      };
      const rows = snap.docs
        .filter(d => {
          const t = d.data() as any;
          const nfStatus = nfByTx[d.id] === 'issued' ? 'issued' : 'pending';
          return matchesTxFilters(t, nfStatus, activeFilters);
        })
        .map(d => {
        const t = d.data() as any;
        const gross = t.amount || 0;
        const net = t.status === 'paid'
          ? estimateNetRevenue({ [t.paymentMethod || 'manual']: gross }, { [t.paymentMethod || 'manual']: 1 }, fees)
          : gross;
        const feeEst = gross - net;
        const nfStatus = nfByTx[d.id] === 'issued' ? 'Emitida' : 'Pendente';
        return [
          t.timestamp ? new Date(t.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
          t.userEmail || '',
          t.type || '',
          t.description || '',
          INTERVAL_LABELS[t.interval] || t.interval || '',
          t.installments ? `${t.installments}x` : '—',
          gross.toFixed(2),
          feeEst.toFixed(2),
          net.toFixed(2),
          METHOD_LABEL[t.paymentMethod] || t.paymentMethod || '',
          t.status || '',
          nfStatus,
        ].map(cell).join(',');
      });
      if (rows.length === 0) {
        showToast('Nenhuma transa\u00e7\u00e3o corresponde aos filtros ativos \u2014 nada exportado.', 'error');
        return;
      }
      const csv = '\ufeff' + [header.join(','), ...rows].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacoes_laudus_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${rows.length} transa\u00e7${rows.length === 1 ? '\u00e3o exportada' : '\u00f5es exportadas'} (conforme filtros ativos).`, 'success');
    } catch (err) {
      logger.error('Erro ao exportar:', err);
      showToast('Falha ao exportar CSV.', 'error');
    } finally { setExporting(false); }
  }, [showToast, filterPeriod, filterStatus, filterMethod, filterType, filterInterval, filterNf, search]);

  useEffect(() => { loadStats(); loadFirstPage(); loadNfAndFees(); }, [loadStats, loadFirstPage, loadNfAndFees]);

  // ── Filtering ── (mesmo predicado usado pelo export CSV, ver matchesTxFilters)
  const activeFilters: TxFilters = {
    period: filterPeriod, status: filterStatus, method: filterMethod,
    type: filterType, interval: filterInterval, nf: filterNf, search,
  };
  const filtered = allTransactions.filter(t => {
    const nfStatus = nfMap[t.id] === 'issued' ? 'issued' : 'pending';
    return matchesTxFilters(t, nfStatus, activeFilters);
  });

  const filteredRevenue = filtered
    .filter(t => t.status === 'paid')
    .reduce((a, t) => a + (t.amount || 0), 0);

  const hasActiveFilters = filterStatus !== 'all' || filterMethod !== 'all' ||
    filterType !== 'all' || filterInterval !== 'all' || filterNf !== 'all' || filterPeriod !== 30 || search;

  const clearFilters = () => {
    setSearch(''); setFilterStatus('all'); setFilterMethod('all');
    setFilterType('all'); setFilterInterval('all'); setFilterNf('all'); setFilterPeriod(30);
  };

  if (loading) return <Spinner />;

  const totalRevenue = stats?.totalRevenue ?? 0;
  const paidCount    = stats?.paidCount    ?? 0;
  const pixCount     = stats?.pixCount     ?? 0;
  const ccCount      = stats?.ccCount      ?? 0;
  const manualCount  = stats?.manualCount  ?? 0;
  const pct = (n: number) => (paidCount ? Math.round((n / paidCount) * 100) : 0);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest flex items-center gap-2">
            <FileText size={15} className="text-indigo-500" /> Histórico Financeiro
          </h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">
            Todas as transações, assinaturas, add-ons e cobranças do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCsv} disabled={exporting}
            className="flex items-center gap-1.5 h-9 px-3 bg-white border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all disabled:opacity-50">
            {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} CSV
          </button>
          <button onClick={recalcStats} disabled={recalculating}
            className="flex items-center gap-1.5 h-9 px-3 bg-white border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all disabled:opacity-50">
            <RefreshCcw size={11} className={recalculating ? 'animate-spin' : ''} /> Recalcular
          </button>
          <button onClick={() => { loadStats(); loadFirstPage(); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-white border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all">
            <RefreshCw size={11} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      {!stats ? (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <FileText size={13} className="shrink-0 mt-0.5" />
          <span>Métricas não semeadas. Clique em <strong>Recalcular</strong> para calcular a partir das transações.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Receita Acumulada', value: money(totalRevenue), sub: `${paidCount} pagamentos`, cls: 'from-emerald-500 to-teal-600' },
            { label: 'PIX',              value: String(pixCount),     sub: `${pct(pixCount)}% das vendas`, cls: 'from-green-500 to-emerald-600' },
            { label: 'Cartão',           value: String(ccCount),      sub: `${pct(ccCount)}% das vendas`,  cls: 'from-blue-500 to-indigo-600' },
            { label: 'Manual (Admin)',   value: String(manualCount),  sub: 'Atribuições diretas',          cls: 'from-ink-600 to-ink-800' },
          ].map(k => (
            <div key={k.label} className={classNames('rounded-2xl p-4 text-white shadow-sm bg-gradient-to-br', k.cls)}>
              <div className="text-[9px] font-black uppercase tracking-wider text-white/80">{k.label}</div>
              <div className="text-xl font-black mt-1">{k.value}</div>
              <div className="text-[10px] text-white/70 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters bar ── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por e-mail ou descrição..."
              className="input h-9 pl-8 pr-3 text-xs w-full"
            />
          </div>

          {/* Period */}
          <div className="relative">
            <select value={filterPeriod} onChange={e => setFilterPeriod(Number(e.target.value))}
              className="input h-9 pl-3 pr-7 text-xs appearance-none cursor-pointer min-w-[110px]">
              {PERIOD_OPTS.map(o => (
                <option key={o.days} value={o.days}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {/* Status */}
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="input h-9 pl-3 pr-7 text-xs appearance-none cursor-pointer min-w-[110px]">
              <option value="all">Todos status</option>
              <option value="paid">Pago</option>
              <option value="failed">Falhou</option>
              <option value="refunded">Reembolsado</option>
              <option value="pending">Pendente</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {/* Method */}
          <div className="relative">
            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
              className="input h-9 pl-3 pr-7 text-xs appearance-none cursor-pointer min-w-[110px]">
              <option value="all">Todos métodos</option>
              <option value="pix">PIX</option>
              <option value="credit_card">Cartão</option>
              <option value="manual">Manual</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {/* Interval */}
          <div className="relative">
            <select value={filterInterval} onChange={e => setFilterInterval(e.target.value)}
              className="input h-9 pl-3 pr-7 text-xs appearance-none cursor-pointer min-w-[120px]">
              <option value="all">Todos intervalos</option>
              <option value="month">Mensal</option>
              <option value="semester">Semestral</option>
              <option value="year">Anual</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {/* Nota Fiscal */}
          <div className="relative">
            <select value={filterNf} onChange={e => setFilterNf(e.target.value)}
              className="input h-9 pl-3 pr-7 text-xs appearance-none cursor-pointer min-w-[110px]">
              <option value="all">Todas NF</option>
              <option value="issued">NF emitida</option>
              <option value="pending">NF pendente</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 h-9 px-3 rounded-xl border border-rose-200 text-rose-600 bg-rose-50 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all">
              <X size={11} /> Limpar
            </button>
          )}
        </div>

        {/* Filtered subtotal */}
        <div className="flex items-center justify-between text-[11px] text-ink-500 pt-1 border-t border-ink-50">
          <span><strong className="text-ink-800">{filtered.length}</strong> transações exibidas</span>
          {hasActiveFilters && (
            <span>Receita filtrada: <strong className="text-emerald-700">{money(filteredRevenue)}</strong></span>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">Nenhuma transação encontrada.</p>
            <p className="text-xs mt-0.5">Ajuste os filtros ou aguarde novos pagamentos via webhook.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ink-50/70 border-b border-ink-100 text-[9px] font-black uppercase text-ink-400 tracking-wider">
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Intervalo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Método</th>
                  <th className="px-4 py-3 text-right">Status</th>
                  <th className="px-4 py-3 text-center">NF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {filtered.map((t) => {
                  const dateStr = t.timestamp
                    ? new Date(t.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    : '—';
                  const typeCfg   = TYPE_CFG[t.type || '']   || { label: t.type || '—', cls: 'bg-ink-50 text-ink-500 border-ink-100' };
                  const statusCfg = STATUS_CFG[t.status || ''] || { label: t.status || '—', cls: 'bg-ink-50 text-ink-500 border-ink-100' };

                  const methodIcon = t.paymentMethod === 'pix' ? (
                    <QrCode size={11} className="text-emerald-600 shrink-0" />
                  ) : t.paymentMethod === 'credit_card' ? (
                    <CreditCard size={11} className="text-blue-600 shrink-0" />
                  ) : (
                    <Wallet size={11} className="text-ink-500 shrink-0" />
                  );

                  const intervalLabel = INTERVAL_LABELS[t.interval || ''] || t.interval || '—';
                  const installHint   = (t.installments && t.installments > 1)
                    ? <span className="ml-1 text-[8px] bg-amber-50 text-amber-700 border border-amber-100 rounded px-1 font-black">{t.installments}×</span>
                    : null;

                  return (
                    <tr key={t.id} className="hover:bg-ink-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[10px] text-ink-500 whitespace-nowrap">{dateStr}</td>
                      <td className="px-4 py-3 font-medium text-ink-800 max-w-[180px] truncate">{t.userEmail || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={classNames('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border', typeCfg.cls)}>
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-ink-900 max-w-[200px] truncate">{t.description || '—'}</td>
                      <td className="px-4 py-3 text-ink-600 font-medium whitespace-nowrap">
                        {intervalLabel}{installHint}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-ink-950 whitespace-nowrap">
                        {money(t.amount || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {methodIcon}
                          <span className="text-[10px] font-bold text-ink-600">
                            {METHOD_LABEL[t.paymentMethod || ''] || t.paymentMethod || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={classNames('px-1.5 py-0.5 rounded text-[8px] font-black uppercase border', statusCfg.cls)}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.status === 'paid' ? (
                          <button
                            onClick={() => toggleNfStatus(t.id)}
                            title="Clique para alternar status de nota fiscal"
                            className={classNames(
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border transition-colors',
                              nfMap[t.id] === 'issued'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            )}
                          >
                            <Receipt size={9} />
                            {nfMap[t.id] === 'issued' ? 'Emitida' : 'Pendente'}
                          </button>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div className="border-t border-ink-100 p-4 text-center">
            <button onClick={loadMore} disabled={loadingMore}
              className="inline-flex items-center gap-1.5 h-9 px-5 bg-ink-50 hover:bg-ink-100 border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
              {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Carregar mais {TX_PAGE}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

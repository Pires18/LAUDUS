import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { firestore } from '../../../../lib/firebase';
import { useApp } from '../../../../store/app';
import { logger } from '../../../../utils/logger';
import { classNames } from '../../../../utils/format';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { Spinner } from './Spinner';

const TX_PAGE = 100;
type FinanceStats = { totalRevenue: number; paidCount: number; pixCount: number; ccCount: number; manualCount: number };

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef<any>(null);
  const { showToast } = useApp();

  // Métricas acumuladas vêm do agregado mantido pelo webhook (global_config/
  // finance_stats) — não varremos mais a coleção inteira só para somar receita.
  const loadStats = useCallback(async () => {
    try {
      const s = await getDoc(doc(firestore, 'global_config', 'finance_stats'));
      setStats(s.exists() ? (s.data() as FinanceStats) : null);
    } catch (err) {
      logger.error('Erro ao carregar métricas financeiras:', err);
    }
  }, []);

  // Tabela: só as transações mais recentes (paginadas), não a coleção toda.
  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc'), limit(TX_PAGE)));
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === TX_PAGE);
    } catch (err) {
      logger.error('Erro ao carregar transações:', err);
      showToast('Erro ao carregar transações.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadMore = useCallback(async () => {
    if (!lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc'), startAfter(lastDocRef.current), limit(TX_PAGE)));
      setTransactions(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === TX_PAGE);
    } catch (err) {
      logger.error('Erro ao carregar mais transações:', err);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  // Varredura completa ÚNICA para (re)semear o agregado — cobre backfill de
  // transações antigas e corrige qualquer drift. Ação explícita do admin.
  const recalcStats = useCallback(async () => {
    setRecalculating(true);
    try {
      const snap = await getDocs(collection(firestore, 'transactions'));
      const paid = snap.docs.map(d => d.data() as any).filter(t => t.status === 'paid');
      const agg = {
        totalRevenue: paid.reduce((a, t) => a + (t.amount || 0), 0),
        paidCount: paid.length,
        pixCount: paid.filter(t => t.paymentMethod === 'pix').length,
        ccCount: paid.filter(t => t.paymentMethod === 'credit_card').length,
        manualCount: paid.filter(t => t.paymentMethod === 'manual').length,
        otherCount: paid.filter(t => !['pix', 'credit_card', 'manual'].includes(t.paymentMethod)).length,
        updatedAt: Date.now(),
      };
      await setDoc(doc(firestore, 'global_config', 'finance_stats'), agg, { merge: true });
      setStats(agg);
      showToast('Métricas financeiras recalculadas.', 'success');
    } catch (err) {
      logger.error('Erro ao recalcular métricas financeiras:', err);
      showToast('Falha ao recalcular métricas.', 'error');
    } finally {
      setRecalculating(false);
    }
  }, [showToast]);

  const [exporting, setExporting] = useState(false);
  // Exporta TODAS as transações (histórico completo) em CSV — ação explícita.
  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const snap = await getDocs(query(collection(firestore, 'transactions'), orderBy('timestamp', 'desc')));
      const cell = (v: unknown) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ['Data/Hora', 'Usuário', 'Tipo', 'Descrição', 'Valor (R$)', 'Método', 'Status'];
      const rows = snap.docs.map(d => {
        const t = d.data() as any;
        return [
          t.timestamp ? new Date(t.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '',
          t.userEmail || '',
          t.type || '',
          t.description || '',
          (t.amount || 0).toFixed(2),
          t.paymentMethod || '',
          t.status || '',
        ].map(cell).join(',');
      });
      const csv = '﻿' + [header.join(','), ...rows].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacoes_laudus_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Erro ao exportar transações:', err);
      showToast('Falha ao exportar CSV.', 'error');
    } finally {
      setExporting(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStats();
    loadFirstPage();
  }, [loadStats, loadFirstPage]);

  if (loading) return <Spinner />;

  const totalRevenue = stats?.totalRevenue ?? 0;
  const paidCount = stats?.paidCount ?? 0;
  const pixCount = stats?.pixCount ?? 0;
  const ccCount = stats?.ccCount ?? 0;
  const manualCount = stats?.manualCount ?? 0;
  const pct = (n: number) => (paidCount ? Math.round((n / paidCount) * 100) : 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-ink-900 uppercase tracking-widest">Histórico Financeiro</h3>
          <p className="text-[11px] text-ink-500 font-medium mt-0.5">Veja todas as transações, assinaturas e compras de add-ons realizadas no sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            title="Exporta todo o histórico de transações em CSV"
            className="flex items-center gap-1.5 h-10 px-4 bg-white border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Exportar CSV
          </button>
          <button
            onClick={recalcStats}
            disabled={recalculating}
            title="Recalcula o faturamento acumulado varrendo todas as transações (use após backfill)."
            className="flex items-center gap-1.5 h-10 px-4 bg-white border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={recalculating ? 'animate-spin' : ''} /> Recalcular métricas
          </button>
          <button
            onClick={() => { loadStats(); loadFirstPage(); }}
            className="flex items-center gap-1.5 h-10 px-4 bg-white border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ink-50 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {!stats && (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2.5">
          <FileText size={13} className="shrink-0 mt-0.5" />
          <span>As métricas acumuladas ainda não foram semeadas. Clique em <strong>Recalcular métricas</strong> uma vez para calcular o faturamento a partir das transações existentes.</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm">
          <div className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Faturamento Acumulado</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div className="text-[10px] text-ink-400 mt-0.5">Apenas transações pagas</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm">
          <div className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Vendas via PIX</div>
          <div className="text-2xl font-black text-ink-900 mt-1">{pixCount}</div>
          <div className="text-[10px] text-ink-400 mt-0.5">{pct(pixCount)}% das vendas pagas</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm">
          <div className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Vendas via Cartão</div>
          <div className="text-2xl font-black text-ink-900 mt-1">{ccCount}</div>
          <div className="text-[10px] text-ink-400 mt-0.5">{pct(ccCount)}% das vendas pagas</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-ink-100 shadow-sm">
          <div className="text-[9px] font-black text-ink-400 uppercase tracking-widest">Vendas Manuais</div>
          <div className="text-2xl font-black text-ink-900 mt-1">{manualCount}</div>
          <div className="text-[10px] text-ink-400 mt-0.5">Atribuições diretas do admin</div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-16 text-ink-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">Nenhuma transação registrada no banco.</p>
            <p className="text-xs mt-0.5">Transações aparecerão à medida que os checkouts forem confirmados via webhook.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ink-50/50 border-b border-ink-100 text-[10px] font-black uppercase text-ink-400 tracking-wider">
                  <th className="px-5 py-3.5">Data / Hora</th>
                  <th className="px-5 py-3.5">Usuário</th>
                  <th className="px-5 py-3.5">Descrição</th>
                  <th className="px-5 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5 text-center">Método</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {transactions.map((t: any) => {
                  const dateStr = t.timestamp
                    ? new Date(t.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                    : '—';
                  
                  const statusColors: Record<string, string> = {
                    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    failed: 'bg-rose-50 text-rose-700 border-rose-200',
                    refunded: 'bg-amber-50 text-amber-700 border-amber-200',
                  };
                  const statusLabel: Record<string, string> = {
                    paid: 'Pago',
                    failed: 'Falhou',
                    refunded: 'Reembolsado',
                  };

                  const methodLabel: Record<string, string> = {
                    pix: 'PIX',
                    credit_card: 'Cartão',
                    manual: 'Manual',
                  };

                  return (
                    <tr key={t.id} className="hover:bg-ink-50/20 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[10px] text-ink-500">{dateStr}</td>
                      <td className="px-5 py-3.5 font-semibold text-ink-900">{t.userEmail}</td>
                      <td className="px-5 py-3.5 font-bold text-indigo-700">{t.description || 'Assinatura'}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-ink-900">
                        R$ {(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-[10px] text-ink-600">
                        {methodLabel[t.paymentMethod] || t.paymentMethod || 'Manual'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={classNames(
                          'px-2 py-0.5 rounded text-[9px] font-black uppercase border',
                          statusColors[t.status] || 'bg-ink-100 text-ink-500'
                        )}>
                          {statusLabel[t.status] || t.status || 'Pendente'}
                        </span>
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
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 h-9 px-5 bg-ink-50 hover:bg-ink-100 border border-ink-200 text-ink-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Carregar mais {TX_PAGE}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

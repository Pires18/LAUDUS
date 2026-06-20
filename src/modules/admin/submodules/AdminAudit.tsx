import { useState } from 'react';
import { usePaginatedCollection, orderBy } from '../../../hooks/useFirestore';
import { AuditLog } from '../../../types';
import {
  Search, History, Download,
  Calendar, User, Box, Eye, ChevronDown
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { Modal } from '../../../components/Modal';

export function AdminAudit() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, loading, loadMore, hasMore } = usePaginatedCollection<AuditLog>('audit_logs', {
    isGlobal: true,
    initialLimit: 100,
    constraints: [orderBy('timestamp', 'desc')]
  });

  const filtered = logs
    .filter(l => {
      const matchesSearch =
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.details?.toLowerCase().includes(search.toLowerCase()) ||
        l.userName?.toLowerCase().includes(search.toLowerCase());

      const matchesModule = moduleFilter === 'all' || l.module === moduleFilter;

      return matchesSearch && matchesModule;
    });

  const modules = Array.from(new Set(logs.map(l => l.module))).filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-ink-900">Histórico de Auditoria</h3>
          <p className="text-sm text-ink-500">Rastreabilidade forense de todas as ações críticas no ecossistema.</p>
        </div>
        <button className="btn-ghost border border-ink-100 group">
          <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          Exportar Relatório (CSV)
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-ink-100 bg-ink-50/20 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por ação, usuário ou conteúdo..."
              className="w-full h-14 pl-12 pr-4 bg-white border border-ink-100 rounded-2xl focus:ring-2 focus:ring-brand-500 transition-all text-sm font-medium"
            />
          </div>
          
          <div className="flex gap-2">
            <select 
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="h-14 bg-white border border-ink-100 rounded-2xl px-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Todos os Módulos</option>
              {modules.map(m => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-ink-50/50 text-[10px] font-black uppercase tracking-widest text-ink-400 border-b border-ink-100">
                <th className="px-6 py-5">Timestamp</th>
                <th className="px-6 py-5">Usuário Responsável</th>
                <th className="px-6 py-5">Ação Realizada</th>
                <th className="px-6 py-5">Módulo</th>
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6"><div className="h-8 bg-ink-50 rounded-xl w-full" /></td>
                  </tr>
                ))
              ) : filtered.map((log) => (
                <tr key={log.id} className="hover:bg-ink-50/30 transition-colors group">
                  <td className="px-6 py-5 text-xs font-mono text-ink-500">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} />
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center text-ink-500 text-[10px] font-black">
                        {log.userName?.charAt(0) || <User size={14} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-ink-900 leading-none">{log.userName}</p>
                        <p className="text-[9px] text-ink-400 font-mono mt-1">{log.userId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={classNames(
                      "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      log.action.includes('DELETE') ? "bg-red-50 text-red-700 border-red-100" :
                      log.action.includes('UPDATE') ? "bg-blue-50 text-blue-700 border-blue-100" :
                      "bg-brand-50 text-brand-700 border-brand-100"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-[10px] font-black text-ink-500 uppercase tracking-widest">
                      <Box size={12} className="text-ink-300" />
                      {log.module}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="p-2 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-32 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-ink-50 flex items-center justify-center mx-auto mb-6 border border-ink-100">
                      <History size={40} className="text-ink-200" />
                    </div>
                    <p className="text-ink-400 font-black text-lg">Nenhum rastro encontrado.</p>
                    <p className="text-sm text-ink-300 mt-1">O sistema está limpo. Tente outros filtros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !search && moduleFilter === 'all' && (
          <div className="p-4 border-t border-ink-100 flex justify-center">
            <button
              onClick={loadMore}
              className="flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-ink-600 bg-ink-50 hover:bg-ink-100 rounded-2xl border border-ink-200 transition-all"
            >
              <ChevronDown size={14} />
              Carregar mais registros
            </button>
          </div>
        )}
      </div>

      {/* Forensic Detail Modal */}
      <Modal
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title={`Detalhamento Forense #${selectedLog?.id.slice(0, 8)}`}
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            <p className="text-sm text-ink-500">Ação executada em {new Date(selectedLog.timestamp).toLocaleString('pt-BR')}.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-ink-50/50 p-6 rounded-2xl border border-ink-100">
                 <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <User size={14} /> Ator
                 </p>
                 <p className="text-sm font-black text-ink-900">{selectedLog.userName}</p>
                 <p className="text-[10px] text-ink-400 font-mono mt-1">{selectedLog.userId}</p>
              </div>
              <div className="bg-ink-50/50 p-6 rounded-2xl border border-ink-100">
                 <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <Box size={14} /> Localização
                 </p>
                 <p className="text-sm font-black text-ink-900">{selectedLog.module}</p>
                 <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest mt-1">{selectedLog.action}</p>
              </div>
            </div>

            <div>
               <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3">Dados da Operação</p>
               <div className="bg-ink-900 rounded-2xl p-6 overflow-hidden">
                  <pre className="text-xs text-brand-50 font-mono whitespace-pre-wrap leading-relaxed">
                    {selectedLog.details}
                  </pre>
               </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

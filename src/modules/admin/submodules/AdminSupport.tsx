import { useState, useEffect, useRef } from 'react';
import { onSupportTicketsChange, addSupportMessage, updateGlobalItem } from '../../../store/db';
import { useAuth } from '../../../hooks/useAuth';
import { useApp } from '../../../store/app';
import { useCollection, orderBy } from '../../../hooks/useFirestore';
import { SupportTicket, SupportMessage } from '../../../types';
import { 
  MessageSquare, Clock, CheckCircle2, 
  AlertCircle, Search, MoreVertical, 
  Send, Loader2, User, Box, ArrowLeft,
  XCircle, Filter
} from 'lucide-react';
import { classNames } from '../../../utils/format';

export function AdminSupport() {
  const { user: adminUser } = useAuth();
  const { showToast } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const { data: tickets, loading, error } = useCollection<SupportTicket>('support_tickets', { 
    isGlobal: true,
    constraints: [orderBy('updatedAt', 'desc')]
  });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicketId, tickets]);

  const filtered = tickets.filter(t => {
    const matchesSearch = 
      t.subject.toLowerCase().includes(search.toLowerCase()) || 
      t.userName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  async function handleSendMessage() {
    if (!newMessage || !selectedTicket || !adminUser) return;
    setIsSending(true);
    try {
      await addSupportMessage(selectedTicket.id, {
        senderId: adminUser.uid,
        senderName: `ADMIN: ${adminUser.displayName || 'Suporte'}`,
        text: newMessage
      });
      // Se estava como open, move para pending ao responder
      if (selectedTicket.status === 'open') {
        await updateGlobalItem('support_tickets', selectedTicket.id, { status: 'pending', updatedAt: Date.now() });
      }
      setNewMessage('');
    } catch {
      showToast('Erro ao enviar resposta', 'error');
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpdateStatus(status: SupportTicket['status']) {
    if (!selectedTicket) return;
    try {
      await updateGlobalItem('support_tickets', selectedTicket.id, { status, updatedAt: Date.now() });
      showToast(`Status alterado para ${status}`, 'success');
    } catch {
      showToast('Erro ao atualizar status', 'error');
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] bg-white rounded-[2.5rem] border border-ink-100 shadow-premium overflow-hidden animate-fade-in">
      
      {/* Sidebar: Ticket List */}
      <aside className={classNames(
        "w-full lg:w-[400px] border-r border-ink-100 flex flex-col transition-all",
        selectedTicketId && "hidden lg:flex"
      )}>
        <div className="p-8 border-b border-ink-100">
           <h3 className="text-xl font-black text-ink-900 mb-6">Central de Atendimento</h3>
           <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar chamados..."
                  className="w-full h-12 pl-12 pr-4 bg-ink-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 text-sm font-medium"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {(['all', 'open', 'pending', 'resolved'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={classNames(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                      statusFilter === s 
                        ? "bg-ink-900 text-white border-ink-900 shadow-md" 
                        : "bg-white text-ink-400 border-ink-100 hover:border-brand-300"
                    )}
                  >
                    {s === 'all' ? 'Todos' : s}
                  </button>
                ))}
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-ink-50">
          {loading ? (
             [1, 2, 3].map(i => <div key={i} className="p-8 animate-pulse"><div className="h-16 bg-ink-50 rounded-2xl" /></div>)
          ) : error ? (
            <div className="p-12 text-center">
               <AlertCircle size={40} className="mx-auto text-red-400 mb-4" />
               <p className="text-sm text-ink-900 font-black">Erro de Acesso</p>
               <p className="text-xs text-ink-500 mt-2">Você precisa atualizar as regras de segurança no Console do Firebase para visualizar chamados globais.</p>
            </div>
          ) : filtered.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
              className={classNames(
                "w-full p-8 text-left transition-all hover:bg-ink-50/50 relative group",
                selectedTicketId === ticket.id ? "bg-brand-50/30" : "bg-white"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                   <span className={classNames(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      ticket.status === 'open' ? "bg-red-50 text-red-600 border-red-100" :
                      ticket.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-emerald-50 text-emerald-600 border-emerald-100"
                    )}>
                      {ticket.status}
                   </span>
                   <span className={classNames(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      ticket.priority === 'high' ? "bg-red-900 text-white border-red-900" :
                      ticket.priority === 'medium' ? "bg-blue-50 text-blue-600 border-blue-100" :
                      "bg-slate-50 text-slate-400 border-slate-100"
                    )}>
                      {ticket.priority}
                   </span>
                </div>
                <span className="text-[10px] text-ink-300 font-bold">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
              </div>
              <h4 className="text-sm font-black text-ink-900 group-hover:text-brand-700 transition-colors">{ticket.subject}</h4>
              <p className="text-xs text-ink-500 mt-1 flex items-center gap-2">
                <User size={12} /> {ticket.userName}
              </p>
              {selectedTicketId === ticket.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600" />
              )}
            </button>
          ))}
          {filtered.length === 0 && !loading && (
             <div className="p-12 text-center">
                <Box size={40} className="mx-auto text-ink-100 mb-4" />
                <p className="text-sm text-ink-400 font-bold">Nenhum chamado nesta categoria.</p>
             </div>
          )}
        </div>
      </aside>

      {/* Main Area: Chat Interface */}
      <main className="flex-1 flex flex-col bg-white">
        {selectedTicket ? (
          <>
            <header className="p-8 border-b border-ink-100 flex items-center justify-between bg-ink-50/10">
               <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedTicketId(null)} className="lg:hidden p-2 text-ink-400 hover:bg-ink-100 rounded-xl">
                    <ArrowLeft size={24} />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-ink-900">{selectedTicket.subject}</h3>
                    <p className="text-xs text-ink-500 font-medium flex items-center gap-2 mt-1">
                      Protocolo: <span className="font-mono text-ink-900">#{selectedTicket.id.slice(-6).toUpperCase()}</span>
                      <span className="w-1 h-1 bg-ink-200 rounded-full" />
                      Usuário: <span className="text-brand-600 font-bold">{selectedTicket.userName}</span>
                    </p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="flex p-1 bg-ink-100 rounded-2xl border border-ink-200">
                     <button 
                      onClick={() => handleUpdateStatus('open')}
                      className={classNames("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all", selectedTicket.status === 'open' ? "bg-red-600 text-white" : "text-ink-400 hover:text-ink-600")}
                     >ABERTO</button>
                     <button 
                      onClick={() => handleUpdateStatus('pending')}
                      className={classNames("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all", selectedTicket.status === 'pending' ? "bg-amber-500 text-white" : "text-ink-400 hover:text-ink-600")}
                     >PENDENTE</button>
                     <button 
                      onClick={() => handleUpdateStatus('resolved')}
                      className={classNames("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all", selectedTicket.status === 'resolved' ? "bg-emerald-600 text-white" : "text-ink-400 hover:text-ink-600")}
                     >RESOLVIDO</button>
                  </div>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-50/30">
               {/* User Initial Message */}
               <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-ink-100 shadow-sm flex items-center justify-center shrink-0">
                    <User size={24} className="text-ink-300" />
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] rounded-tl-none border border-ink-100 shadow-premium flex-1 max-w-2xl">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 mb-2">Mensagem Inicial</p>
                     <p className="text-sm text-ink-900 leading-relaxed font-medium">{selectedTicket.message}</p>
                     <p className="text-[9px] text-ink-400 mt-4 font-bold uppercase tracking-widest">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
               </div>

               {/* Conversation Thread */}
               {selectedTicket.messages?.map((msg, idx) => {
                 const isMe = msg.senderId === adminUser?.uid;
                 return (
                   <div key={idx} className={classNames("flex gap-5", isMe ? "flex-row-reverse" : "flex-row")}>
                      <div className={classNames(
                        "w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center shrink-0 text-xs font-black border",
                        isMe ? "bg-ink-900 text-white border-ink-900" : "bg-white text-ink-400 border-ink-100"
                      )}>
                        {isMe ? 'ADM' : msg.senderName.charAt(0)}
                      </div>
                      <div className={classNames(
                        "p-6 rounded-[2.5rem] max-w-xl shadow-sm border",
                        isMe ? "bg-brand-600 text-white border-brand-500 rounded-tr-none" : "bg-white text-ink-900 border-ink-100 rounded-tl-none"
                      )}>
                        {!isMe && <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-ink-400">{msg.senderName}</p>}
                        <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                        <p className={classNames("text-[8px] mt-3 font-bold uppercase tracking-widest", isMe ? "text-white/60" : "text-ink-300")}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                   </div>
                 );
               })}
               <div ref={chatEndRef} />
            </div>

            {selectedTicket.status !== 'resolved' && (
              <footer className="p-8 border-t border-ink-100 bg-white">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <input 
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Digite sua resposta administrativa..."
                      className="w-full h-16 bg-ink-50 border-none rounded-[2rem] px-8 text-sm focus:ring-2 focus:ring-brand-500 transition-all font-medium"
                    />
                  </div>
                  <button 
                    onClick={handleSendMessage}
                    disabled={isSending || !newMessage}
                    className="w-16 h-16 bg-ink-900 text-white rounded-[2rem] flex items-center justify-center hover:bg-brand-600 transition-all shadow-xl disabled:opacity-50"
                  >
                    {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                  </button>
                </div>
              </footer>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-ink-200 space-y-6">
             <div className="w-32 h-32 rounded-[3rem] bg-ink-50 flex items-center justify-center border border-ink-50 shadow-inner">
                <MessageSquare size={64} />
             </div>
             <div className="text-center">
               <p className="font-black text-2xl text-ink-400">Suporte LAUD.US</p>
               <p className="text-sm text-ink-300 font-medium max-w-xs mx-auto mt-2">Selecione um chamado na lista lateral para iniciar o atendimento.</p>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

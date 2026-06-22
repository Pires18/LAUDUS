import { useState, useEffect, useRef } from 'react';
import { addSupportMessage, updateGlobalItem, clearAllSupportTickets } from '../../../store/db';
import { useAuth } from '../../../hooks/useAuth';
import { useApp } from '../../../store/app';
import { useCollection, orderBy } from '../../../hooks/useFirestore';
import { SupportTicket } from '../../../types';
import {
  MessageSquare, AlertCircle, Search,
  Send, Loader2, User, Box, ArrowLeft, Trash2,
  Star, Info, Plus, CalendarDays, Hospital
} from 'lucide-react';
import { classNames } from '../../../utils/format';
import { useConfirm } from '../../../hooks/useConfirm';

export function AdminSupport() {
  const { user: adminUser } = useAuth();
  const { showToast } = useApp();
  const confirm = useConfirm();
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
  const [isClearing, setIsClearing] = useState(false);
  const [adminNoteText, setAdminNoteText] = useState('');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(true);

  async function handleClearAllTickets() {
    const confirmed = await confirm({
      title: 'Excluir Todo o Histórico',
      message: 'Você tem certeza absoluta de que deseja excluir DEFINITIVAMENTE todo o histórico de chamados de suporte? Esta ação é irreversível.',
      confirmLabel: 'Excluir Tudo',
      variant: 'danger',
    });
    if (!confirmed) return;
    
    setIsClearing(true);
    try {
      await clearAllSupportTickets();
      setSelectedTicketId(null);
      showToast('Todo o histórico de chamados foi excluído com sucesso.', 'success');
    } catch {
      showToast('Erro ao limpar histórico de suporte.', 'error');
    } finally {
      setIsClearing(false);
    }
  }

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

  async function handleAddAdminNote() {
    if (!adminNoteText || !selectedTicket || !adminUser) return;
    const newNote = {
      timestamp: Date.now(),
      author: adminUser.displayName || adminUser.email || 'Admin',
      text: adminNoteText
    };
    const currentNotes = selectedTicket.adminNotes || [];
    try {
      await updateGlobalItem('support_tickets', selectedTicket.id, {
        adminNotes: [...currentNotes, newNote],
        updatedAt: Date.now()
      });
      setAdminNoteText('');
      showToast('Nota administrativa adicionada.', 'success');
    } catch {
      showToast('Erro ao salvar nota administrativa.', 'error');
    }
  }

  const openCount = tickets.filter(t => t.status === 'open').length;
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
  const highPriorityCount = tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden animate-fade-in">
      
      {/* Sidebar: Ticket List */}
      <aside className={classNames(
        "w-full lg:w-[400px] border-r border-ink-100 flex flex-col transition-all",
        selectedTicketId && "hidden lg:flex"
      )}>
        <div className="p-5 border-b border-ink-100">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-ink-900">Central de Atendimento</h3>
              {tickets.length > 0 && (
                <button
                  onClick={handleClearAllTickets}
                  disabled={isClearing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-650 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 transition-all active:scale-95 disabled:opacity-50"
                  title="Excluir Todo o Histórico de Suporte"
                >
                  {isClearing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  <span>Limpar Tudo</span>
                </button>
              )}
           </div>

           {/* Dashboard de Métricas */}
           <div className="grid grid-cols-4 gap-2 mb-4 bg-ink-50/50 p-2.5 rounded-2xl border border-ink-100">
             <div className="text-center">
               <p className="text-[8px] font-black text-red-650 uppercase tracking-wider">Abertos</p>
               <p className="text-sm font-black text-ink-900 mt-0.5">{openCount}</p>
             </div>
             <div className="text-center border-l border-ink-100">
               <p className="text-[8px] font-black text-amber-650 uppercase tracking-wider">Pendentes</p>
               <p className="text-sm font-black text-ink-900 mt-0.5">{pendingCount}</p>
             </div>
             <div className="text-center border-l border-ink-100">
               <p className="text-[8px] font-black text-emerald-650 uppercase tracking-wider">Resolvidos</p>
               <p className="text-sm font-black text-ink-900 mt-0.5">{resolvedCount}</p>
             </div>
             <div className="text-center border-l border-ink-100">
               <p className="text-[8px] font-black text-purple-650 uppercase tracking-wider">Alta Pri.</p>
               <p className="text-sm font-black text-ink-900 mt-0.5">{highPriorityCount}</p>
             </div>
           </div>

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
             [1, 2, 3].map(i => <div key={i} className="p-5 animate-pulse"><div className="h-16 bg-ink-50 rounded-2xl" /></div>)
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
                "w-full p-5 text-left transition-all hover:bg-ink-50/50 relative group",
                selectedTicketId === ticket.id ? "bg-brand-50/30" : "bg-white"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-1.5 flex-wrap">
                   <span className={classNames(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      ticket.status === 'open' ? "bg-red-50 text-red-650 border-red-100" :
                      ticket.status === 'pending' ? "bg-amber-50 text-amber-650 border-amber-100" :
                      "bg-emerald-50 text-emerald-650 border-emerald-100"
                    )}>
                      {ticket.status}
                   </span>
                   <span className={classNames(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      ticket.priority === 'high' ? "bg-red-950 text-white border-red-900" :
                      ticket.priority === 'medium' ? "bg-blue-50 text-blue-600 border-blue-100" :
                      "bg-ink-50 text-ink-400 border-ink-100"
                    )}>
                      {ticket.priority}
                   </span>
                   {ticket.category && (
                     <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-50 border border-indigo-100 text-indigo-600">
                       {ticket.category === 'ia_help' ? 'IA' :
                        ticket.category === 'billing' ? 'Financeiro' :
                        ticket.category === 'pacs_setup' ? 'PACS' :
                        ticket.category === 'technical_issue' ? 'Técnico' : 'Outro'}
                     </span>
                   )}
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
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-full">
            {/* Chat Column */}
            <div className="flex-1 flex flex-col min-w-0 h-full border-r border-ink-100">
               <header className="p-5 border-b border-ink-100 flex items-center justify-between bg-ink-50/10">
                  <div className="flex items-center gap-4">
                     <button onClick={() => setSelectedTicketId(null)} className="lg:hidden p-2 text-ink-400 hover:bg-ink-100 rounded-xl">
                       <ArrowLeft size={24} />
                     </button>
                     <div>
                       <div className="flex items-center gap-2 flex-wrap">
                         <h3 className="text-xl font-black text-ink-900">{selectedTicket.subject}</h3>
                         {selectedTicket.category && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-indigo-50 border border-indigo-100 text-indigo-600">
                             {selectedTicket.category === 'ia_help' ? 'IA' :
                              selectedTicket.category === 'billing' ? 'Financeiro' :
                              selectedTicket.category === 'pacs_setup' ? 'PACS' :
                              selectedTicket.category === 'technical_issue' ? 'Técnico' : 'Outro'}
                           </span>
                         )}
                       </div>
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
                         className={classNames("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all", selectedTicket.status === 'open' ? "bg-red-650 text-white" : "text-ink-450 hover:text-ink-600")}
                        >ABERTO</button>
                        <button 
                         onClick={() => handleUpdateStatus('pending')}
                         className={classNames("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all", selectedTicket.status === 'pending' ? "bg-amber-500 text-white" : "text-ink-450 hover:text-ink-600")}
                        >PENDENTE</button>
                        <button 
                         onClick={() => handleUpdateStatus('resolved')}
                         className={classNames("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all", selectedTicket.status === 'resolved' ? "bg-emerald-600 text-white" : "text-ink-450 hover:text-ink-600")}
                        >RESOLVIDO</button>
                     </div>
                  </div>
               </header>

               <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-ink-50/30">
                  {/* User Initial Message */}
                  <div className="flex gap-5">
                     <div className="w-12 h-12 rounded-2xl bg-white border border-ink-100 shadow-sm flex items-center justify-center shrink-0">
                       <User size={24} className="text-ink-300" />
                     </div>
                     <div className="bg-white p-5 rounded-2xl rounded-tl-none border border-ink-100 shadow-md flex-1 max-w-2xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-650 mb-2">Mensagem Inicial</p>
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
                           "p-5 rounded-2xl max-w-xl shadow-sm border",
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
                 <footer className="p-5 border-t border-ink-100 bg-white font-medium">
                   <div className="flex gap-4">
                     <div className="flex-1 relative">
                       <input 
                         value={newMessage}
                         onChange={e => setNewMessage(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                         placeholder="Digite sua resposta administrativa..."
                         className="w-full h-16 bg-ink-50 border-none rounded-2xl px-8 text-sm focus:ring-2 focus:ring-brand-500 transition-all font-medium"
                       />
                     </div>
                     <button 
                       onClick={handleSendMessage}
                       disabled={isSending || !newMessage}
                       className="w-16 h-16 bg-ink-900 text-white rounded-2xl flex items-center justify-center hover:bg-brand-650 transition-all shadow-xl disabled:opacity-50"
                     >
                       {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                     </button>
                   </div>
                 </footer>
               )}
            </div>

            {/* Ticket Info & Sidebar */}
            <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-ink-100 flex flex-col bg-white overflow-y-auto divide-y divide-ink-100 shrink-0">
               {/* Diagnostic Panel */}
               <div className="p-4">
                 <button 
                   onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
                   className="w-full flex items-center justify-between font-black text-[10px] uppercase tracking-widest text-ink-400 hover:text-ink-600 transition-colors animate-fade-in"
                 >
                   <span className="flex items-center gap-1.5"><Info size={14} /> Diagnóstico do Sistema</span>
                   <span>{diagnosticsOpen ? 'Recolher' : 'Expandir'}</span>
                 </button>
                 
                 {diagnosticsOpen && (
                   <div className="mt-3 space-y-2 text-xs text-ink-650 bg-ink-50/50 p-3 rounded-xl border border-ink-100 animate-fade-in">
                     {selectedTicket.diagnostics ? (
                       <>
                         <div className="flex justify-between">
                           <span className="font-medium text-ink-400">Navegador:</span>
                           <span className="font-bold text-ink-900 capitalize">{selectedTicket.diagnostics.browser}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="font-medium text-ink-400">Sist. Operacional:</span>
                           <span className="font-bold text-ink-900 capitalize">{selectedTicket.diagnostics.os}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="font-medium text-ink-400">Resolução:</span>
                           <span className="font-bold text-ink-900 font-mono">{selectedTicket.diagnostics.screenResolution}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="font-medium text-ink-400">Laudos Restantes:</span>
                           <span className="font-bold text-ink-900">{selectedTicket.diagnostics.reportsRemaining === -1 ? 'Ilimitado' : selectedTicket.diagnostics.reportsRemaining}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="font-medium text-ink-400">Plano:</span>
                           <span className="font-bold text-brand-600 uppercase text-[10px] tracking-wider">{selectedTicket.diagnostics.activePlan}</span>
                         </div>
                       </>
                     ) : (
                       <p className="text-[10px] text-ink-400 text-center py-2">Sem dados de diagnóstico.</p>
                     )}
                   </div>
                 )}
               </div>

               {/* Admin Notes */}
               <div className="p-4">
                 <h5 className="font-black text-[10px] uppercase tracking-widest text-ink-400 mb-3">
                   Notas Privadas (Suporte)
                 </h5>
                 <div className="space-y-3">
                   <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                     {selectedTicket.adminNotes && selectedTicket.adminNotes.length > 0 ? (
                       selectedTicket.adminNotes.map((note, index) => (
                         <div key={index} className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 text-[11px] text-ink-700">
                           <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-ink-400">
                             <span>{note.author}</span>
                             <span>{new Date(note.timestamp).toLocaleString()}</span>
                           </div>
                           <p className="leading-relaxed font-medium">{note.text}</p>
                         </div>
                       ))
                     ) : (
                       <p className="text-[10px] text-ink-400 text-center py-2">Nenhuma nota interna gravada.</p>
                     )}
                   </div>

                   <div className="flex gap-2">
                     <input
                       value={adminNoteText}
                       onChange={e => setAdminNoteText(e.target.value)}
                       placeholder="Nota interna privada..."
                       className="flex-1 bg-ink-50 border border-ink-100 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-500"
                       onKeyDown={e => e.key === 'Enter' && handleAddAdminNote()}
                     />
                     <button
                       onClick={handleAddAdminNote}
                       disabled={!adminNoteText}
                       className="px-3 py-2 bg-ink-900 hover:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                     >
                       Salvar
                     </button>
                   </div>
                 </div>
               </div>

               {/* Rating & Satisfaction feedback */}
               {(selectedTicket.status === 'resolved' || selectedTicket.rating) && (
                 <div className="p-4 bg-emerald-50/10">
                   <h5 className="font-black text-[10px] uppercase tracking-widest text-emerald-700 mb-2">
                     Avaliação de Satisfação
                   </h5>
                   {selectedTicket.rating ? (
                     <div className="space-y-2">
                       <div className="flex gap-1 text-amber-500">
                         {Array.from({ length: 5 }).map((_, i) => (
                           <Star 
                             key={i} 
                             size={16} 
                             fill={selectedTicket.rating! >= i + 1 ? 'currentColor' : 'none'} 
                             stroke="currentColor" 
                           />
                         ))}
                       </div>
                       {selectedTicket.ratingComment ? (
                         <p className="text-xs text-ink-700 italic bg-white p-3 rounded-xl border border-ink-100">
                           "{selectedTicket.ratingComment}"
                         </p>
                       ) : (
                         <p className="text-[10px] text-ink-400 italic">Sem comentário de feedback.</p>
                       )}
                     </div>
                   ) : (
                     <p className="text-[10px] text-ink-400 italic">Aguardando feedback do usuário.</p>
                   )}
                 </div>
               )}
            </aside>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-ink-200 space-y-6">
             <div className="w-32 h-32 rounded-2xl bg-ink-50 flex items-center justify-center border border-ink-50 shadow-inner">
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

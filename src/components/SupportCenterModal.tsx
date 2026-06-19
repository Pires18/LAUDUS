import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/app';
import { useAuth } from '../hooks/useAuth';
import { useCollection, where, orderBy } from '../hooks/useFirestore';
import { 
  X, MessageSquare, Plus, Send, 
  CheckCircle2, Clock, AlertCircle, LifeBuoy,
  ChevronLeft, Loader2
} from 'lucide-react';
import { classNames } from '../utils/format';
import { SupportTicket, SupportMessage } from '../types';
import { createSupportTicket, addSupportMessage } from '../store/db';

export function SupportCenterModal() {
  const { user } = useAuth();
  const { showSupportModal, setShowSupportModal, showToast } = useApp();
  
  const { data: tickets, loading, error } = useCollection<SupportTicket>('support_tickets', {
    isGlobal: true,
    constraints: [
      where('userId', '==', user?.uid),
      orderBy('updatedAt', 'desc')
    ],
    enabled: !!user && showSupportModal
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // New Ticket Form
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newInitialMsg, setNewInitialMsg] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicketId, tickets]);

  if (!showSupportModal) return null;

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  async function handleCreateTicket() {
    if (!newSubject || !newInitialMsg || !user) return;
    setIsSending(true);
    try {
      await createSupportTicket({
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuário',
        subject: newSubject,
        message: newInitialMsg,
        status: 'open',
        priority: newPriority
      });
      showToast('Chamado aberto com sucesso!', 'success');
      setIsCreating(false);
      setNewSubject('');
      setNewInitialMsg('');
    } catch {
      showToast('Erro ao abrir chamado', 'error');
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage || !selectedTicket || !user) return;
    setIsSending(true);
    try {
      await addSupportMessage(selectedTicket.id, {
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Usuário',
        text: newMessage
      });
      setNewMessage('');
    } catch {
      showToast('Erro ao enviar mensagem', 'error');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-ink-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-full max-h-[90dvh] lg:max-h-[800px] shadow-2xl border border-ink-100 flex overflow-hidden">
        
        {/* Sidebar: Tickets List */}
        <aside className={classNames(
          "w-full md:w-80 border-r border-ink-100 flex flex-col bg-ink-50/20 transition-all",
          selectedTicketId && "hidden md:flex"
        )}>
          <div className="p-6 border-b border-ink-100 flex items-center justify-between bg-white">
            <h4 className="text-lg font-black text-ink-900 flex items-center gap-2">
              <LifeBuoy size={20} className="text-brand-600" /> Suporte
            </h4>
            <button 
              onClick={() => setIsCreating(true)}
              className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-all"
              title="Novo Chamado"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-20 bg-ink-50 rounded-2xl animate-pulse" />)
            ) : error ? (
              <div className="py-12 text-center">
                <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
                <p className="text-xs text-ink-500 font-bold">Erro ao carregar chamados.</p>
              </div>
            ) : tickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={classNames(
                  "w-full p-4 rounded-2xl text-left transition-all border",
                  selectedTicketId === ticket.id 
                    ? "bg-white border-brand-200 shadow-sm ring-1 ring-brand-100" 
                    : "bg-transparent border-transparent hover:bg-white hover:border-ink-100"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={classNames(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                    ticket.status === 'open' ? "bg-red-50 text-red-600" :
                    ticket.status === 'pending' ? "bg-amber-50 text-amber-600" :
                    "bg-emerald-50 text-emerald-600"
                  )}>
                    {ticket.status}
                  </span>
                  <span className="text-[9px] text-ink-400 font-bold">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-black text-ink-900 truncate">{ticket.subject}</p>
                <p className="text-[10px] text-ink-500 line-clamp-1 mt-0.5">{ticket.message}</p>
              </button>
            ))}
            {tickets.length === 0 && (
              <div className="py-12 text-center">
                <MessageSquare size={32} className="mx-auto text-ink-200 mb-3" />
                <p className="text-xs text-ink-400 font-bold">Nenhum chamado aberto.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Area: Chat or Form */}
        <main className="flex-1 flex flex-col bg-white">
          <header className="p-6 border-b border-ink-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedTicketId && (
                <button 
                  onClick={() => setSelectedTicketId(null)}
                  className="md:hidden p-2 text-ink-400 hover:bg-ink-50 rounded-lg"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div>
                <h4 className="text-lg font-black text-ink-900">
                  {isCreating ? 'Novo Chamado' : selectedTicket ? selectedTicket.subject : 'Selecione um chamado'}
                </h4>
                {!isCreating && selectedTicket && (
                  <p className="text-[10px] text-ink-400 font-bold uppercase tracking-widest">
                    Status: <span className="text-brand-600">{selectedTicket.status}</span> • Prioridade: {selectedTicket.priority}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setShowSupportModal(false)} className="p-2 hover:bg-ink-50 rounded-full text-ink-400">
              <X size={24} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isCreating ? (
              <div className="max-w-lg mx-auto space-y-6 animate-fade-in-up">
                <div>
                  <label className="label text-[10px] font-black uppercase tracking-widest text-ink-400 mb-2">Assunto do Chamado</label>
                  <input 
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    placeholder="Ex: Erro ao gerar laudo"
                    className="input h-14"
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-black uppercase tracking-widest text-ink-400 mb-2">Prioridade</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setNewPriority(p)}
                        className={classNames(
                          "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                          newPriority === p 
                            ? "bg-brand-600 text-white border-brand-600 shadow-md" 
                            : "bg-white text-ink-400 border-ink-100 hover:border-brand-200"
                        )}
                      >
                        {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label text-[10px] font-black uppercase tracking-widest text-ink-400 mb-2">Sua Mensagem</label>
                  <textarea 
                    value={newInitialMsg}
                    onChange={e => setNewInitialMsg(e.target.value)}
                    placeholder="Descreva o problema com detalhes..."
                    rows={6}
                    className="input p-4 text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-ink-400 hover:bg-ink-50 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleCreateTicket}
                    disabled={isSending || !newSubject || !newInitialMsg}
                    className="flex-[2] btn-primary h-14 uppercase text-xs tracking-widest shadow-lg shadow-brand-500/20"
                  >
                    {isSending ? <Loader2 size={18} className="animate-spin" /> : 'Abrir Chamado Agora'}
                  </button>
                </div>
              </div>
            ) : selectedTicket ? (
              <div className="space-y-6">
                {/* Initial Message */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-ink-100 flex items-center justify-center shrink-0">
                    <MessageSquare size={20} className="text-ink-400" />
                  </div>
                  <div className="bg-ink-50 p-5 rounded-2xl rounded-tl-none flex-1">
                    <p className="text-xs font-black text-ink-900 mb-1">{selectedTicket.userName}</p>
                    <p className="text-sm text-ink-600 leading-relaxed">{selectedTicket.message}</p>
                    <p className="text-[9px] text-ink-400 mt-2 font-bold uppercase tracking-widest">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Conversation */}
                {selectedTicket.messages?.map((msg, idx) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div key={idx} className={classNames("flex gap-4", isMe ? "flex-row-reverse" : "flex-row")}>
                      <div className={classNames(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-[10px]",
                        isMe ? "bg-brand-100 text-brand-600" : "bg-purple-100 text-purple-600"
                      )}>
                        {msg.senderName.charAt(0)}
                      </div>
                      <div className={classNames(
                        "p-5 rounded-2xl max-w-[80%]",
                        isMe ? "bg-brand-600 text-white rounded-tr-none" : "bg-ink-50 text-ink-900 rounded-tl-none"
                      )}>
                        {!isMe && <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-ink-400">{msg.senderName}</p>}
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={classNames("text-[8px] mt-2 font-bold uppercase tracking-widest", isMe ? "text-white/60" : "text-ink-300")}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-ink-200 space-y-4">
                 <div className="w-24 h-24 rounded-3xl bg-ink-50 flex items-center justify-center border border-ink-50">
                    <MessageSquare size={48} />
                 </div>
                 <p className="font-black text-lg text-ink-400">Escolha um chamado para visualizar</p>
                 <button 
                  onClick={() => setIsCreating(true)}
                  className="btn-primary"
                 >
                   <Plus size={18} /> Novo Chamado
                 </button>
              </div>
            )}
          </div>

          {/* Footer: Chat Input */}
          {!isCreating && selectedTicket && selectedTicket.status !== 'resolved' && (
            <footer className="p-6 border-t border-ink-100 bg-ink-50/20">
              <div className="flex gap-3">
                <input 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escreva sua resposta..."
                  className="flex-1 bg-white border border-ink-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isSending || !newMessage}
                  className="w-14 h-14 bg-brand-600 text-white rounded-2xl flex items-center justify-center hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50"
                >
                  {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                </button>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { MuralMessage, Resident } from '../types';
import { setLastReadTimestamp, getLastReadTimestamp } from '../lib/muralStore';
import { fetchResidents, fetchMural, saveMuralMessage, updateMuralMessage, toggleMuralLikeApi, deleteMuralMessage } from '../lib/api';
import { sortResidentsByName } from '../lib/utils';
import { Send, Search, Calendar as CalendarIcon, Download, Copy, MessageCircle, Edit2, Trash2, X, Check, ThumbsUp, Users, ChevronRight, Eye, ArrowLeft } from 'lucide-react';

interface MuralModuleProps {
  institutionId: string;
  username: string;
  fullName?: string;
  role?: string;
  hideHeader?: boolean;
  cnpj?: string;
  muralPhone?: string;
  accessLevel?: string;
}

const MuralModule: React.FC<MuralModuleProps> = ({ institutionId, username, fullName, role, hideHeader = false, cnpj, muralPhone, accessLevel }) => {
  const [messages, setMessages] = useState<MuralMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgText, setEditMsgText] = useState('');
  const [initialLastRead, setInitialLastRead] = useState<number | null>(null);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<MuralMessage | null>(null);
  const [residentsList, setResidentsList] = useState<Resident[]>([]);
  const [residentSearch, setResidentSearch] = useState('');
  const [loadingResidents, setLoadingResidents] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newVisibilidade, setNewVisibilidade] = useState<string[]>(['admin']);

  // Removed viewingDetailsMsg state

  const loadMuralMessages = async (dateValue: string = filterDate, showLoading: boolean = true) => {
    if (!institutionId) return;
    if (showLoading) setIsLoading(true);

    try {
      const data = await fetchMural(institutionId, dateValue || undefined);
      const msgs = (Array.isArray(data) ? data : []).map((msg: any) => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Number(msg.timestamp) || 0
      })) as MuralMessage[];

      setMessages(msgs);

      if (!dateValue && msgs.length > 0) {
        const validTimestamps = msgs.map(m => Number(m.timestamp) || 0).filter(ts => ts > 0);
        if (validTimestamps.length > 0) {
          setLastReadTimestamp(institutionId, username, Math.max(...validTimestamps));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mural:', error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente apagar esta mensagem?')) {
      try {
        await deleteMuralMessage(id);
        setMessages(prev => prev.filter(msg => msg.id !== id));
      } catch (err) {
        console.error('Erro ao apagar:', err);
        alert('Erro ao apagar mensagem');
      }
    }
  };

  const handleToggleLike = async (msg: MuralMessage) => {
    try {
      const result = await toggleMuralLikeApi(msg.id);
      const newLikes = Array.isArray(result?.likes) ? result.likes : [];
      setMessages(prev => prev.map(item =>
        item.id === msg.id ? { ...item, likes: newLikes } : item
      ));
    } catch (err) {
      console.error('Erro ao curtir:', err);
    }
  };

  const handleStartEdit = (msg: MuralMessage) => {
    setEditingMsgId(msg.id);
    setEditMsgText(msg.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMsgId || !editMsgText.trim()) return;
    try {
      const text = editMsgText.trim();
      await updateMuralMessage(editingMsgId, text);
      setMessages(prev => prev.map(msg =>
        msg.id === editingMsgId ? { ...msg, text } : msg
      ));
      setEditingMsgId(null);
      setEditMsgText('');
    } catch (err) {
      console.error('Erro ao editar:', err);
      alert('Erro ao editar mensagem');
    }
  };

  useEffect(() => {
    if (!institutionId) return;

    if (initialLastRead === null) {
      setInitialLastRead(getLastReadTimestamp(institutionId, username));
    }

    let cancelled = false;

    const refresh = async (showLoading: boolean) => {
      if (cancelled) return;
      await loadMuralMessages(filterDate, showLoading);
    };

    refresh(true);

    // Sem filtro histórico, atualiza periodicamente a tela usando o cache do backend.
    // Isso preserva atualização entre usuários sem voltar à consulta problemática do Firestore no cliente.
    const intervalId = !filterDate
      ? window.setInterval(() => {
          refresh(false);
        }, 30000)
      : null;

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [institutionId, username, filterDate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const msgData: Partial<MuralMessage> = {
        institutionId,
        author: username,
        authorName: fullName || '',
        authorRole: role || '',
        text: newMessage.trim(),
        timestamp: Date.now(),
        visibilidade: newVisibilidade,
        // Mantém isPublic para compatibilidade com versões antigas
        isPublic: newVisibilidade.includes('publico'),
      };
      
      await saveMuralMessage(msgData);
      setNewMessage('');
      setNewVisibilidade(['admin']);
      await loadMuralMessages(filterDate, false);
    } catch (err: any) {
      console.error('Error sending to mural:', err);
      alert(err?.message || 'Erro ao enviar mensagem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdminUser = accessLevel === 'administrador' || accessLevel?.toLowerCase().includes('admin') || accessLevel === 'gerencial' || accessLevel === 'assistente_social';

  const filteredMessages = messages.filter(msg => {
    let isPublic = true;
    if (msg.visibilidade && Array.isArray(msg.visibilidade)) {
      if (msg.visibilidade.length > 0 && !msg.visibilidade.includes('publico')) {
        isPublic = false;
      }
    } else if (msg.visibilidade === 'admin') {
      isPublic = false;
    } else if (msg.isPublic === false) {
      isPublic = false;
    }

    const isAuthor = msg.author === username;

    if (!isPublic && !isAuthor && !isAdminUser) {
      return false;
    }

    if (searchText) {
      if (!msg.text.toLowerCase().includes(searchText.toLowerCase()) && 
          !msg.author.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const getAuthorDisplay = (msg: MuralMessage) => {
    return msg.authorSignatureText 
      || (msg.authorDisplayName && msg.authorFunction ? `${msg.authorDisplayName} — ${msg.authorFunction}` : null)
      || (msg.authorName && msg.authorRole ? `${msg.authorName} — ${msg.authorRole}` : null)
      || msg.authorDisplayName 
      || msg.authorName 
      || msg.author;
  };

  const formatMessageForExport = (msg: MuralMessage) => {
    const date = new Date(msg.timestamp).toLocaleDateString('pt-BR');
    const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const authorDisplay = getAuthorDisplay(msg);
    return `[${date}] [${time}] - ${authorDisplay}: ${msg.text}`;
  };

  const handleExportMessage = (msg: MuralMessage) => {
    const text = formatMessageForExport(msg);
    const cleanPhone = muralPhone ? muralPhone.replace(/\D/g, '') : '';
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleNotifyFamilyWhatsApp = async (msg: MuralMessage) => {
    setNotifyMessage(msg);
    setNotifyModalOpen(true);
    setLoadingResidents(true);
    try {
      const data = await fetchResidents(institutionId);
      setResidentsList(sortResidentsByName(data || []));
    } catch (err) {
      console.error('Erro ao buscar residentes:', err);
    } finally {
      setLoadingResidents(false);
    }
  };

  const sendWhatsAppToRelative = (phone: string, msgText: string) => {
    // Requirements: "O cabeçalho da mensagem pode ser apenas Olá, aqui é do Lar São Vicente de Paulo (fica melhor)"
    // and send to relative's phone
    const text = `Olá, aqui é do Lar São Vicente de Paulo! Abaixo uma notificação familiar!\n\n"${msgText}"\n\nQualquer dúvida a disposição e muito obrigado!`;
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setNotifyModalOpen(false);
  };

  const handleExportDay = () => {
    if (!filterDate) {
      alert('Selecione uma data no filtro para exportar as conversas do dia.');
      return;
    }
    
    if (filteredMessages.length === 0) {
      alert('Nenhuma mensagem encontrada para esta data.');
      return;
    }

    const dateStr = new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR');
    let text = `*Mural Institucional - ${dateStr}*\n\n`;
    text += filteredMessages.map(formatMessageForExport).join('\n\n');

    const cleanPhone = muralPhone ? muralPhone.replace(/\D/g, '') : '';
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-300">
      {/* Header & Filters */}
      {!hideHeader && (
        <div className="bg-white p-6 pb-2 shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#004c99] p-3 rounded-xl text-white">
                <MessageCircle size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Mural Institucional</h2>
                <p className="text-sm text-gray-500 font-bold uppercase">Comunicação interna da equipe</p>
              </div>
            </div>
            
            {filterDate && (
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExportDay()}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-green-700 transition-colors"
                >
                  <Download size={14} /> Enviar Dia para Diretoria
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar mensagens..." 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
              />
            </div>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
              />
            </div>
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="flex items-center gap-2 px-4 py-2 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-wide hover:bg-blue-800 transition-colors shadow-sm"
                title="Retornar às 50 mensagens mais recentes"
              >
                <ArrowLeft size={14} />
                Voltar ao mural atual
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle size={48} className="mb-4 opacity-20" />
            <p className="font-bold uppercase text-sm">Nenhuma mensagem encontrada</p>
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="mt-5 flex items-center gap-2 px-4 py-2 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-wide hover:bg-blue-800 transition-colors"
              >
                <ArrowLeft size={14} />
                Voltar ao mural atual
              </button>
            )}
          </div>
        ) : (
          (() => {
            let hasShownUnread = false;
            return filteredMessages.map((msg) => {
              const isMe = msg.author === username;
              const date = new Date(msg.timestamp).toLocaleDateString('pt-BR');
              const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              
              const isUnread = initialLastRead !== null && msg.timestamp > initialLastRead;
              const showUnreadSeparator = isUnread && !hasShownUnread;
              if (showUnreadSeparator) {
                hasShownUnread = true;
              }

              return (
                <React.Fragment key={msg.id}>
                  {showUnreadSeparator && (
                    <div className="flex items-center gap-4 my-6">
                      <div className="flex-1 border-t border-red-500/30"></div>
                      <span className="text-xs font-bold text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full">Mensagens não lidas</span>
                      <div className="flex-1 border-t border-red-500/30"></div>
                    </div>
                  )}
                  <div className="flex flex-col bg-white border border-gray-100 shadow-sm rounded-2xl p-5 w-full relative group">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-[11px] font-black text-gray-800">
                        {getAuthorDisplay(msg)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">{date} às {time}</span>
                      {(()=>{
                        let isMsgPublic = true;
                        if (msg.visibilidade && Array.isArray(msg.visibilidade)) {
                          if (msg.visibilidade.length > 0 && !msg.visibilidade.includes('publico')) isMsgPublic = false;
                        } else if (msg.visibilidade === 'admin' || msg.isPublic === false) {
                          isMsgPublic = false;
                        }
                        if (!isMsgPublic) {
                          return (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              🔒 Direção e Coordenação
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="text-gray-800">
                      {editingMsgId === msg.id ? (
                        <div className="w-full flex gap-2">
                           <textarea
                             value={editMsgText}
                             onChange={(e) => setEditMsgText(e.target.value)}
                             className="flex-1 px-3 py-2 text-sm text-gray-800 rounded-lg outline-none resize-none min-h-[40px] max-h-[120px] border border-blue-200 focus:border-blue-400"
                             autoFocus
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' && !e.shiftKey) {
                                 e.preventDefault();
                                 handleSaveEdit();
                               } else if (e.key === 'Escape') {
                                 setEditingMsgId(null);
                               }
                             }}
                           />
                           <div className="flex flex-col gap-1 shrink-0">
                             <button onClick={handleSaveEdit} className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600"><Check size={12} /></button>
                             <button onClick={() => setEditingMsgId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300"><X size={12} /></button>
                           </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {(() => {
                               const vis = Array.isArray(msg.visibilidade) ? msg.visibilidade : [msg.visibilidade || (msg.isPublic ? 'publico' : 'admin')];
                               return (
                                 <>
                                   {vis.includes('publico') && <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700">Público</span>}
                                   {vis.includes('admin') && <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-700">Direção e Coordenação</span>}
                                   {vis.includes('privado') && <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-600">Atendimento Particular</span>}
                                 </>
                               )
                            })()}
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          {msg.detailedContent && (
                            <div className="mt-4 p-4 bg-gray-50 border-l-2 border-gray-300 rounded-lg">
                              <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Conteúdo Detalhado (Legado)</span>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.detailedContent}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Likes Area */}
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => handleToggleLike(msg)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                            (msg.likes || []).includes(username) 
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <ThumbsUp size={12} className={(msg.likes || []).includes(username) ? 'fill-current' : ''} />
                          {(msg.likes?.length || 0) > 0 && <span>{msg.likes?.length}</span>}
                        </button>
                        
                        {(msg.likes?.length || 0) > 0 && (
                          <span className="text-[9.5px] font-medium leading-tight max-w-[200px] text-gray-400">
                            {msg.likes?.includes(username) 
                              ? (msg.likes.length === 1 ? 'Você curtiu' : `Você e mais ${msg.likes.length - 1} curtiram`)
                              : `${msg.likes?.join(', ')} curti${msg.likes!.length > 1 ? 'ram' : 'u'}`}
                          </span>
                        )}
                      </div>

                      {/* Export actions */}
                      <div className="absolute top-4 right-4 flex gap-2 z-10">
                        {isMe && !editingMsgId && (
                          <>
                            <button 
                              onClick={() => handleStartEdit(msg)}
                              className="p-1.5 bg-white text-gray-500 rounded-full shadow-sm hover:text-[#004c99] border border-gray-100 hover:border-blue-200 transition-all"
                              title="Editar mensagem"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => handleDelete(msg.id)}
                              className="p-1.5 bg-white text-gray-400 rounded-full shadow-sm hover:text-red-600 border border-gray-100 hover:border-red-100 transition-all"
                              title="Apagar mensagem"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleExportMessage(msg)}
                          className="p-1.5 bg-white text-green-600 rounded-full shadow-sm hover:bg-green-50 border border-gray-100 hover:border-green-200 transition-all"
                          title="Enviar para a Diretoria"
                        >
                          <Download size={12} />
                        </button>
                        {(accessLevel?.toLowerCase().includes('admin') || accessLevel?.toLowerCase() === 'assistente_social') && (
                          <button 
                            onClick={() => handleNotifyFamilyWhatsApp(msg)}
                            className="p-1.5 bg-white text-[#004c99] rounded-full shadow-sm hover:bg-blue-50 border border-gray-100 hover:border-blue-200 transition-all"
                            title="Notificar Família"
                          >
                            <MessageCircle size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t shrink-0 flex flex-col gap-2">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex flex-col gap-3 max-w-5xl mx-auto w-full">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Digite sua mensagem para o mural..."
                rows={1}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none resize-none min-h-[48px] max-h-[120px]"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSubmitting}
                className="px-6 py-3 bg-[#004c99] text-white rounded-xl font-black text-xs uppercase hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors h-12 shrink-0"
              >
                <Send size={16} />
                {isSubmitting ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
            
            <div className="flex items-center gap-4 px-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Visibilidade:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Array.isArray(newVisibilidade) ? newVisibilidade.includes('publico') : newVisibilidade === 'publico'}
                  onChange={(e) => {
                     let current = Array.isArray(newVisibilidade) ? [...newVisibilidade] : [newVisibilidade as string];
                     if (current.includes('privado')) current = [];
                     if (e.target.checked) current.push('publico');
                     else current = current.filter((v: string) => v !== 'publico');
                     if (!current.includes('admin')) current.push('admin'); 
                     setNewVisibilidade(current);
                  }}
                  className="w-3.5 h-3.5 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                <span className="text-xs font-medium text-gray-700">Público</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Array.isArray(newVisibilidade) ? newVisibilidade.includes('admin') : newVisibilidade === 'admin'}
                  onChange={(e) => {
                     let current = Array.isArray(newVisibilidade) ? [...newVisibilidade] : [newVisibilidade as string];
                     if (current.includes('privado')) current = [];
                     if (e.target.checked) {
                       if (!current.includes('admin')) current.push('admin');
                     } else {
                       current = current.filter((v: string) => v !== 'admin');
                     }
                     setNewVisibilidade(current);
                  }}
                  className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
                />
                <span className="text-xs font-medium text-gray-700">Equipe/Admin</span>
              </label>
            </div>
          </div>
        </form>
      </div>
      {/* Notify Family Modal */}
      {notifyModalOpen && notifyMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b flex justify-between items-center bg-[#004c99] text-white">
              <h3 className="font-black uppercase tracking-tight text-lg">Notificar Família</h3>
              <button onClick={() => setNotifyModalOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="mb-4 bg-blue-50 p-4 rounded-xl text-sm italic text-gray-700 border border-blue-100 overflow-y-auto max-h-60 shrink-0 custom-scrollbar">
                "{notifyMessage.text}"
              </div>
              
              <div className="relative mb-4 shrink-0">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar idoso por nome..."
                  value={residentSearch}
                  onChange={(e) => setResidentSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border whitespace-nowrap overflow-hidden text-ellipsis border-gray-200 rounded-xl focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] outline-none text-sm font-medium"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-3 custom-scrollbar">
                {loadingResidents ? (
                  <div className="text-center py-8 text-sm font-medium text-gray-400">Carregando residentes...</div>
                ) : (
                  residentsList
                    .filter(r => !residentSearch || r.name.toLowerCase().includes(residentSearch.toLowerCase()))
                    .map(resident => (
                      <div key={resident.id} className="border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-[#004c99] flex items-center justify-center font-bold text-xs uppercase">
                            {resident.name.substring(0, 2)}
                          </div>
                          <span className="font-bold text-sm text-gray-800">{resident.name}</span>
                        </div>
                        
                        {(resident.relatives && resident.relatives.some(rel => !rel.deceased)) ? (
                          <div className="space-y-2">
                            {resident.relatives.filter(rel => !rel.deceased).map(rel => (
                              <div key={rel.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                <div>
                                  <div className="text-xs font-bold text-gray-800">{rel.name}</div>
                                  <div className="text-[10px] uppercase text-gray-500 font-semibold">{rel.kinship} • {rel.phone || 'Sem telefone'}</div>
                                </div>
                                <button
                                  onClick={() => rel.phone && sendWhatsAppToRelative(rel.phone, notifyMessage.text)}
                                  disabled={!rel.phone}
                                  className="p-2 bg-green-500 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-300 transition-colors"
                                  title="Enviar Notificação"
                                >
                                  <MessageCircle size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">Nenhum familiar ativo cadastrado.</div>
                        )}
                      </div>
                    ))
                )}
                
                {!loadingResidents && residentsList.length === 0 && (
                  <div className="text-center py-8 text-sm font-medium text-gray-400">Nenhum residente encontrado.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default MuralModule;

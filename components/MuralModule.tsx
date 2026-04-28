import React, { useState, useEffect, useRef } from 'react';
import { MuralMessage } from '../types';
import { setLastReadTimestamp } from '../lib/muralStore';
import { Send, Search, Calendar as CalendarIcon, Download, Copy, MessageCircle, Edit2, Trash2, X, Check } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MuralModuleProps {
  institutionId: string;
  username: string;
  hideHeader?: boolean;
  cnpj?: string;
  muralPhone?: string;
}

const MuralModule: React.FC<MuralModuleProps> = ({ institutionId, username, hideHeader = false, cnpj, muralPhone }) => {
  const [messages, setMessages] = useState<MuralMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgText, setEditMsgText] = useState('');

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente apagar esta mensagem?')) {
      try {
        await deleteDoc(doc(db, 'muralMessages', id));
      } catch (err) {
        console.error('Erro ao apagar:', err);
        alert('Erro ao apagar mensagem');
      }
    }
  };

  const handleStartEdit = (msg: MuralMessage) => {
    setEditingMsgId(msg.id);
    setEditMsgText(msg.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMsgId || !editMsgText.trim()) return;
    try {
      await updateDoc(doc(db, 'muralMessages', editingMsgId), {
        text: editMsgText.trim()
      });
      setEditingMsgId(null);
      setEditMsgText('');
    } catch (err) {
      console.error('Erro ao editar:', err);
      alert('Erro ao editar mensagem');
    }
  };

  useEffect(() => {
    if (!institutionId) return;
    setIsLoading(true);

    const ids = [institutionId];
    if (cnpj && cnpj !== institutionId) {
      ids.push(cnpj);
    }

    const q = query(
      collection(db, 'muralMessages'),
      where('institutionId', 'in', ids)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: data.timestamp?.toDate?.()?.getTime() || data.timestamp || Date.now()
        } as MuralMessage;
      }).sort((a, b) => a.timestamp - b.timestamp);
      
      setMessages(msgs);
      setIsLoading(false);

      if (msgs.length > 0) {
        const lastTimestamp = Math.max(...msgs.map(m => m.timestamp));
        setLastReadTimestamp(institutionId, username, lastTimestamp);
      }
    }, (error) => {
      console.error("Error listening to mural messages:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [institutionId, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'muralMessages'), {
        institutionId,
        author: username,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending to mural:', err);
      alert('Erro ao enviar mensagem');
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filterDate) {
      const msgDate = new Date(msg.timestamp).toISOString().split('T')[0];
      if (msgDate !== filterDate) return false;
    }
    if (searchText) {
      if (!msg.text.toLowerCase().includes(searchText.toLowerCase()) && 
          !msg.author.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const formatMessageForExport = (msg: MuralMessage) => {
    const date = new Date(msg.timestamp).toLocaleDateString('pt-BR');
    const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `[${date}] [${time}] - ${msg.author}: ${msg.text}`;
  };

  const handleExportMessage = (msg: MuralMessage, type: 'copy' | 'whatsapp') => {
    const text = formatMessageForExport(msg);
    if (type === 'copy') {
      navigator.clipboard.writeText(text);
      alert('Mensagem copiada para a área de transferência!');
    } else {
      const cleanPhone = muralPhone ? muralPhone.replace(/\D/g, '') : '';
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  const handleExportDay = (type: 'copy' | 'whatsapp') => {
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

    if (type === 'copy') {
      navigator.clipboard.writeText(text);
      alert('Conversas copiadas para a área de transferência!');
    } else {
      const cleanPhone = muralPhone ? muralPhone.replace(/\D/g, '') : '';
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 animate-in fade-in duration-300">
      {/* Header & Filters */}
      {!hideHeader && (
        <div className="bg-white p-6 border-b shadow-sm shrink-0">
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
                  onClick={() => handleExportDay('copy')}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold uppercase hover:bg-gray-200 transition-colors"
                >
                  <Copy size={14} /> Copiar Dia
                </button>
                <button 
                  onClick={() => handleExportDay('whatsapp')}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-green-700 transition-colors"
                >
                  <Download size={14} /> WhatsApp Dia
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
                onClick={() => setFilterDate('')}
                className="px-4 py-2 text-xs font-bold text-gray-500 uppercase hover:text-gray-800"
              >
                Limpar Data
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
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.author === username;
            const date = new Date(msg.timestamp).toLocaleDateString('pt-BR');
            const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1 px-1">
                  <span className="text-xs font-black text-gray-600">{msg.author}</span>
                  <span className="text-[10px] font-bold text-gray-400">{date} às {time}</span>
                </div>
                <div className={`group relative max-w-[80%] p-4 rounded-2xl shadow-sm ${
                  isMe 
                    ? 'bg-[#004c99] text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}>
                  {editingMsgId === msg.id ? (
                    <div className="w-full flex gap-2">
                       <textarea
                         value={editMsgText}
                         onChange={(e) => setEditMsgText(e.target.value)}
                         className="flex-1 px-3 py-2 text-sm text-gray-800 rounded-lg outline-none resize-none min-h-[40px] max-h-[120px]"
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
                       <div className="flex flex-col gap-1">
                         <button onClick={handleSaveEdit} className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600"><Check size={12} /></button>
                         <button onClick={() => setEditingMsgId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300"><X size={12} /></button>
                       </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  )}
                  
                  {/* Export actions (visible on hover) */}
                  <div className={`absolute top-2 ${isMe ? '-left-28' : '-right-20'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                    {isMe && !editingMsgId && (
                      <>
                        <button 
                          onClick={() => handleStartEdit(msg)}
                          className="p-1.5 bg-white text-gray-600 rounded-full shadow-md hover:text-blue-600"
                          title="Editar mensagem"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => handleDelete(msg.id)}
                          className="p-1.5 bg-white text-red-500 rounded-full shadow-md hover:text-red-700"
                          title="Apagar mensagem"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => handleExportMessage(msg, 'copy')}
                      className="p-1.5 bg-white text-gray-600 rounded-full shadow-md hover:text-[#004c99]"
                      title="Copiar texto"
                    >
                      <Copy size={12} />
                    </button>
                    <button 
                      onClick={() => handleExportMessage(msg, 'whatsapp')}
                      className="p-1.5 bg-white text-green-600 rounded-full shadow-md hover:text-green-700"
                      title="Enviar no WhatsApp"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3 max-w-5xl mx-auto">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite sua mensagem para o mural... (Shift + Enter para nova linha)"
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
            disabled={!newMessage.trim()}
            className="px-6 py-3 bg-[#004c99] text-white rounded-xl font-black text-xs uppercase hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors h-12"
          >
            <Send size={16} />
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default MuralModule;

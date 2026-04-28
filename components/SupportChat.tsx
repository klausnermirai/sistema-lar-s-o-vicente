
import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, User, ShieldCheck, Edit2, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SupportMessage } from '../lib/supportService';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SupportChatProps {
  isOpen: boolean;
  onClose: () => void;
  institutionId: string;
  username: string;
}

export const SupportChat: React.FC<SupportChatProps> = ({ isOpen, onClose, institutionId, username }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgText, setEditMsgText] = useState('');

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente apagar esta mensagem?')) {
      try {
        await deleteDoc(doc(db, 'support_messages', id));
      } catch (err) {
        console.error('Erro ao apagar:', err);
        alert('Erro ao apagar mensagem');
      }
    }
  };

  const handleStartEdit = (msg: SupportMessage) => {
    setEditingMsgId(msg.id);
    setEditMsgText(msg.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMsgId || !editMsgText.trim()) return;
    try {
      await updateDoc(doc(db, 'support_messages', editingMsgId), {
        text: editMsgText.trim()
      });
      setEditingMsgId(null);
      setEditMsgText('');
    } catch (err) {
      console.error('Erro ao editar:', err);
      alert('Erro ao editar mensagem');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && institutionId) {
      const q = query(
        collection(db, 'support_messages'),
        where('institutionId', '==', institutionId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt || new Date().toISOString()
        } as SupportMessage)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(msgs);
      }, (error) => {
        console.error("Error listening to support messages:", error);
      });

      return () => unsubscribe();
    }
  }, [isOpen, institutionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'support_messages'), {
        institutionId,
        text: inputText,
        sender: username,
        role: 'user',
        createdAt: serverTimestamp()
      });
      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-end p-6 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto"
          />
          
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="relative w-full max-w-md h-full bg-white shadow-2xl rounded-[32px] overflow-hidden flex flex-col pointer-events-auto border border-gray-100"
          >
            {/* Header */}
            <div className="bg-[#004c99] p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Suporte Mirai</h3>
                  <p className="text-[10px] text-blue-100 font-bold uppercase">Chat de Atendimento Interno</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                  <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={32} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Inicie uma conversa</h4>
                  <p className="text-xs text-gray-400 font-medium">Digite abaixo sua dúvida ou solicitação técnica. Nossa equipe responderá em breve.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div 
                    key={msg.id || idx}
                    className={`flex flex-col ${msg.role === 'support' ? 'items-start' : 'items-end'}`}
                  >
                    <div className={`group relative max-w-[85%] p-4 rounded-2xl text-xs font-medium shadow-sm ${
                      msg.role === 'support' 
                      ? 'bg-white text-gray-700 rounded-tl-none border border-gray-100' 
                      : 'bg-[#004c99] text-white rounded-tr-none'
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
                             <button type="button" onClick={handleSaveEdit} className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600"><Check size={12} /></button>
                             <button type="button" onClick={() => setEditingMsgId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300"><X size={12} /></button>
                           </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}

                      {msg.role !== 'support' && !editingMsgId && (
                        <div className={`absolute top-2 -left-16 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                          <button 
                            type="button"
                            onClick={() => handleStartEdit(msg)}
                            className="p-1.5 bg-white text-gray-600 rounded-full shadow-md hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit2 size={10} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(msg.id)}
                            className="p-1.5 bg-white text-red-500 rounded-full shadow-md hover:text-red-700"
                            title="Apagar"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 px-1">
                      {msg.role === 'support' ? (
                        <>
                          <ShieldCheck size={10} className="text-blue-500" />
                          <span className="text-[8px] font-black text-blue-500 uppercase">Suporte Mirai</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">{msg.sender}</span>
                          <User size={10} className="text-gray-400" />
                        </>
                      )}
                      <span className="text-[8px] text-gray-300">•</span>
                      <span className="text-[8px] text-gray-300">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100">
              <div className="relative flex items-center gap-2">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Descreva sua solicitação... (Shift + Enter para nova linha)"
                  rows={1}
                  className="flex-1 bg-gray-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-2xl px-4 py-3 text-xs outline-none transition-all placeholder:text-gray-400 resize-none min-h-[44px] max-h-[120px]"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                <button 
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  className="w-10 h-10 bg-[#004c99] text-white rounded-2xl flex items-center justify-center hover:shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none shrink-0 self-end mb-1"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest text-center mt-3">
                Tempo médio de resposta: 15 minutos
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

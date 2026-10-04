import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Maximize2, 
  Minimize2, 
  Bot, 
  User, 
  RotateCcw, 
  HelpCircle, 
  Coins, 
  Users, 
  Package, 
  HeartHandshake, 
  AlertTriangle,
  Loader2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Session, getAuthHeaders, apiFetch } from '../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

interface AiAssistantChatProps {
  session: Session | null;
}

export const AiAssistantChat: React.FC<AiAssistantChatProps> = ({ session }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const isCentralCouncil = 
    session?.hierarchy?.type === 'central' || 
    session?.role === 'conselho_central' || 
    session?.cnpj === '54.927.132/0001-92';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: isCentralCouncil
        ? `Oi! Eu sou o Fred, assistente e consultor institucional do Conselho Central da SSVP. Posso te ajudar com informações sobre a Diretoria, Conselhos Particulares, Conferências, Membros Vicentinos e Obras Unidas. Em que posso te ajudar hoje?`
        : `Oi! Eu sou o Fred, assistente virtual da instituição. Em que posso te ajudar hoje?`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const institutionId = session?.institutionId || session?.cnpj || 'default';

  const quickQuestions = isCentralCouncil
    ? [
        { label: 'Diretoria Executiva', query: 'Quem compõe a Diretoria Executiva do Conselho Central e qual a vigência do mandato atual?' },
        { label: 'Conferências e Membros', query: 'Quantos Conselhos Particulares, Conferências e Membros Vicentinos estão cadastrados?' },
        { label: 'Obras Unidas', query: 'Quais Obras Unidas estão vinculadas e qual a situação de mandato e conformidade fiscal delas?' },
        { label: 'Famílias Assistidas', query: 'Quantas famílias assistidas estão registradas pelas Conferências?' },
        { label: 'Confrades e Consócias', query: 'Quantos confrades, consócias e aspirantes ativos temos no Conselho Central?' },
      ]
    : [
        { label: 'Saldo da Caixinha', query: 'Qual o saldo atual da caixinha em dinheiro e as últimas despesas?' },
        { label: 'Total de Acolhidos', query: 'Quantos idosos estão acolhidos atualmente e quais estão ativos?' },
        { label: 'Estoque Baixo', query: 'Quais itens do estoque e da farmácia estão abaixo da quantidade mínima?' },
        { label: 'Arrecadação do Mês', query: 'Qual foi o total arrecadado com doações e carnês recentemente?' },
        { label: 'Fila de Espera', query: 'Quantos candidatos estão na lista de triagem e acolhimento?' },
      ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      // Build conversation history format for Gemini
      const history = messages
        .filter(m => m.id !== 'welcome' && !m.isError)
        .slice(-6)
        .map(m => ({
          role: m.sender === 'user' ? ('user' as const) : ('model' as const),
          parts: [{ text: m.text }]
        }));

      const res = await apiFetch('/api/ai-assistant/ask', {
        method: 'POST',
        headers: getAuthHeaders(institutionId),
        body: JSON.stringify({
          question: text,
          history,
          institutionId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível obter a resposta do assistente.');
      }

      const assistantMsg: Message = {
        id: `msg-resp-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'Nenhuma informação retornada.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ ${err.message || 'Ocorreu um erro ao consultar o assistente. Verifique a conexão ou tente novamente.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Oi! Eu sou o Fred. O que você gostaria de consultar agora?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  if (!session) return null;

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-[#004c99] to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-full p-3.5 sm:p-4 shadow-2xl flex items-center gap-2.5 transition-all transform hover:scale-105 group border-2 border-white/20 animate-bounce-slow"
          title="Falar com o Fred (Assistente IA)"
          id="btn-open-ai-assistant"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white"></span>
          </div>
          <span className="text-xs font-black uppercase tracking-wider hidden sm:inline pr-1">
            Fred (IA)
          </span>
        </button>
      )}

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div 
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-white shadow-2xl border border-gray-200 overflow-hidden ${
            isExpanded 
              ? 'inset-4 sm:inset-10 rounded-3xl' 
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[95vw] sm:w-[440px] h-[580px] max-h-[88vh] rounded-3xl'
          }`}
          id="ai-assistant-modal"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#004c99] via-blue-900 to-indigo-950 p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide">Fred • Assistente IA</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-blue-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Consultas seguras da sua instituição
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Limpar histórico da conversa"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-all hidden sm:block"
                title={isExpanded ? 'Restaurar tamanho' : 'Maximizar'}
              >
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Fechar assistente"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div className="bg-blue-50/70 border-b border-blue-100/80 px-3 py-2 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
            <span className="text-[10px] font-black text-[#004c99] uppercase tracking-wider whitespace-nowrap flex items-center gap-1 mr-1">
              <Sparkles size={11} className="text-amber-500" />
              Sugestões:
            </span>
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q.query)}
                disabled={loading}
                className="text-[10px] font-bold text-gray-700 hover:text-[#004c99] bg-white hover:bg-blue-50/80 border border-gray-200 hover:border-blue-300 rounded-full px-2.5 py-1 whitespace-nowrap transition-all shadow-2xs disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/60">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-black shadow-xs ${
                      isUser
                        ? 'bg-[#004c99] text-white'
                        : 'bg-white text-[#004c99] border border-blue-200'
                    }`}
                  >
                    {isUser ? <User size={14} /> : <Sparkles size={14} className="text-amber-500" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                      isUser
                        ? 'bg-[#004c99] text-white rounded-tr-xs font-medium'
                        : msg.isError
                        ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs font-medium'
                        : 'bg-white text-gray-800 border border-gray-200/80 rounded-tl-xs font-normal'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    <div
                      className={`text-[9px] mt-1 text-right font-medium ${
                        isUser ? 'text-blue-200' : 'text-gray-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-white text-[#004c99] border border-blue-200 flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles size={14} className="text-amber-500 animate-spin-slow" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-xs p-3 shadow-2xs flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <Loader2 size={15} className="animate-spin text-[#004c99]" />
                  <span>Consultando dados da instituição...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-gray-100 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Pergunte sobre qualquer dado da instituição..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-800 font-medium focus:outline-none focus:border-[#004c99] focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="p-2.5 bg-[#004c99] hover:bg-blue-800 text-white rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center justify-center shrink-0"
              title="Enviar pergunta"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

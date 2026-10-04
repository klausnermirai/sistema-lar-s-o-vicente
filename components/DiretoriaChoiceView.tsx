import React from 'react';
import { User, ChevronRight, LogOut } from 'lucide-react';

interface DiretoriaChoiceViewProps {
  primeiroNome: string;
  roleTitle: string;
  conferenciaNome: string;
  onSelectFamilias: () => void;
  onSelectGestao: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const DiretoriaChoiceView: React.FC<DiretoriaChoiceViewProps> = ({
  primeiroNome,
  roleTitle,
  conferenciaNome,
  onSelectFamilias,
  onSelectGestao,
  onOpenProfile,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      {/* CABEÇALHO AZUL OFICIAL (Conforme imagem anexada) */}
      <header className="bg-[#0a4175] text-white px-6 pt-9 pb-8 rounded-b-[32px] shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full border-2 border-white/60 bg-white/10 flex items-center justify-center shrink-0 shadow-inner">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
                Olá, {primeiroNome}
              </h1>
              <p className="text-sm font-medium text-blue-200 leading-snug">
                {roleTitle}
              </p>
              <p className="text-base font-bold text-white leading-snug mt-0.5">
                {conferenciaNome}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Encerrar sessão"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-blue-100 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ÁREA DE SELEÇÃO DOS MÓDULOS */}
      <main className="flex-1 max-w-md w-full mx-auto px-5 py-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* TÍTULO DE CHAMADA */}
          <div className="text-center py-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#0a4175] tracking-tight">
              O que deseja acessar?
            </h2>
          </div>

          {/* CARD 1: FAMÍLIAS E VISITAS */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              {/* Ilustração Família / Lar estilizada em SVG */}
              <div className="w-16 h-16 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center shrink-0 p-2">
                <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
                  {/* Telhado */}
                  <path d="M12 28L32 12L52 28" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Paredes da casa */}
                  <path d="M18 27V48C18 50.2 19.8 52 22 52H42C44.2 52 46 50.2 46 48V27" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  {/* Pais e filho com coração */}
                  <circle cx="27" cy="35" r="3" fill="#0b4d8c" />
                  <path d="M23 46C23 42 25 41 27 41C29 41 31 42 31 46" stroke="#0b4d8c" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="37" cy="35" r="3" fill="#0b4d8c" />
                  <path d="M33 46C33 42 35 41 37 41C39 41 41 42 41 46" stroke="#0b4d8c" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Coração acolhedor */}
                  <path d="M32 23C32 21 34 20 35.5 21.5C37 23 32 26 32 26C32 26 27 23 28.5 21.5C30 20 32 21 32 23Z" fill="#10b981" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">
                  Famílias e Visitas
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Famílias assistidas, sindicâncias e relatos de visitas
                </p>
              </div>
            </div>

            <button
              onClick={onSelectFamilias}
              className="w-full bg-[#0a4175] hover:bg-[#08335c] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-sm cursor-pointer group"
            >
              <span>Acessar</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* CARD 2: GESTÃO DA CONFERÊNCIA */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              {/* Ilustração Edifício Institucional / Gestão em SVG */}
              <div className="w-16 h-16 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-center shrink-0 p-2">
                <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
                  {/* Frontão / Telhado do edifício */}
                  <path d="M14 24L32 13L50 24" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 26H52" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  {/* Colunas */}
                  <path d="M18 29V46" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  <path d="M27 29V46" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  <path d="M37 29V46" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  <path d="M46 29V46" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  {/* Base / Degraus */}
                  <path d="M14 46H50" stroke="#0b4d8c" strokeWidth="3" strokeLinecap="round" />
                  <path d="M10 50H54" stroke="#0b4d8c" strokeWidth="3.5" strokeLinecap="round" />
                  {/* Emblema / Escudo central */}
                  <circle cx="32" cy="20" r="2.5" fill="#10b981" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">
                  Gestão da Conferência
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Dados, diretoria e administração da Conferência
                </p>
              </div>
            </div>

            <button
              onClick={onSelectGestao}
              className="w-full bg-[#0a4175] hover:bg-[#08335c] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-sm cursor-pointer group"
            >
              <span>Acessar</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* BOTÃO DISCRETO: MEU PERFIL */}
        <div className="flex justify-center pt-6 pb-2">
          <button
            onClick={onOpenProfile}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white border border-slate-200/90 shadow-sm text-slate-700 text-xs font-semibold hover:bg-slate-50 active:scale-98 transition-all cursor-pointer"
          >
            <User className="w-4 h-4 text-slate-400" />
            <span>Meu perfil</span>
          </button>
        </div>
      </main>
    </div>
  );
};

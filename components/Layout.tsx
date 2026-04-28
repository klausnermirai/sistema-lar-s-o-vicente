
import React, { useState, useEffect } from 'react';
import { Users, ChevronRight, Menu, FileSearch, Settings, HeartPulse, Stethoscope, Activity, MessageCircle, LogOut, DollarSign, Package, BarChart3, HelpCircle, Key, Calendar, Pill, FileText, Home } from 'lucide-react';
import { AppRoute } from '../types';
import { getLastReadTimestamp } from '../lib/muralStore';
import { SupportChat } from './SupportChat';
import { MuralChatPanel } from './MuralChatPanel';
import { ChangePasswordModal } from './ChangePasswordModal';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface LayoutProps {
  children: React.ReactNode;
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;
  institutionName?: string;
  councilInfo?: string;
  logoUrl?: string;
  username?: string;
  institutionId?: string;
  cnpj?: string;
  userId?: string;
  onLogout?: () => void;
  accessLevel?: string;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeRoute, 
  setActiveRoute, 
  institutionName, 
  councilInfo, 
  logoUrl, 
  username, 
  institutionId, 
  cnpj,
  userId, 
  onLogout, 
  accessLevel 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(accessLevel !== 'medico');
  const [unreadMural, setUnreadMural] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'atendimento' | 'gestao'>('atendimento');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isTeamChatOpen, setIsTeamChatOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const hasGestaoAccess = accessLevel === 'administrador' || accessLevel === 'gerencial';
  
  // Specific restrictions
  const isEnfermeira = accessLevel === 'enfermeira';
  const isVisitante = accessLevel === 'visitante';
  const isAssistenteSocial = accessLevel === 'assistente_social';
  const isPsicologia = accessLevel === 'psicologia';
  const isTerapeutaOcupacional = accessLevel === 'terapeuta_ocupacional';
  const isFisioterapeuta = accessLevel === 'fisioterapeuta';
  const isNutricionista = accessLevel === 'nutricionista';
  const isMedico = accessLevel === 'medico';
  const isCuidados = accessLevel === 'cuidados';

  useEffect(() => {
    // Mural real-time unread count
    const idToSearch = institutionId || cnpj;
    if (idToSearch && username) {
      const ids = [idToSearch];
      if (institutionId && cnpj && institutionId !== cnpj) {
        ids.push(cnpj);
      }

      const q = query(
        collection(db, 'muralMessages'),
        where('institutionId', 'in', ids)
      );

      const docsRef = { current: [] as any[] };

      const unsubscribe = onSnapshot(q, (snapshot) => {
        docsRef.current = snapshot.docs;
        const lastRead = getLastReadTimestamp(institutionId, username);
        const unread = snapshot.docs.filter(doc => {
          const data = doc.data();
          const ts = data.timestamp?.toDate?.()?.getTime() || data.timestamp || 0;
          return ts > lastRead;
        }).length;
        setUnreadMural(unread);
      });

      const updateOnRead = () => {
        const lastRead = getLastReadTimestamp(institutionId, username);
        const unread = docsRef.current.filter(doc => {
          const data = doc.data();
          const ts = data.timestamp?.toDate?.()?.getTime() || data.timestamp || 0;
          return ts > lastRead;
        }).length;
        setUnreadMural(unread);
      };

      window.addEventListener('mural_read_updated', updateOnRead);

      return () => {
        unsubscribe();
        window.removeEventListener('mural_read_updated', updateOnRead);
      };
    }
  }, [institutionId, username]);

  useEffect(() => {
    // Current route dictates the initial category
    // Settings is now in both, so don't force switch if already in one that has it
    const gestaoRoutes = [AppRoute.AMENDMENTS, AppRoute.SETTINGS];
    const atendimentoRoutes = [
      AppRoute.HOME,
      AppRoute.SCREENING, 
      AppRoute.RESIDENTS, 
      AppRoute.SAUDE_CUIDADOS, 
      AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, 
      AppRoute.CONSULTAS_MEDICAS,
      AppRoute.MEDICAMENTOS,
      AppRoute.AGENDA,
      AppRoute.GUIAS,
      AppRoute.SETTINGS
    ];

    if (activeCategory === 'gestao' && gestaoItems.some(i => i.id === activeRoute)) {
      return;
    }
    if (activeCategory === 'atendimento' && atendimentoItems.some(i => i.id === activeRoute)) {
      return;
    }

    if (gestaoRoutes.includes(activeRoute) && !atendimentoRoutes.includes(activeRoute)) {
      setActiveCategory('gestao');
    } else if (atendimentoRoutes.includes(activeRoute) && !gestaoRoutes.includes(activeRoute)) {
      setActiveCategory('atendimento');
    }
  }, [activeRoute]);

  let atendimentoItems = [
    { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
    { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },
    { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
    { id: AppRoute.SAUDE_CUIDADOS, label: 'Saúde e Cuidados', icon: HeartPulse },
    { id: AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, label: 'Atendimento Multidisciplinar', icon: Activity },
    { id: AppRoute.CONSULTAS_MEDICAS, label: 'Consulta Médica', icon: Stethoscope },
    { id: AppRoute.MEDICAMENTOS, label: 'Medicamentos', icon: Pill },
    { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
    { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
  ];

  if (isEnfermeira) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.GUIAS, label: 'Guias', icon: FileText, disabled: true } as any,
      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.SAUDE_CUIDADOS, label: 'Saúde e Cuidados', icon: HeartPulse },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.MEDICAMENTOS, label: 'Medicamentos', icon: Pill },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isVisitante) {
    atendimentoItems = [
      { id: AppRoute.VISITANTES, label: 'Portal do Visitante', icon: Users },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isMedico) {
    atendimentoItems = [
      { id: AppRoute.CONSULTAS_MEDICAS, label: 'Consulta Médica', icon: Stethoscope },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isAssistenteSocial) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, label: 'Atendimento Multidisciplinar', icon: Activity },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isCuidados) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.SAUDE_CUIDADOS, label: 'Saúde e Cuidados', icon: HeartPulse },
      { id: AppRoute.MEDICAMENTOS, label: 'Medicamentos', icon: Pill },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isPsicologia || isTerapeutaOcupacional || isFisioterapeuta || isNutricionista) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, label: 'Atendimento Multidisciplinar', icon: Activity },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  }

  const gestaoItems = [
    { id: AppRoute.AMENDMENTS, label: 'Planejamento de Emendas', icon: BarChart3 },
    { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    // Placeholders for future modules
    { id: 'rh' as any, label: 'Recursos Humanos', icon: Users, disabled: true },
    { id: 'financeiro' as any, label: 'Gestão Financeira', icon: DollarSign, disabled: true },
    { id: 'compras' as any, label: 'Compras e Estoque', icon: Package, disabled: true },
  ];

  const menuItems = activeCategory === 'atendimento' ? atendimentoItems : gestaoItems;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      {!isVisitante && (
        <aside 
          className={`${
            isSidebarOpen ? 'w-64' : 'w-20'
          } bg-[#004c99] text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl z-20`}
        >
        <div className="p-4 flex items-center justify-between border-b border-blue-800/50">
          <div className={`flex items-center gap-3 overflow-hidden ${!isSidebarOpen && 'justify-center w-full'}`}>
             <div className="bg-white p-1.5 rounded-full shrink-0 shadow-lg overflow-hidden flex items-center justify-center w-10 h-10">
               {logoUrl ? (
                 <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
               ) : (
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                   <circle cx="50" cy="50" r="45" fill="#004c99" />
                   <path d="M25 50C25 50 40 30 50 30C60 30 75 50 75 50C75 50 60 70 50 70C40 70 25 50 25 50Z" stroke="white" strokeWidth="5" />
                   <circle cx="35" cy="50" r="3" fill="#e31b23" />
                </svg>
               )}
             </div>
            {isSidebarOpen && (
              <span className="font-black text-lg tracking-tighter whitespace-nowrap uppercase">SSVP GESTÃO</span>
            )}
          </div>
        </div>

        {/* Sidebar Category Tabs - Only show Gestão if user has access */}
        {isSidebarOpen && hasGestaoAccess && (
          <div className="mt-8 px-4 flex gap-1">
            <button 
              onClick={() => {
                setActiveCategory('atendimento');
                // Optional: auto-select first item if current route not in this category
                const ids = atendimentoItems.map(i => i.id);
                if (!ids.includes(activeRoute)) {
                  setActiveRoute(ids[0]);
                }
              }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all ${
                activeCategory === 'atendimento' 
                  ? 'bg-white text-[#004c99] shadow-inner font-black' 
                  : 'bg-blue-900/40 text-blue-200 hover:text-white'
              }`}
            >
              Atendimento
            </button>
            <button 
              onClick={() => {
                setActiveCategory('gestao');
                const ids = gestaoItems.map(i => i.id);
                if (!ids.includes(activeRoute)) {
                  setActiveRoute(ids[0]);
                }
              }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all ${
                activeCategory === 'gestao' 
                ? 'bg-white text-[#004c99] shadow-inner font-black' 
                : 'bg-blue-900/40 text-blue-200 hover:text-white'
              }`}
            >
              Gestão
            </button>
          </div>
        )}

        {isSidebarOpen && !hasGestaoAccess && (
          <div className="mt-8 px-4 flex gap-1">
            <div className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl bg-white text-[#004c99] shadow-inner text-center">
              Atendimento
            </div>
          </div>
        )}

        <nav className={`flex-1 overflow-y-auto custom-scrollbar ${isSidebarOpen ? 'px-3 mt-0 mb-4 bg-white/5 rounded-b-2xl mx-1 pt-4' : 'px-3 mt-8'} space-y-2`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            const isDisabled = (item as any).disabled;
            
            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && setActiveRoute(item.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all relative ${
                  isActive 
                    ? 'bg-white text-[#004c99] font-black shadow-xl' 
                    : isDisabled 
                      ? 'text-blue-100/30 font-bold opacity-50 cursor-not-allowed'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white font-bold'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 3 : 2} />
                {isSidebarOpen && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="uppercase text-xs tracking-widest">{item.label}</span>
                    {isDisabled && <span className="text-[8px] opacity-60">Breve</span>}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800/50">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 p-4 text-blue-100 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Menu size={22} />
            {isSidebarOpen && <span className="text-[10px] font-black uppercase tracking-widest">Recolher Menu</span>}
          </button>
        </div>
        <div className="p-6 border-t bg-gray-50/50 flex flex-col gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">Desenvolvido por</span>
            <span className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter">Mirai - Serviços Inteligentes</span>
          </div>
          <button 
            onClick={() => setIsSupportOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#004c99] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg shadow-blue-100"
          >
            <HelpCircle size={16} /> Suporte
          </button>
        </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 bg-white border-b flex items-center justify-between px-10 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-3 text-[10px] font-black tracking-widest text-gray-400 uppercase">
            <span>{institutionName || 'UNIDADE'}</span>
            <ChevronRight size={14} />
            <span className="text-gray-900">
              {activeRoute === AppRoute.VISITANTES ? 'Portal do Visitante' :
               activeRoute === AppRoute.RESIDENTS ? 'Módulo de Residentes' : 
               activeRoute === AppRoute.SCREENING ? 'Módulo de Triagens Social' : 
               activeRoute === AppRoute.SAUDE_CUIDADOS ? 'Saúde e Cuidados' :
               activeRoute === AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES ? 'Atendimento Multidisciplinar' :
               activeRoute === AppRoute.CONSULTAS_MEDICAS ? 'Consulta Médica' :
               activeRoute === AppRoute.AGENDA ? 'Agenda Multidisciplinar' :
               'Configurações do Sistema'}
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            {!isVisitante && (
              <button 
                onClick={() => setIsTeamChatOpen(true)}
                className="relative p-2 text-gray-500 hover:text-[#004c99] transition-colors"
                title="Mural Institucional"
              >
                <MessageCircle size={24} />
                {unreadMural > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadMural > 99 ? '99+' : unreadMural}
                  </span>
                )}
              </button>
            )}
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-gray-900 uppercase tracking-tighter">{institutionName || 'Lar São Vicente de Paulo'}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase">{councilInfo || 'SSVP - Conselho'}</span>
            </div>
            <div className="h-12 w-12 bg-gradient-to-tr from-red-600 to-red-500 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-red-100 transform rotate-3 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1 bg-white" title={institutionName} />
              ) : (
                institutionName ? institutionName.substring(0, 2).toUpperCase() : 'LS'
              )}
            </div>
            
            <div className="flex items-center gap-1 border-l border-gray-100 pl-6">
               {!isVisitante && (
                 <button 
                   onClick={() => setIsPasswordModalOpen(true)}
                   className="p-2.5 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
                   title="Alterar Senha"
                 >
                   <Key size={20} />
                 </button>
               )}
              {onLogout && (
                 <button 
                   onClick={onLogout}
                   className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                   title="Sair do Sistema"
                 >
                   <LogOut size={20} />
                 </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-gray-50/50">
          {children}
        </div>

        <SupportChat 
          isOpen={isSupportOpen} 
          onClose={() => setIsSupportOpen(false)} 
          institutionId={institutionId || cnpj || ''} 
          username={username || ''} 
        />

        <MuralChatPanel 
          isOpen={isTeamChatOpen} 
          onClose={() => setIsTeamChatOpen(false)} 
          institutionId={institutionId || cnpj || ''} 
          cnpj={cnpj}
          username={username || ''} 
        />

        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          userId={userId}
          institutionId={institutionId}
        />
      </main>
    </div>
  );
};

export default Layout;

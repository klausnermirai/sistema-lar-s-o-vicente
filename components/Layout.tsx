
import React, { useState, useEffect } from 'react';
import { Users, ChevronRight, Menu, FileSearch, Settings, HeartPulse, Stethoscope, Activity, MessageCircle } from 'lucide-react';
import { AppRoute } from '../types';
import { getUnreadCount } from '../lib/muralStore';

interface LayoutProps {
  children: React.ReactNode;
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;
  institutionName?: string;
  councilInfo?: string;
  username?: string;
  institutionId?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, activeRoute, setActiveRoute, institutionName, councilInfo, username, institutionId }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [unreadMural, setUnreadMural] = useState(0);

  useEffect(() => {
    if (!institutionId || !username) return;

    const updateUnread = () => {
      setUnreadMural(getUnreadCount(institutionId, username));
    };

    updateUnread();
    window.addEventListener('mural_updated', updateUnread);
    window.addEventListener('mural_read_updated', updateUnread);

    return () => {
      window.removeEventListener('mural_updated', updateUnread);
      window.removeEventListener('mural_read_updated', updateUnread);
    };
  }, [institutionId, username]);

  const menuItems = [
    { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },
    { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
    { id: AppRoute.SAUDE_CUIDADOS, label: 'Saúde e Cuidados', icon: HeartPulse },
    { id: AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, label: 'Atendimento Multidisciplinar', icon: Activity },
    { id: AppRoute.CONSULTAS_MEDICAS, label: 'Consulta Médica', icon: Stethoscope },
    { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-[#004c99] text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl z-20`}
      >
        <div className="p-4 flex items-center justify-between border-b border-blue-800/50">
          <div className={`flex items-center gap-3 overflow-hidden ${!isSidebarOpen && 'justify-center w-full'}`}>
             <div className="bg-white p-1 rounded-full shrink-0 shadow-lg">
               <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="45" fill="#004c99" />
                  <path d="M25 50C25 50 40 30 50 30C60 30 75 50 75 50C75 50 60 70 50 70C40 70 25 50 25 50Z" stroke="white" strokeWidth="5" />
                  <circle cx="35" cy="50" r="3" fill="#e31b23" />
               </svg>
             </div>
            {isSidebarOpen && (
              <span className="font-black text-lg tracking-tighter whitespace-nowrap uppercase">SSVP GESTÃO</span>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-8 px-3 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveRoute(item.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-white text-[#004c99] font-black shadow-xl' 
                    : 'text-blue-100 hover:bg-white/10 hover:text-white font-bold'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 3 : 2} />
                {isSidebarOpen && <span className="uppercase text-xs tracking-widest">{item.label}</span>}
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-20 bg-white border-b flex items-center justify-between px-10 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-3 text-[10px] font-black tracking-widest text-gray-400 uppercase">
            <span>{institutionName || 'UNIDADE'}</span>
            <ChevronRight size={14} />
            <span className="text-gray-900">
              {activeRoute === AppRoute.RESIDENTS ? 'Módulo de Residentes' : 
               activeRoute === AppRoute.SCREENING ? 'Módulo de Triagens Social' : 
               activeRoute === AppRoute.SAUDE_CUIDADOS ? 'Saúde e Cuidados' :
               activeRoute === AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES ? 'Atendimento Multidisciplinar' :
               activeRoute === AppRoute.CONSULTAS_MEDICAS ? 'Consulta Médica' :
               activeRoute === AppRoute.MURAL ? 'Mural Institucional' :
               'Configurações do Sistema'}
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveRoute(AppRoute.MURAL)}
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
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-gray-900 uppercase tracking-tighter">{institutionName || 'Lar São Vicente de Paulo'}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase">{councilInfo || 'SSVP - Conselho'}</span>
            </div>
            <div className="h-12 w-12 bg-gradient-to-tr from-red-600 to-red-500 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-red-100 transform rotate-3">
              {institutionName ? institutionName.substring(0, 2).toUpperCase() : 'LS'}
            </div>
          </div>
        </header>

        <div className={`flex-1 ${activeRoute === AppRoute.MURAL ? 'overflow-hidden p-0' : 'overflow-y-auto p-10'} bg-gray-50/50`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

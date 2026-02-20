
import React from 'react';
import { Users, ChevronRight, Menu, FileSearch, Settings } from 'lucide-react';
import { AppRoute } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeRoute, setActiveRoute }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const menuItems = [
    { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
    { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },
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
            <span>UNIDADE MONTE ALTO</span>
            <ChevronRight size={14} />
            <span className="text-gray-900">
              {activeRoute === AppRoute.RESIDENTS ? 'Módulo de Residentes' : 
               activeRoute === AppRoute.SCREENING ? 'Módulo de Triagens Social' : 'Configurações do Sistema'}
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-gray-900 uppercase tracking-tighter">Lar São Vicente de Paulo</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase">SSVP - Conselho Central</span>
            </div>
            <div className="h-12 w-12 bg-gradient-to-tr from-red-600 to-red-500 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-red-100 transform rotate-3">
              LS
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 bg-gray-50/50">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

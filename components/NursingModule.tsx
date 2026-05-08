import React, { useState, useEffect } from 'react';
import { Resident } from '../types';
import { 
  ShieldCheck, 
  Search,
  ChevronRight,
  ChevronDown,
  Stethoscope,
  Users,
  Settings2,
  Syringe
} from 'lucide-react';
import AppointmentTab from './AppointmentTab';
import CompanionsTab from './CompanionsTab';
import DependenciesTab from './DependenciesTab';
import { SosProtocolsTab } from './SosProtocolsTab';
import { fetchCompanions, saveCompanion, deleteCompanion } from '../lib/api';
import { Companion, InstitutionSettings } from '../types';

export interface NursingModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onBulkSaveResidents?: (residents: Resident[]) => void;
  onPostToMural: (message: any) => void;
  settings?: InstitutionSettings | null;
}

const NursingModule: React.FC<NursingModuleProps> = ({ residents, onSaveResident, onBulkSaveResidents, onPostToMural, settings }) => {
  const [activeSubTab, setActiveSubTab] = useState<'consultas' | 'acompanhantes' | 'dependencias' | 'condutas_sos'>('consultas');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const loadCompanions = async () => {
      try {
        const saved = localStorage.getItem('ssvp_session');
        const session = saved ? JSON.parse(saved) : null;
        const currentInstId = session?.institutionId || session?.cnpj;
        if (!currentInstId) return;

        const data = await fetchCompanions(currentInstId);
        setCompanions(data);
      } catch (err) {
        console.error("Failed to load companions", err);
      }
    };
    loadCompanions();
  }, []);

  const handleSaveCompanion = async (companion: Omit<Companion, 'id' | 'institutionId'> & { id?: string }) => {
    try {
      const savedItem = localStorage.getItem('ssvp_session');
      const session = savedItem ? JSON.parse(savedItem) : null;
      const currentInstId = session?.institutionId || session?.cnpj;
      if (!currentInstId) return;

      const toSave = { ...companion, institutionId: currentInstId };
      const saved = await saveCompanion(toSave);
      
      setCompanions(prev => {
        const exists = prev.find(c => c.id === saved.id);
        if (exists) return prev.map(c => c.id === saved.id ? saved : c);
        return [...prev, saved];
      });
    } catch (err) {
      console.error("Failed to save companion", err);
      alert("Erro ao salvar acompanhante");
    }
  };

  const handleDeleteCompanion = async (id: string) => {
    try {
      if (!window.confirm("Deseja realmente remover este acompanhante?")) return;
      await deleteCompanion(id);
      setCompanions(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Failed to delete companion", err);
      alert("Erro ao excluir acompanhante");
    }
  };


  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedResident = residents.find(r => r.id === selectedResidentId);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.search-container')) {
          setIsDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const renderContent = () => {
    if (activeSubTab === 'acompanhantes') {
      return (
        <CompanionsTab 
          companions={companions}
          onSaveCompanion={handleSaveCompanion}
          onDeleteCompanion={handleDeleteCompanion}
        />
      );
    }

    if (activeSubTab === 'dependencias') {
      return (
        <DependenciesTab 
          residents={residents}
          onBulkSaveResidents={onBulkSaveResidents}
          onSaveResident={onSaveResident}
        />
      );
    }

    if (activeSubTab === 'condutas_sos') {
      const savedItem = localStorage.getItem('ssvp_session');
      const session = savedItem ? JSON.parse(savedItem) : null;
      return (
        <SosProtocolsTab residents={residents} session={session} />
      );
    }

    if (!selectedResident) {
      return (
        <div className="flex flex-col items-center justify-center p-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 h-full">
           <div className="w-20 h-20 bg-white shadow-xl rounded-[32px] flex items-center justify-center mb-6 text-blue-200">
              <Search size={40} />
           </div>
           <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Selecione um residente</h3>
           <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2 font-medium">
             Escolha um idoso na lista lateral para visualizar e gerenciar o histórico de saúde e prescrições.
           </p>
        </div>
      );
    }

    if (activeSubTab === 'consultas') {
      return (
        <AppointmentTab 
          resident={selectedResident}
          companions={companions}
          onUpdateResident={onSaveResident}
          onPostToMural={onPostToMural}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 p-2 h-[calc(100vh-140px)]">
      {/* Top Search Bar - Hidden in Collective Modes */}
      {activeSubTab !== 'acompanhantes' && activeSubTab !== 'dependencias' && (
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#004c99]">
                <Stethoscope size={24} />
             </div>
             <div>
               <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Enfermagem</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Gestão Técnica e Consultas</p>
             </div>
          </div>

          <div className="flex-1 w-full max-w-xl relative search-container group">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
             <input 
               type="text" 
               placeholder="Buscar residente para atendimento..."
               value={searchTerm}
               onFocus={() => setIsDropdownOpen(true)}
               onChange={(e) => {
                 setSearchTerm(e.target.value);
                 if (selectedResidentId) setSelectedResidentId(null);
                 setIsDropdownOpen(true);
               }}
               className="w-full pl-16 pr-12 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-[24px] text-sm font-black uppercase tracking-tight outline-none transition-all shadow-inner"
             />
             <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#004c99] transition-all p-2 flex items-center gap-1 group/btn"
             >
                <span className="text-[9px] font-black uppercase mr-1 hidden sm:inline opacity-60 group-hover/btn:opacity-100 transition-opacity">Ver Todos</span>
                <ChevronDown size={20} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
             </button>

             {/* Search Dropdown */}
             {(searchTerm || isDropdownOpen) && !selectedResidentId && (
               <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-[32px] shadow-2xl z-50 max-h-80 overflow-y-auto no-scrollbar py-4 px-2">
                 {filteredResidents.length > 0 ? (
                   filteredResidents.map(r => (
                     <button
                       key={r.id}
                       onClick={() => {
                         setSelectedResidentId(r.id);
                         setSearchTerm(r.name);
                         setIsDropdownOpen(false);
                       }}
                       className="w-full px-5 py-4 text-left hover:bg-blue-50 rounded-2xl flex items-center gap-5 transition-all group"
                     >
                       <div className="w-12 h-12 bg-white border-2 border-gray-50 rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm group-hover:border-blue-200 overflow-hidden">
                         {r.photo ? <img src={r.photo} className="w-full h-full object-cover" /> : r.name.charAt(0)}
                       </div>
                       <div className="flex-1">
                         <p className="text-xs font-black text-gray-800 uppercase tracking-tight group-hover:text-blue-900">{r.name}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Quarto {r.room || 'N/A'} • CPF {r.cpf.slice(0,3)}...</p>
                       </div>
                     </button>
                   ))
                 ) : (
                   <div className="py-12 flex flex-col items-center justify-center text-gray-400 opacity-50">
                     <Search size={32} className="mb-2" />
                     <p className="text-[10px] font-black uppercase">Nenhum residente encontrado</p>
                   </div>
                 )}
               </div>
             )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-[40px] shadow-sm overflow-hidden min-h-0">
        <div className="flex border-b px-8 bg-white shrink-0 justify-between items-center no-scrollbar overflow-x-auto">
          <div className="flex">
            <button
              onClick={() => setActiveSubTab('consultas')}
              className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
                activeSubTab === 'consultas' 
                  ? 'border-[#004c99] text-[#004c99]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Stethoscope size={16} />
              Consultas e Exames
            </button>
            <button
              onClick={() => setActiveSubTab('dependencias')}
              className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
                activeSubTab === 'dependencias' 
                  ? 'border-[#004c99] text-[#004c99]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Settings2 size={16} />
              Dependências
            </button>
            <button
              onClick={() => setActiveSubTab('acompanhantes')}
              className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
                activeSubTab === 'acompanhantes' 
                  ? 'border-[#004c99] text-[#004c99]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Users size={16} />
              Acompanhantes
            </button>
            <button
              onClick={() => setActiveSubTab('condutas_sos')}
              className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
                activeSubTab === 'condutas_sos' 
                  ? 'border-[#004c99] text-[#004c99]' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Syringe size={16} />
              Condutas SOS
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className={`flex-1 ${activeSubTab === 'acompanhantes' || activeSubTab === 'dependencias' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'} custom-scrollbar bg-gray-50/10`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default NursingModule;

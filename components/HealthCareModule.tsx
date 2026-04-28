import React, { useState } from 'react';
import { Resident, PerData, Medication, DailyRoutineLog, VitalSignEntry, Appointment, MuralMessage } from '../types';
import { 
  ShieldCheck, 
  Search,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Pill,
  Activity,
  CalendarDays,
  HeartPulse,
  Stethoscope,
  RotateCcw
} from 'lucide-react';
import DailyRoutineTab from './DailyRoutineTab';
import VitalSignsTab from './VitalSignsTab';
import AppointmentTab from './AppointmentTab';
import HandoverTab from './HandoverTab';
import { INITIAL_COMPANIONS } from '../constants';

interface HealthCareModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onBulkSaveResidents?: (residents: Resident[]) => void;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const HealthCareModule: React.FC<HealthCareModuleProps> = ({ residents, onSaveResident, onBulkSaveResidents, onPostToMural }) => {
  const [activeSubTab, setActiveSubTab] = useState<'sinais_vitais' | 'rotinas' | 'consultas' | 'plantao'>('rotinas');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const handleCollectiveLogsSave = async (updates: { residentId: string, log: DailyRoutineLog }[]) => {
    if (onBulkSaveResidents) {
      const updatedResidents = residents.map(r => {
        const updateForRes = updates.find(u => u.residentId === r.id);
        if (updateForRes) {
          const newRoutine = updateForRes.log;
          const filtered = (r.dailyRoutines || []).filter(log => !(log.taskId === newRoutine.taskId && log.date === newRoutine.date));
          return { ...r, dailyRoutines: [...filtered, newRoutine] };
        }
        return r;
      }).filter(r => updates.some(u => u.residentId === r.id));
      
      await onBulkSaveResidents(updatedResidents);
    } else {
      for (const { residentId, log } of updates) {
        const resident = residents.find(r => r.id === residentId);
        if (resident) {
          const filtered = (resident.dailyRoutines || []).filter(l => !(l.taskId === log.taskId && l.date === log.date));
          const updatedRoutines = [...filtered, log];
          onSaveResident({ ...resident, dailyRoutines: updatedRoutines });
        }
      }
    }
  };

  const renderContent = () => {
    if (activeSubTab === 'rotinas') {
      return (
        <DailyRoutineTab 
          residents={residents}
          onSaveLogs={handleCollectiveLogsSave}
        />
      );
    }

    if (activeSubTab === 'plantao') {
      return (
        <HandoverTab 
          residents={residents}
          onSaveIncident={(incident) => {
            // Save incident to each involved resident
            incident.residentIds.forEach(rid => {
              const res = residents.find(r => r.id === rid);
              if (res) {
                onSaveResident({
                  ...res,
                  incidents: [incident, ...(res.incidents || [])]
                });
              }
            });
          }}
          onSaveHandover={(handover) => {
            // Handover is usually global, for now we log it as a mural post
            onPostToMural({
              author: handover.nurseName || 'Enfermagem',
              text: `[Saúde/Cuidados] Plantão finalizado (${handover.shift}). Notas: ${handover.notes}`
            });
          }}
          onPostToMural={onPostToMural}
        />
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
          companions={INITIAL_COMPANIONS}
          onUpdateAppointments={(newApps) => {
            onSaveResident({ ...selectedResident, appointments: newApps });
          }}
          onPostToMural={onPostToMural}
        />
      );
    }

    return (
      <VitalSignsTab 
        resident={selectedResident}
        onSave={(entry) => {
          const per = selectedResident.per || { 
            lastUpdated: new Date().toISOString(), 
            vitalSignsHistory: [],
            diagnoses: [],
            allergies: '',
            clinicalHistory: '',
            functionalStatus: { mobility: 'deambula', continence: 'continente', consciousness: 'lucido', dependencyLevel: 'independente' }
          };
          onSaveResident({
            ...selectedResident,
            per: {
              ...per,
              lastUpdated: new Date().toISOString(),
              vitalSignsHistory: [entry, ...(per.vitalSignsHistory || [])]
            }
          });
        }}
      />
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 p-2">
      {/* Top Search Bar - Hidden in Collective Modes */}
      {activeSubTab !== 'rotinas' && activeSubTab !== 'plantao' && (
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#004c99]">
                <HeartPulse size={24} />
             </div>
             <div>
               <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Saúde e Cuidados</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Gestão de Prontuários e Sinais Vitais</p>
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
        {/* Module Sub-tabs */}
        <div className="flex border-b px-8 bg-white shrink-0">
          <button
            onClick={() => setActiveSubTab('rotinas')}
            className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
              activeSubTab === 'rotinas' 
                ? 'border-[#004c99] text-[#004c99]' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <CalendarDays size={16} />
            Plano de Rotinas
          </button>
          <button
            onClick={() => setActiveSubTab('plantao')}
            className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
              activeSubTab === 'plantao' 
                ? 'border-[#004c99] text-[#004c99]' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <RotateCcw size={16} />
            Intercorrências / Plantão
          </button>
          <button
            onClick={() => setActiveSubTab('sinais_vitais')}
            className={`px-8 py-5 text-[10px] font-black uppercase transition-all border-b-4 flex items-center gap-3 h-16 ${
              activeSubTab === 'sinais_vitais' 
                ? 'border-[#004c99] text-[#004c99]' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Activity size={16} />
            Mapa de Sinais Vitais
          </button>
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
        </div>

        {/* Dynamic Content */}
        <div className={`flex-1 ${activeSubTab === 'rotinas' || activeSubTab === 'plantao' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'} custom-scrollbar bg-gray-50/10`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default HealthCareModule;

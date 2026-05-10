import React, { useState, useEffect } from 'react';
import { Resident, PerData, Medication, DailyRoutineLog, VitalSignEntry, Appointment, MuralMessage, ShiftHandover } from '../types';
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
  RotateCcw,
  Tablet,
  Monitor,
  Users,
  Settings2
} from 'lucide-react';
import DailyRoutineTab from './DailyRoutineTab';
import VitalSignsTab from './VitalSignsTab';
import { VitalSignsDailyReport } from './VitalSignsDailyReport';
import HandoverTab from './HandoverTab';
import { OperationalAdministrationTab } from './OperationalAdministrationTab';
import { fetchShifts } from '../lib/api';
import { getCurrentShift, getOperationalDate } from '../lib/shiftUtils';
import { InstitutionSettings } from '../types';

export interface HealthCareModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onBulkSaveResidents?: (residents: Resident[]) => void;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
  settings?: InstitutionSettings | null;
}

const HealthCareModule: React.FC<HealthCareModuleProps> = ({ residents, onSaveResident, onBulkSaveResidents, onPostToMural, settings }) => {
  const [activeSubTab, setActiveSubTab] = useState<'sinais_vitais' | 'rotinas' | 'plantao' | 'ministracao'>('rotinas');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTabletMode, setIsTabletMode] = useState(false);
  const [tabletMenuActive, setTabletMenuActive] = useState(true);
  const [showVitalSignsDailyReport, setShowVitalSignsDailyReport] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);

  useEffect(() => {
    const loadShiftsData = async () => {
      try {
        const saved = localStorage.getItem('ssvp_session');
        if (saved) {
          const session = JSON.parse(saved);
          const data = await fetchShifts(session.institutionId || session.cnpj);
          setShifts(data);
        }
      } catch (err) {}
    };
    loadShiftsData();
  }, []);

  useEffect(() => {
    if (isTabletMode) {
      setTabletMenuActive(true);
    }
  }, [isTabletMode]);
  const [handovers, setHandovers] = useState<ShiftHandover[]>(() => {
    try {
      const saved = localStorage.getItem('ssvp_handovers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    const fetchHandovers = async () => {
      try {
        const saved = localStorage.getItem('ssvp_session');
        const session = saved ? JSON.parse(saved) : null;
        const currentInstId = session?.institutionId || session?.cnpj;
        if (!currentInstId) return;

        const response = await fetch(`/api/handovers?institutionId=${currentInstId}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.id}` }
        });
        if (response.ok) {
          const apiData = await response.json();
          setHandovers(prev => {
            const all = [...apiData, ...prev];
            const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
            return unique.sort((a,b) => b.timestamp - a.timestamp);
          });
        }
      } catch (err) {
        console.error("Failed to load handovers", err);
      }
    };
    fetchHandovers();
  }, []);

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
          isTabletMode={isTabletMode}
          shifts={shifts}
          onPostToMural={onPostToMural}
        />
      );
    }

    if (activeSubTab === 'plantao') {
      return (
        <HandoverTab 
          handovers={handovers}
          residents={residents}
          settings={settings}
          shifts={shifts}
          isTabletMode={isTabletMode}
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
          onSaveHandover={async (handover) => {
            try {
              const savedItem = localStorage.getItem('ssvp_session');
              const session = savedItem ? JSON.parse(savedItem) : null;
              const currentInstId = session?.institutionId || session?.cnpj;
              if (!currentInstId) {
                console.warn("No session for handover");
                return;
              }
              const handoverData = { ...handover, institutionId: currentInstId };
              
              const res = await fetch('/api/handovers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.id}` },
                body: JSON.stringify(handoverData)
              });
              if (res.ok) {
                const saved = await res.json();
                const updatedHandovers = [saved, ...handovers].sort((a,b) => b.timestamp - a.timestamp);
                setHandovers(updatedHandovers);
                localStorage.setItem('ssvp_handovers', JSON.stringify(updatedHandovers));
              }
            } catch (err) {
              console.error("Failed to save handover", err);
              // Fallback
              const updatedHandovers = [handover, ...handovers];
              setHandovers(updatedHandovers);
              localStorage.setItem('ssvp_handovers', JSON.stringify(updatedHandovers));
            }
          }}
          onPostToMural={onPostToMural}
        />
      );
    }

    if (activeSubTab === 'ministracao') {
      const savedItem = localStorage.getItem('ssvp_session');
      const session = savedItem ? JSON.parse(savedItem) : null;
      return (
        <div className="bg-gray-50 h-full w-full p-2">
          <OperationalAdministrationTab residents={residents} session={session} />
        </div>
      );
    }

    if (activeSubTab === 'sinais_vitais' && showVitalSignsDailyReport) {
       return <VitalSignsDailyReport residents={residents} onBack={() => setShowVitalSignsDailyReport(false)} />;
    }

    if (!selectedResident) {
      return (
        <div className="flex flex-col items-center justify-center p-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 h-full">
           <div className="w-20 h-20 bg-white shadow-xl rounded-[32px] flex items-center justify-center mb-6 text-blue-200">
              <Search size={40} />
           </div>
           <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Selecione um residente</h3>
           <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2 font-medium">
             Escolha um idoso na lista lateral para iniciar a coleta de sinais vitais.
           </p>
        </div>
      );
    }

    return (
      <VitalSignsTab 
        resident={selectedResident}
        isTabletMode={isTabletMode}
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

  if (tabletMenuActive) {
    return (
      <div className={`flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500 p-2 ${isTabletMode ? 'fixed inset-0 z-50 bg-gray-50 h-screen overflow-hidden p-6' : 'h-[calc(100vh-140px)]'}`}>
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 mb-8 shrink-0">
          <div>
            <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Saúde e Cuidados</h2>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Selecione uma Operação</p>
          </div>
          <button
            onClick={() => setIsTabletMode(!isTabletMode)}
            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isTabletMode ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            {isTabletMode ? <Monitor size={16} /> : <Tablet size={16} />}
            <span className="hidden sm:inline">{isTabletMode ? 'Sair do Modo Tablet' : 'Modo Tablet'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 content-start px-4 max-w-7xl mx-auto w-full pt-4">
          {[
            { id: 'rotinas', title: 'Plano de Rotinas', desc: 'Controle de atividades e rotinas diárias', icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', shadow: 'shadow-blue-100/50' },
            { id: 'plantao', title: 'Plantão e Intercorrências', desc: 'Registro de turno e eventos', icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', shadow: 'shadow-orange-100/50' },
            { id: 'sinais_vitais', title: 'Mapa de Sinais Vitais', desc: 'Coleta de SV', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', shadow: 'shadow-emerald-100/50' },
            { id: 'ministracao', title: 'Ministração de Medicamentos', desc: 'Checagem de medicações do turno', icon: Pill, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', shadow: 'shadow-purple-100/50' }
          ].map(module => (
            <button
              key={module.id}
              onClick={() => {
                setActiveSubTab(module.id as any);
                setTabletMenuActive(false);
              }}
              className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-100 rounded-[40px] hover:border-gray-300 hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2 h-[340px]"
            >
              <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mb-6 ${module.bg} ${module.color} shadow-2xl ${module.shadow}`}>
                <module.icon size={48} className="group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-3 text-center">{module.title}</h3>
              <p className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">{module.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 animate-in fade-in duration-500 p-2 ${isTabletMode ? 'fixed inset-0 z-50 bg-gray-50 h-screen overflow-hidden p-6' : 'h-[calc(100vh-140px)]'}`}>
      {/* Top Search Bar - Hidden in Collective Modes */}
      {activeSubTab === 'sinais_vitais' && (
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Activity size={24} />
             </div>
             <div>
               <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Mapa de Sinais Vitais</h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Gestão de Prontuários e Sinais Vitais</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowVitalSignsDailyReport(true)}
                className="px-6 py-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
             >
                <ClipboardList size={20} /> Relatório do Dia
             </button>
             <div className="w-full max-w-xl relative search-container group flex-1">
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
               className="w-full pl-16 pr-12 py-5 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-[24px] text-sm font-black uppercase tracking-tight outline-none transition-all shadow-inner"
             />
             <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-all p-2 flex items-center gap-1 group/btn"
             >
                <span className="text-[9px] font-black uppercase mr-1 hidden sm:inline opacity-60 group-hover/btn:opacity-100 transition-opacity">Ver Todos</span>
                <ChevronDown size={20} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
             </button>

             {/* Search Dropdown */}
             {(searchTerm || isDropdownOpen) && !selectedResidentId && (
               <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-[32px] shadow-2xl z-50 max-h-80 overflow-y-auto custom-scrollbar py-4 px-2">
                 {filteredResidents.length > 0 ? (
                   filteredResidents.map(r => (
                     <button
                       key={r.id}
                       onClick={() => {
                         setSelectedResidentId(r.id);
                         setSearchTerm(r.name);
                         setIsDropdownOpen(false);
                       }}
                       className="w-full px-5 py-4 text-left hover:bg-emerald-50 rounded-2xl flex items-center gap-5 transition-all group"
                     >
                       <div className="w-12 h-12 bg-white border-2 border-gray-50 rounded-2xl flex items-center justify-center font-black text-emerald-600 shadow-sm group-hover:border-emerald-200 overflow-hidden">
                         {r.photo ? <img src={r.photo} className="w-full h-full object-cover" /> : r.name.charAt(0)}
                       </div>
                       <div className="flex-1">
                         <p className="text-xs font-black text-gray-800 uppercase tracking-tight group-hover:text-emerald-900">{r.name}</p>
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
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-[40px] shadow-sm overflow-hidden min-h-0">
        <div className="flex border-b px-8 bg-white shrink-0 justify-between items-center py-6 shadow-sm">
          <button
            onClick={() => setTabletMenuActive(true)}
            className="flex items-center gap-3 px-6 py-4 bg-gray-100 hover:bg-gray-200 rounded-2xl text-xs font-black uppercase text-gray-700 transition-all font-bold tracking-widest"
          >
            <ChevronRight className="rotate-180" size={24} />
            Voltar ao Menu
          </button>
          <h2 className="text-2xl font-black uppercase text-gray-900 tracking-tighter">
            {activeSubTab === 'rotinas' ? 'Plano de Rotinas' : activeSubTab === 'plantao' ? 'Plantão e Intercorrências' : activeSubTab === 'ministracao' ? 'Ministração de Medicamentos' : 'Sinais Vitais'}
          </h2>
          <button
            onClick={() => setIsTabletMode(!isTabletMode)}
            className={`shrink-0 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isTabletMode ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            {isTabletMode ? <Monitor size={14} /> : <Tablet size={14} />}
            <span className="hidden sm:inline">{isTabletMode ? 'Sair do Modo Tablet' : 'Modo Tablet'}</span>
          </button>
        </div>

        {/* Dynamic Content */}
        <div className={`flex-1 ${activeSubTab === 'rotinas' || activeSubTab === 'plantao' || activeSubTab === 'ministracao' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'} custom-scrollbar bg-gray-50/10`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default HealthCareModule;

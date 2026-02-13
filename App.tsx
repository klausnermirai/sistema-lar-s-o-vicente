
import React from 'react';
import Layout from './components/Layout';
import ElderlyList from './components/ElderlyList';
import ElderlyForm from './components/ElderlyForm';
import ScreeningModule from './components/ScreeningModule';
import { AppRoute, Resident, SubTab, Candidate } from './types';
import { DUMMY_RESIDENTS, INITIAL_RESIDENT, DUMMY_CANDIDATES } from './constants';
import { ImageIcon, Users, DollarSign, Package, HeartPulse, Stethoscope, Briefcase, FileSearch } from 'lucide-react';

const App: React.FC = () => {
  const [activeRoute, setActiveRoute] = React.useState<AppRoute>(AppRoute.RESIDENTS);
  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('geral');
  const [residents, setResidents] = React.useState<Resident[]>(DUMMY_RESIDENTS);
  const [candidates, setCandidates] = React.useState<Candidate[]>(DUMMY_CANDIDATES);
  const [editingResident, setEditingResident] = React.useState<Resident | null>(null);

  const handleAddResident = () => {
    setEditingResident(INITIAL_RESIDENT);
  };

  const handleEditResident = (resident: Resident) => {
    setEditingResident(resident);
  };

  const handleSaveResident = (data: Resident) => {
    if (data.id) {
      setResidents(prev => prev.map(r => r.id === data.id ? data : r));
    } else {
      const newResident = { ...data, id: Date.now().toString() };
      setResidents(prev => [...prev, newResident]);
    }
    setEditingResident(null);
  };

  const handleSaveCandidate = (candidate: Candidate) => {
    setCandidates(prev => {
      const exists = prev.find(c => c.id === candidate.id);
      if (exists) {
        return prev.map(c => c.id === candidate.id ? candidate : c);
      }
      return [...prev, { ...candidate, id: Date.now().toString() }];
    });
  };

  const tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'geral', label: 'Geral', icon: ImageIcon },
    { id: 'familiares-visitantes', label: 'Familiares e Visitantes', icon: Users },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'itens', label: 'Itens Pessoais', icon: Package },
    { id: 'saude', label: 'Saúde', icon: HeartPulse },
    { id: 'medicamentos', label: 'Medicamentos', icon: Stethoscope },
    { id: 'convenio', label: 'Convênios', icon: Briefcase },
  ];

  return (
    <Layout activeRoute={activeRoute} setActiveRoute={setActiveRoute}>
      {activeRoute === AppRoute.RESIDENTS && (
        <div className="space-y-6">
          {/* Sub-navigation Tabs */}
          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-[#004c99] text-white shadow-md shadow-blue-200'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {editingResident ? (
            <ElderlyForm 
              initialData={editingResident} 
              initialTab={activeSubTab}
              onSave={handleSaveResident} 
              onCancel={() => setEditingResident(null)} 
            />
          ) : (
            <ElderlyList 
              residents={residents} 
              activeSubTab={activeSubTab}
              onAdd={handleAddResident} 
              onEdit={handleEditResident} 
            />
          )}
        </div>
      )}

      {activeRoute === AppRoute.SCREENING && (
        <ScreeningModule 
          candidates={candidates} 
          onSave={handleSaveCandidate}
          residents={residents}
          onAdmit={(candidate) => {
            // Logica básica de transformação de candidato em residente
            const newRes: Resident = {
               ...INITIAL_RESIDENT,
               id: Date.now().toString(),
               name: candidate.name,
               birthDate: candidate.birthDate,
               cpf: candidate.cpf,
               rg: candidate.rg,
               address: candidate.address,
               admissionDate: new Date().toISOString().split('T')[0],
               admissionReason: candidate.admissionReason,
               observations: `Oriundo da triagem realizada em ${candidate.createdAt}.`
            };
            handleSaveResident(newRes);
            handleSaveCandidate({ ...candidate, stage: 'acolhido' });
          }}
        />
      )}
    </Layout>
  );
};

export default App;

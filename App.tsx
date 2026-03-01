
import React from 'react';
import Layout from './components/Layout';
import ElderlyList from './components/ElderlyList';
import ElderlyForm from './components/ElderlyForm';
import ScreeningModule from './components/ScreeningModule';
import SettingsModule from './components/SettingsModule';
import MultidisciplinaryModule from './components/MultidisciplinaryModule';
import LoginScreen from './components/LoginScreen';
import SetupScreen from './components/SetupScreen';
import { AppRoute, Resident, SubTab, Candidate } from './types';
import { DUMMY_RESIDENTS, INITIAL_RESIDENT, DUMMY_CANDIDATES } from './constants';
import { ImageIcon, Users, DollarSign, Package, HeartPulse, Stethoscope, Briefcase, FileSearch, FileText, ClipboardList } from 'lucide-react';
import { loadInstitutionSettings } from './lib/settingsStore';
import { loadUsers } from './lib/usersStore';

// TEMPORÁRIO PARA PROTOTIPAÇÃO: Pular Login/Setup se true
const DEV_BYPASS_AUTH = true;

const App: React.FC = () => {
  const [session, setSession] = React.useState<{ cnpj: string; username: string; accessLevel: string } | null>(() => {
    const saved = localStorage.getItem('ssvp_session');
    
    if (DEV_BYPASS_AUTH && !saved) {
      const devSession = { cnpj: '', username: 'dev', accessLevel: 'gerencial' };
      localStorage.setItem('ssvp_session', JSON.stringify(devSession));
      return devSession;
    }
    
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = React.useState<'login' | 'setup' | 'app'>(
    (session || DEV_BYPASS_AUTH) ? 'app' : 'login'
  );
  const [activeRoute, setActiveRoute] = React.useState<AppRoute>(AppRoute.RESIDENTS);
  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('geral');
  const [residents, setResidents] = React.useState<Resident[]>(DUMMY_RESIDENTS);
  const [candidates, setCandidates] = React.useState<Candidate[]>(DUMMY_CANDIDATES);
  const [editingResident, setEditingResident] = React.useState<Resident | null>(null);

  const handleLoginSuccess = (newSession: { cnpj: string; username: string; accessLevel: string }) => {
    setSession(newSession);
    setView('app');
  };

  const handleSetupComplete = (newSession: { cnpj: string; username: string; accessLevel: string }) => {
    setSession(newSession);
    setView('app');
  };

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
    { id: 'prontuario', label: 'Prontuário Multidisciplinar', icon: FileText },
    { id: 'pia', label: 'PIA', icon: ClipboardList },
  ];

  // Ordem de precedência: Setup -> Login -> App
  if (view === 'setup') {
    return <SetupScreen onSetupComplete={handleSetupComplete} onBackToLogin={() => setView('login')} />;
  }

  if (view === 'login') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onDevSetup={() => setView('setup')} />;
  }

  const settings = loadInstitutionSettings();
  const councilInfo = settings.entityType === 'obra_unida' 
    ? `SSVP - ${settings.centralCouncil || 'Conselho'}`
    : `SSVP - ${settings.councilType || 'Conselho'}`;

  return (
    <Layout 
      activeRoute={activeRoute} 
      setActiveRoute={setActiveRoute}
      institutionName={settings.name}
      councilInfo={councilInfo}
    >
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
            const admissionDate = new Date().toISOString().split('T')[0];
            const newResId = Date.now().toString();
            const newRes: Resident = {
               ...INITIAL_RESIDENT,
               id: newResId,
               name: candidate.name,
               birthDate: candidate.birthDate,
               cpf: candidate.cpf,
               rg: candidate.rg,
               address: candidate.address,
               gender: candidate.gender as any,
               maritalStatus: candidate.maritalStatus,
               admissionDate: admissionDate,
               admissionReason: candidate.admissionReason || candidate.interview?.requestReason || '',
               observations: `Oriundo da triagem realizada em ${candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}.`,
               
               // Campos importados da Triagem
               sourceCandidateId: candidate.id,
               priority: candidate.priority,
               boardOpinion: candidate.boardOpinion,
               medicalOpinion: candidate.medicalOpinion,
               medicalStatus: candidate.medicalStatus,
               integrationDate: candidate.integrationDate,
               integrationReport: candidate.integrationReport,
               interview: candidate.interview
            };
            handleSaveResident(newRes);
            handleSaveCandidate({ ...candidate, stage: 'acolhido', admissionDate, residentId: newResId });
          }}
        />
      )}

      {activeRoute === AppRoute.SAUDE_CUIDADOS && (
        <div className="bg-white p-20 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <HeartPulse size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Saúde e Cuidados</h2>
          <p className="text-gray-500 font-bold uppercase mt-2">Módulo em desenvolvimento</p>
        </div>
      )}

      {activeRoute === AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES && (
        <MultidisciplinaryModule 
          residents={residents} 
          onSaveResident={handleSaveResident} 
        />
      )}

      {activeRoute === AppRoute.CONSULTAS_MEDICAS && (
        <div className="bg-white p-20 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <Stethoscope size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Consulta Médica</h2>
          <p className="text-gray-500 font-bold uppercase mt-2">Módulo em desenvolvimento</p>
        </div>
      )}

      {activeRoute === AppRoute.SETTINGS && <SettingsModule />}
    </Layout>
  );
};

export default App;

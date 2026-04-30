
import React from 'react';
import Layout from './components/Layout';
import ElderlyList from './components/ElderlyList';
import ElderlyForm from './components/ElderlyForm';
import ScreeningModule from './components/ScreeningModule';
import SettingsModule from './components/SettingsModule';
import MultidisciplinaryModule from './components/MultidisciplinaryModule';
import HealthCareModule from './components/HealthCareModule';
import { PlanningEmendasModule } from './components/PlanningEmendasModule';
import MuralModule from './components/MuralModule';
import MedicalModule from './components/MedicalModule';
import MedicationModule from './components/MedicationModule';
import AgendaModule from './components/AgendaModule';
import { VisitorPortal } from './components/VisitorPortal';
import LoginScreen from './components/LoginScreen';
import SetupScreen from './components/SetupScreen';
import { AppRoute, Resident, SubTab, Candidate, InstitutionSettings, MuralMessage } from './types';
import { DUMMY_RESIDENTS, INITIAL_RESIDENT, DUMMY_CANDIDATES } from './constants';
import { ImageIcon, Users, DollarSign, Package, HeartPulse, Stethoscope, Pill, Briefcase, FileSearch, FileText, ClipboardList } from 'lucide-react';


import { fetchResidents, fetchCandidates, saveResident as apiSaveResident, saveCandidate as apiSaveCandidate, bulkSaveCandidates as apiBulkSaveCandidates, bulkSaveResidents as apiBulkSaveResidents, deleteCandidate as apiDeleteCandidate, deleteResident as apiDeleteResident, fetchSettings, Session, saveMuralMessage as apiSaveMuralMessage } from './lib/api';

// TEMPORÁRIO PARA PROTOTIPAÇÃO: Pular Login/Setup se true
const DEV_BYPASS_AUTH = false;

import BirthdaySection from './components/BirthdaySection';
import UpcomingAgendaSection from './components/UpcomingAgendaSection';

const App: React.FC = () => {
  const [session, setSession] = React.useState<Session | null>(() => {
    const saved = localStorage.getItem('ssvp_session');
    if (saved) return JSON.parse(saved);

    if (DEV_BYPASS_AUTH) {
      return {
        cnpj: '52.853.397/0001-68',
        username: 'kwarizaya@gmail.com',
        accessLevel: 'administrador',
        institutionId: '52.853.397/0001-68', // O backend traduzirá o CNPJ para o ID real
        hierarchy: { type: 'obra_unida' }
      };
    }
    return null;
  });

  const [view, setView] = React.useState<'login' | 'setup' | 'app'>(
    (session || DEV_BYPASS_AUTH) ? 'app' : 'login'
  );
  const [activeRoute, setActiveRoute] = React.useState<AppRoute>(() => {
    if (session?.accessLevel === 'medico') return AppRoute.CONSULTAS_MEDICAS;
    if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;
    return AppRoute.HOME;
  });

  React.useEffect(() => {
    if (session?.accessLevel === 'medico' && activeRoute !== AppRoute.CONSULTAS_MEDICAS) {
      setActiveRoute(AppRoute.CONSULTAS_MEDICAS);
    } else if (session?.accessLevel === 'cuidados' && activeRoute === AppRoute.RESIDENTS) {
      setActiveRoute(AppRoute.SAUDE_CUIDADOS);
    } else if (session?.accessLevel === 'visitante' && (activeRoute === AppRoute.RESIDENTS || activeRoute === AppRoute.HOME)) {
      setActiveRoute(AppRoute.VISITANTES);
    }
  }, [session?.accessLevel]);
  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('geral');
  const [residents, setResidents] = React.useState<Resident[]>([]);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [editingResident, setEditingResident] = React.useState<Resident | null>(null);
  const [settings, setSettings] = React.useState<InstitutionSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (session && view === 'app') {
      loadData();
    }
  }, [session?.cnpj, session?.institutionId, view]);

  const loadData = async () => {
    if (!session) return;
    const idToFetch = session.institutionId || session.cnpj;
    if (!idToFetch) return;

    setIsLoading(true);
    try {
      const [residentsData, candidatesData, settingsData] = await Promise.all([
        fetchResidents(idToFetch, session.hierarchy?.type).catch((err) => {
          console.error("Residents fetch error:", err);
          return [];
        }),
        fetchCandidates(idToFetch, session.hierarchy?.type).catch((err) => {
          console.error("Candidates fetch error:", err);
          return [];
        }),
        fetchSettings(idToFetch).catch((err) => {
          console.error("Settings fetch error:", err);
          return null;
        }),
      ]);

      setResidents(residentsData || []);
      setCandidates(candidatesData || []);
      setSettings(settingsData);

      // Se não há configurações e não estamos em bypass, ir para setup
      if (!settingsData && !DEV_BYPASS_AUTH) {
        setView("setup");
      }

      // Migração automática de sessão se o institutionId estava ausente ou era o CNPJ
      if (
        settingsData &&
        settingsData.id &&
        session.institutionId !== settingsData.id
      ) {
        const updatedSession = { ...session, institutionId: settingsData.id };
        setSession(updatedSession);
        localStorage.setItem("ssvp_session", JSON.stringify(updatedSession));
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (newSession: Session) => {
    setSession(newSession);
    setView('app');
  };

  const handleSetupComplete = (newSession: Session) => {
    setSession(newSession);
    setView('app');
  };

  const handleLogout = () => {
    localStorage.removeItem('ssvp_session');
    setSession(null);
    setView('login');
  };

  const handleAddResident = () => {
    setEditingResident(INITIAL_RESIDENT);
  };

  const handleEditResident = async (resident: Resident) => {
    setIsLoading(true);
    try {
      const fullRes = await import('./lib/api').then(m => m.fetchResidentById(resident.id, session?.institutionId || session?.cnpj || ''));
      setEditingResident(fullRes);
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar dados completos');
      setEditingResident(resident); // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResident = async (data: Resident) => {
    try {
      if (!data.id || data.id.startsWith('new_')) {
        const allPeople: any[] = [...residents, ...candidates];
        const dup = allPeople.find(p => (
           (data.cpf && data.cpf.replace(/\D/g, '').length === 11 && p.cpf?.replace(/\D/g, '') === data.cpf.replace(/\D/g, '')) ||
           (data.rg && data.rg.length > 3 && p.rg === data.rg) ||
           ((data as any).sus && (data as any).sus.length > 5 && (p as any).sus === (data as any).sus) ||
           (data.name && data.birthDate && p.name?.toLowerCase().trim() === data.name?.toLowerCase().trim() && p.birthDate === data.birthDate)
        ));
        if (dup) {
           if (!window.confirm(`Atenção: Possível cadastro duplicado encontrado (mesmo CPF, RG, SUS ou Nome e Data de Nascimento).\nCadastro existente: "${dup.name}".\n\nDeseja continuar e salvar mesmo assim?`)) {
              return;
           }
        }
      }

      const saved = await apiSaveResident({ 
        ...data, 
        institutionId: session?.institutionId,
        nacionalId: session?.hierarchy?.nacionalId,
        metropolitanoId: session?.hierarchy?.metropolitanoId,
        centralId: session?.hierarchy?.centralId,
        particularId: session?.hierarchy?.particularId,
        conferenciaId: session?.hierarchy?.conferenciaId
      });
      
      setResidents(prev => {
        const exists = prev.find(r => r.id === saved.id);
        if (exists) {
          return prev.map(r => r.id === saved.id ? saved : r);
        }
        return [...prev, saved];
      });
      setEditingResident(null);
    } catch (error) {
      alert('Erro ao salvar residente');
    }
  };

  const handleSaveCandidate = async (candidate: Candidate) => {
    try {
      if (!candidate.id || candidate.id.startsWith('new_')) {
        const allPeople: any[] = [...residents, ...candidates];
        const dup = allPeople.find(p => (
           (candidate.cpf && candidate.cpf.replace(/\D/g, '').length === 11 && p.cpf?.replace(/\D/g, '') === candidate.cpf.replace(/\D/g, '')) ||
           (candidate.rg && candidate.rg.length > 3 && p.rg === candidate.rg) ||
           ((candidate as any).sus && (candidate as any).sus.length > 5 && (p as any).sus === (candidate as any).sus) ||
           (candidate.name && candidate.birthDate && p.name?.toLowerCase().trim() === candidate.name?.toLowerCase().trim() && p.birthDate === candidate.birthDate)
        ));
        if (dup) {
           if (!window.confirm(`Atenção: Possível cadastro duplicado encontrado (mesmo CPF, RG, SUS ou Nome e Data de Nascimento).\nCadastro existente: "${dup.name}".\n\nDeseja continuar e salvar mesmo assim?`)) {
              return;
           }
        }
      }

      const saved = await apiSaveCandidate({ 
        ...candidate, 
        institutionId: session?.institutionId,
        nacionalId: session?.hierarchy?.nacionalId,
        metropolitanoId: session?.hierarchy?.metropolitanoId,
        centralId: session?.hierarchy?.centralId,
        particularId: session?.hierarchy?.particularId,
        conferenciaId: session?.hierarchy?.conferenciaId
      });
      setCandidates(prev => {
        const exists = prev.find(c => c.id === saved.id);
        if (exists) {
          return prev.map(c => c.id === saved.id ? saved : c);
        }
        return [...prev, saved];
      });
    } catch (error) {
      alert('Erro ao salvar candidato');
    }
  };

  const handleBulkSaveCandidates = async (candidatesToSave: Candidate[]) => {
    try {
      setIsLoading(true);
      const enriched = candidatesToSave.map(c => ({
        ...c,
        institutionId: session?.institutionId,
        nacionalId: session?.hierarchy?.nacionalId,
        metropolitanoId: session?.hierarchy?.metropolitanoId,
        centralId: session?.hierarchy?.centralId,
        particularId: session?.hierarchy?.particularId,
        conferenciaId: session?.hierarchy?.conferenciaId
      }));
      await apiBulkSaveCandidates(enriched);
      // Recarregar dados para garantir consistência
      const idToFetch = session?.institutionId || session?.cnpj;
      if (idToFetch) {
        const candidatesData = await fetchCandidates(idToFetch, session?.hierarchy?.type);
        setCandidates(candidatesData || []);
      }
    } catch (error) {
      alert('Erro ao importar candidatos em massa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      if (!window.confirm('Deseja realmente arquivar este cadastro? Ele não aparecerá mais na lista principal, mas o histórico será preservado.')) return;
      await apiDeleteCandidate(candidateId);
      setCandidates(prev => prev.filter(c => c.id !== candidateId));
    } catch (error) {
      alert('Erro ao arquivar candidato');
    }
  };

  const handleDeleteResident = async (residentId: string) => {
    try {
      if (!window.confirm('Deseja realmente arquivar este residente? Ele não aparecerá mais na lista principal, mas o histórico será preservado.')) return;
      await apiDeleteResident(residentId);
      setResidents(prev => prev.filter(r => r.id !== residentId));
    } catch (error) {
      alert('Erro ao arquivar residente');
    }
  };

  const handleBulkSaveResidents = async (residentsToSave: Resident[]) => {
    try {
      setIsLoading(true);
      const enriched = residentsToSave.map(r => ({
        ...r,
        institutionId: session?.institutionId,
        nacionalId: session?.hierarchy?.nacionalId,
        metropolitanoId: session?.hierarchy?.metropolitanoId,
        centralId: session?.hierarchy?.centralId,
        particularId: session?.hierarchy?.particularId,
        conferenciaId: session?.hierarchy?.conferenciaId
      }));
      await apiBulkSaveResidents(enriched);
      const idToFetch = session?.institutionId || session?.cnpj;
      if (idToFetch) {
        const residentsData = await fetchResidents(idToFetch, session?.hierarchy?.type);
        setResidents(residentsData || []);
      }
    } catch (error) {
      alert('Erro ao importar residentes em massa');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostToMural = async (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => {
    const fullMessage = {
      ...message,
      institutionId: session?.institutionId || session?.cnpj || 'default',
      timestamp: Date.now()
    };
    try {
      await apiSaveMuralMessage(fullMessage);
      // Optional: window.dispatchEvent(new Event('mural_updated'));
    } catch (error) {
      console.error("Error posting to mural:", error);
    }
  };

  let tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'geral', label: 'Geral', icon: ImageIcon },
    { id: 'familiares-visitantes', label: 'Familiares e Visitantes', icon: Users },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'itens', label: 'Itens Pessoais', icon: Package },
    { id: 'prontuario', label: 'Prontuário Multidisciplinar', icon: FileText },
    { id: 'prontuario-medico', label: 'Prontuário Clínico', icon: Stethoscope },
    { id: 'medicamentos', label: 'Medicamentos', icon: Pill },
    { id: 'pia', label: 'PIA', icon: ClipboardList },
  ];

  if (session?.accessLevel === 'psicologia' || session?.accessLevel === 'terapeuta_ocupacional' || session?.accessLevel === 'fisioterapeuta' || session?.accessLevel === 'nutricionista') {
    tabs = tabs.filter(t => t.id !== 'financeiro' && t.id !== 'itens');
  }

  // Ordem de precedência: Setup -> Login -> App
  if (view === 'setup') {
    return <SetupScreen onSetupComplete={handleSetupComplete} onBackToLogin={() => setView('login')} />;
  }

  if (view === 'login') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onDevSetup={() => setView('setup')} logoUrl={settings?.logoUrl} />;
  }

  const getCouncilInfo = () => {
    if (!settings) return 'SSVP - Conselho';
    const type = settings.entityType || settings.type || 'obra_unida';
    const typeMap: Record<string, string> = {
      nacional: 'Conselho Nacional',
      metropolitano: 'Conselho Metropolitano',
      central: 'Conselho Central',
      particular: 'Conselho Particular',
      conferencia: 'Conferência',
      obra_unida: settings.centralId ? `Central: ${settings.centralId}` : 'Obra Unida'
    };
    return `SSVP - ${typeMap[type] || 'Conselho'}`;
  };

  const councilInfo = getCouncilInfo();

  return (
    <div className="relative min-h-screen">
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-[#004c99] rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Dados...</p>
        </div>
      )}
      
      <Layout 
      activeRoute={activeRoute} 
      setActiveRoute={setActiveRoute}
      institutionName={settings?.name || 'Carregando...'}
      councilInfo={councilInfo}
      logoUrl={settings?.logoUrl}
      username={session?.username}
      institutionId={session?.institutionId}
      cnpj={session?.cnpj}
      userId={session?.id}
      onLogout={handleLogout}
      accessLevel={session?.accessLevel}
    >
      
      {activeRoute === AppRoute.HOME && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[500px]">
          <div className="lg:col-span-2 bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-gray-100">
            <MuralModule 
              institutionId={session?.institutionId || session?.cnpj || ''} 
              cnpj={session?.cnpj} 
              username={session?.username || ''}
              muralPhone={settings?.muralPhone}
              accessLevel={session?.accessLevel}
            />
          </div>
          <div className="lg:col-span-1 flex flex-col gap-8">
            <BirthdaySection residents={residents} />
            <UpcomingAgendaSection 
              institutionId={session?.institutionId || session?.cnpj || ''}
              onNavigateToAgenda={() => setActiveRoute(AppRoute.AGENDA)}
            />
          </div>
        </div>
      )}

      {activeRoute === AppRoute.RESIDENTS && (
        <div className="space-y-6">
          {/* Sub-navigation Tabs */}
          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-1 overflow-x-auto custom-scrollbar">
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
              settings={settings}
              onSave={handleSaveResident} 
              onCancel={() => setEditingResident(null)} 
            />
          ) : (
            <ElderlyList 
              residents={residents} 
              activeSubTab={activeSubTab}
              onAdd={handleAddResident} 
              onEdit={handleEditResident} 
              onSave={handleSaveResident}
              onDelete={handleDeleteResident}
              onBulkSave={handleBulkSaveResidents}
            />
          )}
        </div>
      )}

      {activeRoute === AppRoute.SCREENING && (
        <ScreeningModule 
          candidates={candidates} 
          onSave={handleSaveCandidate}
          onBulkSave={handleBulkSaveCandidates}
          onDelete={handleDeleteCandidate}
          residents={residents}
          settings={settings}
          onPostToMural={handlePostToMural}
          onAdmit={async (candidate) => {
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
               interview: candidate.interview,
               per: candidate.nursingScreening ? {
                 lastUpdated: new Date().toISOString(),
                 nursingAdmissionSummary: `Triagem realizada por ${candidate.nursingScreening.professionalName || 'não informado'} em ${new Date(candidate.nursingScreening.date).toLocaleDateString('pt-BR')}.`,
                 vitalSignsHistory: [{
                   date: candidate.nursingScreening.date,
                   ...candidate.nursingScreening.vitalSigns
                 }],
                 diagnoses: candidate.nursingScreening.clinicalHistory.comorbidities,
                 allergies: candidate.nursingScreening.clinicalHistory.allergies,
                 clinicalHistory: candidate.nursingScreening.clinicalHistory.medications,
                 functionalStatus: {
                   mobility: candidate.nursingScreening.functionalAssessment.mobility,
                   continence: candidate.nursingScreening.functionalAssessment.continence,
                   consciousness: candidate.nursingScreening.functionalAssessment.consciousness,
                   dependencyLevel: candidate.nursingScreening.functionalAssessment.dependencyLevel
                 },
                 surgeryHistory: candidate.nursingScreening.clinicalHistory.surgeries,
                 habits: candidate.nursingScreening.clinicalHistory.habits,
                 currentMedications: candidate.nursingScreening.clinicalHistory.medications,
                 healthSupport: {
                   susCard: candidate.nursingScreening.healthSupport.susCard,
                   ubs: candidate.nursingScreening.healthSupport.referenceUBS,
                   doctor: candidate.nursingScreening.healthSupport.referenceDoctor
                 }
               } : undefined
            };
            await handleSaveResident(newRes);
            await handleSaveCandidate({ ...candidate, stage: 'acolhido', admissionDate, residentId: newResId });
            
            // Post notification to mural
            handlePostToMural({
              author: 'Sistema',
              text: `NOVO RESIDENTE: ${newRes.name} foi admitido(a) hoje.`
            });
          }}
        />
      )}

      {activeRoute === AppRoute.SAUDE_CUIDADOS && (
        <HealthCareModule 
          residents={residents} 
          onSaveResident={handleSaveResident} 
          onBulkSaveResidents={handleBulkSaveResidents}
          onPostToMural={handlePostToMural}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES && (
        <MultidisciplinaryModule 
          residents={residents} 
          onSaveResident={handleSaveResident} 
          candidates={candidates}
          onSaveCandidate={handleSaveCandidate}
          accessLevel={session?.accessLevel}
          onPostToMural={handlePostToMural}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.CONSULTAS_MEDICAS && (
        <MedicalModule 
          residents={residents}
          onSaveResident={handleSaveResident}
          candidates={candidates}
          onSaveCandidate={handleSaveCandidate}
          session={session}
          onPostToMural={handlePostToMural}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.AGENDA && (
        <AgendaModule 
          residents={residents} 
          session={session}
          onSaveResident={handleSaveResident}
          onPostToMural={handlePostToMural}
        />
      )}

      {activeRoute === AppRoute.MEDICAMENTOS && (
        <MedicationModule 
          residents={residents} 
          session={session}
          onSaveResident={handleSaveResident}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.GUIAS && (
        <div className="flex h-full items-center justify-center p-8 bg-white/50 backdrop-blur-sm rounded-3xl m-8 border border-gray-100 shadow-sm">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-black text-gray-800 uppercase">Guias</h2>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Módulo em desenvolvimento</p>
          </div>
        </div>
      )}

      {activeRoute === AppRoute.VISITANTES && (
        <VisitorPortal 
          institutionId={session?.institutionId || session?.cnpj || ''} 
          residents={residents} 
          onVisitSaved={() => {}} 
          onSaveResident={handleSaveResident}
        />
      )}

      {activeRoute === AppRoute.AMENDMENTS && session && (
        <PlanningEmendasModule institutionId={session.institutionId || session.cnpj} />
      )}

      {activeRoute === AppRoute.SETTINGS && session && (
        <SettingsModule 
          institutionId={session.institutionId || session.cnpj} 
          onLogout={handleLogout} 
          onSettingsChange={(newSettings) => setSettings(newSettings)}
          accessLevel={session.accessLevel}
          currentUserId={session.id}
        />
      )}
    </Layout>
    </div>
  );
};

export default App;

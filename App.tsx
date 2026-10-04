
import React from 'react';
import Layout from './components/Layout';
import ElderlyList from './components/ElderlyList';
import ElderlyForm from './components/ElderlyForm';
import ScreeningModule from './components/ScreeningModule';
import SettingsModule from './components/SettingsModule';
import { EmployeesModule } from './components/EmployeesModule';
import MultidisciplinaryModule from './components/MultidisciplinaryModule';
import HealthCareModule from './components/HealthCareModule';
import NursingModule from './components/NursingModule';
import { PlanningEmendasModule } from './components/PlanningEmendasModule';
import MuralModule from './components/MuralModule';
import MedicalModule from './components/MedicalModule';
import MedicationModule from './components/MedicationModule';
import AgendaModule from './components/AgendaModule';
import { VisitorPortal } from './components/VisitorPortal';
import LoginScreen from './components/LoginScreen';
import SetupScreen from './components/SetupScreen';
import StockModule from './components/StockModule';
import { FinanceiroModule } from './components/FinanceiroModule';
import { CentralCouncilModule } from './components/CentralCouncilModule';
import { ObrasUnidasModule } from './components/ObrasUnidasModule';
import { ConselhosParticularesModule } from './components/ConselhosParticularesModule';
import { VicentinoMembrosModule } from './components/VicentinoMembrosModule';
import { FamiliasAssistidasModule } from './components/FamiliasAssistidasModule';
import { VicentinoUnderConstructionView } from './components/VicentinoUnderConstructionView';
import { VicentinoMembroExperience } from './components/VicentinoMembroExperience';
import { VicentinoHierarchyProvider } from './components/VicentinoHierarchyContext';
import { PublicMemberRegistrationPage } from './components/PublicMemberRegistrationPage';
import { AiAssistantChat } from './components/AiAssistantChat';
import { AppRoute, Resident, SubTab, Candidate, InstitutionSettings, MuralMessage } from './types';
import { DUMMY_RESIDENTS, INITIAL_RESIDENT, DUMMY_CANDIDATES } from './constants';
import { ImageIcon, Users, DollarSign, Package, HeartPulse, Stethoscope, Pill, Briefcase, FileSearch, FileText, ClipboardList } from 'lucide-react';


import { fetchResidents, fetchCandidates, saveResident as apiSaveResident, saveCandidate as apiSaveCandidate, bulkSaveCandidates as apiBulkSaveCandidates, bulkSaveResidents as apiBulkSaveResidents, deleteCandidate as apiDeleteCandidate, deleteResident as apiDeleteResident, fetchSettings, fetchEmployees, Session, saveMuralMessage as apiSaveMuralMessage, subscribeDbAvailability, subscribeAuthExpired } from './lib/api';
import { sortResidentsByName } from './lib/utils';
import { getCanonicalInstitutionId, isMonteAltoUnit, MONTE_ALTO_OPERATIONAL_ID } from './lib/canonical_units';

// TEMPORÁRIO PARA PROTOTIPAÇÃO: Pular Login/Setup se true
const DEV_BYPASS_AUTH = false;

import BirthdaySection from './components/BirthdaySection';
import UpcomingAgendaSection from './components/UpcomingAgendaSection';

const InternalApp: React.FC = () => {
  const [session, setSession] = React.useState<Session | null>(() => {
    const saved = localStorage.getItem('ssvp_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Sessão antiga sem token ou com formato inválido: encaminha ao login com aviso
        if (!parsed || !parsed.token || typeof parsed.token !== 'string' || !parsed.token.includes('.')) {
          localStorage.removeItem('ssvp_session');
          sessionStorage.setItem('ssvp_auth_notice', 'Sua sessão anterior expirou ou precisa ser renovada. Por favor, faça login novamente.');
          return null;
        }

        if (parsed && parsed.institutionId) {
          const canonicalId = getCanonicalInstitutionId(parsed.institutionId);
          if (canonicalId && canonicalId !== parsed.institutionId) {
            parsed.institutionId = canonicalId;
            localStorage.setItem('ssvp_session', JSON.stringify(parsed));
          }
        }
        return parsed;
      } catch (e) {
        localStorage.removeItem('ssvp_session');
        return null;
      }
    }

    if (DEV_BYPASS_AUTH) {
      return {
        cnpj: '52.853.397/0001-68',
        username: 'kwarizaya@gmail.com',
        accessLevel: 'administrador',
        institutionId: 'NquBdSy0A3ixzHnyj0YF',
        hierarchy: { type: 'obra_unida' }
      };
    }
    return null;
  });

  const [view, setView] = React.useState<'login' | 'setup' | 'app'>(
    (session || DEV_BYPASS_AUTH) ? 'app' : 'login'
  );
  const [loginKey, setLoginKey] = React.useState(0);
  const [activeRoute, setActiveRoute] = React.useState<AppRoute>(() => {
    if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;
    return AppRoute.HOME;
  });

  React.useEffect(() => {
    if (session?.accessLevel === 'visitante' && activeRoute !== AppRoute.VISITANTES) {
      setActiveRoute(AppRoute.VISITANTES);
    }
  }, [session?.accessLevel, activeRoute]);

  const [vicentinoNavContext, setVicentinoNavContext] = React.useState<{ particularId?: string; conferenciaId?: string }>({});

  const handleNavigateVicentino = React.useCallback((targetRoute: AppRoute, context?: { particularId?: string; conferenciaId?: string }) => {
    if (context) {
      setVicentinoNavContext(context);
    }
    setActiveRoute(targetRoute);
  }, []);

  const [activeSubTab, setActiveSubTab] = React.useState<SubTab>('geral');
  const [residents, setResidents] = React.useState<Resident[]>([]);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [editingResident, setEditingResident] = React.useState<Resident | null>(null);
  const [settings, setSettings] = React.useState<InstitutionSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDbUnavailable, setIsDbUnavailable] = React.useState(false);
  const loadingKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const unsubDb = subscribeDbAvailability((unavailable) => {
      setIsDbUnavailable(unavailable);
    });
    const unsubAuth = subscribeAuthExpired(() => {
      setSession(null);
      setActiveRoute(AppRoute.HOME);
      setLoginKey(key => key + 1);
      setView('login');
    });
    return () => {
      unsubDb();
      unsubAuth();
    };
  }, []);

  React.useEffect(() => {
    if (settings) {
      const isCentral = settings.entityType === 'central' || settings.type === 'central';
      const isVicentino = 
        isCentral || 
        settings.entityType === 'particular' || 
        settings.entityType === 'conferencia' || 
        settings.entityType === 'metropolitano' || 
        settings.entityType === 'nacional';

      if (isVicentino) {
        const vicentinoRoutes = [
          AppRoute.VICENTINO_FAMILIAS,
          AppRoute.VICENTINO_MEMBROS,
          AppRoute.VICENTINO_CONFERENCIAS,
          AppRoute.VICENTINO_PARTICULARES,
          AppRoute.VICENTINO_CENTRAL,
          AppRoute.VICENTINO_METROPOLITANO,
          AppRoute.VICENTINO_NACIONAL,
          AppRoute.CENTRAL_INFO,
          AppRoute.CENTRAL_BOARD,
          AppRoute.CENTRAL_OBRAS,
          AppRoute.CENTRAL_CONSELHOS,
          AppRoute.SETTINGS
        ];
        if (activeRoute !== AppRoute.HOME && !vicentinoRoutes.includes(activeRoute)) {
          setActiveRoute(AppRoute.VICENTINO_CONFERENCIAS);
        }
      }
    }
  }, [settings, activeRoute]);

  React.useEffect(() => {
    if (session && view === 'app') {
      loadData();
    } else {
      loadingKeyRef.current = null;
    }
  }, [session?.cnpj, session?.institutionId, view]);

  const loadData = async () => {
    if (!session) return;
    const idToFetch = session.institutionId || session.cnpj;
    if (!idToFetch) return;

    const currentKey = `${session?.cnpj || ''}_${session?.institutionId || ''}`;
    if (loadingKeyRef.current === currentKey) {
      return;
    }
    loadingKeyRef.current = currentKey;

    setIsLoading(true);
    try {
      const FETCH_FAILED = Symbol('FETCH_FAILED');

      const residentsPromise = fetchResidents(idToFetch, session.hierarchy?.type).catch((err) => {
        if (!err?.isDbUnavailable) console.error("Residents fetch error:", err);
        return FETCH_FAILED;
      });

      const candidatesPromise = fetchCandidates(idToFetch, session.hierarchy?.type).catch((err) => {
        if (!err?.isDbUnavailable) console.error("Candidates fetch error:", err);
        return FETCH_FAILED;
      });

      const settingsPromise = fetchSettings(idToFetch).catch((err) => {
        if (!err?.isDbUnavailable) console.error("Settings fetch error:", err);
        return FETCH_FAILED;
      });

      const employeesPromise = fetchEmployees().catch((err) => {
        if (!err?.isDbUnavailable) console.error("Employees fetch error:", err);
        return FETCH_FAILED;
      });

      const [resRes, candRes, settRes, empRes] = await Promise.all([
        residentsPromise,
        candidatesPromise,
        settingsPromise,
        employeesPromise
      ]);

      if (resRes !== FETCH_FAILED) {
        setResidents(sortResidentsByName(resRes || []));
      }

      if (candRes !== FETCH_FAILED) {
        setCandidates(candRes || []);
      }

      if (settRes !== FETCH_FAILED) {
        let finalSettings = settRes || null;
        if (finalSettings && empRes !== FETCH_FAILED) {
          finalSettings.employees = empRes || [];
        }
        setSettings(finalSettings);

        // Se respondeu estritamente null (documento não encontrado), a instituição precisa de setup
        if (settRes === null && !DEV_BYPASS_AUTH) {
          setView("setup");
        }

        if (finalSettings && finalSettings.id) {
          const canonicalFinalId = getCanonicalInstitutionId(finalSettings.id);
          // Atualiza se o valor bruto armazenado na sessão for um ID duplicado/antigo
          if (canonicalFinalId && session.institutionId !== canonicalFinalId) {
            const updatedSession = { ...session, institutionId: canonicalFinalId };
            setSession(updatedSession);
            localStorage.setItem("ssvp_session", JSON.stringify(updatedSession));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
      if (loadingKeyRef.current === currentKey) {
        loadingKeyRef.current = null;
      }
    }
  };

  const handleLoginSuccess = (newSession: Session) => {
    if (newSession.institutionId) {
      newSession.institutionId = getCanonicalInstitutionId(newSession.institutionId);
    }
    setSession(newSession);
    setActiveRoute(newSession.accessLevel === 'visitante' ? AppRoute.VISITANTES : AppRoute.HOME);
    const isMember = 
      newSession.accessLevel === 'membro_conferencia' || 
      newSession.accessLevel === 'membro' || 
      newSession.hierarchy?.type === 'conferencia' ||
      !!newSession.membroId;

    if (isMember) {
      if (newSession.conferenciaId || newSession.hierarchy?.conferenciaId) {
        setVicentinoNavContext({
          particularId: newSession.particularId || newSession.hierarchy?.particularId,
          conferenciaId: newSession.conferenciaId || newSession.hierarchy?.conferenciaId
        });
      }
    }
    setView('app');
  };

  const handleSetupComplete = (newSession: Session) => {
    setSession(newSession);
    setView('app');
  };

  const handleSwitchUnit = (unit: any) => {
    if (!session) return;
    const isConferencia = unit.type === 'conferencia';
    const isCP = unit.type === 'conselho_particular' || unit.type === 'particular';
    const isCentral = unit.type === 'conselho_central' || unit.cnpj === '54.927.132/0001-92';
    
    const hierarchyType = isConferencia ? 'conferencia' : isCP ? 'particular' : isCentral ? 'central' : (unit.type || 'obra_unida');

    const updatedSession: Session = {
      ...session,
      cnpj: unit.cnpj || unit.id,
      institutionId: getCanonicalInstitutionId(unit.id || unit.cnpj),
      hierarchy: {
        ...(session.hierarchy || {}),
        type: hierarchyType,
        centralId: unit.centralId || '54.927.132/0001-92',
        particularId: unit.particularId || (isCP ? unit.id : undefined),
        conferenciaId: isConferencia ? unit.id : undefined
      }
    };
    localStorage.setItem('ssvp_session', JSON.stringify(updatedSession));
    setSession(updatedSession);
    
    // Ajustar rota se apropriado para o novo escopo
    if (isConferencia) {
      setActiveRoute(AppRoute.VICENTINO_CONFERENCIAS);
    } else if (isCP) {
      setActiveRoute(AppRoute.VICENTINO_PARTICULARES);
    } else if (isCentral) {
      setActiveRoute(AppRoute.VICENTINO_CENTRAL);
    }

    setIsLoading(true);
    setTimeout(() => {
      loadData();
    }, 100);
  };

  const handleLogout = () => {
    localStorage.removeItem('ssvp_session');
    setSession(null);
    setActiveRoute(AppRoute.HOME);
    setLoginKey(key => key + 1);
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
        const updated = exists
          ? prev.map(r => r.id === saved.id ? saved : r)
          : [...prev, saved];
        return sortResidentsByName(updated);
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
      setResidents(prev => sortResidentsByName(prev.filter(r => r.id !== residentId)));
    } catch (error) {
      alert('Erro ao arquivar residente');
    }
  };

  const handleBulkSaveResidents = async (residentsToSave: Resident[]) => {
    try {
      setIsLoading(true);
      const CHUNK_SIZE = 10; // 10 residents per request to avoid payload limits
      for (let i = 0; i < residentsToSave.length; i += CHUNK_SIZE) {
        const chunk = residentsToSave.slice(i, i + CHUNK_SIZE);
        const enriched = chunk.map(r => ({
          ...r,
          institutionId: session?.institutionId,
          nacionalId: session?.hierarchy?.nacionalId,
          metropolitanoId: session?.hierarchy?.metropolitanoId,
          centralId: session?.hierarchy?.centralId,
          particularId: session?.hierarchy?.particularId,
          conferenciaId: session?.hierarchy?.conferenciaId
        }));
        await apiBulkSaveResidents(enriched);
      }
      
      const idToFetch = session?.institutionId || session?.cnpj;
      if (idToFetch) {
        const residentsData = await fetchResidents(idToFetch, session?.hierarchy?.type);
        setResidents(sortResidentsByName(residentsData || []));
      }
    } catch (error) {
      console.error('Error in handleBulkSaveResidents:', error);
      alert('Erro ao salvar dados em massa: ' + (error as any).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostToMural = async (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => {
    const isCurrentUserAuthor = message.author === session?.username;
    const authorName = isCurrentUserAuthor ? (message.authorName || session?.fullName || '') : (message.authorName || message.author);
    const authorRole = isCurrentUserAuthor ? (message.authorRole || session?.role || '') : (message.authorRole || '');

    const fullMessage = {
      ...message,
      institutionId: session?.institutionId || session?.cnpj || 'default',
      authorName,
      authorRole,
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

  const allowedFinanceiro = ['administrador', 'gerencial', 'assistente_social', 'auxiliar_administrativo'];
  if (!allowedFinanceiro.includes(session?.accessLevel || '')) {
    tabs = tabs.filter(t => t.id !== 'financeiro');
  }

  if (session?.accessLevel === 'psicologia' || session?.accessLevel === 'terapeuta_ocupacional' || session?.accessLevel === 'fisioterapeuta' || session?.accessLevel === 'nutricionista') {
    tabs = tabs.filter(t => t.id !== 'financeiro' && t.id !== 'itens');
  }

  if (session?.accessLevel === 'auxiliar_administrativo') {
    tabs = tabs.filter(t => t.id === 'geral' || t.id === 'financeiro');
  }

  if (view === 'setup') {
    return <SetupScreen
      onSetupComplete={handleSetupComplete}
      onBackToLogin={() => {
        setLoginKey(key => key + 1);
        setView('login');
      }}
    />;
  }

  if (view === 'login') {
    return <LoginScreen key={loginKey} onLoginSuccess={handleLoginSuccess} onDevSetup={() => setView('setup')} logoUrl={settings?.logoUrl} />;
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
    <VicentinoHierarchyProvider
      userSession={session}
      institutionSettings={settings}
      institutionId={
        (session?.hierarchy?.type === 'central' && session?.cnpj)
          ? session.cnpj
          : (session?.institutionId && session.institutionId !== 'demo-institution-id')
            ? session.institutionId
            : (session?.cnpj || session?.institutionId || '')
      }
    >
      <div className="relative min-h-screen">
        {isLoading && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-[#004c99] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Dados...</p>
          </div>
        )}
        
        {/* EXPERIÊNCIA DEDICADA EXCLUSIVA PARA O VICENTINO COMUM (MEMBRO DE CONFERÊNCIA) */}
        {session && (session.accessLevel === 'membro_conferencia' || session.accessLevel === 'membro' || !!session.membroId) ? (
          <VicentinoMembroExperience 
            session={session}
            onLogout={handleLogout}
          />
        ) : (
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
        entityType={settings?.entityType || settings?.type || session?.hierarchy?.type || session?.institutionType}
        isDbUnavailable={isDbUnavailable}
        onRetry={loadData}
        availableUnits={session?.availableUnits}
        onSwitchUnit={handleSwitchUnit}
        mustChangePassword={session?.mustChangePassword}
        onPasswordChanged={() => {
          if (session) {
            setSession({ ...session, mustChangePassword: false, isFirstLogin: false });
          }
        }}
      >
      
      {activeRoute === AppRoute.HOME && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[500px]">
          <div className="lg:col-span-2 bg-white rounded-3xl overflow-hidden flex flex-col shadow-sm border border-gray-100">
            <MuralModule 
              institutionId={session?.institutionId || session?.cnpj || ''} 
              cnpj={session?.cnpj} 
              username={session?.username || ''}
              fullName={session?.fullName || ''}
              role={session?.role || ''}
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
          {!editingResident && (
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
          )}

          {editingResident ? (
            <ElderlyForm 
              initialData={editingResident} 
              initialTab={activeSubTab}
              settings={settings}
              onSave={handleSaveResident} 
              onCancel={() => setEditingResident(null)} 
              accessLevel={session?.accessLevel}
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
               relatives: candidate.repName ? [{
                 id: `triagem_rep_${candidate.id || Date.now()}`,
                 name: candidate.repName,
                 kinship: candidate.repKinship || 'Responsável',
                 phone: candidate.repPhone || '',
                 observation: 'Representante informado na triagem.',
                 isResponsible: true,
                 deceased: false
               }] : [],
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

      {activeRoute === AppRoute.ENFERMAGEM && (
        <NursingModule 
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
          onBulkSaveResidents={handleBulkSaveResidents}
          settings={settings}
          onPostToMural={handlePostToMural}
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
          accessLevel={session?.accessLevel}
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

      {activeRoute === AppRoute.EMPLOYEES && session && (
        <EmployeesModule 
          session={session}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.STOCK && session && (
        <StockModule 
          session={session}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.FINANCEIRO && session && (
        <FinanceiroModule 
          session={session}
          settings={settings}
        />
      )}

      {activeRoute === AppRoute.CONTROLE_FINANCEIRO_IDOSOS && allowedFinanceiro.includes(session?.accessLevel || '') && (
        <div className="space-y-6">
          {editingResident ? (
            <ElderlyForm 
              initialData={editingResident} 
              initialTab="financeiro"
              financialOnly={true}
              settings={settings}
              onSave={handleSaveResident} 
              onCancel={() => setEditingResident(null)} 
              accessLevel={session?.accessLevel}
            />
          ) : (
            <ElderlyList 
              residents={residents} 
              activeSubTab="financeiro"
              onAdd={handleAddResident} 
              onEdit={handleEditResident} 
              onSave={handleSaveResident}
              onDelete={handleDeleteResident}
              onBulkSave={handleBulkSaveResidents}
            />
          )}
        </div>
      )}

      {/* UNIVERSO VICENTINO: GUIAS E HIERARQUIA */}
      {activeRoute === AppRoute.VICENTINO_FAMILIAS && (
        <FamiliasAssistidasModule
          settings={settings}
          initialParticularId={vicentinoNavContext.particularId}
          initialConferenciaId={vicentinoNavContext.conferenciaId}
          onNavigateToConferencias={(particularId, conferenciaId) =>
            handleNavigateVicentino(AppRoute.VICENTINO_CONFERENCIAS, { particularId, conferenciaId })
          }
          onNavigateToMembros={(particularId, conferenciaId) =>
            handleNavigateVicentino(AppRoute.VICENTINO_MEMBROS, { particularId, conferenciaId })
          }
          institutionId={
            (session?.hierarchy?.type === 'central' && session?.cnpj)
              ? session.cnpj
              : (session?.institutionId && session.institutionId !== 'demo-institution-id')
                ? session.institutionId
                : (session?.cnpj || session?.institutionId || '')
          }
        />
      )}

      {activeRoute === AppRoute.VICENTINO_MEMBROS && (
        <VicentinoMembrosModule
          settings={settings}
          initialParticularId={vicentinoNavContext.particularId}
          initialConferenciaId={vicentinoNavContext.conferenciaId}
          onNavigateToConferencias={(particularId, conferenciaId) =>
            handleNavigateVicentino(AppRoute.VICENTINO_CONFERENCIAS, { particularId, conferenciaId })
          }
          onNavigateToFamilias={(particularId, conferenciaId) =>
            handleNavigateVicentino(AppRoute.VICENTINO_FAMILIAS, { particularId, conferenciaId })
          }
          institutionId={
            (session?.hierarchy?.type === 'central' && session?.cnpj)
              ? session.cnpj
              : (session?.institutionId && session.institutionId !== 'demo-institution-id')
                ? session.institutionId
                : (session?.cnpj || session?.institutionId || '')
          }
        />
      )}

      {(activeRoute === AppRoute.VICENTINO_CONFERENCIAS || activeRoute === AppRoute.VICENTINO_PARTICULARES || activeRoute === AppRoute.CENTRAL_CONSELHOS) && session && (
        <ConselhosParticularesModule 
          activeRoute={activeRoute}
          settings={settings}
          onSettingsChange={(newSettings) => setSettings(newSettings)}
          initialParticularId={vicentinoNavContext.particularId}
          initialConferenciaId={vicentinoNavContext.conferenciaId}
          onNavigateToMembros={(particularId, conferenciaId) =>
            handleNavigateVicentino(AppRoute.VICENTINO_MEMBROS, { particularId, conferenciaId })
          }
          onNavigateToFamilias={(particularId, conferenciaId) =>
            handleNavigateVicentino(AppRoute.VICENTINO_FAMILIAS, { particularId, conferenciaId })
          }
          institutionId={
            (session.hierarchy?.type === 'central' && session.cnpj)
              ? session.cnpj
              : (session.institutionId && session.institutionId !== 'demo-institution-id')
                ? session.institutionId
                : (session.cnpj || session.institutionId || '')
          }
        />
      )}

      {(activeRoute === AppRoute.VICENTINO_CENTRAL || activeRoute === AppRoute.CENTRAL_INFO || activeRoute === AppRoute.CENTRAL_BOARD) && session && (
        <CentralCouncilModule 
          activeRoute={activeRoute === AppRoute.VICENTINO_CENTRAL ? AppRoute.CENTRAL_INFO : activeRoute}
          settings={settings}
          onSettingsChange={(newSettings) => setSettings(newSettings)}
          institutionId={
            (session.hierarchy?.type === 'central' && session.cnpj)
              ? session.cnpj
              : (session.institutionId && session.institutionId !== 'demo-institution-id')
                ? session.institutionId
                : (session.cnpj || session.institutionId || '')
          }
        />
      )}

      {activeRoute === AppRoute.CENTRAL_OBRAS && session && (
        <ObrasUnidasModule 
          settings={settings}
          onSettingsChange={(newSettings) => setSettings(newSettings)}
          institutionId={
            (session.hierarchy?.type === 'central' && session.cnpj)
              ? session.cnpj
              : (session.institutionId && session.institutionId !== 'demo-institution-id')
                ? session.institutionId
                : (session.cnpj || session.institutionId || '')
          }
        />
      )}

      {activeRoute === AppRoute.VICENTINO_METROPOLITANO && (
        <VicentinoUnderConstructionView
          title="Conselho Metropolitano"
          description="Área de coordenação regional e supervisão dos Conselhos Centrais vinculados, relatórios consolidados e diretrizes provinciais."
          badge="Guia do Conselho Metropolitano"
          targetLevel="metropolitano"
          expectedFeatures={[
            'Painel executivo com consolidação de todos os Conselhos Centrais vinculados',
            'Acompanhamento de Obras Unidas e relatórios estatísticos regionais',
            'Circulares, comunicados oficiais e calendário de eventos metropolitanos',
            'Gestão de mandatos e homologações de diretorias dos Conselhos Centrais'
          ]}
        />
      )}

      {activeRoute === AppRoute.VICENTINO_NACIONAL && (
        <VicentinoUnderConstructionView
          title="Conselho Nacional do Brasil (CNB)"
          description="Espaço institucional de nível nacional para diretrizes normativas, censo vicentino, projetos de amplitude nacional e acompanhamento das Obras e Conselhos de todo o Brasil."
          badge="Guia do Conselho Nacional"
          targetLevel="nacional"
          expectedFeatures={[
            'Estatísticas e censo vicentino nacional consolidado em tempo real',
            'Documentos oficiais, Regra da SSVP e circulares normativas do CNB',
            'Acompanhamento de projetos de expansão e fundos de solidariedade vicentina',
            'Canal de comunicação direta com Conselhos Metropolitanos e Centrais'
          ]}
        />
      )}

      {/* Floating AI Assistant for the logged-in institution */}
      {session && <AiAssistantChat session={session} />}
    </Layout>
    )}
    </div>
    </VicentinoHierarchyProvider>
  );
};

/**
 * App (Entry point isolado):
 * Identifica a query string ?cadastro=<TOKEN>.
 * - Se presente: Renderiza exclusivamente PublicMemberRegistrationPage.
 *   Nenhum hook interno, sessão do localStorage ou carregamentos administrativos (residents, candidates, etc.) são montados.
 * - Caso contrário: Renderiza InternalApp com toda a infraestrutura administrativa.
 */
const App: React.FC = () => {
  const publicRegistrationToken = React.useMemo(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const cadastroParam = searchParams.get('cadastro');
      if (cadastroParam && cadastroParam.trim().length > 0) {
        return cadastroParam.trim();
      }
    } catch {
      // Ignora erro de parsing em ambientes sem DOM padrão
    }
    return null;
  }, []);

  if (publicRegistrationToken) {
    return <PublicMemberRegistrationPage token={publicRegistrationToken} />;
  }

  return <InternalApp />;
};

export default App;

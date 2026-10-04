
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ChevronRight, 
  Menu, 
  X, 
  FileSearch, 
  Settings, 
  HeartPulse, 
  Stethoscope, 
  Activity, 
  MessageCircle, 
  LogOut, 
  DollarSign, 
  Package, 
  BarChart3, 
  HelpCircle, 
  Key, 
  Calendar, 
  Pill, 
  FileText, 
  Home, 
  Building2, 
  Layers, 
  AlertTriangle, 
  RefreshCw, 
  Landmark, 
  ArrowLeftRight, 
  Check,
  HeartHandshake,
  Globe2,
  Building,
  UserCheck
} from 'lucide-react';
import { AppRoute } from '../types';
import { getLastReadTimestamp } from '../lib/muralStore';
import { SupportChat } from './SupportChat';
import { MuralChatPanel } from './MuralChatPanel';
import { ChangePasswordModal } from './ChangePasswordModal';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCanonicalInstitutionId, isMonteAltoUnit, getMonteAltoQueryIds } from '../lib/canonical_units';

interface AuthorizedUnit {
  id: string;
  name: string;
  cnpj: string;
  type: string;
  city?: string;
  state?: string;
}

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
  entityType?: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida' | 'lar' | 'ilpi' | string;
  isDbUnavailable?: boolean;
  onRetry?: () => void;
  availableUnits?: AuthorizedUnit[];
  onSwitchUnit?: (unit: AuthorizedUnit) => void;
  mustChangePassword?: boolean;
  onPasswordChanged?: () => void;
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
  accessLevel,
  entityType,
  isDbUnavailable,
  onRetry,
  availableUnits,
  onSwitchUnit,
  mustChangePassword = false,
  onPasswordChanged
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(accessLevel !== 'medico');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [unreadMural, setUnreadMural] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'atendimento' | 'gestao' | 'vicentino'>('atendimento');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isTeamChatOpen, setIsTeamChatOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);

  const normalizedLevel = (accessLevel || '').trim().toLowerCase().replace(/[\s\-_]+/g, '');
  const isGlobalController = String(username || '').trim().toLowerCase() === 'kwarizaya@gmail.com';
  const normalizedEntityType = String(entityType || '').trim().toLowerCase();
  const hasGestaoAccess = 
    normalizedLevel.includes('admin') || 
    normalizedLevel.includes('geren') || 
    normalizedLevel.includes('auxiliar') || 
    normalizedLevel.includes('social') || 
    normalizedLevel.includes('nutri');
  
  // Specific restrictions
  const isEnfermeira = normalizedLevel.includes('enferm') || normalizedLevel.includes('enf');
  const isVisitante = normalizedLevel.includes('visitant');
  const isAssistenteSocial = normalizedLevel.includes('social');
  const isPsicologia = normalizedLevel.includes('psico');
  const isTerapeutaOcupacional = normalizedLevel.includes('terapeut') || normalizedLevel === 'to';
  const isFisioterapeuta = normalizedLevel.includes('fisio');
  const isNutricionista = normalizedLevel.includes('nutri');
  const isMedico = normalizedLevel.includes('medic') || normalizedLevel.includes('doutor');
  const isCuidados = normalizedLevel.includes('cuidado') || normalizedLevel.includes('cuidad');
  const isAuxiliarAdministrativo = normalizedLevel.includes('auxiliar') || normalizedLevel.includes('secretar');
  const isGerencial = normalizedLevel.includes('geren') || normalizedLevel.includes('coord');
  const isOperationalVisitorUnit = ['obra_unida', 'obraunida', 'lar', 'ilpi'].includes(normalizedEntityType.replace(/[\s-]+/g, '_'));
  const canAccessVisitorPortal = isOperationalVisitorUnit && (
    isVisitante ||
    isGlobalController ||
    normalizedLevel.includes('admin') ||
    isGerencial ||
    isAuxiliarAdministrativo
  );

  useEffect(() => {
    // Mural real-time unread count
    const canonicalId = getCanonicalInstitutionId(institutionId || cnpj);
    if (canonicalId && username) {
      const ids = isMonteAltoUnit(canonicalId) ? getMonteAltoQueryIds() : [canonicalId];
      if (cnpj && !ids.includes(cnpj)) {
        ids.push(cnpj);
      }

      const q = query(
        collection(db, 'muralMessages'),
        where('institutionId', 'in', ids),
        orderBy('timestamp', 'desc'),
        limit(15)
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
    const gestaoRoutes = [
      AppRoute.AMENDMENTS, 
      AppRoute.SETTINGS,
      AppRoute.EMPLOYEES,
      AppRoute.STOCK,
      AppRoute.FINANCEIRO,
      AppRoute.CONTROLE_FINANCEIRO_IDOSOS
    ];
    const atendimentoRoutes = [
      AppRoute.HOME,
      AppRoute.SCREENING, 
      AppRoute.RESIDENTS, 
      AppRoute.SAUDE_CUIDADOS, 
      AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, 
      AppRoute.CONSULTAS_MEDICAS,
      AppRoute.ENFERMAGEM,
      AppRoute.MEDICAMENTOS,
      AppRoute.AGENDA,
      AppRoute.GUIAS,
      AppRoute.VISITANTES,
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
    { id: AppRoute.ENFERMAGEM, label: 'Enfermagem', icon: Stethoscope },
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
      { id: AppRoute.ENFERMAGEM, label: 'Enfermagem', icon: Stethoscope },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.MEDICAMENTOS, label: 'Medicamentos', icon: Pill },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isVisitante) {
    atendimentoItems = [
      { id: AppRoute.VISITANTES, label: 'Portal de Visitantes', icon: Users },
    ];
  } else if (isMedico) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
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
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.SAUDE_CUIDADOS, label: 'Saúde e Cuidados', icon: HeartPulse },
      { id: AppRoute.ENFERMAGEM, label: 'Enfermagem', icon: Stethoscope },
      { id: AppRoute.MEDICAMENTOS, label: 'Medicamentos', icon: Pill },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isPsicologia) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, label: 'Atendimento Multidisciplinar', icon: Activity },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isTerapeutaOcupacional || isFisioterapeuta || isNutricionista) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES, label: 'Atendimento Multidisciplinar', icon: Activity },
      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  } else if (isAuxiliarAdministrativo) {
    atendimentoItems = [
      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },
      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
  }

  if (canAccessVisitorPortal && !isVisitante && !atendimentoItems.some(item => item.id === AppRoute.VISITANTES)) {
    const settingsIndex = atendimentoItems.findIndex(item => item.id === AppRoute.SETTINGS);
    const visitorItem = { id: AppRoute.VISITANTES, label: 'Portal de Visitantes', icon: Users };
    if (settingsIndex >= 0) atendimentoItems.splice(settingsIndex, 0, visitorItem);
    else atendimentoItems.push(visitorItem);
  }

  const allowedFinanceiro = ['administrador', 'gerencial', 'assistente_social', 'auxiliar_administrativo'];
  const canAccessFinanceiroIdosos = allowedFinanceiro.includes(accessLevel || '');

  let gestaoItems = [
    { id: AppRoute.AMENDMENTS, label: 'Planejamento de Emendas', icon: BarChart3 },
    { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    { id: AppRoute.EMPLOYEES, label: 'Funcionários (RH)', icon: Users },
    { id: AppRoute.STOCK, label: 'Estoque e Compras', icon: Package },
    { id: AppRoute.FINANCEIRO, label: 'Gestão Financeira', icon: DollarSign },
  ];

  if (canAccessFinanceiroIdosos) {
    gestaoItems.push({ id: AppRoute.CONTROLE_FINANCEIRO_IDOSOS, label: 'Controle Financeiro dos Idosos', icon: DollarSign });
  }

  if (isAuxiliarAdministrativo) {
    gestaoItems = [
      { id: AppRoute.EMPLOYEES, label: 'Funcionários (RH)', icon: Users },
      { id: AppRoute.STOCK, label: 'Estoque e Compras', icon: Package },
      { id: AppRoute.FINANCEIRO, label: 'Gestão Financeira', icon: DollarSign },
      { id: AppRoute.SETTINGS, label: 'Configurações', icon: Settings },
    ];
    if (canAccessFinanceiroIdosos) {
      gestaoItems.splice(3, 0, { id: AppRoute.CONTROLE_FINANCEIRO_IDOSOS, label: 'Controle Financeiro dos Idosos', icon: DollarSign });
    }
  } else if (isAssistenteSocial) {
    gestaoItems = [];
    if (canAccessFinanceiroIdosos) {
      gestaoItems.push({ id: AppRoute.CONTROLE_FINANCEIRO_IDOSOS, label: 'Controle Financeiro dos Idosos', icon: DollarSign });
    }
  } else if (isNutricionista) {
    gestaoItems = [
      { id: AppRoute.STOCK, label: 'Estoque e Compras', icon: Package }
    ];
  }

  const isAdminUser = normalizedLevel.includes('admin') || accessLevel === 'administrador';

  const isMembroConferencia = 
    normalizedLevel.includes('membro') || 
    normalizedLevel === 'membroconferencia' || 
    normalizedLevel === 'conferencia' ||
    (entityType === 'conferencia' && !normalizedLevel.includes('admin'));

  const isVicentino =
    normalizedEntityType === 'central' ||
    normalizedEntityType === 'conselho_central' ||
    normalizedEntityType === 'particular' ||
    normalizedEntityType === 'conselho_particular' ||
    normalizedEntityType === 'conferencia' ||
    normalizedEntityType === 'metropolitano' ||
    normalizedEntityType === 'nacional' ||
    isMembroConferencia;

  const hasVicentinoContext = isVicentino || isGlobalController;

  let vicentinoItems: Array<{ id: AppRoute; label: string; icon: any; disabled?: boolean; tag?: string }> = [];

  if (isMembroConferencia) {
    // Menu especializado e focado para o Membro da Conferência
    vicentinoItems = [
      {
        id: AppRoute.VICENTINO_CONFERENCIAS,
        label: 'Minha Conferência',
        icon: Landmark
      },
      {
        id: AppRoute.VICENTINO_FAMILIAS,
        label: 'Famílias Assistidas',
        icon: HeartHandshake
      },
      {
        id: AppRoute.VICENTINO_MEMBROS,
        label: 'Membros da Conferência',
        icon: Users
      },
      {
        id: AppRoute.SETTINGS,
        label: 'Meu Perfil',
        icon: Settings
      }
    ];
  } else if (hasVicentinoContext) {
    // 1. Conferências
    vicentinoItems.push({
      id: AppRoute.VICENTINO_CONFERENCIAS,
      label: 'Conferências',
      icon: Users
    });

    // 2. Conselhos Particulares
    vicentinoItems.push({
      id: AppRoute.VICENTINO_PARTICULARES,
      label: 'Conselhos Particulares',
      icon: Layers
    });

    // 3. Conselho Central
    vicentinoItems.push({
      id: AppRoute.VICENTINO_CENTRAL,
      label: 'Conselho Central',
      icon: Landmark
    });

    // 4. Obras Unidas e Lares
    vicentinoItems.push({
      id: AppRoute.CENTRAL_OBRAS,
      label: 'Obras Unidas',
      icon: Building2
    });

    // 5. Famílias Assistidas
    vicentinoItems.push({
      id: AppRoute.VICENTINO_FAMILIAS,
      label: 'Famílias Assistidas',
      icon: HeartHandshake
    });

    // 6. Membros e Vicentinos
    vicentinoItems.push({
      id: AppRoute.VICENTINO_MEMBROS,
      label: 'Membros e Vicentinos',
      icon: Users
    });

    // 7. Configurações e Usuários
    vicentinoItems.push({
      id: AppRoute.SETTINGS,
      label: 'Acessos e Configurações',
      icon: Settings
    });
  }

  const hasVicentinoAccess = vicentinoItems.length > 0;

  useEffect(() => {
    if (activeCategory === 'vicentino' && !hasVicentinoAccess) {
      const fallbackCategory = gestaoItems.length > 0 && atendimentoItems.length === 0 ? 'gestao' : 'atendimento';
      setActiveCategory(fallbackCategory);

      const fallbackItems = fallbackCategory === 'gestao' ? gestaoItems : atendimentoItems;
      const fallbackIds = fallbackItems.map(i => i.id);
      if (!fallbackIds.includes(activeRoute)) {
        setActiveRoute(fallbackIds[0] || AppRoute.HOME);
      }
    }
  }, [activeCategory, hasVicentinoAccess, normalizedEntityType]);

  const menuItems = (isVicentino || activeCategory === 'vicentino') 
    ? vicentinoItems 
    : (activeCategory === 'gestao' ? gestaoItems : atendimentoItems);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* Mobile Drawer Backdrop */}
      {!isVisitante && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Static + Mobile Drawer) */}
      {!isVisitante && (
        <aside 
          className={`print:hidden fixed md:static inset-y-0 left-0 z-50 md:z-20 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } ${
            isSidebarOpen ? 'w-72 md:w-64' : 'w-72 md:w-20'
          } bg-[#004c99] text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl`}
        >
        <div className="p-4 flex items-center justify-between border-b border-blue-800/50">
          <div className={`flex items-center gap-3 overflow-hidden ${!isSidebarOpen ? 'md:justify-center w-full' : ''}`}>
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
            <div className="flex flex-col min-w-0">
              <span className="font-black text-lg tracking-tighter whitespace-nowrap uppercase">SSVP GESTÃO</span>
              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest truncate">{institutionName || 'Unidade'}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-blue-200 hover:text-white rounded-lg"
            title="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Category Tabs - Only show Gestão if user has access on Lar/Obra */}
        {hasGestaoAccess && !isVicentino && (
          <div className="mt-4 md:mt-8 px-4 flex gap-1">
            <button 
              onClick={() => {
                setActiveCategory('atendimento');
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
            {hasVicentinoAccess && (
              <button 
                onClick={() => {
                  setActiveCategory('vicentino');
                  setActiveRoute(AppRoute.VICENTINO_CONFERENCIAS);
                }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl transition-all ${
                  activeCategory === 'vicentino' 
                  ? 'bg-white text-[#004c99] shadow-inner font-black' 
                  : 'bg-blue-900/40 text-blue-200 hover:text-white'
                }`}
              >
                Vicentino
              </button>
            )}
          </div>
        )}

        {!hasGestaoAccess && !isVicentino && (
          <div className="mt-4 md:mt-8 px-4 flex gap-1">
            <div className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl bg-white text-[#004c99] shadow-inner text-center">
              Atendimento
            </div>
          </div>
        )}

        {isVicentino && (
          <div className="mt-4 md:mt-8 px-4 flex gap-1">
            <div className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-t-xl bg-white text-[#004c99] shadow-inner text-center flex items-center justify-center gap-1.5">
              <Landmark size={14} className="text-[#004c99]" />
              {entityType === 'conferencia' 
                ? 'Conferência' 
                : entityType === 'particular' 
                ? 'Conselho Particular' 
                : entityType === 'metropolitano'
                ? 'Conselho Metropolitano'
                : entityType === 'nacional'
                ? 'Conselho Nacional'
                : 'Conselho Central'}
            </div>
          </div>
        )}

        <nav className={`flex-1 overflow-y-auto sidebar-scrollbar px-3 mt-0 mb-4 bg-white/5 rounded-b-2xl mx-1 pt-4 space-y-1.5`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            const isDisabled = (item as any).disabled;
            const tag = (item as any).tag;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isDisabled) {
                    setActiveRoute(item.id);
                    setIsMobileMenuOpen(false);
                  }
                }}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 p-3.5 md:p-4 rounded-xl transition-all relative ${
                  isActive 
                    ? 'bg-white text-[#004c99] font-black shadow-xl' 
                    : isDisabled 
                      ? 'text-blue-100/30 font-bold opacity-50 cursor-not-allowed'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white font-bold'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 3 : 2} className="shrink-0" />
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="uppercase text-xs tracking-widest truncate">{item.label}</span>
                  {tag && (
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                      isActive ? 'bg-blue-100 text-blue-800' : 'bg-white/20 text-white'
                    }`}>
                      {tag}
                    </span>
                  )}
                  {isDisabled && !tag && <span className="text-[8px] opacity-60 shrink-0">Breve</span>}
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-2 border-t border-blue-800/40 hidden md:block">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center text-blue-200 hover:text-white hover:bg-white/5 rounded-lg transition-all ${
              isSidebarOpen ? 'w-full gap-2 px-2.5 py-2' : 'w-10 h-10 justify-center mx-auto'
            }`}
            title={isSidebarOpen ? 'Recolher menu' : 'Expandir menu'}
          >
            <Menu size={18} />
            {isSidebarOpen && <span className="text-[9px] font-bold uppercase tracking-widest">Recolher</span>}
          </button>
        </div>
        <div className={`border-t border-blue-100 bg-gray-50/90 ${
          isSidebarOpen ? 'p-3 flex flex-col gap-2' : 'px-2 py-2 flex flex-col items-center gap-2'
        }`}>
          {isSidebarOpen && (
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Desenvolvido por</span>
              <span className="text-[9px] font-black text-[#004c99] uppercase tracking-tight">Mirai - Serviços Inteligentes</span>
            </div>
          )}
          <button 
            onClick={() => {
              setIsSupportOpen(true);
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center justify-center text-[#004c99] hover:bg-blue-50 border border-blue-100 rounded-lg font-bold uppercase transition-all ${
              isSidebarOpen ? 'w-full gap-1.5 py-2 text-[10px] tracking-wider' : 'w-10 h-10'
            }`}
            title="Suporte"
          >
            <HelpCircle size={15} />
            {isSidebarOpen && <span>Suporte</span>}
          </button>
        </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative print:h-auto print:overflow-visible print:block">
        <header className="h-16 sm:h-20 bg-white border-b flex items-center justify-between px-3 sm:px-6 md:px-10 shadow-xs shrink-0 z-10 print:hidden">
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] font-black tracking-widest text-gray-400 uppercase min-w-0">
            {!isVisitante && (
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-gray-700 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all mr-1"
                title="Abrir menu"
              >
                <Menu size={22} />
              </button>
            )}
            <span className="truncate max-w-[100px] sm:max-w-[180px]">{institutionName || 'UNIDADE'}</span>
            <ChevronRight size={14} className="shrink-0" />
            <span className="text-gray-900 truncate">
              {activeRoute === AppRoute.VISITANTES ? 'Portal de Visitantes' :
               activeRoute === AppRoute.RESIDENTS ? 'Módulo de Residentes' : 
               activeRoute === AppRoute.SCREENING ? 'Módulo de Triagens Social' : 
               activeRoute === AppRoute.SAUDE_CUIDADOS ? 'Saúde e Cuidados' :
               activeRoute === AppRoute.ATENDIMENTOS_MULTIDISCIPLINARES ? 'Atendimento Multidisciplinar' :
               activeRoute === AppRoute.CONSULTAS_MEDICAS ? 'Consulta Médica' :
               activeRoute === AppRoute.AGENDA ? 'Agenda Multidisciplinar' :
               activeRoute === AppRoute.STOCK ? 'Estoque e Compras' :
               activeRoute === AppRoute.AMENDMENTS ? 'Planejamento de Emendas' :
               activeRoute === AppRoute.EMPLOYEES ? 'Gestão de Funcionários' :
               activeRoute === AppRoute.FINANCEIRO ? 'Gestão Financeira' :
               activeRoute === AppRoute.CONTROLE_FINANCEIRO_IDOSOS ? 'Controle Financeiro dos Idosos' :
               activeRoute === AppRoute.VICENTINO_FAMILIAS ? 'Famílias Assistidas (SSVP)' :
               activeRoute === AppRoute.VICENTINO_MEMBROS ? 'Membros & Vicentinos (SSVP)' :
               activeRoute === AppRoute.VICENTINO_CONFERENCIAS ? 'Gestão de Conferências' :
               activeRoute === AppRoute.VICENTINO_PARTICULARES ? 'Gestão de Conselhos Particulares' :
               activeRoute === AppRoute.VICENTINO_CENTRAL ? 'Conselho Central de Santo André' :
               activeRoute === AppRoute.VICENTINO_METROPOLITANO ? 'Conselho Metropolitano' :
               activeRoute === AppRoute.VICENTINO_NACIONAL ? 'Conselho Nacional do Brasil (CNB)' :
               activeRoute === AppRoute.CENTRAL_OBRAS ? 'Obras Unidas & Lares' :
               'Configurações do Sistema'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Seletor Rápido de Unidade para Multiacesso */}
            {!isVisitante && availableUnits && availableUnits.length > 1 && onSwitchUnit && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                  className="flex items-center gap-2.5 px-3.5 py-2 bg-blue-50/80 hover:bg-blue-100/80 text-[#004c99] rounded-2xl text-xs font-black uppercase tracking-wider transition-all border border-blue-100 shadow-xs cursor-pointer"
                  title="Alternar entre instituições autorizadas"
                >
                  <ArrowLeftRight size={14} className="text-[#004c99]" />
                  <span className="hidden sm:inline">Trocar Unidade</span>
                  <span className="bg-[#004c99] text-white text-[9px] px-1.5 py-0.5 rounded-full font-mono">{availableUnits.length}</span>
                </button>

                {isUnitDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsUnitDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-2 border-b border-gray-50 mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unidades Autorizadas</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto px-2 space-y-1">
                        {availableUnits.map((u) => {
                          const isCurrent = (institutionId && (u.id === institutionId || u.cnpj === institutionId)) || (cnpj && u.cnpj === cnpj);
                          const isCentral = u.type === 'conselho_central' || u.cnpj === '54.927.132/0001-92';
                          const isCP = u.type === 'conselho_particular' || u.type === 'particular';
                          const isConf = u.type === 'conferencia';

                          return (
                            <button
                              key={u.id || u.cnpj}
                              type="button"
                              onClick={() => {
                                setIsUnitDropdownOpen(false);
                                onSwitchUnit(u);
                              }}
                              className={`w-full text-left p-3 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                isCurrent 
                                  ? 'bg-[#004c99] text-white shadow-md' 
                                  : 'hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isCurrent 
                                    ? 'bg-white/20 text-white' 
                                    : isCentral 
                                      ? 'bg-red-50 text-red-600' 
                                      : isCP 
                                        ? 'bg-purple-50 text-purple-600' 
                                        : isConf 
                                          ? 'bg-emerald-50 text-emerald-600' 
                                          : 'bg-blue-50 text-[#004c99]'
                                }`}>
                                  {isCentral ? (
                                    <Landmark size={18} />
                                  ) : isCP ? (
                                    <Layers size={18} />
                                  ) : isConf ? (
                                    <Users size={18} />
                                  ) : (
                                    <Building2 size={18} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className={`text-[9px] font-black uppercase tracking-wider ${isCurrent ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {isCentral 
                                      ? 'Conselho Central' 
                                      : isCP 
                                        ? 'Conselho Particular' 
                                        : isConf 
                                          ? 'Conferência Vicentina' 
                                          : 'Obra Unida / Lar'}
                                  </div>
                                  <div className="text-xs font-black truncate leading-tight">
                                    {u.name}
                                  </div>
                                </div>
                              </div>
                              {isCurrent && <Check size={16} className="text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

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

        {isDbUnavailable && (
          <div className="bg-amber-50 border-b border-amber-200 px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 text-amber-900 shadow-xs z-20 shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle size={22} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider text-amber-950">Banco de Dados Temporariamente Indisponível</p>
                <p className="text-xs text-amber-800">
                  Não foi possível conectar ao banco de dados no momento. Os dados exibidos na tela foram preservados, mas novas alterações e exclusões estão temporariamente bloqueadas.
                </p>
              </div>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0"
              >
                <RefreshCw size={14} />
                Tentar novamente
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-10 bg-gray-50/50 print:overflow-visible print:h-auto print:p-4 print:bg-white print:block">
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
          accessLevel={accessLevel}
        />

        <ChangePasswordModal
          isOpen={isPasswordModalOpen || mustChangePassword}
          onClose={() => {
            if (!mustChangePassword) {
              setIsPasswordModalOpen(false);
            }
          }}
          userId={userId}
          institutionId={institutionId}
          isForced={mustChangePassword}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            if (onPasswordChanged) onPasswordChanged();
          }}
        />
      </main>
    </div>
  );
};

export default Layout;

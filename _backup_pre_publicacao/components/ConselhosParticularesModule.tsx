import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Users2,
  Users,
  Plus,
  Search,
  Edit,
  PowerOff,
  ChevronRight,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Layers,
  User,
  Shield,
  ShieldAlert,
  LogIn,
  Filter,
  FileText,
  Link2,
  Eye,
  HeartHandshake,
  UserCheck
} from 'lucide-react';
import {
  fetchConselhosParticulares,
  createConselhoParticular,
  updateConselhoParticular,
  inactivateConselhoParticular,
  fetchConferencias,
  createConferencia,
  updateConferencia,
  inactivateConferencia,
  fetchMembrosConferencia,
  importStructure2026,
  HierarchyApiError,
} from '../lib/hierarchy_api';
import { StandaloneConselhoParticular, StandaloneConferencia, MembroSSVP, ConselhoMember } from '../types';
import { ConferenciaMembrosManager } from './ConferenciaMembrosManager';
import { MemberRegistrationManager } from './MemberRegistrationManager';

/**
 * Componente Seletor de Membro da Diretoria
 * Permite selecionar apenas membros ativos da conferência.
 * Localiza membro vinculado mesmo se inativo e exibe alerta visual de substituição.
 * Preserva o nome/telefone de registros legados sem vínculo.
 */
interface BoardMemberSelectorFieldProps {
  idPrefix: string;
  roleLabel: string;
  membroId: string;
  name: string;
  phone: string;
  availableMembros: MembroSSVP[];
  isLoadingMembros: boolean;
  isNewConferencia: boolean;
  onChange: (data: { membroId: string; name: string; phone: string }) => void;
}

const BoardMemberSelectorField: React.FC<BoardMemberSelectorFieldProps> = ({
  idPrefix,
  roleLabel,
  membroId,
  name,
  phone,
  availableMembros,
  isLoadingMembros,
  isNewConferencia,
  onChange,
}) => {
  // Localizar membro vinculado (mesmo se inativo)
  const linkedMembro = membroId
    ? availableMembros.find((m) => m.id === membroId)
    : undefined;

  // Verificar se o membro vinculado está inativo
  const isMembroInativo = Boolean(linkedMembro && linkedMembro.status !== 'ativo');

  // Registro legado (possui nome preenchido, mas não tem membroId vinculado)
  const isLegacyRecord = Boolean(!membroId && name);

  // Lista de opções para nova seleção: somente membros ativos
  const activeMembros = useMemo(() => {
    return availableMembros.filter((m) => m.status === 'ativo');
  }, [availableMembros]);

  return (
    <div className="space-y-1.5" id={`field-board-selector-${idPrefix}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={`select-conf-board-${idPrefix}`}
          className="block text-xs font-semibold text-slate-700"
        >
          {roleLabel}
        </label>
        {isLegacyRecord && (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            Registro legado (sem vínculo)
          </span>
        )}
      </div>

      {isNewConferencia ? (
        <div className="p-2.5 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-500">
          <span className="text-slate-600 block text-[11px]">
            A indicação de membros estará disponível após a criação da Conferência e cadastro dos membros.
          </span>
        </div>
      ) : isLoadingMembros ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          <span>Carregando membros...</span>
        </div>
      ) : (
        <select
          id={`select-conf-board-${idPrefix}`}
          value={membroId || ''}
          onChange={(e) => {
            const selectedId = e.target.value;
            if (!selectedId) {
              onChange({ membroId: '', name: '', phone: '' });
            } else {
              const found = availableMembros.find((m) => m.id === selectedId);
              if (found) {
                const memberPhone = found.phone || found.whatsapp || found.phoneResidential || '';
                onChange({
                  membroId: found.id,
                  name: found.fullName,
                  phone: memberPhone,
                });
              }
            }
          }}
          className={`w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all ${
            isMembroInativo
              ? 'border-amber-400 bg-amber-50/50 text-amber-900 font-medium'
              : 'border-slate-200 text-slate-800'
          }`}
        >
          <option value="">
            {isLegacyRecord
              ? `Manter registro legado (${name})`
              : '-- Selecionar membro ativo da conferência --'}
          </option>

          {/* Se o membro já vinculado estiver inativo, exibir no select para manter visível */}
          {isMembroInativo && linkedMembro && (
            <option value={linkedMembro.id}>
              ⚠️ {linkedMembro.fullName} (Membro Inativo)
            </option>
          )}

          {/* Apenas membros ativos para novas escolhas */}
          {activeMembros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName} {m.type ? `(${m.type})` : ''} {m.phone ? `• ${m.phone}` : ''}
            </option>
          ))}
        </select>
      )}

      {/* Alerta de Inatividade */}
      {isMembroInativo && (
        <div
          id={`alert-inactive-member-${idPrefix}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold shadow-2xs"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Membro inativo — substituição necessária</span>
        </div>
      )}

      {/* Exibição resumida dos dados quando selecionado */}
      {!isMembroInativo && (membroId || isLegacyRecord) && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
          <span className="truncate">
            <strong className="text-slate-700">Nome:</strong> {name || '—'}
          </span>
          {phone && (
            <span className="shrink-0 ml-2 font-mono text-slate-600">
              <Phone className="w-3 h-3 inline mr-1 text-slate-400" />
              {phone}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const getMemberCount = (conf: any, type: 'confrades' | 'consocias' | 'aspirantes'): number => {
  if (!conf) return 0;
  if (conf.countsCache && (conf.countsCache.totalMembros ?? 0) > 0) {
    return Number(conf.countsCache?.[type]) || 0;
  }
  if (conf.legacyCounts?.[type] !== undefined) {
    return Number(conf.legacyCounts[type]) || 0;
  }
  if (conf[type] !== undefined) {
    return Number(conf[type]) || 0;
  }
  if (conf[`${type}Count`] !== undefined) {
    return Number(conf[`${type}Count`]) || 0;
  }
  return 0;
};

interface ConselhosParticularesModuleProps {
  settings?: any;
  onSettingsChange?: (settings: any) => void;
  institutionId?: string;
  initialParticularId?: string;
  initialConferenciaId?: string;
  activeRoute?: string;
  onNavigateToMembros?: (particularId?: string, conferenciaId?: string) => void;
  onNavigateToFamilias?: (particularId?: string, conferenciaId?: string) => void;
}

export const ConselhosParticularesModule: React.FC<ConselhosParticularesModuleProps> = ({
  settings,
  institutionId,
  initialParticularId,
  initialConferenciaId,
  activeRoute,
  onNavigateToMembros,
  onNavigateToFamilias,
}) => {
  // --- Estados Principais ---
  const [activeTab, setActiveTab] = useState<'conferencias' | 'conselhos' | 'autocadastro'>(
    activeRoute === 'vicentino_conferencias' ? 'conferencias' : 'conselhos'
  );
  const [conselhos, setConselhos] = useState<StandaloneConselhoParticular[]>([]);
  const [selectedConselho, setSelectedConselho] = useState<StandaloneConselhoParticular | null>(null);
  const [conferencias, setConferencias] = useState<StandaloneConferencia[]>([]);

  useEffect(() => {
    if (activeRoute === 'vicentino_conferencias') {
      setActiveTab('conferencias');
    } else if (activeRoute === 'vicentino_particulares') {
      setActiveTab('conselhos');
    }
  }, [activeRoute]);

  // --- Estados do Fluxo de Cascata (Guia Conferência) ---
  const isConferenciaRoute = activeRoute === 'vicentino_conferencias';
  const [cascadeCPId, setCascadeCPId] = useState<string>(initialParticularId || '');
  const [cascadeConfId, setCascadeConfId] = useState<string>(initialConferenciaId || '');

  useEffect(() => {
    if (initialParticularId) {
      setCascadeCPId(initialParticularId);
    }
  }, [initialParticularId]);

  useEffect(() => {
    if (initialConferenciaId) {
      setCascadeConfId(initialConferenciaId);
    }
  }, [initialConferenciaId]);
  const [selectedCascadeConf, setSelectedCascadeConf] = useState<StandaloneConferencia | null>(null);
  const [cascadeConfMembros, setCascadeConfMembros] = useState<any[] | null>(null);
  const [loadingCascadeConfMembros, setLoadingCascadeConfMembros] = useState<boolean>(false);

  // Carregamentos e Erros
  const [loadingConselhos, setLoadingConselhos] = useState(true);
  const [loadingConferencias, setLoadingConferencias] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);

  // Filtros
  const [searchCP, setSearchCP] = useState('');
  const [statusFilterCP, setStatusFilterCP] = useState<'all' | 'ativo' | 'inativo'>('ativo');
  const [searchConf, setSearchConf] = useState('');
  const [statusFilterConf, setStatusFilterConf] = useState<'all' | 'ativo' | 'inativo'>('ativo');

  // Modais de Conselho Particular
  const [isCPModalOpen, setIsCPModalOpen] = useState(false);
  const [editingCP, setEditingCP] = useState<StandaloneConselhoParticular | null>(null);
  const [loadingCepCP, setLoadingCepCP] = useState(false);
  const [cpFormData, setCPFormData] = useState({
    name: '',
    code: '',
    institutionDate: '',
    phone: '',
    email: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: '',
    startDate: '',
    endDate: '',
    presidenteNome: '',
    presidenteTelefone: '',
    vicePresidenteNome: '',
    vicePresidenteTelefone: '',
    secretarioNome: '',
    secretarioTelefone: '',
    tesoureiroNome: '',
    tesoureiroTelefone: '',
    ecafoNome: '',
    ecafoTelefone: '',
    coordenadorCCANome: '',
    coordenadorCCATelefone: '',
    notes: '',
  });

  // Modal de Inativação de CP
  const [cpToInactivate, setCpToInactivate] = useState<StandaloneConselhoParticular | null>(null);

  // Modais de Conferência
  const [isConfModalOpen, setIsConfModalOpen] = useState(false);
  const [editingConf, setEditingConf] = useState<StandaloneConferencia | null>(null);
  const [loadingCepConf, setLoadingCepConf] = useState(false);
  const [availableConfMembros, setAvailableConfMembros] = useState<MembroSSVP[]>([]);
  const [loadingAvailableMembros, setLoadingAvailableMembros] = useState(false);
  const [confFormData, setConfFormData] = useState({
    name: '',
    code: '',
    foundationDate: '',
    aggregationDate: '',
    location: '',
    meetingDay: '',
    meetingTime: '',
    phone: '',
    email: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: '',
    startDate: '',
    endDate: '',
    presidenteMembroId: '',
    presidenteNome: '',
    presidenteTelefone: '',
    vicePresidenteMembroId: '',
    vicePresidenteNome: '',
    vicePresidenteTelefone: '',
    secretarioMembroId: '',
    secretarioNome: '',
    secretarioTelefone: '',
    segundoSecretarioMembroId: '',
    segundoSecretarioNome: '',
    segundoSecretarioTelefone: '',
    tesoureiroMembroId: '',
    tesoureiroNome: '',
    tesoureiroTelefone: '',
    segundoTesoureiroMembroId: '',
    segundoTesoureiroNome: '',
    segundoTesoureiroTelefone: '',
    confrades: 0,
    consocias: 0,
    aspirantes: 0,
    notes: '',
  });

  // Modal de Inativação de Conferência
  const [confToInactivate, setConfToInactivate] = useState<StandaloneConferencia | null>(null);

  // Modal / Tela de Membros da Conferência
  const [managingMembrosConf, setManagingMembrosConf] = useState<StandaloneConferencia | null>(null);

  // Modal de Ficha Detalhada da Conferência
  const [selectedConfDetalhes, setSelectedConfDetalhes] = useState<StandaloneConferencia | null>(null);
  const [detalhesConfMembros, setDetalhesConfMembros] = useState<MembroSSVP[]>([]);
  const [loadingDetalhesConfMembros, setLoadingDetalhesConfMembros] = useState(false);

  useEffect(() => {
    if (selectedConfDetalhes?.id) {
      setLoadingDetalhesConfMembros(true);
      fetchMembrosConferencia(selectedConfDetalhes.id, { status: 'todos' })
        .then((data) => setDetalhesConfMembros(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error('Erro ao carregar membros para ficha da conferência:', err);
          setDetalhesConfMembros([]);
        })
        .finally(() => setLoadingDetalhesConfMembros(false));
    } else {
      setDetalhesConfMembros([]);
    }
  }, [selectedConfDetalhes?.id]);

  // Modal de Ficha Detalhada do Conselho Particular
  const [selectedCPDetalhes, setSelectedCPDetalhes] = useState<StandaloneConselhoParticular | null>(null);

  // Modal e Estado de Importação Estrutura 2026 (Exclusivo Administrador Jaboticabal)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportingStructure, setIsImportingStructure] = useState(false);
  const [importReport, setImportReport] = useState<{
    created: { cps: number; conferencias: number };
    ignored: { cps: number; conferencias: number };
    conflicts: { cps: number; conferencias: number };
  } | null>(null);

  // Verificação de elegibilidade do usuário para a importação administrativa
  const userSession = useMemo(() => {
    try {
      const raw = localStorage.getItem('ssvp_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Mapeamento e filtragem de nível de acesso às unidades da hierarquia
  const userUnitKeys = useMemo(() => {
    if (!userSession) return new Set<string>();
    const keys = new Set<string>();
    if (userSession.institutionId) keys.add(userSession.institutionId);
    if (userSession.cnpj) keys.add(userSession.cnpj);
    if (userSession.conferenciaId) keys.add(userSession.conferenciaId);
    if (userSession.particularId) keys.add(userSession.particularId);
    if (userSession.hierarchy?.conferenciaId) keys.add(userSession.hierarchy.conferenciaId);
    if (userSession.hierarchy?.particularId) keys.add(userSession.hierarchy.particularId);
    if (userSession.user?.conferenciaId) keys.add(userSession.user.conferenciaId);
    if (userSession.user?.particularId) keys.add(userSession.user.particularId);
    if (Array.isArray(userSession.institutionIds)) {
      userSession.institutionIds.forEach((i: any) => i && keys.add(typeof i === 'string' ? i : i.id || i.cnpj));
    }
    if (Array.isArray(userSession.authorizedUnits)) {
      userSession.authorizedUnits.forEach((i: any) => i && keys.add(typeof i === 'string' ? i : i.id || i.cnpj));
    }
    if (Array.isArray(userSession.allowedUnits)) {
      userSession.allowedUnits.forEach((i: any) => {
        if (!i) return;
        if (typeof i === 'string') keys.add(i);
        else {
          if (i.id) keys.add(i.id);
          if (i.cnpj) keys.add(i.cnpj);
          if (i.name) keys.add(i.name.toLowerCase());
          if (i.conferenciaId) keys.add(i.conferenciaId);
          if (i.particularId) keys.add(i.particularId);
        }
      });
    }
    return keys;
  }, [userSession]);

  const isGlobalUser = useMemo(() => {
    if (!userSession) return true;
    return (
      userSession.hasAllUnitsAccess === true ||
      userSession.accessLevel === 'administrador' ||
      userSession.accessLevel === 'super_admin' ||
      userSession.role === 'admin' ||
      userSession.isAdmin === true
    );
  }, [userSession]);

  const accessibleConselhos = useMemo(() => {
    const list = Array.isArray(conselhos) ? conselhos : [];
    if (isGlobalUser || userUnitKeys.size === 0) return list;
    return list.filter((cp) => {
      const cpId = cp.id || '';
      const cpName = (cp.name || '').toLowerCase();
      return userUnitKeys.has(cpId) || userUnitKeys.has(cpName);
    });
  }, [conselhos, isGlobalUser, userUnitKeys]);

  const accessibleConferencias = useMemo(() => {
    const list = Array.isArray(conferencias) ? conferencias : [];
    if (isGlobalUser || userUnitKeys.size === 0) return list;
    return list.filter((conf) => {
      const confId = conf.id || '';
      const confName = (conf.name || '').toLowerCase();
      return userUnitKeys.has(confId) || userUnitKeys.has(confName);
    });
  }, [conferencias, isGlobalUser, userUnitKeys]);

  const isEligibleForImport = useMemo(() => {
    if (!userSession) return false;
    const isAdmin = userSession.accessLevel === 'administrador' || userSession.role === 'admin' || userSession.isAdmin === true;
    const isCentralJaboticabal =
      userSession.cnpj === '54.927.132/0001-92' ||
      userSession.institutionId === '54.927.132/0001-92' ||
      institutionId === '54.927.132/0001-92' ||
      (userSession.hierarchy?.type === 'central' && (userSession.cnpj === '54.927.132/0001-92' || !userSession.institutionId));
    return isAdmin && isCentralJaboticabal;
  }, [userSession, institutionId]);

  const centralName = settings?.name || 'Conselho Central';

  const handleExecuteImportStructure2026 = async () => {
    setIsImportingStructure(true);
    setErrorMessage(null);
    try {
      const res = await importStructure2026(institutionId);
      setImportReport({
        created: res.created,
        ignored: res.ignored,
        conflicts: res.conflicts,
      });
      showNotification(
        `Estrutura 2026 importada com sucesso: ${res.created.cps} Conselhos Particulares e ${res.created.conferencias} Conferências criadas!`
      );
      setIsImportModalOpen(false);
      await loadConselhos();
    } catch (err: any) {
      console.error('Erro ao executar importação da estrutura 2026:', err);
      showNotification(err?.message || 'Falha ao executar importação da estrutura 2026.', true);
    } finally {
      setIsImportingStructure(false);
    }
  };

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 6000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // --- Carregamento de Conselhos Particulares ---
  const loadConselhos = useCallback(async () => {
    setLoadingConselhos(true);
    setErrorMessage(null);
    setAuthError(false);
    try {
      const data = await fetchConselhosParticulares(
        statusFilterCP === 'all' ? undefined : statusFilterCP,
        institutionId
      );
      setConselhos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erro ao carregar Conselhos Particulares:', err);
      setConselhos([]);
      const isAuthErr = 
        err?.statusCode === 401 ||
        (err instanceof HierarchyApiError && err.statusCode === 401) ||
        (typeof err?.message === 'string' && (
          err.message.includes('Token ausente') ||
          err.message.includes('Não autorizado') ||
          err.message.includes('Usuário inválido')
        ));
      
      if (isAuthErr) {
        setAuthError(true);
      } else {
        showNotification(err?.message || 'Falha ao buscar Conselhos Particulares.', true);
      }
    } finally {
      setLoadingConselhos(false);
    }
  }, [statusFilterCP, institutionId]);

  useEffect(() => {
    loadConselhos();
  }, [loadConselhos]);

  // --- Carregamento de Conferências ---
  const loadConferencias = useCallback(async (particularId: string) => {
    setLoadingConferencias(true);
    setErrorMessage(null);
    try {
      const data = await fetchConferencias(
        particularId,
        statusFilterConf === 'all' ? undefined : statusFilterConf,
        institutionId
      );
      setConferencias(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erro ao carregar Conferências:', err);
      setConferencias([]);
      const isAuthErr = 
        err?.statusCode === 401 ||
        (err instanceof HierarchyApiError && err.statusCode === 401) ||
        (typeof err?.message === 'string' && (
          err.message.includes('Token ausente') ||
          err.message.includes('Não autorizado') ||
          err.message.includes('Usuário inválido')
        ));
      if (isAuthErr) {
        setAuthError(true);
      } else {
        showNotification(err?.message || 'Falha ao carregar Conferências.', true);
      }
    } finally {
      setLoadingConferencias(false);
    }
  }, [statusFilterConf, institutionId]);

  useEffect(() => {
    if (selectedConselho) {
      loadConferencias(selectedConselho.id);
    }
  }, [selectedConselho, loadConferencias]);

  useEffect(() => {
    const targetCPId = initialParticularId || userSession?.hierarchy?.particularId || userSession?.user?.particularId || userSession?.particularId;
    if (targetCPId && conselhos.length > 0) {
      const foundCP = conselhos.find(c => c.id === targetCPId);
      if (foundCP) {
        setSelectedConselho(foundCP);
        setCascadeCPId(foundCP.id);
      }
    }
  }, [initialParticularId, conselhos, userSession]);

  useEffect(() => {
    const targetConfId = initialConferenciaId || userSession?.hierarchy?.conferenciaId || userSession?.user?.conferenciaId || userSession?.conferenciaId;
    if (targetConfId && conferencias.length > 0) {
      const foundConf = conferencias.find(c => c.id === targetConfId);
      if (foundConf) {
        setSelectedCascadeConf(foundConf);
        setCascadeConfId(foundConf.id);
      }
    }
  }, [initialConferenciaId, conferencias, userSession]);

  // Efeitos da Seleção em Cascata (Conferência)
  useEffect(() => {
    if (accessibleConselhos.length > 0 && !cascadeCPId) {
      if (accessibleConselhos.length === 1) {
        const singleCP = accessibleConselhos[0];
        setCascadeCPId(singleCP.id);
        setSelectedConselho(singleCP);
      }
    }
  }, [accessibleConselhos, cascadeCPId]);

  useEffect(() => {
    if (cascadeCPId) {
      const cp = conselhos.find((c) => c.id === cascadeCPId);
      if (cp && (!selectedConselho || selectedConselho.id !== cp.id)) {
        setSelectedConselho(cp);
      }
    }
  }, [cascadeCPId, conselhos, selectedConselho]);

  useEffect(() => {
    if (accessibleConferencias.length > 0) {
      if (cascadeConfId) {
        const conf = accessibleConferencias.find((c) => c.id === cascadeConfId);
        if (conf) {
          setSelectedCascadeConf(conf);
        }
      } else if (accessibleConferencias.length === 1 && (isConferenciaRoute || activeRoute === 'vicentino_conferencias') && !selectedCascadeConf) {
        const singleConf = accessibleConferencias[0];
        setCascadeConfId(singleConf.id);
        setSelectedCascadeConf(singleConf);
      }
    }
  }, [accessibleConferencias, cascadeConfId, isConferenciaRoute, activeRoute, selectedCascadeConf]);

  // Busca de Membros Ativos em Tempo Real para a Conferência em Cascata
  const reloadCascadeConfMembros = useCallback(async (confId: string) => {
    if (!confId) {
      setCascadeConfMembros(null);
      return;
    }
    setLoadingCascadeConfMembros(true);
    try {
      const list = await fetchMembrosConferencia(confId, { status: 'ativo' });
      setCascadeConfMembros(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Erro ao buscar membros da conferência em cascata:', err);
      setCascadeConfMembros([]);
    } finally {
      setLoadingCascadeConfMembros(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCascadeConf?.id) {
      reloadCascadeConfMembros(selectedCascadeConf.id);
    } else {
      setCascadeConfMembros(null);
    }
  }, [selectedCascadeConf?.id, reloadCascadeConfMembros]);

  // Estatísticas de Membros Consolidadas
  const liveCounts = useMemo(() => {
    if (!selectedCascadeConf) {
      return { confrades: 0, consocias: 0, aspirantes: 0, auxiliares: 0, total: 0 };
    }

    if (cascadeConfMembros !== null) {
      let confrades = 0;
      let consocias = 0;
      let aspirantes = 0;
      let auxiliares = 0;

      cascadeConfMembros.forEach((m) => {
        const type = (m.type || '').toLowerCase();
        if (type === 'confrade') confrades++;
        else if (type === 'consocia' || type === 'consócia') consocias++;
        else if (type === 'aspirante') aspirantes++;
        else if (type === 'auxiliar') auxiliares++;
        else {
          if (m.gender === 'feminino') consocias++;
          else confrades++;
        }
      });

      return {
        confrades,
        consocias,
        aspirantes,
        auxiliares,
        total: confrades + consocias + aspirantes + auxiliares,
      };
    }

    const confrades = getMemberCount(selectedCascadeConf, 'confrades');
    const consocias = getMemberCount(selectedCascadeConf, 'consocias');
    const aspirantes = getMemberCount(selectedCascadeConf, 'aspirantes');
    const total = (selectedCascadeConf as any).countsCache?.totalMembros ?? (confrades + consocias + aspirantes);

    return { confrades, consocias, aspirantes, auxiliares: 0, total };
  }, [selectedCascadeConf, cascadeConfMembros]);

  // --- Filtros Computados ---
  const filteredConselhos = useMemo(() => {
    const list = Array.isArray(conselhos) ? conselhos : [];
    return list.filter((cp) => {
      const q = (searchCP || '').toLowerCase().trim();
      const matchSearch =
        !q ||
        (cp.name || '').toLowerCase().includes(q) ||
        (cp.city && cp.city.toLowerCase().includes(q)) ||
        (cp.presidente?.name && cp.presidente.name.toLowerCase().includes(q));

      const matchStatus = statusFilterCP === 'all' || cp.status === statusFilterCP;
      return matchSearch && matchStatus;
    });
  }, [conselhos, searchCP, statusFilterCP]);

  const cpStats = useMemo(() => {
    const list = Array.isArray(conselhos) ? conselhos : [];
    const total = list.length;
    const ativos = list.filter((c) => c.status === 'ativo').length;
    let totalConferencias = 0;
    let totalMembros = 0;
    list.forEach((cp) => {
      totalConferencias += cp.conferenciasCount || (cp as any).conferencias?.length || 0;
      totalMembros += cp.membrosCount || 0;
    });
    return {
      total,
      ativos,
      inativos: total - ativos,
      totalConferencias,
      totalMembros,
    };
  }, [conselhos]);

  const filteredConferencias = useMemo(() => {
    const list = Array.isArray(conferencias) ? conferencias : [];
    return list.filter((conf) => {
      const q = (searchConf || '').toLowerCase().trim();
      const matchSearch =
        !q ||
        (conf.name || '').toLowerCase().includes(q) ||
        (conf.code && conf.code.toLowerCase().includes(q)) ||
        (conf.location && conf.location.toLowerCase().includes(q)) ||
        (conf.meetingDay && conf.meetingDay.toLowerCase().includes(q)) ||
        (conf.presidente?.name && conf.presidente.name.toLowerCase().includes(q));

      const matchStatus = statusFilterConf === 'all' || conf.status === statusFilterConf;
      return matchSearch && matchStatus;
    });
  }, [conferencias, searchConf, statusFilterConf]);

  const confStats = useMemo(() => {
    const list = Array.isArray(conferencias) ? conferencias : [];
    const total = list.length;
    const ativas = list.filter((c) => c.status === 'ativo').length;
    let confrades = 0;
    let consocias = 0;
    let aspirantes = 0;
    list.forEach((c) => {
      confrades += getMemberCount(c, 'confrades');
      consocias += getMemberCount(c, 'consocias');
      aspirantes += getMemberCount(c, 'aspirantes');
    });
    return {
      total,
      ativas,
      inativas: total - ativas,
      totalMembros: confrades + consocias + aspirantes,
      confrades,
      consocias,
      aspirantes,
    };
  }, [conferencias]);

  // --- Helpers de Formatação e Busca de CEP ---
  const formatPhone = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) {
      return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '').trim();
    }
    return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '').trim();
  };

  const formatZip = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 8);
    return d.replace(/^(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '').trim();
  };

  const handleFetchCepCP = async (rawCep: string) => {
    const cleanCep = rawCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setLoadingCepCP(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setCPFormData((prev) => ({
            ...prev,
            addressStreet: data.logradouro || prev.addressStreet,
            addressNeighborhood: data.bairro || prev.addressNeighborhood,
            addressCity: data.localidade || prev.addressCity,
            addressState: data.uf || prev.addressState,
          }));
        }
      }
    } catch (e) {
      console.warn('Falha na consulta automática de CEP para CP:', e);
    } finally {
      setLoadingCepCP(false);
    }
  };

  const handleFetchCepConf = async (rawCep: string) => {
    const cleanCep = rawCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    setLoadingCepConf(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setConfFormData((prev) => ({
            ...prev,
            addressStreet: data.logradouro || prev.addressStreet,
            addressNeighborhood: data.bairro || prev.addressNeighborhood,
            addressCity: data.localidade || prev.addressCity,
            addressState: data.uf || prev.addressState,
          }));
        }
      }
    } catch (e) {
      console.warn('Falha na consulta automática de CEP para Conferência:', e);
    } finally {
      setLoadingCepConf(false);
    }
  };

  // --- Handlers para Conselho Particular ---
  const handleOpenCreateCP = () => {
    setEditingCP(null);
    setCPFormData({
      name: '',
      code: '',
      institutionDate: '',
      phone: '',
      email: '',
      addressZip: '',
      addressStreet: '',
      addressNumber: '',
      addressComplement: '',
      addressNeighborhood: '',
      addressCity: '',
      addressState: '',
      startDate: '',
      endDate: '',
      presidenteNome: '',
      presidenteTelefone: '',
      vicePresidenteNome: '',
      vicePresidenteTelefone: '',
      secretarioNome: '',
      secretarioTelefone: '',
      tesoureiroNome: '',
      tesoureiroTelefone: '',
      ecafoNome: '',
      ecafoTelefone: '',
      coordenadorCCANome: '',
      coordenadorCCATelefone: '',
      notes: '',
    });
    setIsCPModalOpen(true);
  };

  const handleOpenEditCP = (cp: StandaloneConselhoParticular) => {
    setEditingCP(cp);
    setCPFormData({
      name: cp.name || '',
      code: cp.code || '',
      institutionDate: cp.institutionDate || '',
      phone: cp.phone || '',
      email: cp.email || '',
      addressZip: cp.addressZip || '',
      addressStreet: cp.addressStreet || '',
      addressNumber: cp.addressNumber || '',
      addressComplement: cp.addressComplement || '',
      addressNeighborhood: cp.addressNeighborhood || '',
      addressCity: cp.addressCity || cp.city || '',
      addressState: cp.addressState || '',
      startDate: cp.startDate || '',
      endDate: cp.endDate || '',
      presidenteNome: cp.presidente?.name || '',
      presidenteTelefone: cp.presidente?.phone || '',
      vicePresidenteNome: cp.vicePresidente?.name || '',
      vicePresidenteTelefone: cp.vicePresidente?.phone || '',
      secretarioNome: cp.secretario?.name || '',
      secretarioTelefone: cp.secretario?.phone || '',
      tesoureiroNome: cp.tesoureiro?.name || '',
      tesoureiroTelefone: cp.tesoureiro?.phone || '',
      ecafoNome: cp.ecafo?.name || '',
      ecafoTelefone: cp.ecafo?.phone || '',
      coordenadorCCANome: cp.coordenadorCCA?.name || '',
      coordenadorCCATelefone: cp.coordenadorCCA?.phone || '',
      notes: cp.notes || '',
    });
    setIsCPModalOpen(true);
  };

  const handleSaveCP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpFormData.name.trim()) {
      showNotification('O nome do Conselho Particular é obrigatório.', true);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const payload: Partial<StandaloneConselhoParticular> = {
        name: cpFormData.name.trim(),
        code: cpFormData.code.trim() || undefined,
        institutionDate: cpFormData.institutionDate || undefined,
        city: cpFormData.addressCity.trim() || undefined,
        phone: cpFormData.phone.trim() || undefined,
        email: cpFormData.email.trim() || undefined,
        addressZip: cpFormData.addressZip.trim() || undefined,
        addressStreet: cpFormData.addressStreet.trim() || undefined,
        addressNumber: cpFormData.addressNumber.trim() || undefined,
        addressComplement: cpFormData.addressComplement.trim() || undefined,
        addressNeighborhood: cpFormData.addressNeighborhood.trim() || undefined,
        addressCity: cpFormData.addressCity.trim() || undefined,
        addressState: cpFormData.addressState.trim() || undefined,
        startDate: cpFormData.startDate || undefined,
        endDate: cpFormData.endDate || undefined,
        presidente: cpFormData.presidenteNome.trim()
          ? { name: cpFormData.presidenteNome.trim(), phone: cpFormData.presidenteTelefone.trim() }
          : undefined,
        vicePresidente: cpFormData.vicePresidenteNome.trim()
          ? { name: cpFormData.vicePresidenteNome.trim(), phone: cpFormData.vicePresidenteTelefone.trim() }
          : undefined,
        secretario: cpFormData.secretarioNome.trim()
          ? { name: cpFormData.secretarioNome.trim(), phone: cpFormData.secretarioTelefone.trim() }
          : undefined,
        tesoureiro: cpFormData.tesoureiroNome.trim()
          ? { name: cpFormData.tesoureiroNome.trim(), phone: cpFormData.tesoureiroTelefone.trim() }
          : undefined,
        ecafo: cpFormData.ecafoNome.trim()
          ? { name: cpFormData.ecafoNome.trim(), phone: cpFormData.ecafoTelefone.trim() }
          : undefined,
        coordenadorCCA: cpFormData.coordenadorCCANome.trim()
          ? { name: cpFormData.coordenadorCCANome.trim(), phone: cpFormData.coordenadorCCATelefone.trim() }
          : undefined,
        notes: cpFormData.notes.trim() || undefined,
      };

      if (editingCP) {
        const updated = await updateConselhoParticular(editingCP.id, payload, institutionId);
        showNotification(`Conselho Particular "${updated.name}" atualizado com sucesso!`);
        if (selectedConselho?.id === updated.id) {
          setSelectedConselho(updated);
        }
      } else {
        const created = await createConselhoParticular(payload, institutionId);
        showNotification(`Conselho Particular "${created.name}" cadastrado com sucesso!`);
      }

      setIsCPModalOpen(false);
      loadConselhos();
    } catch (err: any) {
      console.error('Erro ao salvar CP:', err);
      showNotification(err?.message || 'Falha ao salvar Conselho Particular.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmInactivateCP = async () => {
    if (!cpToInactivate) return;
    setActionLoading(true);
    try {
      await inactivateConselhoParticular(cpToInactivate.id, institutionId);
      showNotification(`Conselho Particular "${cpToInactivate.name}" desativado com sucesso.`);
      setCpToInactivate(null);
      if (selectedConselho?.id === cpToInactivate.id) {
        setSelectedConselho(null);
      }
      loadConselhos();
    } catch (err: any) {
      console.error('Erro ao inativar CP:', err);
      if (err instanceof HierarchyApiError && err.code === 'ACTIVE_CHILDREN_EXIST') {
        showNotification('Não é possível desativar este Conselho Particular pois existem Conferências ativas vinculadas a ele. Desative as Conferências primeiro.', true);
      } else {
        showNotification(err?.message || 'Erro ao inativar Conselho Particular.', true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // --- Handlers para Conferências ---
  const handleOpenCreateConf = () => {
    setEditingConf(null);
    setAvailableConfMembros([]);
    setConfFormData({
      name: '',
      code: '',
      foundationDate: '',
      aggregationDate: '',
      location: '',
      meetingDay: '',
      meetingTime: '',
      phone: '',
      email: '',
      addressZip: '',
      addressStreet: '',
      addressNumber: '',
      addressComplement: '',
      addressNeighborhood: '',
      addressCity: '',
      addressState: '',
      startDate: '',
      endDate: '',
      presidenteMembroId: '',
      presidenteNome: '',
      presidenteTelefone: '',
      vicePresidenteMembroId: '',
      vicePresidenteNome: '',
      vicePresidenteTelefone: '',
      secretarioMembroId: '',
      secretarioNome: '',
      secretarioTelefone: '',
      segundoSecretarioMembroId: '',
      segundoSecretarioNome: '',
      segundoSecretarioTelefone: '',
      tesoureiroMembroId: '',
      tesoureiroNome: '',
      tesoureiroTelefone: '',
      segundoTesoureiroMembroId: '',
      segundoTesoureiroNome: '',
      segundoTesoureiroTelefone: '',
      confrades: 0,
      consocias: 0,
      aspirantes: 0,
      notes: '',
    });
    setIsConfModalOpen(true);
  };

  const handleOpenEditConf = async (conf: StandaloneConferencia) => {
    setEditingConf(conf);
    setConfFormData({
      name: conf.name || '',
      code: conf.code || '',
      foundationDate: conf.foundationDate || '',
      aggregationDate: conf.aggregationDate || '',
      location: conf.location || '',
      meetingDay: conf.meetingDay || '',
      meetingTime: conf.meetingTime || '',
      phone: conf.phone || '',
      email: conf.email || '',
      addressZip: conf.addressZip || '',
      addressStreet: conf.addressStreet || '',
      addressNumber: conf.addressNumber || '',
      addressComplement: conf.addressComplement || '',
      addressNeighborhood: conf.addressNeighborhood || '',
      addressCity: conf.addressCity || '',
      addressState: conf.addressState || '',
      startDate: conf.startDate || '',
      endDate: conf.endDate || '',
      presidenteMembroId: conf.presidente?.membroId || '',
      presidenteNome: conf.presidente?.name || '',
      presidenteTelefone: conf.presidente?.phone || '',
      vicePresidenteMembroId: conf.vicePresidente?.membroId || '',
      vicePresidenteNome: conf.vicePresidente?.name || '',
      vicePresidenteTelefone: conf.vicePresidente?.phone || '',
      secretarioMembroId: conf.secretario?.membroId || '',
      secretarioNome: conf.secretario?.name || '',
      secretarioTelefone: conf.secretario?.phone || '',
      segundoSecretarioMembroId: conf.segundoSecretario?.membroId || '',
      segundoSecretarioNome: conf.segundoSecretario?.name || '',
      segundoSecretarioTelefone: conf.segundoSecretario?.phone || '',
      tesoureiroMembroId: conf.tesoureiro?.membroId || '',
      tesoureiroNome: conf.tesoureiro?.name || '',
      tesoureiroTelefone: conf.tesoureiro?.phone || '',
      segundoTesoureiroMembroId: conf.segundoTesoureiro?.membroId || '',
      segundoTesoureiroNome: conf.segundoTesoureiro?.name || '',
      segundoTesoureiroTelefone: conf.segundoTesoureiro?.phone || '',
      confrades: conf.legacyCounts?.confrades ?? 0,
      consocias: conf.legacyCounts?.consocias ?? 0,
      aspirantes: conf.legacyCounts?.aspirantes ?? 0,
      notes: conf.notes || '',
    });
    setIsConfModalOpen(true);

    // Carregar todos os membros cadastrados nesta conferência para alimentar o seletor da diretoria (ativos e vinculados)
    if (conf.id) {
      setLoadingAvailableMembros(true);
      try {
        const membrosData = await fetchMembrosConferencia(conf.id, { status: 'todos' });
        setAvailableConfMembros(Array.isArray(membrosData) ? membrosData : []);
      } catch (err) {
        console.error('Erro ao carregar membros da conferência para diretoria:', err);
        setAvailableConfMembros([]);
      } finally {
        setLoadingAvailableMembros(false);
      }
    } else {
      setAvailableConfMembros([]);
    }
  };

  const handleSaveConf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConselho) return;
    if (!confFormData.name.trim()) {
      showNotification('O nome da Conferência é obrigatório.', true);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const payload: Partial<StandaloneConferencia> = {
        name: confFormData.name.trim(),
        code: confFormData.code.trim() || undefined,
        foundationDate: confFormData.foundationDate || undefined,
        aggregationDate: confFormData.aggregationDate || undefined,
        location: confFormData.location.trim() || undefined,
        meetingDay: confFormData.meetingDay.trim() || undefined,
        meetingTime: confFormData.meetingTime.trim() || undefined,
        phone: confFormData.phone.trim() || undefined,
        email: confFormData.email.trim() || undefined,
        addressZip: confFormData.addressZip.trim() || undefined,
        addressStreet: confFormData.addressStreet.trim() || undefined,
        addressNumber: confFormData.addressNumber.trim() || undefined,
        addressComplement: confFormData.addressComplement.trim() || undefined,
        addressNeighborhood: confFormData.addressNeighborhood.trim() || undefined,
        addressCity: confFormData.addressCity.trim() || undefined,
        addressState: confFormData.addressState.trim() || undefined,
        startDate: confFormData.startDate || undefined,
        endDate: confFormData.endDate || undefined,
        presidente: (confFormData.presidenteNome.trim() || confFormData.presidenteMembroId)
          ? {
              membroId: confFormData.presidenteMembroId.trim() || undefined,
              name: confFormData.presidenteNome.trim(),
              phone: confFormData.presidenteTelefone.trim() || undefined
            }
          : undefined,
        vicePresidente: (confFormData.vicePresidenteNome.trim() || confFormData.vicePresidenteMembroId)
          ? {
              membroId: confFormData.vicePresidenteMembroId.trim() || undefined,
              name: confFormData.vicePresidenteNome.trim(),
              phone: confFormData.vicePresidenteTelefone.trim() || undefined
            }
          : undefined,
        secretario: (confFormData.secretarioNome.trim() || confFormData.secretarioMembroId)
          ? {
              membroId: confFormData.secretarioMembroId.trim() || undefined,
              name: confFormData.secretarioNome.trim(),
              phone: confFormData.secretarioTelefone.trim() || undefined
            }
          : undefined,
        segundoSecretario: (confFormData.segundoSecretarioNome.trim() || confFormData.segundoSecretarioMembroId)
          ? {
              membroId: confFormData.segundoSecretarioMembroId.trim() || undefined,
              name: confFormData.segundoSecretarioNome.trim(),
              phone: confFormData.segundoSecretarioTelefone.trim() || undefined
            }
          : undefined,
        tesoureiro: (confFormData.tesoureiroNome.trim() || confFormData.tesoureiroMembroId)
          ? {
              membroId: confFormData.tesoureiroMembroId.trim() || undefined,
              name: confFormData.tesoureiroNome.trim(),
              phone: confFormData.tesoureiroTelefone.trim() || undefined
            }
          : undefined,
        segundoTesoureiro: (confFormData.segundoTesoureiroNome.trim() || confFormData.segundoTesoureiroMembroId)
          ? {
              membroId: confFormData.segundoTesoureiroMembroId.trim() || undefined,
              name: confFormData.segundoTesoureiroNome.trim(),
              phone: confFormData.segundoTesoureiroTelefone.trim() || undefined
            }
          : undefined,
        legacyCounts: {
          confrades: Number(confFormData.confrades) || 0,
          consocias: Number(confFormData.consocias) || 0,
          aspirantes: Number(confFormData.aspirantes) || 0,
        },
        notes: confFormData.notes.trim() || undefined,
      };

      if (editingConf) {
        const updated = await updateConferencia(selectedConselho.id, editingConf.id, payload);
        showNotification(`Conferência "${updated.name}" atualizada com sucesso!`);
      } else {
        const created = await createConferencia(selectedConselho.id, payload);
        showNotification(`Conferência "${created.name}" cadastrada com sucesso!`);
      }

      setIsConfModalOpen(false);
      loadConferencias(selectedConselho.id);
      loadConselhos();
    } catch (err: any) {
      console.error('Erro ao salvar Conferência:', err);
      showNotification(err?.message || 'Falha ao salvar Conferência.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmInactivateConf = async () => {
    if (!selectedConselho || !confToInactivate) return;
    setActionLoading(true);
    try {
      await inactivateConferencia(selectedConselho.id, confToInactivate.id);
      showNotification(`Conferência "${confToInactivate.name}" desativada com sucesso.`);
      setConfToInactivate(null);
      loadConferencias(selectedConselho.id);
      loadConselhos();
    } catch (err: any) {
      console.error('Erro ao inativar Conferência:', err);
      showNotification(err?.message || 'Erro ao inativar Conferência.', true);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div id="conselhos-admin-module" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Alertas de Notificação */}
      {errorMessage && (
        <div id="hierarchy-alert-error" className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl shadow-xs transition-all">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-sm font-medium flex-1">{errorMessage}</div>
          <button
            id="btn-close-error"
            onClick={() => setErrorMessage(null)}
            className="p-1 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div id="hierarchy-alert-success" className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shadow-xs transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-sm font-medium flex-1">{successMessage}</div>
          <button
            id="btn-close-success"
            onClick={() => setSuccessMessage(null)}
            className="p-1 text-emerald-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CABEÇALHO & HIERARQUIA */}
      <div id="hierarchy-header-card" className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              <span>Hierarquia Institucional SSVP</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-slate-900 font-bold text-xl sm:text-2xl">
              <Building2 className="w-6 h-6 text-slate-700" />
              <span>{centralName}</span>
              {selectedConselho && activeTab === 'conselhos' && (
                <>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                  <span className="text-emerald-700">{selectedConselho.name}</span>
                </>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {activeTab === 'autocadastro'
                ? 'Gerenciamento do link público oficial de autocadastro e fila de moderação de membros.'
                : activeTab === 'conferencias'
                ? 'Navegação em cascata e informações detalhadas da Conferência Vicentina.'
                : selectedConselho
                ? `Gestão de Conferências pertencentes ao ${selectedConselho.name}.`
                : 'Gestão de Conselhos Particulares e Conferências subordinadas ao Conselho Central.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'conselhos' && selectedConselho ? (
              <button
                id="btn-back-to-cps"
                onClick={() => setSelectedConselho(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Conselhos Particulares</span>
              </button>
            ) : activeTab === 'conselhos' ? (
              <button
                id="btn-new-conselho"
                onClick={handleOpenCreateCP}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Conselho Particular</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS INTEGRADAS */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 flex-wrap">
          <button
            id="tab-conferencias"
            onClick={() => {
              setActiveTab('conferencias');
              setSelectedConselho(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'conferencias'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-slate-50 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Conferências (Navegação em Cascata)</span>
          </button>

          <button
            id="tab-conselhos"
            onClick={() => setActiveTab('conselhos')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'conselhos'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-slate-50 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Conselhos Particulares</span>
          </button>

          <button
            id="tab-autocadastro"
            onClick={() => setActiveTab('autocadastro')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'autocadastro'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-slate-50 border border-slate-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Link Público & Fila de Aprovação</span>
          </button>
        </div>
      </div>

      {/* ABA DE AUTOCADASTRO & FILA DE APROVAÇÃO */}
      {activeTab === 'autocadastro' && (
        <MemberRegistrationManager centralName={centralName} />
      )}

      {/* ========================================================================= */}
      {/* VISTA CASCATA: GUIA CONFERÊNCIA (Seleção em Cascata e Informações da Conferência) */}
      {/* ========================================================================= */}
      {activeTab === 'conferencias' && (
        <div id="conferencias-cascade-flow" className="space-y-6">
          {/* Card do Seletor em Cascata */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Navegação Hierárquica em Cascata</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">Selecione a Conferência Vicentina</h2>
              </div>
              {selectedCascadeConf && (
                <button
                  id="btn-reset-cascade"
                  onClick={() => {
                    setCascadeConfId('');
                    setSelectedCascadeConf(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Trocar Conferência</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Conselho Central */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  1. Conselho Central
                </label>
                <div className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate">{centralName}</span>
                </div>
              </div>

              {/* 2. Conselho Particular */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  2. Conselho Particular
                </label>
                <select
                  id="select-cascade-cp"
                  value={cascadeCPId}
                  onChange={(e) => {
                    const newCpId = e.target.value;
                    setCascadeCPId(newCpId);
                    setCascadeConfId('');
                    setSelectedCascadeConf(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                >
                  <option value="">Selecione o Conselho Particular...</option>
                  {accessibleConselhos.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Conferência Vicentina */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  3. Conferência Vicentina
                </label>
                <select
                  id="select-cascade-conf"
                  value={cascadeConfId}
                  disabled={!cascadeCPId || loadingConferencias}
                  onChange={(e) => {
                    const confId = e.target.value;
                    setCascadeConfId(confId);
                    const found = accessibleConferencias.find((c) => c.id === confId);
                    setSelectedCascadeConf(found || null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:bg-slate-50"
                >
                  <option value="">
                    {loadingConferencias
                      ? 'Carregando conferências...'
                      : !cascadeCPId
                      ? 'Selecione primeiro o CP...'
                      : accessibleConferencias.length === 0
                      ? 'Nenhuma conferência encontrada'
                      : 'Selecione a Conferência...'}
                  </option>
                  {accessibleConferencias.map((conf) => (
                    <option key={conf.id} value={conf.id}>
                      {conf.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PAINEL DE INFORMAÇÕES DA CONFERÊNCIA SELECIONADA */}
          {selectedCascadeConf ? (
            <div id="conferencia-detail-panel" className="space-y-6">
              {/* Card de Cabeçalho / Breadcrumb e Ações */}
              <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-linear-to-l from-emerald-800/40 to-transparent pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      <span>{centralName}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{accessibleConselhos.find((c) => c.id === cascadeCPId)?.name || 'Conselho Particular'}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-white">Conferência</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        {selectedCascadeConf.name}
                      </h1>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          selectedCascadeConf.status === 'ativo'
                            ? 'bg-emerald-500/30 border border-emerald-400/40 text-emerald-200'
                            : 'bg-slate-500/30 border border-slate-400/40 text-slate-200'
                        }`}
                      >
                        {selectedCascadeConf.status === 'ativo' ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-emerald-200/90 text-sm max-w-2xl">
                      {selectedCascadeConf.location ? `Reuniões no(a) ${selectedCascadeConf.location}. ` : ''}
                      {selectedCascadeConf.meetingDay ? `Encontros às ${selectedCascadeConf.meetingDay}s` : ''}
                      {selectedCascadeConf.meetingTime ? ` às ${selectedCascadeConf.meetingTime}h.` : '.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      id="btn-back-to-cp-list"
                      onClick={() => {
                        setCascadeConfId('');
                        setSelectedCascadeConf(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 font-medium rounded-xl text-xs transition-all border border-emerald-700"
                      title="Voltar para a Lista de Conferências deste Conselho Particular"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Ver Lista</span>
                    </button>

                    {onNavigateToFamilias && (
                      <button
                        id="btn-familias-cascade-conf"
                        onClick={() => onNavigateToFamilias(selectedCascadeConf.particularId, selectedCascadeConf.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs transition-all border border-emerald-700"
                        title="Ver Famílias Assistidas por esta Conferência"
                      >
                        <HeartHandshake className="w-4 h-4 text-emerald-300" />
                        <span>Famílias</span>
                      </button>
                    )}

                    <button
                      id="btn-edit-cascade-conf"
                      onClick={() => handleOpenEditConf(selectedCascadeConf)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-emerald-950 font-semibold rounded-xl text-xs hover:bg-emerald-50 transition-all shadow-xs"
                    >
                      <Edit className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Editar</span>
                    </button>

                    <button
                      id="btn-manage-membros-cascade"
                      onClick={() => setManagingMembrosConf(selectedCascadeConf)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs transition-all shadow-xs border border-emerald-600"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Gerenciar Membros</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid 3 Colunas com os Detalhes da Conferência */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CARD 1: DADOS CADASTRAIS & REUNIÃO */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Building2 className="w-5 h-5 text-emerald-700 shrink-0" />
                    <h3 className="font-bold text-slate-900 text-base">Informações & Reuniões</h3>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Código / Registro:</span>
                      <span className="font-semibold text-slate-900">{selectedCascadeConf.code || 'CONF-000'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Fundação:</span>
                        <span className="font-semibold text-slate-800">{selectedCascadeConf.foundationDate || '—'}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Agregação:</span>
                        <span className="font-semibold text-slate-800">{selectedCascadeConf.aggregationDate || '—'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Dia & Horário da Reunião:</span>
                      <div className="flex items-center gap-2 text-slate-800 font-medium">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{selectedCascadeConf.meetingDay || 'Não informado'}</span>
                        {selectedCascadeConf.meetingTime && (
                          <>
                            <Clock className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                            <span>{selectedCascadeConf.meetingTime}h</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Local / Endereço:</span>
                      <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span className="text-xs leading-relaxed">
                          {selectedCascadeConf.location ? `${selectedCascadeConf.location} - ` : ''}
                          {selectedCascadeConf.addressStreet
                            ? `${selectedCascadeConf.addressStreet}, ${selectedCascadeConf.addressNumber || 's/n'} ${selectedCascadeConf.addressNeighborhood ? `- ${selectedCascadeConf.addressNeighborhood}` : ''} (${selectedCascadeConf.addressCity || ''}/${selectedCascadeConf.addressState || ''})`
                            : 'Endereço não informado'}
                        </span>
                      </div>

                      {selectedCascadeConf.phone && (
                        <div className="flex items-center gap-2 text-slate-700 text-xs">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{selectedCascadeConf.phone}</span>
                        </div>
                      )}

                      {selectedCascadeConf.email && (
                        <div className="flex items-center gap-2 text-slate-700 text-xs">
                          <Mail className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{selectedCascadeConf.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 2: DIRETORIA E ENCARGOS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Shield className="w-5 h-5 text-emerald-700 shrink-0" />
                    <h3 className="font-bold text-slate-900 text-base">Diretoria & Encargos</h3>
                  </div>

                  <div className="space-y-3.5 text-sm">
                    {/* Presidente */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Presidente</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {selectedCascadeConf.presidente?.name || 'Não informado'}
                      </div>
                      {selectedCascadeConf.presidente?.phone && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{selectedCascadeConf.presidente.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Vice-Presidente */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Vice-Presidente</span>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {selectedCascadeConf.vicePresidente?.name || 'Não informado'}
                      </div>
                      {selectedCascadeConf.vicePresidente?.phone && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{selectedCascadeConf.vicePresidente.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Secretário e Tesoureiro */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Secretário(a)</span>
                        <div className="font-medium text-slate-800 text-xs mt-0.5 truncate">
                          {selectedCascadeConf.secretario?.name || 'Não inf.'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tesoureiro(a)</span>
                        <div className="font-medium text-slate-800 text-xs mt-0.5 truncate">
                          {selectedCascadeConf.tesoureiro?.name || 'Não inf.'}
                        </div>
                      </div>
                    </div>

                    {/* Mandato */}
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <span className="font-medium text-slate-500 block">Período de Mandato:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedCascadeConf.startDate || '—'} a {selectedCascadeConf.endDate || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD 3: QUADRO DE MEMBROS (VICENTINOS) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                        <h3 className="font-bold text-slate-900 text-base">Quadro de Membros</h3>
                      </div>
                      {loadingCascadeConfMembros && (
                        <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                      )}
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Estatísticas gerais de membros vinculados a esta Conferência.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-center">
                        <span className="text-xs font-semibold text-sky-700 block">Confrades</span>
                        <span className="text-2xl font-black text-sky-900">{liveCounts.confrades}</span>
                      </div>
                      <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 text-center">
                        <span className="text-xs font-semibold text-pink-700 block">Consócias</span>
                        <span className="text-2xl font-black text-pink-900">{liveCounts.consocias}</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                        <span className="text-xs font-semibold text-amber-700 block">Aspirantes</span>
                        <span className="text-2xl font-black text-amber-900">{liveCounts.aspirantes}</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                        <span className="text-xs font-semibold text-emerald-700 block">Total Geral</span>
                        <span className="text-2xl font-black text-emerald-900">{liveCounts.total}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-open-membros-manager-card"
                    onClick={() => setManagingMembrosConf(selectedCascadeConf)}
                    className="w-full mt-4 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Acessar Lista Completa de Membros</span>
                  </button>
                </div>
              </div>
            </div>
          ) : cascadeCPId ? (
            /* LISTA TABULAR DE CONFERÊNCIAS DO CONSELHO PARTICULAR SELECIONADO NA CASCATA */
            <div id="conferencias-cascade-cp-list" className="space-y-4">
              {/* Indicadores Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-xs font-medium text-slate-500 block">Total Conferências</span>
                  <span className="text-2xl font-bold text-slate-900">{confStats.total}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-xs font-medium text-emerald-700 block">Ativas</span>
                  <span className="text-2xl font-bold text-emerald-700">{confStats.ativas}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-xs font-medium text-slate-600 block">Total Membros</span>
                  <span className="text-2xl font-bold text-slate-900">{confStats.totalMembros}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-xs font-medium text-sky-700 block">Confrades</span>
                  <span className="text-2xl font-bold text-sky-900">{confStats.confrades}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-xs font-medium text-pink-700 block">Consócias</span>
                  <span className="text-2xl font-bold text-pink-900">{confStats.consocias}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-xs font-medium text-amber-700 block">Aspirantes</span>
                  <span className="text-2xl font-bold text-amber-900">{confStats.aspirantes}</span>
                </div>
              </div>

              {/* Barra de Busca e Filtros */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-search-conf-cascade"
                    type="text"
                    value={searchConf}
                    onChange={(e) => setSearchConf(e.target.value)}
                    placeholder="Buscar conferência por nome, código ou presidente..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium text-slate-600">
                    <button
                      id="filter-conf-ativo-cascade"
                      onClick={() => setStatusFilterConf('ativo')}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        statusFilterConf === 'ativo' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                      }`}
                    >
                      Ativas
                    </button>
                    <button
                      id="filter-conf-inativo-cascade"
                      onClick={() => setStatusFilterConf('inativo')}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        statusFilterConf === 'inativo' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                      }`}
                    >
                      Inativas
                    </button>
                    <button
                      id="filter-conf-all-cascade"
                      onClick={() => setStatusFilterConf('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        statusFilterConf === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                      }`}
                    >
                      Todas
                    </button>
                  </div>

                  <button
                    id="btn-refresh-confs-cascade"
                    onClick={() => cascadeCPId && loadConferencias(cascadeCPId)}
                    disabled={loadingConferencias}
                    className="p-2 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    title="Recarregar Conferências"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingConferencias ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    id="btn-new-conf-cascade"
                    onClick={handleOpenCreateConf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-xs transition-colors shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nova Conferência</span>
                  </button>
                </div>
              </div>

              {/* Tabela de Conferências */}
              {loadingConferencias ? (
                <div id="loading-confs-cascade" className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                  <p className="text-sm font-medium text-slate-600">Carregando Conferências...</p>
                </div>
              ) : filteredConferencias.length === 0 ? (
                <div id="empty-confs-cascade" className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                    <Users2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhuma Conferência encontrada</h3>
                  <p className="text-sm text-slate-500 max-w-md mb-4">
                    {searchConf
                      ? 'Nenhum resultado corresponde à sua busca.'
                      : 'Nenhuma conferência cadastrada para este Conselho Particular.'}
                  </p>
                  {!searchConf && (
                    <button
                      id="btn-empty-create-conf-cascade"
                      onClick={handleOpenCreateConf}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Primeira Conferência</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Conferência Vicentina</th>
                          <th className="py-3.5 px-4 hidden md:table-cell">Local & Cidade</th>
                          <th className="py-3.5 px-4 hidden sm:table-cell">Reunião</th>
                          <th className="py-3.5 px-4 hidden lg:table-cell">Presidente</th>
                          <th className="py-3.5 px-4 text-center">Membros</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                          <th className="py-3.5 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredConferencias.map((conf) => (
                          <tr
                            key={conf.id}
                            id={`row-cascade-conf-${conf.id}`}
                            className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                            onClick={() => {
                              setCascadeConfId(conf.id);
                              setSelectedCascadeConf(conf);
                            }}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                  {conf.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                    {conf.name}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono">
                                    {conf.code || 'CONF-000'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600">
                              {conf.location ? (
                                <div className="flex items-center gap-1.5 truncate max-w-xs" title={conf.location}>
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{conf.location}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-700">
                              {conf.meetingDay || conf.meetingTime ? (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>
                                    {conf.meetingDay || '—'} {conf.meetingTime ? `(${conf.meetingTime}h)` : ''}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-700">
                              {conf.presidente?.name ? (
                                <div>
                                  <div className="font-medium text-slate-900 truncate">{conf.presidente.name}</div>
                                  {conf.presidente.phone && (
                                    <div className="text-[11px] text-slate-500">{conf.presidente.phone}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">Não inf.</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1">
                                <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 text-[11px] font-semibold rounded" title="Confrades">
                                  {getMemberCount(conf, 'confrades')}C
                                </span>
                                <span className="px-1.5 py-0.5 bg-pink-50 text-pink-800 text-[11px] font-semibold rounded" title="Consócias">
                                  {getMemberCount(conf, 'consocias')}S
                                </span>
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-semibold rounded" title="Aspirantes">
                                  {getMemberCount(conf, 'aspirantes')}A
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  conf.status === 'ativo'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {conf.status === 'ativo' ? 'Ativa' : 'Inativa'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  id={`btn-view-ficha-cascade-${conf.id}`}
                                  onClick={() => setSelectedConfDetalhes(conf)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Ver Ficha Completa da Conferência"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  id={`btn-manage-membros-cascade-row-${conf.id}`}
                                  onClick={() => setManagingMembrosConf(conf)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Gerenciar Membros"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                                {onNavigateToFamilias && (
                                  <button
                                    id={`btn-familias-cascade-row-${conf.id}`}
                                    onClick={() => onNavigateToFamilias(conf.particularId, conf.id)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Famílias Assistidas"
                                  >
                                    <HeartHandshake className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  id={`btn-edit-cascade-row-${conf.id}`}
                                  onClick={() => handleOpenEditConf(conf)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Editar Conferência"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {conf.status === 'ativo' && (
                                  <button
                                    id={`btn-inactivate-cascade-row-${conf.id}`}
                                    onClick={() => setConfToInactivate(conf)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Desativar Conferência"
                                  >
                                    <PowerOff className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
              <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                <Users2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Selecione um Conselho Particular</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Escolha o Conselho Particular no seletor acima para listar todas as suas Conferências Vicentinas ou selecionar uma conferência específica.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: LISTA DE CONSELHOS PARTICULARES */}
      {/* ========================================================================= */}
      {activeTab === 'conselhos' && !selectedConselho && (
        <div id="conselhos-list-section" className="space-y-4">
          {/* Indicadores Resumo dos Conselhos Particulares */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Total Conselhos Particulares</span>
              <span className="text-2xl font-bold text-slate-900">{cpStats.total}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-emerald-700 block">Ativos</span>
              <span className="text-2xl font-bold text-emerald-700">{cpStats.ativos}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-600 block">Inativos</span>
              <span className="text-2xl font-bold text-slate-700">{cpStats.inativos}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-sky-700 block">Total Conferências</span>
              <span className="text-2xl font-bold text-sky-900">{cpStats.totalConferencias}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-indigo-700 block">Total Membros</span>
              <span className="text-2xl font-bold text-indigo-900">{cpStats.totalMembros}</span>
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-cp"
                type="text"
                value={searchCP}
                onChange={(e) => setSearchCP(e.target.value)}
                placeholder="Buscar por nome, cidade ou presidente..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium text-slate-600">
                <button
                  id="filter-cp-ativo"
                  onClick={() => setStatusFilterCP('ativo')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilterCP === 'ativo' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Ativos
                </button>
                <button
                  id="filter-cp-inativo"
                  onClick={() => setStatusFilterCP('inativo')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilterCP === 'inativo' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Inativos
                </button>
                <button
                  id="filter-cp-all"
                  onClick={() => setStatusFilterCP('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilterCP === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
              </div>

              <button
                id="btn-refresh-cps"
                onClick={loadConselhos}
                disabled={loadingConselhos}
                className="p-2 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Recarregar"
              >
                <RefreshCw className={`w-4 h-4 ${loadingConselhos ? 'animate-spin' : ''}`} />
              </button>

              <button
                id="btn-new-cp-top"
                onClick={handleOpenCreateCP}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-xs transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Conselho Particular</span>
              </button>
            </div>
          </div>

          {/* Estado de Carregamento */}
          {loadingConselhos ? (
            <div id="loading-cps" className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">Carregando Conselhos Particulares...</p>
            </div>
          ) : authError ? (
            /* Erro de Autenticação / Sessão */
            <div id="auth-error-cps" className="flex flex-col items-center justify-center p-12 bg-white border border-amber-200 rounded-2xl text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Sua sessão precisa ser renovada</h3>
              <p className="text-sm text-slate-600 max-w-md mb-5">
                Não foi possível validar as credenciais da sua sessão para acessar a estrutura de Conselhos Particulares. Por favor, conecte-se novamente.
              </p>
              <div className="flex items-center gap-3">
                <button
                  id="btn-reconnect-auth"
                  onClick={() => {
                    localStorage.removeItem('ssvp_session');
                    window.location.reload();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl text-sm transition-colors shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Entrar novamente</span>
                </button>
                <button
                  id="btn-retry-auth"
                  onClick={loadConselhos}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            </div>
          ) : filteredConselhos.length === 0 ? (
            /* Lista Vazia */
            <div id="empty-cps" className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhum Conselho Particular encontrado</h3>
              <p className="text-sm text-slate-500 max-w-md mb-4">
                {searchCP
                  ? 'Nenhum resultado corresponde à sua busca. Tente buscar por outros termos.'
                  : 'Nenhum Conselho Particular cadastrado neste Conselho Central.'}
              </p>
              
              {/* Relatório após importação recente */}
              {importReport && (
                <div id="import-report-banner" className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-700 space-y-1 w-full max-w-md">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Relatório da Importação 2026</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conselhos Criados:</span>
                    <strong className="text-emerald-700">{importReport.created.cps}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Conferências Criadas:</span>
                    <strong className="text-emerald-700">{importReport.created.conferencias}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Registros Ignorados:</span>
                    <span>{importReport.ignored.cps + importReport.ignored.conferencias}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conflitos:</span>
                    <span>{importReport.conflicts.cps + importReport.conflicts.conferencias}</span>
                  </div>
                </div>
              )}

              {!searchCP && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {/* Botão Temporário Administrativo de Importação da Estrutura 2026 */}
                  {isEligibleForImport && conselhos.length === 0 && (
                    <button
                      id="btn-import-structure-2026"
                      onClick={() => setIsImportModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl text-sm transition-colors shadow-xs"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Importar estrutura 2026</span>
                    </button>
                  )}

                  <button
                    id="btn-empty-create-cp"
                    onClick={handleOpenCreateCP}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Primeiro Conselho Particular</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Tabela de Conselhos Particulares */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Conselho Particular</th>
                      <th className="py-3.5 px-4 hidden md:table-cell">Cidade & Local</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Presidente / Contato</th>
                      <th className="py-3.5 px-4 text-center">Conferências</th>
                      <th className="py-3.5 px-4 text-center hidden lg:table-cell">Membros</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredConselhos.map((cp) => (
                      <tr
                        key={cp.id}
                        id={`row-cp-${cp.id}`}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedConselho(cp)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold text-xs shrink-0">
                              {cp.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                {cp.name}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {centralName}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600">
                          {cp.city ? (
                            <div className="flex items-center gap-1.5 truncate max-w-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{cp.city}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-700">
                          {cp.presidente?.name ? (
                            <div>
                              <div className="font-medium text-slate-900 truncate">{cp.presidente.name}</div>
                              {cp.phone && (
                                <div className="text-[11px] text-slate-500">{cp.phone}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Não informado</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg">
                            <Users2 className="w-3 h-3 text-emerald-600" />
                            {cp.conferenciasCount || (cp as any).conferencias?.length || 0}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center hidden lg:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
                            <Users className="w-3 h-3 text-slate-500" />
                            {cp.membrosCount || 0}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              cp.status === 'ativo'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {cp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              id={`btn-view-ficha-cp-row-${cp.id}`}
                              onClick={() => setSelectedCPDetalhes(cp)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Ver Ficha Completa do Conselho Particular"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-open-conferencias-row-${cp.id}`}
                              onClick={() => setSelectedConselho(cp)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Ver Conferências Vinculadas"
                            >
                              <Users2 className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-edit-cp-row-${cp.id}`}
                              onClick={() => handleOpenEditCP(cp)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar Conselho Particular"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {cp.status === 'ativo' && (
                              <button
                                id={`btn-inactivate-cp-row-${cp.id}`}
                                onClick={() => setCpToInactivate(cp)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Desativar Conselho Particular"
                              >
                                <PowerOff className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: DETALHES DO CONSELHO PARTICULAR & SUAS CONFERÊNCIAS */}
      {/* ========================================================================= */}
      {activeTab === 'conselhos' && selectedConselho && (
        <div id="conferencias-list-section" className="space-y-6">
          {/* Card Resumo do Conselho Particular Selecionado */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedConselho.status === 'ativo'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedConselho.status === 'ativo' ? 'Conselho Particular Ativo' : 'Conselho Particular Inativo'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Vínculo: <strong>{centralName}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{selectedConselho.name}</h3>
                <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-1">
                  {selectedConselho.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {selectedConselho.city}
                    </span>
                  )}
                  {selectedConselho.presidente?.name && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Presidente: <strong>{selectedConselho.presidente.name}</strong>
                    </span>
                  )}
                  {selectedConselho.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedConselho.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-edit-selected-cp"
                  onClick={() => handleOpenEditCP(selectedConselho)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium rounded-xl text-xs transition-colors shadow-2xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar Conselho</span>
                </button>
                <button
                  id="btn-new-conferencia"
                  onClick={handleOpenCreateConf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-xs transition-colors shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Conferência</span>
                </button>
              </div>
            </div>
          </div>

          {/* Indicadores Resumo das Conferências */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-500 block">Total Conferências</span>
              <span className="text-2xl font-bold text-slate-900">{confStats.total}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-emerald-700 block">Ativas</span>
              <span className="text-2xl font-bold text-emerald-700">{confStats.ativas}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-slate-600 block">Total Membros</span>
              <span className="text-2xl font-bold text-slate-900">{confStats.totalMembros}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-sky-700 block">Confrades</span>
              <span className="text-2xl font-bold text-sky-900">{confStats.confrades}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-pink-700 block">Consócias</span>
              <span className="text-2xl font-bold text-pink-900">{confStats.consocias}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-medium text-amber-700 block">Aspirantes</span>
              <span className="text-2xl font-bold text-amber-900">{confStats.aspirantes}</span>
            </div>
          </div>

          {/* Barra de Filtros e Busca de Conferências */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-conf"
                type="text"
                value={searchConf}
                onChange={(e) => setSearchConf(e.target.value)}
                placeholder="Buscar conferência por nome, código ou presidente..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium text-slate-600">
                <button
                  id="filter-conf-ativo"
                  onClick={() => setStatusFilterConf('ativo')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilterConf === 'ativo' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Ativas
                </button>
                <button
                  id="filter-conf-inativo"
                  onClick={() => setStatusFilterConf('inativo')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilterConf === 'inativo' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Inativas
                </button>
                <button
                  id="filter-conf-all"
                  onClick={() => setStatusFilterConf('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    statusFilterConf === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
              </div>

              <button
                id="btn-refresh-confs"
                onClick={() => selectedConselho && loadConferencias(selectedConselho.id)}
                disabled={loadingConferencias}
                className="p-2 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Recarregar Conferências"
              >
                <RefreshCw className={`w-4 h-4 ${loadingConferencias ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Tabela de Conferências */}
          {loadingConferencias ? (
            <div id="loading-confs" className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">Carregando Conferências...</p>
            </div>
          ) : filteredConferencias.length === 0 ? (
            /* Lista Vazia de Conferências */
            <div id="empty-confs" className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                <Users2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhuma Conferência cadastrada</h3>
              <p className="text-sm text-slate-500 max-w-md mb-4">
                {searchConf
                  ? 'Nenhum resultado corresponde à sua busca de conferências.'
                  : `Nenhuma conferência cadastrada para o ${selectedConselho.name}.`}
              </p>
              {!searchConf && (
                <button
                  id="btn-empty-create-conf"
                  onClick={handleOpenCreateConf}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeira Conferência</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Conferência Vicentina</th>
                      <th className="py-3.5 px-4 hidden md:table-cell">Local & Cidade</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Reunião</th>
                      <th className="py-3.5 px-4 hidden lg:table-cell">Presidente</th>
                      <th className="py-3.5 px-4 text-center">Membros</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredConferencias.map((conf) => (
                      <tr
                        key={conf.id}
                        id={`row-cp-conf-${conf.id}`}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedConfDetalhes(conf)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {conf.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                {conf.name}
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                {conf.code || 'CONF-000'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-600">
                          {conf.location ? (
                            <div className="flex items-center gap-1.5 truncate max-w-xs" title={conf.location}>
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{conf.location}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-700">
                          {conf.meetingDay || conf.meetingTime ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                {conf.meetingDay || '—'} {conf.meetingTime ? `(${conf.meetingTime}h)` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-700">
                          {conf.presidente?.name ? (
                            <div>
                              <div className="font-medium text-slate-900 truncate">{conf.presidente.name}</div>
                              {conf.presidente.phone && (
                                <div className="text-[11px] text-slate-500">{conf.presidente.phone}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Não inf.</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 text-[11px] font-semibold rounded" title="Confrades">
                              {getMemberCount(conf, 'confrades')}C
                            </span>
                            <span className="px-1.5 py-0.5 bg-pink-50 text-pink-800 text-[11px] font-semibold rounded" title="Consócias">
                              {getMemberCount(conf, 'consocias')}S
                            </span>
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-semibold rounded" title="Aspirantes">
                              {getMemberCount(conf, 'aspirantes')}A
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              conf.status === 'ativo'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {conf.status === 'ativo' ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              id={`btn-view-ficha-cp-${conf.id}`}
                              onClick={() => setSelectedConfDetalhes(conf)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Ver Ficha Completa da Conferência"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-manage-membros-${conf.id}`}
                              onClick={() => setManagingMembrosConf(conf)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Gerenciar Membros"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            {onNavigateToFamilias && (
                              <button
                                id={`btn-familias-cp-row-${conf.id}`}
                                onClick={() => onNavigateToFamilias(conf.particularId, conf.id)}
                                className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Famílias Assistidas"
                              >
                                <HeartHandshake className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              id={`btn-edit-conf-${conf.id}`}
                              onClick={() => handleOpenEditConf(conf)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar Conferência"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {conf.status === 'ativo' && (
                              <button
                                id={`btn-inactivate-conf-${conf.id}`}
                                onClick={() => setConfToInactivate(conf)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Desativar Conferência"
                              >
                                <PowerOff className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE CONSELHO PARTICULAR */}
      {/* ========================================================================= */}
      {isCPModalOpen && (
        <div id="modal-cp-backdrop" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-cp-card" className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingCP ? 'Editar Conselho Particular' : 'Novo Conselho Particular'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCP ? 'Atualize as informações cadastrais do conselho' : 'Preencha os dados para registrar um novo conselho particular'}
                  </p>
                </div>
              </div>
              <button
                id="btn-close-cp-modal"
                onClick={() => setIsCPModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCP} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Seção 1: Dados Principais */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                  Identificação do Conselho
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome do Conselho Particular *
                    </label>
                    <input
                      id="input-cp-name"
                      type="text"
                      required
                      value={cpFormData.name}
                      onChange={(e) => setCPFormData({ ...cpFormData, name: e.target.value })}
                      placeholder="Ex: Conselho Particular São José"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Código / Sigla
                    </label>
                    <input
                      id="input-cp-code"
                      type="text"
                      value={cpFormData.code}
                      onChange={(e) => setCPFormData({ ...cpFormData, code: e.target.value })}
                      placeholder="Ex: CP-01"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data de Instituição / Fundação
                    </label>
                    <input
                      id="input-cp-institution-date"
                      type="date"
                      value={cpFormData.institutionDate}
                      onChange={(e) => setCPFormData({ ...cpFormData, institutionDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Principal</label>
                    <input
                      id="input-cp-phone"
                      type="text"
                      value={cpFormData.phone}
                      onChange={(e) => setCPFormData({ ...cpFormData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Oficial</label>
                    <input
                      id="input-cp-email"
                      type="email"
                      value={cpFormData.email}
                      onChange={(e) => setCPFormData({ ...cpFormData, email: e.target.value })}
                      placeholder="cp@ssvp.org.br"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Endereço */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  Endereço da Sede
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        id="input-cp-zip"
                        type="text"
                        value={cpFormData.addressZip}
                        onChange={(e) => setCPFormData({ ...cpFormData, addressZip: e.target.value })}
                        onBlur={handleFetchCepCP}
                        placeholder="00000-000"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all pr-8"
                      />
                      {loadingCepCP && (
                        <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Logradouro / Rua</label>
                    <input
                      id="input-cp-street"
                      type="text"
                      value={cpFormData.addressStreet}
                      onChange={(e) => setCPFormData({ ...cpFormData, addressStreet: e.target.value })}
                      placeholder="Rua / Avenida"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Número</label>
                    <input
                      id="input-cp-number"
                      type="text"
                      value={cpFormData.addressNumber}
                      onChange={(e) => setCPFormData({ ...cpFormData, addressNumber: e.target.value })}
                      placeholder="Nº"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Complemento</label>
                    <input
                      id="input-cp-complement"
                      type="text"
                      value={cpFormData.addressComplement}
                      onChange={(e) => setCPFormData({ ...cpFormData, addressComplement: e.target.value })}
                      placeholder="Sala, Apto, etc."
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bairro</label>
                    <input
                      id="input-cp-neighborhood"
                      type="text"
                      value={cpFormData.addressNeighborhood}
                      onChange={(e) => setCPFormData({ ...cpFormData, addressNeighborhood: e.target.value })}
                      placeholder="Bairro"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / UF</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        id="input-cp-city"
                        type="text"
                        value={cpFormData.addressCity}
                        onChange={(e) => setCPFormData({ ...cpFormData, addressCity: e.target.value, city: e.target.value })}
                        placeholder="Cidade"
                        className="col-span-2 px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      />
                      <input
                        id="input-cp-state"
                        type="text"
                        maxLength={2}
                        value={cpFormData.addressState}
                        onChange={(e) => setCPFormData({ ...cpFormData, addressState: e.target.value.toUpperCase() })}
                        placeholder="UF"
                        className="px-2 py-2 text-sm text-center uppercase bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Mandato e Diretoria */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  Mandato e Diretoria
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Início do Mandato</label>
                    <input
                      id="input-cp-startdate"
                      type="date"
                      value={cpFormData.startDate}
                      onChange={(e) => setCPFormData({ ...cpFormData, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fim do Mandato</label>
                    <input
                      id="input-cp-enddate"
                      type="date"
                      value={cpFormData.endDate}
                      onChange={(e) => setCPFormData({ ...cpFormData, endDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Presidente</label>
                    <input
                      id="input-cp-pres-name"
                      type="text"
                      value={cpFormData.presidenteNome}
                      onChange={(e) => setCPFormData({ ...cpFormData, presidenteNome: e.target.value })}
                      placeholder="Nome completo do Presidente"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone do Presidente</label>
                    <input
                      id="input-cp-pres-phone"
                      type="text"
                      value={cpFormData.presidenteTelefone}
                      onChange={(e) => setCPFormData({ ...cpFormData, presidenteTelefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Vice-Presidente</label>
                    <input
                      id="input-cp-vice"
                      type="text"
                      value={cpFormData.vicePresidenteNome}
                      onChange={(e) => setCPFormData({ ...cpFormData, vicePresidenteNome: e.target.value })}
                      placeholder="Nome do Vice-Presidente"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Secretário(a)</label>
                    <input
                      id="input-cp-sec"
                      type="text"
                      value={cpFormData.secretarioNome}
                      onChange={(e) => setCPFormData({ ...cpFormData, secretarioNome: e.target.value })}
                      placeholder="Nome do(a) Secretário(a)"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tesoureiro(a)</label>
                    <input
                      id="input-cp-tes"
                      type="text"
                      value={cpFormData.tesoureiroNome}
                      onChange={(e) => setCPFormData({ ...cpFormData, tesoureiroNome: e.target.value })}
                      placeholder="Nome do(a) Tesoureiro(a)"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 4: Comissões e Observações */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-700" />
                  Comissões e Observações
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ECAFO / Formação</label>
                    <input
                      id="input-cp-ecafo"
                      type="text"
                      value={cpFormData.ecafoNome}
                      onChange={(e) => setCPFormData({ ...cpFormData, ecafoNome: e.target.value })}
                      placeholder="Nome do(a) Coordenador(a) ECAFO"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Coordenação Jovens (CCA)</label>
                    <input
                      id="input-cp-cca"
                      type="text"
                      value={cpFormData.coordenadorCCANome}
                      onChange={(e) => setCPFormData({ ...cpFormData, coordenadorCCANome: e.target.value })}
                      placeholder="Nome do(a) Coordenador(a) CCA"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Gerais</label>
                  <textarea
                    id="input-cp-notes"
                    rows={2}
                    value={cpFormData.notes}
                    onChange={(e) => setCPFormData({ ...cpFormData, notes: e.target.value })}
                    placeholder="Informações adicionais, histórico ou anotações..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 sticky bottom-0 bg-white">
                <button
                  id="btn-cancel-cp-form"
                  type="button"
                  onClick={() => setIsCPModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  id="btn-submit-cp-form"
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingCP ? 'Salvar Alterações' : 'Cadastrar Conselho'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INATIVAÇÃO DE CONSELHO PARTICULAR */}
      {/* ========================================================================= */}
      {cpToInactivate && (
        <div id="modal-inactivate-cp-backdrop" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-inactivate-cp-card" className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <PowerOff className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Inativar Conselho Particular</h3>
            </div>

            <p className="text-sm text-slate-600">
              Tem certeza que deseja desativar o <strong>{cpToInactivate.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Os dados históricos serão preservados e o Conselho não será excluído do banco. Ele não poderá ser desativado se possuir Conferências ativas.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-inactivate-cp"
                onClick={() => setCpToInactivate(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-inactivate-cp"
                onClick={handleConfirmInactivateCP}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirmar Inativação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE CONFERÊNCIA */}
      {/* ========================================================================= */}
      {isConfModalOpen && (
        <div id="modal-conf-backdrop" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-conf-card" className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Users2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingConf ? 'Editar Conferência' : 'Nova Conferência'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedConselho ? `Vinculada ao ${selectedConselho.name}` : 'Cadastro de Conferência Vicentina'}
                  </p>
                </div>
              </div>
              <button
                id="btn-close-conf-modal"
                onClick={() => setIsConfModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConf} className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Seção 1: Identificação */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5 text-emerald-700" />
                  Identificação da Conferência
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome da Conferência *
                    </label>
                    <input
                      id="input-conf-name"
                      type="text"
                      required
                      value={confFormData.name}
                      onChange={(e) => setConfFormData({ ...confFormData, name: e.target.value })}
                      placeholder="Ex: Conferência São Vicente de Paulo"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Código / Registro
                    </label>
                    <input
                      id="input-conf-code"
                      type="text"
                      value={confFormData.code}
                      onChange={(e) => setConfFormData({ ...confFormData, code: e.target.value })}
                      placeholder="Ex: CONF-01"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data de Fundação
                    </label>
                    <input
                      id="input-conf-foundation-date"
                      type="date"
                      value={confFormData.foundationDate}
                      onChange={(e) => setConfFormData({ ...confFormData, foundationDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data de Agregação
                    </label>
                    <input
                      id="input-conf-aggregation-date"
                      type="date"
                      value={confFormData.aggregationDate}
                      onChange={(e) => setConfFormData({ ...confFormData, aggregationDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
                    <input
                      id="input-conf-phone"
                      type="text"
                      value={confFormData.phone}
                      onChange={(e) => setConfFormData({ ...confFormData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                    <input
                      id="input-conf-email"
                      type="email"
                      value={confFormData.email}
                      onChange={(e) => setConfFormData({ ...confFormData, email: e.target.value })}
                      placeholder="conf@ssvp.org.br"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Reuniões e Local */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  Reunião e Local
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dia da Reunião</label>
                    <input
                      id="input-conf-meetingday"
                      type="text"
                      value={confFormData.meetingDay}
                      onChange={(e) => setConfFormData({ ...confFormData, meetingDay: e.target.value })}
                      placeholder="Ex: Toda Terça-feira"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Horário da Reunião</label>
                    <input
                      id="input-conf-meetingtime"
                      type="text"
                      value={confFormData.meetingTime}
                      onChange={(e) => setConfFormData({ ...confFormData, meetingTime: e.target.value })}
                      placeholder="Ex: 19:30"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Local / Paróquia</label>
                    <input
                      id="input-conf-location"
                      type="text"
                      value={confFormData.location}
                      onChange={(e) => setConfFormData({ ...confFormData, location: e.target.value })}
                      placeholder="Ex: Paróquia Santo Antônio"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 3: Endereço do Local de Encontro */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  Endereço do Local de Reunião
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        id="input-conf-zip"
                        type="text"
                        value={confFormData.addressZip}
                        onChange={(e) => setConfFormData({ ...confFormData, addressZip: e.target.value })}
                        onBlur={handleFetchCepConf}
                        placeholder="00000-000"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all pr-8"
                      />
                      {loadingCepConf && (
                        <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Logradouro / Rua</label>
                    <input
                      id="input-conf-street"
                      type="text"
                      value={confFormData.addressStreet}
                      onChange={(e) => setConfFormData({ ...confFormData, addressStreet: e.target.value })}
                      placeholder="Rua / Avenida"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Número</label>
                    <input
                      id="input-conf-number"
                      type="text"
                      value={confFormData.addressNumber}
                      onChange={(e) => setConfFormData({ ...confFormData, addressNumber: e.target.value })}
                      placeholder="Nº"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Complemento</label>
                    <input
                      id="input-conf-complement"
                      type="text"
                      value={confFormData.addressComplement}
                      onChange={(e) => setConfFormData({ ...confFormData, addressComplement: e.target.value })}
                      placeholder="Sala, Anexo, etc."
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bairro</label>
                    <input
                      id="input-conf-neighborhood"
                      type="text"
                      value={confFormData.addressNeighborhood}
                      onChange={(e) => setConfFormData({ ...confFormData, addressNeighborhood: e.target.value })}
                      placeholder="Bairro"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / UF</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        id="input-conf-city"
                        type="text"
                        value={confFormData.addressCity}
                        onChange={(e) => setConfFormData({ ...confFormData, addressCity: e.target.value })}
                        placeholder="Cidade"
                        className="col-span-2 px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                      />
                      <input
                        id="input-conf-state"
                        type="text"
                        maxLength={2}
                        value={confFormData.addressState}
                        onChange={(e) => setConfFormData({ ...confFormData, addressState: e.target.value.toUpperCase() })}
                        placeholder="UF"
                        className="px-2 py-2 text-sm text-center uppercase bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 4: Mandato e Diretoria */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    Mandato e Diretoria
                  </h4>
                  {editingConf && availableConfMembros.length > 0 && (
                    <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {availableConfMembros.filter((m) => m.status === 'ativo').length} membros ativos disponíveis
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Início do Mandato</label>
                    <input
                      id="input-conf-startdate"
                      type="date"
                      value={confFormData.startDate}
                      onChange={(e) => setConfFormData({ ...confFormData, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fim do Mandato</label>
                    <input
                      id="input-conf-enddate"
                      type="date"
                      value={confFormData.endDate}
                      onChange={(e) => setConfFormData({ ...confFormData, endDate: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* 6 Seletores da Diretoria */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80">
                  {/* 1. Presidente */}
                  <BoardMemberSelectorField
                    idPrefix="presidente"
                    roleLabel="Presidente"
                    membroId={confFormData.presidenteMembroId}
                    name={confFormData.presidenteNome}
                    phone={confFormData.presidenteTelefone}
                    availableMembros={availableConfMembros}
                    isLoadingMembros={loadingAvailableMembros}
                    isNewConferencia={!editingConf}
                    onChange={({ membroId, name, phone }) =>
                      setConfFormData((prev) => ({
                        ...prev,
                        presidenteMembroId: membroId,
                        presidenteNome: name,
                        presidenteTelefone: phone,
                      }))
                    }
                  />

                  {/* 2. Vice-Presidente */}
                  <BoardMemberSelectorField
                    idPrefix="vice-presidente"
                    roleLabel="Vice-Presidente"
                    membroId={confFormData.vicePresidenteMembroId}
                    name={confFormData.vicePresidenteNome}
                    phone={confFormData.vicePresidenteTelefone}
                    availableMembros={availableConfMembros}
                    isLoadingMembros={loadingAvailableMembros}
                    isNewConferencia={!editingConf}
                    onChange={({ membroId, name, phone }) =>
                      setConfFormData((prev) => ({
                        ...prev,
                        vicePresidenteMembroId: membroId,
                        vicePresidenteNome: name,
                        vicePresidenteTelefone: phone,
                      }))
                    }
                  />

                  {/* 3. Secretário(a) */}
                  <BoardMemberSelectorField
                    idPrefix="secretario"
                    roleLabel="Secretário(a)"
                    membroId={confFormData.secretarioMembroId}
                    name={confFormData.secretarioNome}
                    phone={confFormData.secretarioTelefone}
                    availableMembros={availableConfMembros}
                    isLoadingMembros={loadingAvailableMembros}
                    isNewConferencia={!editingConf}
                    onChange={({ membroId, name, phone }) =>
                      setConfFormData((prev) => ({
                        ...prev,
                        secretarioMembroId: membroId,
                        secretarioNome: name,
                        secretarioTelefone: phone,
                      }))
                    }
                  />

                  {/* 4. Segundo(a) Secretário(a) */}
                  <BoardMemberSelectorField
                    idPrefix="segundo-secretario"
                    roleLabel="Segundo(a) Secretário(a)"
                    membroId={confFormData.segundoSecretarioMembroId}
                    name={confFormData.segundoSecretarioNome}
                    phone={confFormData.segundoSecretarioTelefone}
                    availableMembros={availableConfMembros}
                    isLoadingMembros={loadingAvailableMembros}
                    isNewConferencia={!editingConf}
                    onChange={({ membroId, name, phone }) =>
                      setConfFormData((prev) => ({
                        ...prev,
                        segundoSecretarioMembroId: membroId,
                        segundoSecretarioNome: name,
                        segundoSecretarioTelefone: phone,
                      }))
                    }
                  />

                  {/* 5. Tesoureiro(a) */}
                  <BoardMemberSelectorField
                    idPrefix="tesoureiro"
                    roleLabel="Tesoureiro(a)"
                    membroId={confFormData.tesoureiroMembroId}
                    name={confFormData.tesoureiroNome}
                    phone={confFormData.tesoureiroTelefone}
                    availableMembros={availableConfMembros}
                    isLoadingMembros={loadingAvailableMembros}
                    isNewConferencia={!editingConf}
                    onChange={({ membroId, name, phone }) =>
                      setConfFormData((prev) => ({
                        ...prev,
                        tesoureiroMembroId: membroId,
                        tesoureiroNome: name,
                        tesoureiroTelefone: phone,
                      }))
                    }
                  />

                  {/* 6. Segundo(a) Tesoureiro(a) */}
                  <BoardMemberSelectorField
                    idPrefix="segundo-tesoureiro"
                    roleLabel="Segundo(a) Tesoureiro(a)"
                    membroId={confFormData.segundoTesoureiroMembroId}
                    name={confFormData.segundoTesoureiroNome}
                    phone={confFormData.segundoTesoureiroTelefone}
                    availableMembros={availableConfMembros}
                    isLoadingMembros={loadingAvailableMembros}
                    isNewConferencia={!editingConf}
                    onChange={({ membroId, name, phone }) =>
                      setConfFormData((prev) => ({
                        ...prev,
                        segundoTesoureiroMembroId: membroId,
                        segundoTesoureiroNome: name,
                        segundoTesoureiroTelefone: phone,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Seção 5: Comissões e Observações */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-700" />
                  Comissões e Observações
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ECAFO / Formação</label>
                    <input
                      id="input-conf-ecafo"
                      type="text"
                      value={confFormData.ecafoNome}
                      onChange={(e) => setConfFormData({ ...confFormData, ecafoNome: e.target.value })}
                      placeholder="Nome do(a) Coordenador(a) ECAFO"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Coordenação Jovens (CCA)</label>
                    <input
                      id="input-conf-cca"
                      type="text"
                      value={confFormData.coordenadorCCANome}
                      onChange={(e) => setConfFormData({ ...confFormData, coordenadorCCANome: e.target.value })}
                      placeholder="Nome do(a) Coordenador(a) CCA"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Gerais</label>
                  <textarea
                    id="input-conf-notes"
                    rows={2}
                    value={confFormData.notes}
                    onChange={(e) => setConfFormData({ ...confFormData, notes: e.target.value })}
                    placeholder="Informações adicionais, histórico ou anotações..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              {/* Seção 6: Contagens Legadas / Membros */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                  Contagem de Membros (Legado)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confrades</label>
                    <input
                      id="input-conf-confrades"
                      type="number"
                      min="0"
                      value={confFormData.confrades}
                      onChange={(e) => setConfFormData({ ...confFormData, confrades: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Consócias</label>
                    <input
                      id="input-conf-consocias"
                      type="number"
                      min="0"
                      value={confFormData.consocias}
                      onChange={(e) => setConfFormData({ ...confFormData, consocias: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Aspirantes</label>
                    <input
                      id="input-conf-aspirantes"
                      type="number"
                      min="0"
                      value={confFormData.aspirantes}
                      onChange={(e) => setConfFormData({ ...confFormData, aspirantes: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 sticky bottom-0 bg-white">
                <button
                  id="btn-cancel-conf-form"
                  type="button"
                  onClick={() => setIsConfModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  id="btn-submit-conf-form"
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingConf ? 'Salvar Alterações' : 'Cadastrar Conferência'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INATIVAÇÃO DE CONFERÊNCIA */}
      {/* ========================================================================= */}
      {confToInactivate && (
        <div id="modal-inactivate-conf-backdrop" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-inactivate-conf-card" className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <PowerOff className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Inativar Conferência</h3>
            </div>

            <p className="text-sm text-slate-600">
              Tem certeza que deseja desativar a <strong>{confToInactivate.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Os dados históricos serão preservados e a Conferência não será excluída do banco.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-inactivate-conf"
                onClick={() => setConfToInactivate(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-inactivate-conf"
                onClick={handleConfirmInactivateConf}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirmar Inativação</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR ESTRUTURA 2026 (ADMINISTRADOR JABOTICABAL) */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div id="modal-import-structure-backdrop" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-import-structure-card" className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-blue-700">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Importar Estrutura 2026</h3>
                <p className="text-xs text-slate-500">Carga Oficial de Conselhos e Conferências</p>
              </div>
            </div>

            <p className="text-sm text-slate-700">
              Esta ação executará a carga inicial oficial no <strong>Firestore Remoto</strong> para o <strong>Conselho Central de Jaboticabal</strong>.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">Estrutura que será processada:</div>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>6 Conselhos Particulares</strong> (Antonio Fred Ozanam, Monte Alto, Taquaritinga, Taiaçú, N. Sra. do Carmo, Sto. Antônio de Santana Galvão).</li>
                <li><strong>52 Conferências Vicentinas</strong> vinculadas aos respectivos CPs.</li>
                <li>Operação <strong>idempotente</strong>: não sobrescreve nem duplica registros existentes.</li>
                <li>Gera o marcador definitivo <code className="text-slate-800 bg-slate-200 px-1 py-0.5 rounded">_migrations/estrutura_2026_jaboticabal</code> após a conclusão.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-import-structure"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImportingStructure}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-import-structure"
                onClick={handleExecuteImportStructure2026}
                disabled={isImportingStructure}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {isImportingStructure && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isImportingStructure ? 'Processando importação...' : 'Confirmar e Executar Importação'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GERENCIAMENTO DE MEMBROS DA CONFERÊNCIA */}
      {/* ========================================================================= */}
      {managingMembrosConf && (
        <ConferenciaMembrosManager
          conferencia={managingMembrosConf}
          onClose={() => {
            setManagingMembrosConf(null);
            if (selectedConselho?.id) {
              loadConferencias(selectedConselho.id);
            }
            if (selectedCascadeConf?.id) {
              reloadCascadeConfMembros(selectedCascadeConf.id);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHA COMPLETA DA CONFERÊNCIA VICENTINA */}
      {/* ========================================================================= */}
      {selectedConfDetalhes && (
        <div
          id="modal-conf-detalhes-backdrop"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedConfDetalhes(null)}
        >
          <div
            id="modal-conf-detalhes-card"
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                  <Users2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedConfDetalhes.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedConfDetalhes.status === 'ativo' ? 'Ativa' : 'Inativa'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {selectedConfDetalhes.code || 'CONF-000'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg truncate mt-0.5">
                    {selectedConfDetalhes.name}
                  </h3>
                </div>
              </div>
              <button
                id="btn-close-conf-detalhes"
                onClick={() => setSelectedConfDetalhes(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Informações Gerais & Local */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Conselho Particular Vinculado</span>
                  <span className="text-sm font-bold text-slate-800">
                    {conselhos.find((c) => c.id === selectedConfDetalhes.particularId)?.name || 'Conselho Particular'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Paróquia / Comunidade</span>
                  <span className="text-sm text-slate-800">
                    {selectedConfDetalhes.parish || 'Não informada'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Reunião</span>
                  <span className="text-sm text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {selectedConfDetalhes.meetingDay || '—'} {selectedConfDetalhes.meetingTime ? `às ${selectedConfDetalhes.meetingTime}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Localização / Endereço</span>
                  <span className="text-sm text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedConfDetalhes.location || 'Não informada'}
                  </span>
                </div>
              </div>

              {/* Contagem de Membros */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                  Quadro de Membros
                </h4>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                    <span className="text-xs font-semibold text-sky-700 block">Confrades</span>
                    <span className="text-xl font-bold text-sky-900">{getMemberCount(selectedConfDetalhes, 'confrades')}</span>
                  </div>
                  <div className="bg-pink-50 border border-pink-100 rounded-xl p-3">
                    <span className="text-xs font-semibold text-pink-700 block">Consócias</span>
                    <span className="text-xl font-bold text-pink-900">{getMemberCount(selectedConfDetalhes, 'consocias')}</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <span className="text-xs font-semibold text-amber-700 block">Aspirantes</span>
                    <span className="text-xl font-bold text-amber-900">{getMemberCount(selectedConfDetalhes, 'aspirantes')}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <span className="text-xs font-semibold text-emerald-700 block">Total Geral</span>
                    <span className="text-xl font-bold text-emerald-900">
                      {getMemberCount(selectedConfDetalhes, 'confrades') +
                        getMemberCount(selectedConfDetalhes, 'consocias') +
                        getMemberCount(selectedConfDetalhes, 'aspirantes')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Diretoria & Mandato */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    Diretoria & Mandato
                  </h4>
                  <div className="text-xs text-slate-500 font-medium">
                    Período: <strong className="text-slate-700">{selectedConfDetalhes.startDate || '—'} até {selectedConfDetalhes.endDate || '—'}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { role: 'Presidente', member: selectedConfDetalhes.presidente },
                    { role: 'Vice-Presidente', member: selectedConfDetalhes.vicePresidente },
                    { role: 'Secretário(a)', member: selectedConfDetalhes.secretario },
                    { role: 'Segundo(a) Secretário(a)', member: selectedConfDetalhes.segundoSecretario },
                    { role: 'Tesoureiro(a)', member: selectedConfDetalhes.tesoureiro },
                    { role: 'Segundo(a) Tesoureiro(a)', member: selectedConfDetalhes.segundoTesoureiro },
                  ].map(({ role, member }, idx) => {
                    const linkedMembro = member?.membroId
                      ? detalhesConfMembros.find((m) => m.id === member.membroId)
                      : undefined;
                    const isInactive = Boolean(linkedMembro && linkedMembro.status !== 'ativo');
                    const isLegacy = Boolean(!member?.membroId && member?.name);

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border transition-all ${
                          isInactive
                            ? 'bg-amber-50/50 border-amber-300'
                            : member?.name
                            ? 'bg-slate-50/70 border-slate-200'
                            : 'bg-slate-50/30 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-500">{role}</span>
                          {isLegacy && (
                            <span className="text-[9px] text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded font-medium">
                              Legado
                            </span>
                          )}
                          {linkedMembro && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                isInactive
                                  ? 'bg-amber-200 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {linkedMembro.status}
                            </span>
                          )}
                        </div>

                        {member?.name ? (
                          <>
                            <div className="font-bold text-slate-800 text-xs truncate">
                              {member.name}
                            </div>
                            {member.phone && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{member.phone}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 italic">Cargo vago</div>
                        )}

                        {/* Alerta de Inatividade */}
                        {isInactive && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100/80 border border-amber-300 text-amber-950 rounded-lg text-[11px] font-semibold mt-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Membro inativo — substituição necessária</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Comissões Opcionais se preenchidas */}
                {(selectedConfDetalhes.ecafo?.name || selectedConfDetalhes.coordenadorCCA?.name) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                    {selectedConfDetalhes.ecafo?.name && (
                      <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                        <span className="text-[11px] font-semibold text-slate-500 block">ECAFO / Formação</span>
                        <span className="font-bold text-slate-800 text-xs">{selectedConfDetalhes.ecafo.name}</span>
                      </div>
                    )}
                    {selectedConfDetalhes.coordenadorCCA?.name && (
                      <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
                        <span className="text-[11px] font-semibold text-slate-500 block">Coord. Jovens (CCA)</span>
                        <span className="font-bold text-slate-800 text-xs">{selectedConfDetalhes.coordenadorCCA.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Observações */}
              {selectedConfDetalhes.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Observações e Histórico
                  </h4>
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {selectedConfDetalhes.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Footer com Ações */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  id="btn-modal-manage-membros"
                  onClick={() => {
                    const conf = selectedConfDetalhes;
                    setSelectedConfDetalhes(null);
                    setManagingMembrosConf(conf);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold rounded-xl text-xs transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>Gerenciar Membros</span>
                </button>
                {onNavigateToFamilias && (
                  <button
                    id="btn-modal-familias"
                    onClick={() => {
                      const conf = selectedConfDetalhes;
                      setSelectedConfDetalhes(null);
                      onNavigateToFamilias(conf.particularId, conf.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold rounded-xl text-xs transition-colors"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>Famílias Assistidas</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-modal-edit-conf"
                  onClick={() => {
                    const conf = selectedConfDetalhes;
                    setSelectedConfDetalhes(null);
                    handleOpenEditConf(conf);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium rounded-xl text-xs transition-colors shadow-2xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                {selectedConfDetalhes.status === 'ativo' && (
                  <button
                    id="btn-modal-inactivate-conf"
                    onClick={() => {
                      const conf = selectedConfDetalhes;
                      setSelectedConfDetalhes(null);
                      setConfToInactivate(conf);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-xl text-xs transition-colors"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>Desativar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHA COMPLETA DO CONSELHO PARTICULAR */}
      {/* ========================================================================= */}
      {selectedCPDetalhes && (
        <div
          id="modal-cp-detalhes-backdrop"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedCPDetalhes(null)}
        >
          <div
            id="modal-cp-detalhes-card"
            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedCPDetalhes.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedCPDetalhes.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {selectedCPDetalhes.code || 'CP-000'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg truncate mt-0.5">
                    {selectedCPDetalhes.name}
                  </h3>
                </div>
              </div>
              <button
                id="btn-close-cp-detalhes"
                onClick={() => setSelectedCPDetalhes(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Informações Gerais & Local */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Conselho Central Vinculado</span>
                  <span className="text-sm font-bold text-slate-800">
                    {centralName}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Cidade / UF</span>
                  <span className="text-sm text-slate-800">
                    {selectedCPDetalhes.city || 'Não informada'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Contato Telefônico</span>
                  <span className="text-sm text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    {selectedCPDetalhes.phone || 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">E-mail</span>
                  <span className="text-sm text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    {selectedCPDetalhes.email || 'Não informado'}
                  </span>
                </div>
              </div>

              {/* Contagem / Estatísticas do CP */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5 text-emerald-700" />
                  Estatísticas da Jurisdição
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <span className="text-xs font-semibold text-emerald-700 block">Conferências</span>
                    <span className="text-xl font-bold text-emerald-900">
                      {selectedCPDetalhes.conferenciasCount || (selectedCPDetalhes as any).conferencias?.length || 0}
                    </span>
                  </div>
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                    <span className="text-xs font-semibold text-sky-700 block">Total de Membros</span>
                    <span className="text-xl font-bold text-sky-900">{selectedCPDetalhes.membrosCount || 0}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-xs font-semibold text-slate-600 block">Status da Unidade</span>
                    <span className="text-xl font-bold text-slate-900 capitalize">{selectedCPDetalhes.status}</span>
                  </div>
                </div>
              </div>

              {/* Diretoria */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  Diretoria & Mandato
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div>
                    <span className="font-semibold text-slate-500 block">Presidente:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedCPDetalhes.presidente?.name || 'Não informado'}
                    </span>
                    {selectedCPDetalhes.presidente?.phone && (
                      <span className="text-slate-600 block mt-0.5">{selectedCPDetalhes.presidente.phone}</span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Período de Mandato:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedCPDetalhes.startDate || '—'} até {selectedCPDetalhes.endDate || '—'}
                    </span>
                  </div>
                  {selectedCPDetalhes.vicePresidente?.name && (
                    <div>
                      <span className="font-semibold text-slate-500 block">Vice-Presidente:</span>
                      <span className="text-slate-800 font-medium">{selectedCPDetalhes.vicePresidente.name}</span>
                    </div>
                  )}
                  {selectedCPDetalhes.secretario?.name && (
                    <div>
                      <span className="font-semibold text-slate-500 block">Secretário(a):</span>
                      <span className="text-slate-800 font-medium">{selectedCPDetalhes.secretario.name}</span>
                    </div>
                  )}
                  {selectedCPDetalhes.tesoureiro?.name && (
                    <div>
                      <span className="font-semibold text-slate-500 block">Tesoureiro(a):</span>
                      <span className="text-slate-800 font-medium">{selectedCPDetalhes.tesoureiro.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Observações */}
              {selectedCPDetalhes.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Observações e Histórico
                  </h4>
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {selectedCPDetalhes.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Footer com Ações */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  id="btn-modal-open-confs"
                  onClick={() => {
                    const cp = selectedCPDetalhes;
                    setSelectedCPDetalhes(null);
                    setSelectedConselho(cp);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold rounded-xl text-xs transition-colors"
                >
                  <Users2 className="w-4 h-4" />
                  <span>Ver Conferências</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-modal-edit-cp"
                  onClick={() => {
                    const cp = selectedCPDetalhes;
                    setSelectedCPDetalhes(null);
                    handleOpenEditCP(cp);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium rounded-xl text-xs transition-colors shadow-2xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                {selectedCPDetalhes.status === 'ativo' && (
                  <button
                    id="btn-modal-inactivate-cp"
                    onClick={() => {
                      const cp = selectedCPDetalhes;
                      setSelectedCPDetalhes(null);
                      setCpToInactivate(cp);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-xl text-xs transition-colors"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>Desativar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConselhosParticularesModule;

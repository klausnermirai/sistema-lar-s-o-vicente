import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import {
  Landmark,
  Building,
  Layers,
  Users,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  Shield,
  Home
} from 'lucide-react';
import { StandaloneConselhoParticular, StandaloneConferencia } from '../types';
import { fetchConselhosParticulares, fetchConferencias } from '../lib/hierarchy_api';

export interface VicentinoHierarchySelection {
  metropolitanoName?: string;
  centralId: string;
  centralName: string;
  particularId?: string;
  particularName?: string;
  conferenciaId?: string;
  conferenciaName?: string;
  selectedLevel: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia';
}

interface VicentinoHierarchyContextType {
  selection: VicentinoHierarchySelection | null;
  setSelection: (sel: VicentinoHierarchySelection | null) => void;
  isMultiAccess: boolean;
  userScopeType: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';
  conselhos: StandaloneConselhoParticular[];
  conferencias: StandaloneConferencia[];
  loadingHierarchy: boolean;
  refreshHierarchy: () => Promise<void>;
  loadConferenciasForCP: (particularId: string) => Promise<StandaloneConferencia[]>;
  selectConferencia: (conf: StandaloneConferencia, cp?: StandaloneConselhoParticular) => void;
  selectParticular: (cp: StandaloneConselhoParticular) => void;
  clearSelection: () => void;
}

const VicentinoHierarchyContext = createContext<VicentinoHierarchyContextType | null>(null);

export const useVicentinoHierarchy = () => {
  const context = useContext(VicentinoHierarchyContext);
  if (!context) {
    throw new Error('useVicentinoHierarchy deve ser usado dentro de um VicentinoHierarchyProvider');
  }
  return context;
};

interface VicentinoHierarchyProviderProps {
  children: React.ReactNode;
  userSession: any;
  institutionSettings: any;
  institutionId?: string;
}

export const VicentinoHierarchyProvider: React.FC<VicentinoHierarchyProviderProps> = ({
  children,
  userSession,
  institutionSettings,
  institutionId,
}) => {
  const [conselhos, setConselhos] = useState<StandaloneConselhoParticular[]>([]);
  const [conferencias, setConferencias] = useState<StandaloneConferencia[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  // Extrair o tipo de escopo do usuário
  const userScopeType = useMemo(() => {
    if (!userSession) return 'central';
    const hierarchyType = userSession?.hierarchy?.type;
    if (hierarchyType) return hierarchyType;
    const accessLevel = userSession?.accessLevel || '';
    if (accessLevel === 'administrador' || accessLevel === 'admin') return 'central';
    if (institutionSettings?.entityType) return institutionSettings.entityType;
    return 'central';
  }, [userSession, institutionSettings]);

  // Verificar se o usuário possui multiacesso ou acesso a nível superior (Central/Metropolitano/Admin)
  const isMultiAccess = useMemo(() => {
    if (!userSession) return false;
    const accessLevel = userSession.accessLevel || userSession.role || '';
    const isAdmin = accessLevel.includes('admin') || accessLevel === 'administrador';
    if (isAdmin) return true;
    if (userScopeType === 'central' || userScopeType === 'metropolitano' || userScopeType === 'nacional') return true;
    if (userSession.hasAllUnitsAccess) return true;
    if (Array.isArray(userSession.allowedUnits) && userSession.allowedUnits.length > 1) return true;
    if (Array.isArray(userSession.institutionIds) && userSession.institutionIds.length > 1) return true;
    return false;
  }, [userSession, userScopeType]);

  const effectiveCentralId = useMemo(() => {
    return (
      institutionId ||
      userSession?.institutionId ||
      userSession?.cnpj ||
      '54.927.132/0001-92'
    );
  }, [institutionId, userSession]);

  const centralName = useMemo(() => {
    return institutionSettings?.name || userSession?.hierarchy?.centralName || 'Conselho Central';
  }, [institutionSettings, userSession]);

  // Estado da seleção atual
  const [selection, setSelection] = useState<VicentinoHierarchySelection | null>(() => {
    // Se o usuário tem escopo restrito a uma Conferência única
    if (userScopeType === 'conferencia' && userSession?.hierarchy?.conferenciaId) {
      return {
        centralId: effectiveCentralId,
        centralName: centralName,
        particularId: userSession?.hierarchy?.particularId,
        particularName: userSession?.hierarchy?.particularName,
        conferenciaId: userSession?.hierarchy?.conferenciaId,
        conferenciaName: userSession?.hierarchy?.conferenciaName || 'Minha Conferência',
        selectedLevel: 'conferencia'
      };
    }

    // Se o usuário tem escopo restrito a um Conselho Particular único
    if (userScopeType === 'particular' && userSession?.hierarchy?.particularId) {
      return {
        centralId: effectiveCentralId,
        centralName: centralName,
        particularId: userSession?.hierarchy?.particularId,
        particularName: userSession?.hierarchy?.particularName || 'Meu Conselho Particular',
        selectedLevel: 'particular'
      };
    }

    return null;
  });

  // Carregar todos os Conselhos Particulares e Conferências do Conselho Central
  const loadHierarchyData = async () => {
    setLoadingHierarchy(true);
    try {
      const cps = await fetchConselhosParticulares('ativo', effectiveCentralId).catch(() => []);
      let confs: StandaloneConferencia[] = [];
      if (cps.length > 0) {
        const confArrays = await Promise.all(
          cps.map((cp) => fetchConferencias(cp.id, 'ativo', effectiveCentralId).catch(() => []))
        );
        confs = confArrays.flat();
      }
      setConselhos(cps);
      setConferencias(confs);

      // Auto-seleção se houver apenas 1 CP ou 1 Conferência e for usuário restrito
      if (!isMultiAccess) {
        if (userScopeType === 'conferencia') {
          const userConfId = userSession?.hierarchy?.conferenciaId;
          const matchedConf = confs.find(c => c.id === userConfId) || confs[0];
          if (matchedConf) {
            const matchedCP = cps.find(cp => cp.id === matchedConf.particularId);
            setSelection({
              centralId: effectiveCentralId,
              centralName: centralName,
              particularId: matchedConf.particularId,
              particularName: matchedCP?.name,
              conferenciaId: matchedConf.id,
              conferenciaName: matchedConf.name,
              selectedLevel: 'conferencia'
            });
          }
        } else if (userScopeType === 'particular') {
          const userCpId = userSession?.hierarchy?.particularId;
          const matchedCP = cps.find(c => c.id === userCpId) || cps[0];
          if (matchedCP) {
            setSelection({
              centralId: effectiveCentralId,
              centralName: centralName,
              particularId: matchedCP.id,
              particularName: matchedCP.name,
              selectedLevel: 'particular'
            });
          }
        }
      }
    } catch (e) {
      console.error('Erro ao carregar dados de hierarquia vicentina:', e);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  const loadConferenciasForCP = async (particularId: string): Promise<StandaloneConferencia[]> => {
    if (!particularId) return [];
    try {
      const confs = await fetchConferencias(particularId, 'ativo', effectiveCentralId);
      setConferencias((prev) => {
        const others = prev.filter((c) => c.particularId !== particularId);
        return [...others, ...confs];
      });
      return confs;
    } catch (err) {
      console.error(`Erro ao carregar conferências do CP ${particularId}:`, err);
      return [];
    }
  };

  useEffect(() => {
    loadHierarchyData();
  }, [effectiveCentralId]);

  // Sincronizar seleção quando a sessão do usuário mudar de unidade (ex: pelo seletor de topo)
  useEffect(() => {
    if (userSession?.hierarchy?.conferenciaId) {
      setSelection({
        centralId: effectiveCentralId,
        centralName: centralName,
        particularId: userSession?.hierarchy?.particularId,
        particularName: userSession?.hierarchy?.particularName,
        conferenciaId: userSession?.hierarchy?.conferenciaId,
        conferenciaName: userSession?.hierarchy?.conferenciaName || 'Conferência Selecionada',
        selectedLevel: 'conferencia'
      });
    } else if (userSession?.hierarchy?.particularId) {
      setSelection({
        centralId: effectiveCentralId,
        centralName: centralName,
        particularId: userSession?.hierarchy?.particularId,
        particularName: userSession?.hierarchy?.particularName || 'Conselho Particular Selecionado',
        selectedLevel: 'particular'
      });
    }
  }, [userSession?.hierarchy?.conferenciaId, userSession?.hierarchy?.particularId, effectiveCentralId, centralName]);

  const selectConferencia = (conf: StandaloneConferencia, cp?: StandaloneConselhoParticular) => {
    const parentCP = cp || conselhos.find(c => c.id === conf.particularId);
    setSelection({
      centralId: effectiveCentralId,
      centralName: centralName,
      particularId: conf.particularId,
      particularName: parentCP?.name,
      conferenciaId: conf.id,
      conferenciaName: conf.name,
      selectedLevel: 'conferencia'
    });
  };

  const selectParticular = (cp: StandaloneConselhoParticular) => {
    setSelection({
      centralId: effectiveCentralId,
      centralName: centralName,
      particularId: cp.id,
      particularName: cp.name,
      selectedLevel: 'particular'
    });
  };

  const clearSelection = () => {
    if (isMultiAccess) {
      setSelection(null);
    }
  };

  return (
    <VicentinoHierarchyContext.Provider
      value={{
        selection,
        setSelection,
        isMultiAccess,
        userScopeType,
        conselhos,
        conferencias,
        loadingHierarchy,
        refreshHierarchy: loadHierarchyData,
        loadConferenciasForCP,
        selectConferencia,
        selectParticular,
        clearSelection,
      }}
    >
      {children}
    </VicentinoHierarchyContext.Provider>
  );
};

// ==========================================
// COMPONENTE VISUAL DO SELETOR EM CASCATA
// ==========================================

interface VicentinoCascadeSelectorProps {
  targetLevel: 'conferencia' | 'particular' | 'central' | 'metropolitano';
  title?: string;
  subtitle?: string;
  onSelectComplete?: () => void;
}

export const VicentinoCascadeSelector: React.FC<VicentinoCascadeSelectorProps> = ({
  targetLevel,
  title,
  subtitle,
  onSelectComplete,
}) => {
  const {
    selection,
    isMultiAccess,
    userScopeType,
    conselhos,
    conferencias,
    loadingHierarchy,
    selectConferencia,
    selectParticular,
    clearSelection,
  } = useVicentinoHierarchy();

  const [selectedCpId, setSelectedCpId] = useState<string>(selection?.particularId || '');
  const [searchTerm, setSearchTerm] = useState('');

  // Sincronizar CP selecionado com seleção global
  useEffect(() => {
    if (selection?.particularId) {
      setSelectedCpId(selection.particularId);
    }
  }, [selection?.particularId]);

  // Filtrar Conselhos Particulares
  const filteredCPs = useMemo(() => {
    return conselhos.filter(cp => {
      if (!searchTerm) return true;
      return (
        cp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cp.city && cp.city.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [conselhos, searchTerm]);

  // Conferências subordinadas ao CP selecionado
  const filteredConferencias = useMemo(() => {
    if (!selectedCpId) return [];
    return conferencias.filter(conf => {
      const matchCP = conf.particularId === selectedCpId;
      if (!matchCP) return false;
      if (!searchTerm) return true;
      return conf.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [conferencias, selectedCpId, searchTerm]);

  const activeCP = useMemo(() => {
    return conselhos.find(cp => cp.id === selectedCpId);
  }, [conselhos, selectedCpId]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Cabeçalho da Seleção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 flex items-center gap-1">
              <Filter size={11} />
              Seletor de Contexto Vicentino
            </span>
            {isMultiAccess && (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Multi-Acesso Ativo
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {title || `Selecione a Unidade Vicentina para Acesso`}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {subtitle || `Navegue pela hierarquia de Conselhos e escolha onde deseja visualizar e gerenciar os dados.`}
          </p>
        </div>

        {selection && isMultiAccess && (
          <button
            type="button"
            onClick={clearSelection}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={13} />
            Trocar Seleção
          </button>
        )}
      </div>

      {/* Trilha de Navegação / Breadcrumb Hierárquico */}
      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Landmark size={14} className="text-blue-600" />
          <span>Conselho Central de Santo André</span>
        </div>

        <ChevronRight size={14} className="text-slate-400 shrink-0" />

        {selectedCpId ? (
          <div className="flex items-center gap-1.5 font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
            <Layers size={13} className="text-indigo-600" />
            <span>{activeCP?.name || 'Conselho Particular'}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic">1. Escolha o Conselho Particular</span>
        )}

        {targetLevel === 'conferencia' && (
          <>
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
            {selection?.conferenciaId ? (
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                <Users size={13} className="text-emerald-600" />
                <span>{selection.conferenciaName}</span>
              </div>
            ) : (
              <span className="text-slate-400 italic">2. Escolha a Conferência</span>
            )}
          </>
        )}
      </div>

      {/* Campo de Busca Rápida */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={
            !selectedCpId
              ? 'Buscar Conselho Particular por nome ou cidade...'
              : 'Buscar Conferência por nome...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      {/* ETAPA 1: SELEÇÃO DO CONSELHO PARTICULAR */}
      {!selectedCpId && (
        <div className="space-y-3">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">
            1. Selecione o Conselho Particular ({filteredCPs.length})
          </span>

          {loadingHierarchy ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-blue-600" />
              Carregando Conselhos Particulares...
            </div>
          ) : filteredCPs.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
              Nenhum Conselho Particular encontrado para os filtros aplicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCPs.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => {
                    setSelectedCpId(cp.id);
                    if (targetLevel === 'particular') {
                      selectParticular(cp);
                      if (onSelectComplete) onSelectComplete();
                    }
                  }}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-blue-50/60 hover:border-blue-300 transition-all text-left flex flex-col justify-between group shadow-xs cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                      <Layers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1 group-hover:text-blue-900">
                        {cp.name}
                      </h4>
                      {cp.city && (
                        <p className="text-[11px] font-semibold text-slate-500 line-clamp-1">
                          {cp.city}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-blue-600">
                    <span>
                      {conferencias.filter(c => c.particularId === cp.id).length} Conferências vinculadas
                    </span>
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ETAPA 2: SELEÇÃO DA CONFERÊNCIA (Quando aplicável) */}
      {selectedCpId && targetLevel === 'conferencia' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">
              2. Selecione a Conferência ({filteredConferencias.length})
            </span>
            <button
              type="button"
              onClick={() => setSelectedCpId('')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              ← Voltar e escolher outro Conselho Particular
            </button>
          </div>

          {filteredConferencias.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
              Nenhuma Conferência cadastrada ou ativa neste Conselho Particular.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredConferencias.map((conf) => {
                const isSelected = selection?.conferenciaId === conf.id;
                return (
                  <button
                    key={conf.id}
                    type="button"
                    onClick={() => {
                      if (activeCP) {
                        selectConferencia(conf, activeCP);
                        if (onSelectComplete) onSelectComplete();
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all text-left flex flex-col justify-between group shadow-xs cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200/80 bg-white hover:bg-emerald-50/40 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                      }`}>
                        <Users size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1 group-hover:text-emerald-900">
                          {conf.name}
                        </h4>
                        {conf.location && (
                          <p className="text-[11px] font-semibold text-slate-500 line-clamp-1">
                            {conf.location}
                          </p>
                        )}
                        {conf.meetingDay && (
                          <p className="text-[10px] text-slate-400 font-medium">
                            Reunião: {conf.meetingDay} {conf.meetingTime ? `às ${conf.meetingTime}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-emerald-700">
                      <span>
                        {isSelected ? 'Conferência Ativa' : 'Acessar Conferência'}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 size={15} className="text-emerald-600" />
                      ) : (
                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

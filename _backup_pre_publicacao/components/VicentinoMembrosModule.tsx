import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Building2,
  Filter,
  Link2,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Info,
  Sparkles
} from 'lucide-react';
import { useVicentinoHierarchy } from './VicentinoHierarchyContext';
import { MemberRegistrationManager } from './MemberRegistrationManager';
import { ConferenciaMembrosManager } from './ConferenciaMembrosManager';
import { MemberAccessRegularizationModal } from './MemberAccessRegularizationModal';
import { StandaloneConselhoParticular, StandaloneConferencia, InstitutionSettings } from '../types';

interface VicentinoMembrosModuleProps {
  settings?: InstitutionSettings;
  institutionId?: string;
  initialParticularId?: string;
  initialConferenciaId?: string;
  onNavigateToConferencias?: (particularId?: string, conferenciaId?: string) => void;
  onNavigateToFamilias?: (particularId?: string, conferenciaId?: string) => void;
}

export const VicentinoMembrosModule: React.FC<VicentinoMembrosModuleProps> = ({
  settings,
  institutionId,
  initialParticularId,
  initialConferenciaId,
  onNavigateToConferencias,
  onNavigateToFamilias,
}) => {
  const { conselhos, conferencias, loadingHierarchy, loadConferenciasForCP } = useVicentinoHierarchy();

  const [activeTab, setActiveTab] = useState<'membros' | 'autocadastro'>('membros');
  const [isRegularizationModalOpen, setIsRegularizationModalOpen] = useState(false);

  // Identificação da Sessão do Usuário
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
      const parentCpId = conf.particularId || '';
      return userUnitKeys.has(confId) || userUnitKeys.has(confName) || userUnitKeys.has(parentCpId);
    });
  }, [conferencias, isGlobalUser, userUnitKeys]);

  // Estados da Navegação em Cascata
  const [cascadeCPId, setCascadeCPId] = useState<string>(initialParticularId || '');
  const [cascadeConfId, setCascadeConfId] = useState<string>(initialConferenciaId || '');

  // Sincronizar com props externas quando mudarem
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

  // Auto-seleção inicial de CP
  useEffect(() => {
    if (accessibleConselhos.length > 0 && !cascadeCPId) {
      setCascadeCPId(accessibleConselhos[0].id);
    }
  }, [accessibleConselhos, cascadeCPId]);

  // Carregar conferências do CP selecionado na navegação em cascata
  useEffect(() => {
    if (cascadeCPId) {
      loadConferenciasForCP(cascadeCPId);
    }
  }, [cascadeCPId, loadConferenciasForCP]);

  // Auto-selecionar primeira Conferência acessível quando conferencias do CP mudarem
  useEffect(() => {
    if (cascadeCPId) {
      const confsForCP = accessibleConferencias.filter((c) => c.particularId === cascadeCPId);
      if (confsForCP.length > 0) {
        if (!cascadeConfId || !confsForCP.some((c) => c.id === cascadeConfId)) {
          setCascadeConfId(confsForCP[0].id);
        }
      } else {
        setCascadeConfId('');
      }
    } else {
      setCascadeConfId('');
    }
  }, [cascadeCPId, accessibleConferencias, cascadeConfId]);

  const selectedCascadeCP = useMemo(() => {
    if (!cascadeCPId) return null;
    return accessibleConselhos.find((cp) => cp.id === cascadeCPId) || null;
  }, [cascadeCPId, accessibleConselhos]);

  const selectedCascadeConf = useMemo(() => {
    if (!cascadeConfId) return null;
    return accessibleConferencias.find((c) => c.id === cascadeConfId) || null;
  }, [cascadeConfId, accessibleConferencias]);

  const availableConfsForSelectedCP = useMemo(() => {
    if (!cascadeCPId) return [];
    return accessibleConferencias.filter((c) => c.particularId === cascadeCPId);
  }, [cascadeCPId, accessibleConferencias]);

  const centralName = settings?.name || 'Conselho Central';

  return (
    <div id="vicentino-membros-module" className="space-y-6 pb-12">
      {/* CAVEÇALHO PRINCIPAL E NAVEGAÇÃO DE ABAS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Guia de Membros Vicentinos</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Membros, Confrades e Consócias</h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Gestão de cadastros, fichas vicentinas, acompanhamento e autocadastro de membros por Conferência.
          </p>
        </div>

        {/* NAVEGAÇÃO ENTRE ABAS E AÇÕES ADMINISTRATIVAS */}
        <div className="flex flex-wrap items-center gap-2">
          {isGlobalUser && (
            <button
              id="btn-open-regularization-modal"
              onClick={() => setIsRegularizationModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Executa a análise e regularização automática dos membros antigos ativos"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Regularização de Membros Antigos</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0 self-start md:self-auto">
            <button
              id="tab-membros-quadro"
              onClick={() => setActiveTab('membros')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${
                activeTab === 'membros'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Quadro de Membros</span>
            </button>

            <button
              id="tab-membros-autocadastro"
              onClick={() => setActiveTab('autocadastro')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${
                activeTab === 'autocadastro'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>Link Público & Fila</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: QUADRO DE MEMBROS (COM NAVEGAÇÃO EM CASCATA) */}
      {activeTab === 'membros' && (
        <div className="space-y-6">
          {/* BARRA DE NAVEGAÇÃO EM CASCATA: SELEÇÃO DE CP E CONFERÊNCIA */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtro de Navegação Hierárquica em Cascata</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Selecione a Unidade Vicentina</h2>
              </div>
              {!isGlobalUser && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Acesso Filtrado por Nível de Usuário</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SELECTOR 1: CONSELHO PARTICULAR */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Conselho Particular
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="select-membros-cascade-cp"
                    value={cascadeCPId}
                    onChange={(e) => {
                      setCascadeCPId(e.target.value);
                      setCascadeConfId('');
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
                  >
                    {accessibleConselhos.length === 0 ? (
                      <option value="">Nenhum Conselho Particular disponível</option>
                    ) : (
                      accessibleConselhos.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.name} {cp.code ? `(${cp.code})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* SELECTOR 2: CONFERÊNCIA VICENTINA */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Conferência Vicentina
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="select-membros-cascade-conf"
                    value={cascadeConfId}
                    onChange={(e) => setCascadeConfId(e.target.value)}
                    disabled={!cascadeCPId || loadingHierarchy}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all disabled:opacity-60"
                  >
                    {!cascadeCPId ? (
                      <option value="">Selecione primeiro um Conselho Particular</option>
                    ) : availableConfsForSelectedCP.length === 0 ? (
                      <option value="">Nenhuma Conferência cadastrada neste CP</option>
                    ) : (
                      availableConfsForSelectedCP.map((conf) => (
                        <option key={conf.id} value={conf.id}>
                          {conf.name} {conf.code ? `(${conf.code})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* EXIBIÇÃO DO QUADRO DE MEMBROS DA CONFERÊNCIA SELECIONADA */}
          {selectedCascadeConf ? (
            <ConferenciaMembrosManager
              conferencia={selectedCascadeConf}
              inline={true}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-slate-800 text-base">Selecione uma Conferência</h3>
                <p className="text-xs text-slate-500">
                  Para visualizar, cadastrar ou gerenciar a lista e ficha de vicentinos, selecione a Conferência correspondente no filtro em cascata acima.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: LINK PÚBLICO & FILA DE AUTOCADASTRO */}
      {activeTab === 'autocadastro' && (
        <MemberRegistrationManager centralName={centralName} />
      )}

      {/* MODAL DE REGULARIZAÇÃO DE ACESSOS DOS MEMBROS ANTIGOS */}
      <MemberAccessRegularizationModal
        isOpen={isRegularizationModalOpen}
        onClose={() => setIsRegularizationModalOpen(false)}
        onSuccess={() => {
          if (cascadeCPId) {
            loadConferenciasForCP(cascadeCPId);
          }
        }}
      />
    </div>
  );
};

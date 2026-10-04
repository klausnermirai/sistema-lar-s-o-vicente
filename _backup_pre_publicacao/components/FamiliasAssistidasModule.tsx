import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Home,
  ShoppingBag,
  Archive,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  RotateCcw,
  Layers,
  FileText,
  Check,
  X,
  RefreshCw,
  HeartHandshake,
} from 'lucide-react';
import {
  StandaloneConselhoParticular,
  StandaloneConferencia,
  FamiliaAssistidaCompleta,
  ControleCestasMensalStats,
} from '../types';
import {
  fetchConselhosParticulares,
  fetchConferencias,
  fetchFamiliasAssistidas,
  archiveFamiliaAssistida,
  unarchiveFamiliaAssistida,
  fetchControleCestasMensal,
} from '../lib/hierarchy_api';
import { FichaSindicanciaModal } from './FichaSindicanciaModal';
import { VisitasFamiliaModal } from './VisitasFamiliaModal';
import { useVicentinoHierarchy } from './VicentinoHierarchyContext';

export interface FamiliasAssistidasModuleProps {
  settings?: any;
  institutionId?: string;
  initialParticularId?: string;
  initialConferenciaId?: string;
  onNavigateToConferencias?: (particularId?: string, conferenciaId?: string) => void;
  onNavigateToMembros?: (particularId?: string, conferenciaId?: string) => void;
  onOpenSindicanciaModal?: (familia?: FamiliaAssistidaCompleta, conferenciaId?: string) => void;
  onOpenVisitasModal?: (familia: FamiliaAssistidaCompleta) => void;
}

export const FamiliasAssistidasModule: React.FC<FamiliasAssistidasModuleProps> = ({
  settings,
  institutionId,
  initialParticularId,
  initialConferenciaId,
  onNavigateToConferencias,
  onNavigateToMembros,
  onOpenSindicanciaModal,
  onOpenVisitasModal,
}) => {
  const { userSession } = useVicentinoHierarchy();

  const userConfId = userSession?.hierarchy?.conferenciaId || userSession?.user?.conferenciaId || (userSession as any)?.conferenciaId;
  const userPartId = userSession?.hierarchy?.particularId || userSession?.user?.particularId || (userSession as any)?.particularId;
  const isMemberRole = 
    userSession?.accessLevel === 'membro_conferencia' || 
    userSession?.accessLevel === 'membro' ||
    userSession?.hierarchy?.type === 'conferencia' ||
    !!userSession?.user?.membroId;

  const effectiveInitialParticularId = initialParticularId || userPartId || '';
  const effectiveInitialConferenciaId = initialConferenciaId || userConfId || '';

  // 1. Estados da Navegação em Cascata (CP -> Conferência)
  const [conselhos, setConselhos] = useState<StandaloneConselhoParticular[]>([]);
  const [conferencias, setConferencias] = useState<StandaloneConferencia[]>([]);
  const [selectedParticularId, setSelectedParticularId] = useState<string>(effectiveInitialParticularId);
  const [selectedConferenciaId, setSelectedConferenciaId] = useState<string>(effectiveInitialConferenciaId);

  // Sincronizar com props externas ou sessão quando mudarem
  useEffect(() => {
    if (initialParticularId || userPartId) {
      setSelectedParticularId(initialParticularId || userPartId || '');
    }
  }, [initialParticularId, userPartId]);

  useEffect(() => {
    if (initialConferenciaId || userConfId) {
      setSelectedConferenciaId(initialConferenciaId || userConfId || '');
    }
  }, [initialConferenciaId, userConfId]);

  // 2. Estados das Famílias e Controle
  const [familias, setFamilias] = useState<FamiliaAssistidaCompleta[]>([]);
  const [loadingConselhos, setLoadingConselhos] = useState(true);
  const [loadingConferencias, setLoadingConferencias] = useState(false);
  const [loadingFamilias, setLoadingFamilias] = useState(false);
  const [cestasStats, setCestasStats] = useState<ControleCestasMensalStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // 3. Filtros e Abas
  const [activeTab, setActiveTab] = useState<'ativas' | 'arquivadas' | 'controle_cestas'>('ativas');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCestaMes, setFilterCestaMes] = useState<'todos' | 'com_cesta' | 'sem_cesta'>('todos');
  const [selectedMesAno, setSelectedMesAno] = useState<string>(
    () => new Date().toISOString().substring(0, 7) // YYYY-MM
  );

  // 4. Feedback e Notificações
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 5. Modal de Arquivamento
  const [familiaToArchive, setFamiliaToArchive] = useState<FamiliaAssistidaCompleta | null>(null);
  const [motivoArquivamento, setMotivoArquivamento] = useState<string>('promocao_social');
  const [detalhesArquivamento, setDetalhesArquivamento] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // 6. Modais Internos de Sindicância e Visitas
  const [isSindicanciaModalOpen, setIsSindicanciaModalOpen] = useState(false);
  const [editingFamilia, setEditingFamilia] = useState<FamiliaAssistidaCompleta | null>(null);
  const [isVisitasModalOpen, setIsVisitasModalOpen] = useState(false);
  const [selectedFamiliaVisitas, setSelectedFamiliaVisitas] = useState<FamiliaAssistidaCompleta | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // --- 1. Carregar Conselhos Particulares ---
  const loadConselhos = useCallback(async () => {
    try {
      setLoadingConselhos(true);
      const data = await fetchConselhosParticulares('ativo', institutionId);
      setConselhos(data || []);

      if (effectiveInitialParticularId && data?.some(c => c.id === effectiveInitialParticularId)) {
        setSelectedParticularId(effectiveInitialParticularId);
      } else if (data && data.length > 0) {
        setSelectedParticularId((prev) => (prev && data.some(c => c.id === prev) ? prev : data[0].id));
      }
    } catch (err: any) {
      console.error('Erro ao carregar Conselhos Particulares:', err);
      showToast('Não foi possível carregar os Conselhos Particulares.', 'error');
    } finally {
      setLoadingConselhos(false);
    }
  }, [institutionId, effectiveInitialParticularId]);

  useEffect(() => {
    loadConselhos();
  }, [loadConselhos]);

  // --- 2. Carregar Conferências do CP Selecionado ---
  const loadConferencias = useCallback(async (particularId: string) => {
    if (!particularId) {
      setConferencias([]);
      setSelectedConferenciaId('');
      return;
    }

    try {
      setLoadingConferencias(true);
      const data = await fetchConferencias(particularId, 'ativo', institutionId);
      setConferencias(data || []);

      if (effectiveInitialConferenciaId && data?.some((c) => c.id === effectiveInitialConferenciaId)) {
        setSelectedConferenciaId(effectiveInitialConferenciaId);
      } else if (data && data.length > 0) {
        setSelectedConferenciaId((prev) => (prev && data.some((c) => c.id === prev) ? prev : data[0].id));
      } else {
        setSelectedConferenciaId('');
      }
    } catch (err: any) {
      console.error('Erro ao carregar Conferências:', err);
      showToast('Não foi possível carregar as Conferências do CP.', 'error');
    } finally {
      setLoadingConferencias(false);
    }
  }, [institutionId, effectiveInitialConferenciaId, selectedConferenciaId]);

  useEffect(() => {
    if (selectedParticularId) {
      loadConferencias(selectedParticularId);
    } else {
      setConferencias([]);
      setSelectedConferenciaId('');
    }
  }, [selectedParticularId, loadConferencias]);

  // --- 3. Carregar Famílias Assistidas e Métricas de Cesta ---
  const loadFamiliasData = useCallback(async () => {
    if (!selectedConferenciaId) {
      setFamilias([]);
      setCestasStats(null);
      return;
    }

    try {
      setLoadingFamilias(true);
      setLoadingStats(true);

      const [familiasList, stats] = await Promise.all([
        fetchFamiliasAssistidas(
          selectedConferenciaId,
          {
            status: activeTab === 'arquivadas' ? 'arquivado' : activeTab === 'ativas' ? 'ativo' : 'todos',
            particularId: selectedParticularId,
          },
          institutionId
        ),
        fetchControleCestasMensal(selectedConferenciaId, selectedMesAno, institutionId),
      ]);

      setFamilias(familiasList || []);
      setCestasStats(stats || null);
    } catch (err: any) {
      console.error('Erro ao carregar dados das famílias:', err);
      showToast('Falha ao carregar lista de famílias assistidas.', 'error');
    } finally {
      setLoadingFamilias(false);
      setLoadingStats(false);
    }
  }, [selectedConferenciaId, selectedParticularId, activeTab, selectedMesAno, institutionId]);

  useEffect(() => {
    loadFamiliasData();
  }, [loadFamiliasData]);

  // --- 4. Ações de Arquivar / Desarquivar ---
  const handleConfirmArchive = async () => {
    if (!familiaToArchive) return;
    try {
      setActionLoading(true);
      await archiveFamiliaAssistida(
        familiaToArchive.id,
        motivoArquivamento,
        detalhesArquivamento,
        institutionId
      );
      showToast(`Família de ${familiaToArchive.nomeAssistido} arquivada com sucesso.`);
      setFamiliaToArchive(null);
      setDetalhesArquivamento('');
      loadFamiliasData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao arquivar família.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnarchive = async (fam: FamiliaAssistidaCompleta) => {
    if (!window.confirm(`Deseja reativar o acompanhamento da família de "${fam.nomeAssistido}"?`)) return;
    try {
      setActionLoading(true);
      await unarchiveFamiliaAssistida(fam.id, institutionId);
      showToast(`Família de ${fam.nomeAssistido} reativada com sucesso!`);
      loadFamiliasData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao desarquivar família.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // --- 5. Famílias Filtradas na Listagem ---
  const filteredFamilias = useMemo(() => {
    let list = Array.isArray(familias) ? familias : [];

    if (activeTab === 'ativas') {
      list = list.filter((f) => f.status === 'ativo');
    } else if (activeTab === 'arquivadas') {
      list = list.filter((f) => f.status === 'arquivado');
    }

    if (filterCestaMes === 'com_cesta') {
      list = list.filter((f) => f.ultimoMesAnoCesta === selectedMesAno || f.recebeuCestaMesAtual);
    } else if (filterCestaMes === 'sem_cesta') {
      list = list.filter((f) => f.ultimoMesAnoCesta !== selectedMesAno && !f.recebeuCestaMesAtual);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (f) =>
          (f.nomeAssistido || '').toLowerCase().includes(q) ||
          (f.cpfAssistido || '').includes(q) ||
          (f.telefone || '').includes(q) ||
          (f.enderecoResumido || '').toLowerCase().includes(q) ||
          (f.sindicancia?.conjugeNome || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [familias, activeTab, filterCestaMes, selectedMesAno, searchTerm]);

  const currentConf = conferencias.find((c) => c.id === selectedConferenciaId);

  return (
    <div id="familias-assistidas-module" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Notificação Toast */}
      {notification && (
        <div
          id="toast-notification-familias"
          className={`p-4 rounded-xl shadow-lg border flex items-center justify-between transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-wider ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cabeçalho do Módulo */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-semibold tracking-wide uppercase mb-3 border border-white/10">
              <Home className="w-3.5 h-3.5" />
              <span>Ação Socioassistencial Vicentina</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Famílias Assistidas & Sindicâncias</h1>
            <p className="text-blue-100/80 text-sm mt-1 max-w-2xl leading-relaxed">
              Fichas de Sindicância, visitas domiciliares, acompanhamento social contínuo e controle de cestas básicas das Conferências da SSVP.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              id="btn-nova-sindicancia-top"
              disabled={!selectedConferenciaId}
              onClick={() => {
                if (onOpenSindicanciaModal) {
                  onOpenSindicanciaModal(undefined, selectedConferenciaId);
                } else {
                  setEditingFamilia(null);
                  setIsSindicanciaModalOpen(true);
                }
              }}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nova Ficha de Sindicância</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegação em Cascata (CP -> Conferência) */}
      {isMemberRole && (userConfId || selectedConferenciaId) ? (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <HeartHandshake className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Escopo da Sua Conferência
                </span>
                <span className="text-xs text-blue-200/80">Vínculo Ativo</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {conferencias.find(c => c.id === selectedConferenciaId)?.name || userSession?.hierarchy?.conferenciaNome || 'Conferência Vicentina'}
              </h2>
              <p className="text-xs text-blue-200/90 flex items-center gap-1.5 mt-0.5">
                <span>Conselho Particular: {conselhos.find(cp => cp.id === selectedParticularId)?.name || userSession?.hierarchy?.particularNome || 'Conselho Particular'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={loadFamiliasData}
            disabled={loadingFamilias || !selectedConferenciaId}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-white/10 disabled:opacity-50 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingFamilias ? 'animate-spin' : ''}`} />
            <span>Atualizar Famílias</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Selecione a Unidade Vicentina (Filtro em Cascata)</span>
            </div>
            <button
              onClick={loadFamiliasData}
              disabled={loadingFamilias || !selectedConferenciaId}
              className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFamilias ? 'animate-spin' : ''}`} />
              <span>Atualizar Dados</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                1. Conselho Particular (CP) <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-cp-familias"
                value={selectedParticularId}
                onChange={(e) => {
                  setSelectedParticularId(e.target.value);
                  setSelectedConferenciaId('');
                }}
                disabled={loadingConselhos}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="">-- Selecione o Conselho Particular --</option>
                {conselhos.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name} {cp.city ? `(${cp.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                2. Conferência Vicentina <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-conf-familias"
                value={selectedConferenciaId}
                onChange={(e) => setSelectedConferenciaId(e.target.value)}
                disabled={!selectedParticularId || loadingConferencias}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {!selectedParticularId
                    ? '-- Selecione o CP primeiro --'
                    : loadingConferencias
                    ? 'Carregando Conferências...'
                    : conferencias.length === 0
                    ? 'Nenhuma Conferência ativa neste CP'
                    : '-- Selecione a Conferência --'}
                </option>
                {conferencias.map((conf) => (
                  <option key={conf.id} value={conf.id}>
                    {conf.name} {conf.meetingDay ? `(${conf.meetingDay})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Exibição Principal quando uma conferência é selecionada */}
      {!selectedConferenciaId ? (
        <div id="empty-state-select-conferencia" className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Selecione uma Conferência para gerenciar as Famílias</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Utilize os seletores em cascata acima para escolher o Conselho Particular e a Conferência desejada.
          </p>
        </div>
      ) : (
        <>
          {/* Indicadores / Estatísticas Rápidas do Mês da Conferência */}
          {cestasStats && (
            <div id="stats-controle-cestas-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Famílias Ativas</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{cestasStats.totalFamiliasAtivas}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Atendidas c/ Cesta ({selectedMesAno})</p>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{cestasStats.totalFamiliasAtendidasComCesta}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Cestas ({selectedMesAno})</p>
                  <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{cestasStats.totalCestasEntregues}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Famílias Arquivadas</p>
                  <p className="text-2xl font-extrabold text-slate-700 mt-0.5">{cestasStats.totalFamiliasArquivadas}</p>
                </div>
              </div>
            </div>
          )}

          {/* Abas e Filtros de Listagem */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Header das Abas */}
            <div className="border-b border-slate-200 px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2 -mb-px">
                <button
                  id="tab-familias-ativas"
                  onClick={() => setActiveTab('ativas')}
                  className={`pb-3.5 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'ativas'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Famílias em Acompanhamento</span>
                  <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                    {cestasStats?.totalFamiliasAtivas ?? 0}
                  </span>
                </button>

                <button
                  id="tab-familias-arquivadas"
                  onClick={() => setActiveTab('arquivadas')}
                  className={`pb-3.5 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'arquivadas'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span>Histórico / Arquivadas</span>
                  <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {cestasStats?.totalFamiliasArquivadas ?? 0}
                  </span>
                </button>

                <button
                  id="tab-controle-mensal"
                  onClick={() => setActiveTab('controle_cestas')}
                  className={`pb-3.5 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'controle_cestas'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Controle Mensal de Cestas</span>
                </button>
              </div>

              {/* Mês de Referência */}
              <div className="flex items-center gap-2 pb-3">
                <span className="text-xs font-semibold text-slate-500">Mês de Referência:</span>
                <input
                  type="month"
                  value={selectedMesAno}
                  onChange={(e) => setSelectedMesAno(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Painel de Busca e Filtros para Listas de Família */}
            {activeTab !== 'controle_cestas' && (
              <div className="p-4 sm:p-5 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, CPF ou endereço..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {activeTab === 'ativas' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Filtrar por cesta:</span>
                    <select
                      value={filterCestaMes}
                      onChange={(e) => setFilterCestaMes(e.target.value as any)}
                      className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="todos">Todas as famílias</option>
                      <option value="com_cesta">Já receberam cesta no mês</option>
                      <option value="sem_cesta">Ainda não receberam cesta</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo da Aba: Tabela de Famílias Ativas ou Arquivadas */}
            {activeTab !== 'controle_cestas' && (
              <div className="overflow-x-auto">
                {loadingFamilias ? (
                  <div className="py-16 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="text-xs font-semibold">Carregando fichas das famílias...</p>
                  </div>
                ) : filteredFamilias.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {searchTerm
                        ? 'Nenhuma família encontrada para o filtro informado.'
                        : activeTab === 'ativas'
                        ? 'Nenhuma família assistida ativa cadastrada nesta Conferência.'
                        : 'Nenhuma família arquivada no histórico desta Conferência.'}
                    </p>
                    {activeTab === 'ativas' && !searchTerm && (
                      <button
                        onClick={() => {
                          if (onOpenSindicanciaModal) {
                            onOpenSindicanciaModal(undefined, selectedConferenciaId);
                          } else {
                            setEditingFamilia(null);
                            setIsSindicanciaModalOpen(true);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cadastrar 1ª Família (Sindicância)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                        <th className="py-3 px-4">Assistido(a) / Família</th>
                        <th className="py-3 px-4">Composição</th>
                        <th className="py-3 px-4">Endereço</th>
                        <th className="py-3 px-4 text-center">Cesta ({selectedMesAno})</th>
                        <th className="py-3 px-4">Última Visita</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFamilias.map((fam) => {
                        const recebeuCesta =
                          fam.ultimoMesAnoCesta === selectedMesAno || fam.recebeuCestaMesAtual;
                        const membrosQtd =
                          (fam.sindicancia?.membrosFamilia?.length || 0) + (fam.sindicancia?.conjugeNome ? 2 : 1);

                        return (
                          <tr key={fam.id} className="hover:bg-slate-50/80 transition-colors" data-testid={`familia-row-${fam.id}`}>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span>{fam.nomeAssistido}</span>
                                {fam.status === 'arquivado' && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                    Arquivada
                                  </span>
                                )}
                              </div>
                              {fam.sindicancia?.conjugeNome && (
                                <div className="text-[11px] text-slate-500 font-medium">
                                  Cônjuge: {fam.sindicancia.conjugeNome}
                                </div>
                              )}
                              {fam.telefone && (
                                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />
                                  <span>{fam.telefone}</span>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                <span>{membrosQtd} pessoa(s)</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 max-w-xs">
                              <div className="text-slate-700 font-medium truncate flex items-start gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span title={fam.enderecoResumido}>{fam.enderecoResumido}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {recebeuCesta ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Entregue</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px]">
                                  <Clock className="w-3 h-3" />
                                  <span>Pendente</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-slate-700 font-medium">
                                {fam.dataUltimaVisita
                                  ? new Date(fam.dataUltimaVisita + 'T00:00:00').toLocaleDateString('pt-BR')
                                  : 'Nenhuma visita'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Total: {fam.totalVisitasRealizadas || 0} visitas
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Botão Visitas */}
                                <button
                                  id={`btn-visitas-${fam.id}`}
                                  onClick={() => {
                                    if (onOpenVisitasModal) {
                                      onOpenVisitasModal(fam);
                                    } else {
                                      setSelectedFamiliaVisitas(fam);
                                      setIsVisitasModalOpen(true);
                                    }
                                  }}
                                  title="Histórico de Visitas e Cestas"
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                  <span>Visitas</span>
                                </button>

                                {/* Botão Editar Ficha de Sindicância */}
                                <button
                                  id={`btn-editar-sindicancia-${fam.id}`}
                                  onClick={() => {
                                    if (onOpenSindicanciaModal) {
                                      onOpenSindicanciaModal(fam, fam.conferenciaId);
                                    } else {
                                      setEditingFamilia(fam);
                                      setIsSindicanciaModalOpen(true);
                                    }
                                  }}
                                  title="Ver / Editar Ficha de Sindicância"
                                  className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>

                                {/* Arquivar / Desarquivar */}
                                {fam.status === 'ativo' ? (
                                  <button
                                    id={`btn-arquivar-${fam.id}`}
                                    onClick={() => setFamiliaToArchive(fam)}
                                    title="Arquivar Família"
                                    className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    id={`btn-desarquivar-${fam.id}`}
                                    onClick={() => handleUnarchive(fam)}
                                    title="Desarquivar / Reativar Família"
                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Conteúdo da Aba: Painel Consolidado de Cestas do Mês */}
            {activeTab === 'controle_cestas' && (
              <div id="tab-controle-cestas-content" className="p-6 space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 rounded-2xl p-6">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    <span>Controle Mensal de Cestas de Alimentos - {currentConf?.name}</span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Competência selecionada: <strong>{selectedMesAno}</strong>. As entregas são contabilizadas a cada visita domiciliar com a opção "Cesta entregue" assinalada.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase">Famílias c/ Cesta</span>
                    <p className="text-3xl font-extrabold text-emerald-600 mt-1">
                      {cestasStats?.totalFamiliasAtendidasComCesta ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      De um total de {cestasStats?.totalFamiliasAtivas ?? 0} ativas
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase">Cestas Entregues</span>
                    <p className="text-3xl font-extrabold text-blue-600 mt-1">
                      {cestasStats?.totalCestasEntregues ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Volume total no mês</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase">Famílias Pendentes</span>
                    <p className="text-3xl font-extrabold text-amber-600 mt-1">
                      {cestasStats?.familiasSemCestaNoMes ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Ainda não receberam visita com cesta</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Arquivamento de Família */}
      {familiaToArchive && (
        <div id="modal-confirmar-arquivamento" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Arquivar Família Assistida</h3>
                <p className="text-xs text-slate-500">
                  {familiaToArchive.nomeAssistido}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Ao arquivar, a família deixa de constar nas entregas ativas do mês, mas todo o histórico de sindicância e visitas permanecerá salvo e poderá ser desarquivado quando necessário.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo do Arquivamento <span className="text-rose-500">*</span>
                </label>
                <select
                  value={motivoArquivamento}
                  onChange={(e) => setMotivoArquivamento(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="promocao_social">Promoção Social / Autonomia Financeira</option>
                  <option value="mudanca">Mudança de Bairro / Cidade</option>
                  <option value="falecimento">Falecimento do Assistido</option>
                  <option value="desistencia">Desistência / Não necessita mais de auxílio</option>
                  <option value="outro">Outro Motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detalhes / Justificativa (Opcional)
                </label>
                <textarea
                  value={detalhesArquivamento}
                  onChange={(e) => setDetalhesArquivamento(e.target.value)}
                  rows={2}
                  placeholder="Ex: Família conseguiu emprego formal e agradeceu o auxílio..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFamiliaToArchive(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                <span>Confirmar Arquivamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ficha de Sindicância (Cadastro & Edição Completa) */}
      {isSindicanciaModalOpen && (
        <FichaSindicanciaModal
          isOpen={isSindicanciaModalOpen}
          onClose={() => {
            setIsSindicanciaModalOpen(false);
            setEditingFamilia(null);
          }}
          onSuccess={(saved) => {
            showToast(`Ficha de sindicância de "${saved.nomeAssistido}" salva com sucesso!`);
            loadFamiliasData();
          }}
          conferenciaId={selectedConferenciaId}
          conferenciaName={currentConf?.name}
          familiaToEdit={editingFamilia}
          institutionId={institutionId}
        />
      )}

      {/* Modal de Visitas e Histórico de Cestas */}
      {isVisitasModalOpen && selectedFamiliaVisitas && (
        <VisitasFamiliaModal
          isOpen={isVisitasModalOpen}
          onClose={() => {
            setIsVisitasModalOpen(false);
            setSelectedFamiliaVisitas(null);
          }}
          familia={selectedFamiliaVisitas}
          conferenciaName={currentConf?.name}
          institutionId={institutionId}
          onVisitaSaved={() => {
            loadFamiliasData();
          }}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Link2,
  Copy,
  Check,
  RefreshCw,
  PowerOff,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Search,
  Filter,
  UserCheck,
  UserX,
  Eye,
  Calendar,
  Phone,
  Mail,
  Building2,
  Users,
  Shield,
  Clock,
  AlertTriangle,
  FileText,
  Plus,
  Edit3,
  Send,
  ArrowRight
} from 'lucide-react';
import {
  fetchCentralPublicTokenConfig,
  generateCentralPublicToken,
  revokeCentralPublicToken,
  fetchCentralMemberSubmissions,
  checkRegistrationDuplicates,
  approveMemberRegistration,
  confirmAndSendMemberRegistration,
  rejectMemberRegistration,
  reconcileCentralMemberSubmissions,
  buildPublicRegistrationUrl,
  fetchConselhosParticulares,
  fetchConferencias,
  HierarchyApiError,
} from '../lib/hierarchy_api';
import { StandaloneConselhoParticular, StandaloneConferencia } from '../types';
import { DateInputWithPicker } from './DateInputWithPicker';

interface MemberRegistrationManagerProps {
  centralName: string;
}

export const MemberRegistrationManager: React.FC<MemberRegistrationManagerProps> = ({ centralName }) => {
  // Estado do Token Público
  const [tokenConfig, setTokenConfig] = useState<{
    token: string;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
    revokedAt?: string;
  } | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  // Lista de Solicitações
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    'todos' | 'pendentes' | 'aguardando_revisao_duplicidade' | 'aguardando_aprovacao' | 'processado_automaticamente' | 'aprovado' | 'recusado'
  >('pendentes');
  const [filterParticularId, setFilterParticularId] = useState<string>('all');
  const [filterConferenciaId, setFilterConferenciaId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Conselhos e Conferências para Filtros e Modais
  const [particulares, setParticulares] = useState<StandaloneConselhoParticular[]>([]);
  const [allConferencias, setAllConferencias] = useState<StandaloneConferencia[]>([]);

  // Modal de Detalhes / Revisão / Aprovação
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({
    particularId: '',
    conferenciaId: '',
    fullName: '',
    type: 'confrade',
    gender: '',
    cpf: '',
    profession: '',
    phone: '',
    phoneResidential: '',
    phoneCommercial: '',
    email: '',
    addressZip: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: '',
    birthDate: '',
    admissionDate: '',
    acclamationDate: '',
    proclamationDate: '',
  });

  // Conferências disponíveis para o CP selecionado dentro do Modal de Edição
  const [modalConferencias, setModalConferencias] = useState<StandaloneConferencia[]>([]);
  const [loadingModalConferencias, setLoadingModalConferencias] = useState(false);

  // Checagem de Duplicidades
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Modal de Recusa
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Ações e Notificações
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 6000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // 1. Carregar Configuração do Token Público
  const loadTokenConfig = useCallback(async () => {
    setLoadingToken(true);
    try {
      const data = await fetchCentralPublicTokenConfig();
      setTokenConfig(data || null);
    } catch (err: any) {
      console.error('Erro ao carregar token público:', err);
    } finally {
      setLoadingToken(false);
    }
  }, []);

  // 2. Carregar CPs e Conferências para filtros
  const loadHierarchyData = useCallback(async () => {
    try {
      const cps = await fetchConselhosParticulares('ativo');
      const safeCps = Array.isArray(cps) ? cps : [];
      setParticulares(safeCps);

      // Carrega conferências de todos os CPs
      const confPromises = safeCps.map((cp) => fetchConferencias(cp.id, 'ativo').catch(() => []));
      const confResults = await Promise.all(confPromises);
      setAllConferencias(confResults.flat());
    } catch (err) {
      console.error('Erro ao carregar estrutura para filtros:', err);
      setParticulares([]);
      setAllConferencias([]);
    }
  }, []);

  // 3. Carregar Solicitações de Cadastro
  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    try {
      // Quando o filtro for 'pendentes' ou 'todos', busca tudo do backend e filtra no cliente
      const backendStatus =
        statusFilter === 'todos' || statusFilter === 'pendentes' ? undefined : statusFilter;
      const data = await fetchCentralMemberSubmissions({
        status: backendStatus,
        particularId: filterParticularId === 'all' ? undefined : filterParticularId,
        conferenciaId: filterConferenciaId === 'all' ? undefined : filterConferenciaId,
      });
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erro ao carregar solicitações de cadastro:', err);
      setSubmissions([]);
      showNotification(err?.message || 'Falha ao buscar solicitações de cadastro.', true);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [statusFilter, filterParticularId, filterConferenciaId]);

  useEffect(() => {
    loadTokenConfig();
    loadHierarchyData();
  }, [loadTokenConfig, loadHierarchyData]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // Carregar conferências do modal ao alterar o CP selecionado
  const loadModalConfs = useCallback(async (particularId: string) => {
    if (!particularId) {
      setModalConferencias([]);
      return;
    }
    setLoadingModalConferencias(true);
    try {
      const confs = await fetchConferencias(particularId, 'ativo');
      setModalConferencias(Array.isArray(confs) ? confs : []);
    } catch (err) {
      console.error('Erro ao carregar conferências do modal:', err);
      setModalConferencias([]);
    } finally {
      setLoadingModalConferencias(false);
    }
  }, []);

  useEffect(() => {
    if (editFormData.particularId) {
      loadModalConfs(editFormData.particularId);
    }
  }, [editFormData.particularId, loadModalConfs]);

  // Gerar / Rotacionar Token Público
  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    setErrorMessage(null);
    try {
      const result = await generateCentralPublicToken();
      setTokenConfig(result);
      setIsRevokeModalOpen(false);
      showNotification('Link de autocadastro gerado com sucesso!');
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao gerar link público.', true);
    } finally {
      setGeneratingToken(false);
    }
  };

  // Revogar Token Público
  const handleRevokeToken = async () => {
    setGeneratingToken(true);
    setErrorMessage(null);
    try {
      await revokeCentralPublicToken();
      setTokenConfig((prev) => (prev ? { ...prev, enabled: false, revokedAt: new Date().toISOString() } : null));
      setIsRevokeModalOpen(false);
      showNotification('Link de autocadastro revogado. Novos acessos com este link serão bloqueados.');
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao revogar link público.', true);
    } finally {
      setGeneratingToken(false);
    }
  };

  // Copiar link padronizado ?cadastro=<TOKEN>
  const handleCopyLink = () => {
    if (!tokenConfig?.token || !tokenConfig.enabled) return;
    const url = buildPublicRegistrationUrl(tokenConfig.token);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
    showNotification('Link copiado para a área de transferência!');
  };

  // Abrir Modal de Revisão
  const handleOpenReview = async (submission: any) => {
    setSelectedSubmission(submission);
    setEditFormData({
      particularId: submission.particularId || '',
      conferenciaId: submission.conferenciaId || '',
      fullName: submission.fullName || '',
      type: submission.type || 'confrade',
      gender: submission.gender || '',
      cpf: submission.cpf || '',
      profession: submission.profession || '',
      phone: submission.phone || '',
      phoneResidential: submission.phoneResidential || '',
      phoneCommercial: submission.phoneCommercial || '',
      email: submission.email || '',
      addressZip: submission.addressZip || '',
      addressStreet: submission.addressStreet || '',
      addressNumber: submission.addressNumber || '',
      addressComplement: submission.addressComplement || '',
      addressNeighborhood: submission.addressNeighborhood || '',
      addressCity: submission.addressCity || '',
      addressState: submission.addressState || '',
      birthDate: submission.birthDate || '',
      admissionDate: submission.admissionDate || '',
      acclamationDate: submission.acclamationDate || '',
      proclamationDate: submission.proclamationDate || '',
    });

    setIsReviewModalOpen(true);
    setDuplicateMatches([]);

    // Checar duplicidades iniciais
    setCheckingDuplicates(true);
    try {
      const matches = await checkRegistrationDuplicates({
        normalizedName: submission.normalizedName || '',
        normalizedPhone: submission.normalizedPhone || '',
        email: submission.email || undefined,
      });
      setDuplicateMatches(matches || []);
    } catch (err) {
      console.error('Erro ao checar duplicidades:', err);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  // Aprovar Solicitação
  const handleApprove = async () => {
    if (!selectedSubmission) return;
    if (!editFormData.birthDate || !editFormData.birthDate.trim()) {
      showNotification('Informe a data de nascimento do membro antes de aprovar. Ela é necessária para criar o acesso.', true);
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await approveMemberRegistration(selectedSubmission.id, editFormData);
      showNotification(`Membro "${editFormData.fullName}" aprovado e cadastrado com sucesso na Conferência!`);
      setIsReviewModalOpen(false);
      setSelectedSubmission(null);
      loadSubmissions();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao aprovar cadastro.', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirmar Cadastro e Forçar Envio Direto para a Conferência
  const handleConfirmSend = async (submission: any, customData?: any) => {
    if (!submission) return;
    const targetBirthDate = customData?.birthDate || submission.birthDate;
    if (!targetBirthDate || !String(targetBirthDate).trim()) {
      showNotification('Informe a data de nascimento do membro antes de confirmar o cadastro. Ela é necessária para criar o acesso.', true);
      return;
    }
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const payloadData = customData || {
        particularId: submission.particularId,
        conferenciaId: submission.conferenciaId,
        fullName: submission.fullName,
        type: submission.type,
        gender: submission.gender,
        cpf: submission.cpf,
        profession: submission.profession,
        addressStreet: submission.addressStreet,
        addressNumber: submission.addressNumber,
        addressComplement: submission.addressComplement,
        addressNeighborhood: submission.addressNeighborhood,
        addressCity: submission.addressCity,
        addressState: submission.addressState,
        addressZip: submission.addressZip,
        fullAddress: submission.fullAddress,
        phone: submission.phone,
        phoneResidential: submission.phoneResidential,
        phoneCommercial: submission.phoneCommercial,
        email: submission.email,
        birthDate: submission.birthDate,
        admissionDate: submission.admissionDate,
        acclamationDate: submission.acclamationDate,
        proclamationDate: submission.proclamationDate,
      };

      await confirmAndSendMemberRegistration(submission.id, payloadData);
      showNotification(`Cadastro de "${payloadData.fullName || submission.fullName}" confirmado e enviado com sucesso para a Conferência!`);
      setIsReviewModalOpen(false);
      setSelectedSubmission(null);
      loadSubmissions();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao confirmar e enviar cadastro para a Conferência.', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Conciliar e Sincronizar Fila e Membros em Massa
  const handleReconcile = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const confFilter = filterConferenciaId !== 'all' ? filterConferenciaId : undefined;
      const result = await reconcileCentralMemberSubmissions(confFilter);
      showNotification(result?.message || 'Sincronização e conciliação concluídas com sucesso!');
      await loadSubmissions();
      await loadHierarchyData();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao conciliar cadastros.', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Abrir modal de Recusa
  const handleOpenReject = (submission: any) => {
    setSelectedSubmission(submission);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  // Confirmar Recusa
  const handleConfirmReject = async () => {
    if (!selectedSubmission) return;
    if (!rejectionReason.trim()) {
      showNotification('Informe o motivo da recusa.', true);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      await rejectMemberRegistration(selectedSubmission.id, rejectionReason.trim());
      showNotification('Solicitação recusada com sucesso. O histórico foi preservado.');
      setIsRejectModalOpen(false);
      setIsReviewModalOpen(false);
      setSelectedSubmission(null);
      loadSubmissions();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao recusar solicitação.', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtros locais de busca por nome ou telefone e status composto
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Filtro de status composto
      if (statusFilter === 'pendentes') {
        const isPending =
          sub.status === 'aguardando_aprovacao' ||
          sub.status === 'aguardando_revisao_duplicidade' ||
          sub.status === 'parcialmente_processado';
        if (!isPending) return false;
      } else if (statusFilter !== 'todos') {
        if (sub.status !== statusFilter) return false;
      }

      const matchSearch =
        sub.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.phone?.includes(searchTerm) ||
        (sub.email && sub.email.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSearch;
    });
  }, [submissions, searchTerm, statusFilter]);

  // Contadores
  const pendingCount = useMemo(() => {
    return submissions.filter(
      (s) =>
        s.status === 'aguardando_aprovacao' ||
        s.status === 'aguardando_revisao_duplicidade' ||
        s.status === 'parcialmente_processado'
    ).length;
  }, [submissions]);

  const duplicateReviewCount = useMemo(() => {
    return submissions.filter((s) => s.status === 'aguardando_revisao_duplicidade').length;
  }, [submissions]);

  const autoProcessedCount = useMemo(() => {
    return submissions.filter((s) => s.status === 'processado_automaticamente').length;
  }, [submissions]);

  return (
    <div id="member-registration-manager" className="space-y-6">
      {/* Alertas de Notificação */}
      {errorMessage && (
        <div id="alert-error-registration" className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div id="alert-success-registration" className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEÇÃO 1: GERENCIAMENTO DO LINK PÚBLICO (?cadastro=<TOKEN>) */}
      {/* ========================================================================= */}
      <div id="card-public-token-management" className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Link2 className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-900">Link Público de Autocadastro de Membros</h3>
              {tokenConfig?.enabled ? (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                  Link Ativo
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                  Link Inativo / Não Gerado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600">
              Compartilhe este link com candidatos a confrades, consócias e aspirantes. Eles poderão preencher seus dados e selecionar a Conferência de destino com aceite do termo LGPD.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {loadingToken ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2 px-4">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Carregando link...</span>
              </div>
            ) : tokenConfig?.enabled ? (
              <>
                <button
                  id="btn-copy-public-link"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors shadow-xs"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link Público'}</span>
                </button>
                <button
                  id="btn-open-revoke-modal"
                  onClick={() => setIsRevokeModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-medium rounded-xl text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Gerenciar / Revogar</span>
                </button>
              </>
            ) : (
              <button
                id="btn-generate-initial-link"
                onClick={handleGenerateToken}
                disabled={generatingToken}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors shadow-xs disabled:opacity-50"
              >
                {generatingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Gerar Link de Autocadastro</span>
              </button>
            )}
          </div>
        </div>

        {/* Pré-visualização do Link Ativo */}
        {tokenConfig?.enabled && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl">
            <div className="flex items-center gap-2 overflow-hidden w-full text-xs font-mono text-slate-700 truncate">
              <span className="text-slate-400 select-none">URL:</span>
              <span className="truncate">{buildPublicRegistrationUrl(tokenConfig.token)}</span>
            </div>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">
              Formato seguro <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">?cadastro=&lt;TOKEN&gt;</code>
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: FILA DE SOLICITAÇÕES DE AUTOCADASTRO */}
      {/* ========================================================================= */}
      <div id="submissions-queue-section" className="space-y-4">
        {/* Barra de Filtros e Busca */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-submission"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Filtro de Status */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium text-slate-600 flex-wrap">
              <button
                id="filter-status-pendentes"
                onClick={() => setStatusFilter('pendentes')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'pendentes' ? 'bg-white text-emerald-800 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <span>Pendentes</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                id="filter-status-duplicidade"
                onClick={() => setStatusFilter('aguardando_revisao_duplicidade')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'aguardando_revisao_duplicidade' ? 'bg-white text-amber-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <span>Revisão Duplicidade</span>
                {duplicateReviewCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                    {duplicateReviewCount}
                  </span>
                )}
              </button>
              <button
                id="filter-status-alteracoes"
                onClick={() => setStatusFilter('aguardando_aprovacao')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'aguardando_aprovacao' ? 'bg-white text-blue-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                Aprovação Alterações
              </button>
              <button
                id="filter-status-automatico"
                onClick={() => setStatusFilter('processado_automaticamente')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'processado_automaticamente' ? 'bg-white text-emerald-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                <span>Processados Auto</span>
                {autoProcessedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-500 text-white text-[10px] font-bold">
                    {autoProcessedCount}
                  </span>
                )}
              </button>
              <button
                id="filter-status-aprovado"
                onClick={() => setStatusFilter('aprovado')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'aprovado' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                Aprovados
              </button>
              <button
                id="filter-status-recusado"
                onClick={() => setStatusFilter('recusado')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'recusado' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                Recusados
              </button>
              <button
                id="filter-status-todos"
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
                }`}
              >
                Todos
              </button>
            </div>

            {/* Filtro CP */}
            <select
              id="select-filter-cp"
              value={filterParticularId}
              onChange={(e) => {
                setFilterParticularId(e.target.value);
                setFilterConferenciaId('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todos os CPs</option>
              {particulares.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name}
                </option>
              ))}
            </select>

            {/* Botão de Conciliação e Sincronização */}
            <button
              id="btn-reconcile-submissions"
              onClick={handleReconcile}
              disabled={actionLoading || loadingSubmissions}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors shrink-0 disabled:opacity-50"
              title="Concilia e sincroniza todas as solicitações confirmadas com o banco de dados e recalcula contadores"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizar Cadastros</span>
            </button>

            {/* Recarregar */}
            <button
              id="btn-refresh-submissions"
              onClick={loadSubmissions}
              disabled={loadingSubmissions}
              className="p-2 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              title="Recarregar Fila"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSubmissions ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabela de Solicitações */}
        {loadingSubmissions ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-600">Carregando solicitações de cadastro...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhuma solicitação encontrada</h3>
            <p className="text-sm text-slate-500 max-w-md">
              {statusFilter === 'aguardando_aprovacao'
                ? 'Não há solicitações pendentes de análise no momento.'
                : 'Nenhum registro corresponde aos filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4">Candidato / Membro</th>
                    <th className="py-3.5 px-4">Classificação</th>
                    <th className="py-3.5 px-4">Destino (CP / Conferência)</th>
                    <th className="py-3.5 px-4">Data Envio</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredSubmissions.map((sub) => {
                    const cp = particulares.find((c) => c.id === sub.particularId);
                    const conf = allConferencias.find((c) => c.id === sub.conferenciaId);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{sub.fullName}</span>
                            {sub.tipo === 'atualizacao_cadastral' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                Atualização
                              </span>
                            ) : sub.tipo === 'complementacao_cadastro' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Complementação
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Novo
                              </span>
                            )}
                          </div>
                          {sub.isThirdPartySubmission && (
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                              Preenchido por: <span className="text-slate-700 font-semibold">{sub.representativeName || 'Responsável'}</span>
                            </div>
                          )}
                          <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {sub.phone}
                            </span>
                            {sub.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {sub.email}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                              sub.type === 'confrade'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : sub.type === 'consocia'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : sub.type === 'aspirante'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : sub.type === 'afastado'
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {sub.type}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{conf?.name || 'Conferência'}</div>
                          <div className="text-xs text-slate-500">{cp?.name || 'Conselho Particular'}</div>
                        </td>

                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('pt-BR') : '-'}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {sub.status === 'aguardando_revisao_duplicidade' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              Revisão Duplicidade
                            </span>
                          ) : sub.status === 'aguardando_aprovacao' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Clock className="w-3 h-3 text-blue-600" />
                              Aguardando Alteração
                            </span>
                          ) : sub.status === 'parcialmente_processado' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <Clock className="w-3 h-3 text-purple-600" />
                              Parcialmente Processado
                            </span>
                          ) : sub.status === 'processado_automaticamente' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Processado Automático
                            </span>
                          ) : sub.status === 'aprovado' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Aprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <X className="w-3 h-3" />
                              Recusado
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {(() => {
                              const isActionable =
                                sub.status === 'aguardando_aprovacao' ||
                                sub.status === 'aguardando_revisao_duplicidade' ||
                                sub.status === 'parcialmente_processado';

                              return (
                                <>
                                  {sub.status !== 'recusado' && (
                                    <button
                                      id={`btn-confirm-send-${sub.id}`}
                                      onClick={() => handleConfirmSend(sub)}
                                      disabled={actionLoading}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-2xs ${
                                        sub.status === 'processado_automaticamente' || sub.status === 'aprovado'
                                          ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                      }`}
                                      title="Confirmar cadastro e garantir envio/criação direta na Conferência"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      <span>
                                        {sub.status === 'processado_automaticamente' || sub.status === 'aprovado'
                                          ? 'Reenviar p/ Conf.'
                                          : 'Confirmar Envio'}
                                      </span>
                                    </button>
                                  )}

                                  <button
                                    id={`btn-review-submission-${sub.id}`}
                                    onClick={() => handleOpenReview(sub)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{isActionable ? 'Revisar' : 'Detalhes'}</span>
                                  </button>

                                  {isActionable && (
                                    <button
                                      id={`btn-quick-reject-${sub.id}`}
                                      onClick={() => handleOpenReject(sub)}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Recusar Solicitação"
                                    >
                                      <UserX className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REVISÃO, CORREÇÃO DE DADOS, DUPLICIDADES E APROVAÇÃO */}
      {/* ========================================================================= */}
      {isReviewModalOpen && selectedSubmission && (
        <div id="modal-review-submission" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-2xl w-full my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedSubmission.status === 'aguardando_aprovacao' ? 'Revisar Cadastro de Membro' : 'Detalhes da Solicitação'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enviado em {selectedSubmission.submittedAt ? new Date(selectedSubmission.submittedAt).toLocaleString('pt-BR') : '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ALERTA DE DUPLICIDADE */}
            {checkingDuplicates ? (
              <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Verificando membros existentes no Conselho Central...</span>
              </div>
            ) : duplicateMatches.length > 0 ? (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Possível Duplicidade Detectada ({duplicateMatches.length})</span>
                </div>
                <p className="text-xs text-amber-700">
                  Já existem membros cadastrados no Conselho Central com o mesmo nome, telefone ou e-mail:
                </p>
                <ul className="text-xs text-amber-800 divide-y divide-amber-200/60 font-medium">
                  {duplicateMatches.map((m) => (
                    <li key={m.id} className="py-1.5 flex items-center justify-between">
                      <span>• {m.fullName}</span>
                      <span className="text-[11px] text-amber-600">{m.phone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Termo de Consentimento LGPD */}
            <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>
                    {selectedSubmission.isThirdPartySubmission
                      ? `Consentimento firmado por responsável autorizado (Versão ${selectedSubmission.consent?.termVersion || '1.0'})`
                      : `Consentimento LGPD aceito pelo candidato (Versão ${selectedSubmission.consent?.termVersion || '1.0'})`}
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedSubmission.consent?.ipHash ? `IP Hash: ${selectedSubmission.consent.ipHash}` : ''}
                </span>
              </div>
              {selectedSubmission.isThirdPartySubmission && (
                <div className="text-[11px] text-slate-500 pl-6">
                  Preenchido por: <strong className="text-slate-700">{selectedSubmission.representativeName || 'Responsável'}</strong> (com declaração de autorização prévia)
                </div>
              )}
            </div>

            {/* Destaque das alterações solicitadas se for atualização cadastral */}
            {selectedSubmission.tipo === 'atualizacao_cadastral' && selectedSubmission.requestedChanges && (
              <div className="mt-4 p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-blue-900 text-xs font-bold uppercase tracking-wider">
                  <Edit3 className="w-4 h-4 text-blue-700" />
                  <span>Alterações Solicitadas pelo Membro</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-blue-950">
                  {Object.entries(selectedSubmission.requestedChanges).map(([k, v]) => (
                    <div key={k} className="p-2 bg-white/80 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-600 font-bold uppercase block">{k}</span>
                      <span className="font-semibold text-slate-800">{String(v || '-')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário de Revisão e Correção */}
            {(() => {
              const isEditable = selectedSubmission.status !== 'recusado';

              return (
                <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  <p className="text-xs text-rose-600 font-medium">* Campos obrigatórios</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Conselho Particular */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Conselho Particular de Destino <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="input-review-particular"
                        disabled={!isEditable}
                        value={editFormData.particularId}
                        onChange={(e) => {
                          setEditFormData({ ...editFormData, particularId: e.target.value, conferenciaId: '' });
                        }}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      >
                        <option value="">Selecione o Conselho Particular</option>
                        {particulares.map((cp) => (
                          <option key={cp.id} value={cp.id}>
                            {cp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Conferência */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Conferência de Destino <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="input-review-conferencia"
                        disabled={!isEditable || loadingModalConferencias}
                        value={editFormData.conferenciaId}
                        onChange={(e) => setEditFormData({ ...editFormData, conferenciaId: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      >
                        <option value="">
                          {loadingModalConferencias ? 'Carregando Conferências...' : 'Selecione a Conferência'}
                        </option>
                        {modalConferencias.map((conf) => (
                          <option key={conf.id} value={conf.id}>
                            {conf.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-review-fullname"
                      type="text"
                      disabled={!isEditable}
                      value={editFormData.fullName}
                      onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>

                  {/* Sexo, CPF e Profissão */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Sexo / Gênero (Opcional)</label>
                      <select
                        disabled={!isEditable}
                        value={editFormData.gender}
                        onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      >
                        <option value="">Não informado</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">CPF (Opcional)</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={editFormData.cpf}
                        onChange={(e) => setEditFormData({ ...editFormData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Profissão (Opcional)</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={editFormData.profession}
                        onChange={(e) => setEditFormData({ ...editFormData, profession: e.target.value })}
                        placeholder="Ex: Professor"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Classificação Vicentina */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Classificação Vicentina</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {(['confrade', 'consocia', 'aspirante', 'afastado', 'auxiliar'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setEditFormData({ ...editFormData, type })}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                            editFormData.type === type
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-60'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Telefones e E-mail */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Telefone Celular / WhatsApp <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-review-phone"
                        type="text"
                        disabled={!isEditable}
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail (opcional)</label>
                      <input
                        id="input-review-email"
                        type="email"
                        disabled={!isEditable}
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Telefones Adicionais */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Residencial (Opcional)</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={editFormData.phoneResidential}
                        onChange={(e) => setEditFormData({ ...editFormData, phoneResidential: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Comercial (Opcional)</label>
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={editFormData.phoneCommercial}
                        onChange={(e) => setEditFormData({ ...editFormData, phoneCommercial: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Endereço Residencial (Opcional) */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Endereço Residencial (Opcional)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">CEP</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressZip}
                          onChange={(e) => setEditFormData({ ...editFormData, addressZip: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Logradouro / Rua</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressStreet}
                          onChange={(e) => setEditFormData({ ...editFormData, addressStreet: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Número</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressNumber}
                          onChange={(e) => setEditFormData({ ...editFormData, addressNumber: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Complemento</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressComplement}
                          onChange={(e) => setEditFormData({ ...editFormData, addressComplement: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Bairro</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressNeighborhood}
                          onChange={(e) => setEditFormData({ ...editFormData, addressNeighborhood: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Cidade</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressCity}
                          onChange={(e) => setEditFormData({ ...editFormData, addressCity: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Estado (UF)</label>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={editFormData.addressState}
                          onChange={(e) => setEditFormData({ ...editFormData, addressState: e.target.value.toUpperCase().substring(0, 2) })}
                          maxLength={2}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Datas Vicentinas e Histórico */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <DateInputWithPicker
                        id="input-review-birthdate"
                        label="Data de Nascimento"
                        value={editFormData.birthDate}
                        onChange={(val) => setEditFormData({ ...editFormData, birthDate: val })}
                        disabled={!isEditable}
                        required={true}
                        allowFutureDates={false}
                        helpText="Obrigatória para aprovação e criação do acesso."
                      />
                    </div>
                    <div>
                      <DateInputWithPicker
                        id="input-review-admissiondate"
                        label="Data de Ingresso na SSVP"
                        value={editFormData.admissionDate}
                        onChange={(val) => setEditFormData({ ...editFormData, admissionDate: val })}
                        disabled={!isEditable}
                        allowFutureDates={false}
                      />
                    </div>
                    <div>
                      <DateInputWithPicker
                        id="input-review-acclamationdate"
                        label="Data de Aclamação"
                        value={editFormData.acclamationDate}
                        onChange={(val) => setEditFormData({ ...editFormData, acclamationDate: val })}
                        disabled={!isEditable}
                        allowFutureDates={false}
                      />
                    </div>
                    <div>
                      <DateInputWithPicker
                        id="input-review-proclamationdate"
                        label="Data de Proclamação"
                        value={editFormData.proclamationDate}
                        onChange={(val) => setEditFormData({ ...editFormData, proclamationDate: val })}
                        disabled={!isEditable}
                        allowFutureDates={false}
                      />
                    </div>
                  </div>

                  {/* Informações de Recusa (se aplicável) */}
                  {selectedSubmission.status === 'recusado' && selectedSubmission.rejectionReason && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                      <span className="text-xs font-bold text-rose-800">Motivo da Recusa:</span>
                      <p className="text-xs text-rose-700">{selectedSubmission.rejectionReason}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Rodapé e Ações do Modal */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
              >
                Fechar
              </button>

              {/* Ações do Rodapé */}
              {selectedSubmission.status !== 'recusado' ? (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {(selectedSubmission.status === 'aguardando_aprovacao' ||
                    selectedSubmission.status === 'aguardando_revisao_duplicidade' ||
                    selectedSubmission.status === 'parcialmente_processado') && (
                    <button
                      id="btn-reject-modal-action"
                      type="button"
                      onClick={() => handleOpenReject(selectedSubmission)}
                      disabled={actionLoading}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
                    >
                      Recusar...
                    </button>
                  )}

                  <button
                    id="btn-confirm-send-modal-action"
                    type="button"
                    onClick={() => handleConfirmSend(selectedSubmission, editFormData)}
                    disabled={actionLoading || !editFormData.particularId || !editFormData.conferenciaId || !editFormData.fullName}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {selectedSubmission.status === 'processado_automaticamente' || selectedSubmission.status === 'aprovado'
                        ? 'Salvar e Reenviar para a Conferência'
                        : 'Confirmar Cadastro e Enviar para a Conferência'}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECUSA DE SOLICITAÇÃO (MOTIVO OBRIGATÓRIO) */}
      {/* ========================================================================= */}
      {isRejectModalOpen && selectedSubmission && (
        <div id="modal-reject-submission" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mb-3">
              <UserX className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Recusar Solicitação de Cadastro</h3>
            <p className="text-xs text-slate-500 mb-4">
              Informe o motivo da recusa para o candidato <strong>{selectedSubmission.fullName}</strong>. O registro da solicitação será preservado para fins de auditoria.
            </p>

            <textarea
              id="input-rejection-reason"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Cadastro duplicado, candidato já pertence a outra conferência ou dados divergentes..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-rejection"
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                <span>Confirmar Recusa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REVOGAÇÃO / REGENERAÇÃO DO LINK PÚBLICO */}
      {/* ========================================================================= */}
      {isRevokeModalOpen && (
        <div id="modal-revoke-token" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Gerenciar Link de Autocadastro</h3>
            <p className="text-xs text-slate-500 mb-4">
              Ao gerar um novo link ou revogar o atual, o endereço anterior distribuído aos membros será imediatamente invalidado.
            </p>

            <div className="space-y-2">
              <button
                id="btn-confirm-regenerate-token"
                type="button"
                onClick={handleGenerateToken}
                disabled={generatingToken}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {generatingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Gerar Novo Link (Substituir Atual)</span>
              </button>

              <button
                id="btn-confirm-revoke-token"
                type="button"
                onClick={handleRevokeToken}
                disabled={generatingToken}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                <PowerOff className="w-4 h-4" />
                <span>Desativar Link Sem Gerar Novo</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                className="w-full py-2 px-4 text-slate-500 hover:text-slate-700 font-medium rounded-xl text-sm transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

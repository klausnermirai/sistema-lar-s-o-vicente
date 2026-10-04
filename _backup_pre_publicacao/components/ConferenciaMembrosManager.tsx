import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit,
  PowerOff,
  Phone,
  Mail,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  UserCheck,
  UserPlus,
  UserX,
  ShieldCheck,
  User,
  RefreshCw,
  Eye,
  MapPin,
  Briefcase,
  Layers,
  Sparkles,
  KeyRound,
  Lock,
  Unlock,
  Key,
} from 'lucide-react';
import {
  fetchMembrosConferencia,
  createMembroConferencia,
  updateMembroConferencia,
  inactivateMembroConferencia,
  reconcileCentralMemberSubmissions,
  performMemberAccessAction,
} from '../lib/hierarchy_api';
import { MembroSSVP, StandaloneConferencia } from '../types';
import { DateInputWithPicker } from './DateInputWithPicker';

interface ConferenciaMembrosManagerProps {
  conferencia: StandaloneConferencia;
  onClose?: () => void;
  inline?: boolean;
}

export const ConferenciaMembrosManager: React.FC<ConferenciaMembrosManagerProps> = ({
  conferencia,
  onClose,
  inline = false,
}) => {
  const [membros, setMembros] = useState<MembroSSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'inativo'>('ativo');
  const [typeFilter, setTypeFilter] = useState<'all' | 'confrade' | 'consocia' | 'auxiliar' | 'aspirante' | 'afastado'>('all');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal de Detalhes / Ficha Completa
  const [selectedMembroDetalhes, setSelectedMembroDetalhes] = useState<MembroSSVP | null>(null);

  // Modais de Criação/Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<MembroSSVP | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    type: 'confrade' as 'confrade' | 'consocia' | 'auxiliar' | 'aspirante' | 'afastado',
    gender: '' as 'masculino' | 'feminino' | 'outro' | '',
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

  // Modal de Inativação
  const [membroToInactivate, setMembroToInactivate] = useState<MembroSSVP | null>(null);

  // Modal / Confirmação de Redefinição de Senha DDMM
  const [membroToResetPassword, setMembroToResetPassword] = useState<MembroSSVP | null>(null);
  const [accessActionLoading, setAccessActionLoading] = useState(false);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const loadMembros = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchMembrosConferencia(conferencia.id, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
      });
      setMembros(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erro ao buscar membros:', err);
      setMembros([]);
      showNotification(err?.message || 'Falha ao buscar membros da conferência.', true);
    } finally {
      setLoading(false);
    }
  }, [conferencia.id, statusFilter, typeFilter]);

  const handleReconcile = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const result = await reconcileCentralMemberSubmissions(conferencia.id);
      showNotification(result?.message || 'Sincronização da conferência realizada com sucesso!');
      await loadMembros();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao sincronizar cadastros da conferência.', true);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadMembros();
  }, [loadMembros]);

  const stats = useMemo(() => {
    const list = Array.isArray(membros) ? membros : [];
    const total = list.length;
    const ativos = list.filter((m) => m.status === 'ativo').length;
    const confrades = list.filter((m) => m.type === 'confrade' && m.status === 'ativo').length;
    const consocias = list.filter((m) => m.type === 'consocia' && m.status === 'ativo').length;
    const aspirantesAuxiliares = list.filter(
      (m) => (m.type === 'aspirante' || m.type === 'auxiliar') && m.status === 'ativo'
    ).length;
    return { total, ativos, confrades, consocias, aspirantesAuxiliares };
  }, [membros]);

  const filteredMembros = useMemo(() => {
    const list = Array.isArray(membros) ? membros : [];
    return list.filter((m) => {
      const matchSearch =
        (m.fullName || '').toLowerCase().includes((search || '').toLowerCase()) ||
        (m.phone && m.phone.includes(search)) ||
        (m.cpf && m.cpf.includes(search)) ||
        (m.email && m.email.toLowerCase().includes((search || '').toLowerCase()));
      return matchSearch;
    });
  }, [membros, search]);

  const handleOpenCreate = () => {
    setEditingMembro(null);
    setFormData({
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (membro: MembroSSVP) => {
    setEditingMembro(membro);
    setFormData({
      fullName: membro.fullName,
      type: membro.type,
      gender: membro.gender || '',
      cpf: membro.cpf || '',
      profession: membro.profession || '',
      phone: membro.phone || '',
      phoneResidential: membro.phoneResidential || '',
      phoneCommercial: membro.phoneCommercial || '',
      email: membro.email || '',
      addressZip: membro.addressZip || '',
      addressStreet: membro.addressStreet || '',
      addressNumber: membro.addressNumber || '',
      addressComplement: membro.addressComplement || '',
      addressNeighborhood: membro.addressNeighborhood || '',
      addressCity: membro.addressCity || '',
      addressState: membro.addressState || '',
      birthDate: membro.birthDate || '',
      admissionDate: membro.admissionDate || '',
      acclamationDate: membro.acclamationDate || '',
      proclamationDate: membro.proclamationDate || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      showNotification('O nome do membro é obrigatório.', true);
      return;
    }

    if (!editingMembro && (!formData.birthDate || !formData.birthDate.trim())) {
      showNotification('Informe a data de nascimento. Ela é necessária para criar o acesso ao sistema.', true);
      return;
    }

    setActionLoading(true);
    try {
      if (editingMembro) {
        await updateMembroConferencia(conferencia.id, editingMembro.id, formData);
        showNotification('Cadastro do membro atualizado com sucesso!');
        if (selectedMembroDetalhes?.id === editingMembro.id) {
          setSelectedMembroDetalhes({
            ...editingMembro,
            ...formData,
          });
        }
      } else {
        await createMembroConferencia(conferencia.id, formData);
        showNotification('Membro cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      await loadMembros();
    } catch (err: any) {
      console.error('Erro ao salvar membro:', err);
      showNotification(err?.message || 'Falha ao salvar dados do membro.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmInactivate = async () => {
    if (!membroToInactivate) return;
    setActionLoading(true);
    try {
      await inactivateMembroConferencia(conferencia.id, membroToInactivate.id);
      showNotification(`Membro "${membroToInactivate.fullName}" inativado com sucesso!`);
      if (selectedMembroDetalhes?.id === membroToInactivate.id) {
        setSelectedMembroDetalhes(null);
      }
      setMembroToInactivate(null);
      await loadMembros();
    } catch (err: any) {
      console.error('Erro ao inativar membro:', err);
      showNotification(err?.message || 'Falha ao inativar membro.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccessAction = async (
    membro: MembroSSVP,
    action: 'generate' | 'reset-password' | 'block' | 'unblock'
  ) => {
    if (action === 'reset-password') {
      setMembroToResetPassword(membro);
      return;
    }

    setAccessActionLoading(true);
    try {
      const res = await performMemberAccessAction(conferencia.id, membro.id, action);
      if (res && res.data) {
        // Atualiza imediatamente a lista e a modal de detalhes
        setMembros((prev) => prev.map((m) => (m.id === membro.id ? { ...m, ...res.data } : m)));
        if (selectedMembroDetalhes?.id === membro.id) {
          setSelectedMembroDetalhes((prev) => (prev ? { ...prev, ...res.data } : null));
        }

        if (action === 'generate') {
          showNotification('Acesso ao sistema gerado com sucesso!');
        } else if (action === 'block') {
          showNotification('Acesso do membro bloqueado com sucesso.');
        } else if (action === 'unblock') {
          showNotification('Acesso do membro desbloqueado com sucesso.');
        }
      }
    } catch (err: any) {
      console.error('Erro na ação de acesso do membro:', err);
      showNotification(err?.message || 'Falha ao executar ação de acesso.', true);
      await loadMembros();
    } finally {
      setAccessActionLoading(false);
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!membroToResetPassword) return;

    if (!membroToResetPassword.birthDate) {
      showNotification(
        'Não é possível redefinir a senha para DDMM porque a data de nascimento não está cadastrada.',
        true
      );
      setMembroToResetPassword(null);
      return;
    }

    setAccessActionLoading(true);
    try {
      const res = await performMemberAccessAction(conferencia.id, membroToResetPassword.id, 'reset-password');
      if (res && res.data) {
        setMembros((prev) => prev.map((m) => (m.id === membroToResetPassword.id ? { ...m, ...res.data } : m)));
        if (selectedMembroDetalhes?.id === membroToResetPassword.id) {
          setSelectedMembroDetalhes((prev) => (prev ? { ...prev, ...res.data } : null));
        }
        showNotification('Senha do membro redefinida com sucesso para o padrão DDMM!');
      }
      setMembroToResetPassword(null);
    } catch (err: any) {
      console.error('Erro ao redefinir senha do membro:', err);
      showNotification(err?.message || 'Falha ao redefinir senha.', true);
    } finally {
      setAccessActionLoading(false);
    }
  };


  const getTypeBadge = (type: MembroSSVP['type']) => {
    switch (type) {
      case 'confrade':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <UserCheck className="w-3 h-3" />
            Confrade
          </span>
        );
      case 'consocia':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
            <UserCheck className="w-3 h-3" />
            Consócia
          </span>
        );
      case 'aspirante':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <UserPlus className="w-3 h-3" />
            Aspirante
          </span>
        );
      case 'afastado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
            <UserX className="w-3 h-3 text-slate-500" />
            Afastado
          </span>
        );
      case 'auxiliar':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <ShieldCheck className="w-3 h-3" />
            Auxiliar
          </span>
        );
      default:
        return null;
    }
  };

  const cardContent = (
    <div id="conferencia-membros-manager-container" className="space-y-6">
      {/* Notificações */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-2 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2 text-sm text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-700 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Indicadores / Estatísticas Rápidas dos Membros da Conferência */}
      <div id="stats-membros-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Membros Ativos</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.ativos}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confrades</p>
            <p className="text-2xl font-extrabold text-blue-700 mt-0.5">{stats.confrades}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consócias</p>
            <p className="text-2xl font-extrabold text-purple-700 mt-0.5">{stats.consocias}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aspirantes & Auxiliares</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-0.5">{stats.aspirantesAuxiliares}</p>
          </div>
        </div>
      </div>

      {/* Tabela / Lista de Membros no padrão visual de Famílias Assistidas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Barra Superior com Título da Conferência e Ações */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>Quadro Nominal da Conferência</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">{conferencia.name}</h3>
            <p className="text-xs text-slate-500 font-medium">
              {conferencia.meetingDay ? `Reuniões: ${conferencia.meetingDay}` : 'Reuniões regulares'}
              {conferencia.city ? ` • ${conferencia.city}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-reconcile-conferencia-membros"
              onClick={handleReconcile}
              disabled={actionLoading || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
              title="Sincroniza solicitações de cadastro desta conferência e recalcula contadores"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>

            <button
              id="btn-open-create-membro"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Membro</span>
            </button>

            {onClose && (
              <button
                id="btn-close-membros-modal"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 sm:p-5 bg-slate-50/30 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-membros"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              id="select-type-filter-membro"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as classificações</option>
              <option value="confrade">Confrades</option>
              <option value="consocia">Consócias</option>
              <option value="aspirante">Aspirantes</option>
              <option value="auxiliar">Auxiliares</option>
              <option value="afastado">Afastados</option>
            </select>

            <select
              id="select-status-filter-membro"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
        </div>

        {/* Tabela de Membros */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
              <p className="text-xs font-semibold">Carregando quadro de membros...</p>
            </div>
          ) : filteredMembros.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {search
                  ? 'Nenhum membro encontrado para os filtros aplicados.'
                  : 'Nenhum membro cadastrado nesta Conferência.'}
              </p>
              {!search && (
                <button
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar 1º Membro</span>
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                  <th className="py-3.5 px-4">Nome do Membro</th>
                  <th className="py-3.5 px-4">Classificação</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Contatos</th>
                  <th className="py-3.5 px-4">Ingresso / Histórico</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembros.map((membro) => (
                  <tr
                    key={membro.id}
                    id={`membro-row-${membro.id}`}
                    className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedMembroDetalhes(membro)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                          {membro.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm group-hover:text-emerald-800 transition-colors flex items-center gap-2">
                            <span>{membro.fullName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {membro.cpf ? `CPF: ${membro.cpf}` : membro.profession ? membro.profession : 'Vicentino(a)'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getTypeBadge(membro.type)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          membro.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {membro.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 text-[11px] text-slate-600">
                        {membro.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{membro.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sem telefone</span>
                        )}
                        {membro.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{membro.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        {membro.admissionDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Ingresso: {membro.admissionDate}</span>
                          </div>
                        ) : membro.birthDate ? (
                          <div className="text-slate-500">Nasc: {membro.birthDate}</div>
                        ) : (
                          <span className="text-slate-400 italic">Histórico s/ data</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          id={`btn-view-ficha-${membro.id}`}
                          onClick={() => setSelectedMembroDetalhes(membro)}
                          title="Visualizar Ficha Completa"
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-edit-membro-${membro.id}`}
                          onClick={() => handleOpenEdit(membro)}
                          title="Editar Cadastro"
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {membro.status === 'ativo' && (
                          <button
                            id={`btn-inactivate-membro-${membro.id}`}
                            onClick={() => setMembroToInactivate(membro)}
                            title="Inativar Membro"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé da Tabela */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Total listado: <strong>{filteredMembros.length}</strong> membro(s) nesta conferência
          </div>
          {onClose && (
            <button
              id="btn-close-membros-footer"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: FICHA COMPLETA DO MEMBRO */}
      {/* ========================================================================= */}
      {selectedMembroDetalhes && (
        <div
          id="modal-ficha-membro-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedMembroDetalhes(null)}
        >
          <div
            id="modal-ficha-membro-card"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho da Ficha */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-lg flex items-center justify-center shrink-0">
                  {selectedMembroDetalhes.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-emerald-100 border border-white/20 uppercase tracking-wider">
                      Ficha do Membro Vicentino
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedMembroDetalhes.status === 'ativo'
                          ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                          : 'bg-slate-500/30 text-slate-300 border border-slate-400/20'
                      }`}
                    >
                      {selectedMembroDetalhes.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{selectedMembroDetalhes.fullName}</h3>
                  <p className="text-xs text-emerald-200/80">{conferencia.name}</p>
                </div>
              </div>

              <button
                id="btn-close-ficha-membro"
                onClick={() => setSelectedMembroDetalhes(null)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo da Ficha */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Bloco 1: Classificação e Identificação */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <span>Identificação & Classificação Vicentina</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-slate-500 font-medium">Classificação:</span>
                    <div className="mt-1">{getTypeBadge(selectedMembroDetalhes.type)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">CPF:</span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {selectedMembroDetalhes.cpf || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Sexo / Gênero:</span>
                    <p className="text-slate-900 font-semibold mt-0.5 capitalize">
                      {selectedMembroDetalhes.gender || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Profissão:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.profession || 'Não informada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Contatos */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-700" />
                  <span>Contatos & Comunicação</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-slate-500 font-medium">Celular / WhatsApp:</span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {selectedMembroDetalhes.phone || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">E-mail:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.email || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Telefone Residencial:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.phoneResidential || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Telefone Comercial:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.phoneCommercial || 'Não informado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloco 3: Endereço */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>Endereço Residencial</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 font-medium">Logradouro / Número / Complemento:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.addressStreet
                        ? `${selectedMembroDetalhes.addressStreet}, ${selectedMembroDetalhes.addressNumber || 's/n'}${
                            selectedMembroDetalhes.addressComplement ? ` (${selectedMembroDetalhes.addressComplement})` : ''
                          }`
                        : 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Bairro / Cidade / UF:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.addressCity || selectedMembroDetalhes.addressNeighborhood
                        ? `${selectedMembroDetalhes.addressNeighborhood || ''} • ${
                            selectedMembroDetalhes.addressCity || ''
                          }/${selectedMembroDetalhes.addressState || ''}`
                        : 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">CEP:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">
                      {selectedMembroDetalhes.addressZip || 'Não informado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloco 4: Datas e Histórico */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span>Histórico Vicentino & Datas Registradas</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Nascimento</span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {selectedMembroDetalhes.birthDate || '—'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Ingresso</span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {selectedMembroDetalhes.admissionDate || '—'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Aclamação</span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {selectedMembroDetalhes.acclamationDate || '—'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Proclamação</span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {selectedMembroDetalhes.proclamationDate || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloco 5: Acesso ao Sistema */}
              <div id="ficha-membro-acesso-section" className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200/70 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100/80 pb-2">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-700" />
                    <span>Acesso ao Sistema</span>
                  </h4>

                  {/* Badge de Situação */}
                  <div>
                    {(() => {
                      const isPending =
                        !selectedMembroDetalhes.birthDate ||
                        selectedMembroDetalhes.accessStatus?.includes('pendente');
                      const isError =
                        selectedMembroDetalhes.accessStatus === 'Erro na criação do acesso';
                      const isActive =
                        selectedMembroDetalhes.status === 'ativo' &&
                        selectedMembroDetalhes.hasAccess &&
                        selectedMembroDetalhes.accessStatus === 'Acesso ativo';

                      if (isError) {
                        return (
                          <span
                            id="badge-membro-access-error"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Erro na criação do acesso</span>
                          </span>
                        );
                      }

                      if (isPending) {
                        return (
                          <span
                            id="badge-membro-access-pending"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Acesso pendente — informe a data de nascimento</span>
                          </span>
                        );
                      }

                      if (isActive) {
                        return (
                          <span
                            id="badge-membro-access-active"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Acesso ativo</span>
                          </span>
                        );
                      }

                      return (
                        <span
                          id="badge-membro-access-inactive"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300"
                        >
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{selectedMembroDetalhes.accessStatus || 'Acesso inativo'}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Grid de Informações de Acesso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-slate-500 text-[11px] font-medium block">Login no sistema:</span>
                    <p
                      id="text-membro-username"
                      className="text-slate-900 font-mono font-bold text-sm mt-0.5 select-all"
                    >
                      {selectedMembroDetalhes.username || (
                        <span className="text-slate-400 font-sans text-xs italic font-normal">
                          Sem acesso criado
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-slate-500 text-[11px] font-medium block">Senha padrão:</span>
                    <p className="text-slate-800 font-semibold text-xs mt-0.5">
                      dia e mês do nascimento (DDMM)
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      A senha real não é exibida por segurança.
                    </span>
                  </div>
                </div>

                {/* Mensagem amigável de erro se houver */}
                {selectedMembroDetalhes.accessStatus === 'Erro na criação do acesso' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Houve uma falha técnica ao tentar criar o acesso do membro.</p>
                      <p className="mt-0.5 text-[11px]">
                        Os dados cadastrais do membro estão seguros. Você pode tentar criar o acesso novamente pelo botão abaixo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Botões de Ação de Acesso */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  {/* Botão de Recuperação: Somente em caso de Erro na criação do acesso */}
                  {selectedMembroDetalhes.status === 'ativo' &&
                    selectedMembroDetalhes.accessStatus === 'Erro na criação do acesso' && (
                      <button
                        id="btn-access-retry"
                        onClick={() => handleAccessAction(selectedMembroDetalhes, 'generate')}
                        disabled={accessActionLoading || !selectedMembroDetalhes.birthDate}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                        title={
                          !selectedMembroDetalhes.birthDate
                            ? 'Cadastre a data de nascimento para gerar o acesso'
                            : ''
                        }
                      >
                        {accessActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>Tentar criar acesso novamente</span>
                      </button>
                    )}

                  {/* Botão: Redefinir senha para DDMM */}
                  {selectedMembroDetalhes.status === 'ativo' &&
                    selectedMembroDetalhes.userId &&
                    selectedMembroDetalhes.accessStatus !== 'Erro na criação do acesso' && (
                      <button
                        id="btn-access-reset-password"
                        onClick={() => handleAccessAction(selectedMembroDetalhes, 'reset-password')}
                        disabled={accessActionLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-700" />
                        <span>Redefinir senha para DDMM</span>
                      </button>
                    )}

                  {/* Botão: Bloquear / Desbloquear Acesso */}
                  {selectedMembroDetalhes.userId &&
                    selectedMembroDetalhes.accessStatus !== 'Erro na criação do acesso' && (
                      <>
                        {selectedMembroDetalhes.hasAccess ? (
                          <button
                            id="btn-access-block"
                            onClick={() => handleAccessAction(selectedMembroDetalhes, 'block')}
                            disabled={accessActionLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            {accessActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Lock className="w-3.5 h-3.5" />
                            )}
                            <span>Bloquear acesso</span>
                          </button>
                        ) : (
                          <button
                            id="btn-access-unblock"
                            onClick={() => handleAccessAction(selectedMembroDetalhes, 'unblock')}
                            disabled={accessActionLoading || selectedMembroDetalhes.status !== 'ativo'}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
                            title={
                              selectedMembroDetalhes.status !== 'ativo'
                                ? 'Um membro inativo não pode ter seu acesso desbloqueado'
                                : ''
                            }
                          >
                            {accessActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            )}
                            <span>Desbloquear acesso</span>
                          </button>
                        )}
                      </>
                    )}
                </div>
              </div>
            </div>


            {/* Rodapé da Ficha com Ações */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedMembroDetalhes.status === 'ativo' && (
                  <button
                    id="btn-ficha-inactivate"
                    onClick={() => setMembroToInactivate(selectedMembroDetalhes)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>Inativar Membro</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-ficha-close"
                  onClick={() => setSelectedMembroDetalhes(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  id="btn-ficha-edit"
                  onClick={() => {
                    handleOpenEdit(selectedMembroDetalhes);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar Dados</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: CADASTRO / EDIÇÃO DE MEMBRO */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div id="submodal-membro-backdrop" className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="submodal-membro-card" className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingMembro ? 'Editar Membro' : 'Novo Membro da Conferência'}
                </h3>
              </div>
              <button
                id="btn-close-submodal-membro"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMembro} className="p-5 space-y-4 overflow-y-auto flex-1">
              <p className="text-xs text-rose-600 font-medium">* Campos obrigatórios</p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-membro-fullname"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Ex: João da Silva Sauro"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Sexo, CPF, Profissão e Classificação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sexo / Gênero (Opcional)</label>
                  <select
                    id="select-membro-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="">Não especificado</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CPF (Opcional)</label>
                  <input
                    id="input-membro-cpf"
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Profissão (Opcional)</label>
                  <input
                    id="input-membro-profession"
                    type="text"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    placeholder="Ex: Professor, Autônomo"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Classificação / Tipo de Membro *
                </label>
                <select
                  id="select-membro-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-medium"
                >
                  <option value="confrade">Confrade (Membro Vicentino Ativo)</option>
                  <option value="consocia">Consócia (Membro Vicentino Ativo)</option>
                  <option value="aspirante">Aspirante (Em Formação Vicentina)</option>
                  <option value="afastado">Afastado (Membro Vicentino Afastado)</option>
                  <option value="auxiliar">Auxiliar (Colaborador / Benfeitor)</option>
                </select>
              </div>

              {/* Contatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone Celular / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-membro-phone"
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    id="input-membro-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Telefones Secundários */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Residencial (Opcional)</label>
                  <input
                    id="input-membro-phone-res"
                    type="text"
                    value={formData.phoneResidential}
                    onChange={(e) => setFormData({ ...formData, phoneResidential: e.target.value })}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Comercial (Opcional)</label>
                  <input
                    id="input-membro-phone-com"
                    type="text"
                    value={formData.phoneCommercial}
                    onChange={(e) => setFormData({ ...formData, phoneCommercial: e.target.value })}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Endereço Residencial (Opcional) */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Endereço Residencial (Opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">CEP</label>
                    <input
                      id="input-membro-zip"
                      type="text"
                      value={formData.addressZip}
                      onChange={(e) => setFormData({ ...formData, addressZip: e.target.value })}
                      placeholder="00000-000"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Logradouro / Rua</label>
                    <input
                      id="input-membro-street"
                      type="text"
                      value={formData.addressStreet}
                      onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                      placeholder="Rua, Avenida..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Número</label>
                    <input
                      id="input-membro-number"
                      type="text"
                      value={formData.addressNumber}
                      onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                      placeholder="123"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Complemento</label>
                    <input
                      id="input-membro-complement"
                      type="text"
                      value={formData.addressComplement}
                      onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
                      placeholder="Apto, Bloco..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Bairro</label>
                    <input
                      id="input-membro-neighborhood"
                      type="text"
                      value={formData.addressNeighborhood}
                      onChange={(e) => setFormData({ ...formData, addressNeighborhood: e.target.value })}
                      placeholder="Bairro"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Cidade</label>
                    <input
                      id="input-membro-city"
                      type="text"
                      value={formData.addressCity}
                      onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                      placeholder="Cidade"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Estado (UF)</label>
                    <input
                      id="input-membro-state"
                      type="text"
                      value={formData.addressState}
                      onChange={(e) => setFormData({ ...formData, addressState: e.target.value.toUpperCase().substring(0, 2) })}
                      placeholder="UF"
                      maxLength={2}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Datas de Cadastro e Histórico Vicentino */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Datas de Cadastro e Histórico Vicentino
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <DateInputWithPicker
                      id="input-membro-birthdate"
                      label="Data de Nascimento"
                      value={formData.birthDate}
                      onChange={(val) => setFormData({ ...formData, birthDate: val })}
                      required={!editingMembro}
                      allowFutureDates={false}
                      helpText={
                        editingMembro
                          ? 'Informe a data para criar ou atualizar o acesso ao sistema.'
                          : 'Obrigatória para criar o acesso do membro ao sistema.'
                      }
                    />
                  </div>
                  <div>
                    <DateInputWithPicker
                      id="input-membro-admissiondate"
                      label="Data de Ingresso na SSVP"
                      value={formData.admissionDate}
                      onChange={(val) => setFormData({ ...formData, admissionDate: val })}
                      allowFutureDates={false}
                    />
                  </div>
                  <div>
                    <DateInputWithPicker
                      id="input-membro-acclamationdate"
                      label="Data de Aclamação"
                      value={formData.acclamationDate}
                      onChange={(val) => setFormData({ ...formData, acclamationDate: val })}
                      allowFutureDates={false}
                    />
                  </div>
                  <div>
                    <DateInputWithPicker
                      id="input-membro-proclamationdate"
                      label="Data de Proclamação"
                      value={formData.proclamationDate}
                      onChange={(val) => setFormData({ ...formData, proclamationDate: val })}
                      allowFutureDates={false}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  id="btn-cancel-membro-form"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-submit-membro-form"
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingMembro ? 'Salvar Alterações' : 'Cadastrar Membro'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: INATIVAÇÃO DE MEMBRO */}
      {/* ========================================================================= */}
      {membroToInactivate && (
        <div id="modal-inactivate-membro-backdrop" className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-inactivate-membro-card" className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <PowerOff className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Inativar Membro</h3>
            </div>

            <p className="text-sm text-slate-600">
              Tem certeza que deseja inativar o membro <strong>{membroToInactivate.fullName}</strong>?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              O histórico do membro será preservado e ele não será excluído do banco de dados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-inactivate-membro"
                onClick={() => setMembroToInactivate(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-inactivate-membro"
                onClick={handleConfirmInactivate}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirmar Inativação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: CONFIRMAÇÃO DE REDEFINIÇÃO DE SENHA PARA DDMM */}
      {/* ========================================================================= */}
      {membroToResetPassword && (
        <div id="modal-reset-password-backdrop" className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div id="modal-reset-password-card" className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <Key className="w-6 h-6 text-amber-700" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Redefinir Senha de Acesso</h3>
            </div>

            <p className="text-sm text-slate-600">
              Deseja redefinir a senha do membro <strong>{membroToResetPassword.fullName}</strong> para o padrão <strong>DDMM</strong> (dia e mês do nascimento)?
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <p className="font-semibold">Login: <span className="font-mono font-bold">{membroToResetPassword.username || '—'}</span></p>
              <p className="text-[11px] text-amber-800">
                O membro poderá acessar imediatamente utilizando o dia e mês do seu nascimento com 4 dígitos.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-reset-password"
                onClick={() => setMembroToResetPassword(null)}
                disabled={accessActionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-reset-password"
                onClick={handleConfirmResetPassword}
                disabled={accessActionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {accessActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirmar Redefinição</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  if (inline) {
    return cardContent;
  }

  return (
    <div id="modal-conferencia-membros-backdrop" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        {cardContent}
      </div>
    </div>
  );
};

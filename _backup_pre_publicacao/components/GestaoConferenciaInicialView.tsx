import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Building2, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Users, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Pencil,
  Search,
  ChevronRight,
  X,
  Save,
  BookOpen,
  ReceiptText,
  UserCheck,
  User,
  Sparkles,
  Info
} from 'lucide-react';
import { apiFetch, getAuthHeaders } from '../lib/api';
import { MembroSSVP } from '../types';

interface GestaoConferenciaInicialViewProps {
  conferenciaId: string;
  conferenciaNome: string;
  roleTitle?: string;
  onBack: () => void;
}

interface DiretoriaMemberData {
  membroId?: string;
  name?: string;
  phone?: string;
}

interface ConferenciaGestaoData {
  id: string;
  name: string;
  code?: string;
  status: 'ativo' | 'inativo';
  foundationDate?: string;
  aggregationDate?: string;
  meetingDay?: string;
  meetingTime?: string;
  location?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  phone?: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  particularId?: string;
  centralId?: string;
  diretoria?: {
    presidente?: DiretoriaMemberData | string;
    vicePresidente?: DiretoriaMemberData | string;
    secretario?: DiretoriaMemberData | string;
    segundoSecretario?: DiretoriaMemberData | string;
    tesoureiro?: DiretoriaMemberData | string;
    segundoTesoureiro?: DiretoriaMemberData | string;
  };
}

type TabType = 'conferencia' | 'livro_caixa' | 'mapa_financeiro';

const CARGOS_CONFIG = [
  { key: 'presidente', label: 'Presidente' },
  { key: 'vicePresidente', label: 'Vice-Presidente' },
  { key: 'secretario', label: 'Secretário(a)' },
  { key: 'segundoSecretario', label: 'Segundo(a) Secretário(a)' },
  { key: 'tesoureiro', label: 'Tesoureiro(a)' },
  { key: 'segundoTesoureiro', label: 'Segundo(a) Tesoureiro(a)' },
] as const;

export const GestaoConferenciaInicialView: React.FC<GestaoConferenciaInicialViewProps> = ({
  conferenciaId,
  conferenciaNome,
  roleTitle,
  onBack,
}) => {
  // Aba ativa
  const [activeTab, setActiveTab] = useState<TabType>('conferencia');

  // Estados principais de dados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConferenciaGestaoData | null>(null);
  const [particularNome, setParticularNome] = useState<string>('');
  const [centralNome, setCentralNome] = useState<string>('Conselho Central de Jaboticabal');
  
  // Lista de membros da conferência
  const [membros, setMembros] = useState<MembroSSVP[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Visualização e Edição
  const [isViewingConfModal, setIsViewingConfModal] = useState(false);
  const [isEditingConf, setIsEditingConf] = useState(false);
  const [savingConf, setSavingConf] = useState(false);
  const [confFormData, setConfFormData] = useState<Partial<ConferenciaGestaoData>>({});

  const [isViewingDiretoriaModal, setIsViewingDiretoriaModal] = useState(false);
  const [isEditingDiretoria, setIsEditingDiretoria] = useState(false);
  const [savingDiretoria, setSavingDiretoria] = useState(false);
  const [diretoriaFormData, setDiretoriaFormData] = useState<Record<string, string>>({});

  const [selectedMemberForView, setSelectedMemberForView] = useState<MembroSSVP | null>(null);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [memberFormData, setMemberFormData] = useState<Partial<MembroSSVP>>({});

  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Carregar dados estruturais da conferência
  const fetchGestaoData = useCallback(async () => {
    if (!conferenciaId) {
      setError('Identificador da Conferência não informado.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/conferencias/${conferenciaId}/gestao-inicial`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Acesso restrito à diretoria desta Conferência.');
      }

      const json = await res.json();
      setData(json.conferencia);
      if (json.particularNome) setParticularNome(json.particularNome);
      if (json.centralNome) setCentralNome(json.centralNome);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados de gestão da Conferência.');
    } finally {
      setLoading(false);
    }
  }, [conferenciaId]);

  // Carregar membros da conferência
  const fetchMembros = useCallback(async () => {
    if (!conferenciaId) return;
    try {
      setLoadingMembros(true);
      const res = await apiFetch(`/api/conferencias/${conferenciaId}/membros`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json) ? json : json.items || [];
        setMembros(items);
      }
    } catch (err) {
      console.error('Erro ao buscar membros da conferência:', err);
    } finally {
      setLoadingMembros(false);
    }
  }, [conferenciaId]);

  useEffect(() => {
    fetchGestaoData();
    fetchMembros();
  }, [fetchGestaoData, fetchMembros]);

  // Auxiliares de formatação
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não informada';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const getFullAddress = (conf?: ConferenciaGestaoData | null) => {
    if (!conf) return 'Endereço da sede não informado';
    if (conf.fullAddress && conf.fullAddress.trim()) return conf.fullAddress;
    const parts: string[] = [];
    if (conf.addressStreet) {
      let street = conf.addressStreet;
      if (conf.addressNumber) street += `, ${conf.addressNumber}`;
      if (conf.addressComplement) street += ` (${conf.addressComplement})`;
      parts.push(street);
    }
    if (conf.addressNeighborhood) parts.push(conf.addressNeighborhood);
    if (conf.addressCity) parts.push(`${conf.addressCity}${conf.addressState ? ` - ${conf.addressState}` : ''}`);
    if (conf.addressZip) parts.push(`CEP ${conf.addressZip}`);
    return parts.length > 0 ? parts.join(', ') : 'Endereço da sede não informado';
  };

  // Mapa de cargos na diretoria para exibição rápida nos membros
  const cargosPorMembroId = useMemo(() => {
    const map: Record<string, string> = {};
    if (!data?.diretoria) return map;

    for (const item of CARGOS_CONFIG) {
      const cargo = (data.diretoria as any)[item.key];
      if (typeof cargo === 'object' && cargo?.membroId) {
        map[cargo.membroId] = item.label;
      } else if (typeof cargo === 'string' && cargo) {
        map[cargo] = item.label;
      }
    }
    return map;
  }, [data?.diretoria]);

  // Membros filtrados por busca
  const filteredMembros = useMemo(() => {
    if (!searchTerm.trim()) return membros;
    const term = searchTerm.toLowerCase();
    return membros.filter(m => 
      m.fullName?.toLowerCase().includes(term) ||
      m.type?.toLowerCase().includes(term) ||
      (cargosPorMembroId[m.id] && cargosPorMembroId[m.id].toLowerCase().includes(term))
    );
  }, [membros, searchTerm, cargosPorMembroId]);

  // Helper para obter dados de um cargo
  const getCargoDisplay = (cargoKey: string) => {
    const raw = (data?.diretoria as any)?.[cargoKey];
    if (!raw) return { name: 'Não informado / Vago', phone: '', membroId: '' };
    if (typeof raw === 'object') {
      const membro = raw.membroId ? membros.find(m => m.id === raw.membroId) : null;
      return {
        name: raw.name || membro?.fullName || 'Não informado / Vago',
        phone: raw.phone || membro?.phone || '',
        membroId: raw.membroId || ''
      };
    }
    if (typeof raw === 'string') {
      const membro = membros.find(m => m.id === raw);
      return {
        name: membro?.fullName || 'Não informado / Vago',
        phone: membro?.phone || '',
        membroId: raw
      };
    }
    return { name: 'Não informado / Vago', phone: '', membroId: '' };
  };

  // Contagem de cargos preenchidos
  const totalCargosCadastrados = useMemo(() => {
    let count = 0;
    for (const item of CARGOS_CONFIG) {
      const d = getCargoDisplay(item.key);
      if (d.membroId || (d.name && d.name !== 'Não informado / Vago')) {
        count++;
      }
    }
    return count;
  }, [data?.diretoria, membros]);

  // Abertura do modal de visualização da conferência
  const handleOpenConfModal = () => {
    if (!data) return;
    setConfFormData({
      meetingDay: data.meetingDay || '',
      meetingTime: data.meetingTime || '',
      location: data.location || '',
      addressStreet: data.addressStreet || '',
      addressNumber: data.addressNumber || '',
      addressComplement: data.addressComplement || '',
      addressNeighborhood: data.addressNeighborhood || '',
      addressCity: data.addressCity || '',
      addressState: data.addressState || 'SP',
      addressZip: data.addressZip || '',
      phone: data.phone || '',
      email: data.email || '',
      notes: data.notes || '',
    });
    setIsEditingConf(false);
    setIsViewingConfModal(true);
  };

  // Salvar edição dos dados da conferência
  const handleSaveConfData = async () => {
    if (!data || !data.particularId) {
      showFeedback('Conselho Particular não identificado para atualizar.', 'error');
      return;
    }
    try {
      setSavingConf(true);
      const res = await apiFetch(`/api/conselhos-particulares/${data.particularId}/conferencias/${data.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...confFormData,
          name: data.name
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar dados da Conferência.');
      }

      await fetchGestaoData();
      showFeedback('Dados da Conferência atualizados com sucesso!', 'success');
      setIsEditingConf(false);
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao salvar alterações da Conferência.', 'error');
    } finally {
      setSavingConf(false);
    }
  };

  // Abertura do modal da diretoria
  const handleOpenDiretoriaModal = () => {
    const initialForm: Record<string, string> = {};
    for (const item of CARGOS_CONFIG) {
      const disp = getCargoDisplay(item.key);
      initialForm[item.key] = disp.membroId || '';
    }
    setDiretoriaFormData(initialForm);
    setIsEditingDiretoria(false);
    setIsViewingDiretoriaModal(true);
  };

  // Salvar composição da diretoria
  const handleSaveDiretoria = async () => {
    if (!data || !data.particularId) {
      showFeedback('Conselho Particular não identificado para atualizar diretoria.', 'error');
      return;
    }

    try {
      setSavingDiretoria(true);
      const updatedDiretoriaPayload: Record<string, any> = {};

      for (const item of CARGOS_CONFIG) {
        const selectedMembroId = diretoriaFormData[item.key];
        if (selectedMembroId) {
          const membroObj = membros.find(m => m.id === selectedMembroId);
          updatedDiretoriaPayload[item.key] = {
            membroId: selectedMembroId,
            name: membroObj?.fullName || '',
            phone: membroObj?.phone || ''
          };
        } else {
          updatedDiretoriaPayload[item.key] = null;
        }
      }

      const res = await apiFetch(`/api/conselhos-particulares/${data.particularId}/conferencias/${data.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: data.name,
          ...updatedDiretoriaPayload
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar composição da diretoria.');
      }

      await fetchGestaoData();
      showFeedback('Diretoria atualizada com sucesso!', 'success');
      setIsEditingDiretoria(false);
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao atualizar diretoria.', 'error');
    } finally {
      setSavingDiretoria(false);
    }
  };

  // Abertura da visualização de um membro
  const handleOpenMemberView = (membro: MembroSSVP) => {
    setSelectedMemberForView(membro);
    setMemberFormData({
      fullName: membro.fullName || '',
      type: membro.type || 'confrade',
      gender: membro.gender || '',
      birthDate: membro.birthDate || '',
      cpf: membro.cpf || '',
      profession: membro.profession || '',
      phone: membro.phone || '',
      phoneResidential: membro.phoneResidential || '',
      email: membro.email || '',
      addressStreet: membro.addressStreet || '',
      addressNumber: membro.addressNumber || '',
      addressComplement: membro.addressComplement || '',
      addressNeighborhood: membro.addressNeighborhood || '',
      addressCity: membro.addressCity || '',
      addressState: membro.addressState || 'SP',
      addressZip: membro.addressZip || '',
      admissionDate: membro.admissionDate || '',
      proclamationDate: membro.proclamationDate || '',
      status: membro.status || 'ativo'
    });
    setIsEditingMember(false);
  };

  // Salvar edição do membro
  const handleSaveMemberData = async () => {
    if (!selectedMemberForView || !conferenciaId) return;

    try {
      setSavingMember(true);
      const res = await apiFetch(`/api/conferencias/${conferenciaId}/membros/${selectedMemberForView.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(memberFormData)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar dados do membro.');
      }

      const updated = await res.json();
      setSelectedMemberForView(updated);
      await fetchMembros();
      showFeedback('Dados do membro atualizados com sucesso!', 'success');
      setIsEditingMember(false);
    } catch (err: any) {
      showFeedback(err.message || 'Erro ao atualizar membro.', 'error');
    } finally {
      setSavingMember(false);
    }
  };

  const getClassificationLabel = (type?: string) => {
    switch (type) {
      case 'confrade': return 'Confrade';
      case 'consocia': return 'Consócia';
      case 'aspirante': return 'Aspirante';
      case 'auxiliar': return 'Membro Auxiliar';
      case 'afastado': return 'Afastado';
      default: return 'Vicentino(a)';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800 pb-28">
      {/* Toast de Feedback */}
      {feedbackMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${
            feedbackMessage.type === 'success' 
              ? 'bg-emerald-800 text-white border-emerald-600' 
              : 'bg-rose-800 text-white border-rose-600'
          }`}>
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
            )}
            <p className="flex-1 leading-snug">{feedbackMessage.text}</p>
            <button onClick={() => setFeedbackMessage(null)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cabeçalho Azul Oficial */}
      <header className="bg-[#0b4d8c] text-white px-5 pt-7 pb-4 rounded-b-[28px] shadow-md sticky top-0 z-30">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full border border-white/25 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Início
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-200 bg-emerald-900/40 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              {roleTitle || 'Diretoria'}
            </span>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
              Gestão da Conferência
            </h1>
            <p className="text-sm font-medium text-blue-100/90 truncate mt-0.5">
              {data?.name || conferenciaNome}
            </p>
          </div>
        </div>
      </header>

      {/* Barra Superior de Abas (Top Navigation) */}
      <div className="bg-white border-b border-slate-200 sticky top-[108px] z-20 shadow-xs">
        <div className="max-w-md mx-auto grid grid-cols-3">
          <button
            onClick={() => setActiveTab('conferencia')}
            className={`py-3 text-xs sm:text-sm font-bold flex flex-col items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'conferencia'
                ? 'border-[#0b4d8c] text-[#0b4d8c] bg-blue-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4 mb-0.5" />
            <span>Conferência</span>
          </button>

          <button
            onClick={() => setActiveTab('livro_caixa')}
            className={`py-3 text-xs sm:text-sm font-bold flex flex-col items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'livro_caixa'
                ? 'border-[#0b4d8c] text-[#0b4d8c] bg-blue-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span>Livro Caixa</span>
          </button>

          <button
            onClick={() => setActiveTab('mapa_financeiro')}
            className={`py-3 text-xs sm:text-sm font-bold flex flex-col items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'mapa_financeiro'
                ? 'border-[#0b4d8c] text-[#0b4d8c] bg-blue-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ReceiptText className="w-4 h-4 mb-0.5" />
            <span className="truncate px-1">Mapa Financeiro</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal por Aba */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-[#0b4d8c] rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Carregando dados da Conferência...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-3xl p-6 border border-rose-200 shadow-sm space-y-4">
            <div className="flex items-start gap-3 text-rose-700">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold">Acesso Restrito à Gestão</h3>
                <p className="text-xs text-rose-600 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => fetchGestaoData()}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-3 px-4 rounded-2xl transition-all cursor-pointer"
              >
                Tentar novamente
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-[#0b4d8c] hover:bg-[#093d70] text-white text-xs font-bold py-3 px-4 rounded-2xl transition-all cursor-pointer"
              >
                Retornar ao início
              </button>
            </div>
          </div>
        )}

        {/* ABA 1: CONFERÊNCIA (PRINCIPAL) */}
        {!loading && !error && activeTab === 'conferencia' && (
          <>
            {/* CARD 1: DADOS DA CONFERÊNCIA */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start gap-3.5">
                {/* Ícone estilizado da Igreja/Sede Vicentina */}
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0b4d8c] shrink-0 shadow-xs">
                  <div className="relative">
                    <Building2 className="w-8 h-8" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                    Dados da Conferência
                  </h2>
                  <div className="text-xs text-slate-600 mt-1 space-y-1">
                    <p className="leading-tight">
                      <strong className="text-slate-800">Reunião:</strong> {data?.meetingDay || 'A combinar'}
                      {data?.meetingTime ? `, ${data.meetingTime}` : ''}
                    </p>
                    <p className="leading-tight">
                      <strong className="text-slate-800">Local:</strong> {data?.location || 'Salão da Conferência'}
                    </p>
                    <p className="leading-tight truncate">
                      <strong className="text-slate-800">Endereço:</strong> {getFullAddress(data)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botão de Visualização Separado (Regra Estrita da Solicitação) */}
              <button
                onClick={handleOpenConfModal}
                className="w-full py-3 px-4 rounded-2xl border-2 border-[#0b4d8c] text-[#0b4d8c] hover:bg-blue-50 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Eye className="w-4 h-4" />
                Visualizar dados
              </button>
            </div>

            {/* CARD 2: DIRETORIA */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-slate-900 leading-tight">
                      Diretoria
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {totalCargosCadastrados > 0 ? `${totalCargosCadastrados} de 6 cargos preenchidos` : '6 cargos cadastrados'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleOpenDiretoriaModal}
                  className="text-xs sm:text-sm font-bold text-[#0b4d8c] hover:text-blue-900 inline-flex items-center gap-1 shrink-0 py-2 px-3 rounded-xl hover:bg-blue-50 transition-all cursor-pointer"
                >
                  Ver diretoria
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CARD 3: MEMBROS DA CONFERÊNCIA */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 text-slate-900">
                  <Users className="w-5 h-5 text-[#0b4d8c]" />
                  <h2 className="text-base font-black">
                    Membros da Conferência
                  </h2>
                </div>
                <span className="text-xs font-bold text-[#0b4d8c] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
                </span>
              </div>

              {/* Campo de Busca de Membros */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar membro..."
                  className="w-full pl-9.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lista de Membros */}
              <div className="space-y-2 pt-1">
                {loadingMembros ? (
                  <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                    <div className="w-6 h-6 border-2 border-blue-200 border-t-[#0b4d8c] rounded-full animate-spin mx-auto"></div>
                    <p>Carregando membros cadastrados...</p>
                  </div>
                ) : filteredMembros.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
                    {searchTerm ? 'Nenhum membro encontrado com este termo.' : 'Nenhum membro ativo cadastrado nesta Conferência.'}
                  </div>
                ) : (
                  filteredMembros.map((membro) => {
                    const cargoLabel = cargosPorMembroId[membro.id];
                    const classificacao = getClassificationLabel(membro.type);
                    const subLabel = cargoLabel ? `${cargoLabel} • ${classificacao}` : classificacao;

                    return (
                      <button
                        key={membro.id}
                        onClick={() => handleOpenMemberView(membro)}
                        className="w-full p-3 bg-slate-50/80 hover:bg-blue-50/60 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar com identificação de gênero/tipo */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border font-bold text-xs ${
                            membro.type === 'consocia' 
                              ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800'
                              : membro.type === 'aspirante'
                              ? 'bg-amber-100/70 border-amber-300 text-amber-800'
                              : 'bg-blue-100/70 border-blue-300 text-[#0b4d8c]'
                          }`}>
                            <User className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0b4d8c] truncate">
                              {membro.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                              {subLabel}
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0b4d8c] shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>

              <p className="text-[10px] text-center text-slate-400 pt-1 font-medium">
                Toque no membro para visualizar ou editar
              </p>
            </div>
          </>
        )}

        {/* ABA 2: LIVRO CAIXA (PRÓXIMA ETAPA) */}
        {!loading && !error && activeTab === 'livro_caixa' && (
          <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 text-[#0b4d8c] flex items-center justify-center mx-auto shadow-xs">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Próxima Etapa
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-2">
                Livro Caixa da Conferência
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs mx-auto">
                O registro oficial de receitas, despesas, coletas e saldo do livro caixa será integrado nesta aba no próximo ciclo.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('conferencia')}
              className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Voltar para Conferência
            </button>
          </div>
        )}

        {/* ABA 3: MAPA FINANCEIRO (PRÓXIMA ETAPA) */}
        {!loading && !error && activeTab === 'mapa_financeiro' && (
          <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <ReceiptText className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Próxima Etapa
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-2">
                Mapa Financeiro da Conferência
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-xs mx-auto">
                Demonstrativo financeiro, balancete mensal e prestação de contas periódica da Conferência aos Conselhos superiores.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('conferencia')}
              className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Voltar para Conferência
            </button>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL 1: FICHA COMPLETA DA CONFERÊNCIA (VISUALIZAR / EDITAR)
          ======================================================== */}
      {isViewingConfModal && data && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 bg-[#0b4d8c] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">
                  {isEditingConf ? 'Editar Dados da Conferência' : 'Ficha da Conferência'}
                </h3>
                <p className="text-xs text-blue-100 truncate mt-0.5">{data.name}</p>
              </div>
              <button
                onClick={() => {
                  setIsViewingConfModal(false);
                  setIsEditingConf(false);
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com rolagem */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              {!isEditingConf ? (
                /* MODO DE VISUALIZAÇÃO PURA */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {data.code && (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Código</span>
                        <span className="font-bold text-slate-800">{data.code}</span>
                      </div>
                    )}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                      <span className="font-bold text-emerald-700">Ativa</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Fundação</span>
                      <span className="font-semibold text-slate-800">{formatDate(data.foundationDate)}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Agregação</span>
                      <span className="font-semibold text-slate-800">{formatDate(data.aggregationDate)}</span>
                    </div>
                  </div>

                  {/* Reuniões e Sede */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-[#0b4d8c] uppercase tracking-wider">
                      Reuniões e Sede
                    </h4>
                    <p>
                      <strong className="text-slate-700">Dia e Horário:</strong> {data.meetingDay || 'Não informado'}
                      {data.meetingTime ? ` às ${data.meetingTime}` : ''}
                    </p>
                    <p>
                      <strong className="text-slate-700">Local:</strong> {data.location || 'Salão da Conferência'}
                    </p>
                    <p>
                      <strong className="text-slate-700">Endereço Completo:</strong> {getFullAddress(data)}
                    </p>
                    {data.phone && (
                      <p>
                        <strong className="text-slate-700">Telefone:</strong> {data.phone}
                      </p>
                    )}
                    {data.email && (
                      <p>
                        <strong className="text-slate-700">E-mail:</strong> {data.email}
                      </p>
                    )}
                  </div>

                  {/* Vínculo Hierárquico */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold text-[#0b4d8c] uppercase tracking-wider">
                      Conselhos Vinculados
                    </h4>
                    <p className="text-slate-700">
                      <strong>Conselho Particular:</strong> {particularNome || 'Não informado'}
                    </p>
                    <p className="text-slate-700">
                      <strong>Conselho Central:</strong> {centralNome}
                    </p>
                  </div>

                  {data.notes && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</h4>
                      <p className="text-slate-700 text-xs">{data.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO DE EDIÇÃO DA CONFERÊNCIA */
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Dia da Reunião</label>
                      <input
                        type="text"
                        value={confFormData.meetingDay || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, meetingDay: e.target.value })}
                        placeholder="Ex: Domingo"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Horário</label>
                      <input
                        type="text"
                        value={confFormData.meetingTime || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, meetingTime: e.target.value })}
                        placeholder="Ex: 09:00"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Local da Reunião</label>
                    <input
                      type="text"
                      value={confFormData.location || ''}
                      onChange={(e) => setConfFormData({ ...confFormData, location: e.target.value })}
                      placeholder="Ex: Salão Paroquial / Sede"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">Rua / Logradouro</label>
                      <input
                        type="text"
                        value={confFormData.addressStreet || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, addressStreet: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Número</label>
                      <input
                        type="text"
                        value={confFormData.addressNumber || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, addressNumber: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Bairro</label>
                      <input
                        type="text"
                        value={confFormData.addressNeighborhood || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, addressNeighborhood: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Cidade</label>
                      <input
                        type="text"
                        value={confFormData.addressCity || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, addressCity: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Telefone</label>
                      <input
                        type="text"
                        value={confFormData.phone || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, phone: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">E-mail</label>
                      <input
                        type="email"
                        value={confFormData.email || ''}
                        onChange={(e) => setConfFormData({ ...confFormData, email: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal com Ações */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5">
              {!isEditingConf ? (
                <>
                  <button
                    onClick={() => setIsEditingConf(true)}
                    className="flex-1 py-3 bg-[#0b4d8c] hover:bg-[#093d70] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar dados
                  </button>
                  <button
                    onClick={() => setIsViewingConfModal(false)}
                    className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={savingConf}
                    onClick={handleSaveConfData}
                    className="flex-1 py-3 bg-[#0b4d8c] hover:bg-[#093d70] disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    {savingConf ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar alterações
                  </button>
                  <button
                    disabled={savingConf}
                    onClick={() => setIsEditingConf(false)}
                    className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: DIRETORIA (VISUALIZAR E ALTERAR COMPOSIÇÃO)
          ======================================================== */}
      {isViewingDiretoriaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Cabeçalho */}
            <div className="px-6 py-4 bg-[#0b4d8c] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">
                  {isEditingDiretoria ? 'Alterar Composição da Diretoria' : 'Diretoria da Conferência'}
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">6 cargos oficiais da SSVP</p>
              </div>
              <button
                onClick={() => {
                  setIsViewingDiretoriaModal(false);
                  setIsEditingDiretoria(false);
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {!isEditingDiretoria ? (
                /* VISUALIZAÇÃO DOS 6 CARGOS */
                <div className="space-y-2.5">
                  {CARGOS_CONFIG.map((cargo) => {
                    const disp = getCargoDisplay(cargo.key);
                    const isFilled = disp.membroId || (disp.name && disp.name !== 'Não informado / Vago');

                    return (
                      <div
                        key={cargo.key}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0b4d8c] block">
                            {cargo.label}
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                            {disp.name}
                          </p>
                          {disp.phone && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{disp.phone}</p>
                          )}
                        </div>

                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 border ${
                          isFilled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isFilled ? 'Vinculado' : 'Vago'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* SELEÇÃO VINCULADA EXCLUSIVAMENTE A MEMBROS ATIVOS */
                <div className="space-y-3.5">
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                    <p className="font-semibold">
                      Selecione membros ativos da própria Conferência para cada cargo da diretoria.
                    </p>
                  </div>

                  {CARGOS_CONFIG.map((cargo) => (
                    <div key={cargo.key} className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 block">
                        {cargo.label}
                      </label>
                      <select
                        value={diretoriaFormData[cargo.key] || ''}
                        onChange={(e) => setDiretoriaFormData({
                          ...diretoriaFormData,
                          [cargo.key]: e.target.value
                        })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none"
                      >
                        <option value="">-- Não informado / Vago --</option>
                        {membros.filter(m => m.status === 'ativo').map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({getClassificationLabel(m.type)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5">
              {!isEditingDiretoria ? (
                <>
                  <button
                    onClick={() => setIsEditingDiretoria(true)}
                    className="flex-1 py-3 bg-[#0b4d8c] hover:bg-[#093d70] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <UserCheck className="w-4 h-4" />
                    Alterar Composição
                  </button>
                  <button
                    onClick={() => setIsViewingDiretoriaModal(false)}
                    className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={savingDiretoria}
                    onClick={handleSaveDiretoria}
                    className="flex-1 py-3 bg-[#0b4d8c] hover:bg-[#093d70] disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    {savingDiretoria ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar Composição
                  </button>
                  <button
                    disabled={savingDiretoria}
                    onClick={() => setIsEditingDiretoria(false)}
                    className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: FICHA DO MEMBRO (PRIMEIRO VISUALIZAR; DEPOIS EDITAR)
          ======================================================== */}
      {selectedMemberForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Cabeçalho */}
            <div className="px-6 py-4 bg-[#0b4d8c] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">
                  {isEditingMember ? 'Editar Dados do Membro' : 'Ficha do Membro'}
                </h3>
                <p className="text-xs text-blue-100 truncate mt-0.5">{selectedMemberForView.fullName}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedMemberForView(null);
                  setIsEditingMember(false);
                }}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm">
              {!isEditingMember ? (
                /* VISUALIZAÇÃO COMPLETA DO MEMBRO */
                <div className="space-y-4">
                  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-[#0b4d8c] flex items-center justify-center font-black text-sm shrink-0">
                      {selectedMemberForView.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm sm:text-base font-black text-slate-900 truncate">
                        {selectedMemberForView.fullName}
                      </h4>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0b4d8c] border border-blue-200">
                          {getClassificationLabel(selectedMemberForView.type)}
                        </span>
                        {cargosPorMembroId[selectedMemberForView.id] && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {cargosPorMembroId[selectedMemberForView.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dados Pessoais */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h5 className="text-xs font-bold text-[#0b4d8c] uppercase tracking-wider">
                      Dados Pessoais
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase">CPF</span>
                        <span className="font-semibold text-slate-800">{selectedMemberForView.cpf || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase">Nascimento</span>
                        <span className="font-semibold text-slate-800">{formatDate(selectedMemberForView.birthDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase">Profissão</span>
                        <span className="font-semibold text-slate-800">{selectedMemberForView.profession || 'Não informada'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase">Status</span>
                        <span className="font-bold text-emerald-700 capitalize">{selectedMemberForView.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contatos e Endereço */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <h5 className="text-xs font-bold text-[#0b4d8c] uppercase tracking-wider">
                      Contatos e Endereço
                    </h5>
                    <p><strong className="text-slate-700">Celular / WhatsApp:</strong> {selectedMemberForView.phone || 'Não informado'}</p>
                    {selectedMemberForView.email && (
                      <p><strong className="text-slate-700">E-mail:</strong> {selectedMemberForView.email}</p>
                    )}
                    <p>
                      <strong className="text-slate-700">Endereço:</strong> {
                        selectedMemberForView.addressStreet
                          ? `${selectedMemberForView.addressStreet}${selectedMemberForView.addressNumber ? `, ${selectedMemberForView.addressNumber}` : ''} - ${selectedMemberForView.addressCity || ''}`
                          : selectedMemberForView.fullAddress || 'Não informado'
                      }
                    </p>
                  </div>

                  {/* Trajetória Vicentina */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <h5 className="text-xs font-bold text-[#0b4d8c] uppercase tracking-wider">
                      Trajetória Vicentina
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase">Admissão</span>
                        <span className="font-semibold text-slate-800">{formatDate(selectedMemberForView.admissionDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-bold text-[10px] uppercase">Proclamação</span>
                        <span className="font-semibold text-slate-800">{formatDate(selectedMemberForView.proclamationDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIÇÃO DOS DADOS DO MEMBRO */
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={memberFormData.fullName || ''}
                      onChange={(e) => setMemberFormData({ ...memberFormData, fullName: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Classificação</label>
                      <select
                        value={memberFormData.type || 'confrade'}
                        onChange={(e) => setMemberFormData({ ...memberFormData, type: e.target.value as any })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      >
                        <option value="confrade">Confrade</option>
                        <option value="consocia">Consócia</option>
                        <option value="aspirante">Aspirante</option>
                        <option value="auxiliar">Auxiliar</option>
                        <option value="afastado">Afastado</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Celular / WhatsApp</label>
                      <input
                        type="text"
                        value={memberFormData.phone || ''}
                        onChange={(e) => setMemberFormData({ ...memberFormData, phone: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Data Nascimento</label>
                      <input
                        type="date"
                        value={memberFormData.birthDate || ''}
                        onChange={(e) => setMemberFormData({ ...memberFormData, birthDate: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">CPF</label>
                      <input
                        type="text"
                        value={memberFormData.cpf || ''}
                        onChange={(e) => setMemberFormData({ ...memberFormData, cpf: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">E-mail</label>
                    <input
                      type="email"
                      value={memberFormData.email || ''}
                      onChange={(e) => setMemberFormData({ ...memberFormData, email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Endereço Residencial</label>
                    <input
                      type="text"
                      value={memberFormData.addressStreet || ''}
                      onChange={(e) => setMemberFormData({ ...memberFormData, addressStreet: e.target.value })}
                      placeholder="Rua, número e bairro"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5">
              {!isEditingMember ? (
                <>
                  <button
                    onClick={() => setIsEditingMember(true)}
                    className="flex-1 py-3 bg-[#0b4d8c] hover:bg-[#093d70] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar dados
                  </button>
                  <button
                    onClick={() => setSelectedMemberForView(null)}
                    className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={savingMember}
                    onClick={handleSaveMemberData}
                    className="flex-1 py-3 bg-[#0b4d8c] hover:bg-[#093d70] disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    {savingMember ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar Dados do Membro
                  </button>
                  <button
                    disabled={savingMember}
                    onClick={() => setIsEditingMember(false)}
                    className="py-3 px-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior (Bottom Navigation) sincronizada com as 3 abas */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 py-2 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-3 px-2">
          <button
            onClick={() => setActiveTab('conferencia')}
            className={`py-1.5 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'conferencia'
                ? 'text-[#0b4d8c] font-black'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${
              activeTab === 'conferencia' ? 'bg-blue-100 text-[#0b4d8c]' : ''
            }`}>
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-none">Conferência</span>
          </button>

          <button
            onClick={() => setActiveTab('livro_caixa')}
            className={`py-1.5 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'livro_caixa'
                ? 'text-[#0b4d8c] font-black'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${
              activeTab === 'livro_caixa' ? 'bg-blue-100 text-[#0b4d8c]' : ''
            }`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-none">Livro Caixa</span>
          </button>

          <button
            onClick={() => setActiveTab('mapa_financeiro')}
            className={`py-1.5 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'mapa_financeiro'
                ? 'text-[#0b4d8c] font-black'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${
              activeTab === 'mapa_financeiro' ? 'bg-blue-100 text-[#0b4d8c]' : ''
            }`}>
              <ReceiptText className="w-5 h-5" />
            </div>
            <span className="text-[11px] leading-none">Mapa</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

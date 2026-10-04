import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  ShieldCheck,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  User,
  HeartHandshake,
  Check,
  Edit3,
  Lock,
  ArrowRight,
  Info,
  Home
} from 'lucide-react';
import {
  PublicHierarchyStructureResponse,
  PublicMemberLookupItem,
  PublicMemberMaskedDetails,
  PublicMemberUpdateRequestPayload,
} from '../types';
import {
  fetchPublicConferenciaMembers,
  fetchPublicMemberMaskedDetails,
  submitPublicMemberUpdateRequestForm,
} from '../lib/hierarchy_api';

interface PublicMemberUpdateTabProps {
  token: string;
  structure: PublicHierarchyStructureResponse;
  initialParticularId?: string;
  initialConferenciaId?: string;
}

export const PublicMemberUpdateTab: React.FC<PublicMemberUpdateTabProps> = ({
  token,
  structure,
  initialParticularId = '',
  initialConferenciaId = '',
}) => {
  // Seleção Hierárquica
  const [selectedParticularId, setSelectedParticularId] = useState(initialParticularId);
  const [selectedConferenciaId, setSelectedConferenciaId] = useState(initialConferenciaId);

  // Lista de Membros da Conferência
  const [membersList, setMembersList] = useState<PublicMemberLookupItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedOpaqueId, setSelectedOpaqueId] = useState('');
  const [memberSearchFilter, setMemberSearchFilter] = useState('');

  // Detalhes Mascarados do Membro Selecionado
  const [maskedDetails, setMaskedDetails] = useState<PublicMemberMaskedDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Controle de "Manter Atual" vs "Informar Novo Valor" para cada campo
  const [changeModes, setChangeModes] = useState<{
    type: boolean;
    gender: boolean;
    cpf: boolean;
    profession: boolean;
    phone: boolean;
    phoneResidential: boolean;
    phoneCommercial: boolean;
    email: boolean;
    addressZip: boolean;
    addressStreet: boolean;
    addressNumber: boolean;
    addressComplement: boolean;
    addressNeighborhood: boolean;
    addressCity: boolean;
    addressState: boolean;
    birthDate: boolean;
    admissionDate: boolean;
    acclamationDate: boolean;
    proclamationDate: boolean;
  }>({
    type: false,
    gender: false,
    cpf: false,
    profession: false,
    phone: false,
    phoneResidential: false,
    phoneCommercial: false,
    email: false,
    addressZip: false,
    addressStreet: false,
    addressNumber: false,
    addressComplement: false,
    addressNeighborhood: false,
    addressCity: false,
    addressState: false,
    birthDate: false,
    admissionDate: false,
    acclamationDate: false,
    proclamationDate: false,
  });

  // Novos Valores Digitados
  const [newType, setNewType] = useState<'confrade' | 'consocia' | 'auxiliar' | 'aspirante' | 'afastado'>('confrade');
  const [newGender, setNewGender] = useState<'masculino' | 'feminino' | 'outro' | ''>('');
  const [newCpf, setNewCpf] = useState('');
  const [newProfession, setNewProfession] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneResidential, setNewPhoneResidential] = useState('');
  const [newPhoneCommercial, setNewPhoneCommercial] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressNumber, setNewAddressNumber] = useState('');
  const [newAddressComplement, setNewAddressComplement] = useState('');
  const [newAddressNeighborhood, setNewAddressNeighborhood] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newAdmissionDate, setNewAdmissionDate] = useState('');
  const [newAcclamationDate, setNewAcclamationDate] = useState('');
  const [newProclamationDate, setNewProclamationDate] = useState('');

  // Responsável por terceiros
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [representativeName, setRepresentativeName] = useState('');

  // Consentimento e Envio
  const [requestId, setRequestId] = useState<string>(() => `req_upd_${crypto.randomUUID()}`);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successResponse, setSuccessResponse] = useState<any>(null);

  // Conferências ativas do CP selecionado
  const filteredConferencias = useMemo(() => {
    if (!structure || !selectedParticularId) return [];
    return structure.conferencias.filter((c) => c.particularId === selectedParticularId);
  }, [structure, selectedParticularId]);

  // Carregar lista de membros ao selecionar a Conferência
  useEffect(() => {
    let isMounted = true;
    async function loadMembers() {
      if (!selectedConferenciaId) {
        setMembersList([]);
        setSelectedOpaqueId('');
        setMaskedDetails(null);
        return;
      }

      setLoadingMembers(true);
      setErrorMessage(null);
      try {
        const members = await fetchPublicConferenciaMembers(token, selectedConferenciaId);
        if (isMounted) {
          setMembersList(members);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Não foi possível carregar a lista de membros desta Conferência.');
        }
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    }

    loadMembers();
    return () => {
      isMounted = false;
    };
  }, [token, selectedConferenciaId]);

  // Carregar detalhes mascarados ao selecionar o membro
  useEffect(() => {
    let isMounted = true;
    async function loadDetails() {
      if (!selectedOpaqueId) {
        setMaskedDetails(null);
        return;
      }

      setLoadingDetails(true);
      setErrorMessage(null);
      try {
        const details = await fetchPublicMemberMaskedDetails(token, selectedOpaqueId);
        if (isMounted) {
          setMaskedDetails(details);
          // Reseta os campos de edição e modos ao trocar de membro
          setChangeModes({
            type: false,
            gender: false,
            cpf: false,
            profession: false,
            phone: false,
            phoneResidential: false,
            phoneCommercial: false,
            email: false,
            addressZip: false,
            addressStreet: false,
            addressNumber: false,
            addressComplement: false,
            addressNeighborhood: false,
            addressCity: false,
            addressState: false,
            birthDate: false,
            admissionDate: false,
            acclamationDate: false,
            proclamationDate: false,
          });
          setNewGender('');
          setNewCpf('');
          setNewProfession('');
          setNewPhone('');
          setNewPhoneResidential('');
          setNewPhoneCommercial('');
          setNewEmail('');
          setNewAddressZip('');
          setNewAddressStreet('');
          setNewAddressNumber('');
          setNewAddressComplement('');
          setNewAddressNeighborhood('');
          setNewAddressCity('');
          setNewAddressState('');
          setNewBirthDate('');
          setNewAdmissionDate('');
          setNewAcclamationDate('');
          setNewProclamationDate('');
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Não foi possível carregar os dados cadastrais do membro selecionado.');
        }
      } finally {
        if (isMounted) {
          setLoadingDetails(false);
        }
      }
    }

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [token, selectedOpaqueId]);

  // Formatar Telefone BR
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Helper mask for CPF: 000.000.000-00
  const formatCpf = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Helper mask for CEP: 00000-000
  const formatZip = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  // Membros filtrados por busca de nome
  const filteredMembers = useMemo(() => {
    if (!memberSearchFilter.trim()) return membersList;
    const term = memberSearchFilter.toLowerCase();
    return membersList.filter((m) => m.fullName.toLowerCase().includes(term));
  }, [membersList, memberSearchFilter]);

  // Contagem de campos com alteração solicitada
  const activeChangesCount = useMemo(() => {
    let count = 0;
    if (changeModes.type && newType) count++;
    if (changeModes.gender && newGender) count++;
    if (changeModes.cpf && newCpf.trim()) count++;
    if (changeModes.profession && newProfession.trim()) count++;
    if (changeModes.phone && newPhone.trim()) count++;
    if (changeModes.phoneResidential && newPhoneResidential.trim()) count++;
    if (changeModes.phoneCommercial && newPhoneCommercial.trim()) count++;
    if (changeModes.email && newEmail.trim()) count++;
    if (changeModes.addressZip && newAddressZip.trim()) count++;
    if (changeModes.addressStreet && newAddressStreet.trim()) count++;
    if (changeModes.addressNumber && newAddressNumber.trim()) count++;
    if (changeModes.addressComplement && newAddressComplement.trim()) count++;
    if (changeModes.addressNeighborhood && newAddressNeighborhood.trim()) count++;
    if (changeModes.addressCity && newAddressCity.trim()) count++;
    if (changeModes.addressState && newAddressState.trim()) count++;
    if (changeModes.birthDate && newBirthDate) count++;
    if (changeModes.admissionDate && newAdmissionDate) count++;
    if (changeModes.acclamationDate && newAcclamationDate) count++;
    if (changeModes.proclamationDate && newProclamationDate) count++;
    return count;
  }, [
    changeModes,
    newType,
    newGender,
    newCpf,
    newProfession,
    newPhone,
    newPhoneResidential,
    newPhoneCommercial,
    newEmail,
    newAddressZip,
    newAddressStreet,
    newAddressNumber,
    newAddressComplement,
    newAddressNeighborhood,
    newAddressCity,
    newAddressState,
    newBirthDate,
    newAdmissionDate,
    newAcclamationDate,
    newProclamationDate,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors([]);

    if (!selectedOpaqueId || !maskedDetails) {
      setErrorMessage('Por favor, selecione seu nome na lista da Conferência.');
      return;
    }

    if (activeChangesCount === 0) {
      setErrorMessage('Nenhuma nova informação foi indicada. Escolha "Informar novo valor" no campo desejado antes de enviar.');
      return;
    }

    if (isThirdParty && (!representativeName.trim() || representativeName.trim().length < 3)) {
      setErrorMessage('Informe o nome do responsável pelo preenchimento (mínimo de 3 caracteres).');
      return;
    }

    if (!consentAccepted) {
      setErrorMessage('É obrigatório aceitar o termo de consentimento para envio das atualizações.');
      return;
    }

    const payload: PublicMemberUpdateRequestPayload & { requestId?: string } = {
      type: changeModes.type ? newType : undefined,
      gender: changeModes.gender ? (newGender as any) : undefined,
      cpf: changeModes.cpf ? newCpf.trim() : undefined,
      profession: changeModes.profession ? newProfession.trim() : undefined,
      phone: changeModes.phone ? newPhone.trim() : undefined,
      phoneResidential: changeModes.phoneResidential ? newPhoneResidential.trim() : undefined,
      phoneCommercial: changeModes.phoneCommercial ? newPhoneCommercial.trim() : undefined,
      email: changeModes.email ? newEmail.trim() : undefined,
      addressZip: changeModes.addressZip ? newAddressZip.trim() : undefined,
      addressStreet: changeModes.addressStreet ? newAddressStreet.trim() : undefined,
      addressNumber: changeModes.addressNumber ? newAddressNumber.trim() : undefined,
      addressComplement: changeModes.addressComplement ? newAddressComplement.trim() : undefined,
      addressNeighborhood: changeModes.addressNeighborhood ? newAddressNeighborhood.trim() : undefined,
      addressCity: changeModes.addressCity ? newAddressCity.trim() : undefined,
      addressState: changeModes.addressState ? newAddressState.trim() : undefined,
      birthDate: changeModes.birthDate ? newBirthDate : undefined,
      admissionDate: changeModes.admissionDate ? newAdmissionDate : undefined,
      acclamationDate: changeModes.acclamationDate ? newAcclamationDate : undefined,
      proclamationDate: changeModes.proclamationDate ? newProclamationDate : undefined,
      consentAccepted: true,
      termVersion: structure.termVersion,
      isThirdPartySubmission: isThirdParty || undefined,
      representativeName: isThirdParty ? representativeName.trim() : undefined,
      requestId,
    };

    setIsSubmitting(true);
    try {
      const resp = await submitPublicMemberUpdateRequestForm(token, selectedOpaqueId, payload);
      setIsSuccess(true);
      setSuccessResponse(resp);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao enviar solicitação de atualização cadastral.');
      if (err.data?.errors && Array.isArray(err.data.errors)) {
        setFieldErrors(err.data.errors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setIsSuccess(false);
    setSuccessResponse(null);
    setRequestId(`req_upd_${crypto.randomUUID()}`);
    setSelectedOpaqueId('');
    setMaskedDetails(null);
    setConsentAccepted(false);
    setErrorMessage(null);
    setFieldErrors([]);
  };

  if (isSuccess) {
    const appliedChangesObj = successResponse?.data?.appliedChanges || successResponse?.appliedChanges || {};
    const requestedChangesObj = successResponse?.data?.requestedChanges || successResponse?.requestedChanges || {};
    const statusResp = successResponse?.data?.status || successResponse?.status || 'processado_automaticamente';

    const appliedEntries = Object.entries(appliedChangesObj);
    const requestedEntries = Object.entries(requestedChangesObj);

    const getFieldLabel = (key: string) => {
      switch (key) {
        case 'type':
          return 'Classificação';
        case 'gender':
          return 'Sexo';
        case 'cpf':
          return 'CPF';
        case 'profession':
          return 'Profissão';
        case 'phone':
          return 'Telefone Celular';
        case 'phoneResidential':
          return 'Telefone Residencial';
        case 'phoneCommercial':
          return 'Telefone Comercial';
        case 'email':
          return 'E-mail';
        case 'addressZip':
          return 'CEP';
        case 'addressStreet':
          return 'Logradouro / Rua';
        case 'addressNumber':
          return 'Número';
        case 'addressComplement':
          return 'Complemento';
        case 'addressNeighborhood':
          return 'Bairro';
        case 'addressCity':
          return 'Cidade';
        case 'addressState':
          return 'Estado (UF)';
        case 'birthDate':
          return 'Data de Nascimento';
        case 'admissionDate':
          return 'Data de Ingresso';
        case 'acclamationDate':
          return 'Data de Aclamação';
        case 'proclamationDate':
          return 'Data de Proclamação';
        default:
          return key;
      }
    };

    return (
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-emerald-100 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {statusResp === 'processado_automaticamente'
            ? 'Dados Atualizados com Sucesso!'
            : statusResp === 'parcialmente_processado'
            ? 'Atualização Parcial Concluída!'
            : 'Solicitação de Atualização Enviada!'}
        </h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
          {successResponse?.message || 'Suas informações foram processadas de acordo com as regras de integridade do Conselho Central.'}
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-md mx-auto mb-6 text-left space-y-2 text-xs text-slate-700">
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Membro:</span>
            <strong className="text-slate-800">{maskedDetails?.fullName}</strong>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Conselho Particular:</span>
            <span className="font-semibold text-slate-800">{maskedDetails?.particularName}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Conferência:</span>
            <span className="font-semibold text-slate-800">{maskedDetails?.conferenciaName}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-500 font-medium">Status do Processamento:</span>
            {statusResp === 'processado_automaticamente' ? (
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Processado Automaticamente
              </span>
            ) : statusResp === 'parcialmente_processado' ? (
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                Parcialmente Processado
              </span>
            ) : (
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                Aguardando Aprovação
              </span>
            )}
          </div>
        </div>

        {/* Bloco 1: Campos Atualizados Imediatamente (appliedChanges) */}
        {appliedEntries.length > 0 && (
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl max-w-md mx-auto mb-4 text-left space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Dados Atualizados Imediatamente ({appliedEntries.length})</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Estes campos não possuíam valor anterior e foram incorporados de imediato ao cadastro oficial do membro:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {appliedEntries.map(([key, val]) => (
                <div key={key} className="p-2 bg-white/90 rounded-xl border border-emerald-200 text-xs">
                  <span className="text-[10px] text-emerald-700 font-semibold block">{getFieldLabel(key)}</span>
                  <span className="font-bold text-slate-800 truncate block">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bloco 2: Alterações Aguardando Aprovação (requestedChanges) */}
        {requestedEntries.length > 0 && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl max-w-md mx-auto mb-6 text-left space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Alterações Aguardando Aprovação da Diretoria ({requestedEntries.length})</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Como esses dados já possuíam registro prévio, a alteração foi enviada para validação do Conselho Central por segurança:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {requestedEntries.map(([key, val]) => (
                <div key={key} className="p-2 bg-white/90 rounded-xl border border-amber-200 text-xs">
                  <span className="text-[10px] text-amber-700 font-semibold block">{getFieldLabel(key)}</span>
                  <span className="font-bold text-slate-800 truncate block">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleResetForAnother}
          className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Fazer Outra Atualização</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas de Erro */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{errorMessage}</p>
            {fieldErrors.length > 0 && (
              <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5">
                {fieldErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Informativo de Segurança */}
      <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <strong className="block text-blue-950 font-bold">Privacidade e Proteção de Dados (LGPD)</strong>
          <p>
            Para proteger a sua privacidade, informações confidenciais são exibidas de forma mascarada. Você pode manter qualquer dado existente e preencher somente as informações ou datas que deseja complementar.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SEÇÃO 1: LOCALIZAÇÃO DO MEMBRO */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-800">1. Localize sua Conferência e seu Nome</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Conselho Particular */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Conselho Particular <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-update-particular"
                value={selectedParticularId}
                onChange={(e) => {
                  setSelectedParticularId(e.target.value);
                  setSelectedConferenciaId('');
                  setSelectedOpaqueId('');
                  setMaskedDetails(null);
                }}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition"
              >
                <option value="">Selecione o Conselho Particular...</option>
                {structure.conselhosParticulares.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Conferência */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Conferência <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-update-conferencia"
                value={selectedConferenciaId}
                disabled={!selectedParticularId}
                onChange={(e) => {
                  setSelectedConferenciaId(e.target.value);
                  setSelectedOpaqueId('');
                  setMaskedDetails(null);
                }}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition disabled:opacity-50"
              >
                <option value="">
                  {!selectedParticularId ? 'Selecione o Conselho Particular primeiro...' : 'Selecione a sua Conferência...'}
                </option>
                {filteredConferencias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seleção do Membro */}
          {selectedConferenciaId && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Selecione o seu nome na lista da Conferência <span className="text-rose-500">*</span>
              </label>

              {loadingMembers ? (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
                  <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span>Carregando membros da Conferência...</span>
                </div>
              ) : membersList.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  Nenhum membro ativo ou solicitação pendente encontrada nesta Conferência. Caso seja seu primeiro cadastro, use a aba <strong>Novo Cadastro</strong>.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome..."
                      value={memberSearchFilter}
                      onChange={(e) => setMemberSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <select
                    id="select-update-member"
                    value={selectedOpaqueId}
                    onChange={(e) => setSelectedOpaqueId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition"
                  >
                    <option value="">Clique aqui para escolher seu nome...</option>
                    {filteredMembers.map((m) => (
                      <option key={m.idOpaco} value={m.idOpaco}>
                        {m.fullName} ({m.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SEÇÃO 2: DADOS DO MEMBRO E COMPLEMENTAÇÃO */}
        {selectedOpaqueId && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-800">2. Informações Cadastrais e Datas Vicentinas</h3>
              </div>
              {activeChangesCount > 0 && (
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  {activeChangesCount} campo(s) para alterar
                </span>
              )}
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mr-2" />
                <span className="text-sm text-slate-600 font-medium">Carregando dados cadastrais...</span>
              </div>
            ) : maskedDetails ? (
              <div className="space-y-5">
                {/* Nome Completo (Identificador principal) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Nome do Membro</span>
                    <strong className="text-base text-slate-900">{maskedDetails.fullName}</strong>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold uppercase">
                    {maskedDetails.type}
                  </span>
                </div>

                {/* Grid de Campos Pessoais e de Contato */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Classificação */}
                  <FieldCard
                    label="Classificação Vicentina"
                    icon={<User className="w-4 h-4 text-slate-500" />}
                    currentDisplay={`Atual: ${maskedDetails.type.toUpperCase()}`}
                    isEditing={changeModes.type}
                    onToggle={(val) => setChangeModes({ ...changeModes, type: val })}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {(['confrade', 'consocia', 'aspirante', 'afastado', 'auxiliar'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewType(t)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold capitalize transition border ${
                            newType === t
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </FieldCard>

                  {/* Sexo */}
                  <FieldCard
                    label="Sexo / Gênero"
                    icon={<User className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.gender ? maskedDetails.gender.toUpperCase() : 'Não informado'}
                    isEditing={changeModes.gender}
                    onToggle={(val) => setChangeModes({ ...changeModes, gender: val })}
                  >
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value as any)}
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Selecione...</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </FieldCard>

                  {/* CPF */}
                  <FieldCard
                    label="CPF"
                    icon={<User className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.maskedCpf || 'Não informado'}
                    isEditing={changeModes.cpf}
                    onToggle={(val) => setChangeModes({ ...changeModes, cpf: val })}
                  >
                    <input
                      type="text"
                      value={newCpf}
                      onChange={(e) => setNewCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>

                  {/* Profissão */}
                  <FieldCard
                    label="Profissão"
                    icon={<User className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.profession || 'Não informada'}
                    isEditing={changeModes.profession}
                    onToggle={(val) => setChangeModes({ ...changeModes, profession: val })}
                  >
                    <input
                      type="text"
                      value={newProfession}
                      onChange={(e) => setNewProfession(e.target.value)}
                      placeholder="Ex: Professor, Autônomo..."
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>

                  {/* Telefone / WhatsApp */}
                  <FieldCard
                    label="Telefone Celular / WhatsApp"
                    icon={<Phone className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.maskedPhone || 'Não informado'}
                    isEditing={changeModes.phone}
                    onToggle={(val) => setChangeModes({ ...changeModes, phone: val })}
                  >
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                      placeholder="(99) 99999-9999"
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>

                  {/* Telefone Residencial */}
                  <FieldCard
                    label="Telefone Residencial"
                    icon={<Phone className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.maskedPhoneResidential || 'Não informado'}
                    isEditing={changeModes.phoneResidential}
                    onToggle={(val) => setChangeModes({ ...changeModes, phoneResidential: val })}
                  >
                    <input
                      type="tel"
                      value={newPhoneResidential}
                      onChange={(e) => setNewPhoneResidential(formatPhone(e.target.value))}
                      placeholder="(99) 9999-9999"
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>

                  {/* Telefone Comercial */}
                  <FieldCard
                    label="Telefone Comercial"
                    icon={<Phone className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.maskedPhoneCommercial || 'Não informado'}
                    isEditing={changeModes.phoneCommercial}
                    onToggle={(val) => setChangeModes({ ...changeModes, phoneCommercial: val })}
                  >
                    <input
                      type="tel"
                      value={newPhoneCommercial}
                      onChange={(e) => setNewPhoneCommercial(formatPhone(e.target.value))}
                      placeholder="(99) 9999-9999"
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>

                  {/* E-mail */}
                  <FieldCard
                    label="E-mail"
                    icon={<Mail className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.maskedEmail || 'Não informado'}
                    isEditing={changeModes.email}
                    onToggle={(val) => setChangeModes({ ...changeModes, email: val })}
                  >
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="novo.email@exemplo.com"
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>

                  {/* Data de Nascimento */}
                  <FieldCard
                    label="Data de Nascimento"
                    icon={<Calendar className="w-4 h-4 text-slate-500" />}
                    currentDisplay={maskedDetails.maskedBirthDate || 'Não informada'}
                    isEditing={changeModes.birthDate}
                    onToggle={(val) => setChangeModes({ ...changeModes, birthDate: val })}
                  >
                    <input
                      type="date"
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                      className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                    />
                  </FieldCard>
                </div>

                {/* Subseção de Endereço Residencial */}
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Endereço Residencial
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CEP */}
                    <FieldCard
                      label="CEP"
                      icon={<Home className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.addressZip || 'Não informado'}
                      isEditing={changeModes.addressZip}
                      onToggle={(val) => setChangeModes({ ...changeModes, addressZip: val })}
                    >
                      <input
                        type="text"
                        value={newAddressZip}
                        onChange={(e) => setNewAddressZip(formatZip(e.target.value))}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Logradouro / Rua */}
                    <FieldCard
                      label="Logradouro / Rua"
                      icon={<Home className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.addressStreet || 'Não informado'}
                      isEditing={changeModes.addressStreet}
                      onToggle={(val) => setChangeModes({ ...changeModes, addressStreet: val })}
                    >
                      <input
                        type="text"
                        value={newAddressStreet}
                        onChange={(e) => setNewAddressStreet(e.target.value)}
                        placeholder="Ex: Rua das Flores"
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Número */}
                    <FieldCard
                      label="Número"
                      icon={<Home className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.addressNumber || 'Não informado'}
                      isEditing={changeModes.addressNumber}
                      onToggle={(val) => setChangeModes({ ...changeModes, addressNumber: val })}
                    >
                      <input
                        type="text"
                        value={newAddressNumber}
                        onChange={(e) => setNewAddressNumber(e.target.value)}
                        placeholder="Ex: 123"
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Complemento */}
                    <FieldCard
                      label="Complemento"
                      icon={<Home className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.addressComplement || 'Não informado'}
                      isEditing={changeModes.addressComplement}
                      onToggle={(val) => setChangeModes({ ...changeModes, addressComplement: val })}
                    >
                      <input
                        type="text"
                        value={newAddressComplement}
                        onChange={(e) => setNewAddressComplement(e.target.value)}
                        placeholder="Ex: Apto 101"
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Bairro */}
                    <FieldCard
                      label="Bairro"
                      icon={<Home className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.addressNeighborhood || 'Não informado'}
                      isEditing={changeModes.addressNeighborhood}
                      onToggle={(val) => setChangeModes({ ...changeModes, addressNeighborhood: val })}
                    >
                      <input
                        type="text"
                        value={newAddressNeighborhood}
                        onChange={(e) => setNewAddressNeighborhood(e.target.value)}
                        placeholder="Ex: Centro"
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Cidade e UF */}
                    <FieldCard
                      label="Cidade / UF"
                      icon={<Home className="w-4 h-4 text-slate-500" />}
                      currentDisplay={
                        maskedDetails.addressCity || maskedDetails.addressState
                          ? `${maskedDetails.addressCity || ''} - ${maskedDetails.addressState || ''}`
                          : 'Não informado'
                      }
                      isEditing={changeModes.addressCity || changeModes.addressState}
                      onToggle={(val) =>
                        setChangeModes({ ...changeModes, addressCity: val, addressState: val })
                      }
                    >
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <input
                          type="text"
                          value={newAddressCity}
                          onChange={(e) => setNewAddressCity(e.target.value)}
                          placeholder="Cidade"
                          className="col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                        />
                        <input
                          type="text"
                          value={newAddressState}
                          onChange={(e) => setNewAddressState(e.target.value.toUpperCase().substring(0, 2))}
                          placeholder="UF"
                          maxLength={2}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 uppercase"
                        />
                      </div>
                    </FieldCard>
                  </div>
                </div>

                {/* Subseção de Datas Vicentinas */}
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Datas Históricas da Vida Vicentina
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Data de Ingresso */}
                    <FieldCard
                      label="Data de Ingresso"
                      icon={<Calendar className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.admissionDateStatus === 'informada' ? '✓ Data Informada' : 'Não Informada'}
                      statusColor={maskedDetails.admissionDateStatus === 'informada' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}
                      isEditing={changeModes.admissionDate}
                      onToggle={(val) => setChangeModes({ ...changeModes, admissionDate: val })}
                    >
                      <input
                        type="date"
                        value={newAdmissionDate}
                        onChange={(e) => setNewAdmissionDate(e.target.value)}
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Data de Aclamação */}
                    <FieldCard
                      label="Data de Aclamação"
                      icon={<Calendar className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.acclamationDateStatus === 'informada' ? '✓ Data Informada' : 'Não Informada'}
                      statusColor={maskedDetails.acclamationDateStatus === 'informada' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}
                      isEditing={changeModes.acclamationDate}
                      onToggle={(val) => setChangeModes({ ...changeModes, acclamationDate: val })}
                    >
                      <input
                        type="date"
                        value={newAcclamationDate}
                        onChange={(e) => setNewAcclamationDate(e.target.value)}
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>

                    {/* Data de Proclamação */}
                    <FieldCard
                      label="Data de Proclamação"
                      icon={<Calendar className="w-4 h-4 text-slate-500" />}
                      currentDisplay={maskedDetails.proclamationDateStatus === 'informada' ? '✓ Data Informada' : 'Não Informada'}
                      statusColor={maskedDetails.proclamationDateStatus === 'informada' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}
                      isEditing={changeModes.proclamationDate}
                      onToggle={(val) => setChangeModes({ ...changeModes, proclamationDate: val })}
                    >
                      <input
                        type="date"
                        value={newProclamationDate}
                        onChange={(e) => setNewProclamationDate(e.target.value)}
                        className="w-full mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                      />
                    </FieldCard>
                  </div>
                </div>

                {/* Preenchimento por Terceiros */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={isThirdParty}
                      onChange={(e) => setIsThirdParty(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-800">
                        Estou preenchendo esta atualização em nome do membro (com sua autorização)
                      </span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Marque esta opção se você for secretário(a), presidente ou outro confrade/consócia auxiliando o membro.
                      </p>
                    </div>
                  </label>

                  {isThirdParty && (
                    <div className="mt-3 pl-7">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nome do Responsável pelo Preenchimento <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={representativeName}
                        onChange={(e) => setRepresentativeName(e.target.value)}
                        placeholder="Informe seu nome completo..."
                        required={isThirdParty}
                        className="w-full max-w-md px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {/* Termo de Consentimento */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed border border-slate-200">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{structure.termTitle}</span>
                    </div>
                    <p>{structure.termText}</p>
                    <span className="block mt-1 text-[10px] text-slate-400">
                      Versão do Termo: {structure.termVersion}
                    </span>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      id="checkbox-update-consent"
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => setConsentAccepted(e.target.checked)}
                      required
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed font-medium">
                      Declaro que as informações fornecidas são verídicas e concordo com o tratamento dos dados para fins administrativos da SSVP. <span className="text-rose-500">*</span>
                    </span>
                  </label>
                </div>

                {/* Botão de Submissão */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isSubmitting || !consentAccepted || activeChangesCount === 0}
                    className="w-full py-3.5 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Enviando solicitação...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Enviar Solicitação de Atualização ({activeChangesCount} alteração{activeChangesCount !== 1 ? 'ões' : ''})</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-2">
                    A solicitação será enviada para a fila de moderação do {structure.centralName}.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
};

// Componente Auxiliar para cada Campo Modificável ("Manter" vs "Informar Novo")
interface FieldCardProps {
  label: string;
  icon: React.ReactNode;
  currentDisplay: string;
  statusColor?: string;
  isEditing: boolean;
  onToggle: (editing: boolean) => void;
  children: React.ReactNode;
}

const FieldCard: React.FC<FieldCardProps> = ({
  label,
  icon,
  currentDisplay,
  statusColor = 'text-slate-700',
  isEditing,
  onToggle,
  children,
}) => {
  return (
    <div className={`p-3.5 rounded-2xl border transition-all ${isEditing ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200' : 'bg-slate-50/60 border-slate-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-bold text-slate-800">{label}</span>
        </div>

        {/* Toggle Manter / Novo */}
        <div className="inline-flex rounded-lg bg-slate-200/80 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={`px-2 py-0.5 rounded-md transition ${!isEditing ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Manter
          </button>
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={`px-2 py-0.5 rounded-md transition ${isEditing ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Alterar
          </button>
        </div>
      </div>

      {!isEditing ? (
        <div className="text-xs text-slate-500 py-1 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Valor Atual:</span>
          <span className={`text-xs ${statusColor}`}>{currentDisplay}</span>
        </div>
      ) : (
        <div className="pt-1">{children}</div>
      )}
    </div>
  );
};

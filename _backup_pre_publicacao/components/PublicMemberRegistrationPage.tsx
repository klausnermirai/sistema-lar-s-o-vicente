import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  ShieldCheck,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  RefreshCw,
  FileText,
  User,
  HeartHandshake,
  Edit3
} from 'lucide-react';
import { PublicHierarchyStructureResponse, PublicMemberSubmissionPayload } from '../types';
import { fetchPublicHierarchyStructure, submitPublicMemberRegistrationForm } from '../lib/hierarchy_api';
import { PublicMemberUpdateTab } from './PublicMemberUpdateTab';
import { DateInputWithPicker } from './DateInputWithPicker';

interface PublicMemberRegistrationPageProps {
  token: string;
}

export const PublicMemberRegistrationPage: React.FC<PublicMemberRegistrationPageProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'novo_cadastro' | 'complementar_cadastro'>('novo_cadastro');
  const [loading, setLoading] = useState(true);
  const [structure, setStructure] = useState<PublicHierarchyStructureResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [selectedParticularId, setSelectedParticularId] = useState('');
  const [selectedConferenciaId, setSelectedConferenciaId] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'masculino' | 'feminino' | 'outro' | ''>('');
  const [cpf, setCpf] = useState('');
  const [profession, setProfession] = useState('');
  const [memberType, setMemberType] = useState<'confrade' | 'consocia' | 'auxiliar' | 'aspirante' | 'afastado'>('confrade');
  const [phone, setPhone] = useState('');
  const [phoneResidential, setPhoneResidential] = useState('');
  const [phoneCommercial, setPhoneCommercial] = useState('');
  const [email, setEmail] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [acclamationDate, setAcclamationDate] = useState('');
  const [proclamationDate, setProclamationDate] = useState('');
  const [isThirdPartySubmission, setIsThirdPartySubmission] = useState(false);
  const [representativeName, setRepresentativeName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Submission State
  const [requestId, setRequestId] = useState<string>(() => `req_${crypto.randomUUID()}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<
    'processado_automaticamente' | 'aguardando_revisao_duplicidade' | 'aguardando_aprovacao'
  >('processado_automaticamente');

  // Load structure on mount
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchPublicHierarchyStructure(token);
        if (isMounted) {
          setStructure(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err.message || 'Não foi possível carregar as informações do formulário.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (token) {
      load();
    } else {
      setLoading(false);
      setLoadError('Token de acesso ao formulário não fornecido na URL.');
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Reset conference selection when particular changes
  const handleParticularChange = (particularId: string) => {
    setSelectedParticularId(particularId);
    setSelectedConferenciaId('');
  };

  // Helper mask for Brazilian phone: (99) 99999-9999 or (99) 9999-9999
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  // Filtered active conferences for chosen CP
  const filteredConferencias = React.useMemo(() => {
    if (!structure || !selectedParticularId) return [];
    return structure.conferencias.filter((c) => c.particularId === selectedParticularId);
  }, [structure, selectedParticularId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors([]);

    // Client basic validations
    if (!selectedParticularId) {
      setFormError('Por favor, selecione o Conselho Particular ao qual você pertence.');
      return;
    }

    if (!selectedConferenciaId) {
      setFormError('Por favor, selecione a sua Conferência.');
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 3) {
      setFormError('Informe o nome completo do membro (mínimo de 3 caracteres).');
      return;
    }

    if (isThirdPartySubmission && (!representativeName.trim() || representativeName.trim().length < 3)) {
      setFormError('Informe o nome do responsável pelo preenchimento (mínimo de 3 caracteres).');
      return;
    }

    const digitsPhone = phone.replace(/\D/g, '');
    if (!digitsPhone || digitsPhone.length < 8) {
      setFormError('Informe um número de telefone com DDD válido.');
      return;
    }

    if (!birthDate || !birthDate.trim()) {
      setFormError('Informe a data de nascimento. Ela é necessária para criar o acesso ao sistema.');
      return;
    }

    if (!consentAccepted) {
      setFormError(
        isThirdPartySubmission
          ? 'É necessário declarar que possui autorização do membro para o fornecimento dos dados.'
          : 'É necessário declarar ciência e aceitar o termo de consentimento para prosseguir.'
      );
      return;
    }

    const payload: PublicMemberSubmissionPayload & { requestId?: string } = {
      particularId: selectedParticularId,
      conferenciaId: selectedConferenciaId,
      fullName: fullName.trim(),
      gender: gender || undefined,
      cpf: cpf.trim() || undefined,
      profession: profession.trim() || undefined,
      type: memberType,
      phone: phone.trim(),
      phoneResidential: phoneResidential.trim() || undefined,
      phoneCommercial: phoneCommercial.trim() || undefined,
      email: email.trim() || undefined,
      addressZip: addressZip.trim() || undefined,
      addressStreet: addressStreet.trim() || undefined,
      addressNumber: addressNumber.trim() || undefined,
      addressComplement: addressComplement.trim() || undefined,
      addressNeighborhood: addressNeighborhood.trim() || undefined,
      addressCity: addressCity.trim() || undefined,
      addressState: addressState.trim() || undefined,
      birthDate: birthDate || undefined,
      admissionDate: admissionDate || undefined,
      acclamationDate: acclamationDate || undefined,
      proclamationDate: proclamationDate || undefined,
      consentAccepted: true,
      termVersion: structure?.termVersion,
      isThirdPartySubmission: isThirdPartySubmission || undefined,
      representativeName: isThirdPartySubmission ? representativeName.trim() : undefined,
      requestId,
    };

    setIsSubmitting(true);
    try {
      const response = await submitPublicMemberRegistrationForm(token, payload);
      setIsSuccess(true);
      const statusReceived = response.data?.status || response.status || 'processado_automaticamente';
      setSubmissionStatus(statusReceived);

      if (statusReceived === 'processado_automaticamente') {
        setSuccessMessage(
          response.message || 'Cadastro realizado com sucesso! O membro já foi cadastrado e está ativo na Conferência.'
        );
      } else if (statusReceived === 'aguardando_revisao_duplicidade') {
        setSuccessMessage(
          response.message || 'Cadastro recebido com sucesso! Identificamos um registro similar e a solicitação aguarda revisão da diretoria do Conselho Central.'
        );
      } else {
        setSuccessMessage(
          response.message || 'Cadastro enviado com sucesso! Seus dados estão em análise pelo Conselho Central.'
        );
      }
      // Rola para o topo suavemente
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(err.message || 'Erro ao enviar o formulário. Por favor, tente novamente.');
      if (err.data?.errors && Array.isArray(err.data.errors)) {
        setFieldErrors(err.data.errors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSubmissionForSameConferencia = () => {
    setIsSuccess(false);
    // Renova o requestId somente para novo cadastro
    setRequestId(`req_${crypto.randomUUID()}`);
    // Limpa todos os dados pessoais, endereço e datas do membro anterior
    setFullName('');
    setGender('');
    setCpf('');
    setProfession('');
    setMemberType('confrade');
    setPhone('');
    setPhoneResidential('');
    setPhoneCommercial('');
    setEmail('');
    setAddressZip('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressComplement('');
    setAddressNeighborhood('');
    setAddressCity('');
    setAddressState('');
    setBirthDate('');
    setAdmissionDate('');
    setAcclamationDate('');
    setProclamationDate('');
    // Desmarca obrigatoriamente o consentimento
    setConsentAccepted(false);
    // Mantém selecionados o Conselho Particular e a Conferência (selectedParticularId, selectedConferenciaId)
    // Mantém o preenchedor / responsável para agilizar cadastros em lote caso continue preenchendo
    setFormError(null);
    setFieldErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render: Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-slate-200 text-center">
          <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Carregando Formulário...</h2>
          <p className="text-sm text-slate-500">
            Aguarde um momento enquanto preparamos o formulário de cadastro vicentino.
          </p>
        </div>
      </div>
    );
  }

  // Render: Error State (Invalid/Revoked Token)
  if (loadError || !structure) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-rose-200 text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Formulário Indisponível</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {loadError || 'O link acessado é inválido ou foi revogado pelo Conselho Central.'}
          </p>
          <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 border border-slate-200 text-left">
            <p className="font-semibold text-slate-700 mb-1">Dúvidas?</p>
            <p>Entre em contato com a diretoria do seu Conselho Central para solicitar um novo link de cadastro.</p>
          </div>
        </div>
      </div>
    );
  }

  // Render: Success Screen
  if (isSuccess) {
    const selectedParticularName =
      structure.conselhosParticulares.find((p) => p.id === selectedParticularId)?.name || '';
    const selectedConferenciaName =
      structure.conferencias.find((c) => c.id === selectedConferenciaId)?.name || '';

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          {/* Header Banner */}
          <div className="bg-emerald-700 text-white p-6 rounded-t-2xl text-center shadow-sm">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              {submissionStatus === 'processado_automaticamente'
                ? 'Membro Cadastrado com Sucesso!'
                : 'Solicitação Enviada!'}
            </h1>
            <p className="text-emerald-100 text-sm mt-1">Sociedade de São Vicente de Paulo</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-b-2xl shadow-sm border border-slate-200 border-t-0">
            <div
              className={`border rounded-xl p-4 mb-6 ${
                submissionStatus === 'processado_automaticamente'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <p className="font-medium text-sm leading-relaxed text-center">
                {successMessage}
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resumo do Envio</h3>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Membro:</span>
                  <span className="font-semibold text-slate-800">{fullName}</span>
                </div>
                {isThirdPartySubmission && representativeName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Preenchido por:</span>
                    <span className="font-medium text-slate-700">{representativeName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Classificação:</span>
                  <span className="font-medium text-slate-700 capitalize">{memberType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conselho Central:</span>
                  <span className="font-medium text-slate-700">{structure.centralName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conselho Particular:</span>
                  <span className="font-medium text-slate-700">{selectedParticularName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conferência:</span>
                  <span className="font-medium text-slate-700">{selectedConferenciaName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  {submissionStatus === 'processado_automaticamente' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      Processado automaticamente (Ativo)
                    </span>
                  ) : submissionStatus === 'aguardando_revisao_duplicidade' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Aguardando revisão de duplicidade
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Aguardando aprovação
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800 mb-1">Próximos Passos:</p>
              {submissionStatus === 'processado_automaticamente' ? (
                <p>
                  O cadastro foi concluído imediatamente. O membro já está devidamente registrado e ativo na Conferência informada, pronto para as atividades vicentinas.
                </p>
              ) : (
                <p>
                  A diretoria do Conselho Central revisará as informações fornecidas. Assim que concluída a revisão, o vínculo do membro com a Conferência será efetivado oficialmente no sistema.
                </p>
              )}
            </div>

            {/* Somente o botão: "Novo cadastro para esta Conferência" */}
            <button
              id="btn-new-registration-same-conf"
              type="button"
              onClick={handleNewSubmissionForSameConferencia}
              className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo cadastro para esta Conferência</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render: Main Form Screen
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header Institucional */}
        <header className="bg-emerald-800 text-white rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <HeartHandshake className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold block">
                Sociedade de São Vicente de Paulo
              </span>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Autocadastro de Membros</h1>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-emerald-700/60 flex items-center gap-2 text-emerald-100 text-xs sm:text-sm">
            <Building2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>
              Vinculado ao <strong className="text-white">{structure.centralName}</strong>
            </span>
          </div>
        </header>

        {/* Navegação de Abas do Formulário */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs mb-6 flex gap-1">
          <button
            type="button"
            id="tab-novo-cadastro"
            onClick={() => setActiveTab('novo_cadastro')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'novo_cadastro'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Primeiro Cadastro</span>
          </button>
          <button
            type="button"
            id="tab-complementar-cadastro"
            onClick={() => setActiveTab('complementar_cadastro')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'complementar_cadastro'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Complementar Dados / Datas</span>
          </button>
        </div>

        {activeTab === 'complementar_cadastro' ? (
          <PublicMemberUpdateTab
            token={token}
            structure={structure}
            initialParticularId={selectedParticularId}
            initialConferenciaId={selectedConferenciaId}
          />
        ) : (
          <>
            {/* Error Alert */}
            {formError && (
              <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-sm text-rose-800">
                  <p className="font-semibold">{formError}</p>
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1 list-disc list-inside text-xs space-y-0.5 text-rose-700">
                      {fieldErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
              <p className="text-xs text-rose-600 font-medium">* Campos obrigatórios</p>
          
          {/* Seção 1: Vínculo Hierárquico */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">1. Onde você atua na SSVP?</h2>
            </div>

            <div className="space-y-4">
              {/* Conselho Particular */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Conselho Particular <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedParticularId}
                  onChange={(e) => handleParticularChange(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                >
                  <option value="">-- Selecione seu Conselho Particular --</option>
                  {structure.conselhosParticulares.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>
                {structure.conselhosParticulares.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum Conselho Particular ativo encontrado neste Conselho Central.
                  </p>
                )}
              </div>

              {/* Conferência */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Conferência <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedConferenciaId}
                  onChange={(e) => setSelectedConferenciaId(e.target.value)}
                  disabled={!selectedParticularId}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedParticularId
                      ? '-- Selecione primeiro o Conselho Particular acima --'
                      : filteredConferencias.length === 0
                      ? '-- Nenhuma Conferência ativa vinculada a este CP --'
                      : '-- Selecione a sua Conferência --'}
                  </option>
                  {filteredConferencias.map((conf) => (
                    <option key={conf.id} value={conf.id}>
                      {conf.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seção 2: Dados Pessoais e Vicentinos */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <User className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">2. Dados Pessoais do Membro</h2>
            </div>

            <div className="space-y-4">
              {/* Opção: Preenchimento por terceiros / responsável */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    id="checkbox-third-party"
                    type="checkbox"
                    checked={isThirdPartySubmission}
                    onChange={(e) => {
                      setIsThirdPartySubmission(e.target.checked);
                      if (!e.target.checked) {
                        setRepresentativeName('');
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold text-slate-800">Estou preenchendo para outra pessoa</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Marque esta opção caso esteja realizando o preenchimento em nome de outro membro da Conferência.
                    </p>
                  </div>
                </label>

                {isThirdPartySubmission && (
                  <div className="pt-2 border-t border-slate-200/70">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nome do Responsável pelo Preenchimento <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-representative-name"
                      type="text"
                      value={representativeName}
                      onChange={(e) => setRepresentativeName(e.target.value)}
                      placeholder="Informe seu nome completo (responsável)"
                      required={isThirdPartySubmission}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Nome Completo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nome Completo do Membro <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Antônio Frederico Ozanam"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                />
              </div>

              {/* Sexo, CPF e Profissão (Opcionais) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sexo / Gênero <span className="text-xs font-normal text-slate-400">(opcional)</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition bg-white"
                  >
                    <option value="">Selecione...</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF <span className="text-xs font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Profissão <span className="text-xs font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="Ex: Professor, Comerciante..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Classificação Vicentina */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Classificação na SSVP <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[
                    { id: 'confrade', label: 'Confrade' },
                    { id: 'consocia', label: 'Consócia' },
                    { id: 'aspirante', label: 'Aspirante' },
                    { id: 'afastado', label: 'Afastado' },
                    { id: 'auxiliar', label: 'Auxiliar' },
                  ].map((item) => {
                    const isSelected = memberType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMemberType(item.id as any)}
                        className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-medium transition text-center ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Telefone Celular / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="(00) 00000-0000"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    E-mail <span className="text-xs font-normal text-slate-400">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Telefones Opcionais: Residencial e Comercial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Telefone Residencial <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneResidential}
                    onChange={(e) => setPhoneResidential(formatPhone(e.target.value))}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Telefone Comercial <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phoneCommercial}
                    onChange={(e) => setPhoneCommercial(formatPhone(e.target.value))}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Endereço Residencial (Opcional) */}
              <div className="pt-2">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Endereço Residencial (Opcional)
                </span>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">CEP</label>
                      <input
                        type="text"
                        value={addressZip}
                        onChange={(e) => setAddressZip(formatZip(e.target.value))}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Logradouro / Rua</label>
                      <input
                        type="text"
                        value={addressStreet}
                        onChange={(e) => setAddressStreet(e.target.value)}
                        placeholder="Ex: Rua das Flores"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Número</label>
                      <input
                        type="text"
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        placeholder="Ex: 123"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Complemento</label>
                      <input
                        type="text"
                        value={addressComplement}
                        onChange={(e) => setAddressComplement(e.target.value)}
                        placeholder="Ex: Apto 101, Bloco B"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={addressNeighborhood}
                        onChange={(e) => setAddressNeighborhood(e.target.value)}
                        placeholder="Ex: Centro"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={addressCity}
                        onChange={(e) => setAddressCity(e.target.value)}
                        placeholder="Ex: Belo Horizonte"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Estado (UF)</label>
                      <input
                        type="text"
                        value={addressState}
                        onChange={(e) => setAddressState(e.target.value.toUpperCase().substring(0, 2))}
                        placeholder="UF"
                        maxLength={2}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition uppercase placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Datas de Cadastro e Histórico Vicentino */}
              <div className="pt-2">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Datas de Cadastro e Histórico Vicentino
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DateInputWithPicker
                    id="input-birth-date"
                    label="Data de Nascimento"
                    value={birthDate}
                    onChange={setBirthDate}
                    required={true}
                    allowFutureDates={false}
                    helpText="Obrigatória para criar o seu acesso ao sistema. Digite somente os números (Ex: 21081984)."
                  />

                  <DateInputWithPicker
                    id="input-admission-date"
                    label="Data de Ingresso na SSVP (Opcional)"
                    value={admissionDate}
                    onChange={setAdmissionDate}
                    allowFutureDates={false}
                    helpText="Digite somente os números. Exemplo: 15032010"
                  />

                  <DateInputWithPicker
                    id="input-acclamation-date"
                    label="Data de Aclamação (Opcional)"
                    value={acclamationDate}
                    onChange={setAcclamationDate}
                    allowFutureDates={false}
                    helpText="Digite somente os números. Exemplo: 10052015"
                  />

                  <DateInputWithPicker
                    id="input-proclamation-date"
                    label="Data de Proclamação (Opcional)"
                    value={proclamationDate}
                    onChange={setProclamationDate}
                    allowFutureDates={false}
                    helpText="Digite somente os números. Exemplo: 20112020"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Seção 3: Termo de Consentimento e Privacidade */}
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">3. Termo de Consentimento</h2>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed mb-4">
              <p className="font-semibold text-slate-800 mb-1.5">{structure.termTitle}</p>
              <p>
                {isThirdPartySubmission
                  ? 'Declaro que possuo autorização expressa do(a) membro(a) cadastrado(a) para fornecer seus dados pessoais à Sociedade de São Vicente de Paulo (SSVP) e concordo com o armazenamento e tratamento dos dados exclusivamente para finalidades administrativas e cadastrais, em conformidade com as diretrizes da LGPD.'
                  : structure.termText}
              </p>
              <span className="block mt-2 text-[10px] text-slate-400">
                Versão do Termo: {structure.termVersion}
              </span>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group select-none">
              <input
                id="checkbox-consent"
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                required
                className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-700 group-hover:text-slate-900 leading-relaxed font-medium">
                {isThirdPartySubmission ? (
                  <>
                    Declaro que possuo autorização do(a) membro(a) para fornecer estes dados e concordo com os termos de privacidade da SSVP. <span className="text-rose-500">*</span>
                  </>
                ) : (
                  <>
                    Li e concordo com o armazenamento e tratamento dos meus dados cadastrais para fins administrativos da
                    SSVP. <span className="text-rose-500">*</span>
                  </>
                )}
              </span>
            </label>
          </div>

          {/* Botão de Envio */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || !consentAccepted}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm sm:text-base transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Enviando solicitação...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Enviar Cadastro para Aprovação</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-2.5">
              Seu cadastro será enviado para a fila de moderação do {structure.centralName}.
            </p>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
};

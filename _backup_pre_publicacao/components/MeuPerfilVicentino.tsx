import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Award, 
  Briefcase, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  X, 
  ShieldCheck, 
  Building2, 
  UserCheck,
  Sparkles
} from 'lucide-react';
import { MembroSSVP } from '../types';
import { DateInputWithPicker } from './DateInputWithPicker';
import { apiFetch, getAuthHeaders } from '../lib/api';

export interface PerfilMembroData {
  membro: MembroSSVP;
  conferenciaNome: string;
  particularNome: string;
  username?: string;
}

interface MeuPerfilVicentinoProps {
  conferenciaNomeDefault?: string;
  particularNomeDefault?: string;
  usernameDefault?: string;
  onProfileLoaded?: (data: PerfilMembroData) => void;
}

export const MeuPerfilVicentino: React.FC<MeuPerfilVicentinoProps> = ({
  conferenciaNomeDefault,
  particularNomeDefault,
  usernameDefault,
  onProfileLoaded,
}) => {
  const [profileData, setProfileData] = useState<PerfilMembroData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Estado de Edição
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<{
    phone: string;
    phoneResidential: string;
    phoneCommercial: string;
    email: string;
    profession: string;
    addressStreet: string;
    addressNumber: string;
    addressComplement: string;
    addressNeighborhood: string;
    addressCity: string;
    addressState: string;
    addressZip: string;
    birthDate: string;
    admissionDate: string;
    acclamationDate: string;
    proclamationDate: string;
  }>({
    phone: '',
    phoneResidential: '',
    phoneCommercial: '',
    email: '',
    profession: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    birthDate: '',
    admissionDate: '',
    acclamationDate: '',
    proclamationDate: '',
  });

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await apiFetch('/api/me/perfil-membro', {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Não foi possível carregar os dados do perfil.');
      }
      const data: PerfilMembroData = await res.json();
      setProfileData(data);
      populateFormData(data.membro);
      if (onProfileLoaded) {
        onProfileLoaded(data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar perfil:', err);
      setErrorMessage(err.message || 'Erro de conexão ao carregar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const populateFormData = (membro: MembroSSVP) => {
    setFormData({
      phone: membro.phone || '',
      phoneResidential: membro.phoneResidential || '',
      phoneCommercial: membro.phoneCommercial || '',
      email: membro.email || '',
      profession: membro.profession || '',
      addressStreet: membro.addressStreet || '',
      addressNumber: membro.addressNumber || '',
      addressComplement: membro.addressComplement || '',
      addressNeighborhood: membro.addressNeighborhood || '',
      addressCity: membro.addressCity || '',
      addressState: membro.addressState || '',
      addressZip: membro.addressZip || '',
      birthDate: membro.birthDate || '',
      admissionDate: membro.admissionDate || '',
      acclamationDate: membro.acclamationDate || '',
      proclamationDate: membro.proclamationDate || '',
    });
  };

  const handleStartEditing = () => {
    if (profileData) {
      populateFormData(profileData.membro);
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (profileData) {
      populateFormData(profileData.membro);
    }
    setIsEditing(false);
    setErrorMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await apiFetch('/api/me/perfil-membro', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao atualizar dados pessoais.');
      }

      // Atualizar dados exibidos em memória
      if (profileData) {
        const updatedData = {
          ...profileData,
          membro: json.data,
        };
        setProfileData(updatedData);
        if (onProfileLoaded) {
          onProfileLoaded(updatedData);
        }
      }

      setIsEditing(false);
      setSuccessMessage('Seus dados pessoais foram atualizados com sucesso!');
      
      // Auto-ocultar mensagem de sucesso após 4 segundos
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Erro ao salvar perfil:', err);
      setErrorMessage(err.message || 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return 'Não informado';
    const clean = dateStr.trim();
    if (!clean) return 'Não informado';
    
    // YYYY-MM-DD
    const matchIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      const [, y, m, d] = matchIso;
      return `${d}/${m}/${y}`;
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      return clean;
    }
    return clean;
  };

  const renderFieldOrFallback = (val?: string | null) => {
    if (!val || val.trim() === '') {
      return <span className="text-slate-400 italic">Não informado</span>;
    }
    return <span className="text-slate-900 font-medium">{val}</span>;
  };

  const membro = profileData?.membro;
  const confNome = profileData?.conferenciaNome || conferenciaNomeDefault || 'Conferência Vinculada';
  const partNome = profileData?.particularNome || particularNomeDefault || 'Conselho Particular Vinculado';
  const username = profileData?.username || usernameDefault || 'vicentino';

  const formatClassification = (type?: string) => {
    switch (type) {
      case 'confrade': return 'Confrade (Membro Efetivo)';
      case 'consocia': return 'Consócia (Membro Efetivo)';
      case 'vicentino': return 'Vicentino(a)';
      case 'aspirante': return 'Aspirante';
      case 'auxiliar': return 'Membro Auxiliar';
      case 'afastado': return 'Afastado(a)';
      default: return type ? type.toUpperCase() : 'Não informado';
    }
  };

  const formatStatus = (status?: string) => {
    switch (status) {
      case 'ativo': return { label: 'Ativo', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'inativo': return { label: 'Inativo', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'afastado': return { label: 'Afastado', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      default: return { label: status || 'Ativo', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const fullAddressDisplay = useMemo(() => {
    if (!membro) return 'Não informado';
    if (membro.fullAddress && membro.fullAddress.trim()) {
      return membro.fullAddress;
    }
    const parts = [
      membro.addressStreet ? `${membro.addressStreet}${membro.addressNumber ? ', ' + membro.addressNumber : ''}` : '',
      membro.addressComplement,
      membro.addressNeighborhood ? `Bairro: ${membro.addressNeighborhood}` : '',
      membro.addressCity ? `${membro.addressCity}${membro.addressState ? ' - ' + membro.addressState : ''}` : '',
      membro.addressZip ? `CEP: ${membro.addressZip}` : ''
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(' - ') : 'Não informado';
  }, [membro]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-[#0b4d8c] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Carregando sua ficha cadastral...</p>
      </div>
    );
  }

  const statusInfo = formatStatus(membro?.status);

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODO VISUALIZAÇÃO DA FICHA COMPLETA */}
      {!isEditing && (
        <div className="space-y-4">
          {/* Card Principal de Identificação */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#0b4d8c] flex items-center justify-center font-bold text-2xl shadow-inner">
                  {membro?.fullName ? membro.fullName.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {membro?.fullName || username}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs font-semibold text-[#0b4d8c] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                      {formatClassification(membro?.type)}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.badgeClass}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão de Edição Principal */}
            <div className="pt-2">
              <button
                onClick={handleStartEditing}
                className="w-full py-3 px-4 bg-[#0b4d8c] hover:bg-[#093d70] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Editar meus dados
              </button>
            </div>
          </div>

          {/* Bloco 1: Informações de Contato e Endereço */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Phone className="w-3.5 h-3.5 text-[#0b4d8c]" />
              Contato e Localização
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Celular / WhatsApp</span>
                {renderFieldOrFallback(membro?.phone)}
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">E-mail</span>
                {renderFieldOrFallback(membro?.email)}
              </div>

              {membro?.phoneResidential && (
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 block">Telefone Residencial</span>
                  {renderFieldOrFallback(membro.phoneResidential)}
                </div>
              )}

              {membro?.phoneCommercial && (
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 block">Telefone Comercial</span>
                  {renderFieldOrFallback(membro.phoneCommercial)}
                </div>
              )}

              <div className="sm:col-span-2 space-y-0.5 pt-1">
                <span className="text-[11px] font-medium text-slate-500 block">Endereço Completo</span>
                <div className="text-slate-900 font-medium text-xs leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {fullAddressDisplay === 'Não informado' ? (
                    <span className="text-slate-400 italic">Não informado</span>
                  ) : (
                    fullAddressDisplay
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bloco 2: Dados Pessoais e Trajetória Vicentina */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Award className="w-3.5 h-3.5 text-[#0b4d8c]" />
              Trajetória e Datas Vicentinas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Data de Nascimento</span>
                <span className="text-slate-900 font-medium">{formatDateDisplay(membro?.birthDate)}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Profissão / Ocupação</span>
                {renderFieldOrFallback(membro?.profession)}
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Data de Ingresso na SSVP</span>
                <span className="text-slate-900 font-medium">{formatDateDisplay(membro?.admissionDate)}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Data de Aclamação</span>
                <span className="text-slate-900 font-medium">{formatDateDisplay(membro?.acclamationDate)}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Data de Proclamação</span>
                <span className="text-slate-900 font-medium">{formatDateDisplay(membro?.proclamationDate)}</span>
              </div>
            </div>
          </div>

          {/* Bloco 3: Vínculo Institucional e Acesso (Somente Leitura) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Building2 className="w-3.5 h-3.5 text-[#0b4d8c]" />
              Vínculo Institucional e Acesso
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Conferência Vinculada</span>
                <span className="font-bold text-slate-900">{confNome}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Conselho Particular</span>
                <span className="font-medium text-slate-800">{partNome}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Situação Cadastral</span>
                <span className="font-medium text-slate-800 capitalize">{membro?.status || 'Ativo'}</span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] font-medium text-slate-500 block">Login no Sistema</span>
                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {username}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODO FORMULÁRIO DE EDIÇÃO */}
      {isEditing && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Meus Dados Pessoais</h3>
                <p className="text-xs text-slate-500">Mantenha suas informações de contato e ficha atualizadas</p>
              </div>
              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={isSaving}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso sobre campos administrativos */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0b4d8c]" />
                Campos Institucionais Protegidos
              </p>
              <p className="text-blue-800/80 leading-relaxed">
                Nome completo, Conferência, Conselho Particular e classificação vicentina são mantidos pela secretaria e diretoria.
              </p>
            </div>

            {/* Campos de Contato */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contato</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Celular / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu.email@exemplo.com"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Telefone Residencial (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.phoneResidential}
                    onChange={(e) => setFormData({ ...formData, phoneResidential: e.target.value })}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Telefone Comercial (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.phoneCommercial}
                    onChange={(e) => setFormData({ ...formData, phoneCommercial: e.target.value })}
                    placeholder="(00) 0000-0000"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Campos de Endereço */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Endereço Residencial</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Rua / Logradouro
                  </label>
                  <input
                    type="text"
                    value={formData.addressStreet}
                    onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                    placeholder="Ex: Rua das Flores"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={formData.addressNumber}
                    onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                    placeholder="Ex: 123"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={formData.addressComplement}
                    onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
                    placeholder="Ex: Apto 4, Bloco B"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={formData.addressNeighborhood}
                    onChange={(e) => setFormData({ ...formData, addressNeighborhood: e.target.value })}
                    placeholder="Ex: Centro"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={formData.addressZip}
                    onChange={(e) => setFormData({ ...formData, addressZip: e.target.value })}
                    placeholder="00000-000"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.addressCity}
                    onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                    placeholder="Ex: Jaboticabal"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.addressState}
                    onChange={(e) => setFormData({ ...formData, addressState: e.target.value.toUpperCase() })}
                    placeholder="SP"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Informações Pessoais e Datas Vicentinas com Componente Unificado */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dados Pessoais e Datas</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Profissão / Ocupação
                  </label>
                  <input
                    type="text"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    placeholder="Ex: Aposentado(a), Professor(a)"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b4d8c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <DateInputWithPicker
                    label="Data de Nascimento"
                    value={formData.birthDate}
                    onChange={(val) => setFormData({ ...formData, birthDate: val })}
                    allowFutureDates={false}
                  />
                </div>

                <div>
                  <DateInputWithPicker
                    label="Data de Ingresso na SSVP"
                    value={formData.admissionDate}
                    onChange={(val) => setFormData({ ...formData, admissionDate: val })}
                    allowFutureDates={false}
                  />
                </div>

                <div>
                  <DateInputWithPicker
                    label="Data de Aclamação"
                    value={formData.acclamationDate}
                    onChange={(val) => setFormData({ ...formData, acclamationDate: val })}
                    allowFutureDates={false}
                  />
                </div>

                <div>
                  <DateInputWithPicker
                    label="Data de Proclamação"
                    value={formData.proclamationDate}
                    onChange={(val) => setFormData({ ...formData, proclamationDate: val })}
                    allowFutureDates={false}
                  />
                </div>
              </div>
            </div>

            {/* Botões de Ação do Formulário */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando alterações...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar alterações
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={isSaving}
                className="w-full sm:w-auto py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

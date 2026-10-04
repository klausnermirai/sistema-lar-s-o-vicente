import React, { useState, useEffect } from 'react';
import { Home, Users, Calendar, Phone, Plus, Trash2, Save, FileText, Building2, History, RefreshCw, X } from 'lucide-react';
import { saveSettings } from '../lib/api';
import { InstitutionSettings, AppRoute } from '../types';

interface CentralCouncilModuleProps {
  activeRoute: AppRoute;
  settings: InstitutionSettings | null;
  onSettingsChange: (settings: InstitutionSettings) => void;
  institutionId: string;
}

interface CustomRole {
  id: string;
  roleName: string;
  name: string;
  phone: string;
}

export const CentralCouncilModule: React.FC<CentralCouncilModuleProps> = ({
  activeRoute,
  settings,
  onSettingsChange,
  institutionId,
}) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // General info state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [foundationDate, setFoundationDate] = useState('');

  // Board details state
  const [posseDate, setPosseDate] = useState('');
  const [mandateEndDate, setMandateEndDate] = useState('');

  // Official roles state
  const [presidenteName, setPresidenteName] = useState('');
  const [presidentePhone, setPresidentePhone] = useState('');

  const [vice1Name, setVice1Name] = useState('');
  const [vice1Phone, setVice1Phone] = useState('');

  const [vice2Name, setVice2Name] = useState('');
  const [vice2Phone, setVice2Phone] = useState('');

  const [tesoureiro1Name, setTesoureiro1Name] = useState('');
  const [tesoureiro1Phone, setTesoureiro1Phone] = useState('');

  const [tesoureiro2Name, setTesoureiro2Name] = useState('');
  const [tesoureiro2Phone, setTesoureiro2Phone] = useState('');

  const [secretario1Name, setSecretario1Name] = useState('');
  const [secretario1Phone, setSecretario1Phone] = useState('');

  const [secretario2Name, setSecretario2Name] = useState('');
  const [secretario2Phone, setSecretario2Phone] = useState('');

  const [comunicacaoName, setComunicacaoName] = useState('');
  const [comunicacaoPhone, setComunicacaoPhone] = useState('');

  const [coordenadorJovensName, setCoordenadorJovensName] = useState('');
  const [coordenadorJovensPhone, setCoordenadorJovensPhone] = useState('');

  const [coordenadorCriancasName, setCoordenadorCriancasName] = useState('');
  const [coordenadorCriancasPhone, setCoordenadorCriancasPhone] = useState('');

  const [ecafoName, setEcafoName] = useState('');
  const [ecafoPhone, setEcafoPhone] = useState('');

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePersonName, setNewRolePersonName] = useState('');
  const [newRolePhone, setNewRolePhone] = useState('');
  const [showAddCustomRole, setShowAddCustomRole] = useState(false);

  // Mandate history and transition states
  const [mandateHistory, setMandateHistory] = useState<any[]>([]);
  const [showTransitionForm, setShowTransitionForm] = useState(false);
  const [newMandatePosseDate, setNewMandatePosseDate] = useState('');
  const [newMandateEndDate, setNewMandateEndDate] = useState('');
  const [keepCurrentAsDraft, setKeepCurrentAsDraft] = useState(true);
  const [selectedPastMandate, setSelectedPastMandate] = useState<any | null>(null);

  // Sync state with settings prop
  useEffect(() => {
    if (settings) {
      setName(settings.name || '');
      setAddress((settings as any).address || '');
      setCnpj(settings.cnpj || '');
      setFoundationDate((settings as any).foundationDate || '');

      const board = (settings as any).centralBoard || {};
      setPosseDate(board.posseDate || '');
      setMandateEndDate(board.mandateEndDate || '');

      setPresidenteName(board.presidenteName || '');
      setPresidentePhone(board.presidentePhone || '');

      setVice1Name(board.vice1Name || '');
      setVice1Phone(board.vice1Phone || '');

      setVice2Name(board.vice2Name || '');
      setVice2Phone(board.vice2Phone || '');

      setTesoureiro1Name(board.tesoureiro1Name || '');
      setTesoureiro1Phone(board.tesoureiro1Phone || '');

      setTesoureiro2Name(board.tesoureiro2Name || '');
      setTesoureiro2Phone(board.tesoureiro2Phone || '');

      setSecretario1Name(board.secretario1Name || '');
      setSecretario1Phone(board.secretario1Phone || '');

      setSecretario2Name(board.secretario2Name || '');
      setSecretario2Phone(board.secretario2Phone || '');

      setComunicacaoName(board.comunicacaoName || '');
      setComunicacaoPhone(board.comunicacaoPhone || '');

      setCoordenadorJovensName(board.coordenadorJovensName || '');
      setCoordenadorJovensPhone(board.coordenadorJovensPhone || '');

      setCoordenadorCriancasName(board.coordenadorCriancasName || '');
      setCoordenadorCriancasPhone(board.coordenadorCriancasPhone || '');

      setEcafoName(board.ecafoName || '');
      setEcafoPhone(board.ecafoPhone || '');

      setCustomRoles(board.customRoles || []);
      setMandateHistory(board.mandateHistory || []);
    }
  }, [settings]);

  const showFeedback = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setErrorMsg(null);
    } else {
      setErrorMsg(msg);
      setSuccessMsg(null);
    }
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 4500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showFeedback('O nome do conselho é obrigatório', 'error');
      return;
    }

    setLoading(true);
    try {
      const updatedSettings: any = {
        ...(settings || {}),
        name,
        cnpj,
        address,
        foundationDate,
        centralBoard: {
          posseDate,
          mandateEndDate,
          presidenteName,
          presidentePhone,
          vice1Name,
          vice1Phone,
          vice2Name,
          vice2Phone,
          tesoureiro1Name,
          tesoureiro1Phone,
          tesoureiro2Name,
          tesoureiro2Phone,
          secretario1Name,
          secretario1Phone,
          secretario2Name,
          secretario2Phone,
          comunicacaoName,
          comunicacaoPhone,
          coordenadorJovensName,
          coordenadorJovensPhone,
          coordenadorCriancasName,
          coordenadorCriancasPhone,
          ecafoName,
          ecafoPhone,
          customRoles,
          mandateHistory,
        }
      };

      await saveSettings(institutionId, updatedSettings);
      onSettingsChange(updatedSettings);
      showFeedback('Alterações salvas com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showFeedback('Erro ao salvar alterações: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomRole = () => {
    if (!newRoleName.trim() || !newRolePersonName.trim()) {
      showFeedback('Nome do cargo e nome do ocupante são obrigatórios', 'error');
      return;
    }

    const newRole: CustomRole = {
      id: Date.now().toString(),
      roleName: newRoleName.trim(),
      name: newRolePersonName.trim(),
      phone: newRolePhone.trim(),
    };

    setCustomRoles([...customRoles, newRole]);
    setNewRoleName('');
    setNewRolePersonName('');
    setNewRolePhone('');
    setShowAddCustomRole(false);
    showFeedback('Cargo personalizado adicionado!', 'success');
  };

  const handleRemoveCustomRole = (id: string) => {
    setCustomRoles(customRoles.filter(role => role.id !== id));
    showFeedback('Cargo personalizado removido. Lembre-se de salvar as alterações.', 'success');
  };

  const handlePerformTransition = () => {
    if (!newMandatePosseDate || !newMandateEndDate) {
      showFeedback('Por favor, preencha as datas de início e fim da nova gestão.', 'error');
      return;
    }

    const pastMandate: any = {
      id: Date.now().toString(),
      posseDate: posseDate || 'Não cadastrada',
      mandateEndDate: mandateEndDate || 'Não cadastrada',
      presidenteName,
      presidentePhone,
      vice1Name,
      vice1Phone,
      vice2Name,
      vice2Phone,
      tesoureiro1Name,
      tesoureiro1Phone,
      tesoureiro2Name,
      tesoureiro2Phone,
      secretario1Name,
      secretario1Phone,
      secretario2Name,
      secretario2Phone,
      comunicacaoName,
      comunicacaoPhone,
      coordenadorJovensName,
      coordenadorJovensPhone,
      coordenadorCriancasName,
      coordenadorCriancasPhone,
      ecafoName,
      ecafoPhone,
      customRoles: [...customRoles],
      archivedAt: new Date().toISOString()
    };

    const updatedHistory = [pastMandate, ...mandateHistory];
    setMandateHistory(updatedHistory);

    setPosseDate(newMandatePosseDate);
    setMandateEndDate(newMandateEndDate);

    if (!keepCurrentAsDraft) {
      setPresidenteName('');
      setPresidentePhone('');
      setVice1Name('');
      setVice1Phone('');
      setVice2Name('');
      setVice2Phone('');
      setTesoureiro1Name('');
      setTesoureiro1Phone('');
      setTesoureiro2Name('');
      setTesoureiro2Phone('');
      setSecretario1Name('');
      setSecretario1Phone('');
      setSecretario2Name('');
      setSecretario2Phone('');
      setComunicacaoName('');
      setComunicacaoPhone('');
      setCoordenadorJovensName('');
      setCoordenadorJovensPhone('');
      setCoordenadorCriancasName('');
      setCoordenadorCriancasPhone('');
      setEcafoName('');
      setEcafoPhone('');
      setCustomRoles([]);
    }

    setNewMandatePosseDate('');
    setNewMandateEndDate('');
    setShowTransitionForm(false);

    showFeedback('Diretoria anterior arquivada com sucesso! Ajuste os membros se necessário e clique em "Salvar Alterações".', 'success');
  };

  const handleDeletePastMandate = (id: string) => {
    if (!window.confirm('Tem certeza de que deseja remover este mandato do histórico? Esta ação é permanente.')) {
      return;
    }
    const updatedHistory = mandateHistory.filter(m => m.id !== id);
    setMandateHistory(updatedHistory);
    showFeedback('Mandato anterior removido do histórico temporariamente. Lembre-se de clicar em "Salvar Alterações".', 'success');
    if (selectedPastMandate && selectedPastMandate.id === id) {
      setSelectedPastMandate(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-6 space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Feedbacks */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-xs font-black uppercase tracking-wider flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-black uppercase tracking-wider flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          {errorMsg}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-[#004c99] border border-blue-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
            <Building2 size={12} />
            Conselho Central
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tighter">
            {name || 'Conselho Central'}
          </h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            Gestão Administrativa e Diretoria
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full sm:w-auto px-8 py-4 bg-[#004c99] hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
        >
          <Save size={16} />
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {activeRoute === AppRoute.CENTRAL_INFO && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                <Home size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                  Informações Gerais
                </h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase">
                  Dados de identificação e fundação do conselho
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  Nome do Conselho Central *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white shadow-sm"
                  placeholder="Nome por extenso do Conselho Central"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white shadow-sm"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  Endereço Sede
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white shadow-sm"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  Data da Fundação
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={foundationDate}
                    onChange={(e) => setFoundationDate(e.target.value)}
                    className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white shadow-sm appearance-none"
                  />
                  <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeRoute === AppRoute.CENTRAL_BOARD && (
          <div className="space-y-6">
            {/* Datas do Mandato */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                    Mandato da Diretoria
                  </h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Período eletivo da gestão atual
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    Data da Posse
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={posseDate}
                      onChange={(e) => setPosseDate(e.target.value)}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white shadow-sm"
                    />
                    <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    Fim do Mandato
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={mandateEndDate}
                      onChange={(e) => setMandateEndDate(e.target.value)}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white shadow-sm"
                    />
                    <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Ações de Transição de Mandato */}
            <div className="bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 shadow-sm space-y-6 border-l-4 border-l-orange-500">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                    <RefreshCw size={20} className={showTransitionForm ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                      Transição de Diretoria (Novo Mandato)
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Arquive instantaneamente os membros e datas atuais e configure o novo mandato
                    </p>
                  </div>
                </div>
                {!showTransitionForm && (
                  <button
                    type="button"
                    onClick={() => setShowTransitionForm(true)}
                    className="px-4 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-100"
                  >
                    <RefreshCw size={12} />
                    Nova Gestão
                  </button>
                )}
              </div>

              {showTransitionForm && (
                <div className="p-6 rounded-2xl bg-orange-50/35 border border-orange-150 space-y-6 animate-in slide-in-from-top duration-300">
                  <div className="flex justify-between items-center pb-3 border-b border-orange-100">
                    <h3 className="text-xs font-black uppercase text-orange-850 tracking-wider">
                      Configuração da Nova Diretoria
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowTransitionForm(false)}
                      className="p-1 text-gray-400 hover:text-gray-650 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <p className="text-[11px] font-bold text-gray-500 uppercase leading-relaxed">
                    Aviso: Ao confirmar, os membros atuais serão salvos permanentemente no histórico sob o mandato de <span className="text-gray-800 font-extrabold">{posseDate || 'Não informada'}</span> a <span className="text-gray-800 font-extrabold">{mandateEndDate || 'Não informada'}</span>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                        Início do Novo Mandato (Posse) *
                      </label>
                      <input
                        type="date"
                        value={newMandatePosseDate}
                        onChange={(e) => setNewMandatePosseDate(e.target.value)}
                        className="w-full px-4 py-3 border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 bg-white shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                        Fim do Novo Mandato Previsto *
                      </label>
                      <input
                        type="date"
                        value={newMandateEndDate}
                        onChange={(e) => setNewMandateEndDate(e.target.value)}
                        className="w-full px-4 py-3 border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 bg-white shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">
                      Opções dos Ocupantes dos Cargos:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-start gap-3 p-3 bg-white border border-orange-100 rounded-xl cursor-pointer">
                        <input
                          type="radio"
                          checked={keepCurrentAsDraft}
                          onChange={() => setKeepCurrentAsDraft(true)}
                          className="mt-0.5 text-orange-600 focus:ring-orange-500"
                        />
                        <div>
                          <span className="text-xs font-black text-gray-750 uppercase block">Manter ocupantes como rascunho</span>
                          <span className="text-[9px] text-gray-400 font-semibold uppercase">Os nomes continuarão preenchidos para você apenas editar as alterações necessárias.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 bg-white border border-orange-100 rounded-xl cursor-pointer">
                        <input
                          type="radio"
                          checked={!keepCurrentAsDraft}
                          onChange={() => setKeepCurrentAsDraft(false)}
                          className="mt-0.5 text-orange-600 focus:ring-orange-500"
                        />
                        <div>
                          <span className="text-xs font-black text-gray-750 uppercase block">Limpar todos os nomes</span>
                          <span className="text-[9px] text-gray-400 font-semibold uppercase">Zerar todos os nomes e telefones dos cargos para começar do absoluto zero.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end border-t border-orange-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowTransitionForm(false)}
                      className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-gray-150 text-gray-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handlePerformTransition}
                      className="px-6 py-2 bg-orange-600 hover:bg-orange-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-orange-100"
                    >
                      Confirmar e Iniciar Novo Mandato
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cargos Titulares */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                    Cargos Regulares / Estatutários
                  </h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Composição canônica do conselho central
                  </p>
                </div>
              </div>

              {/* Grid of Standard Roles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {[
                  { label: 'Presidente', nameVal: presidenteName, setName: setPresidenteName, phoneVal: presidentePhone, setPhone: setPresidentePhone },
                  { label: 'Vice-Presidente 1', nameVal: vice1Name, setName: setVice1Name, phoneVal: vice1Phone, setPhone: setVice1Phone },
                  { label: 'Vice-Presidente 2', nameVal: vice2Name, setName: setVice2Name, phoneVal: vice2Phone, setPhone: setVice2Phone },
                  { label: 'Primeiro Tesoureiro', nameVal: tesoureiro1Name, setName: setTesoureiro1Name, phoneVal: tesoureiro1Phone, setPhone: setTesoureiro1Phone },
                  { label: 'Segundo Tesoureiro', nameVal: tesoureiro2Name, setName: setTesoureiro2Name, phoneVal: tesoureiro2Phone, setPhone: setTesoureiro2Phone },
                  { label: 'Primeiro Secretário', nameVal: secretario1Name, setName: setSecretario1Name, phoneVal: secretario1Phone, setPhone: setSecretario1Phone },
                  { label: 'Segundo Secretário', nameVal: secretario2Name, setName: setSecretario2Name, phoneVal: secretario2Phone, setPhone: setSecretario2Phone },
                  { label: 'Depto. de Comunicação', nameVal: comunicacaoName, setName: setComunicacaoName, phoneVal: comunicacaoPhone, setPhone: setComunicacaoPhone },
                  { label: 'Coordenador de Jovens', nameVal: coordenadorJovensName, setName: setCoordenadorJovensName, phoneVal: coordenadorJovensPhone, setPhone: setCoordenadorJovensPhone },
                  { label: 'Coordenador de Crianças (CCA)', nameVal: coordenadorCriancasName, setName: setCoordenadorCriancasName, phoneVal: coordenadorCriancasPhone, setPhone: setCoordenadorCriancasPhone },
                  { label: 'ECAFO', nameVal: ecafoName, setName: setEcafoName, phoneVal: ecafoPhone, setPhone: setEcafoPhone },
                ].map((role, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 flex flex-col gap-4">
                    <div className="text-[11px] font-black uppercase text-[#004c99] tracking-wider pb-1 border-b border-dashed border-gray-200">
                      {role.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-400">Nome</span>
                        <input
                          type="text"
                          value={role.nameVal}
                          onChange={(e) => role.setName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-blue-200"
                          placeholder={`Nome do ${role.label}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase text-gray-400">Telefone</span>
                        <div className="relative">
                          <input
                            type="text"
                            value={role.phoneVal}
                            onChange={(e) => role.setPhone(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-blue-200"
                            placeholder="(00) 00000-0000"
                          />
                          <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cargos Personalizados */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                      Cargos Personalizados
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Adicione e remova outros cargos eleitos pela instituição
                    </p>
                  </div>
                </div>
                {!showAddCustomRole && (
                  <button
                    type="button"
                    onClick={() => setShowAddCustomRole(true)}
                    className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={14} />
                    Criar Cargo
                  </button>
                )}
              </div>

              {showAddCustomRole && (
                <div className="p-5 rounded-2xl bg-purple-50/40 border border-purple-100/70 space-y-4 animate-in slide-in-from-top duration-200">
                  <h3 className="text-xs font-black uppercase text-purple-800 tracking-wider">
                    Novo Cargo Personalizado
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Cargo</span>
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-purple-200"
                        placeholder="Ex: Assessor Espiritual, etc."
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Nome</span>
                      <input
                        type="text"
                        value={newRolePersonName}
                        onChange={(e) => setNewRolePersonName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-purple-200"
                        placeholder="Nome completo do ocupante"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Telefone</span>
                      <div className="relative">
                        <input
                          type="text"
                          value={newRolePhone}
                          onChange={(e) => setNewRolePhone(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-purple-200"
                          placeholder="(00) 00000-0000"
                        />
                        <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomRole(false)}
                      className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-gray-100 text-gray-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomRole}
                      className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[9px] font-black uppercase tracking-wider"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              {customRoles.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                  <Users className="mx-auto text-gray-200 mb-2" size={24} />
                  <p className="text-[10px] font-black uppercase text-gray-300 tracking-wider">
                    Nenhum cargo adicional criado
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {customRoles.map((role) => (
                    <div key={role.id} className="p-4 rounded-2xl bg-purple-50/10 border border-purple-100/50 flex flex-col gap-4 relative group">
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomRole(role.id)}
                        className="absolute right-3 top-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Remover Cargo"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="text-[11px] font-black uppercase text-purple-700 tracking-wider pb-1 border-b border-dashed border-purple-100 pr-8">
                        {role.roleName}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-gray-400">Nome</span>
                          <input
                            type="text"
                            value={role.name}
                            onChange={(e) => {
                              const updated = customRoles.map(cr => cr.id === role.id ? { ...cr, name: e.target.value } : cr);
                              setCustomRoles(updated);
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-purple-200"
                            placeholder="Nome para o cargo"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-gray-400">Telefone</span>
                          <div className="relative">
                            <input
                              type="text"
                              value={role.phone}
                              onChange={(e) => {
                                const updated = customRoles.map(cr => cr.id === role.id ? { ...cr, phone: e.target.value } : cr);
                                setCustomRoles(updated);
                              }}
                              className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-purple-200"
                              placeholder="(00) 00000-0000"
                            />
                            <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico de Mandatos Anteriores */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                    Histórico de Gestões e Mandatos Anteriores
                  </h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Consulte as antigas diretorias registradas
                  </p>
                </div>
              </div>

              {mandateHistory.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                  <History className="mx-auto text-gray-200 mb-2" size={24} />
                  <p className="text-[10px] font-black uppercase text-gray-300 tracking-wider">
                    Nenhum mandato arquivado ainda
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mandateHistory.map((m: any) => {
                    const isSelected = selectedPastMandate?.id === m.id;
                    const formatData = (dStr: string) => {
                      if (!dStr) return '-';
                      try {
                        const parts = dStr.split('-');
                        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                      } catch {}
                      return dStr;
                    };

                    return (
                      <div key={m.id} className="border border-gray-100 rounded-2xl overflow-hidden transition-all shadow-sm">
                        <div className="p-4 bg-gray-50/55 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-50">
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 text-gray-650 rounded text-[9px] font-black uppercase tracking-wider mb-1">
                              Mandato
                            </div>
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight">
                              Gestão: {formatData(m.posseDate)} a {formatData(m.mandateEndDate)}
                            </h4>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                              Presidente: {m.presidenteName || 'Não registrado'} {m.presidentePhone ? `(${m.presidentePhone})` : ''}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedPastMandate(isSelected ? null : m)}
                              className="px-4 py-2 border border-gray-200 rounded-xl text-[9px] font-black uppercase tracking-wider bg-white hover:bg-gray-50 text-gray-600 flex items-center gap-1 transition-all"
                            >
                              <FileText size={12} />
                              {isSelected ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePastMandate(m.id)}
                              className="p-2 border border-red-100 hover:border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-all bg-white"
                              title="Remover do Histórico"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="p-6 bg-white border-t border-gray-50 animate-in fade-in duration-200 space-y-4">
                            <h5 className="text-[10px] font-black uppercase text-[#004c99] tracking-wider pb-1 border-b border-dashed border-gray-100">
                              Membros da Diretoria na Gestão
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs font-semibold uppercase text-gray-650">
                              {[
                                { title: 'Presidente', name: m.presidenteName, phone: m.presidentePhone },
                                { title: 'Vice 1', name: m.vice1Name, phone: m.vice1Phone },
                                { title: 'Vice 2', name: m.vice2Name, phone: m.vice2Phone },
                                { title: 'Primeiro Tesoureiro', name: m.tesoureiro1Name, phone: m.tesoureiro1Phone },
                                { title: 'Segundo Tesoureiro', name: m.tesoureiro2Name, phone: m.tesoureiro2Phone },
                                { title: 'Primeiro Secretário', name: m.secretario1Name, phone: m.secretario1Phone },
                                { title: 'Segundo Secretário', name: m.secretario2Name, phone: m.secretario2Phone },
                                { title: 'Depto. Comunicação', name: m.comunicacaoName, phone: m.comunicacaoPhone },
                                { title: 'Coord. Jovens', name: m.coordenadorJovensName, phone: m.coordenadorJovensPhone },
                                { title: 'Coord. Crianças (CCA)', name: m.coordenadorCriancasName, phone: m.coordenadorCriancasPhone },
                                { title: 'ECAFO', name: m.ecafoName, phone: m.ecafoPhone },
                              ].map((role, rIdx) => {
                                if (!role.name) return null;
                                return (
                                  <div key={rIdx} className="p-2.5 rounded-xl bg-gray-50/50 border border-gray-100">
                                    <span className="text-[9px] font-black text-gray-400 block mb-0.5">{role.title}</span>
                                    <p className="text-[11px] font-black text-gray-800 tracking-tight">{role.name}</p>
                                    {role.phone && <p className="text-[10px] text-gray-400 mt-0.5 font-bold">{role.phone}</p>}
                                  </div>
                                );
                              })}
                            </div>

                            {m.customRoles && m.customRoles.length > 0 && (
                              <div className="space-y-2 mt-4">
                                <h5 className="text-[9px] font-black uppercase text-purple-700 tracking-wider block">
                                  Cargos Adicionais da Gestão
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {m.customRoles.map((cr: any) => (
                                    <div key={cr.id} className="p-2.5 rounded-xl bg-purple-50/10 border border-purple-100/30">
                                      <span className="text-[9px] font-black text-purple-500 block mb-0.5">{cr.roleName}</span>
                                      <p className="text-[11px] font-black text-gray-850 tracking-tight">{cr.name}</p>
                                      {cr.phone && <p className="text-[10px] text-gray-450 mt-0.5 font-bold">{cr.phone}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </form>
    </div>
  );
};

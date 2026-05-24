import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Trash2, Edit2, ChevronRight, Save, ArrowLeft, 
  Phone, Mail, Calendar, FileText, Check, X, ShieldAlert, 
  History, RefreshCw, Layers, Users, CalendarDays, CheckCircle2, 
  AlertTriangle, AlertCircle, Info, MapPin, BadgeInfo
} from 'lucide-react';
import { saveSettings } from '../lib/api';
import { 
  InstitutionSettings, 
  ConselhoParticular, 
  ConferenciaSubordinada, 
  ConselhoCustomRole, 
  ConselhoPastMandate, 
  ConferenciaPastMandate 
} from '../types';

interface ConselhosParticularesModuleProps {
  settings: InstitutionSettings | null;
  onSettingsChange: (settings: InstitutionSettings) => void;
  institutionId: string;
}

export const ConselhosParticularesModule: React.FC<ConselhosParticularesModuleProps> = ({
  settings,
  onSettingsChange,
  institutionId
}) => {
  const [conselhos, setConselhos] = useState<ConselhoParticular[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // States for selected council and details
  const [selectedConselho, setSelectedConselho] = useState<ConselhoParticular | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'conferencias'>('info');

  // Custom roles state within selected council
  const [showAddCustomRole, setShowAddCustomRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePersonName, setNewRolePersonName] = useState('');
  const [newRolePhone, setNewRolePhone] = useState('');

  // Transition form state within Council
  const [showCouncilTransition, setShowCouncilTransition] = useState(false);
  const [councilNewStartDate, setCouncilNewStartDate] = useState('');
  const [councilNewEndDate, setCouncilNewEndDate] = useState('');
  const [councilKeepDraft, setCouncilKeepDraft] = useState(true);
  const [selectedPastCouncilMandate, setSelectedPastCouncilMandate] = useState<ConselhoPastMandate | null>(null);

  // Subordinate Conferences Adding form State
  const [showAddConf, setShowAddConf] = useState(false);
  const [newConfName, setNewConfName] = useState('');
  const [newConfPresidentName, setNewConfPresidentName] = useState('');
  const [newConfPresidentPhone, setNewConfPresidentPhone] = useState('');
  const [newConfStartDate, setNewConfStartDate] = useState('');
  const [newConfEndDate, setNewConfEndDate] = useState('');
  const [newConfConfrades, setNewConfConfrades] = useState(0);
  const [newConfConsocias, setNewConfConsocias] = useState(0);
  const [newConfAspirantes, setNewConfAspirantes] = useState(0);

  // Active expanded conference state
  const [expandedConfId, setExpandedConfId] = useState<string | null>(null);

  // Conference Transition and editing states
  const [showConfTransitionId, setShowConfTransitionId] = useState<string | null>(null);
  const [confNewStartDate, setConfNewStartDate] = useState('');
  const [confNewEndDate, setConfNewEndDate] = useState('');
  const [confKeepDraft, setConfKeepDraft] = useState(true);
  const [selectedPastConfMandate, setSelectedPastConfMandate] = useState<ConferenciaPastMandate | null>(null);

  // Initialize from settings
  useEffect(() => {
    if (settings && settings.conselhosParticulares) {
      setConselhos(settings.conselhosParticulares);
    } else {
      setConselhos([]);
    }
  }, [settings]);

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSaveAllConselhos = async (updatedList: ConselhoParticular[]) => {
    setLoading(true);
    try {
      const updatedSettings = {
        ...(settings || {}),
        conselhosParticulares: updatedList
      };
      await saveSettings(institutionId, updatedSettings);
      onSettingsChange(updatedSettings as any);
      setConselhos(updatedList);
      showFeedback('Alterações salvas com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showFeedback('Erro ao salvar os novos dados: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConselho = () => {
    const newC: ConselhoParticular = {
      id: Date.now().toString(),
      name: '',
      city: '',
      phone: '',
      email: '',
      startDate: '',
      endDate: '',
      presidente: { name: '', phone: '' },
      vicePresidente: { name: '', phone: '' },
      secretario: { name: '', phone: '' },
      tesoureiro: { name: '', phone: '' },
      ecafo: { name: '', phone: '' },
      coordenadorCCA: { name: '', phone: '' },
      customRoles: [],
      mandateHistory: [],
      conferencias: []
    };
    setSelectedConselho(newC);
    setIsEditing(true);
    setActiveTab('info');
    setShowCouncilTransition(false);
    setSelectedPastCouncilMandate(null);
    setExpandedConfId(null);
  };

  const handleSelectConselho = (conselho: ConselhoParticular) => {
    setSelectedConselho(JSON.parse(JSON.stringify(conselho))); // Deep clone to edit and preview safely
    setIsEditing(true);
    setActiveTab('info');
    setShowCouncilTransition(false);
    setSelectedPastCouncilMandate(null);
    setExpandedConfId(null);
  };

  const handleBackToList = () => {
    setIsEditing(false);
    setSelectedConselho(null);
  };

  const handleSaveConselhoForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConselho) return;
    if (!selectedConselho.name.trim()) {
      showFeedback('O nome do Conselho Particular é obrigatório', 'error');
      return;
    }

    const updatedList = [...conselhos];
    const index = updatedList.findIndex(c => c.id === selectedConselho.id);
    if (index > -1) {
      updatedList[index] = selectedConselho;
    } else {
      updatedList.push(selectedConselho);
    }

    await handleSaveAllConselhos(updatedList);
    setIsEditing(false);
    setSelectedConselho(null);
  };

  const handleDeleteConselho = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza de que deseja remover permanentemente o Conselho Particular "${name}"? Todas as conferências associadas serão perdidas.`)) {
      return;
    }
    const updatedList = conselhos.filter(c => c.id !== id);
    await handleSaveAllConselhos(updatedList);
  };

  // Council Board Custom Roles
  const handleAddCustomRole = () => {
    if (!selectedConselho) return;
    if (!newRoleName.trim() || !newRolePersonName.trim()) {
      showFeedback('Preencha os campos obrigatórios do cargo adicional.', 'error');
      return;
    }
    const newRole: ConselhoCustomRole = {
      id: Date.now().toString(),
      roleName: newRoleName,
      name: newRolePersonName,
      phone: newRolePhone
    };
    const updatedRoles = [...(selectedConselho.customRoles || []), newRole];
    setSelectedConselho({
      ...selectedConselho,
      customRoles: updatedRoles
    });
    setNewRoleName('');
    setNewRolePersonName('');
    setNewRolePhone('');
    setShowAddCustomRole(false);
    showFeedback('Cargo adicional incluído temporariamente. Salve para persistir.', 'success');
  };

  const handleDeleteCustomRole = (id: string) => {
    if (!selectedConselho) return;
    const updatedRoles = (selectedConselho.customRoles || []).filter(r => r.id !== id);
    setSelectedConselho({
      ...selectedConselho,
      customRoles: updatedRoles
    });
    showFeedback('Cargo adicional removido temporariamente. Salve para persistir.', 'success');
  };

  // Council Board Transition (Nova Gestão)
  const handlePerformCouncilTransition = () => {
    if (!selectedConselho) return;
    if (!councilNewStartDate || !councilNewEndDate) {
      showFeedback('Insira as datas de vigência do novo mandato.', 'error');
      return;
    }

    // Archive current board to history
    const pastMandate: ConselhoPastMandate = {
      id: Date.now().toString(),
      startDate: selectedConselho.startDate || 'Não cadastrada',
      endDate: selectedConselho.endDate || 'Não cadastrada',
      presidente: { ...(selectedConselho.presidente || { name: '', phone: '' }) },
      vicePresidente: { ...(selectedConselho.vicePresidente || { name: '', phone: '' }) },
      secretario: { ...(selectedConselho.secretario || { name: '', phone: '' }) },
      tesoureiro: { ...(selectedConselho.tesoureiro || { name: '', phone: '' }) },
      ecafo: { ...(selectedConselho.ecafo || { name: '', phone: '' }) },
      coordenadorCCA: { ...(selectedConselho.coordenadorCCA || { name: '', phone: '' }) },
      customRoles: selectedConselho.customRoles ? [...selectedConselho.customRoles] : [],
      archivedAt: new Date().toISOString()
    };

    const currentHistory = selectedConselho.mandateHistory || [];
    const updatedHistory = [pastMandate, ...currentHistory];

    let updatedConselho: ConselhoParticular = {
      ...selectedConselho,
      startDate: councilNewStartDate,
      endDate: councilNewEndDate,
      mandateHistory: updatedHistory
    };

    if (!councilKeepDraft) {
      // Clear all board members
      updatedConselho = {
        ...updatedConselho,
        presidente: { name: '', phone: '' },
        vicePresidente: { name: '', phone: '' },
        secretario: { name: '', phone: '' },
        tesoureiro: { name: '', phone: '' },
        ecafo: { name: '', phone: '' },
        coordenadorCCA: { name: '', phone: '' },
        customRoles: []
      };
    }

    setSelectedConselho(updatedConselho);
    setCouncilNewStartDate('');
    setCouncilNewEndDate('');
    setShowCouncilTransition(false);
    showFeedback('Mandato anterior arquivado com sucesso! Ajuste a diretoria se necessário e clique em salvar.', 'success');
  };

  const handleDeletePastCouncilMandate = (id: string) => {
    if (!selectedConselho) return;
    if (!window.confirm('Deseja excluir este mandato antigo do histórico definitivamente?')) {
      return;
    }
    const currentHistory = selectedConselho.mandateHistory || [];
    const updatedHistory = currentHistory.filter(m => m.id !== id);
    setSelectedConselho({
      ...selectedConselho,
      mandateHistory: updatedHistory
    });
    if (selectedPastCouncilMandate && selectedPastCouncilMandate.id === id) {
      setSelectedPastCouncilMandate(null);
    }
    showFeedback('Mandato histórico removido. Salve o conselho para persistir.', 'success');
  };

  // Subordinate Conferences Operations
  const handleAddConference = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConselho) return;
    if (!newConfName.trim()) {
      showFeedback('O nome da conferência é obrigatório', 'error');
      return;
    }

    const newConf: ConferenciaSubordinada = {
      id: Date.now().toString(),
      name: newConfName,
      startDate: newConfStartDate,
      endDate: newConfEndDate,
      presidente: { name: newConfPresidentName, phone: newConfPresidentPhone },
      confradesCount: Math.max(0, Number(newConfConfrades) || 0),
      consociasCount: Math.max(0, Number(newConfConsocias) || 0),
      aspirantesCount: Math.max(0, Number(newConfAspirantes) || 0),
      lastMembersUpdate: new Date().toLocaleDateString('pt-BR'),
      mandateHistory: []
    };

    const currentConferences = selectedConselho.conferencias || [];
    setSelectedConselho({
      ...selectedConselho,
      conferencias: [...currentConferences, newConf]
    });

    // Reset values
    setNewConfName('');
    setNewConfPresidentName('');
    setNewConfPresidentPhone('');
    setNewConfStartDate('');
    setNewConfEndDate('');
    setNewConfConfrades(0);
    setNewConfConsocias(0);
    setNewConfAspirantes(0);
    setShowAddConf(false);
    showFeedback('Conferência vinculada com sucesso! Lembre-se de salvar.', 'success');
  };

  const handleDeleteConference = (confId: string, confName: string) => {
    if (!selectedConselho) return;
    if (!window.confirm(`Remover a conferência "${confName}" do Conselho Particular?`)) {
      return;
    }
    const currentConferences = selectedConselho.conferencias || [];
    setSelectedConselho({
      ...selectedConselho,
      conferencias: currentConferences.filter(c => c.id !== confId)
    });
    if (expandedConfId === confId) {
      setExpandedConfId(null);
    }
    showFeedback('Conferência removida temporariamente. Salve para persistir.', 'success');
  };

  const handleUpdateConferenceMembers = (confId: string, confrades: number, consocias: number, aspirantes: number) => {
    if (!selectedConselho) return;
    const currentConferences = selectedConselho.conferencias || [];
    const updatedConfs = currentConferences.map(c => {
      if (c.id === confId) {
        return {
          ...c,
          confradesCount: Math.max(0, confrades),
          consociasCount: Math.max(0, consocias),
          aspirantesCount: Math.max(0, aspirantes),
          lastMembersUpdate: new Date().toLocaleDateString('pt-BR')
        };
      }
      return c;
    });

    setSelectedConselho({
      ...selectedConselho,
      conferencias: updatedConfs
    });
    showFeedback('Dados demográficos da conferência atualizados! Lembre-se de salvar.', 'success');
  };

  // Perform Transition for Conferencia
  const handlePerformConfTransition = (confId: string) => {
    if (!selectedConselho) return;
    if (!confNewStartDate || !confNewEndDate) {
      showFeedback('Insira as datas de vigência do novo mandato da conferência.', 'error');
      return;
    }

    const currentConfs = selectedConselho.conferencias || [];
    const updatedConfs = currentConfs.map(conf => {
      if (conf.id === confId) {
        const pastMandate: ConferenciaPastMandate = {
          id: Date.now().toString(),
          startDate: conf.startDate || 'Não cadastrada',
          endDate: conf.endDate || 'Não cadastrada',
          presidente: { ...(conf.presidente || { name: '', phone: '' }) },
          confradesCount: conf.confradesCount || 0,
          consociasCount: conf.consociasCount || 0,
          aspirantesCount: conf.aspirantesCount || 0,
          archivedAt: new Date().toISOString()
        };

        const currentHist = conf.mandateHistory || [];
        const updatedHist = [pastMandate, ...currentHist];

        let updatedConf: ConferenciaSubordinada = {
          ...conf,
          startDate: confNewStartDate,
          endDate: confNewEndDate,
          mandateHistory: updatedHist
        };

        if (!confKeepDraft) {
          updatedConf = {
            ...updatedConf,
            presidente: { name: '', phone: '' },
            confradesCount: 0,
            consociasCount: 0,
            aspirantesCount: 0
          };
        }

        return updatedConf;
      }
      return conf;
    });

    setSelectedConselho({
      ...selectedConselho,
      conferencias: updatedConfs
    });

    setConfNewStartDate('');
    setConfNewEndDate('');
    setShowConfTransitionId(null);
    showFeedback('Transição de vigência da conferência concluída com sucesso! Lembre-se de salvar.', 'success');
  };

  const handleDeletePastConfMandate = (confId: string, pastMandateId: string) => {
    if (!selectedConselho) return;
    if (!window.confirm('Excluir este mandato do histórico da conferência?')) {
      return;
    }

    const currentConfs = selectedConselho.conferencias || [];
    const updatedConfs = currentConfs.map(conf => {
      if (conf.id === confId) {
        const updatedHist = (conf.mandateHistory || []).filter(m => m.id !== pastMandateId);
        return {
          ...conf,
          mandateHistory: updatedHist
        };
      }
      return conf;
    });

    setSelectedConselho({
      ...selectedConselho,
      conferencias: updatedConfs
    });
    if (selectedPastConfMandate && selectedPastConfMandate.id === pastMandateId) {
      setSelectedPastConfMandate(null);
    }
    showFeedback('Mandato histórico da conferência removido. Salve para persistir.', 'success');
  };

  // Filter list
  const filteredConselhos = conselhos.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Não cadastrada';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}
    return dateStr;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200 pb-24">
      {/* Informações de feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm animate-in slide-in-from-top ${
          feedback.type === 'success' 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} className="text-green-600" /> : <ShieldAlert size={18} className="text-red-600" />}
          <span className="text-xs font-black uppercase tracking-wider">{feedback.message}</span>
        </div>
      )}

      {!isEditing ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#004c99] rounded-3xl p-6 sm:p-8 text-white shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center">
                  <Layers size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wide">Conselhos Particulares</h1>
                  <p className="text-[11px] font-bold text-blue-100 uppercase tracking-widest leading-relaxed">
                    Painel de gerenciamento, vigência de mandatos, conferências integradas e estatísticas demográficas de confrades e consócias
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateConselho}
              className="px-5 py-3.5 bg-yellow-500 hover:bg-yellow-600 text-[#004c99] rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-black/15 self-start md:self-center shrink-0"
            >
              <Plus size={16} />
              Cadastrar Conselho
            </button>
          </div>

          {/* Search container */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar Conselho Particular por nome ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-bold text-gray-700 outline-none uppercase bg-transparent"
            />
          </div>

          {/* Council cards grid */}
          {filteredConselhos.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-150 p-12 text-center text-gray-400">
              <Layers size={48} className="mx-auto text-gray-200 mb-3" />
              <p className="text-xs font-black uppercase tracking-widest text-gray-300">
                Nenhum conselho particular cadastrado ou encontrado
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredConselhos.map(c => (
                <div key={c.id} className="bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 line-clamp-2">
                          {c.name}
                        </h3>
                        {c.city && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-450 font-bold uppercase mt-1">
                            <MapPin size={12} className="text-gray-300" />
                            {c.city}
                          </div>
                        )}
                      </div>
                      <div className="px-2.5 py-1 bg-blue-50 text-[#004c99] rounded-lg text-[9px] font-black uppercase">
                        {c.conferencias?.length || 0} confs
                      </div>
                    </div>

                    <div className="border-t border-gray-50 pt-3 space-y-2">
                      <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase">
                        <span>Mandato Atual:</span>
                        <span className="font-extrabold text-gray-700">
                          {formatDate(c.startDate)} à {formatDate(c.endDate)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase">
                        <span>Presidente:</span>
                        <span className="font-extrabold text-gray-700 max-w-[150px] truncate">
                          {c.presidente?.name || 'Não cadastrado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50/70 p-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectConselho(c)}
                      className="text-[10px] font-black uppercase tracking-wider text-[#004c99] hover:text-blue-700 transition-all flex items-center gap-1"
                    >
                      Editar / Acessar
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConselho(c.id, c.name)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                      title="Deletar Conselho"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        selectedConselho && (
          <form onSubmit={handleSaveConselhoForm} className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full">
              <button
                type="button"
                onClick={handleBackToList}
                className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-500 hover:text-gray-700 transition-all"
              >
                <ArrowLeft size={16} />
                Voltar à Lista
              </button>
              <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between">
                <span className="text-[10px] font-black text-[#004c99] uppercase bg-blue-50 px-3 py-1.5 rounded-xl">
                  {selectedConselho.name ? selectedConselho.name : 'Novo Conselho Particular'}
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-green-105"
                >
                  <Save size={14} />
                  {loading ? 'Salvando...' : 'Gravar Tudo'}
                </button>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-gray-150 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`pb-3 px-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === 'info' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-gray-400 hover:text-gray-650'
                }`}
              >
                Informações e Diretoria
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('conferencias')}
                className={`pb-3 px-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === 'conferencias' 
                    ? 'border-[#004c99] text-[#004c99]' 
                    : 'border-transparent text-gray-400 hover:text-gray-650'
                }`}
              >
                Conferências Subordinadas ({selectedConselho.conferencias?.length || 0})
              </button>
            </div>

            {/* TAB 1: INFO E DIRETORIA */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* General Info Card */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-gray-800">Identificação e Ciclo Eletivo</h2>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Identificação do Conselho Particular</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Nome do Conselho Particular *</label>
                      <input
                        type="text"
                        required
                        value={selectedConselho.name}
                        onChange={(e) => setSelectedConselho({ ...selectedConselho, name: e.target.value })}
                        placeholder="Ex: Conselho Particular de São José"
                        className="w-full px-4 py-3 bg-gray-50/50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Cidade Sede</label>
                      <input
                        type="text"
                        value={selectedConselho.city || ''}
                        onChange={(e) => setSelectedConselho({ ...selectedConselho, city: e.target.value })}
                        placeholder="Ex: Belo Horizonte"
                        className="w-full px-4 py-3 bg-gray-50/50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Data de Início da Vigência Eletiva</label>
                      <input
                        type="date"
                        value={selectedConselho.startDate}
                        onChange={(e) => setSelectedConselho({ ...selectedConselho, startDate: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50/50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Data do Fim da Vigência Eletiva</label>
                      <input
                        type="date"
                        value={selectedConselho.endDate}
                        onChange={(e) => setSelectedConselho({ ...selectedConselho, endDate: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50/50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all text-gray-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Telefone Comercial</label>
                      <input
                        type="text"
                        value={selectedConselho.phone || ''}
                        onChange={(e) => setSelectedConselho({ ...selectedConselho, phone: e.target.value })}
                        placeholder="Ex: (31) 5555-0199"
                        className="w-full px-4 py-3 bg-gray-50/50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">E-mail Oficial</label>
                      <input
                        type="email"
                        value={selectedConselho.email || ''}
                        onChange={(e) => setSelectedConselho({ ...selectedConselho, email: e.target.value })}
                        placeholder="Ex: cp.saojose@ssvp.org"
                        className="w-full px-4 py-3 bg-gray-50/50 focus:bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Transition Mandate Block */}
                <div className="bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 shadow-sm space-y-6 border-l-4 border-l-orange-500">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                        <RefreshCw size={20} className={showCouncilTransition ? 'animate-spin' : ''} />
                      </div>
                      <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-gray-800">Transição de Diretoria do Conselho Particular</h2>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Arquive no histórico a gestão eleita atual e inicie um novo mandato</p>
                      </div>
                    </div>
                    {!showCouncilTransition && (
                      <button
                        type="button"
                        onClick={() => setShowCouncilTransition(true)}
                        className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-100"
                      >
                        <RefreshCw size={12} />
                        Nova Gestão
                      </button>
                    )}
                  </div>

                  {showCouncilTransition && (
                    <div className="p-6 rounded-2xl bg-orange-50/30 border border-orange-150 space-y-6 animate-in slide-in-from-top">
                      <div className="flex justify-between items-center border-b border-orange-100 pb-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-orange-800">Configurar Nova Gestão Eleita</h3>
                        <button 
                          type="button" 
                          onClick={() => setShowCouncilTransition(false)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <p className="text-[10px] font-bold text-gray-500 uppercase leading-relaxed">
                        Aviso: ao confirmar, todos os membros e cargos atuais serão arquivados de forma definitiva no histórico eletivo sob as datas <span className="text-gray-800 font-extrabold">{selectedConselho.startDate || 'Não informada'}</span> à <span className="text-gray-800 font-extrabold">{selectedConselho.endDate || 'Não informada'}</span>.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Início do Novo Mandato *</label>
                          <input
                            type="date"
                            value={councilNewStartDate}
                            onChange={(e) => setCouncilNewStartDate(e.target.value)}
                            className="w-full px-4 py-3 border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 bg-white shadow-sm text-gray-700"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Previsão Fim do Mandato *</label>
                          <input
                            type="date"
                            value={councilNewEndDate}
                            onChange={(e) => setCouncilNewEndDate(e.target.value)}
                            className="w-full px-4 py-3 border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 bg-white shadow-sm text-gray-700"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">O que fazer com os nomes atuais?</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex items-start gap-3 p-3 bg-white border border-orange-100 rounded-xl cursor-pointer">
                            <input
                              type="radio"
                              checked={councilKeepDraft}
                              onChange={() => setCouncilKeepDraft(true)}
                              className="mt-0.5 text-orange-600 focus:ring-orange-500"
                            />
                            <div>
                              <span className="text-xs font-black text-gray-750 uppercase block">Manter como Rascunho</span>
                              <span className="text-[9px] text-gray-450 font-medium uppercase block mt-0.5">Mantenha os preenchimentos atuais para apenas fazer as correções pontuais da nova equipe.</span>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 p-3 bg-white border border-orange-100 rounded-xl cursor-pointer">
                            <input
                              type="radio"
                              checked={!councilKeepDraft}
                              onChange={() => setCouncilKeepDraft(false)}
                              className="mt-0.5 text-orange-600 focus:ring-orange-500"
                            />
                            <div>
                              <span className="text-xs font-black text-gray-750 uppercase block">Zerar e começar do zero</span>
                              <span className="text-[9px] text-gray-450 font-medium uppercase block mt-0.5">Apaga todos os nomes de dirigentes e cargos adicionais do mandato para novo recadastro.</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-4 border-t border-orange-100">
                        <button
                          type="button"
                          onClick={() => setShowCouncilTransition(false)}
                          className="px-4 py-2 hover:bg-gray-100 text-gray-400 font-black text-[10px] uppercase rounded-xl tracking-wider"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handlePerformCouncilTransition}
                          className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black text-[10px] uppercase rounded-xl tracking-wider shadow-md shadow-orange-100"
                        >
                          Efetivar Transição Eletiva
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dirigentes Card */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                      <Users size={18} />
                    </div>
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-gray-800">Dirigentes do Colegiado</h2>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Composição canônica da mesa diretora atual</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* President */}
                    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block border-b border-dashed border-gray-200 pb-1">Presidente</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedConselho.presidente?.name || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            presidente: { ...(selectedConselho.presidente || { name: '', phone: '' }), name: e.target.value }
                          })}
                          placeholder="Nome Completo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                        <input
                          type="text"
                          value={selectedConselho.presidente?.phone || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            presidente: { ...(selectedConselho.presidente || { name: '', phone: '' }), phone: e.target.value }
                          })}
                          placeholder="Telefone"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Vice President */}
                    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block border-b border-dashed border-gray-200 pb-1">Vice-Presidente</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedConselho.vicePresidente?.name || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            vicePresidente: { ...(selectedConselho.vicePresidente || { name: '', phone: '' }), name: e.target.value }
                          })}
                          placeholder="Nome Completo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                        <input
                          type="text"
                          value={selectedConselho.vicePresidente?.phone || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            vicePresidente: { ...(selectedConselho.vicePresidente || { name: '', phone: '' }), phone: e.target.value }
                          })}
                          placeholder="Telefone"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Secretario */}
                    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block border-b border-dashed border-gray-200 pb-1">Secretário</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedConselho.secretario?.name || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            secretario: { ...(selectedConselho.secretario || { name: '', phone: '' }), name: e.target.value }
                          })}
                          placeholder="Nome Completo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                        <input
                          type="text"
                          value={selectedConselho.secretario?.phone || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            secretario: { ...(selectedConselho.secretario || { name: '', phone: '' }), phone: e.target.value }
                          })}
                          placeholder="Telefone"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Tesoureiro */}
                    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block border-b border-dashed border-gray-200 pb-1">Tesoureiro</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedConselho.tesoureiro?.name || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            tesoureiro: { ...(selectedConselho.tesoureiro || { name: '', phone: '' }), name: e.target.value }
                          })}
                          placeholder="Nome Completo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                        <input
                          type="text"
                          value={selectedConselho.tesoureiro?.phone || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            tesoureiro: { ...(selectedConselho.tesoureiro || { name: '', phone: '' }), phone: e.target.value }
                          })}
                          placeholder="Telefone"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* ECAFO */}
                    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block border-b border-dashed border-gray-200 pb-1">Coordenador ECAFO</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedConselho.ecafo?.name || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            ecafo: { ...(selectedConselho.ecafo || { name: '', phone: '' }), name: e.target.value }
                          })}
                          placeholder="Nome Completo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                        <input
                          type="text"
                          value={selectedConselho.ecafo?.phone || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            ecafo: { ...(selectedConselho.ecafo || { name: '', phone: '' }), phone: e.target.value }
                          })}
                          placeholder="Telefone"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* CCA Coordinator */}
                    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block border-b border-dashed border-gray-200 pb-1">Coordenador de CCA</span>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={selectedConselho.coordenadorCCA?.name || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            coordenadorCCA: { ...(selectedConselho.coordenadorCCA || { name: '', phone: '' }), name: e.target.value }
                          })}
                          placeholder="Nome Completo"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                        <input
                          type="text"
                          value={selectedConselho.coordenadorCCA?.phone || ''}
                          onChange={(e) => setSelectedConselho({
                            ...selectedConselho,
                            coordenadorCCA: { ...(selectedConselho.coordenadorCCA || { name: '', phone: '' }), phone: e.target.value }
                          })}
                          placeholder="Telefone"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom auxiliary offices (Outros Cargos) */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Plus size={18} />
                      </div>
                      <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-gray-800">Cargos Adicionais da Diretoria</h2>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Crie e configure auxiliares específicos da conferência ou conselhos</p>
                      </div>
                    </div>
                    {!showAddCustomRole && (
                      <button
                        type="button"
                        onClick={() => setShowAddCustomRole(true)}
                        className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-black text-[10px] uppercase rounded-xl tracking-wider transition-all flex items-center gap-1.5"
                      >
                        <Plus size={12} />
                        Novo Cargo
                      </button>
                    )}
                  </div>

                  {showAddCustomRole && (
                    <div className="p-5 rounded-2xl bg-purple-50/20 border border-purple-100/40 space-y-4 animate-in slide-in-from-top-3">
                      <div className="flex justify-between items-center pb-2 border-b border-purple-100/20">
                        <span className="text-xs font-black uppercase tracking-wider text-purple-800">Novo Cargo Customizado</span>
                        <button type="button" onClick={() => setShowAddCustomRole(false)} className="text-gray-400 hover:text-gray-650 p-1"><X size={14} /></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Denominação do Cargo *</label>
                          <input
                            type="text"
                            placeholder="Ex: Coordenador de Projetos"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-bold outline-none uppercase"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Nome do Titular *</label>
                          <input
                            type="text"
                            placeholder="Ex: Carlos Silva"
                            value={newRolePersonName}
                            onChange={(e) => setNewRolePersonName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-bold outline-none uppercase"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Telefone para Contato</label>
                          <input
                            type="text"
                            placeholder="Ex: (31) 5555-2234"
                            value={newRolePhone}
                            onChange={(e) => setNewRolePhone(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-250 rounded-lg text-xs font-bold outline-none uppercase"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2 border-t border-purple-100/20">
                        <button
                          type="button"
                          onClick={() => setShowAddCustomRole(false)}
                          className="px-3 py-1.5 text-gray-400 font-extrabold text-[9px] uppercase hover:bg-white rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomRole}
                          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[9px] uppercase rounded shadow-sm"
                        >
                          Salvar Cargo
                        </button>
                      </div>
                    </div>
                  )}

                  {(!selectedConselho.customRoles || selectedConselho.customRoles.length === 0) ? (
                    <p className="text-[10px] font-bold text-gray-350 uppercase text-center py-6 border border-dashed border-gray-150 rounded-2xl">
                      Nenhum cargo adicional atribuído nesta vigência
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedConselho.customRoles.map(cr => (
                        <div key={cr.id} className="p-4 bg-purple-50/5 border border-purple-100/20 rounded-2xl flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded tracking-wide inline-block">{cr.roleName}</span>
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{cr.name}</p>
                            {cr.phone && <p className="text-[10px] text-gray-400 font-bold">{cr.phone}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRole(cr.id)}
                            className="p-1 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition-all"
                            title="Remover Cargo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mandate History section */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
                      <History size={18} />
                    </div>
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-gray-800">Histórico de Gestões do Conselho Particular</h2>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Histórico de mandatos anteriores e suas respectivas diretorias estatutárias</p>
                    </div>
                  </div>

                  {(!selectedConselho.mandateHistory || selectedConselho.mandateHistory.length === 0) ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-105 rounded-3xl">
                      <History className="mx-auto text-gray-200 mb-2" size={24} />
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-300">Nenhum mandato histórico arquivado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedConselho.mandateHistory.map(m => {
                        const isSelected = selectedPastCouncilMandate?.id === m.id;
                        return (
                          <div key={m.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-gray-50/55 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase tracking-widest rounded">Gestão Arquivada</span>
                                <h4 className="text-[11px] font-black text-gray-800 uppercase tracking-wide mt-1">Vigência: {formatDate(m.startDate)} à {formatDate(m.endDate)}</h4>
                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Presidente de Gestão: {m.presidente?.name || 'Não registrado'}</p>
                              </div>

                              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPastCouncilMandate(isSelected ? null : m)}
                                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs"
                                >
                                  <FileText size={12} />
                                  {isSelected ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePastCouncilMandate(m.id)}
                                  className="p-1.5 border border-red-50 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-700 transition-all bg-white"
                                  title="Remover do Histórico"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="p-6 bg-white border-t border-gray-100 space-y-5 animate-in fade-in duration-200">
                                <div className="space-y-2">
                                  <span className="text-[9px] font-black uppercase text-[#004c99] tracking-widest block pb-1 border-b border-gray-100">Equipe Constitutiva do Colegiado</span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                      { label: 'Presidente', m: m.presidente },
                                      { label: 'Vice-Presidente', m: m.vicePresidente },
                                      { label: 'Secretário', m: m.secretario },
                                      { label: 'Tesoureiro', m: m.tesoureiro },
                                      { label: 'CCA', m: m.coordenadorCCA },
                                      { label: 'ECAFO', m: m.ecafo }
                                    ].map((field, fIdx) => (
                                      <div key={fIdx} className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                                        <span className="text-[8px] font-black uppercase text-gray-400 block tracking-wider">{field.label}</span>
                                        <span className="text-[10px] font-black uppercase text-gray-800 mt-0.5 block">{field.m?.name || 'Não ocupado'}</span>
                                        {field.m?.phone && <span className="text-[9px] text-gray-400 font-bold block mt-0.5">{field.m.phone}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {m.customRoles && m.customRoles.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-[9px] font-black uppercase text-purple-600 tracking-widest block pb-1 border-b border-gray-100">Cargos Eauxiliares Adicionais</span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {m.customRoles.map(cr => (
                                        <div key={cr.id} className="p-2.5 rounded-xl bg-purple-50/5 border border-purple-100/10">
                                          <span className="text-[8px] font-black uppercase text-purple-500 block tracking-wider">{cr.roleName}</span>
                                          <span className="text-[10px] font-black uppercase text-gray-800 mt-0.5 block">{cr.name}</span>
                                          {cr.phone && <span className="text-[9px] text-gray-450 font-bold block mt-0.5">{cr.phone}</span>}
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

            {/* TAB 2: CONFERENCIAS SUBORDINADAS */}
            {activeTab === 'conferencias' && (
              <div className="space-y-6">
                {/* Header within subordinadas */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-gray-800">Vínculo das Conferências Subordinadas</h2>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-relaxed">Associe, configure mandatos rotativos e atualize dados demográficos anuais de cada conferência subordinada a este conselho</p>
                    </div>
                    {!showAddConf && (
                      <button
                        type="button"
                        onClick={() => setShowAddConf(true)}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#004c99] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 self-start sm:self-center shrink-0"
                      >
                        <Plus size={14} />
                        Nova Conferência Vinculada
                      </button>
                    )}
                  </div>

                  {/* Add conference Form */}
                  {showAddConf && (
                    <div className="p-6 rounded-2xl bg-gray-50/70 border border-gray-200 mt-4 space-y-6 animate-in slide-in-from-top-4">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-800">Cadastrar Nova Conferência e Mandato</span>
                        <button type="button" onClick={() => setShowAddConf(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Nome da Conferência *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Conferência São Vicente de Paulo"
                            value={newConfName}
                            onChange={(e) => setNewConfName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none uppercase"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Início do Mandato</label>
                          <input
                            type="date"
                            value={newConfStartDate}
                            onChange={(e) => setNewConfStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none text-gray-700"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Previsão Fim do Mandato</label>
                          <input
                            type="date"
                            value={newConfEndDate}
                            onChange={(e) => setNewConfEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none text-gray-700"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Presidente (Nome)</label>
                          <input
                            type="text"
                            placeholder="Nome Completo"
                            value={newConfPresidentName}
                            onChange={(e) => setNewConfPresidentName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none uppercase"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Presidente (Telefone)</label>
                          <input
                            type="text"
                            placeholder="Ex: (31) 99999-0012"
                            value={newConfPresidentPhone}
                            onChange={(e) => setNewConfPresidentPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none uppercase"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Número de Confrades</label>
                          <input
                            type="number"
                            min="0"
                            value={newConfConfrades}
                            onChange={(e) => setNewConfConfrades(Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Número de Consócias</label>
                          <input
                            type="number"
                            min="0"
                            value={newConfConsocias}
                            onChange={(e) => setNewConfConsocias(Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-gray-400 uppercase block tracking-wider">Número de Aspirantes</label>
                          <input
                            type="number"
                            min="0"
                            value={newConfAspirantes}
                            onChange={(e) => setNewConfAspirantes(Math.max(0, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => setShowAddConf(false)}
                          className="px-4 py-2 hover:bg-white text-gray-400 font-extrabold text-[10px] uppercase rounded-xl tracking-wider"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddConference}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase rounded-xl tracking-wider shadow-md shadow-blue-50"
                        >
                          Salvar Conferência
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Conferences list */}
                {(!selectedConselho.conferencias || selectedConselho.conferencias.length === 0) ? (
                  <div className="bg-white rounded-3xl border border-gray-150 p-12 text-center text-gray-400">
                    <Users size={36} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                      Nenhuma conferência vinculada a este Conselho Particular ainda
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedConselho.conferencias.map((conf) => {
                      const isExpanded = expandedConfId === conf.id;
                      const isTransiting = showConfTransitionId === conf.id;

                      const totalMembers = (conf.confradesCount || 0) + (conf.consociasCount || 0) + (conf.aspirantesCount || 0);

                      return (
                        <div key={conf.id} className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                          <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 text-[#004c99] text-[9px] font-black uppercase tracking-widest rounded">Subordinada</span>
                                <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest">{conf.name}</h4>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[10px] font-bold text-gray-450 uppercase tracking-tight">
                                <div>Presidente: <span className="text-gray-700 font-extrabold">{conf.presidente?.name || 'Não cadastrado'}</span></div>
                                <div>Mandato: <span className="text-gray-700 font-extrabold">{formatDate(conf.startDate)} à {formatDate(conf.endDate)}</span></div>
                                <div>Membros: <span className="text-[#004c99] font-black">{totalMembers} Totais ({conf.confradesCount || 0} confrades, {conf.consociasCount || 0} consócias, {conf.aspirantesCount || 0} asp)</span></div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              <button
                                type="button"
                                onClick={() => setExpandedConfId(isExpanded ? null : conf.id)}
                                className="px-3.5 py-2 hover:bg-gray-50 border border-gray-150 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#004c99] flex items-center gap-1 transition-all"
                              >
                                {isExpanded ? 'Recolher Detalhes' : 'Gerenciar e Vigência'}
                                <ChevronRight size={14} className={`transition-transform duration-250 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteConference(conf.id, conf.name)}
                                className="p-2 border border-red-50 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-xl transition-all"
                                title="Remover Conferência"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Content for Subordinate Conference */}
                          {isExpanded && (
                            <div className="p-6 bg-gray-50/40 border-t border-gray-100 space-y-6 animate-in fade-in duration-200">
                              
                              {/* Demographics / Annual Update */}
                              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
                                <div className="flex items-center gap-2 justify-between border-b border-gray-50 pb-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <BadgeInfo size={16} className="text-[#004c99]" />
                                    <span className="text-[10px] font-black uppercase text-gray-800 tracking-wider">Estatísticas Demográficas e Membros</span>
                                  </div>
                                  <span className="text-[9px] font-extrabold text-gray-400 uppercase">Última atualização: {conf.lastMembersUpdate || 'Não informada'}</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-gray-400 block">Total de Confrades *</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={conf.confradesCount || 0}
                                      onChange={(e) => handleUpdateConferenceMembers(conf.id, Number(e.target.value), conf.consociasCount || 0, conf.aspirantesCount || 0)}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold bg-gray-50/50 outline-none focus:ring-1"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-gray-400 block">Total de Consócias *</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={conf.consociasCount || 0}
                                      onChange={(e) => handleUpdateConferenceMembers(conf.id, conf.confradesCount || 0, Number(e.target.value), conf.aspirantesCount || 0)}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold bg-gray-50/50 outline-none focus:ring-1"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-gray-400 block">Total de Aspirantes *</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={conf.aspirantesCount || 0}
                                      onChange={(e) => handleUpdateConferenceMembers(conf.id, conf.confradesCount || 0, conf.consociasCount || 0, Number(e.target.value))}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold bg-gray-50/50 outline-none focus:ring-1"
                                    />
                                  </div>
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase bg-blue-50/30 border border-blue-50 p-2.5 rounded-xl flex items-center gap-2">
                                  <Info size={14} className="text-[#004c99]" />
                                  <span>Conforme regra vicentina, as informações de censo demográfico devem ser revisadas e salvas anualmente.</span>
                                </div>
                              </div>

                              {/* Conference Current Mandate Board / President */}
                              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
                                <span className="text-[10px] font-black uppercase text-gray-800 block tracking-wider pb-2 border-b border-gray-50">Liderança da Conferência</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-gray-405 block">Presidente Atual da Conferência *</label>
                                    <input
                                      type="text"
                                      value={conf.presidente?.name || ''}
                                      onChange={(e) => {
                                        const currentConferences = selectedConselho.conferencias || [];
                                        const updatedConfs = currentConferences.map(c => {
                                          if (c.id === conf.id) {
                                            return { ...c, presidente: { ...(c.presidente || { name: '', phone: '' }), name: e.target.value } };
                                          }
                                          return c;
                                        });
                                        setSelectedConselho({ ...selectedConselho, conferencias: updatedConfs });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase bg-gray-50/50"
                                      placeholder="Presidente da Conferência"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-gray-405 block">Telefone do Presidente *</label>
                                    <input
                                      type="text"
                                      value={conf.presidente?.phone || ''}
                                      onChange={(e) => {
                                        const currentConferences = selectedConselho.conferencias || [];
                                        const updatedConfs = currentConferences.map(c => {
                                          if (c.id === conf.id) {
                                            return { ...c, presidente: { ...(c.presidente || { name: '', phone: '' }), phone: e.target.value } };
                                          }
                                          return c;
                                        });
                                        setSelectedConselho({ ...selectedConselho, conferencias: updatedConfs });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold outline-none uppercase bg-gray-50/50"
                                      placeholder="Telefone"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Conference Transition block */}
                              <div className="bg-white rounded-2xl border border-orange-100 p-5 space-y-4 shadow-xs border-l-4 border-l-orange-500">
                                <div className="flex items-center justify-between border-b border-orange-50 pb-2">
                                  <div className="flex items-center gap-1.5 text-orange-700">
                                    <RefreshCw size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Vigência de Mandato da Conferência</span>
                                  </div>
                                  {!isTransiting && (
                                    <button
                                      type="button"
                                      onClick={() => setShowConfTransitionId(conf.id)}
                                      className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-black text-[9px] uppercase rounded-lg tracking-wider transition-all"
                                    >
                                      Transição Local
                                    </button>
                                  )}
                                </div>

                                {isTransiting && (
                                  <div className="space-y-4 p-4 rounded-xl bg-orange-50/20 border border-orange-100">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-800 block">Cadastrar Novo Mandato para {conf.name}</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-gray-400 block">Início da Nova Vigência *</label>
                                        <input
                                          type="date"
                                          value={confNewStartDate}
                                          onChange={(e) => setConfNewStartDate(e.target.value)}
                                          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-xs font-bold bg-white text-gray-700"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-gray-400 block">Fim Previsto da Vigência *</label>
                                        <input
                                          type="date"
                                          value={confNewEndDate}
                                          onChange={(e) => setConfNewEndDate(e.target.value)}
                                          className="w-full px-3 py-2 border border-orange-200 rounded-lg text-xs font-bold bg-white text-gray-700"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1 font-bold">
                                      <label className="flex items-center gap-2 text-[10px] uppercase text-gray-500 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={confKeepDraft}
                                          onChange={(e) => setConfKeepDraft(e.target.checked)}
                                          className="text-orange-600 focus:ring-orange-500 rounded"
                                        />
                                        <span>Manter presidente atual como rascunho de preenchimento</span>
                                      </label>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => setShowConfTransitionId(null)}
                                        className="px-3 py-1.5 text-gray-400 font-extrabold text-[9px] uppercase rounded"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePerformConfTransition(conf.id)}
                                        className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[9px] uppercase rounded"
                                      >
                                        Confirmar Transição
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] font-bold text-gray-400 uppercase">
                                  <div>Vigência do Mandato Atual: <span className="text-gray-700 font-extrabold">{formatDate(conf.startDate)} à {formatDate(conf.endDate)}</span></div>
                                </div>
                              </div>

                              {/* Conference Mandate history archives */}
                              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-xs">
                                <div className="flex items-center gap-1.5 text-gray-500 pb-2 border-b border-gray-50">
                                  <History size={16} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">Histórico de Gestões da Conferência</span>
                                </div>

                                {(!conf.mandateHistory || conf.mandateHistory.length === 0) ? (
                                  <p className="text-[9px] font-bold text-gray-300 uppercase block text-center py-4">Nenhum mandato histórico para esta conferência</p>
                                ) : (
                                  <div className="space-y-2.5">
                                    {conf.mandateHistory.map(hm => {
                                      const isConfHistExpanded = selectedPastConfMandate?.id === hm.id;

                                      return (
                                        <div key={hm.id} className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                                          <div className="flex items-center justify-between gap-4">
                                            <div>
                                              <span className="px-1.5 py-0.5 bg-gray-100 text-[8px] font-black text-gray-500 uppercase tracking-wide rounded">Mandato Antigo</span>
                                              <p className="text-[10px] font-black text-gray-700 uppercase tracking-tight mt-1">Gestão: {formatDate(hm.startDate)} à {formatDate(hm.endDate)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => setSelectedPastConfMandate(isConfHistExpanded ? null : hm)}
                                                className="px-2.5 py-1 hover:bg-white text-[9px] font-extrabold text-blue-800 rounded border border-gray-200 bg-white shadow-xs"
                                              >
                                                {isConfHistExpanded ? 'Ocultar' : 'Detalhes'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeletePastConfMandate(conf.id, hm.id)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>

                                          {isConfHistExpanded && (
                                            <div className="p-3 bg-white border border-gray-50 rounded-lg text-[10px] font-semibold text-gray-550 space-y-1.5 uppercase tracking-tight">
                                              <div>Presidente Relativo: <span className="font-extrabold text-gray-800">{hm.presidente?.name || 'Não cadastrado'} {hm.presidente?.phone ? `(${hm.presidente?.phone})` : ''}</span></div>
                                              <div>Membros no Encerramento: <span className="font-extrabold text-gray-850">{hm.confradesCount || 0} Confrades, {hm.consociasCount || 0} Consócias, {hm.aspirantesCount || 0} Aspirantes</span></div>
                                              <div className="text-[8px] text-gray-400">Arquivado em: {new Date(hm.archivedAt).toLocaleString('pt-BR')}</div>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </form>
        )
      )}
    </div>
  );
};

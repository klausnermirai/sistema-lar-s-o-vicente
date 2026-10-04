import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, Trash2, Edit2, ChevronRight, Save, ArrowLeft, 
  MapPin, Phone, Mail, Globe, Users, Calendar, ShieldAlert, BadgeInfo,
  CalendarDays, CheckCircle2, AlertTriangle, HelpCircle, FileText,
  ExternalLink, ShieldCheck, Check, X, Filter, Clock, AlertCircle, Info, Landmark,
  History, RefreshCw
} from 'lucide-react';
import { saveSettings } from '../lib/api';
import { InstitutionSettings, AppRoute } from '../types';

interface ObrasUnidasModuleProps {
  settings: InstitutionSettings | null;
  onSettingsChange: (settings: InstitutionSettings) => void;
  institutionId: string;
}

export interface BoardMember {
  name: string;
  phone: string;
}

export interface CustomBoardRole {
  id: string;
  roleName: string;
  name: string;
  phone: string;
}

export interface FiscalChecklist {
  estatutoVigente: boolean;
  ataEleicao: boolean;
  cndFederal: boolean;
  cndEstadual: boolean;
  cndMunicipal: boolean;
  alvaraFuncionamento: boolean;
  cnpjRegular: boolean;
  balancoContabil: boolean;
}

export interface ComplianceDocument {
  id: string;
  name: string;
  category: string;
  mandatory: boolean; // Sim/Não
  appliesToEntity: boolean; // Sim/Não
  hasDocument: boolean; // Sim/Não
  status: 'regular' | 'pendente' | 'vencido' | 'próximo do vencimento' | 'em renovação' | 'precisa atualização' | 'não se aplica' | 'aguardando aprovação/homologação';
  issueDate?: string;
  homologationDate?: string; // homologação, aprovação, registro ou última atualização
  expiryDate?: string;
  period?: string; // exercício ou competência
  link?: string; // link do documento ou da pasta
  notes?: string; // observações
}

export interface ObraUnida {
  id: string;
  name: string;
  type: 'lar' | 'vila' | 'santa_casa' | 'outros';
  address: string;
  phone: string;
  email: string;
  site: string;

  // Diretoria
  presidente: BoardMember;
  vice1: BoardMember;
  vice2: BoardMember;
  secretario1: BoardMember;
  secretario2: BoardMember;
  tesoureiro1: BoardMember;
  tesoureiro2: BoardMember;
  conselheirosFiscais: BoardMember[];
  customBoardRoles: CustomBoardRole[];

  // Mandato
  startDate: string;
  endDate: string;

  // Fiscal
  fiscalStatus: 'regular' | 'em_regularizacao' | 'irregular';
  lastAuditDate: string;
  nextAuditDate: string;
  fiscalChecklist: FiscalChecklist;
  fiscalReport: string;
  documents?: ComplianceDocument[];
  mandateHistory?: any[];
}

export const DEFAULT_COMPLIANCE_DOCUMENTS: Omit<ComplianceDocument, 'id'>[] = [
  { name: 'Estatuto Social', category: 'Institucional e Governança', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Regimento Interno', category: 'Institucional e Governança', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Alvará dos Bombeiros', category: 'Alvarás e Funcionamento', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Alvará Sanitário', category: 'Alvarás e Funcionamento', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Alvará de Funcionamento', category: 'Alvarás e Funcionamento', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Cartão CNPJ atualizado', category: 'Institucional e Governança', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão negativa INSS/Receita Federal', category: 'Certidões Negativas', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão negativa FGTS', category: 'Certidões Negativas', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão negativa Municipal', category: 'Certidões Negativas', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão negativa Estadual', category: 'Certidões Negativas', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão negativa Federal', category: 'Certidões Negativas', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Registro no Conselho Municipal de Assistência Social', category: 'Conselhos e Assistência Social', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Registro no Conselho Estadual de Assistência Social', category: 'Conselhos e Assistência Social', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Registro no Conselho Nacional de Assistência Social', category: 'Conselhos e Assistência Social', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão ou Lei de Utilidade Pública', category: 'Institucional e Governança', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Contratos com fornecedores', category: 'Contratos', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Contratos com prestadores de serviço', category: 'Contratos', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Contratos de prestação de serviços com os idosos acolhidos', category: 'Contratos', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Relação de empregados fornecida pela contabilidade', category: 'Trabalhista e RH', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Documentos contábeis gerais', category: 'Contábil e Financeiro', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Balanço Patrimonial', category: 'Contábil e Financeiro', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'DRE – Demonstração do Resultado do Exercício', category: 'Contábil e Financeiro', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Certidão do inventário registrada em cartório', category: 'Institucional e Governança', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Comprovação da finalização e aprovação das prestações de contas de emendas e subvenções finalizadas em 2025', category: 'Emendas, Subvenções e Parcerias', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Plano de trabalho das emendas/subvenções em andamento', category: 'Emendas, Subvenções e Parcerias', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Termo de fomento das emendas/subvenções em andamento', category: 'Emendas, Subvenções e Parcerias', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Aprovação de contas do último exercício pela Prefeitura', category: 'Emendas, Subvenções e Parcerias', mandatory: false, appliesToEntity: true, hasDocument: false, status: 'pendente' },
  { name: 'Aprovação de contas do último exercício pelo Conselho Metropolitano', category: 'Emendas, Subvenções e Parcerias', mandatory: true, appliesToEntity: true, hasDocument: false, status: 'pendente' },
];

export const isNoExpiryDoc = (docName: string): boolean => {
  const nameLower = docName.toLowerCase();
  return (
    nameLower.includes('estatuto social') ||
    nameLower.includes('regimento interno') ||
    nameLower.includes('utilidade pública') ||
    nameLower.includes('inventário')
  );
};

export const ensureDefaultDocuments = (obra: ObraUnida): ObraUnida => {
  const currentDocs = obra.documents || [];
  const updatedDocs = [...currentDocs];
  
  DEFAULT_COMPLIANCE_DOCUMENTS.forEach((defDoc, idx) => {
    const exists = updatedDocs.find(d => d.name === defDoc.name);
    if (!exists) {
      updatedDocs.push({
        ...JSON.parse(JSON.stringify(defDoc)),
        id: `doc_${idx}_${Date.now()}`
      });
    }
  });
  
  return {
    ...obra,
    documents: updatedDocs
  };
};

export const ObrasUnidasModule: React.FC<ObrasUnidasModuleProps> = ({
  settings,
  onSettingsChange,
  institutionId,
}) => {
  const [obras, setObras] = useState<ObraUnida[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedObra, setSelectedObra] = useState<ObraUnida | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'diretoria' | 'fiscal'>('info');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Temporary state for additions
  const [newConselheiro, setNewConselheiro] = useState<BoardMember>({ name: '', phone: '' });
  const [newCustomRole, setNewCustomRole] = useState<CustomBoardRole>({ id: '', roleName: '', name: '', phone: '' });
  const [showAddCustomRole, setShowAddCustomRole] = useState(false);

  // States for Obra Unida board transition
  const [showObraTransitionForm, setShowObraTransitionForm] = useState(false);
  const [obraNewMandateStartDate, setObraNewMandateStartDate] = useState('');
  const [obraNewMandateEndDate, setObraNewMandateEndDate] = useState('');
  const [obraKeepCurrentAsDraft, setObraKeepCurrentAsDraft] = useState(true);
  const [selectedPastObraMandate, setSelectedPastObraMandate] = useState<any | null>(null);

  // States for Compliance documents in tab 3 (Controle Fiscal)
  const [docCategoryFilter, setDocCategoryFilter] = useState('all');
  const [docStatusFilter, setDocStatusFilter] = useState('all');
  const [docVencimentoFilter, setDocVencimentoFilter] = useState('all'); // all, sem_vencimento, com_vencimento, vencido, proximo
  const [docLinkFilter, setDocLinkFilter] = useState('all'); // all, com_link, sem_link
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);

  // Sync with settings
  useEffect(() => {
    if (settings && (settings as any).obrasUnidas) {
      setObras((settings as any).obrasUnidas);
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
    }, 4000);
  };

  const handleCreateNew = () => {
    const freshObra: ObraUnida = {
      id: Date.now().toString(),
      name: '',
      type: 'lar',
      address: '',
      phone: '',
      email: '',
      site: '',
      presidente: { name: '', phone: '' },
      vice1: { name: '', phone: '' },
      vice2: { name: '', phone: '' },
      secretario1: { name: '', phone: '' },
      secretario2: { name: '', phone: '' },
      tesoureiro1: { name: '', phone: '' },
      tesoureiro2: { name: '', phone: '' },
      conselheirosFiscais: [],
      customBoardRoles: [],
      startDate: '',
      endDate: '',
      fiscalStatus: 'regular',
      lastAuditDate: '',
      nextAuditDate: '',
      fiscalChecklist: {
        estatutoVigente: false,
        ataEleicao: false,
        cndFederal: false,
        cndEstadual: false,
        cndMunicipal: false,
        alvaraFuncionamento: false,
        cnpjRegular: false,
        balancoContabil: false,
      },
      fiscalReport: '',
    };
    setSelectedObra(ensureDefaultDocuments(freshObra));
    setIsEditing(true);
    setActiveSubTab('info');
    setShowAddCustomRole(false);
  };

  const handleEditClick = (obra: ObraUnida) => {
    setSelectedObra(ensureDefaultDocuments(JSON.parse(JSON.stringify(obra)))); // Deep clone & compliance initialization
    setIsEditing(true);
    setActiveSubTab('info');
    setShowAddCustomRole(false);
  };

  const handleSaveObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObra) return;
    if (!selectedObra.name.trim()) {
      showFeedback('O nome da Obra Unida é obrigatório', 'error');
      return;
    }

    setLoading(true);
    try {
      let updatedObras: ObraUnida[] = [];
      const index = obras.findIndex(o => o.id === selectedObra.id);
      if (index > -1) {
        // Update existing
        updatedObras = [...obras];
        updatedObras[index] = selectedObra;
      } else {
        // Create new
        updatedObras = [...obras, selectedObra];
      }

      const updatedSettings = {
        ...(settings || {}),
        obrasUnidas: updatedObras
      };

      await saveSettings(institutionId, updatedSettings);
      onSettingsChange(updatedSettings as any);
      setObras(updatedObras);
      setIsEditing(false);
      setSelectedObra(null);
      showFeedback('Obra Unida salva com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showFeedback('Erro ao salvar Obra Unida: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteObra = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover permanentemente a obra "${name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const updatedObras = obras.filter(o => o.id !== id);
      const updatedSettings = {
        ...(settings || {}),
        obrasUnidas: updatedObras
      };

      await saveSettings(institutionId, updatedSettings);
      onSettingsChange(updatedSettings as any);
      setObras(updatedObras);
      showFeedback('Obra Unida removida com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showFeedback('Erro ao remover Obra Unida: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sub-actions in secondary state
  const handleAddConselheiro = () => {
    if (!selectedObra) return;
    if (!newConselheiro.name.trim()) {
      showFeedback('Digite o nome do conselheiro fiscal', 'error');
      return;
    }
    const currentList = selectedObra.conselheirosFiscais || [];
    setSelectedObra({
      ...selectedObra,
      conselheirosFiscais: [...currentList, { ...newConselheiro }]
    });
    setNewConselheiro({ name: '', phone: '' });
  };

  const handleRemoveConselheiro = (idx: number) => {
    if (!selectedObra) return;
    const currentList = [...(selectedObra.conselheirosFiscais || [])];
    currentList.splice(idx, 1);
    setSelectedObra({
      ...selectedObra,
      conselheirosFiscais: currentList
    });
  };

  const handleAddCustomRole = () => {
    if (!selectedObra) return;
    if (!newCustomRole.roleName.trim() || !newCustomRole.name.trim()) {
      showFeedback('Nome do cargo e ocupante são obrigatórios', 'error');
      return;
    }
    const currentList = selectedObra.customBoardRoles || [];
    setSelectedObra({
      ...selectedObra,
      customBoardRoles: [...currentList, { ...newCustomRole, id: Date.now().toString() }]
    });
    setNewCustomRole({ id: '', roleName: '', name: '', phone: '' });
    setShowAddCustomRole(false);
  };

  const handleRemoveCustomRole = (id: string) => {
    if (!selectedObra) return;
    const currentList = (selectedObra.customBoardRoles || []).filter(r => r.id !== id);
    setSelectedObra({
      ...selectedObra,
      customBoardRoles: currentList
    });
  };

  const handleObraPerformTransition = () => {
    if (!selectedObra) return;
    if (!obraNewMandateStartDate || !obraNewMandateEndDate) {
      showFeedback('Por favor, preencha as datas de início e fim do novo mandato.', 'error');
      return;
    }

    const pastMandate: any = {
      id: Date.now().toString(),
      posseDate: selectedObra.startDate || 'Não cadastrada',
      mandateEndDate: selectedObra.endDate || 'Não cadastrada',
      presidente: { ...(selectedObra.presidente || { name: '', phone: '' }) },
      vice1: { ...(selectedObra.vice1 || { name: '', phone: '' }) },
      vice2: { ...(selectedObra.vice2 || { name: '', phone: '' }) },
      secretario1: { ...(selectedObra.secretario1 || { name: '', phone: '' }) },
      secretario2: { ...(selectedObra.secretario2 || { name: '', phone: '' }) },
      tesoureiro1: { ...(selectedObra.tesoureiro1 || { name: '', phone: '' }) },
      tesoureiro2: { ...(selectedObra.tesoureiro2 || { name: '', phone: '' }) },
      conselheirosFiscais: [...(selectedObra.conselheirosFiscais || [])],
      customBoardRoles: [...(selectedObra.customBoardRoles || [])],
      archivedAt: new Date().toISOString()
    };

    const currentHistory = selectedObra.mandateHistory || [];
    const updatedHistory = [pastMandate, ...currentHistory];

    let updatedObra = {
      ...selectedObra,
      startDate: obraNewMandateStartDate,
      endDate: obraNewMandateEndDate,
      mandateHistory: updatedHistory
    };

    if (!obraKeepCurrentAsDraft) {
      updatedObra = {
        ...updatedObra,
        presidente: { name: '', phone: '' },
        vice1: { name: '', phone: '' },
        vice2: { name: '', phone: '' },
        secretario1: { name: '', phone: '' },
        secretario2: { name: '', phone: '' },
        tesoureiro1: { name: '', phone: '' },
        tesoureiro2: { name: '', phone: '' },
        conselheirosFiscais: [],
        customBoardRoles: []
      };
    }

    setSelectedObra(updatedObra);
    setObraNewMandateStartDate('');
    setObraNewMandateEndDate('');
    setShowObraTransitionForm(false);

    showFeedback('Diretoria anterior da Obra Unida arquivada com sucesso! Ajuste os novos membros se necessário e lembre-se de salvar.', 'success');
  };

  const handleObraDeletePastMandate = (id: string) => {
    if (!selectedObra) return;
    if (!window.confirm('Tem certeza de que deseja remover este mandato do histórico da Obra Unida? Esta ação é definitiva.')) {
      return;
    }
    const currentHistory = selectedObra.mandateHistory || [];
    const updatedHistory = currentHistory.filter((m: any) => m.id !== id);
    setSelectedObra({
      ...selectedObra,
      mandateHistory: updatedHistory
    });
    showFeedback('Mandato anterior removido do histórico temporariamente. Clique em "Salvar" para gravar esta modificação.', 'success');
    if (selectedPastObraMandate && selectedPastObraMandate.id === id) {
      setSelectedPastObraMandate(null);
    }
  };

  // Filtering
  const filteredObras = obras.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.address && o.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Compliance documents calculations
  const docs = selectedObra ? ((selectedObra as any).documents || []) : [];
  const totalRegulares = docs.filter((d: any) => d.status === 'regular').length;
  const totalPendentes = docs.filter((d: any) => d.status === 'pendente').length;
  const totalVencidos = docs.filter((d: any) => d.status === 'vencido').length;
  const totalProximos = docs.filter((d: any) => d.status === 'próximo do vencimento').length;
  const totalSemLink = docs.filter((d: any) => (!d.link || d.link.trim() === '') && d.status !== 'não se aplica' && d.appliesToEntity !== false).length;
  const totalNaoSeAplica = docs.filter((d: any) => d.status === 'não se aplica' || d.appliesToEntity === false).length;

  const filteredDocs = docs.filter((doc: any) => {
    // Category filter
    if (docCategoryFilter !== 'all' && doc.category !== docCategoryFilter) return false;
    
    // Status filter
    if (docStatusFilter !== 'all' && doc.status !== docStatusFilter) return false;
    
    // Vencimento filter
    if (docVencimentoFilter !== 'all') {
      const isNoExp = isNoExpiryDoc(doc.name);
      if (docVencimentoFilter === 'sem_vencimento' && !isNoExp) return false;
      if (docVencimentoFilter === 'com_vencimento' && isNoExp) return false;
      if (docVencimentoFilter === 'vencido' && doc.status !== 'vencido') return false;
      if (docVencimentoFilter === 'proximo' && doc.status !== 'próximo do vencimento') return false;
    }
    
    // Link filter
    if (docLinkFilter !== 'all') {
      const hasLink = !!(doc.link && doc.link.trim() !== '');
      if (docLinkFilter === 'com_link' && !hasLink) return false;
      if (docLinkFilter === 'sem_link' && hasLink) return false;
    }
    
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-6 space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Feedbacks */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-xs font-black uppercase tracking-wider flex items-center gap-3 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-black uppercase tracking-wider flex items-center gap-3 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          {errorMsg}
        </div>
      )}

      {!isEditing ? (
        // List View
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                <Building2 size={12} />
                Controle do Conselho
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tighter">
                Obras Unidas Vinculadas
              </h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Acompanhamento e situação das Obras Administrativas
              </p>
            </div>
            <button
              onClick={handleCreateNew}
              className="w-full sm:w-auto px-8 py-4 bg-[#004c99] hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-100"
            >
              <Plus size={16} />
              Vincular Nova Obra
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="PESQUISAR POR NOME OU ENDEREÇO DA OBRA UNIDA..."
              className="w-full pl-12 pr-5 py-4 bg-white border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {/* List or grid */}
          {filteredObras.length === 0 ? (
            <div className="text-center py-16 bg-white border border-gray-100 rounded-3xl shadow-sm">
              <Building2 className="mx-auto text-gray-200 mb-3" size={48} />
              <p className="text-xs font-black uppercase text-gray-400 tracking-wider">
                Nenhuma Obra Unida encontrada no cadastro
              </p>
              <p className="text-[10px] font-bold text-gray-350 uppercase mt-1">
                Adicione as Obras Sociais clicando em "Vincular Nova Obra"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredObras.map((obra) => {
                const statusTheme = 
                  obra.fiscalStatus === 'regular' 
                    ? { bg: 'bg-green-50 text-green-700 border-green-100', dot: 'bg-green-500' }
                    : obra.fiscalStatus === 'em_regularizacao'
                      ? { bg: 'bg-yellow-50 text-yellow-800 border-yellow-100', dot: 'bg-yellow-500' }
                      : { bg: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' };

                const labelType = 
                  obra.type === 'lar' ? 'Lar de Idosos'
                  : obra.type === 'vila' ? 'Vila Vicentina'
                  : obra.type === 'santa_casa' ? 'Santa Casa' : 'Outros';

                return (
                  <div 
                    key={obra.id}
                    className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`px-3 py-1 border rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${statusTheme.bg}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${statusTheme.dot}`}></div>
                          Fiscal: {obra.fiscalStatus === 'em_regularizacao' ? 'Em Regularização' : obra.fiscalStatus}
                        </div>
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider px-2.5 py-0.5 bg-gray-50 rounded">
                          {labelType}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-gray-900 uppercase tracking-tight mb-2">
                        {obra.name || 'Sem Nome'}
                      </h3>

                      <div className="space-y-1.5 text-xs text-gray-500 font-medium mb-6">
                        {obra.address && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-gray-400 shrink-0" />
                            <span className="truncate uppercase">{obra.address}</span>
                          </div>
                        )}
                        {obra.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400 shrink-0" />
                            <span>{obra.phone}</span>
                          </div>
                        )}
                        {(obra.email || obra.site) && (
                          <div className="flex items-center gap-4">
                            {obra.email && (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Mail size={13} className="text-gray-400 shrink-0" />
                                <span className="truncate">{obra.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleDeleteObra(obra.id, obra.name)}
                        className="p-2.5 rounded-xl hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                        title="Remover Vinculação"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        onClick={() => handleEditClick(obra)}
                        className="px-5 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border border-gray-200"
                      >
                        <Edit2 size={12} />
                        Gerenciar Obra
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // Form & Details View with sub-tabs
        <div className="space-y-6 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setSelectedObra(null);
                }}
                className="p-3 hover:bg-gray-50 border border-gray-100 rounded-2xl text-gray-500 transition-all"
                title="Voltar para a Lista"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-tighter">
                  {selectedObra?.name ? `Editar Obra: ${selectedObra.name}` : 'Nova Obra Unida'}
                </h1>
                {obras.length > 0 && selectedObra?.id && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-black uppercase text-gray-400">Alternar Obra:</span>
                    <select
                      value={selectedObra.id}
                      onChange={(e) => {
                        const targetObra = obras.find(o => o.id === e.target.value);
                        if (targetObra) {
                          setSelectedObra(ensureDefaultDocuments(JSON.parse(JSON.stringify(targetObra))));
                          setEditingDoc(null); // Clear document edit state on switch
                          showFeedback(`Obra alterada para "${targetObra.name}"`, 'success');
                        }
                      }}
                      className="text-[10px] font-bold text-[#004c99] bg-blue-50 border border-blue-100 rounded-lg px-2 py-0.5 uppercase outline-none focus:ring-1 focus:ring-blue-100"
                    >
                      {obras.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name || 'Sem Nome'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!selectedObra?.id && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    Gerenciamento cadastral, estatutário e fiscal
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setSelectedObra(null);
                }}
                className="flex-1 sm:flex-none px-6 py-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveObra}
                disabled={loading}
                className="flex-1 sm:flex-none px-8 py-4 bg-[#004c99] hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {loading ? 'Salvando...' : 'Salvar Obra'}
              </button>
            </div>
          </div>

          {/* Sub tabs navigation */}
          <div className="flex gap-1.5 border-b border-gray-200 p-1 bg-white/70 backdrop-blur rounded-2xl border">
            {[
              { id: 'info', label: '1. Informações da Obra', icon: Building2 },
              { id: 'diretoria', label: '2. Diretoria e Mandato', icon: Users },
              { id: 'fiscal', label: '3. Controle Fiscal', icon: BadgeInfo }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex-1 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  activeSubTab === tab.id 
                    ? 'bg-[#004c99] text-white shadow' 
                    : 'bg-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub Tab Contents */}
          <form onSubmit={handleSaveObra} className="space-y-6">
            {activeSubTab === 'info' && selectedObra && (
              <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                      Identificação da Obra Unida
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Informações institucionais e canais de contato direto
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Nome da Obra Unida *
                    </label>
                    <input
                      type="text"
                      required
                      value={selectedObra.name}
                      onChange={(e) => setSelectedObra({ ...selectedObra, name: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      placeholder="Nome oficial da Obra Unida (Ex: Lar São Vicente de Paulo)"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Tipo de Obra
                    </label>
                    <select
                      value={selectedObra.type}
                      onChange={(e) => setSelectedObra({ ...selectedObra, type: e.target.value as any })}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                    >
                      <option value="lar">Lar de Idosos (ILPI)</option>
                      <option value="vila">Vila Vicentina</option>
                      <option value="santa_casa">Santa Casa</option>
                      <option value="outros">Outros Projetos</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      value={selectedObra.address}
                      onChange={(e) => setSelectedObra({ ...selectedObra, address: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Telefone Principal
                    </label>
                    <input
                      type="text"
                      value={selectedObra.phone}
                      onChange={(e) => setSelectedObra({ ...selectedObra, phone: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      E-mail Contato
                    </label>
                    <input
                      type="email"
                      value={selectedObra.email}
                      onChange={(e) => setSelectedObra({ ...selectedObra, email: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      placeholder="obra@unida.org.br"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Website Oficial
                    </label>
                    <input
                      type="text"
                      value={selectedObra.site || ''}
                      onChange={(e) => setSelectedObra({ ...selectedObra, site: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      placeholder="www.obraunida.org.br"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'diretoria' && selectedObra && (
              <div className="space-y-6">
                {/* Mandato */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                        Mandato de Gestão da Obra
                      </h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Vigência eletiva / corporativa da diretoria atual na entidade
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        Início do Mandato
                      </label>
                      <input
                        type="date"
                        value={selectedObra.startDate || ''}
                        onChange={(e) => setSelectedObra({ ...selectedObra, startDate: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        Fim do Mandato previsto
                      </label>
                      <input
                        type="date"
                        value={selectedObra.endDate || ''}
                        onChange={(e) => setSelectedObra({ ...selectedObra, endDate: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Ações de Transição de Mandato da Obra */}
                <div className="bg-white rounded-3xl border border-orange-100 p-6 sm:p-8 shadow-sm space-y-6 border-l-4 border-l-orange-500">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                        <RefreshCw size={20} className={showObraTransitionForm ? 'animate-spin' : ''} />
                      </div>
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                          Transição de Diretoria da Obra Unida
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                          Arquive a gestão estatutária atual no histórico e inicie uma nova vigência eletiva
                        </p>
                      </div>
                    </div>
                    {!showObraTransitionForm && (
                      <button
                        type="button"
                        onClick={() => setShowObraTransitionForm(true)}
                        className="px-4 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-105"
                      >
                        <RefreshCw size={12} />
                        Nova Gestão
                      </button>
                    )}
                  </div>

                  {showObraTransitionForm && (
                    <div className="p-6 rounded-2xl bg-orange-50/30 border border-orange-150 space-y-6 animate-in slide-in-from-top duration-300">
                      <div className="flex justify-between items-center pb-3 border-b border-orange-100">
                        <h3 className="text-xs font-black uppercase text-orange-850 tracking-wider">
                          Transição de Gestão: {selectedObra.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowObraTransitionForm(false)}
                          className="p-1 text-gray-400 hover:text-gray-655 rounded-full"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <p className="text-[11px] font-bold text-gray-500 uppercase leading-relaxed">
                        Aviso: Os membros atuais serão arquivados permanentemente no histórico sob as datas de vigência do mandato atual (<span className="text-gray-800 font-extrabold">{selectedObra.startDate || 'Não cadastrada'}</span> a <span className="text-gray-800 font-extrabold">{selectedObra.endDate || 'Não cadastrada'}</span>).
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                            Início do Novo Mandato *
                          </label>
                          <input
                            type="date"
                            value={obraNewMandateStartDate}
                            onChange={(e) => setObraNewMandateStartDate(e.target.value)}
                            className="w-full px-4 py-3 border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 bg-white shadow-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                            Fim do Novo Mandato Previsto *
                          </label>
                          <input
                            type="date"
                            value={obraNewMandateEndDate}
                            onChange={(e) => setObraNewMandateEndDate(e.target.value)}
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
                              checked={obraKeepCurrentAsDraft}
                              onChange={() => setObraKeepCurrentAsDraft(true)}
                              className="mt-0.5 text-orange-600 focus:ring-orange-500"
                            />
                            <div>
                              <span className="text-xs font-black text-gray-750 uppercase block">Manter membros como rascunho</span>
                              <span className="text-[9px] text-gray-400 font-semibold uppercase">Os membros atuais continuarão preenchidos para você apenas atualizar o que alterou.</span>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 p-3 bg-white border border-orange-100 rounded-xl cursor-pointer">
                            <input
                              type="radio"
                              checked={!obraKeepCurrentAsDraft}
                              onChange={() => setObraKeepCurrentAsDraft(false)}
                              className="mt-0.5 text-orange-600 focus:ring-orange-500"
                            />
                            <div>
                              <span className="text-xs font-black text-gray-750 uppercase block">Limpar todos os nomes</span>
                              <span className="text-[9px] text-gray-400 font-semibold uppercase">Esvaziar todos os campos de diretoria titular, fiscal e adicionais.</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end border-t border-orange-100 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowObraTransitionForm(false)}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-gray-150 text-gray-400"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleObraPerformTransition}
                          className="px-6 py-2 bg-orange-600 hover:bg-orange-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-orange-100"
                        >
                          Confirmar e Iniciar Novo Mandato
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Diretoria Titular */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-8">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c99] flex items-center justify-center">
                      <Users size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                        Membros Estatutários / Executivos
                      </h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Gestores em exercício cadastrados
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {[
                      { label: 'Presidente', key: 'presidente' },
                      { label: 'Vice-Presidente 1', key: 'vice1' },
                      { label: 'Vice-Presidente 2', key: 'vice2' },
                      { label: 'Primeiro(a) Secretário(a)', key: 'secretario1' },
                      { label: 'Segundo(a) Secretário(a)', key: 'secretario2' },
                      { label: 'Primeiro(a) Tesoureiro(a)', key: 'tesoureiro1' },
                      { label: 'Segundo(a) Tesoureiro(a)', key: 'tesoureiro2' },
                    ].map((role) => {
                      const member = (selectedObra as any)[role.key] || { name: '', phone: '' };
                      return (
                        <div key={role.key} className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100/70 space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#004c99]">
                            {role.label}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase text-gray-400">Nome Ocupante</span>
                              <input
                                type="text"
                                value={member.name}
                                onChange={(e) => {
                                  setSelectedObra({
                                    ...selectedObra,
                                    [role.key]: { ...member, name: e.target.value }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-blue-200"
                                placeholder="Completo"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase text-gray-400">Celular / Whats</span>
                              <input
                                type="text"
                                value={member.phone}
                                onChange={(e) => {
                                  setSelectedObra({
                                    ...selectedObra,
                                    [role.key]: { ...member, phone: e.target.value }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-blue-200"
                                placeholder="(00) 00000-0000"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conselheiros Fiscais */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                      Conselheiros Fiscais da Unidade
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Inserção de múltiplos relatores contábeis e fiscais
                    </p>
                  </div>

                  {/* Add Area */}
                  <div className="p-4 rounded-2xl bg-orange-50/20 border border-orange-100/50 space-y-3">
                    <span className="text-[10px] font-black uppercase text-orange-800 tracking-wider">
                      Adicionar Conselheiro Fiscal
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Nome</span>
                        <input
                          type="text"
                          value={newConselheiro.name}
                          onChange={(e) => setNewConselheiro({ ...newConselheiro, name: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-orange-200"
                          placeholder="Nome do Conselheiro"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Telefone</span>
                        <input
                          type="text"
                          value={newConselheiro.phone}
                          onChange={(e) => setNewConselheiro({ ...newConselheiro, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-orange-200"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddConselheiro}
                        className="px-4 py-2.5 bg-orange-600 hover:bg-orange-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Inserir Conselheiro
                      </button>
                    </div>
                  </div>

                  {/* List of conselheiros */}
                  {(!selectedObra.conselheirosFiscais || selectedObra.conselheirosFiscais.length === 0) ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 text-[10px] font-black uppercase tracking-wider">
                      Nenhum conselheiro fiscal vinculado
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedObra.conselheirosFiscais.map((cf, index) => (
                        <div key={index} className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between bg-white shadow-sm">
                          <div>
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{cf.name}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{cf.phone || 'Sem celular'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveConselheiro(index)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all border border-transparent"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Funções Adicionais / Personalizadas */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                        Outras Funções de Diretoria
                      </h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Gestor espiritual, assessoria jurídica ou cargo local adicional
                      </p>
                    </div>
                    {!showAddCustomRole && (
                      <button
                        type="button"
                        onClick={() => setShowAddCustomRole(true)}
                        className="px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                      >
                        <Plus size={14} />
                        Gerar Função
                      </button>
                    )}
                  </div>

                  {showAddCustomRole && (
                    <div className="p-4 rounded-2xl bg-purple-50/20 border border-purple-100/50 space-y-3">
                      <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider">
                        Criar Nova Função Local
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-gray-400">Cargo / Função</span>
                          <input
                            type="text"
                            value={newCustomRole.roleName}
                            onChange={(e) => setNewCustomRole({ ...newCustomRole, roleName: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-purple-200"
                            placeholder="Ex: Assessor Espiritual"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-gray-400">Nome</span>
                          <input
                            type="text"
                            value={newCustomRole.name}
                            onChange={(e) => setNewCustomRole({ ...newCustomRole, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-purple-200"
                            placeholder="Nome Completo"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-gray-400">Telefone</span>
                          <input
                            type="text"
                            value={newCustomRole.phone}
                            onChange={(e) => setNewCustomRole({ ...newCustomRole, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-purple-200"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddCustomRole(false)}
                          className="px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest text-gray-400 uppercase hover:bg-gray-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomRole}
                          className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[9px] font-black tracking-widest uppercase"
                        >
                          Criar
                        </button>
                      </div>
                    </div>
                  )}

                  {(!selectedObra.customBoardRoles || selectedObra.customBoardRoles.length === 0) ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 text-[10px] font-black uppercase tracking-wider">
                      Sem funções locais adicionais cadastradas
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedObra.customBoardRoles.map((r) => (
                        <div key={r.id} className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between bg-white shadow-sm relative group">
                          <div>
                            <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">{r.roleName}</p>
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tight mt-0.5">{r.name}</p>
                            {r.phone && <p className="text-[10px] text-gray-450 font-bold mt-0.5">{r.phone}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomRole(r.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all border border-transparent"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Histórico de Mandatos Anteriores da Obra Unida */}
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
                        Consulte as antigas diretorias registradas para esta unidade
                      </p>
                    </div>
                  </div>

                  {(!selectedObra.mandateHistory || selectedObra.mandateHistory.length === 0) ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                      <History className="mx-auto text-gray-250 mb-2" size={24} />
                      <p className="text-[10px] font-black uppercase text-gray-300 tracking-wider">
                        Nenhum mandato arquivado ainda nesta unidade
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedObra.mandateHistory.map((m: any) => {
                        const isSelected = selectedPastObraMandate?.id === m.id;
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
                                  Presidente: {m.presidente?.name || 'Não registrado'} {m.presidente?.phone ? `(${m.presidente.phone})` : ''}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPastObraMandate(isSelected ? null : m)}
                                  className="px-4 py-2 border border-gray-200 rounded-xl text-[9px] font-black uppercase tracking-wider bg-white hover:bg-gray-50 text-gray-600 flex items-center gap-1 transition-all"
                                >
                                  <FileText size={12} />
                                  {isSelected ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleObraDeletePastMandate(m.id)}
                                  className="p-2 border border-red-100 hover:border-red-200 rounded-xl text-red-550 hover:bg-red-50 transition-all bg-white"
                                  title="Remover do Histórico"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="p-6 bg-white border-t border-gray-50 animate-in fade-in duration-205 space-y-4">
                                <h5 className="text-[10px] font-black uppercase text-[#004c99] tracking-wider pb-1 border-b border-dashed border-gray-100">
                                  Membros da Diretoria na Gestão
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs font-semibold uppercase text-gray-650">
                                  {[
                                    { title: 'Presidente', name: m.presidente?.name, phone: m.presidente?.phone },
                                    { title: 'Vice-Presidente 1', name: m.vice1?.name, phone: m.vice1?.phone },
                                    { title: 'Vice-Presidente 2', name: m.vice2?.name, phone: m.vice2?.phone },
                                    { title: 'Primeiro Secretário', name: m.secretario1?.name, phone: m.secretario1?.phone },
                                    { title: 'Segundo Secretário', name: m.secretario2?.name, phone: m.secretario2?.phone },
                                    { title: 'Primeiro Tesoureiro', name: m.tesoureiro1?.name, phone: m.tesoureiro1?.phone },
                                    { title: 'Segundo Tesoureiro', name: m.tesoureiro2?.name, phone: m.tesoureiro2?.phone },
                                  ].map((role, rIdx) => {
                                    if (!role.name) return null;
                                    return (
                                      <div key={rIdx} className="p-2.5 rounded-xl bg-gray-50/55 border border-gray-100">
                                        <span className="text-[9px] font-black text-gray-400 block mb-0.5">{role.title}</span>
                                        <p className="text-[11px] font-black text-gray-800 tracking-tight">{role.name}</p>
                                        {role.phone && <p className="text-[10px] text-gray-400 mt-0.5 font-bold">{role.phone}</p>}
                                      </div>
                                    );
                                  })}
                                </div>

                                {m.conselheirosFiscais && m.conselheirosFiscais.length > 0 && (
                                  <div className="space-y-2 mt-4">
                                    <h5 className="text-[9px] font-black uppercase text-orange-700 tracking-wider block">
                                      Conselheiros Fiscais da Gestão
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {m.conselheirosFiscais.map((cf: any, cfIdx: number) => (
                                        <div key={cfIdx} className="p-2.5 rounded-xl bg-orange-50/10 border border-orange-100/30">
                                          <p className="text-[11px] font-black text-gray-850 tracking-tight">{cf.name}</p>
                                          {cf.phone && <p className="text-[10px] text-gray-450 mt-0.5 font-bold">{cf.phone}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {m.customBoardRoles && m.customBoardRoles.length > 0 && (
                                  <div className="space-y-2 mt-4">
                                    <h5 className="text-[9px] font-black uppercase text-purple-700 tracking-wider block">
                                      Outras Funções no Mandato
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {m.customBoardRoles.map((cr: any) => (
                                        <div key={cr.id} className="p-2.5 rounded-xl bg-purple-50/10 border border-purple-100/30">
                                          <span className="text-[9px] font-black text-purple-500 block mb-0.5">{cr.roleName}</span>
                                          <p className="text-[11px] font-black text-gray-855 tracking-tight">{cr.name}</p>
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

            {activeSubTab === 'fiscal' && selectedObra && (
              <div id="obras_fiscal_tab_container" className="space-y-6">
                {/* Status e Auditoria */}
                <div id="fiscal_status_audit_card" className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                        Regularização e Auditoria Fiscal
                      </h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        Diagnóstico administrativo-fiscal da entidade perante o Conselho Central
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        Situação de Regularidade geral
                      </label>
                      <select
                        id="obra_fiscal_status_select"
                        value={selectedObra.fiscalStatus}
                        onChange={(e) => setSelectedObra({ ...selectedObra, fiscalStatus: e.target.value as any })}
                        className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      >
                        <option value="regular">Regular / Sem Pendências</option>
                        <option value="em_regularizacao">Em Regularização / Transição de Diretoria</option>
                        <option value="irregular">Irregular / Pendências Críticas</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        Última Visita / Auditoria
                      </label>
                      <input
                        id="obra_last_audit_date"
                        type="date"
                        value={selectedObra.lastAuditDate || ''}
                        onChange={(e) => setSelectedObra({ ...selectedObra, lastAuditDate: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        Próxima Inspeção Prevista
                      </label>
                      <input
                        id="obra_next_audit_date"
                        type="date"
                        value={selectedObra.nextAuditDate || ''}
                        onChange={(e) => setSelectedObra({ ...selectedObra, nextAuditDate: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* CARDS DE RESUMO DOCUMENTAL */}
                <div id="compliance_summary_cards" className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  {/* Regulares */}
                  <div id="summary_card_regulares" className="bg-green-50 border border-green-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-green-800">Doc. Regulares</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-black text-green-900 leading-none">{totalRegulares}</span>
                      <ShieldCheck size={18} className="text-green-600" />
                    </div>
                  </div>

                  {/* Pendentes */}
                  <div id="summary_card_pendentes" className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-800">Doc. Pendentes</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-black text-amber-900 leading-none">{totalPendentes}</span>
                      <Clock size={18} className="text-amber-600" />
                    </div>
                  </div>

                  {/* Vencidos */}
                  <div id="summary_card_vencidos" className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-800">Doc. Vencidos</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-black text-red-900 leading-none">{totalVencidos}</span>
                      <AlertTriangle size={18} className="text-red-600" />
                    </div>
                  </div>

                  {/* Próximos do Vencimento */}
                  <div id="summary_card_proximos" className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-850">Próx. Vencimento</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-black text-orange-900 leading-none">{totalProximos}</span>
                      <CalendarDays size={18} className="text-orange-600" />
                    </div>
                  </div>

                  {/* Sem Link Informado */}
                  <div id="summary_card_semlink" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-800">Sem Link Pasta</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-black text-blue-900 leading-none">{totalSemLink}</span>
                      <FileText size={18} className="text-blue-600" />
                    </div>
                  </div>

                  {/* Não se Aplica */}
                  <div id="summary_card_naoaplica" className="bg-gray-100 border border-gray-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-550">Não se Aplica</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-black text-gray-800 leading-none">{totalNaoSeAplica}</span>
                      <X size={18} className="text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO PRINCIPAL COM TABELA DE DOCUMENTOS E PAINEL LATERAL */}
                <div id="compliance_split_workspace" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* TABELA DE DOCUMENTOS COM FILTROS */}
                  <div id="compliance_table_area" className={editingDoc ? "lg:col-span-7 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4" : "lg:col-span-12 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6"}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-4 gap-2">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                          <Landmark size={16} className="text-[#004c99]" />
                          Lista de Documentos Obrigatórios ({filteredDocs.length})
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                          Preencha a situação documental e informe o link de cada item abaixo
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDocCategoryFilter('all');
                          setDocStatusFilter('all');
                          setDocVencimentoFilter('all');
                          setDocLinkFilter('all');
                        }}
                        className="text-[10px] text-gray-400 hover:text-red-650 font-black uppercase tracking-wider underline cursor-pointer"
                      >
                        Limpar Filtros
                      </button>
                    </div>

                    {/* FILTROS DA TABELA */}
                    <div id="compliance_table_filters" className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl">
                      {/* Categoria */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-gray-400">Categoria</label>
                        <select
                          id="filter_doc_category"
                          value={docCategoryFilter}
                          onChange={(e) => setDocCategoryFilter(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 uppercase outline-none focus:ring-1 focus:ring-blue-100"
                        >
                          <option value="all">TODAS CATEGORIAS</option>
                          <option value="Institucional e Governança">Governança</option>
                          <option value="Alvarás e Funcionamento">Alvarás / Func.</option>
                          <option value="Certidões Negativas">Certidões Negativas</option>
                          <option value="Conselhos e Assistência Social">Conselhos</option>
                          <option value="Contratos">Contratos</option>
                          <option value="Trabalhista e RH">Trabalhista & RH</option>
                          <option value="Contábil e Financeiro">Financeiro / Contábil</option>
                          <option value="Emendas, Subvenções e Parcerias">Emendas / Parcerias</option>
                        </select>
                      </div>

                      {/* Status */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-gray-400">Situação</label>
                        <select
                          id="filter_doc_status"
                          value={docStatusFilter}
                          onChange={(e) => setDocStatusFilter(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 uppercase outline-none focus:ring-1 focus:ring-blue-100"
                        >
                          <option value="all">TODOS STATUS</option>
                          <option value="regular">REGULAR</option>
                          <option value="pendente">PENDENTE</option>
                          <option value="vencido">VENCIDO</option>
                          <option value="próximo do vencimento">PRÓX. VENCIMENTO</option>
                          <option value="em renovação">EM RENOVAÇÃO</option>
                          <option value="precisa atualização">PRECISA ATUALIZAÇÃO</option>
                          <option value="não se aplica">NÃO SE APLICA</option>
                          <option value="aguardando aprovação/homologação">AGUARDANDO APROV.</option>
                        </select>
                      </div>

                      {/* Vencimento */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-gray-400">Vencimento</label>
                        <select
                          id="filter_doc_expiration"
                          value={docVencimentoFilter}
                          onChange={(e) => setDocVencimentoFilter(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 uppercase outline-none focus:ring-1 focus:ring-blue-100"
                        >
                          <option value="all">TODOS TEMPOS</option>
                          <option value="com_vencimento">COM VENCIMENTO</option>
                          <option value="sem_vencimento">SEM VENCIMENTO (PERMANENTES)</option>
                          <option value="vencido">VENCIDOS</option>
                          <option value="proximo">PRÓXIMOS DO VENCIM.</option>
                        </select>
                      </div>

                      {/* Link Pendency */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-gray-400">Link Pasta</label>
                        <select
                          id="filter_doc_link"
                          value={docLinkFilter}
                          onChange={(e) => setDocLinkFilter(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 uppercase outline-none focus:ring-1 focus:ring-blue-100"
                        >
                          <option value="all">TODOS LINKS</option>
                          <option value="com_link">COM LINK CADASTRADO</option>
                          <option value="sem_link">SEM LINK CADASTRADO</option>
                        </select>
                      </div>
                    </div>

                    {/* RENDERING DOCUMENTS TABLE */}
                    {filteredDocs.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-150 rounded-2xl text-gray-450 uppercase text-[10px] font-black">
                        Nenhum documento atende aos filtros selecionados.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table id="compliance_list_table" className="w-full text-left text-xs">
                          <thead className="bg-gray-100 text-gray-500 uppercase tracking-wider text-[9px] font-black">
                            <tr>
                              <th className="px-4 py-3">Documento / Categoria</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-3 py-3">Obrig.</th>
                              <th className="px-3 py-3">Validade / Registro</th>
                              <th className="px-3 py-3 text-center">Pasta Link</th>
                              <th className="px-3 py-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {filteredDocs.map((doc: any) => {
                              const isNoExp = isNoExpiryDoc(doc.name);
                              
                              // Badges configuration
                              const isMandatory = doc.mandatory || false;
                              const hasDoc = doc.hasDocument || false;
                              const isDocApplies = doc.appliesToEntity !== false;
                              
                              const statusStyles: Record<string, { bg: string, text: string }> = {
                                'regular': { bg: 'bg-green-50', text: 'text-green-700' },
                                'pendente': { bg: 'bg-amber-50', text: 'text-amber-800' },
                                'vencido': { bg: 'bg-red-50', text: 'text-red-700' },
                                'próximo do vencimento': { bg: 'bg-orange-50', text: 'text-orange-850' },
                                'em renovação': { bg: 'bg-indigo-50', text: 'text-indigo-700' },
                                'precisa atualização': { bg: 'bg-rose-50', text: 'text-rose-700' },
                                'não se aplica': { bg: 'bg-gray-100', text: 'text-gray-500' },
                                'aguardando aprovação/homologação': { bg: 'bg-blue-50', text: 'text-blue-700' }
                              };
                              const currentStyle = statusStyles[doc.status] || { bg: 'bg-gray-50', text: 'text-gray-650' };

                              return (
                                <tr key={doc.id} className={`hover:bg-gray-50/50 transition-all ${editingDoc?.id === doc.id ? 'bg-indigo-50/30' : ''}`}>
                                  {/* Document and Category */}
                                  <td className="px-4 py-3.5">
                                    <p className="font-extrabold text-gray-800 uppercase tracking-tight text-[11px] leading-tight">
                                      {doc.name}
                                    </p>
                                    <p className="text-[9px] uppercase font-bold text-gray-400 mt-0.5">
                                      {doc.category}
                                    </p>
                                  </td>

                                  {/* Status Badge */}
                                  <td className="px-4 py-3.5">
                                    <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border border-neutral-100 ${currentStyle.bg} ${currentStyle.text}`}>
                                      {doc.status}
                                    </span>
                                  </td>

                                  {/* Mandatory */}
                                  <td className="px-3 py-3.5 font-bold">
                                    {isMandatory ? (
                                      <span className="text-red-600 px-1 border border-red-100 bg-red-50 text-[9px] rounded font-black uppercase">Sim</span>
                                    ) : (
                                      <span className="text-gray-400 text-[9px] font-semibold uppercase">Não</span>
                                    )}
                                  </td>

                                  {/* Date Column */}
                                  <td className="px-3 py-3.5 text-[10px] text-gray-600 font-semibold">
                                    {isNoExp ? (
                                      doc.homologationDate ? (
                                        <span className="text-gray-700">
                                          Homolog.: <strong className="font-bold">{doc.homologationDate.split('-').reverse().join('/')}</strong>
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 italic">Sem homolog.</span>
                                      )
                                    ) : (
                                      doc.expiryDate ? (
                                        <span className={doc.status === 'vencido' ? 'text-red-650 font-bold' : doc.status === 'próximo do vencimento' ? 'text-orange-650 font-bold' : ''}>
                                          Venc.: <strong className="font-bold">{doc.expiryDate.split('-').reverse().join('/')}</strong>
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 italic">Sem vencimento</span>
                                      )
                                    )}
                                  </td>

                                  {/* Document Link */}
                                  <td className="px-3 py-3.5 text-center">
                                    {doc.link && doc.link.trim() !== '' ? (
                                      <a
                                        href={doc.link.startsWith('http') ? doc.link : `https://${doc.link}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex p-1.5 bg-blue-50 hover:bg-blue-100 text-[#004c99] rounded-lg transition-all"
                                        title="Abrir pasta/documento correspondente"
                                      >
                                        <ExternalLink size={12} />
                                      </a>
                                    ) : (
                                      <span className="text-[8px] font-black uppercase tracking-wider text-amber-600 px-1.5 py-0.5 bg-amber-50 border border-amber-100 rounded" title="Link não informado">
                                        Pendente
                                      </span>
                                    )}
                                  </td>

                                  {/* Action */}
                                  <td className="px-3 py-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDoc({ ...doc })}
                                      className="px-3 py-1.5 bg-[#004c99] hover:bg-blue-800 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all"
                                    >
                                      Editar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* FORMULÁRIO DE DETALHES DO DOCUMENTO SELECIONADO (SIDEBAR DRAWER) */}
                  {editingDoc && (
                    <div id="compliance_editor_panel" className="lg:col-span-5 bg-[#faf9f6] border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-md self-start space-y-6 sticky top-6">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-black tracking-widest text-[#004c99]">Gerenciador Geral</span>
                          <h4 className="text-xs font-black uppercase text-gray-800 tracking-tight mt-0.5 truncate max-w-[210px]" title={editingDoc.name}>
                            {editingDoc.name}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingDoc(null)}
                          className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-700 rounded-xl transition-all"
                          title="Fechar Painel"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {/* Nome do Documento */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Nome do Documento</label>
                          <input
                            type="text"
                            value={editingDoc.name}
                            onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-blue-100"
                          />
                        </div>

                        {/* Categoria */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Categoria</label>
                          <select
                            value={editingDoc.category}
                            onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-blue-100"
                          >
                            <option value="Institucional e Governança">Institucional e Governança</option>
                            <option value="Alvarás e Funcionamento">Alvarás e Funcionamento</option>
                            <option value="Certidões Negativas">Certidões Negativas</option>
                            <option value="Conselhos e Assistência Social">Conselhos e Assistência Social</option>
                            <option value="Contratos">Contratos</option>
                            <option value="Trabalhista e RH">Trabalhista e RH</option>
                            <option value="Contábil e Financeiro">Contábil e Financeiro</option>
                            <option value="Emendas, Subvenções e Parcerias">Emendas, Subvenções e Parcerias</option>
                          </select>
                        </div>

                        {/* Toggles (Obrigatório, Aplica-se à Entidade, Possui Documento) */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-400">Obrigatório?</label>
                            <select
                              value={editingDoc.mandatory ? 'sim' : 'nao'}
                              onChange={(e) => setEditingDoc({ ...editingDoc, mandatory: e.target.value === 'sim' })}
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-100"
                            >
                              <option value="sim">Sim</option>
                              <option value="nao">Não</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-400">Aplica-se?</label>
                            <select
                              value={editingDoc.appliesToEntity !== false ? 'sim' : 'nao'}
                              onChange={(e) => {
                                const applies = e.target.value === 'sim';
                                setEditingDoc({ 
                                  ...editingDoc, 
                                  appliesToEntity: applies,
                                  status: applies ? 'pendente' : 'não se aplica'
                                });
                              }}
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-100"
                            >
                              <option value="sim">Sim</option>
                              <option value="nao">Não</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-400">Possui Doc?</label>
                            <select
                              value={editingDoc.hasDocument ? 'sim' : 'nao'}
                              onChange={(e) => setEditingDoc({ ...editingDoc, hasDocument: e.target.value === 'sim' })}
                              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-100"
                            >
                              <option value="sim">Sim</option>
                              <option value="nao">Não</option>
                            </select>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Situação / Status Atual</label>
                          <select
                            value={editingDoc.status}
                            onChange={(e) => setEditingDoc({ ...editingDoc, status: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-blue-100 text-gray-800"
                          >
                            <option value="regular">REGULAR</option>
                            <option value="pendente">PENDENTE</option>
                            <option value="vencido">VENCIDO</option>
                            <option value="próximo do vencimento">PRÓXIMO DO VENCIMENTO</option>
                            <option value="em renovação">EM RENOVAÇÃO</option>
                            <option value="precisa atualização">PRECISA ATUALIZAÇÃO</option>
                            <option value="não se aplica">NÃO SE APLICA</option>
                            <option value="aguardando aprovação/homologação">AGUARDANDO APROVAÇÃO/HOMOLOGAÇÃO</option>
                          </select>
                        </div>

                        {/* Link ou Pasta */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Link do Documento ou da Pasta</label>
                          <input
                            type="text"
                            value={editingDoc.link || ''}
                            onChange={(e) => setEditingDoc({ ...editingDoc, link: e.target.value })}
                            placeholder="https://drive.google.com/..."
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-blue-100"
                          />
                        </div>

                        {/* Exercício ou Competência */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Exercício ou Competência (se aplicável)</label>
                          <input
                            type="text"
                            value={editingDoc.period || ''}
                            onChange={(e) => setEditingDoc({ ...editingDoc, period: e.target.value })}
                            placeholder="Ex: 2025 ou Competência Maio/2026"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-blue-100 uppercase"
                          />
                        </div>

                        {/* Datas de Emissão, Vencimento, Homologação */}
                        <div className="grid grid-cols-2 gap-3 pb-2 border-b border-gray-100">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-400">Data de Emissão (opc.)</label>
                            <input
                              type="date"
                              value={editingDoc.issueDate || ''}
                              onChange={(e) => setEditingDoc({ ...editingDoc, issueDate: e.target.value })}
                              className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-100"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-gray-400">
                              {isNoExpiryDoc(editingDoc.name) ? 'Registro / Homologação' : 'Data de Vencimento'}
                            </label>
                            {isNoExpiryDoc(editingDoc.name) ? (
                              <input
                                type="date"
                                value={editingDoc.homologationDate || ''}
                                onChange={(e) => setEditingDoc({ ...editingDoc, homologationDate: e.target.value })}
                                className="w-full p-2 bg-white border border-orange-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-orange-200"
                              />
                            ) : (
                              <input
                                type="date"
                                value={editingDoc.expiryDate || ''}
                                onChange={(e) => setEditingDoc({ ...editingDoc, expiryDate: e.target.value })}
                                className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-100"
                              />
                            )}
                          </div>
                        </div>

                        {isNoExpiryDoc(editingDoc.name) && (
                          <div className="text-[10px] text-orange-850 bg-orange-50/50 p-3 rounded-xl border border-orange-100 leading-normal flex items-start gap-2">
                            <Info size={14} className="shrink-0 text-orange-600 mt-0.5" />
                            <span>
                              Este documento (<strong>{editingDoc.name}</strong>) é permanente e sem data de vencimento padrão. Seu controle de vigência é feito com base na data de homologação, aprovação, registro ou última atualização.
                            </span>
                          </div>
                        )}

                        {/* Observações */}
                        <div className="space-y-1 font-medium">
                          <label className="text-[9px] font-black uppercase text-gray-400">Observações adicionais</label>
                          <textarea
                            value={editingDoc.notes || ''}
                            onChange={(e) => setEditingDoc({ ...editingDoc, notes: e.target.value })}
                            placeholder="Anote detalhes de andamento, renovação de contrato ou pendências excepcionais..."
                            rows={3}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-100 resize-none uppercase"
                          />
                        </div>
                      </div>

                      {/* Ações da Sidebar */}
                      <div className="flex gap-2 pt-4 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => setEditingDoc(null)}
                          className="flex-1 py-3 border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedObra) return;
                            const finalDoc = { ...editingDoc };
                            const updatedDocs = docs.map((d: any) => d.id === finalDoc.id ? finalDoc : d);
                            setSelectedObra({
                              ...selectedObra,
                              documents: updatedDocs
                            } as any);
                            setEditingDoc(null);
                            showFeedback(`Documento "${finalDoc.name}" atualizado! Lembre-se de salvar a ficha da obra.`, 'success');
                          }}
                          className="flex-1 py-3 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Relato e Observações Finais do Conselho Fiscal */}
                <div id="fiscal_parecer_block" className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">
                      Parecer / Relatório Sintético do Conselho Fiscal
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      Descreva visitas periódicas, ressalvas orçamentárias gerais ou pendências críticas
                    </p>
                  </div>
                  <textarea
                    id="fiscal_parecer_textarea"
                    value={selectedObra.fiscalReport || ''}
                    onChange={(e) => setSelectedObra({ ...selectedObra, fiscalReport: e.target.value })}
                    className="w-full px-5 py-4 border border-gray-200 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all bg-white min-h-[120px] resize-y"
                    placeholder="DIGITE AQUI O PARECER DETALHADO DO CONSELHO FISCAL COMPORTANDO HISTÓRICOS DE RECEITA, SEGUROS OU APONTAMENTOS DE AUDITORIA..."
                  />
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

import { PsychologyFullHistory } from './PsychologyFullHistory';
import React, { useState, useEffect } from 'react';
import { Resident, Candidate, NutritionalEvolution, NutritionalAttendance, PsychologicalEvolution, PsychologicalAttendance, MuralMessage } from '../types';
import { Search, Save, AlertTriangle, Plus, ChevronRight, ChevronDown, ArrowLeft, HeartPulse, Users, Activity, FileSearch, X, User, Printer, FileSpreadsheet, Eye, Clock } from 'lucide-react';
import { fetchResidentById, fetchMultidisciplinaryHistory, getProfessionalSignature, apiFetch } from '../lib/api';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';
import { printAttendanceHtmlPdf } from '../lib/pdfHelpers';

import 'jspdf-autotable';
import OccupationalTherapyTab from './OccupationalTherapyTab';
import GroupActivityTab from './GroupActivityTab';
import SocialWorkerTab from './SocialWorkerTab';
import PhysiotherapyTab from './PhysiotherapyTab';
import PsychologyJobCandidatesSection from './PsychologyJobCandidatesSection';
import BirthdaySection from './BirthdaySection';

import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { StandardEvolutionForm } from './StandardEvolutionForm';
import { StandardEvolutionHistory } from './StandardEvolutionHistory';

export interface MultidisciplinaryModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  candidates?: Candidate[];
  onSaveCandidate?: (candidate: Candidate) => void;
  accessLevel?: string;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
  settings?: any;
}

const MultidisciplinaryModule: React.FC<MultidisciplinaryModuleProps> = ({ residents, onSaveResident, candidates = [], onSaveCandidate, accessLevel, onPostToMural, settings }) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [targetType, setTargetType] = useState<'resident' | 'candidate' | 'job_candidate'>('resident');
  const [activeCompetence, setActiveCompetence] = useState<string | null>(null);
  const [competenceMode, setCompetenceMode] = useState<'individual' | 'grupo' | 'aniversariantes'>('individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const isAssistenteSocial = accessLevel === 'assistente_social';
  const isPsicologia = accessLevel === 'psicologia';
  const isTerapeutaOcupacional = accessLevel === 'terapeuta_ocupacional';
  const isFisioterapeuta = accessLevel === 'fisioterapeuta';
  const isNutricionista = accessLevel === 'nutricionista';

  const [activeTab, setActiveTab] = useState<'avaliacao' | 'evolucao' | 'atendimentos' | 'anamnese' | 'historico'>('avaliacao');
  const [fullResident, setFullResident] = useState<Resident | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    if (targetType === 'candidate' && activeCompetence === 'psicologia') {
      setActiveTab('atendimentos');
    } else if (activeCompetence === 'psicologia') {
      setActiveTab('historico');
    } else {
      setActiveTab('avaliacao');
    }
  }, [targetType, activeCompetence]);

  useEffect(() => {
    if (selectedResidentId) {
      const loadFullResident = async () => {
        try {
          const sessionStr = localStorage.getItem('ssvp_session');
          if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const instId = session.institutionId || session.cnpj;
            const res = await fetchResidentById(selectedResidentId, instId);
            setFullResident(res);
          }
        } catch (error) {
          console.error("Erro ao carregar residente completo:", error);
        }
      };
      loadFullResident();
    } else {
      setFullResident(null);
    }
  }, [selectedResidentId]);

  useEffect(() => {
    if (activeCompetence) {
      const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const sessionStr = localStorage.getItem('ssvp_session');
          if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const instId = session.institutionId || session.cnpj;
            const historyData = await fetchMultidisciplinaryHistory(instId, activeCompetence);
            setHistory(historyData);
          }
        } catch (error) {
          console.error("Erro ao carregar histórico:", error);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      loadHistory();
    } else {
      setHistory([]);
    }
  }, [activeCompetence]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.search-container')) {
          setIsDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const competencies = [
    { id: 'nutricionista', label: 'Nutricionista', icon: HeartPulse, allowed: !isAssistenteSocial && !isPsicologia && !isTerapeutaOcupacional && !isFisioterapeuta },
    { id: 'psicologia', label: 'Psicologia', icon: Users, allowed: !isAssistenteSocial && !isTerapeutaOcupacional && !isFisioterapeuta && !isNutricionista },
    { id: 'terapeuta_ocupacional', label: 'Terapeuta Ocupacional', icon: Activity, allowed: !isAssistenteSocial && !isPsicologia && !isFisioterapeuta && !isNutricionista },
    { id: 'fisioterapeuta', label: 'Fisioterapia', icon: Activity, allowed: !isAssistenteSocial && !isPsicologia && !isTerapeutaOcupacional && !isNutricionista },
    { id: 'assistente_social', label: 'Assistente Social', icon: FileSearch, allowed: !isPsicologia && !isTerapeutaOcupacional && !isFisioterapeuta && !isNutricionista },
  ].filter(c => c.allowed);

  const selectedResident = targetType === 'resident' 
    ? (fullResident || residents.find(r => r.id === selectedResidentId))
    : candidates.find(c => c.id === selectedResidentId) as unknown as Resident; // Cast to Resident for now to avoid massive type restructures if the component expects Resident

  // But we need to be careful with the typing. We should just pass the common interface elements.
  // Actually, candidates and residents share a lot of fields, but we should make sure we're saving right.

  const activeList = targetType === 'resident' ? residents : (targetType === 'candidate' ? candidates : []);
  
  const filteredResidents = activeList.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveEntity = (updatedData: Resident | (Candidate & Resident)) => {
    if (targetType === 'resident') {
      onSaveResident(updatedData as Resident);
      setFullResident(updatedData as Resident);
    } else if (onSaveCandidate) {
      onSaveCandidate(updatedData as Candidate);
    }
  };

  const renderHistory = () => {
    if (isLoadingHistory) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-[32px] border border-dashed animate-pulse">
           <Clock size={32} className="text-blue-300 mb-4 animate-spin" />
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando histórico recente...</p>
        </div>
      );
    }

    if (history.length === 0) {
      return (
        <div className="p-12 text-center bg-gray-50 rounded-[32px] border border-dashed">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widestOpacity-50">Nenhum atendimento recente nesta área.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[#004c99]" /> Últimas Atividades {competencies.find(c => c.id === activeCompetence)?.label}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-[#004c99] transition-all group flex items-start justify-between cursor-pointer"
              onClick={() => {
                setSelectedHistoryItem(item);
                setIsHistoryModalOpen(true);
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                    item.type === 'Evolução' ? 'bg-orange-50 text-orange-600' : 
                    item.type === 'Atendimento' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {typeof item.timestamp === 'string' && item.timestamp.includes('-') ? item.timestamp.split('T')[0].split('-').reverse().join('/') : new Date(item.timestamp).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="text-xs font-black text-gray-800 uppercase tracking-tight group-hover:text-[#004c99]">{item.residentName}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 truncate max-w-[200px]">
                  {item.attendanceEvolution || item.notes || item.institutionalAdaptationStatus || item.newConduct || 'Ver detalhes...'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-[#004c99] group-hover:text-white transition-all">
                <Eye size={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleExportGeneralCSV = () => {
    if (!activeCompetence) return;

    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = '';

    if (activeCompetence === 'nutricionista') {
      headers = ['Residente', 'Tipo de Registro', 'Data', 'Status/Aceitacao/Razao', 'Notas/Conduta/Detalhes'];
      residents.forEach(res => {
        const evols = res.nutrition?.evolutions || [];
        const atts = res.nutrition?.attendances || [];
        evols.forEach(ev => {
          rows.push([
            res.name,
            'Evolução',
            new Date(ev.date).toLocaleDateString('pt-BR'),
            `Aceitação: ${ev.foodAcceptance || ''}`,
            ev.newConduct || ''
          ]);
        });
        atts.forEach(at => {
          rows.push([
            res.name,
            'Atendimento',
            new Date(at.dateTime).toLocaleDateString('pt-BR'),
            at.reason || '',
            at.notes || ''
          ]);
        });
      });
      filename = 'Relatorio_Completo_Nutricao.csv';
    } else if (activeCompetence === 'psicologia') {
      headers = ['Residente', 'Tipo de Registro', 'Data', 'Adaptacao/Intervencao', 'Humor/Evolucao'];
      residents.forEach(res => {
        const evols = res.psychology?.evolutions || [];
        const atts = res.psychology?.attendances || [];
        evols.forEach(ev => {
          rows.push([
            res.name,
            'Evolução',
            new Date(ev.date).toLocaleDateString('pt-BR'),
            ev.institutionalAdaptationStatus || '',
            ev.moodBehaviorEvolution || ''
          ]);
        });
        atts.forEach(at => {
          rows.push([
            res.name,
            'Atendimento',
            new Date(at.dateTime).toLocaleDateString('pt-BR'),
            at.interventionType || '',
            at.attendanceEvolution || ''
          ]);
        });
      });
      filename = 'Relatorio_Completo_Psicologia.csv';
    } else if (activeCompetence === 'terapeuta_ocupacional') {
      headers = ['Residente', 'Tipo de Registro', 'Data', 'Evolucao Funcional / Tipo Atend.', 'Conduta / Evolucao'];
      residents.forEach(res => {
        const evols = res.occupationalTherapy?.evolutions || [];
        const atts = res.occupationalTherapy?.attendances || [];
        evols.forEach(ev => {
          rows.push([
            res.name,
            'Evolução',
            new Date(ev.date).toLocaleDateString('pt-BR'),
            ev.functionalEvolution || '',
            ev.newConduct || ''
          ]);
        });
        atts.forEach(at => {
          rows.push([
            res.name,
            'Atendimento',
            new Date(at.dateTime).toLocaleDateString('pt-BR'),
            at.attendanceType || '',
            at.attendanceEvolution || ''
          ]);
        });
      });
      filename = 'Relatorio_Completo_Terapia_Ocupacional.csv';
    } else if (activeCompetence === 'fisioterapeuta') {
      headers = ['Residente', 'Tipo de Registro', 'Data', 'Descricao / Tipo Atend.', 'Resposta / Evolucao'];
      residents.forEach(res => {
        const evols = res.physiotherapy?.evolutions || [];
        const atts = res.physiotherapy?.attendances || [];
        evols.forEach(ev => {
          rows.push([
            res.name,
            'Evolução',
            new Date(ev.date).toLocaleDateString('pt-BR'),
            ev.description || '',
            ev.treatmentResponse || ''
          ]);
        });
        atts.forEach(at => {
          rows.push([
            res.name,
            'Atendimento',
            new Date(at.dateTime).toLocaleDateString('pt-BR'),
            at.attendanceType || '',
            at.attendanceEvolution || ''
          ]);
        });
      });
      filename = 'Relatorio_Completo_Fisioterapia.csv';
    } else if (activeCompetence === 'assistente_social') {
      headers = ['Residente', 'Tipo de Ação', 'Data', 'Horário', 'Assunto / Título', 'Envolvido / Órgão', 'Relato da Intervenção', 'Encaminhamentos', 'Profissional'];
      residents.forEach(res => {
        const evols = res.socialWork?.evolutions || [];
        evols.forEach(ev => {
          rows.push([
            res.name,
            ev.type,
            ev.date,
            ev.time || '',
            ev.title || '',
            ev.targetPersonOrEntity || '',
            (ev.description || '').replace(/(\r\n|\n|\r)/gm, " "),
            (ev.referrals || '').replace(/(\r\n|\n|\r)/gm, " "),
            `${ev.professionalName || 'Assistente Social'} ${ev.cress ? `CRESS: ${ev.cress}` : ''}`
          ]);
        });
      });
      filename = 'Relatorio_Completo_Servico_Social.csv';
    } else {
      return;
    }

    if (rows.length === 0) {
      alert("Nenhum dado encontrado para exportar nesta área.");
      return;
    }

    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Initial View: Competency selection
  if (!activeCompetence) {
    return (
      <div className="p-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-2">Atendimento Multidisciplinar</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Clique na sua área para iniciar o atendimento</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {competencies.filter(c => c.allowed).map((comp) => (
            <button
              key={comp.id}
              onClick={() => setActiveCompetence(comp.id)}
              className="group bg-white p-12 rounded-[48px] border-2 border-transparent hover:border-[#004c99] hover:shadow-2xl transition-all flex flex-col items-center gap-6 text-center shadow-lg transform hover:-translate-y-2"
            >
              <div className="w-24 h-24 bg-blue-50 rounded-[32px] flex items-center justify-center text-[#004c99] group-hover:scale-110 group-hover:bg-[#004c99] group-hover:text-white transition-all duration-300">
                <comp.icon size={48} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{comp.label}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 px-4 leading-relaxed">Registro de Evoluções, Avaliações e Planos de Atendimento Individual</p>
              </div>
              <div className="mt-4 px-8 py-3 bg-gray-100 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                Abrir Módulo
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-in fade-in duration-500 overflow-visible max-w-7xl mx-auto">
      {/* Header with Search and Navigation */}
      <div className="mb-8 flex flex-col items-start gap-6 bg-white p-8 rounded-[40px] border shadow-sm">
        <div className="flex w-full items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => {
                setActiveCompetence(null);
                setSelectedResidentId('');
                setSearchTerm('');
                setCompetenceMode('individual');
              }}
              className="p-4 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-2xl transition-all shadow-sm active:scale-95"
              title="Voltar para seleção de área"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
                <span className="p-2 bg-blue-50 text-[#004c99] rounded-xl">
                  {competencies.find(c => c.id === activeCompetence)?.icon && React.createElement(competencies.find(c => c.id === activeCompetence)!.icon, { size: 24 })}
                </span>
                {competencies.find(c => c.id === activeCompetence)?.label}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Atendimento Multidisciplinar
              </p>
            </div>
          </div>

          {activeCompetence !== 'assistente_social' && (
            <div className="flex bg-gray-50 p-1 rounded-2xl border flex-wrap">
              <button
                onClick={() => setCompetenceMode('individual')}
                className={`flex-1 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  competenceMode === 'individual'
                  ? 'bg-white text-[#004c99] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Individual
              </button>
              {['nutricionista', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta'].includes(activeCompetence || '') && (
                <button
                  onClick={() => setCompetenceMode('grupo')}
                  className={`flex-1 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    competenceMode === 'grupo'
                    ? 'bg-white text-[#004c99] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Em Grupo
                </button>
              )}
              {activeCompetence === 'terapeuta_ocupacional' && (
                <button
                  onClick={() => setCompetenceMode('aniversariantes')}
                  className={`flex-1 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    competenceMode === 'aniversariantes'
                    ? 'bg-white text-[#004c99] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Aniversariantes
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleExportGeneralCSV}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-2xl transition-all shadow-sm font-black text-[10px] uppercase tracking-widest border border-emerald-100 whitespace-nowrap"
            title="Exportar todos os dados desta área no formato CSV"
          >
            <FileSpreadsheet size={20} />
            CSV da Base ({competencies.find(c => c.id === activeCompetence)?.label})
          </button>
        </div>

        {competenceMode === 'individual' && (
          <div className="w-full space-y-6">
            <div className="flex-1 w-full max-w-xl relative search-container group/search">
              {activeCompetence === 'psicologia' && (
                <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-1 rounded-2xl w-fit border shadow-sm">
                  <button
                    onClick={() => { setTargetType('resident'); setSelectedResidentId(''); setSearchTerm(''); }}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      targetType === 'resident' ? 'bg-white text-[#004c99] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Residentes
                  </button>
                  {candidates && candidates.length > 0 && (
                    <button
                      onClick={() => { setTargetType('candidate'); setSelectedResidentId(''); setSearchTerm(''); }}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        targetType === 'candidate' ? 'bg-white text-[#004c99] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Triagem Idosos
                    </button>
                  )}
                  <button
                    onClick={() => { setTargetType('job_candidate'); setSelectedResidentId(''); setSearchTerm(''); }}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      targetType === 'job_candidate' ? 'bg-white text-[#004c99] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Vagas de Emprego (RH)
                  </button>
                </div>
              )}

              {targetType !== 'job_candidate' && (
                <>
                  <div className={`relative transition-all duration-300 ${selectedResidentId ? 'ring-4 ring-blue-50 rounded-[28px]' : ''}`}>
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder={`Buscar ${targetType === 'resident' ? 'Residente' : 'Candidato'} para ${competencies.find(c => c.id === activeCompetence)?.label}...`}
                      value={searchTerm}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (selectedResidentId) setSelectedResidentId('');
                      setIsDropdownOpen(true);
                    }}
                    className="w-full pl-16 pr-12 py-5 bg-gray-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-[24px] text-sm font-black uppercase tracking-tight outline-none transition-all shadow-inner"
                  />
                  <button 
                    onClick={() => {
                      setIsDropdownOpen(!isDropdownOpen);
                      if (selectedResidentId) {
                        setSelectedResidentId('');
                        setSearchTerm('');
                      }
                    }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#004c99] transition-all p-2 flex items-center gap-1 group"
                    title="Listar todos os residentes"
                  >
                    <span className="text-[9px] font-black uppercase mr-1 hidden sm:inline opacity-60 group-hover:opacity-100">Ver Todos</span>
                    <ChevronDown size={20} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  </div>

                  {/* Search Dropdown */}
                  {(searchTerm || isDropdownOpen) && !selectedResidentId && (
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-[32px] shadow-2xl z-50 max-h-80 overflow-y-auto no-scrollbar py-4 px-2">
                      {filteredResidents.length > 0 ? (
                        filteredResidents.map(r => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelectedResidentId(r.id);
                              setSearchTerm(r.name);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full px-5 py-4 text-left hover:bg-blue-50 rounded-2xl flex items-center gap-5 transition-all group"
                          >
                            <div className="w-12 h-12 bg-white border-2 border-gray-50 rounded-2xl flex items-center justify-center font-black text-blue-600 shadow-sm group-hover:border-blue-200">
                              {r.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-black text-gray-800 uppercase tracking-tight group-hover:text-blue-900">{r.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Quarto {r.room} • CPF {r.cpf ? r.cpf.slice(0,3) : ''}...</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                              <Plus size={16} />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400 opacity-50">
                          <Search size={32} className="mb-2" />
                          <p className="text-[10px] font-black uppercase">Nenhum residente encontrado</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {!selectedResidentId && renderHistory()}
          </div>
        )}
      </div>

      {isHistoryModalOpen && selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 bg-opacity-90">
           <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-[#004c99] p-8 text-white flex justify-between items-start">
               <div>
                 <div className="flex items-center gap-3 mb-2">
                   <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase">
                     {selectedHistoryItem.type}
                   </span>
                   <span className="text-[10px] font-bold uppercase opacity-80">
                     {new Date(selectedHistoryItem.timestamp).toLocaleString('pt-BR')}
                   </span>
                 </div>
                 <h2 className="text-2xl font-black uppercase tracking-tighter">{selectedHistoryItem.residentName}</h2>
               </div>
               <button 
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryItem(null);
                }}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
               >
                 <X size={24} />
               </button>
             </div>
             <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-8 border-b pb-8">
                   <div>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Profissional / Assinatura</p>
                     <p className="text-sm font-bold text-gray-800 whitespace-pre-wrap">{selectedHistoryItem.profissionalAssinaturaTexto || selectedHistoryItem.signature || selectedHistoryItem.profissionalNome || 'N/A'}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo / Categoria</p>
                     <p className="text-sm font-bold text-gray-800">{selectedHistoryItem.interventionType || selectedHistoryItem.attendanceType || 'Registro Multidisciplinar'}</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalhamento do Registro</p>
                   <div className="p-6 bg-gray-50 rounded-3xl text-sm leading-relaxed text-gray-700 font-medium border border-gray-100 italic whitespace-pre-wrap">
                      "{selectedHistoryItem.descricaoAtendimento || selectedHistoryItem.attendanceEvolution || selectedHistoryItem.notes || selectedHistoryItem.moodBehaviorEvolution || selectedHistoryItem.treatmentResponse || selectedHistoryItem.history || selectedHistoryItem.evaluation || selectedHistoryItem.conduct || 'Sem descrição adicional'}"
                   </div>
                </div>

                {selectedHistoryItem.muralNotes && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black text-[#004c99] uppercase tracking-widest flex items-center gap-2">
                       <Plus size={12} /> Compartilhado no Mural
                     </p>
                     <div className="p-5 bg-blue-50/50 rounded-2xl text-xs text-blue-800 font-bold border border-blue-100">
                        {selectedHistoryItem.muralNotes}
                     </div>
                   </div>
                )}
             </div>
             <div className="p-8 bg-gray-50 border-t flex justify-end gap-3">
                <button
                  onClick={async () => {
                    let area = 'Multidisciplinar';
                    switch (activeCompetence) {
                      case 'nutricionista': area = 'Nutrição'; break;
                      case 'psicologia': area = 'Psicologia'; break;
                      case 'terapeuta_ocupacional': area = 'Terapia Ocupacional'; break;
                      case 'fisioterapeuta': area = 'Fisioterapia'; break;
                      case 'enfermagem_medico': area = 'Enfermagem/Médico'; break;
                    }
                    
                    let targetResident = fullResident;
                    if (!targetResident) {
                      targetResident = residents.find(r => r.name === selectedHistoryItem.residentName) || null;
                    }
                    if (!targetResident) {
                      targetResident = candidates.find(c => c.name === selectedHistoryItem.residentName) || null as any;
                    }

                    if (targetResident) {
                      const payload = {
                        ...selectedHistoryItem,
                        dateTime: selectedHistoryItem.timestamp || selectedHistoryItem.date,
                        attendanceType: selectedHistoryItem.interventionType || selectedHistoryItem.attendanceType,
                        descricaoAtendimento: selectedHistoryItem.descricaoAtendimento || selectedHistoryItem.attendanceEvolution || selectedHistoryItem.notes || selectedHistoryItem.moodBehaviorEvolution || selectedHistoryItem.treatmentResponse || selectedHistoryItem.history || selectedHistoryItem.evaluation || selectedHistoryItem.conduct || 'Sem descrição adicional'
                      };
                      await printAttendanceHtmlPdf(payload, targetResident, settings, area);
                    } else {
                      alert('Não foi possível carregar os dados do residente para gerar o PDF.');
                    }
                  }}
                  className="px-10 py-4 bg-gray-100 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all shadow-sm flex items-center gap-2"
                >
                  <Printer size={16} /> Exportar PDF
                </button>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-10 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                >
                  Fechar Visualização
                </button>
             </div>
           </div>
        </div>
      )}

      {competenceMode === 'aniversariantes' && activeCompetence === 'terapeuta_ocupacional' ? (
        <div className="animate-in slide-in-from-bottom duration-700 bg-white rounded-[40px] border shadow-sm overflow-hidden p-10">
          <BirthdaySection residents={residents} />
        </div>
      ) : competenceMode === 'grupo' ? (
        <div className="animate-in slide-in-from-bottom duration-700 bg-white rounded-[40px] border shadow-sm overflow-hidden p-10">
          <GroupActivityTab
            competence={activeCompetence as 'nutricionista' | 'psicologia' | 'terapeuta_ocupacional' | 'fisioterapeuta'}
            residents={residents}
            onSaveResident={onSaveResident}
            onPostToMural={onPostToMural}
          />
        </div>
      ) : targetType === 'job_candidate' && activeCompetence === 'psicologia' ? (
        <div className="animate-in slide-in-from-bottom duration-700 bg-white rounded-[40px] border shadow-sm overflow-hidden p-10">
          <PsychologyJobCandidatesSection 
            institutionId={localStorage.getItem('ssvp_session') ? (JSON.parse(localStorage.getItem('ssvp_session')!).institutionId || JSON.parse(localStorage.getItem('ssvp_session')!).cnpj) : ''} 
          />
        </div>
      ) : selectedResident ? (
        <div className="animate-in slide-in-from-bottom duration-700 bg-white rounded-[40px] border shadow-sm overflow-hidden">
          {activeCompetence === 'fisioterapeuta' && (
            <PhysiotherapyTab 
              resident={selectedResident}
              settings={settings}
              onPostToMural={onPostToMural}
              onChange={(data) => handleSaveEntity({ ...selectedResident, physiotherapy: data })}
              residents={residents}
              onSaveResident={handleSaveEntity}
            />
          )}
          
          {activeCompetence === 'nutricionista' && (
            <>
              <div className="flex bg-gray-50/50 p-2 border-b overflow-x-auto no-scrollbar">
                {[
                  { id: 'avaliacao', label: 'Primeira Avaliação Nutricional' },
                  { id: 'evolucao', label: 'Evolução Nutricional' },
                  { id: 'atendimentos', label: 'Atendimentos' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'bg-[#004c99] text-white shadow-lg' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-10">
                {activeTab === 'avaliacao' && (
                  <NutritionalAssessmentForm 
                    resident={selectedResident} 
                    onSave={(data) => {
                      const updatedResident = {
                        ...selectedResident,
                        nutrition: {
                          ...selectedResident.nutrition,
                          initialAssessment: data
                        }
                      };
                      handleSaveEntity(updatedResident);
                    }} 
                  />
                )}
                {activeTab === 'evolucao' && (
                  <NutritionalEvolutionSection 
                    resident={selectedResident} 
                    onSave={(evolutions) => {
                      const updatedResident = {
                        ...selectedResident,
                        nutrition: {
                          ...selectedResident.nutrition,
                          evolutions: evolutions
                        }
                      };
                      handleSaveEntity(updatedResident);
                    }} 
                  />
                )}
                {activeTab === 'atendimentos' && (
                  <NutritionalAttendanceSection 
                    resident={selectedResident} 
                    settings={settings}
                    onPostToMural={onPostToMural}
                    onSave={(attendances) => {
                      const updatedResident = {
                        ...selectedResident,
                        nutrition: {
                          ...selectedResident.nutrition,
                          attendances: attendances
                        }
                      };
                      handleSaveEntity(updatedResident);
                    }} 
                  />
                )}
              </div>
            </>
          )}

          {activeCompetence === 'psicologia' && (
            <>
              <div className="flex bg-gray-50/50 p-2 border-b overflow-x-auto no-scrollbar">
                {(targetType === 'candidate' ? [
                  { id: 'atendimentos', label: 'Atendimentos' }
                ] : [
                  { id: 'historico', label: 'Histórico Completo' },
                  { id: 'anamnese', label: 'Primeiro Atendimento' },
                  { id: 'evolucao', label: 'Evolução Psicológica' },
                  { id: 'atendimentos', label: 'Atendimentos' }
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeTab === tab.id || (tab.id === 'anamnese' && activeTab === 'avaliacao')
                        ? 'bg-[#004c99] text-white shadow-lg' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-10">
                
                {activeTab === 'historico' && (
                  <PsychologyFullHistory 
                    resident={selectedResident} 
                    settings={settings}
                  />
                )}
                {(activeTab === 'anamnese' || activeTab === 'avaliacao') && (
                  <FirstPsychologicalAttendanceView 
                    resident={selectedResident} 
                    onSaveAnamnese={(data) => {
                      const updatedResident = {
                        ...selectedResident,
                        psychology: {
                          ...selectedResident.psychology,
                          anamnese: data,
                          initialAssessment: data
                        }
                      };
                      handleSaveEntity(updatedResident);
                    }} 
                  />
                )}
                {activeTab === 'evolucao' && (
                  <PsychologicalEvolutionSection 
                    resident={selectedResident} 
                    onSave={(evolutions) => {
                      const updatedResident = {
                        ...selectedResident,
                        psychology: {
                          ...selectedResident.psychology,
                          evolutions: evolutions
                        }
                      };
                      handleSaveEntity(updatedResident);
                    }} 
                  />
                )}
                {activeTab === 'atendimentos' && (
                  <PsychologicalAttendanceSection 
                    resident={selectedResident} 
                    settings={settings}
                    isCandidate={targetType === 'candidate'}
                    onPostToMural={onPostToMural}
                    onSave={(attendances) => {
                      const updatedResident = {
                        ...selectedResident,
                        psychology: {
                          ...selectedResident.psychology,
                          attendances: attendances
                        }
                      };
                      handleSaveEntity(updatedResident);
                    }} 
                  />
                )}
              </div>
            </>
          )}

          {activeCompetence === 'terapeuta_ocupacional' && (
            <div className="p-10">
              <OccupationalTherapyTab 
                resident={selectedResident}
                settings={settings}
                onPostToMural={onPostToMural}
                onChange={(otData) => {
                  const updatedResident = {
                    ...selectedResident,
                    occupationalTherapy: otData
                  };
                  handleSaveEntity(updatedResident);
                }}
                residents={residents}
                onSaveResident={handleSaveEntity}
              />
            </div>
          )}

          {activeCompetence === 'assistente_social' && (
            <div className="p-8">
              <SocialWorkerTab 
                resident={selectedResident}
                settings={settings}
                onPostToMural={onPostToMural}
                onChange={(socialData) => {
                  setFullResident(prev => prev ? { ...prev, socialWork: socialData } : prev);
                }}
                residents={residents}
                onSaveResident={handleSaveEntity}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-24 text-center bg-white rounded-[64px] border-2 border-dashed border-gray-100 mt-8 shadow-inner animate-pulse">
           <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center text-blue-200 mb-8">
              <User size={64} />
           </div>
           <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Residente não selecionado</h3>
           <p className="max-w-md text-sm font-bold text-gray-400 uppercase tracking-widest mt-4 leading-relaxed">
             Por favor, escolha um residente utilizando a barra de busca acima para visualizar e editar os registros de {competencies.find(c => c.id === activeCompetence)?.label}.
           </p>
        </div>
      )}
    </div>
  );
};

interface NutritionalAssessmentFormProps {
  resident: Resident;
  onSave: (data: any) => void;
}

const NutritionalAssessmentForm: React.FC<NutritionalAssessmentFormProps> = ({ resident, onSave }) => {
  const initialData = resident.nutrition?.initialAssessment || {
    date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    calfCircumference: '',
    armCircumference: '',
    waistCircumference: '',
    abdomenCircumference: '',
    hipCircumference: '',
    thighCircumference: '',
    measurementsNotTakenDueToLimitation: false,
    gender: resident.gender || '',
    age: resident.age ? parseInt(resident.age, 10) : '',
    activityLevel: '',
    chronicDiseases: [],
    otherChronicDisease: '',
    feedingRoute: '',
    dietConsistency: '',
    oralHealth: [],
    foodLikes: '',
    foodDislikes: '',
    foodAllergies: '',
    initialDiagnosis: '',
    needsSupplementation: false,
    supplementationDetails: '',
    piaGoals: '',
    appetite: '',
    recentWeightLoss: '',
    mobility: '',
    recentStress: '',
    screeningClassification: '',
    screeningObservations: '',
    tricepsSkinfold: '',
    bicepsSkinfold: '',
    subscapularSkinfold: '',
    suprailiacSkinfold: '',
    skinfoldsNotTakenDueToLimitation: false
  };

  const [formData, setFormData] = useState<any>(initialData);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Avaliação Nutricional Inicial', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente/Candidato: ${resident.name}`, 14, 30);
    doc.text(`Data da Avaliação: ${formData.date}`, 14, 35);
    doc.text(`Quarto: ${resident.room || 'N/A'}`, 14, 40);

    const tableData = [
      ['Peso', `${formData.weight || 'N/A'} kg`, 'Altura', `${formData.height || 'N/A'} m`],
      ['IMC', calculateBMI() || 'N/A', 'Comp. Panturrilha', `${formData.calfCircumference || 'N/A'} cm`],
      ['Circ. Braço', `${formData.armCircumference || 'N/A'} cm`, 'Circ. Cintura', `${formData.waistCircumference || 'N/A'} cm`],
      ['Via Alimentação', formData.feedingRoute || 'N/A', 'Consistência', formData.dietConsistency || 'N/A'],
      ['Diagnóstico', { content: formData.initialDiagnosis || 'N/A', colSpan: 3 }],
      ['Metas PIA', { content: formData.piaGoals || 'N/A', colSpan: 3 }]
    ];

    (doc as any).autoTable({
      startY: 50,
      head: [['Campo', 'Valor', 'Campo', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#004c99', textColor: 255 },
      styles: { fontSize: 9 }
    });

    addPdfSignatureNode(doc);
    doc.save(`Avaliacao_Nutricional_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const calculateBMI = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (w > 0 && h > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return '';
  };

  const handleCheckboxChange = (field: string, value: string) => {
    const currentList = formData[field] as string[];
    if (currentList.includes(value)) {
      setFormData({ ...formData, [field]: currentList.filter(item => item !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentList, value] });
    }
  };

  const calculateTMB = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    const a = parseInt(formData.age, 10);
    const g = formData.gender;

    if (w > 0 && h > 0 && a > 0 && g) {
      const h_cm = h * 100;
      if (g === 'Masculino') {
        return (10 * w) + (6.25 * h_cm) - (5 * a) + 5;
      } else if (g === 'Feminino') {
        return (10 * w) + (6.25 * h_cm) - (5 * a) - 161;
      }
    }
    return null;
  };

  const calculateGET = () => {
    const tmb = calculateTMB();
    if (tmb && formData.activityLevel) {
      const factors: Record<string, number> = {
        'Sedentário': 1.2,
        'Leve': 1.375,
        'Moderado': 1.55,
        'Intenso': 1.725
      };
      return tmb * (factors[formData.activityLevel] || 1);
    }
    return null;
  };

  const getMetabolicSuggestions = () => {
    const get = calculateGET();
    if (!get) return null;

    return {
      maintenance: Math.max(800, Math.round(get)),
      weightLossMild: Math.max(800, Math.round(get - 300)),
      weightLossModerate: Math.max(800, Math.round(get - 500)),
      weightGainMild: Math.max(800, Math.round(get + 300)),
      weightGainModerate: Math.max(800, Math.round(get + 500))
    };
  };

  const calculateScreeningScore = () => {
    let score = 0;
    if (formData.appetite !== '') score += parseInt(formData.appetite, 10);
    if (formData.recentWeightLoss !== '') score += parseInt(formData.recentWeightLoss, 10);
    if (formData.mobility !== '') score += parseInt(formData.mobility, 10);
    if (formData.recentStress !== '') score += parseInt(formData.recentStress, 10);

    const bmiStr = calculateBMI();
    if (bmiStr) {
      const bmi = parseFloat(bmiStr);
      if (bmi < 19) score += 2;
      else if (bmi >= 19 && bmi < 22) score += 1;
      // >= 22 is 0
    }

    if (formData.calfCircumference) {
      const calf = parseFloat(formData.calfCircumference);
      if (calf < 31) score += 2;
      // >= 31 is 0
    }

    return score;
  };

  const getAutoClassification = (score: number) => {
    if (score <= 3) return 'Sem risco nutricional';
    if (score <= 6) return 'Risco nutricional';
    return 'Alto risco / provável desnutrição';
  };

  const screeningScore = calculateScreeningScore();
  const autoClassification = getAutoClassification(screeningScore);

  const calculateBodyFat = () => {
    const triceps = parseFloat(formData.tricepsSkinfold);
    const biceps = parseFloat(formData.bicepsSkinfold);
    const subscapular = parseFloat(formData.subscapularSkinfold);
    const suprailiac = parseFloat(formData.suprailiacSkinfold);
    
    const folds = [triceps, biceps, subscapular, suprailiac].filter(v => !isNaN(v) && v > 0);
    
    if (folds.length >= 3 && formData.age && formData.gender) {
      // Estimate sum of 4 folds if only 3 are provided
      const sumOfFolds = (folds.reduce((a, b) => a + b, 0) / folds.length) * 4;
      const logSum = Math.log10(sumOfFolds);
      const age = parseInt(formData.age, 10);
      const isMale = formData.gender === 'Masculino';
      
      let c = 0;
      let m = 0;
      
      if (isMale) {
        if (age < 20) { c = 1.1620; m = 0.0630; }
        else if (age < 30) { c = 1.1631; m = 0.0632; }
        else if (age < 40) { c = 1.1422; m = 0.0544; }
        else if (age < 50) { c = 1.1620; m = 0.0700; }
        else { c = 1.1715; m = 0.0779; }
      } else {
        if (age < 20) { c = 1.1549; m = 0.0678; }
        else if (age < 30) { c = 1.1599; m = 0.0717; }
        else if (age < 40) { c = 1.1423; m = 0.0632; }
        else if (age < 50) { c = 1.1333; m = 0.0612; }
        else { c = 1.1339; m = 0.0645; }
      }
      
      const density = c - (m * logSum);
      const bodyFat = (4.95 / density - 4.50) * 100;
      
      return Math.max(0, Math.min(100, bodyFat));
    }
    return null;
  };

  const getBodyFatClassification = (bf: number) => {
    const isMale = formData.gender === 'Masculino';
    if (isMale) {
      if (bf < 15) return 'baixo peso';
      if (bf <= 25) return 'adequado';
      return 'elevado';
    } else {
      if (bf < 25) return 'baixo peso';
      if (bf <= 35) return 'adequado';
      return 'elevado';
    }
  };

  const bodyFat = calculateBodyFat();

  const handleSubmit = (e: React.FormEvent) => {
    try {
      e.preventDefault();
      onSave({
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        calfCircumference: formData.calfCircumference ? parseFloat(formData.calfCircumference) : undefined,
        skinfoldsNotTakenDueToLimitation: formData.skinfoldsNotTakenDueToLimitation,
        tricepsSkinfold: formData.tricepsSkinfold ? parseFloat(formData.tricepsSkinfold) : undefined,
        subscapularSkinfold: formData.subscapularSkinfold ? parseFloat(formData.subscapularSkinfold) : undefined,
        bicepsSkinfold: formData.bicepsSkinfold ? parseFloat(formData.bicepsSkinfold) : undefined,
        suprailiacSkinfold: formData.suprailiacSkinfold ? parseFloat(formData.suprailiacSkinfold) : undefined,
      });
      alert('Avaliação salva com sucesso!');
    } catch(err) {
      alert('Erro ao salvar avaliação.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Primeira Avaliação Nutricional (Abastece o PIA)</h2>
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={handleExportPDF}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-black text-[10px] uppercase hover:bg-gray-200 flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={14} />
            Exportar PDF
          </button>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
            <input 
              type="date" 
              value={formData.date} 
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              required
            />
          </div>
        </div>
      </div>

      {/* A) Dados Antropométricos e Clínicos */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">A) Dados Antropométricos e Clínicos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peso Atual (kg)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.weight} 
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Altura (m)</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.height} 
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">IMC Atual</label>
            <input 
              type="text" 
              value={calculateBMI()} 
              readOnly
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Panturrilha (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.calfCircumference} 
              onChange={(e) => setFormData({ ...formData, calfCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Doenças Crônicas de Impacto Nutricional</label>
          <div className="flex flex-wrap gap-4">
            {['Diabetes', 'Hipertensão', 'Dislipidemia', 'Doença Renal', 'Outro'].map(disease => (
              <label key={disease} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.chronicDiseases.includes(disease)}
                  onChange={() => handleCheckboxChange('chronicDiseases', disease)}
                  className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                {disease}
              </label>
            ))}
          </div>
          {formData.chronicDiseases.includes('Outro') && (
            <div className="mt-3">
              <input 
                type="text" 
                placeholder="Qual?"
                value={formData.otherChronicDisease} 
                onChange={(e) => setFormData({ ...formData, otherChronicDisease: e.target.value })}
                className="w-full md:w-1/2 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              />
            </div>
          )}
        </div>
      </section>

      {/* Avaliação Antropométrica Complementar */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">Avaliação Antropométrica Complementar</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Braço (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.armCircumference} 
              onChange={(e) => setFormData({ ...formData, armCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.measurementsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Cintura (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.waistCircumference} 
              onChange={(e) => setFormData({ ...formData, waistCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.measurementsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Abdômen (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.abdomenCircumference} 
              onChange={(e) => setFormData({ ...formData, abdomenCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.measurementsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Quadril (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.hipCircumference} 
              onChange={(e) => setFormData({ ...formData, hipCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.measurementsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Coxa (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.thighCircumference} 
              onChange={(e) => setFormData({ ...formData, thighCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.measurementsNotTakenDueToLimitation}
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.measurementsNotTakenDueToLimitation}
              onChange={(e) => setFormData({ ...formData, measurementsNotTakenDueToLimitation: e.target.checked })}
              className="w-5 h-5 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
            />
            <span className="text-sm font-bold text-gray-700 uppercase">Medidas não realizadas por limitação funcional do residente</span>
          </label>
        </div>
      </section>

      {/* B) Via e Perfil de Alimentação */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">B) Via e Perfil de Alimentação</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Via de Alimentação</label>
            <select 
              value={formData.feedingRoute} 
              onChange={(e) => setFormData({ ...formData, feedingRoute: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Oral">Oral</option>
              <option value="Sonda Nasoenteral (SNE)">Sonda Nasoenteral (SNE)</option>
              <option value="Gastrostomia (GTT)">Gastrostomia (GTT)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consistência da Dieta Recomendada</label>
            <select 
              value={formData.dietConsistency} 
              onChange={(e) => setFormData({ ...formData, dietConsistency: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Normal/Livre">Normal/Livre</option>
              <option value="Branda">Branda</option>
              <option value="Pastosa">Pastosa</option>
              <option value="Líquida-pastosa">Líquida-pastosa</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saúde Oral e Deglutição</label>
          <div className="flex flex-wrap gap-4">
            {['Usa prótese dentária total', 'Usa prótese dentária parcial', 'Ausência de dentes', 'Histórico de engasgos/disfagia'].map(item => (
              <label key={item} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.oralHealth.includes(item)}
                  onChange={() => handleCheckboxChange('oralHealth', item)}
                  className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                {item}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* C) Preferências e Necessidades */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">C) Preferências e Necessidades</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gostos Alimentares</label>
            <textarea 
              rows={3}
              value={formData.foodLikes} 
              onChange={(e) => setFormData({ ...formData, foodLikes: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aversões e Restrições/Intolerâncias</label>
            <textarea 
              rows={3}
              value={formData.foodDislikes} 
              onChange={(e) => setFormData({ ...formData, foodDislikes: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Alergias Alimentares Graves</label>
          <div className={`relative rounded-xl border ${formData.foodAllergies ? 'border-red-300 bg-red-50' : 'border-gray-200'} overflow-hidden transition-colors`}>
            {formData.foodAllergies && (
              <div className="absolute top-3 right-3 text-red-500">
                <AlertTriangle size={20} />
              </div>
            )}
            <textarea 
              rows={2}
              value={formData.foodAllergies} 
              onChange={(e) => setFormData({ ...formData, foodAllergies: e.target.value })}
              className={`w-full p-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none bg-transparent ${formData.foodAllergies ? 'text-red-900 font-bold' : ''}`}
              placeholder="Descreva alergias graves (se houver)..."
            />
          </div>
        </div>
      </section>

      {/* D) Cálculo Metabólico (Base para Plano Alimentar) */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">D) Cálculo Metabólico (Base para Plano Alimentar)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sexo</label>
            <select 
              value={formData.gender} 
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Idade (anos)</label>
            <input 
              type="number" 
              value={formData.age} 
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nível de Atividade</label>
            <select 
              value={formData.activityLevel} 
              onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Sedentário">Sedentário</option>
              <option value="Leve">Leve</option>
              <option value="Moderado">Moderado</option>
              <option value="Intenso">Intenso</option>
            </select>
          </div>
        </div>

        {(!formData.weight || !formData.height || !formData.age || !formData.gender || !formData.activityLevel) ? (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center text-sm text-gray-500 font-medium mb-6">
            Preencha peso, altura, sexo, idade e nível de atividade para calcular.
          </div>
        ) : (
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-black text-[#004c99] uppercase tracking-widest mb-4">Resultados</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-xs font-bold text-gray-600 uppercase">TMB (Mifflin-St Jeor)</span>
                    <span className="text-sm font-black text-[#004c99]">{Math.round(calculateTMB() || 0)} kcal/dia</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-xs font-bold text-gray-600 uppercase">GET (Gasto Energético Total)</span>
                    <span className="text-sm font-black text-[#004c99]">{Math.round(calculateGET() || 0)} kcal/dia</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-black text-[#004c99] uppercase tracking-widest mb-4">Sugestões de Meta Calórica</h4>
                {getMetabolicSuggestions() && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Manutenção:</span>
                      <span className="font-bold text-gray-800">{getMetabolicSuggestions()?.maintenance} kcal/dia</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Perda de peso (leve):</span>
                      <span className="font-bold text-gray-800">{getMetabolicSuggestions()?.weightLossMild} kcal/dia</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Perda de peso (moderada):</span>
                      <span className="font-bold text-gray-800">{getMetabolicSuggestions()?.weightLossModerate} kcal/dia</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Ganho de peso (leve):</span>
                      <span className="font-bold text-gray-800">{getMetabolicSuggestions()?.weightGainMild} kcal/dia</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Ganho de peso (moderado):</span>
                      <span className="font-bold text-gray-800">{getMetabolicSuggestions()?.weightGainModerate} kcal/dia</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* E) Triagem / Avaliação Global Nutricional */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">E) Triagem / Avaliação Global Nutricional</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Apetite nas últimas 2 semanas</label>
            <select 
              value={formData.appetite} 
              onChange={(e) => setFormData({ ...formData, appetite: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="0">Normal (0)</option>
              <option value="1">Reduzido (1)</option>
              <option value="2">Muito reduzido/Recusa frequente (2)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Perda de peso recente</label>
            <select 
              value={formData.recentWeightLoss} 
              onChange={(e) => setFormData({ ...formData, recentWeightLoss: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="0">Não (0)</option>
              <option value="1">Sim, leve (1)</option>
              <option value="2">Sim, importante (2)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mobilidade</label>
            <select 
              value={formData.mobility} 
              onChange={(e) => setFormData({ ...formData, mobility: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="0">Deambula/anda (0)</option>
              <option value="1">Anda com ajuda (1)</option>
              <option value="2">Restrito ao leito/cadeira (2)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estresse/doença aguda recente (últimos 3 meses)</label>
            <select 
              value={formData.recentStress} 
              onChange={(e) => setFormData({ ...formData, recentStress: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="0">Não (0)</option>
              <option value="2">Sim (2)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pontuação do IMC</span>
            <div className="text-sm font-medium text-gray-700">
              {calculateBMI() ? (
                parseFloat(calculateBMI()) >= 22 ? 'IMC >= 22 (0)' :
                parseFloat(calculateBMI()) >= 19 ? 'IMC 19–21,9 (1)' :
                'IMC < 19 (2)'
              ) : 'Preencha peso e altura'}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pontuação da Panturrilha</span>
            <div className="text-sm font-medium text-gray-700">
              {formData.calfCircumference ? (
                parseFloat(formData.calfCircumference) >= 31 ? '>= 31 cm (0)' : '< 31 cm (2)'
              ) : 'Não informado'}
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-black text-[#004c99] uppercase tracking-widest mb-1">Resultado da Triagem</h4>
              <div className="text-3xl font-black text-[#004c99]">{screeningScore} pontos</div>
            </div>
            <div className="flex-1 w-full md:w-auto">
              <label className="block text-[10px] font-black text-[#004c99] uppercase tracking-widest mb-1">Classificação Final</label>
              <select
                value={formData.screeningClassification || autoClassification}
                onChange={(e) => setFormData({ ...formData, screeningClassification: e.target.value })}
                className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-bold ${
                  (formData.screeningClassification || autoClassification) === 'Sem risco nutricional' ? 'bg-green-100 border-green-300 text-green-800' :
                  (formData.screeningClassification || autoClassification) === 'Risco nutricional' ? 'bg-yellow-100 border-yellow-300 text-yellow-800' :
                  'bg-red-100 border-red-300 text-red-800'
                }`}
              >
                <option value="Sem risco nutricional">Sem risco nutricional</option>
                <option value="Risco nutricional">Risco nutricional</option>
                <option value="Alto risco / provável desnutrição">Alto risco / provável desnutrição</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Observações da triagem</label>
          <textarea 
            rows={2}
            value={formData.screeningObservations} 
            onChange={(e) => setFormData({ ...formData, screeningObservations: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            placeholder="Opcional..."
          />
        </div>
      </section>

      {/* F) Avaliação de Composição Corporal (Opcional) */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">F) Avaliação de Composição Corporal (Opcional)</h3>
        
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.skinfoldsNotTakenDueToLimitation}
              onChange={(e) => setFormData({ ...formData, skinfoldsNotTakenDueToLimitation: e.target.checked })}
              className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
            />
            Não foi possível realizar avaliação devido limitação funcional
          </label>
        </div>

        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 transition-opacity ${formData.skinfoldsNotTakenDueToLimitation ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tricipital (mm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.tricepsSkinfold} 
              onChange={(e) => setFormData({ ...formData, tricepsSkinfold: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.skinfoldsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bicipital (mm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.bicepsSkinfold} 
              onChange={(e) => setFormData({ ...formData, bicepsSkinfold: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.skinfoldsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Subescapular (mm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.subscapularSkinfold} 
              onChange={(e) => setFormData({ ...formData, subscapularSkinfold: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.skinfoldsNotTakenDueToLimitation}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Supra-ilíaca (mm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.suprailiacSkinfold} 
              onChange={(e) => setFormData({ ...formData, suprailiacSkinfold: e.target.value })}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              disabled={formData.skinfoldsNotTakenDueToLimitation}
            />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h4 className="text-xs font-black text-[#004c99] uppercase tracking-widest mb-2">Resultado (Durnin & Womersley)</h4>
          {bodyFat !== null ? (
            <div className="flex items-center gap-4">
              <div className="text-2xl font-black text-[#004c99]">{bodyFat.toFixed(1)}%</div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                getBodyFatClassification(bodyFat) === 'baixo peso' ? 'bg-yellow-100 text-yellow-800' :
                getBodyFatClassification(bodyFat) === 'adequado' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {getBodyFatClassification(bodyFat)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 font-medium">
              {formData.skinfoldsNotTakenDueToLimitation 
                ? 'Avaliação não realizada por limitação funcional.' 
                : 'Dados insuficientes para cálculo (preencha ao menos 3 dobras, idade e sexo).'}
            </div>
          )}
        </div>
      </section>

      {/* G) Conclusão para o PIA */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">G) Conclusão para o PIA</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Diagnóstico Nutricional Inicial</label>
            <textarea 
              rows={3}
              value={formData.initialDiagnosis} 
              onChange={(e) => setFormData({ ...formData, initialDiagnosis: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Necessidade de Suplementação?</label>
            <div className="flex items-center gap-6 mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="radio" 
                  checked={formData.needsSupplementation === true}
                  onChange={() => setFormData({ ...formData, needsSupplementation: true })}
                  className="w-4 h-4 text-[#004c99] focus:ring-[#004c99]"
                />
                Sim
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="radio" 
                  checked={formData.needsSupplementation === false}
                  onChange={() => setFormData({ ...formData, needsSupplementation: false, supplementationDetails: '' })}
                  className="w-4 h-4 text-[#004c99] focus:ring-[#004c99]"
                />
                Não
              </label>
            </div>
            {formData.needsSupplementation && (
              <input 
                type="text" 
                placeholder="Qual suplementação?"
                value={formData.supplementationDetails} 
                onChange={(e) => setFormData({ ...formData, supplementationDetails: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metas Nutricionais para o PIA</label>
            <textarea 
              rows={3}
              value={formData.piaGoals} 
              onChange={(e) => setFormData({ ...formData, piaGoals: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={() => setFormData(initialData)}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50 transition-all"
        >
          Cancelar
        </button>
        <button 
          type="button" 
          onClick={handleExportPDF}
          className="px-6 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-2 shadow-sm transition-all font-bold text-xs uppercase border"
        >
          <Printer size={16} />
          <span>Exportar PDF</span>
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Avaliação</span>
        </button>
      </div>
    </form>
  );
};

interface NutritionalEvolutionSectionProps {
  resident: Resident;
  onSave: (evolutions: NutritionalEvolution[]) => void;
}

const NutritionalEvolutionSection: React.FC<NutritionalEvolutionSectionProps> = ({ resident, onSave }) => {
  const [isCreating, setIsCreating] = useState(false);

  const evolutions = resident.nutrition?.evolutions || [];

  if (isCreating) {
    return (
      <StandardEvolutionForm 
        areaLabel="Nutricional"
        onSave={(data) => {
          const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
          onSave(newEvolutions as any);
          setIsCreating(false);
        }}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  const renderLegacyDetails = (ev: any) => {
    if (!ev.weight && !ev.foodAcceptance && !ev.piaGoalStatus) return null;
    return (
      <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
          {ev.weight && <p><strong>Peso:</strong> {ev.weight}kg</p>}
          {ev.foodAcceptance && <p><strong>Aceitação:</strong> {ev.foodAcceptance}</p>}
          {ev.piaGoalStatus && <p><strong>Status PIA:</strong> {ev.piaGoalStatus}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Evoluções</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
          >
            <Plus size={18} /> Nova Evolução
          </button>
        </div>
      </div>
      
      <StandardEvolutionHistory 
        evolutions={evolutions as any} 
        areaLabel="Nutricional" 
        renderLegacyDetails={renderLegacyDetails}
      />
    </div>
  );
};

interface NutritionalAttendanceSectionProps {
  resident: Resident;
  settings?: any;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
  onSave: (attendances: NutritionalAttendance[]) => void;
}

const NutritionalAttendanceSection: React.FC<NutritionalAttendanceSectionProps> = ({ resident, settings, onPostToMural, onSave }) => {
  const [editingAttendance, setEditingAttendance] = useState<NutritionalAttendance | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const attendances = resident.nutrition?.attendances || [];

  const handleExportIndividualAttendancePDF = async (att: any) => {
    await printAttendanceHtmlPdf(att, resident, settings, 'Nutrição');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Atendimentos Nutricionais', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente/Candidato: ${resident.name}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    const tableData = attendances.map(at => [
      new Date(at.dateTime).toLocaleString('pt-BR'),
      at.attendanceType || 'N/A',
      at.profissionalAssinaturaTexto || at.signature || at.profissionalNome || 'N/A'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Data/Hora', 'Tipo', 'Assinatura']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#004c99', textColor: 255 },
      styles: { fontSize: 9 }
    });

    addPdfSignatureNode(doc);
    doc.save(`Atendimentos_Nutricionais_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };


  const handleSave = (attendance: NutritionalAttendance) => {
    let newAttendances;
    if (isCreating) {
      newAttendances = [attendance, ...attendances];
    } else {
      newAttendances = attendances.map(a => a.id === attendance.id ? attendance : a);
    }
    
    // Sort by date descending
    newAttendances.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    
    onSave(newAttendances);

    // Only post to mural if not 'privado'
    if (Array.isArray(attendance.visibilidade) && !attendance.visibilidade.includes('privado')) {
      let muralText = `[Nutrição] Atendimento de ${resident.name} finalizado.\n\n${attendance.descricaoAtendimento}`;
      onPostToMural({
        author: attendance.signature || 'Nutricionista',
        text: muralText,
        visibilidade: attendance.visibilidade // passe a visibilidade também para a nova propriedade do Mural
      });
    }

    setEditingAttendance(null);
    setIsCreating(false);
  };

  if (isCreating || editingAttendance) {
    return (
      <NutritionalAttendanceForm 
        resident={resident}
        settings={settings}
        attendance={editingAttendance}
        onSave={handleSave}
        onCancel={() => {
          setEditingAttendance(null);
          setIsCreating(false);
        }}
      />
    );
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Atendimentos</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-xl shadow-sm uppercase transition-all"
          >
            <Printer size={16} /> Exportar PDF
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
          >
            <Plus size={18} /> Novo Atendimento
          </button>
        </div>
      </div>

      {attendances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-bold uppercase text-sm">Nenhum atendimento registrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendances.map(attendance => (
            <div key={attendance.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-[#004c99] transition-colors group">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-black text-gray-800 text-sm">{formatDateTime(attendance.dateTime)}</div>
                  {attendance.muralNotes && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      Vai para o mural
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-bold uppercase mt-1">
                  Motivo: <span className="text-gray-700">{attendance.reason}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-1 whitespace-pre-wrap">
                  Profissional: {attendance.profissionalAssinaturaTexto || attendance.signature || attendance.profissionalNome || 'Profissional'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportIndividualAttendancePDF(attendance)}
                  className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
                  title="Exportar PDF do Atendimento"
                >
                  <Printer size={18} />
                </button>
                <button 
                  onClick={() => setEditingAttendance(attendance)}
                  className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface NutritionalAttendanceFormProps {
  resident: Resident;
  settings: any;
  attendance: NutritionalAttendance | null;
  onSave: (attendance: NutritionalAttendance) => void;
  onCancel: () => void;
}

const NutritionalAttendanceForm: React.FC<NutritionalAttendanceFormProps> = ({ resident, settings, attendance, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(attendance || {
    id: Date.now().toString(), ...getProfessionalSignature(),
    dateTime: new Date().toISOString().slice(0, 16), // YYYY-MM-DDThh:mm
    reason: '',
    descricaoAtendimento: '',
    visibilidade: ['admin'],
    signature: ''
  });

  useEffect(() => {
    if (!attendance) {
      const sigData = getProfessionalSignature();
      let signatureName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Usuário';
      
      // Adjust timezone offset for local datetime-local input
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);

      setFormData(prev => ({
        ...prev,
        dateTime: localISOTime,
        signature: signatureName
      }));
    }
  }, [attendance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as NutritionalAttendance);
  };

  const handleExportPDF = async () => {
    await printAttendanceHtmlPdf(formData, resident, settings, 'Nutrição');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {attendance ? 'Visualizar / Editar Atendimento' : 'Novo Atendimento'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data e Hora</label>
          <input 
            type="datetime-local" 
            value={formData.dateTime} 
            onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Motivo do Registro</label>
          <select 
            value={formData.reason} 
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Visita de rotina">Visita de rotina</option>
            <option value="Queixa do residente">Queixa do residente</option>
            <option value="Solicitação da enfermagem">Solicitação da enfermagem</option>
            <option value="Recusa alimentar pontual">Recusa alimentar pontual</option>
            <option value="Alteração intestinal">Alteração intestinal</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição do Atendimento</label>
        <textarea 
          rows={6}
          value={formData.descricaoAtendimento || formData.notes || ''} 
          onChange={(e) => setFormData({ ...formData, descricaoAtendimento: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Visibilidade do Atendimento</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={Array.isArray(formData.visibilidade) ? formData.visibilidade.includes('publico') : formData.visibilidade === 'publico'}
              onChange={(e) => {
                 let current = Array.isArray(formData.visibilidade) ? [...formData.visibilidade] : [formData.visibilidade];
                 if (current.includes('privado')) current = [];
                 if (e.target.checked) current.push('publico');
                 else current = current.filter((v: string) => v !== 'publico');
                 if (!current.includes('admin')) current.push('admin'); 
                 setFormData({...formData, visibilidade: current});
              }}
              className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
            />
            <span className="text-sm font-medium text-gray-700">Público (todos verão no mural)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={Array.isArray(formData.visibilidade) ? formData.visibilidade.includes('admin') : formData.visibilidade === 'admin'}
              onChange={(e) => {
                 let current = Array.isArray(formData.visibilidade) ? [...formData.visibilidade] : [formData.visibilidade];
                 if (current.includes('privado')) current = [];
                 if (e.target.checked) {
                   if (!current.includes('admin')) current.push('admin');
                 } else {
                   current = current.filter((v: string) => v !== 'admin');
                 }
                 setFormData({...formData, visibilidade: current});
              }}
              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
            />
            <span className="text-sm font-medium text-gray-700">Direção e coordenação</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assinatura do Profissional</label>
        <textarea 
          value={formData.signature} 
          readOnly
          rows={3}
          className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm resize-none whitespace-pre-wrap"
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50 transition-all"
        >
          Cancelar
        </button>
        <button 
          type="button" 
          onClick={handleExportPDF}
          className="px-6 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-2 shadow-sm transition-all font-bold text-xs uppercase border"
        >
          <Printer size={16} />
          <span>Exportar PDF</span>
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Atendimento</span>
        </button>
      </div>
    </form>
  );
};

interface FirstPsychologicalAttendanceViewProps {
  resident: Resident;
  onSaveAnamnese: (data: any) => void;
}

const FirstPsychologicalAttendanceView: React.FC<FirstPsychologicalAttendanceViewProps> = ({ resident, onSaveAnamnese }) => {
  const [showForm, setShowForm] = useState(false);

  const anamnese = resident.psychology?.anamnese || resident.psychology?.initialAssessment;
  const attendances = resident.psychology?.attendances || [];
  const evolutions = resident.psychology?.evolutions || [];

  const parseTS = (dStr?: string) => {
    if (!dStr) return 0;
    if (dStr.includes('T')) return new Date(dStr).getTime();
    return new Date(dStr.replace(/-/g, '/')).getTime();
  };

  const fmtDate = (dateStr?: string) => {
    if (!dateStr) return 'Data não informada';
    if (dateStr.includes('T') || dateStr.includes(' ')) {
      const [dPart, tPart] = dateStr.includes('T') ? dateStr.split('T') : dateStr.split(' ');
      const dSegments = dPart.split('-');
      if (dSegments.length === 3) {
        const formattedDate = `${dSegments[2]}/${dSegments[1]}/${dSegments[0]}`;
        const timeClean = tPart ? tPart.slice(0, 5) : '';
        return timeClean ? `${formattedDate} às ${timeClean}` : formattedDate;
      }
    }
    const dSegments = dateStr.split('-');
    if (dSegments.length === 3) {
      return `${dSegments[2]}/${dSegments[1]}/${dSegments[0]}`;
    }
    return dateStr;
  };

  // Coletar todos os atendimentos e evoluções individuais
  const allRecords: any[] = [];
  attendances.forEach((at: any) => {
    allRecords.push({
      kind: 'Atendimento',
      dateStr: at.dateTime || at.date,
      timestamp: parseTS(at.dateTime || at.date),
      interventionType: at.interventionType || 'Atendimento Psicológico Individual',
      description: at.descricaoAtendimento || at.attendanceEvolution || at.descricao || at.notes || at.atendimento || '',
      signature: at.signature || at.profissionalAssinaturaTexto || at.profissionalNome || 'Psicólogo(a)'
    });
  });
  evolutions.forEach((ev: any) => {
    allRecords.push({
      kind: 'Evolução',
      dateStr: ev.dataEvolucao || ev.date,
      timestamp: parseTS(ev.dataEvolucao || ev.date),
      interventionType: 'Evolução Psicológica',
      description: ev.descricaoEvolucao || ev.observacao || ev.description || ev.notes || '',
      signature: ev.profissionalAssinaturaTexto || ev.profissionalNome || ev.signature || 'Psicólogo(a)'
    });
  });

  // Ordenar em ordem crescente (mais antigo primeiro)
  allRecords.sort((a, b) => a.timestamp - b.timestamp);
  const oldestRecord = allRecords[0];

  if (showForm) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowForm(false)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 mb-4"
        >
          <ArrowLeft size={16} />
          <span>Voltar ao Resumo do Primeiro Atendimento</span>
        </button>
        <PsychologicalAssessmentForm
          resident={resident}
          isAnamnese={true}
          onSave={(data) => {
            onSaveAnamnese(data);
            setShowForm(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-200">
        <div>
          <h2 className="text-lg font-black text-[#004c99] uppercase tracking-tighter">Primeiro Atendimento Psicológico</h2>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">
            Registro inicial de acolhimento e primeira intervenção do idoso
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-6 py-3 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
        >
          {anamnese ? 'Editar Anamnese Completa' : '+ Preencher Anamnese Completa'}
        </button>
      </div>

      {anamnese ? (
        <div className="bg-white p-6 rounded-2xl border-2 border-blue-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="px-3 py-1 bg-blue-100 text-[#004c99] text-[10px] font-black uppercase tracking-widest rounded-lg">
              Anamnese / Primeira Avaliação
            </span>
            <span className="text-xs font-bold text-gray-500 uppercase">
              Data: {fmtDate(anamnese.date)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {anamnese.institutionalizationAwareness && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consciência da Institucionalização</span>
                <p className="font-bold text-gray-800">{anamnese.institutionalizationAwareness}</p>
              </div>
            )}
            {anamnese.initialEmotionalReaction && Array.isArray(anamnese.initialEmotionalReaction) && anamnese.initialEmotionalReaction.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reação Emocional Inicial</span>
                <p className="font-bold text-gray-800">{anamnese.initialEmotionalReaction.join(', ')}</p>
              </div>
            )}
          </div>

          {anamnese.initialPsychologicalSynthesis && (
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <span className="block text-[10px] font-black text-[#004c99] uppercase tracking-widest mb-1">Síntese Psicológica Inicial</span>
              <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap">{anamnese.initialPsychologicalSynthesis}</p>
            </div>
          )}

          {anamnese.piaPsychologicalGoals && (
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <span className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Objetivos / Metas PIA</span>
              <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap">{anamnese.piaPsychologicalGoals}</p>
            </div>
          )}
        </div>
      ) : oldestRecord ? (
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-md space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-lg">
                Primeiro Atendimento Registrado
              </span>
              <span className="text-xs font-extrabold text-emerald-900 uppercase">
                {oldestRecord.interventionType}
              </span>
            </div>
            <span className="text-xs font-black text-gray-600 bg-gray-100 px-3 py-1 rounded-lg uppercase">
              {fmtDate(oldestRecord.dateStr)}
            </span>
          </div>

          <div>
            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Descrição / Relato do Atendimento</span>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
              {oldestRecord.description || 'Sem descrição cadastrada.'}
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-gray-100 text-[10px] text-gray-500 font-black uppercase tracking-widest">
            <span>Profissional Responsável: <strong className="text-gray-800">{oldestRecord.signature}</strong></span>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-3">
          <p className="text-gray-400 font-bold uppercase text-xs">Nenhum atendimento ou avaliação psicológica registrado ainda para este idoso.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm hover:bg-blue-800 inline-block"
          >
            + Cadastrar Anamnese Inicial
          </button>
        </div>
      )}
    </div>
  );
};

interface PsychologicalAssessmentFormProps {
  resident: Resident;
  isAnamnese?: boolean;
  onSave: (data: any) => void;
}

const PsychologicalAssessmentForm: React.FC<PsychologicalAssessmentFormProps> = ({ resident, isAnamnese, onSave }) => {
  const initialData = (isAnamnese ? resident.psychology?.anamnese : resident.psychology?.initialAssessment) || {
    date: new Date().toISOString().split('T')[0],
    institutionalizationAwareness: '',
    initialEmotionalReaction: [],
    recentGriefsAndLosses: '',
    traumasAndEmotionalTriggers: '',
    orientationLevel: '',
    moodScreeningGDS: '',
    cognitiveScreeningMMSE: '',
    familyBondQuality: '',
    visitExpectations: '',
    initialPsychologicalSynthesis: '',
    piaPsychologicalGoals: ''
  };

  const [formData, setFormData] = useState<any>(initialData);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Avaliação Psicológica Inicial', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente/Candidato: ${resident.name}`, 14, 30);
    doc.text(`Data da Avaliação: ${formData.date}`, 14, 35);

    const tableData = [
      ['História Pessoal', { content: formData.personalHistory || 'N/A', colSpan: 3 }],
      ['Exame Psíquico', { content: formData.psychicExamination || 'N/A', colSpan: 3 }],
      ['Diagnóstico', { content: formData.initialDiagnosis || 'N/A', colSpan: 3 }],
      ['Metas PIA', { content: formData.piaGoals || 'N/A', colSpan: 3 }]
    ];

    (doc as any).autoTable({
      startY: 45,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    addPdfSignatureNode(doc);
    doc.save(`Avaliacao_Psicologica_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleCheckboxChange = (field: string, value: string) => {
    const currentList = formData[field] as string[];
    if (currentList.includes(value)) {
      setFormData({ ...formData, [field]: currentList.filter(item => item !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentList, value] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    try {
      e.preventDefault();
      onSave({
        ...formData,
        cognitiveScreeningMMSE: formData.cognitiveScreeningMMSE ? parseFloat(formData.cognitiveScreeningMMSE) : undefined,
      });
      alert('Avaliação Psicológica salva com sucesso!');
    } catch(err) {
      alert('Erro ao salvar avaliação.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          Anamnese (Primeira Avaliação)
        </h2>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
      </div>

      {/* A) Histórico e Aspectos Emocionais */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">A) Histórico e Aspectos Emocionais</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consciência da Institucionalização</label>
            <select 
              value={formData.institutionalizationAwareness} 
              onChange={(e) => setFormData({ ...formData, institutionalizationAwareness: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Veio por vontade própria">Veio por vontade própria</option>
              <option value="Veio persuadido/sem clareza">Veio persuadido/sem clareza</option>
              <option value="Trouxe resistência">Trouxe resistência</option>
              <option value="Incapaz de opinar devido à cognição">Incapaz de opinar devido à cognição</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Reação Emocional Inicial</label>
            <div className="flex flex-wrap gap-4">
              {['Apatia', 'Tristeza/Choro', 'Agressividade/Irritação', 'Ansiedade', 'Tranquilidade/Aceitação'].map(item => (
                <label key={item} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={(formData.initialEmotionalReaction || []).includes(item)}
                    onChange={() => handleCheckboxChange('initialEmotionalReaction', item)}
                    className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lutos e Perdas Recentes</label>
            <textarea 
              rows={3}
              value={formData.recentGriefsAndLosses} 
              onChange={(e) => setFormData({ ...formData, recentGriefsAndLosses: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Traumas e Gatilhos Emocionais</label>
            <div className={`relative rounded-xl border ${formData.traumasAndEmotionalTriggers ? 'border-red-300 bg-red-50' : 'border-gray-200'} overflow-hidden transition-colors`}>
              {formData.traumasAndEmotionalTriggers && (
                <div className="absolute top-3 right-3 text-red-500">
                  <AlertTriangle size={20} />
                </div>
              )}
              <textarea 
                rows={3}
                value={formData.traumasAndEmotionalTriggers} 
                onChange={(e) => setFormData({ ...formData, traumasAndEmotionalTriggers: e.target.value })}
                className={`w-full p-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none bg-transparent ${formData.traumasAndEmotionalTriggers ? 'text-red-900 font-bold' : ''}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* B) Rastreio Cognitivo e de Humor */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">B) Rastreio Cognitivo e de Humor (opcional)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nível de Orientação</label>
            <select 
              value={formData.orientationLevel} 
              onChange={(e) => setFormData({ ...formData, orientationLevel: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Orientado no tempo e espaço">Orientado no tempo e espaço</option>
              <option value="Desorientação leve/flutuante">Desorientação leve/flutuante</option>
              <option value="Desorientação grave">Desorientação grave</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rastreio de Humor (GDS)</label>
            <select 
              value={formData.moodScreeningGDS} 
              onChange={(e) => setFormData({ ...formData, moodScreeningGDS: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Sem indicativo">Sem indicativo</option>
              <option value="Depressão Leve">Depressão Leve</option>
              <option value="Depressão Severa">Depressão Severa</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rastreio Cognitivo (Mini-Mental)</label>
            <input 
              type="number" 
              value={formData.cognitiveScreeningMMSE} 
              onChange={(e) => setFormData({ ...formData, cognitiveScreeningMMSE: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
        </div>
      </section>

      {/* C) Rede de Apoio e Vínculos */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">C) Rede de Apoio e Vínculos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Qualidade do Vínculo Familiar</label>
            <select 
              value={formData.familyBondQuality} 
              onChange={(e) => setFormData({ ...formData, familyBondQuality: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Preservado/Presente">Preservado/Presente</option>
              <option value="Conflituoso">Conflituoso</option>
              <option value="Frágil/Ausente">Frágil/Ausente</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expectativa de Visitas</label>
            <textarea 
              rows={3}
              value={formData.visitExpectations} 
              onChange={(e) => setFormData({ ...formData, visitExpectations: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>
      </section>

      {/* D) Conclusão para o PIA */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">D) Conclusão para o PIA</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Síntese Psicológica Inicial</label>
            <textarea 
              rows={3}
              value={formData.initialPsychologicalSynthesis} 
              onChange={(e) => setFormData({ ...formData, initialPsychologicalSynthesis: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metas Psicológicas para o PIA <span className="text-[#004c99] lowercase">(alimentará o PIA futuramente)</span></label>
            <textarea 
              rows={3}
              value={formData.piaPsychologicalGoals} 
              onChange={(e) => setFormData({ ...formData, piaPsychologicalGoals: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={() => setFormData(initialData)}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50 transition-all"
        >
          Cancelar
        </button>
        <button 
          type="button" 
          onClick={handleExportPDF}
          className="px-6 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-2 shadow-sm transition-all font-bold text-xs uppercase border"
        >
          <Printer size={16} />
          <span>Exportar PDF</span>
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Avaliação</span>
        </button>
      </div>
    </form>
  );
};

interface PsychologicalEvolutionSectionProps {
  resident: Resident;
  onSave: (evolutions: PsychologicalEvolution[]) => void;
}

const PsychologicalEvolutionSection: React.FC<PsychologicalEvolutionSectionProps> = ({ resident, onSave }) => {
  const [isCreating, setIsCreating] = useState(false);

  const evolutions = resident.psychology?.evolutions || [];

  if (isCreating) {
    return (
      <StandardEvolutionForm 
        areaLabel="Psicológica"
        onSave={(data) => {
          const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
          onSave(newEvolutions as any);
          setIsCreating(false);
        }}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  const renderLegacyDetails = (ev: any) => {
    if (!ev.institutionalAdaptationStatus && !ev.moodBehaviorEvolution && !ev.piaGoalStatus) return null;
    return (
      <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
          {ev.institutionalAdaptationStatus && <p><strong>Adaptação:</strong> {ev.institutionalAdaptationStatus}</p>}
          {ev.moodBehaviorEvolution && <p><strong>Humor/Comportamento:</strong> {ev.moodBehaviorEvolution}</p>}
          {ev.piaGoalStatus && <p><strong>Status PIA:</strong> {ev.piaGoalStatus}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Evoluções</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
          >
            <Plus size={18} /> Nova Evolução
          </button>
        </div>
      </div>
      
      <StandardEvolutionHistory 
        evolutions={evolutions as any} 
        areaLabel="Psicológica" 
        renderLegacyDetails={renderLegacyDetails}
      />
    </div>
  );
};

interface PsychologicalAttendanceSectionProps {
  resident: Resident;
  settings?: any;
  isCandidate?: boolean;
  onPostToMural: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
  onSave: (attendances: PsychologicalAttendance[]) => void;
}

const PsychologicalAttendanceSection: React.FC<PsychologicalAttendanceSectionProps> = ({ resident, settings, isCandidate, onPostToMural, onSave }) => {
  const [editingAttendance, setEditingAttendance] = useState<PsychologicalAttendance | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [authChallengeAttendance, setAuthChallengeAttendance] = useState<PsychologicalAttendance | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleAttendanceClick = (attendance: PsychologicalAttendance) => {
    if (Array.isArray(attendance.visibilidade) && attendance.visibilidade.includes('privado')) {
      setAuthChallengeAttendance(attendance);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setEditingAttendance(attendance);
    }
  };

  const handleAuthChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (auth.currentUser && auth.currentUser.email) {
        await signInWithEmailAndPassword(auth, auth.currentUser.email, passwordInput);
        setEditingAttendance(authChallengeAttendance);
        setAuthChallengeAttendance(null);
      } else {
         setPasswordError('Usuário não autenticado no Firebase.');
      }
    } catch (error) {
      setPasswordError('Senha incorreta.');
    }
  };

  const attendances = resident.psychology?.attendances || [];

  const handleExportIndividualAttendancePDF = async (att: any) => {
    await printAttendanceHtmlPdf(att, resident, settings, 'Psicologia');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Atendimentos Psicológicos', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente/Candidato: ${resident.name}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    const tableData = attendances.map(at => [
      new Date(at.dateTime).toLocaleString('pt-BR'),
      at.attendanceType || 'N/A',
      at.profissionalAssinaturaTexto || at.signature || at.profissionalNome || 'N/A'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Data/Hora', 'Tipo', 'Assinatura']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#004c99', textColor: 255 },
      styles: { fontSize: 9 }
    });

    addPdfSignatureNode(doc);
    doc.save(`Atendimentos_Psicologicos_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };


  const handleSave = (attendance: PsychologicalAttendance) => {
    let newAttendances;
    if (isCreating) {
      newAttendances = [attendance, ...attendances];
    } else {
      newAttendances = attendances.map(a => a.id === attendance.id ? attendance : a);
    }
    
    // Sort by date descending
    newAttendances.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    
    onSave(newAttendances);

    // Only post to mural if not 'privado'
    if (Array.isArray(attendance.visibilidade) && !attendance.visibilidade.includes('privado')) {
      let muralText = `[Psicologia] Atendimento de ${resident.name} finalizado.\n\n${attendance.descricaoAtendimento}`;
      onPostToMural({
        author: attendance.signature || 'Psicologia',
        text: muralText,
        visibilidade: attendance.visibilidade // passe a visibilidade também para a nova propriedade do Mural
      });
    }

    setEditingAttendance(null);
    setIsCreating(false);
  };

  if (isCreating || editingAttendance) {
    return (
      <PsychologicalAttendanceForm 
        resident={resident}
        settings={settings}
        attendance={editingAttendance}
        isCandidate={isCandidate}
        onSave={handleSave}
        onCancel={() => {
          setEditingAttendance(null);
          setIsCreating(false);
        }}
      />
    );
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Atendimentos</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-xl shadow-sm uppercase transition-all"
          >
            <Printer size={16} /> Exportar PDF
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
          >
            <Plus size={18} /> Novo Atendimento
          </button>
        </div>
      </div>

      {attendances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-bold uppercase text-sm">Nenhum atendimento registrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendances.map(attendance => (
            <div key={attendance.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-[#004c99] transition-colors group">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-black text-gray-800 text-sm">{formatDateTime(attendance.dateTime)}</div>
                  {attendance.muralNotes && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      Vai para o mural
                    </span>
                  )}
                  {attendance.privateNotes && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      Privado: preenchido
                    </span>
                  )}
                  {attendance.needsTeamReport && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      <AlertTriangle size={10} /> Repasse
                    </span>
                  )}
                  {attendance.candidateStatus && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 text-white ${
                      attendance.candidateStatus === 'apto' ? 'bg-green-500' :
                      attendance.candidateStatus === 'inapto' ? 'bg-red-500' :
                      'bg-orange-500'
                    }`}>
                      {attendance.candidateStatus.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {!isCandidate && (
                  <div className="text-xs text-gray-500 font-bold uppercase mt-1">
                    Intervenção: <span className="text-gray-700">{attendance.interventionType}</span>
                  </div>
                )}
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-1 whitespace-pre-wrap">
                  Profissional: {attendance.profissionalAssinaturaTexto || attendance.signature || attendance.profissionalNome || 'Profissional'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportIndividualAttendancePDF(attendance)}
                  className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
                  title="Exportar PDF do Atendimento"
                >
                  <Printer size={18} />
                </button>
                <button 
                  onClick={() => handleAttendanceClick(attendance)}
                  className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Password Challenge Modal for Private Attendances */}
      {authChallengeAttendance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-[#004c99] text-white">
              <h3 className="font-black uppercase tracking-tight text-lg">Acesso Restrito</h3>
              <button onClick={() => setAuthChallengeAttendance(null)} className="opacity-70 hover:opacity-100 transition-opacity">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAuthChallengeSubmit} className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Este é um atendimento particular. Insira sua senha de login para acessá-lo.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Senha</label>
                  <input 
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
                    placeholder="Sua senha de login"
                    required
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{passwordError}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setAuthChallengeAttendance(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-[#004c99] text-white rounded-lg font-bold text-xs uppercase hover:bg-blue-800 transition-all shadow-md"
                >
                  Acessar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface PsychologicalAttendanceFormProps {
  resident: Resident;
  settings?: any;
  attendance: PsychologicalAttendance | null;
  isCandidate?: boolean;
  onSave: (attendance: PsychologicalAttendance) => void;
  onCancel: () => void;
}

const PsychologicalAttendanceForm: React.FC<PsychologicalAttendanceFormProps> = ({ resident, settings, attendance, isCandidate, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(attendance || {
    id: Date.now().toString(), ...getProfessionalSignature(),
    dateTime: new Date().toISOString().slice(0, 16), // YYYY-MM-DDThh:mm
    interventionType: '',
    descricaoAtendimento: '',
    visibilidade: ['admin'],
    needsTeamReport: false,
    signature: ''
  });

  const [isPrivateUnlocked, setIsPrivateUnlocked] = useState(false);

  const handleUnlockPrivate = async () => {
    const password = prompt('Digite a sua senha de acesso para desbloquear a anotação privada:');
    if (!password) return;
    try {
      const sessionStr = localStorage.getItem('ssvp_session');
      if (sessionStr) {
        const sessionObj = JSON.parse(sessionStr);
        const response = await apiFetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpj: sessionObj.cnpj, username: sessionObj.username, password })
        });
        if (!response.ok) {
          throw new Error('Senha incorreta.');
        }
        setIsPrivateUnlocked(true);
      } else {
        alert('Sessão expirada. Faça login novamente.');
      }
    } catch (error) {
      alert('Senha incorreta.');
    }
  };

  useEffect(() => {
    if (!attendance) {
      const sigData = getProfessionalSignature();
      let signatureName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Usuário';
      
      // Adjust timezone offset for local datetime-local input
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);

      setFormData(prev => ({
        ...prev,
        dateTime: localISOTime,
        signature: signatureName
      }));
    }
  }, [attendance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as PsychologicalAttendance);
  };

  const handleExportPDF = async () => {
    await printAttendanceHtmlPdf(formData, resident, settings, 'Psicologia');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {attendance ? 'Visualizar / Editar Atendimento' : 'Novo Atendimento'}
        </h2>
      </div>

      {formData.needsTeamReport && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle size={24} className="text-red-500" />
          <div>
            <h4 className="font-bold text-sm uppercase">Repasse à equipe necessário</h4>
            <p className="text-xs">Este atendimento foi marcado como necessitando de repasse para a equipe multidisciplinar.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data e Hora</label>
          <input 
            type="datetime-local" 
            value={formData.dateTime} 
            onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
        
        {!isCandidate ? (
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Intervenção</label>
            <select 
              value={formData.interventionType} 
              onChange={(e) => setFormData({ ...formData, interventionType: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
              required
            >
              <option value="">Selecione...</option>
              <option value="Acolhimento individual">Acolhimento individual</option>
              <option value="Observação em área comum">Observação em área comum</option>
              <option value="Intervenção em crise/agitação">Intervenção em crise/agitação</option>
              <option value="Mediação de conflito com outro idoso">Mediação de conflito com outro idoso</option>
              <option value="Atendimento/Orientação a familiares">Atendimento/Orientação a familiares</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status da Triagem</label>
            <select 
              value={formData.candidateStatus || ''} 
              onChange={(e) => setFormData({ ...formData, candidateStatus: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
              required
            >
              <option value="">Selecione...</option>
              <option value="apto">Apto para Acolhimento</option>
              <option value="inapto">Inapto para Acolhimento</option>
              <option value="necessita_atencao">Necessita Atenção / Reavaliação</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{isCandidate ? "Relatório do Atendimento" : "Descrição do Atendimento"}</label>
        <textarea 
          rows={6}
          value={formData.descricaoAtendimento || formData.attendanceEvolution || ''} 
          onChange={(e) => setFormData({ ...formData, descricaoAtendimento: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Visibilidade do Atendimento</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={Array.isArray(formData.visibilidade) ? formData.visibilidade.includes('publico') : formData.visibilidade === 'publico'}
              onChange={(e) => {
                 let current = Array.isArray(formData.visibilidade) ? [...formData.visibilidade] : [formData.visibilidade];
                 if (current.includes('privado')) current = [];
                 if (e.target.checked) current.push('publico');
                 else current = current.filter((v: string) => v !== 'publico');
                 if (!current.includes('admin')) current.push('admin'); 
                 setFormData({...formData, visibilidade: current});
              }}
              className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
            />
            <span className="text-sm font-medium text-gray-700">Público (todos verão no mural)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={Array.isArray(formData.visibilidade) ? formData.visibilidade.includes('admin') : formData.visibilidade === 'admin'}
              onChange={(e) => {
                 let current = Array.isArray(formData.visibilidade) ? [...formData.visibilidade] : [formData.visibilidade];
                 if (current.includes('privado')) current = [];
                 if (e.target.checked) {
                   if (!current.includes('admin')) current.push('admin');
                 } else {
                   current = current.filter((v: string) => v !== 'admin');
                 }
                 setFormData({...formData, visibilidade: current});
              }}
              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
            />
            <span className="text-sm font-medium text-gray-700">Direção e coordenação</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={Array.isArray(formData.visibilidade) ? formData.visibilidade.includes('privado') : formData.visibilidade === 'privado'}
              onChange={(e) => {
                 setFormData({...formData, visibilidade: e.target.checked ? ['privado'] : ['admin']});
              }}
              className="w-4 h-4 text-gray-600 rounded border-gray-300 focus:ring-gray-600"
            />
            <span className="text-sm font-medium text-gray-700">Atendimento particular</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assinatura do Profissional</label>
        <textarea 
          value={formData.signature} 
          readOnly
          rows={3}
          className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm resize-none whitespace-pre-wrap"
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50 transition-all"
        >
          Cancelar
        </button>
        <button 
          type="button" 
          onClick={handleExportPDF}
          className="px-6 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-2 shadow-sm transition-all font-bold text-xs uppercase border"
        >
          <Printer size={16} />
          <span>Exportar PDF</span>
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Atendimento</span>
        </button>
      </div>
    </form>
  );
};

export default MultidisciplinaryModule;

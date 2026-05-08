import { getProfessionalSignature } from '../lib/api';
import { StandardEvolutionForm } from './StandardEvolutionForm';
import { StandardEvolutionHistory } from './StandardEvolutionHistory';
import React, { useState } from 'react';
import { Resident, OccupationalTherapyData, OccupationalTherapyAssessment, OccupationalTherapyEvolution, OccupationalTherapyAttendance, MuralMessage } from '../types';
import { Plus, Save, Edit2, CheckCircle, Clock, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';

import 'jspdf-autotable';
import GroupActivityTab from './GroupActivityTab';

const adlOptionsList = ['Independente', 'Supervisão', 'Assistência leve', 'Assistência moderada', 'Assistência máxima', 'Dependente'];
const cognitiveOptionsList = ['Lúcido e orientado', 'Desorientado no tempo', 'Desorientado no espaço', 'Alteração de memória', 'Alteração de atenção', 'Agitação psicomotora'];
const motorSensoryOptionsList = ['Coordenação motora fina preservada', 'Coordenação motora global preservada', 'Déficit de preensão', 'Déficit visual', 'Déficit auditivo', 'Alteração de sensibilidade'];
const therapeuticGoalsOptionsList = ['Promover independência nas AVDs', 'Estimulação cognitiva', 'Treino de habilidades motoras corporais', 'Adequação postural', 'Prescrição de tecnologia assistiva', 'Atividades expressivas / lúdicas'];
const treatmentConductOptionsList = ['Treino de AVD', 'Oficinas terapêuticas', 'Exercícios cognitivos', 'Adaptação ambiental', 'Orientações à equipe', 'Atendimentos individuais'];

const currentSituationOptionsList = ['Mantém independência', 'Melhora na autonomia', 'Declínio funcional', 'Oscilação cognitiva'];
const piaGoalsUpdateOptionsList = ['Manter objetivos atuais', 'Alterar objetivos', 'Incluir novo objetivo', 'Encerrar objetivo alcançado'];
const conductUpdateOptionsList = ['Manter conduta', 'Modificar atividades', 'Encaminhamentos'];

const ChecklistGroup = ({ label, options, selected = [], onChange, isEditing }: { label: string, options: string[], selected?: string[], onChange: (s: string[]) => void, isEditing: boolean }) => {
  if (!isEditing && selected.length === 0) return null;
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest">{label}</label>
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-white border rounded-xl">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer p-1 hover:bg-gray-50 rounded">
              <input type="checkbox" checked={selected.includes(opt)} onChange={(e) => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter(x => x !== opt));
              }} className="rounded border-gray-300 text-[#004c99] focus:ring-[#004c99]" />
              {opt}
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map(opt => (
            <span key={opt} className="px-3 py-1 bg-blue-50 text-[#004c99] rounded-lg text-[10px] font-bold uppercase">{opt}</span>
          ))}
        </div>
      )}
    </div>
  )
}


import { printAttendanceHtmlPdf } from '../lib/pdfHelpers';

interface OccupationalTherapyTabProps {
  resident: Resident;
  settings?: any;
  onChange: (data: OccupationalTherapyData) => void;
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const OccupationalTherapyTab: React.FC<OccupationalTherapyTabProps> = ({ resident, settings, onChange, residents, onSaveResident, onPostToMural }) => {
  const [activeSubTab, setActiveSubTab] = useState<'avaliacao' | 'evolucao' | 'atendimentos'>('avaliacao');
  
  const handleExportAssessmentPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Avaliação de Terapia Ocupacional', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data da Avaliação: ${assessment.date}`, 14, 35);

    const tableData = [
      ['Independência', assessment.independenceLevel || 'N/A', 'Mobilidade', assessment.mobility || 'N/A'],
      ['Alimentação', assessment.feeding || 'N/A', 'Higiene', assessment.personalHygiene || 'N/A'],
      ['Vestuário', assessment.clothing || 'N/A', 'Banho', assessment.bathing || 'N/A'],
      ['Orientação', assessment.orientation || 'N/A', 'Memória', assessment.attentionAndMemory || 'N/A'],
      ['Participação', assessment.participation || 'N/A', 'Interesse', assessment.occupationalInterest || 'N/A'],
      ['Limitações', { content: assessment.motorLimitations || 'N/A', colSpan: 3 }],
      ['Síntese', { content: assessment.functionalSynthesis || 'N/A', colSpan: 3 }],
      ['Metas PIA', { content: assessment.piaGoals || 'N/A', colSpan: 3 }]
    ];

    (doc as any).autoTable({
      startY: 45,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    addPdfSignatureNode(doc);
    doc.save(`Avaliacao_TO_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportEvolutionPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Evoluções - Terapia Ocupacional', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    const tableData = (otData.evolutions || []).map(ev => [
      new Date(ev.date).toLocaleDateString('pt-BR'),
      ev.functionalEvolution || 'N/A',
      ev.currentIndependenceLevel || 'N/A'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Data', 'Evolução Funcional', 'Nível Independência']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#004c99', textColor: 255 },
      styles: { fontSize: 9 }
    });

    addPdfSignatureNode(doc);
    doc.save(`Evolucoes_TO_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };


  const handleExportAttendancePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Atendimentos - Terapia Ocupacional', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    const tableData = (otData.attendances || []).map(at => [
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
    doc.save(`Atendimentos_TO_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportIndividualAttendancePDF = async (att: any) => {
    await printAttendanceHtmlPdf(att, resident, settings, 'Terapia Ocupacional');
  };

  
  const otData = resident.occupationalTherapy || {
    evolutions: [],
    attendances: []
  };

  const [assessment, setAssessment] = useState<Partial<OccupationalTherapyAssessment>>(
    otData.initialAssessment || {
      date: new Date().toISOString().split('T')[0],
      independenceLevel: '',
      mobility: '',
      feeding: '',
      personalHygiene: '',
      clothing: '',
      bathing: '',
      orientation: '',
      attentionAndMemory: '',
      participation: '',
      occupationalInterest: '',
      motorLimitations: '',
      fallRisk: '',
      deviceUsage: '',
      environmentalAdaptationNeeds: '',
      functionalSynthesis: '',
      piaGoals: ''
    }
  );

  const [isAddingEvolution, setIsAddingEvolution] = useState(false);
  const [newEvolution, setNewEvolution] = useState<Partial<OccupationalTherapyEvolution>>({
    date: new Date().toISOString().split('T')[0],
    currentSituationOptions: [],
    piaGoalsUpdateOptions: [],
    conductUpdateOptions: []
  });

  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [newAttendance, setNewAttendance] = useState<Partial<OccupationalTherapyAttendance>>(() => {
    const sigData = getProfessionalSignature();
    return {
      dateTime: new Date().toISOString().slice(0, 16),
      attendanceType: '',
      descricaoAtendimento: '',
      visibilidade: ['admin'],
      signature: sigData.profissionalAssinaturaTexto || sigData.profissionalNome || ''
    };
  });

  const handleSaveAssessment = () => {
    try {
      onChange({
        ...otData,
        initialAssessment: assessment as any
      });
      alert('Avaliação Salva com Sucesso!');
    } catch(e) {
      alert('Erro ao salvar avaliação.');
    }
  };

  const handleSaveEvolution = () => {
    if (newEvolution.functionalEvolution && newEvolution.newConduct) {
      const evolution: OccupationalTherapyEvolution = {
        id: Date.now().toString(), ...getProfessionalSignature(),
        date: newEvolution.date || new Date().toISOString().split('T')[0],
        functionalEvolution: newEvolution.functionalEvolution,
        participationEvolution: newEvolution.participationEvolution || '',
        currentIndependenceLevel: newEvolution.currentIndependenceLevel || '',
        piaGoalStatus: newEvolution.piaGoalStatus || '',
        newConduct: newEvolution.newConduct
      };
      onChange({
        ...otData,
        evolutions: [evolution, ...(otData.evolutions || [])]
      });
      setIsAddingEvolution(false);
      setNewEvolution({
      date: new Date().toISOString().split('T')[0],
      currentSituationOptions: [],
      piaGoalsUpdateOptions: [],
      conductUpdateOptions: []
    });
    }
  };

  const handleSaveAttendance = () => {
    if (newAttendance.attendanceType && newAttendance.descricaoAtendimento && newAttendance.signature) {
      const attendance: OccupationalTherapyAttendance = {
        id: Date.now().toString(), ...getProfessionalSignature(),
        dateTime: newAttendance.dateTime || new Date().toISOString().slice(0, 16),
        attendanceType: newAttendance.attendanceType,
        descricaoAtendimento: newAttendance.descricaoAtendimento,
        visibilidade: newAttendance.visibilidade as any,
        signature: newAttendance.signature || ''
      };
      
      onChange({
        ...otData,
        attendances: [attendance, ...(otData.attendances || [])]
      });

      if (Array.isArray(attendance.visibilidade) && !attendance.visibilidade.includes('privado') && onPostToMural) {
        let muralText = `[T.O.] Atendimento de ${resident.name} finalizado.\n\n${attendance.descricaoAtendimento}`;
        onPostToMural({
          author: attendance.signature || 'Terapeuta Ocupacional',
          text: muralText,
          visibilidade: attendance.visibilidade as string[]
        });
      }

      setIsAddingAttendance(false);
      const sigData = getProfessionalSignature();
      setNewAttendance({
        dateTime: new Date().toISOString().slice(0, 16),
        attendanceType: '',
        descricaoAtendimento: '',
        visibilidade: ['admin'],
        signature: sigData.profissionalAssinaturaTexto || sigData.profissionalNome || ''
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('avaliacao')}
          className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeSubTab === 'avaliacao'
              ? 'border-[#004c99] text-[#004c99]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Primeira Avaliação
        </button>
        <button
          onClick={() => setActiveSubTab('evolucao')}
          className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeSubTab === 'evolucao'
              ? 'border-[#004c99] text-[#004c99]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Evolução
        </button>
        <button
          onClick={() => setActiveSubTab('atendimentos')}
          className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeSubTab === 'atendimentos'
              ? 'border-[#004c99] text-[#004c99]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Atendimentos
        </button>
      </div>

      {/* 1. Primeira Avaliação */}
      {activeSubTab === 'avaliacao' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 uppercase">Avaliação Inicial</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAssessmentPDF}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-8">
            {/* A) Funcionalidade Geral */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">A) Funcionalidade Geral</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nível de independência</label>
                  <select
                    
                    value={assessment.independenceLevel || ''}
                    onChange={(e) => setAssessment({ ...assessment, independenceLevel: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Parcialmente dependente">Parcialmente dependente</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mobilidade</label>
                  <select
                    
                    value={assessment.mobility || ''}
                    onChange={(e) => setAssessment({ ...assessment, mobility: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Com auxílio">Com auxílio</option>
                    <option value="Cadeirante">Cadeirante</option>
                    <option value="Restrito ao leito">Restrito ao leito</option>
                  </select>
                </div>
              </div>
            </div>

            {/* B) Atividades da Vida Diária (AVDs) */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">B) Atividades da Vida Diária (AVDs)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Alimentação</label>
                  <select
                    
                    value={assessment.feeding || ''}
                    onChange={(e) => setAssessment({ ...assessment, feeding: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Com ajuda">Com ajuda</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Higiene pessoal</label>
                  <select
                    
                    value={assessment.personalHygiene || ''}
                    onChange={(e) => setAssessment({ ...assessment, personalHygiene: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Com ajuda">Com ajuda</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vestuário</label>
                  <select
                    
                    value={assessment.clothing || ''}
                    onChange={(e) => setAssessment({ ...assessment, clothing: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Com ajuda">Com ajuda</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Banho</label>
                  <select
                    
                    value={assessment.bathing || ''}
                    onChange={(e) => setAssessment({ ...assessment, bathing: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Com ajuda">Com ajuda</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
              </div>
            </div>

            {/* C) Cognição e Comportamento Funcional */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">C) Cognição e Comportamento Funcional</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Orientação</label>
                  <select
                    
                    value={assessment.orientation || ''}
                    onChange={(e) => setAssessment({ ...assessment, orientation: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Orientado">Orientado</option>
                    <option value="Parcialmente orientado">Parcialmente orientado</option>
                    <option value="Desorientado">Desorientado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Atenção e memória</label>
                  <select
                    
                    value={assessment.attentionAndMemory || ''}
                    onChange={(e) => setAssessment({ ...assessment, attentionAndMemory: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Preservadas">Preservadas</option>
                    <option value="Leve prejuízo">Leve prejuízo</option>
                    <option value="Prejuízo importante">Prejuízo importante</option>
                  </select>
                </div>
              </div>
            </div>

            {/* D) Interação e Participação */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">D) Interação e Participação</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Participação em atividades</label>
                  <select
                    
                    value={assessment.participation || ''}
                    onChange={(e) => setAssessment({ ...assessment, participation: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Participa quando estimulado">Participa quando estimulado</option>
                    <option value="Isolado">Isolado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Interesse ocupacional</label>
                  <input
                    type="text"
                    
                    value={assessment.occupationalInterest || ''}
                    onChange={(e) => setAssessment({ ...assessment, occupationalInterest: e.target.value })}
                    placeholder="Ex: gosta de música, atividades manuais, jogos"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            {/* E) Limitações e Riscos */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">E) Limitações e Riscos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Limitações motoras</label>
                  <input
                    type="text"
                    
                    value={assessment.motorLimitations || ''}
                    onChange={(e) => setAssessment({ ...assessment, motorLimitations: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Risco de quedas</label>
                  <select
                    
                    value={assessment.fallRisk || ''}
                    onChange={(e) => setAssessment({ ...assessment, fallRisk: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    <option value="Baixo">Baixo</option>
                    <option value="Moderado">Moderado</option>
                    <option value="Alto">Alto</option>
                  </select>
                </div>
              </div>
            </div>

            {/* F) Recursos e Necessidades */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">F) Recursos e Necessidades</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Uso de dispositivos</label>
                  <input
                    type="text"
                    
                    value={assessment.deviceUsage || ''}
                    onChange={(e) => setAssessment({ ...assessment, deviceUsage: e.target.value })}
                    placeholder="Ex: Bengala, andador, cadeira de rodas"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Necessidade de adaptação ambiental</label>
                  <input
                    type="text"
                    
                    value={assessment.environmentalAdaptationNeeds || ''}
                    onChange={(e) => setAssessment({ ...assessment, environmentalAdaptationNeeds: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            {/* G) Conclusão para o PIA */}
            <div>
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">G) Conclusão para o PIA</h4>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Síntese funcional ocupacional</label>
                  <textarea
                    
                    value={assessment.functionalSynthesis || ''}
                    onChange={(e) => setAssessment({ ...assessment, functionalSynthesis: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metas terapêuticas</label>
                  <textarea
                    
                    value={assessment.piaGoals || ''}
                    onChange={(e) => setAssessment({ ...assessment, piaGoals: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t mt-6">
              <button 
                onClick={handleSaveAssessment}
                className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-4 rounded-2xl flex items-center gap-2 shadow-xl shadow-blue-900/20 transition-all font-black text-xs uppercase"
              >
                <Save size={18} />
                Salvar Avaliação e Atualizar PIA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Evolução */}
      {activeSubTab === 'evolucao' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 uppercase">Evoluções Terapêuticas</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportEvolutionPDF}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar PDF
              </button>
              {!isAddingEvolution && (
                <button
                  type="button"
                  onClick={() => setIsAddingEvolution(true)}
                  className="bg-[#004c99] hover:bg-blue-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Plus size={14} />
                  Nova Evolução
                </button>
              )}
            </div>
          </div>

          {isAddingEvolution && (
             <StandardEvolutionForm 
                areaLabel="Terapêutica Ocupacional"
                onSave={(data) => {
                  const evolutions = resident.occupationalTherapy?.evolutions || [];
                  const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
                  onChange({
                    ...(resident.occupationalTherapy || {}),
                    evolutions: newEvolutions as any
                  });
                  setIsAddingEvolution(false);
                }}
                onCancel={() => setIsAddingEvolution(false)}
             />
          )}

          {!isAddingEvolution && (
             <StandardEvolutionHistory 
                evolutions={(resident.occupationalTherapy?.evolutions as any) || []} 
                areaLabel="Terapêutica Ocupacional" 
                renderLegacyDetails={(ev: any) => {
                  if(!ev.functionalEvolution && !ev.participationEvolution && !ev.currentIndependenceLevel && !ev.piaGoalStatus && !ev.evolutionDescription) return null;
                  return (
                    <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
                        {ev.evolutionDescription && <p className="mb-2 whitespace-pre-wrap">{ev.evolutionDescription}</p>}
                        {ev.functionalEvolution && <p><strong>Evolução Funcional:</strong> {ev.functionalEvolution}</p>}
                        {ev.participationEvolution && <p><strong>Participação:</strong> {ev.participationEvolution}</p>}
                        {ev.currentIndependenceLevel && <p><strong>Independência:</strong> {ev.currentIndependenceLevel}</p>}
                        {ev.piaGoalStatus && <p><strong>Status PIA:</strong> {ev.piaGoalStatus}</p>}
                    </div>
                  );
                }}
             />
          )}
        </div>
      )}
      {/* 3. Atendimentos */}
      {activeSubTab === 'atendimentos' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 uppercase">Registro de Atendimentos</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAttendancePDF}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar PDF
              </button>
              {!isAddingAttendance && (
                <button
                  type="button"
                  onClick={() => setIsAddingAttendance(true)}
                  className="bg-[#004c99] hover:bg-blue-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Plus size={14} />
                  Novo Atendimento
                </button>
              )}
            </div>
          </div>

          {isAddingAttendance && (
            <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-md mb-6 relative">
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">Registrar Novo Atendimento</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={newAttendance.dateTime || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, dateTime: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de atendimento</label>
                  <select
                    value={newAttendance.attendanceType || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, attendanceType: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Atendimento individual">Atendimento individual</option>
                    <option value="Atividade em grupo">Atividade em grupo</option>
                    <option value="Estimulação cognitiva">Estimulação cognitiva</option>
                    <option value="Treino funcional">Treino funcional</option>
                    <option value="Adaptação ambiental">Adaptação ambiental</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição do atendimento</label>
                  <textarea
                    value={newAttendance.descricaoAtendimento || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, descricaoAtendimento: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Visibilidade do Atendimento</label>
                  <div className="flex flex-col gap-3 sm:flex-row mb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={Array.isArray(newAttendance.visibilidade) ? newAttendance.visibilidade.includes('publico') : newAttendance.visibilidade === 'publico'}
                        onChange={(e) => {
                           let current = Array.isArray(newAttendance.visibilidade) ? [...newAttendance.visibilidade] : [newAttendance.visibilidade as string];
                           if (current.includes('privado')) current = [];
                           if (e.target.checked) current.push('publico');
                           else current = current.filter((v: string) => v !== 'publico');
                           if (!current.includes('admin')) current.push('admin'); 
                           setNewAttendance({...newAttendance, visibilidade: current});
                        }}
                        className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                      />
                      <span className="text-sm font-medium text-gray-700">Público (todos verão no mural)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={Array.isArray(newAttendance.visibilidade) ? newAttendance.visibilidade.includes('admin') : newAttendance.visibilidade === 'admin'}
                        onChange={(e) => {
                           let current = Array.isArray(newAttendance.visibilidade) ? [...newAttendance.visibilidade] : [newAttendance.visibilidade as string];
                           if (current.includes('privado')) current = [];
                           if (e.target.checked) {
                             if (!current.includes('admin')) current.push('admin');
                           } else {
                             current = current.filter((v: string) => v !== 'admin');
                           }
                           setNewAttendance({...newAttendance, visibilidade: current});
                        }}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">Direção e coordenação</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assinatura (Nome do profissional)</label>
                  <textarea
                    value={newAttendance.signature || ''}
                    readOnly
                    rows={3}
                    className="w-full p-3 bg-gray-50 text-gray-500 font-bold text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004c99] outline-none resize-none whitespace-pre-wrap"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAttendance(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-black text-[10px] uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleExportIndividualAttendancePDF(newAttendance)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
                >
                  <Printer size={14} />
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={!newAttendance.attendanceType || !newAttendance.descricaoAtendimento || !newAttendance.signature}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Save size={14} />
                  Salvar Atendimento
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {(!otData.attendances || otData.attendances.length === 0) ? (
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center text-gray-500">
                Nenhum atendimento registrado.
              </div>
            ) : (
              otData.attendances.map((att) => (
                <div key={att.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-[#004c99]">
                      <Clock size={16} />
                      <span className="font-bold">{new Date(att.dateTime).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                        {att.attendanceType}
                        </span>
                        <button
                        onClick={() => handleExportIndividualAttendancePDF(att)}
                        className="p-2 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border"
                        title="Exportar Atendimento"
                        >
                        <Printer size={16} />
                        </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    { (att.descricaoAtendimento || att.attendanceEvolution) && (
                      <div>
                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição / Evolução</span>
                        <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{att.descricaoAtendimento || att.attendanceEvolution}</p>
                      </div>
                    )}
                    {att.visibilidade && (
                      <div>
                        <span className="block text-[10px] font-black text-[#004c99] uppercase tracking-widest">Visibilidade</span>
                        <p className="text-sm text-gray-700 mt-1 capitalize">{att.visibilidade}</p>
                      </div>
                    )}
                    {att.prontuarioNotes && (
                      <div>
                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Anotação Prontuário (Legado)</span>
                        <p className="text-sm text-gray-600 mt-1 italic">{att.prontuarioNotes}</p>
                      </div>
                    )}
                    {att.muralNotes && (
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <span className="block text-[10px] font-black text-orange-600 uppercase tracking-widest">Compartilhado no Mural (Legado)</span>
                        <p className="text-sm text-orange-800 mt-1">{att.muralNotes}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Profissional: <strong className="text-gray-700 whitespace-pre-wrap">{att.profissionalAssinaturaTexto || att.signature || att.profissionalNome || 'N/A'}</strong></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OccupationalTherapyTab;

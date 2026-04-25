import React, { useState } from 'react';
import { Resident, OccupationalTherapyData, OccupationalTherapyAssessment, OccupationalTherapyEvolution, OccupationalTherapyAttendance, MuralMessage } from '../types';
import { Plus, Save, Edit2, CheckCircle, Clock, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import GroupActivityTab from './GroupActivityTab';

interface OccupationalTherapyTabProps {
  resident: Resident;
  onChange: (data: OccupationalTherapyData) => void;
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const OccupationalTherapyTab: React.FC<OccupationalTherapyTabProps> = ({ resident, onChange, residents, onSaveResident, onPostToMural }) => {
  const [activeSubTab, setActiveSubTab] = useState<'avaliacao' | 'evolucao' | 'atendimentos' | 'grupo'>('avaliacao');
  
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
      at.signature || 'N/A'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Data/Hora', 'Tipo', 'Assinatura']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#004c99', textColor: 255 },
      styles: { fontSize: 9 }
    });

    doc.save(`Atendimentos_TO_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  
  const otData = resident.occupationalTherapy || {
    evolutions: [],
    attendances: []
  };

  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
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
    functionalEvolution: '',
    participationEvolution: '',
    currentIndependenceLevel: '',
    piaGoalStatus: '',
    newConduct: ''
  });

  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [newAttendance, setNewAttendance] = useState<Partial<OccupationalTherapyAttendance>>({
    dateTime: new Date().toISOString().slice(0, 16),
    attendanceType: '',
    attendanceEvolution: '',
    prontuarioNotes: '',
    muralNotes: '',
    signature: ''
  });

  const handleSaveAssessment = () => {
    onChange({
      ...otData,
      initialAssessment: assessment as OccupationalTherapyAssessment
    });
    setIsEditingAssessment(false);
  };

  const handleSaveEvolution = () => {
    if (newEvolution.functionalEvolution && newEvolution.newConduct) {
      const evolution: OccupationalTherapyEvolution = {
        id: Date.now().toString(),
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
        functionalEvolution: '',
        participationEvolution: '',
        currentIndependenceLevel: '',
        piaGoalStatus: '',
        newConduct: ''
      });
    }
  };

  const handleSaveAttendance = () => {
    if (newAttendance.attendanceType && newAttendance.attendanceEvolution && newAttendance.signature) {
      const attendance: OccupationalTherapyAttendance = {
        id: Date.now().toString(),
        dateTime: newAttendance.dateTime || new Date().toISOString().slice(0, 16),
        attendanceType: newAttendance.attendanceType,
        attendanceEvolution: newAttendance.attendanceEvolution,
        prontuarioNotes: newAttendance.prontuarioNotes || '',
        muralNotes: newAttendance.muralNotes || '',
        notifyFamily: newAttendance.notifyFamily || false,
        signature: newAttendance.signature
      };
      onChange({
        ...otData,
        attendances: [attendance, ...(otData.attendances || [])]
      });

      if (attendance.muralNotes && onPostToMural) {
        onPostToMural({
          author: attendance.signature || 'Terapeuta Ocupacional',
          text: `[T.O.] ${resident.name}: ${attendance.muralNotes}`,
        });
      }

      setIsAddingAttendance(false);
      setNewAttendance({
        dateTime: new Date().toISOString().slice(0, 16),
        attendanceType: '',
        attendanceEvolution: '',
        prontuarioNotes: '',
        muralNotes: '',
        notifyFamily: false,
        signature: ''
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
        <button
          onClick={() => setActiveSubTab('grupo')}
          className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeSubTab === 'grupo'
              ? 'border-[#004c99] text-[#004c99]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Atividade em Grupo
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
              {!isEditingAssessment ? (
                <button
                  type="button"
                  onClick={() => setIsEditingAssessment(true)}
                  className="bg-[#004c99] hover:bg-blue-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Edit2 size={14} />
                  Editar Avaliação
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveAssessment}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Save size={14} />
                  Salvar Avaliação
                </button>
              )}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
                    value={assessment.motorLimitations || ''}
                    onChange={(e) => setAssessment({ ...assessment, motorLimitations: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Risco de quedas</label>
                  <select
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
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
                    disabled={!isEditingAssessment}
                    value={assessment.functionalSynthesis || ''}
                    onChange={(e) => setAssessment({ ...assessment, functionalSynthesis: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metas terapêuticas</label>
                  <textarea
                    disabled={!isEditingAssessment}
                    value={assessment.piaGoals || ''}
                    onChange={(e) => setAssessment({ ...assessment, piaGoals: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none disabled:opacity-70"
                  />
                </div>
              </div>
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
            <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-md mb-6 relative">
              <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">Registrar Nova Evolução</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data</label>
                  <input
                    type="date"
                    value={newEvolution.date || ''}
                    onChange={(e) => setNewEvolution({ ...newEvolution, date: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Evolução funcional</label>
                  <select
                    value={newEvolution.functionalEvolution || ''}
                    onChange={(e) => setNewEvolution({ ...newEvolution, functionalEvolution: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Melhora">Melhora</option>
                    <option value="Estável">Estável</option>
                    <option value="Piora">Piora</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Participação nas atividades</label>
                  <select
                    value={newEvolution.participationEvolution || ''}
                    onChange={(e) => setNewEvolution({ ...newEvolution, participationEvolution: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Aumentou">Aumentou</option>
                    <option value="Mantida">Mantida</option>
                    <option value="Reduziu">Reduziu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nível de independência atual</label>
                  <select
                    value={newEvolution.currentIndependenceLevel || ''}
                    onChange={(e) => setNewEvolution({ ...newEvolution, currentIndependenceLevel: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Independente">Independente</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Dependente">Dependente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status das metas do PIA</label>
                  <select
                    value={newEvolution.piaGoalStatus || ''}
                    onChange={(e) => setNewEvolution({ ...newEvolution, piaGoalStatus: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Atingida">Atingida</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Não atingida">Não atingida</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nova conduta / ajuste</label>
                <textarea
                  value={newEvolution.newConduct || ''}
                  onChange={(e) => setNewEvolution({ ...newEvolution, newConduct: e.target.value })}
                  rows={3}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingEvolution(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-black text-[10px] uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExportEvolutionPDF}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
                >
                  <Printer size={14} />
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvolution}
                  disabled={!newEvolution.functionalEvolution || !newEvolution.newConduct}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Save size={14} />
                  Salvar Evolução
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {(!otData.evolutions || otData.evolutions.length === 0) ? (
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center text-gray-500">
                Nenhuma evolução registrada.
              </div>
            ) : (
              otData.evolutions.map((ev) => (
                <div key={ev.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-[#004c99]">
                      <Clock size={16} />
                      <span className="font-bold">{ev.date}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Evolução Funcional</span>
                      <span className="text-sm font-medium text-gray-800">{ev.functionalEvolution}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Participação</span>
                      <span className="text-sm font-medium text-gray-800">{ev.participationEvolution || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Independência</span>
                      <span className="text-sm font-medium text-gray-800">{ev.currentIndependenceLevel || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Metas PIA</span>
                      <span className="text-sm font-medium text-gray-800">{ev.piaGoalStatus || 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Conduta / Ajuste</span>
                    <p className="text-sm text-gray-700 mt-1">{ev.newConduct}</p>
                  </div>
                </div>
              ))
            )}
          </div>
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
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Evolução do atendimento</label>
                  <textarea
                    value={newAttendance.attendanceEvolution || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, attendanceEvolution: e.target.value })}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Anotação do prontuário (Registro Interno)</label>
                  <textarea
                    value={newAttendance.prontuarioNotes || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, prontuarioNotes: e.target.value })}
                    rows={2}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Compartilhar no mural (Visível para todos)</label>
                  <textarea
                    value={newAttendance.muralNotes || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, muralNotes: e.target.value.slice(0, 150) })}
                    maxLength={150}
                    rows={2}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
                  />
                  <div className="flex justify-between items-center mt-1 text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400">
                      {newAttendance.muralNotes?.length || 0}/150 caracteres
                    </span>
                    <span className="text-[#004c99]">
                      Limite de 150 caracteres para o mural e notificação familiar
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-green-50 p-4 rounded-xl border border-green-100 mt-4">
                  <input 
                    type="checkbox"
                    id="notifyFamily"
                    checked={newAttendance.notifyFamily || false}
                    onChange={(e) => setNewAttendance({ ...newAttendance, notifyFamily: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="notifyFamily" className="text-sm font-bold text-green-900 cursor-pointer">
                    Notificação Familiar - Incluir este atendimento no resumo mensal de repasse à familia
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assinatura (Nome do profissional)</label>
                  <input
                    type="text"
                    value={newAttendance.signature || ''}
                    onChange={(e) => setNewAttendance({ ...newAttendance, signature: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
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
                  onClick={handleExportAttendancePDF}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
                >
                  <Printer size={14} />
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={!newAttendance.attendanceType || !newAttendance.attendanceEvolution || !newAttendance.signature}
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
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                      {att.attendanceType}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Evolução</span>
                      <p className="text-sm text-gray-800 mt-1">{att.attendanceEvolution}</p>
                    </div>
                    {att.prontuarioNotes && (
                      <div>
                        <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Anotação Prontuário</span>
                        <p className="text-sm text-gray-600 mt-1 italic">{att.prontuarioNotes}</p>
                      </div>
                    )}
                    {att.muralNotes && (
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <span className="block text-[10px] font-black text-orange-600 uppercase tracking-widest">Compartilhado no Mural</span>
                        <p className="text-sm text-orange-800 mt-1">{att.muralNotes}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Profissional: <strong className="text-gray-700">{att.signature}</strong></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'grupo' && (
        <GroupActivityTab
          competence="terapeuta_ocupacional"
          residents={residents}
          onSaveResident={onSaveResident}
        />
      )}
    </div>
  );
};

export default OccupationalTherapyTab;

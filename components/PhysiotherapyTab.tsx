import React, { useState } from 'react';
import { Resident, PhysiotherapyData, PhysiotherapyAssessment, PhysiotherapyEvolution, PhysiotherapyAttendance, MuralMessage } from '../types';
import { Plus, Save, Edit2, CheckCircle, Clock, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import GroupActivityTab from './GroupActivityTab';

interface PhysiotherapyTabProps {
  resident: Resident;
  onChange: (data: PhysiotherapyData) => void;
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const PhysiotherapyTab: React.FC<PhysiotherapyTabProps> = ({ resident, onChange, residents, onSaveResident, onPostToMural }) => {
  const [activeSubTab, setActiveSubTab] = useState<'avaliacao' | 'evolucao' | 'atendimentos' | 'grupo'>('avaliacao');
  
  const handleExportAssessmentPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Avaliação de Fisioterapia', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data da Avaliação: ${assessment.date}`, 14, 35);

    const tableData = [
      ['Avaliação Motora', { content: assessment.motorAssessment || 'N/A', colSpan: 3 }],
      ['Avaliação Respiratória', { content: assessment.respiratoryAssessment || 'N/A', colSpan: 3 }],
      ['Diagnóstico Cinético', { content: assessment.kineticFunctionalDiagnosis || 'N/A', colSpan: 3 }],
      ['Objetivos', { content: assessment.objectives || 'N/A', colSpan: 3 }],
      ['Conduta', { content: assessment.conduct || 'N/A', colSpan: 3 }]
    ];

    (doc as any).autoTable({
      startY: 45,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    doc.save(`Avaliacao_Fisio_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportEvolutionPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Evoluções - Fisioterapia', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    const tableData = (ptData.evolutions || []).map(ev => [
      new Date(ev.date).toLocaleDateString('pt-BR'),
      ev.description || 'N/A',
      ev.treatmentResponse || 'N/A'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Data', 'Descrição', 'Resposta ao Tratamento']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#004c99', textColor: 255 },
      styles: { fontSize: 9 }
    });

    doc.save(`Evolucoes_Fisio_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };


  const handleExportAttendancePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Atendimentos - Fisioterapia', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    const tableData = (ptData.attendances || []).map(at => [
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

    doc.save(`Atendimentos_Fisio_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };


  const ptData = resident.physiotherapy || {
    evolutions: [],
    attendances: []
  };

  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [assessment, setAssessment] = useState<Partial<PhysiotherapyAssessment>>(
    ptData.initialAssessment || {
      date: new Date().toISOString().split('T')[0],
      motorAssessment: '',
      respiratoryAssessment: '',
      kineticFunctionalDiagnosis: '',
      objectives: '',
      conduct: ''
    }
  );

  const [isAddingEvolution, setIsAddingEvolution] = useState(false);
  const [newEvolution, setNewEvolution] = useState<Partial<PhysiotherapyEvolution>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    treatmentResponse: ''
  });

  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [newAttendance, setNewAttendance] = useState<Partial<PhysiotherapyAttendance>>({
    dateTime: new Date().toISOString().slice(0, 16),
    attendanceType: '',
    attendanceEvolution: '',
    prontuarioNotes: '',
    muralNotes: '',
    notifyFamily: false,
    signature: ''
  });

  const handleSaveAssessment = () => {
    onChange({
      ...ptData,
      initialAssessment: assessment as PhysiotherapyAssessment
    });
    
    // Atualizar PIA automaticamente
    if (resident.pia) {
      const updatedPia = { ...resident.pia };
      
      updatedPia.interventions = {
        ...updatedPia.interventions,
        physiotherapy: assessment.conduct || ''
      };
      
      onSaveResident({
        ...resident,
        physiotherapy: {
          ...ptData,
          initialAssessment: assessment as PhysiotherapyAssessment
        },
        pia: updatedPia
      });
    }
    
    setIsEditingAssessment(false);
  };

  const handleAddEvolution = () => {
    if (!newEvolution.description) {
      alert('Descrição da evolução é obrigatória.');
      return;
    }

    const evolutionToSave: PhysiotherapyEvolution = {
      id: Date.now().toString(),
      date: newEvolution.date as string,
      description: newEvolution.description || '',
      treatmentResponse: newEvolution.treatmentResponse || ''
    };

    const newEvolutions = [...(ptData.evolutions || []), evolutionToSave];

    // Atualizar PIA automaticamente
    if (resident.pia) {
      const updatedPia = { ...resident.pia };
      
      updatedPia.goalsStatus = {
        ...updatedPia.goalsStatus,
        physiotherapy: {
          status: updatedPia.goalsStatus.physiotherapy?.status || 'Em andamento',
          reviewDate: updatedPia.goalsStatus.physiotherapy?.reviewDate || '',
          observation: `${updatedPia.goalsStatus.physiotherapy?.observation || ''}\n\nAtualização ${new Date().toLocaleDateString('pt-BR')}: ${newEvolution.treatmentResponse}`
        }
      };

      onChange({
        ...ptData,
        evolutions: newEvolutions
      });
      
      onSaveResident({
        ...resident,
        physiotherapy: {
          ...ptData,
          evolutions: newEvolutions
        },
        pia: updatedPia
      });
    } else {
      onChange({
        ...ptData,
        evolutions: newEvolutions
      });
    }
    
    setIsAddingEvolution(false);
    setNewEvolution({
      date: new Date().toISOString().split('T')[0],
      description: '',
      treatmentResponse: ''
    });
  };

  const handleAddAttendance = () => {
    if (!newAttendance.attendanceType) {
      alert('Tipo de atendimento é obrigatório.');
      return;
    }

    const attendanceToSave: PhysiotherapyAttendance = {
      id: Date.now().toString(),
      dateTime: newAttendance.dateTime as string,
      attendanceType: newAttendance.attendanceType || '',
      attendanceEvolution: newAttendance.attendanceEvolution || '',
      prontuarioNotes: newAttendance.prontuarioNotes || '',
      muralNotes: newAttendance.muralNotes || '',
      notifyFamily: newAttendance.notifyFamily,
      signature: newAttendance.signature || ''
    };

    const newAttendances = [...(ptData.attendances || []), attendanceToSave];

    onChange({
      ...ptData,
      attendances: newAttendances
    });

    if (newAttendance.muralNotes && onPostToMural) {
      onPostToMural({
        author: newAttendance.signature || 'Fisioterapeuta',
        text: `[Fisio] ${resident.name}: ${newAttendance.muralNotes}`
      });
    }
    
    if (newAttendance.notifyFamily) {
      alert(`Notificação enviada aos familiares de ${resident.name} referente ao atendimento de fisioterapia.`);
    }
    
    // Also save in the common Prontuário if prontuarioNotes is filled
    if (newAttendance.prontuarioNotes) {
      onSaveResident({
        ...resident,
        healthUpdates: [
          ...(resident.healthUpdates || []),
          {
            id: Date.now().toString(),
            date: newAttendance.dateTime as string,
            description: `Atendimento Fisioterapia (${newAttendance.attendanceType}): ${newAttendance.prontuarioNotes}`,
            type: 'rotina',
            registeredBy: newAttendance.signature || 'Fisioterapeuta'
          }
        ],
        physiotherapy: {
          ...ptData,
          attendances: newAttendances
        }
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
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs header Navigation */}
      <div className="flex border-b overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('avaliacao')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'avaliacao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Primeiro Atendimento
        </button>
        <button
          onClick={() => setActiveSubTab('evolucao')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'evolucao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Evolução
        </button>
        <button
          onClick={() => setActiveSubTab('atendimentos')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'atendimentos' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Atendimentos
        </button>
        <button
          onClick={() => setActiveSubTab('grupo')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'grupo' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Atividades em Grupo
        </button>
      </div>

      {activeSubTab === 'avaliacao' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center bg-blue-50/50 p-4 border rounded-2xl">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Avaliação Inicial e Diagnóstico Funcional</h3>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-widest">Alimenta o PIA automaticamente</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAssessmentPDF}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar PDF
              </button>
              {!isEditingAssessment && (
                <button
                  onClick={() => setIsEditingAssessment(true)}
                  className="px-4 py-2 bg-white border shadow-sm text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <Edit2 size={14} /> Editar Avaliação
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data da Avaliação</label>
                {isEditingAssessment ? (
                  <input
                    type="date"
                    value={assessment.date}
                    onChange={e => setAssessment({ ...assessment, date: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs font-bold bg-white focus:ring-2 outline-none transition-all"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-800 border">
                    {assessment.date ? new Date(assessment.date).toLocaleDateString('pt-BR') : '-'}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avaliação Motora</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.motorAssessment}
                    onChange={e => setAssessment({ ...assessment, motorAssessment: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[100px] resize-y"
                    placeholder="Trofismo, tônus, força muscular, ADM..."
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[100px] whitespace-pre-wrap">
                    {assessment.motorAssessment || '-'}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avaliação Respiratória</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.respiratoryAssessment}
                    onChange={e => setAssessment({ ...assessment, respiratoryAssessment: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[80px]"
                    placeholder="Padrão respiratório, ausculta, tosse..."
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[80px] whitespace-pre-wrap">
                    {assessment.respiratoryAssessment || '-'}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico Cinético-Funcional</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.kineticFunctionalDiagnosis}
                    onChange={e => setAssessment({ ...assessment, kineticFunctionalDiagnosis: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[80px] whitespace-pre-wrap">
                    {assessment.kineticFunctionalDiagnosis || '-'}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest flex items-center gap-1">Objetivos Terapêuticos <span className="opacity-50">(Irão para o PIA)</span></label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.objectives}
                    onChange={e => setAssessment({ ...assessment, objectives: e.target.value })}
                    className="w-full p-3 border border-blue-200 rounded-xl text-xs bg-blue-50/30 focus:ring-2 outline-none transition-all min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-blue-50/30 rounded-xl text-sm text-gray-800 border border-blue-100 min-h-[80px] whitespace-pre-wrap">
                    {assessment.objectives || '-'}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest flex items-center gap-1">Conduta / Plano de Tratamento <span className="opacity-50">(Irá para o PIA)</span></label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.conduct}
                    onChange={e => setAssessment({ ...assessment, conduct: e.target.value })}
                    className="w-full p-3 border border-blue-200 rounded-xl text-xs bg-blue-50/30 focus:ring-2 outline-none transition-all min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-blue-50/30 rounded-xl text-sm text-gray-800 border border-blue-100 min-h-[80px] whitespace-pre-wrap">
                    {assessment.conduct || '-'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isEditingAssessment && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button 
                onClick={() => setIsEditingAssessment(false)}
                className="px-6 py-3 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExportAssessmentPDF}
                className="px-6 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={16} />
                Exportar PDF
              </button>
              <button 
                onClick={handleSaveAssessment}
                className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 shadow-xl flex items-center gap-2 transition-all"
              >
                <Save size={16} /> Salvar Avaliação e Atualizar PIA
              </button>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'evolucao' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center bg-blue-50/50 p-4 border rounded-2xl">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Evolução Fisioterapêutica</h3>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-widest">Registros de progresso</p>
            </div>
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
                  onClick={() => setIsAddingEvolution(true)}
                  className="px-4 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 shadow-xl flex items-center gap-2 transition-all"
                >
                  <Plus size={16} /> Nova Evolução
                </button>
              )}
            </div>
          </div>

          {isAddingEvolution && (
            <div className="bg-white p-6 rounded-2xl border shadow-lg space-y-4">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest border-b pb-4">Registrar Nova Evolução</h3>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</label>
                <input
                  type="date"
                  value={newEvolution.date}
                  onChange={e => setNewEvolution({ ...newEvolution, date: e.target.value })}
                  className="w-full max-w-[200px] p-3 border rounded-xl text-xs font-bold outline-none focus:ring-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição da Evolução</label>
                <textarea
                  value={newEvolution.description}
                  onChange={e => setNewEvolution({ ...newEvolution, description: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[100px]"
                  placeholder="Descreva o quadro evolutivo..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest">Resposta ao Tratamento <span className="opacity-50">(Enviado ao PIA)</span></label>
                <textarea
                  value={newEvolution.treatmentResponse}
                  onChange={e => setNewEvolution({ ...newEvolution, treatmentResponse: e.target.value })}
                  className="w-full p-3 border border-blue-200 bg-blue-50/30 rounded-xl text-xs focus:ring-2 outline-none transition-all min-h-[80px]"
                  placeholder="Resposta aos objetivos propostos..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => setIsAddingEvolution(false)}
                  className="px-6 py-3 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExportEvolutionPDF}
                  className="px-6 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
                >
                  <Printer size={16} />
                  Exportar PDF
                </button>
                <button 
                  onClick={handleAddEvolution}
                  className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all"
                >
                  <Save size={16} /> Salvar Evolução
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {(!ptData.evolutions || ptData.evolutions.length === 0) ? (
              <div className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhuma evolução registrada</p>
              </div>
            ) : (
              ptData.evolutions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(evolution => (
                <div key={evolution.id} className="bg-white p-5 rounded-2xl border shadow-sm group hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center justify-center p-3 bg-blue-50 text-[#004c99] rounded-xl">
                      <Clock size={20} />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-gray-800 uppercase tracking-tighter">
                        {new Date(evolution.date).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{evolution.description}</p>
                    </div>
                    {evolution.treatmentResponse && (
                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-black text-[#004c99] uppercase tracking-widest mb-1">Resposta ao Tratamento</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{evolution.treatmentResponse}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'atendimentos' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-blue-50/50 p-4 border rounded-2xl gap-4">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Atendimentos Diários</h3>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-widest">Registros de sessões e compartilhamento</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExportAttendancePDF}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex justify-center items-center gap-2 shadow-sm"
              >
                <Printer size={16} /> Exportar PDF
              </button>
              {!isAddingAttendance && (
                <button
                  onClick={() => setIsAddingAttendance(true)}
                  className="flex-1 sm:flex-none px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex justify-center items-center gap-2 hover:bg-blue-800 transition-all"
                >
                  <Plus size={16} /> Novo Atendimento
                </button>
              )}
            </div>
          </div>

          {isAddingAttendance && (
            <div className="bg-white p-6 rounded-2xl border shadow-xl space-y-5">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest border-b pb-4">Registrar Novo Atendimento</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={newAttendance.dateTime}
                    onChange={e => setNewAttendance({ ...newAttendance, dateTime: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs font-bold bg-white focus:ring-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de Atendimento</label>
                  <select
                    value={newAttendance.attendanceType}
                    onChange={e => setNewAttendance({ ...newAttendance, attendanceType: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs font-bold bg-white focus:ring-2 outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="Sessão Fisioterapia Motora">Sessão Fisioterapia Motora</option>
                    <option value="Sessão Fisioterapia Respiratória">Sessão Fisioterapia Respiratória</option>
                    <option value="Prevenção de Quedas">Prevenção de Quedas</option>
                    <option value="Recusa de Atendimento">Recusa de Atendimento</option>
                    <option value="Avaliação Especial">Avaliação Especial</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Evolução do Atendimento</label>
                <textarea
                  value={newAttendance.attendanceEvolution}
                  onChange={e => setNewAttendance({ ...newAttendance, attendanceEvolution: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[100px]"
                  placeholder="Relato de como foi a sessão..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest">Anotações para Prontuário Geral</label>
                  <textarea
                    value={newAttendance.prontuarioNotes}
                    onChange={e => setNewAttendance({ ...newAttendance, prontuarioNotes: e.target.value })}
                    className="w-full p-3 border border-blue-200 bg-blue-50/30 rounded-xl text-xs focus:ring-2 outline-none min-h-[80px]"
                    placeholder="Informações relevantes para toda a equipe..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest">Mensagem para Mural da Equipe</label>
                  <textarea
                    value={newAttendance.muralNotes}
                    onChange={e => setNewAttendance({ ...newAttendance, muralNotes: e.target.value.slice(0, 150) })}
                    maxLength={150}
                    className="w-full p-3 border border-blue-200 bg-blue-50/30 rounded-xl text-xs focus:ring-2 outline-none min-h-[80px]"
                    placeholder="Alerta importante para o mural..."
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
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 border rounded-xl">
                <input
                  type="checkbox"
                  id="notifyFamily"
                  checked={newAttendance.notifyFamily}
                  onChange={e => setNewAttendance({ ...newAttendance, notifyFamily: e.target.checked })}
                  className="w-5 h-5 text-[#004c99] rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="notifyFamily" className="text-sm font-bold text-gray-700 cursor-pointer">
                  Notificar Familiares sobre este atendimento
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assinatura / Responsável</label>
                <input
                  type="text"
                  value={newAttendance.signature}
                  onChange={e => setNewAttendance({ ...newAttendance, signature: e.target.value })}
                  className="w-full max-w-[300px] p-3 border rounded-xl text-xs font-bold bg-white focus:ring-2 outline-none"
                  placeholder="Nome do Profissional"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                <button 
                  onClick={() => setIsAddingAttendance(false)}
                  className="px-6 py-3 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExportAttendancePDF}
                  className="px-6 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
                >
                  <Printer size={16} />
                  Exportar PDF
                </button>
                <button 
                  onClick={handleAddAttendance}
                  className="px-8 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 shadow-xl flex items-center gap-2 transition-all"
                >
                  <Save size={16} /> Salvar Atendimento
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {(!ptData.attendances || ptData.attendances.length === 0) ? (
              <div className="text-center p-10 bg-gray-50 rounded-2xl border-2 border-dashed">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum atendimento registrado</p>
              </div>
            ) : (
              ptData.attendances.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).map(attendance => (
                <div key={attendance.id} className="bg-white p-5 rounded-2xl border shadow-sm group hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 text-[#004c99] rounded-xl flex items-center justify-center font-black">
                        {new Date(attendance.dateTime).getDate().toString().padStart(2, '0')}
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-800 tracking-tighter uppercase">{attendance.attendanceType}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                          {new Date(attendance.dateTime).toLocaleString('pt-BR')} • {attendance.signature}
                        </div>
                      </div>
                    </div>
                    {attendance.notifyFamily && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest rounded-full">
                        Família Notificada
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {attendance.attendanceEvolution && (
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Evolução do Atendimento</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{attendance.attendanceEvolution}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {attendance.prontuarioNotes && (
                        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                          <p className="text-[10px] font-black text-[#004c99] uppercase tracking-widest mb-1">Nota no Prontuário</p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">{attendance.prontuarioNotes}</p>
                        </div>
                      )}
                      {attendance.muralNotes && (
                        <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 text-orange-800">
                           <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-orange-600">Compartilhado no Mural</p>
                           <p className="text-xs whitespace-pre-wrap opacity-90">{attendance.muralNotes}</p>
                        </div>
                      )}
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
          activities={ptData.groupActivities || []} 
          competency="fisioterapeuta"
          residents={residents}
          onSave={activities => {
            const newData = { ...ptData, groupActivities: activities };
            onChange(newData);
            onSaveResident({
              ...resident,
              physiotherapy: newData
            });
          }}
        />
      )}
    </div>
  );
};

export default PhysiotherapyTab;

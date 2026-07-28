import { getProfessionalSignature } from '../lib/api';
import { StandardEvolutionForm } from './StandardEvolutionForm';
import { StandardEvolutionHistory } from './StandardEvolutionHistory';
import React, { useState } from 'react';
import { Resident, PhysiotherapyData, PhysiotherapyAssessment, PhysiotherapyEvolution, PhysiotherapyAttendance, MuralMessage } from '../types';
import { Plus, Save, Edit2, CheckCircle, Clock, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';

import 'jspdf-autotable';
import GroupActivityTab from './GroupActivityTab';

const mobilityOptionsList = ['Deambula sem auxílio', 'Deambula com bengala', 'Deambula com andador', 'Cadeirante', 'Acamado', 'Necessita auxílio parcial', 'Necessita auxílio total', 'Apresenta dificuldade para transferências', 'Apresenta risco de queda'];
const balanceOptionsList = ['Marcha preservada', 'Marcha instável', 'Déficit de equilíbrio', 'Fraqueza em membros inferiores', 'Fraqueza em membros superiores', 'Histórico de quedas', 'Necessita supervisão ao caminhar'];
const painOptionsList = ['Sem queixa de dor', 'Dor ao movimento', 'Dor lombar', 'Dor em joelho/quadril', 'Dor em ombro/braço', 'Rigidez articular', 'Limitação de amplitude de movimento', 'Sem alteração respiratória aparente', 'Necessita atenção respiratória'];
const therapeuticGoalsList = ['Manter mobilidade', 'Melhorar equilíbrio', 'Reduzir risco de quedas', 'Fortalecer membros inferiores', 'Fortalecer membros superiores', 'Melhorar transferências', 'Preservar autonomia', 'Prevenir contraturas', 'Melhorar conforto e posicionamento', 'Estimular marcha', 'Aliviar dor'];
const treatmentConductsList = ['Cinesioterapia', 'Alongamentos', 'Fortalecimento muscular', 'Treino de marcha', 'Treino de equilíbrio', 'Exercícios respiratórios', 'Mobilização passiva', 'Mobilização ativa-assistida', 'Posicionamento no leito/cadeira', 'Orientação à equipe de cuidados', 'Atendimento individual', 'Atividade em grupo'];

const currentSituationOptionsList = ['Mantém quadro anterior', 'Apresentou melhora', 'Apresentou piora', 'Apresentou oscilação funcional', 'Nova limitação identificada', 'Nova queda/intercorrência', 'Necessita ajuste no plano'];
const currentMobilityOptionsList = ['Mantém deambulação', 'Melhorou deambulação', 'Piorou deambulação', 'Necessita mais auxílio', 'Necessita menos auxílio', 'Mantém risco de queda', 'Reduziu risco de queda', 'Aumentou risco de queda', 'Apresenta dor ou limitação nova'];
const piaGoalsUpdateOptionsList = ['Manter objetivos atuais', 'Alterar objetivos', 'Incluir novo objetivo', 'Encerrar objetivo alcançado'];
const conductUpdateOptionsList = ['Manter plano atual', 'Intensificar acompanhamento', 'Reduzir acompanhamento', 'Alterar exercícios/condutas', 'Orientar equipe de cuidados', 'Encaminhar para avaliação médica', 'Registrar apenas acompanhamento'];

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

interface PhysiotherapyTabProps {
  resident: Resident;
  settings?: any;
  onChange: (data: PhysiotherapyData) => void;
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const PhysiotherapyTab: React.FC<PhysiotherapyTabProps> = ({ resident, settings, onChange, residents, onSaveResident, onPostToMural }) => {
  const [activeSubTab, setActiveSubTab] = useState<'avaliacao' | 'evolucao' | 'atendimentos'>('avaliacao');
  
  const handleExportAssessmentPDF = async () => {
    const title = 'PRIMEIRA AVALIAÇÃO DE FISIOTERAPIA';
    const { getHtmlPrintHeader, getHtmlPrintFooter, getHtmlPrintStyles, printHtml } = await import('../lib/pdfHelpers');
    
    const headerHtml = await getHtmlPrintHeader(settings, title);
    const sigData = getProfessionalSignature();
    const signatureName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Profissional não identificado';
    const role = sigData.profissionalRole ? ` - ${sigData.profissionalRole}` : ' - Fisioterapeuta';

    const calculateAgePDF = (birthDateString: string) => {
      if (!birthDateString) return '';
      let parts = birthDateString.split('/');
      let birthDate = parts.length === 3 
        ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) 
        : new Date(birthDateString);
      if (isNaN(birthDate.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return age + ' anos';
    };

    const ageCalculated = resident.birthDate ? calculateAgePDF(resident.birthDate) : '';
    const ageText = ageCalculated ? ` (Idade: ${ageCalculated})` : '';
    
    const contentHtml = `
      <div class="field">
        <span class="label">Residente:</span>
        <span class="value">${resident.name || 'Não informado'} ${ageText}</span>
      </div>
      <div class="field">
        <span class="label">Data de Nascimento:</span>
        <span class="value">${resident.birthDate || 'Não informado'}</span>
      </div>
      <div class="field">
        <span class="label">Quarto/Leito:</span>
        <span class="value">${resident.room || 'Não informado'} ${resident.bedNumber ? '- Leito ' + resident.bedNumber : ''}</span>
      </div>
      <div class="field">
        <span class="label">Data da Avaliação:</span>
        <span class="value">${assessment.date ? new Date(assessment.date).toLocaleDateString('pt-BR') : 'Não informado'}</span>
      </div>

      <div class="section-title">Avaliação Motora</div>
      <div class="paragraph">${assessment.motorAssessment || 'Não informado'}</div>

      <div class="section-title">Avaliação Respiratória</div>
      <div class="paragraph">${assessment.respiratoryAssessment || 'Não informado'}</div>

      <div class="section-title">Diagnóstico Cinesiofuncional</div>
      <div class="paragraph">${assessment.kineticFunctionalDiagnosis || 'Não informado'}</div>

      <div class="section-title">Objetivos Terapêuticos</div>
      <div class="paragraph">${assessment.objectives || 'Não informado'}</div>

      <div class="section-title">Condutas Terapêuticas</div>
      <div class="paragraph">${assessment.conduct || 'Não informado'}</div>

      <div class="section-title">Plano de Tratamento Detalhado</div>
      <div class="paragraph">${assessment.detailedTreatmentPlan || 'Não informado'}</div>

      <div class="section-title">Observações Finais</div>
      <div class="paragraph">${assessment.finalObservations || 'Não informado'}</div>

      <div class="signature-box">
        <div class="signature-line">${signatureName}</div>
        <div class="signature-role">${role.replace(' - ', '')}</div>
      </div>
    `;

    const footerHtml = getHtmlPrintFooter();
    const styles = getHtmlPrintStyles();

    printHtml(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${styles}
            .paragraph { font-family: sans-serif; }
            .section-title { margin-top: 25px; }
          </style>
        </head>
        <body>
          <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            ${headerHtml}
            ${contentHtml}
            ${footerHtml}
          </div>
        </body>
      </html>
    `);
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

    addPdfSignatureNode(doc);
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
    doc.save(`Atendimentos_Fisio_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportIndividualAttendancePDF = async (att: any) => {
    await printAttendanceHtmlPdf(att, resident, settings, 'Fisioterapia');
  };


  const ptData = resident.physiotherapy || {
    evolutions: [],
    attendances: []
  };

  const [assessment, setAssessment] = useState<Partial<PhysiotherapyAssessment>>(
    ptData.initialAssessment || {
      date: new Date().toISOString().split('T')[0],
      motorAssessment: '',
      respiratoryAssessment: '',
      kineticFunctionalDiagnosis: '',
      objectives: '',
      conduct: '',
      mobilityConditions: [],
      balanceAndStrength: [],
      painAndLimitations: [],
      therapeuticGoals: [],
      treatmentConducts: []
    }
  );

  const [isAddingEvolution, setIsAddingEvolution] = useState(false);
  const [newEvolution, setNewEvolution] = useState<Partial<PhysiotherapyEvolution>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    treatmentResponse: '',
    currentSituationOptions: [],
    currentMobilityOptions: [],
    piaGoalsUpdateOptions: [],
    conductUpdateOptions: []
  });

  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [newAttendance, setNewAttendance] = useState<Partial<PhysiotherapyAttendance>>(() => {
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
      let finalResident = { ...resident };
      
      finalResident.physiotherapy = {
        ...ptData,
        initialAssessment: assessment as PhysiotherapyAssessment
      };
      
      // Atualizar PIA automaticamente se existir
      if (finalResident.pia) {
        finalResident.pia = {
          ...finalResident.pia,
          interventions: {
            ...finalResident.pia.interventions,
            physiotherapy: (assessment.treatmentConducts?.join(', ') || '') + '\n' + (assessment.detailedTreatmentPlan || '')
          }
        };
      }
      
      // Salva uma única vez para evitar condições de corrida (evitando chamar onChange e onSaveResident simultaneamente)
      onSaveResident(finalResident);
      
      // Post to Mural
      if (onPostToMural) {
        const sigData = getProfessionalSignature();
        const role = sigData.profissionalRole ? ` - ${sigData.profissionalRole}` : ' - Fisioterapeuta';
        const signatureName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Profissional não identificado';
        
        onPostToMural({
          author: signatureName,
          text: `**Primeira Avaliação Registrada**\n\n**Área:** Fisioterapia\n**Residente:** ${resident.name}\n**Profissional:** ${signatureName}${role}\n**Data:** ${new Date().toLocaleString('pt-BR')}`,
          visibilidade: ['admin'] // Sugestão para visibilidade de administração
        });
      }

      alert('Avaliação Inicial Fisioterapêutica salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      alert('Ocorreu um erro ao salvar a avaliação.');
    }
  };

  const handleAddEvolution = () => {
    const mainDesc = newEvolution.evolutionDescription || newEvolution.description;
    
    if (!mainDesc) {
      alert('Descrição da situação atual é obrigatória.');
      return;
    }

    const evolutionToSave: PhysiotherapyEvolution = {
      id: Date.now().toString(), ...getProfessionalSignature(),
      date: newEvolution.date as string,
      description: mainDesc,
      treatmentResponse: newEvolution.updatedConduct || newEvolution.treatmentResponse || '',
      currentSituationOptions: newEvolution.currentSituationOptions,
      evolutionDescription: newEvolution.evolutionDescription,
      currentMobilityOptions: newEvolution.currentMobilityOptions,
      functionalObservations: newEvolution.functionalObservations,
      piaGoalsUpdateOptions: newEvolution.piaGoalsUpdateOptions,
      updatedGoals: newEvolution.updatedGoals,
      conductUpdateOptions: newEvolution.conductUpdateOptions,
      updatedConduct: newEvolution.updatedConduct,
      finalObservations: newEvolution.finalObservations
    };

    const newEvolutions = [...(ptData.evolutions || []), evolutionToSave];

    const updatedResident = {
      ...resident,
      physiotherapy: {
        ...ptData,
        evolutions: newEvolutions
      }
    };

    // Atualizar PIA automaticamente
    if (resident.pia) {
      const updatedPia = { ...resident.pia };
      
      updatedPia.goalsStatus = {
        ...updatedPia.goalsStatus,
        physiotherapy: {
          status: updatedPia.goalsStatus.physiotherapy?.status || 'Em andamento',
          reviewDate: updatedPia.goalsStatus.physiotherapy?.reviewDate || '',
          observation: `${updatedPia.goalsStatus.physiotherapy?.observation || ''}\n\nAtualização ${new Date().toLocaleDateString('pt-BR')}: ${evolutionToSave.treatmentResponse}`
        }
      };
      updatedResident.pia = updatedPia;
    }

    onSaveResident(updatedResident);
    
    setIsAddingEvolution(false);
    setNewEvolution({
      date: new Date().toISOString().split('T')[0],
      currentSituationOptions: [],
      currentMobilityOptions: [],
      piaGoalsUpdateOptions: [],
      conductUpdateOptions: []
    });
  };

  const handleAddAttendance = () => {
    if (!newAttendance.attendanceType) {
      alert('Tipo de atendimento é obrigatório.');
      return;
    }

    const attendanceToSave: PhysiotherapyAttendance = {
      id: Date.now().toString(), ...getProfessionalSignature(),
      dateTime: newAttendance.dateTime as string,
      attendanceType: newAttendance.attendanceType || '',
      descricaoAtendimento: newAttendance.descricaoAtendimento || '',
      visibilidade: newAttendance.visibilidade as any,
      signature: newAttendance.signature || ''
    };

    const newAttendances = [...(ptData.attendances || []), attendanceToSave];

    if (Array.isArray(attendanceToSave.visibilidade) && !attendanceToSave.visibilidade.includes('privado') && onPostToMural) {
      let muralText = `[Fisio] Atendimento de ${resident.name} finalizado.\n\n${attendanceToSave.descricaoAtendimento}`;
      onPostToMural({
        author: newAttendance.signature || 'Fisioterapeuta',
        text: muralText,
        visibilidade: attendanceToSave.visibilidade as string[]
      });
    }
    
    // Save in the common Prontuário and physiotherapy record in a single atomic write
    onSaveResident({
      ...resident,
      healthUpdates: [
        ...(resident.healthUpdates || []),
        {
          id: Date.now().toString(), ...getProfessionalSignature(),
          date: newAttendance.dateTime as string,
          description: `Atendimento Fisioterapia (${newAttendance.attendanceType}): ${attendanceToSave.descricaoAtendimento}`,
          type: 'rotina',
          registeredBy: newAttendance.signature || 'Fisioterapeuta'
        }
      ],
      physiotherapy: {
        ...ptData,
        attendances: newAttendances
      }
    });

    setIsAddingAttendance(false);
    const sigData = getProfessionalSignature();
    setNewAttendance({
      dateTime: new Date().toISOString().slice(0, 16),
      attendanceType: '',
      descricaoAtendimento: '',
      visibilidade: ['admin'],
      signature: sigData.profissionalAssinaturaTexto || sigData.profissionalNome || ''
    });
  };

  // For rendering the content, we'll extract the viewing vs editing modes.
  return (
    <div className="space-y-6">
      {/* Sub-tabs header Navigation */}
      <div className="flex border-b overflow-x-auto no-scrollbar">
        <button type="button"
          onClick={() => setActiveSubTab('avaliacao')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'avaliacao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Primeiro Atendimento
        </button>
        <button type="button"
          onClick={() => setActiveSubTab('evolucao')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'evolucao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Evolução
        </button>
        <button type="button"
          onClick={() => setActiveSubTab('atendimentos')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'atendimentos' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Atendimentos
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-6">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data da Avaliação</label>
                 <input
                   type="date"
                   value={assessment.date}
                   onChange={e => setAssessment({ ...assessment, date: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm font-bold bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                 />
               </div>

               <ChecklistGroup label="Condição motora e mobilidade" options={mobilityOptionsList} selected={assessment.mobilityConditions} onChange={(s) => setAssessment({ ...assessment, mobilityConditions: s })} isEditing={true} />
               
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre mobilidade</label>
                 <textarea
                   value={assessment.mobilityObservations || ''}
                   onChange={e => setAssessment({ ...assessment, mobilityObservations: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[80px] transition-all"
                 />
               </div>

               <ChecklistGroup label="Equilíbrio, marcha e força" options={balanceOptionsList} selected={assessment.balanceAndStrength} onChange={(s) => setAssessment({ ...assessment, balanceAndStrength: s })} isEditing={true} />

               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre marcha e força</label>
                 <textarea
                   value={assessment.balanceObservations || ''}
                   onChange={e => setAssessment({ ...assessment, balanceObservations: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[80px] transition-all"
                 />
               </div>

               <ChecklistGroup label="Dor, limitações e respiração" options={painOptionsList} selected={assessment.painAndLimitations} onChange={(s) => setAssessment({ ...assessment, painAndLimitations: s })} isEditing={true} />

               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre dor e limitações</label>
                 <textarea
                   value={assessment.painObservations || ''}
                   onChange={e => setAssessment({ ...assessment, painObservations: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[80px] transition-all"
                 />
               </div>
             </div>

             <div className="space-y-6">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico fisioterapêutico / funcional</label>
                 <textarea
                   value={assessment.functionalDiagnosis || assessment.kineticFunctionalDiagnosis || ''}
                   onChange={e => setAssessment({ ...assessment, functionalDiagnosis: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[100px] transition-all"
                 />
               </div>

               <ChecklistGroup label="Objetivos Terapêuticos (PIA)" options={therapeuticGoalsList} selected={assessment.therapeuticGoals} onChange={(s) => setAssessment({ ...assessment, therapeuticGoals: s })} isEditing={true} />

               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Objetivos Específicos</label>
                 <textarea
                   value={assessment.specificGoals || assessment.objectives || ''}
                   onChange={e => setAssessment({ ...assessment, specificGoals: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[80px] transition-all"
                 />
               </div>

               <ChecklistGroup label="Conduta / Plano de Tratamento (PIA)" options={treatmentConductsList} selected={assessment.treatmentConducts} onChange={(s) => setAssessment({ ...assessment, treatmentConducts: s })} isEditing={true} />

               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plano de Tratamento Detalhado</label>
                 <textarea
                   value={assessment.detailedTreatmentPlan || assessment.conduct || ''}
                   onChange={e => setAssessment({ ...assessment, detailedTreatmentPlan: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[100px] transition-all"
                 />
               </div>

               <div className="space-y-1">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Finais</label>
                 <textarea
                   value={assessment.finalObservations || ''}
                   onChange={e => setAssessment({ ...assessment, finalObservations: e.target.value })}
                   className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50 focus:bg-white focus:border-[#004c99] focus:ring-4 focus:ring-blue-50 outline-none min-h-[80px] transition-all"
                 />
               </div>
             </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t mt-6">
            <button type="button" 
              onClick={handleSaveAssessment}
              className="px-8 py-4 bg-[#004c99] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-800 shadow-xl shadow-blue-900/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Save size={18} /> Salvar Avaliação e Atualizar PIA
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'evolucao' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-blue-50/50 p-4 border rounded-2xl">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Evolução Fisioterapêutica</h3>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-widest">Registros de progresso</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportEvolutionPDF}
                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar Histórico
              </button>
              {!isAddingEvolution && (
                <button
                  type="button"
                  onClick={() => setIsAddingEvolution(true)}
                  className="px-4 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 shadow-xl flex items-center gap-2 transition-all"
                >
                  <Plus size={16} /> Nova Evolução
                </button>
              )}
            </div>
          </div>

          {isAddingEvolution && (
            <StandardEvolutionForm 
               areaLabel="Fisioterapêutica"
               onSave={(data) => {
                 const evolutions = resident.physiotherapy?.evolutions || [];
                 const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
                 onChange({
...ptData,
evolutions: newEvolutions as any
});
                 setIsAddingEvolution(false);
               }}
               onCancel={() => setIsAddingEvolution(false)}
            />
          )}

          {!isAddingEvolution && (
            <StandardEvolutionHistory 
               evolutions={(resident.physiotherapy?.evolutions as any) || []} 
               areaLabel="Fisioterapêutica" 
               renderLegacyDetails={(ev: any) => {
                 if(!ev.evolutionDescription && !ev.functionalObservations && !ev.treatmentResponse) return null;
                 return (
                   <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
                       {ev.evolutionDescription && <p className="mb-2 whitespace-pre-wrap">{ev.evolutionDescription}</p>}
                       {ev.functionalObservations && <p><strong>Observações Funcionais:</strong> {ev.functionalObservations}</p>}
                       {ev.treatmentResponse && <p><strong>Resposta ao Tratamento:</strong> {ev.treatmentResponse}</p>}
                   </div>
                 );
               }}
            />
          )}
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
                <button type="button"
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição do Atendimento</label>
                <textarea
                  value={newAttendance.descricaoAtendimento}
                  onChange={e => setNewAttendance({ ...newAttendance, descricaoAtendimento: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[100px]"
                  placeholder="Relato de como foi a sessão..."
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

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assinatura / Responsável</label>
                <textarea
                  value={newAttendance.signature}
                  readOnly
                  rows={3}
                  className="w-full max-w-[300px] p-3 border rounded-xl text-xs font-bold bg-gray-50 text-gray-500 focus:ring-2 outline-none resize-none whitespace-pre-wrap"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                <button type="button" 
                  onClick={() => setIsAddingAttendance(false)}
                  className="px-6 py-3 text-[10px] font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleExportIndividualAttendancePDF(newAttendance)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
                >
                  <Printer size={16} />
                  Exportar PDF
                </button>
                <button type="button" 
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
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 text-[#004c99] rounded-xl flex items-center justify-center font-black">
                        {new Date(attendance.dateTime).getDate().toString().padStart(2, '0')}
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-800 tracking-tighter uppercase">{attendance.attendanceType}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5 whitespace-pre-wrap">
                          {new Date(attendance.dateTime).toLocaleString('pt-BR')} • {attendance.profissionalAssinaturaTexto || attendance.signature || attendance.profissionalNome || 'Profissional'}
                        </div>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => handleExportIndividualAttendancePDF(attendance)}
                      className="p-2 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border"
                      title="Exportar Atendimento"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {(attendance.descricaoAtendimento || attendance.attendanceEvolution) && (
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição / Evolução</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{attendance.descricaoAtendimento || attendance.attendanceEvolution}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {attendance.visibilidade && (
                         <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                           <p className="text-[10px] font-black text-[#004c99] uppercase tracking-widest mb-1">Visibilidade</p>
                           <p className="text-xs text-gray-700 whitespace-pre-wrap capitalize">{attendance.visibilidade}</p>
                         </div>
                      )}
                      {attendance.prontuarioNotes && (
                        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                          <p className="text-[10px] font-black text-[#004c99] uppercase tracking-widest mb-1">Nota no Prontuário</p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">{attendance.prontuarioNotes}</p>
                        </div>
                      )}
                      {attendance.muralNotes && (
                        <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 text-orange-800">
                           <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-orange-600">Compartilhado no Mural (Legado)</p>
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
    </div>
  );
};

export default PhysiotherapyTab;

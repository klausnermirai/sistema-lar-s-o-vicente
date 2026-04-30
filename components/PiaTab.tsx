import React, { useState } from 'react';
import { Resident, PiaData, PiaGoalStatus, PiaRevision, InstitutionSettings } from '../types';
import { Plus, Save, Edit2, CheckCircle, Clock, Printer, User, FileText, HeartPulse, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';

interface PiaTabProps {
  resident: Resident;
  onChange: (pia: PiaData) => void;
  settings?: InstitutionSettings | null;
}

const PiaTab: React.FC<PiaTabProps> = ({ resident, onChange, settings }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingRevision, setIsAddingRevision] = useState(false);
  const [newRevision, setNewRevision] = useState<Partial<PiaRevision>>({});

  const pia = resident.pia || {
    status: 'Ativo',
    generalSynthesis: '',
    interventions: {
      nutrition: '',
      psychology: '',
      medical: '',
      occupationalTherapy: '',
      physiotherapy: ''
    },
    goalsStatus: {
      nutrition: { status: '', reviewDate: '', observation: '' },
      psychology: { status: '', reviewDate: '', observation: '' },
      occupationalTherapy: { status: '', reviewDate: '', observation: '' },
      physiotherapy: { status: '', reviewDate: '', observation: '' }
    },
    revisions: []
  };

  const [localPia, setLocalPia] = useState<PiaData>(pia as PiaData);

  const handleCreateOrEdit = () => setIsEditing(true);

  const handleSave = () => {
    if (!localPia.createdAt) {
      localPia.createdAt = new Date().toLocaleDateString('pt-BR');
    }
    onChange(localPia);
    setIsEditing(false);
  };

  const handleSaveRevision = () => {
    if (newRevision.changes && newRevision.professional) {
      const revision: PiaRevision = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('pt-BR'),
        changes: newRevision.changes || '',
        professional: newRevision.professional || '',
        observation: newRevision.observation || ''
      };
      const updatedPia = {
        ...localPia,
        revisions: [revision, ...localPia.revisions]
      };
      setLocalPia(updatedPia);
      onChange(updatedPia);
      setIsAddingRevision(false);
      setNewRevision({});
    }
  };

  const calculateAge = (birthDateString: string) => {
    if (!birthDateString) return 'N/A';
    // Format could be DD/MM/YYYY or YYYY-MM-DD
    let parts = birthDateString.split('/');
    let birthDate;
    if (parts.length === 3) {
      birthDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      birthDate = new Date(birthDateString);
    }
    
    if (isNaN(birthDate.getTime())) return 'N/A';
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age + ' anos';
  };

  const nutInitial = resident.nutrition?.initialAssessment;
  const psyInitial = resident.psychology?.initialAssessment || resident.psychology?.anamnese;
  const otInitial = resident.occupationalTherapy?.initialAssessment;
  const ptInitial = resident.physiotherapy?.initialAssessment;
  const medStatus = resident.medicalStatus || resident.medicalOpinion || 'Sem registro médico';
  const interview = resident.interview;

  const handleGeneratePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 45;

    const checkPageBreak = (neededHeight: number) => {
      if (yPos + neededHeight > 270) {
        doc.addPage();
        yPos = 45;
      }
    };

    const addSectionTitle = (title: string, iconStr: string = '') => {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 76, 153);
      doc.text(iconStr ? `${iconStr} ${title}` : title, 14, yPos);
      yPos += 2;
      doc.setDrawColor(0, 76, 153);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 6;
      doc.setTextColor(30, 30, 30);
    };

    const addText = (label: string, text: string, isBoldLabel = true, widthFactor = 1) => {
      if (!text) text = 'N/A';
      checkPageBreak(8);
      doc.setFontSize(10);
      
      if (isBoldLabel) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, yPos);
        const labelWidth = doc.getTextWidth(`${label}: `);
        doc.setFont('helvetica', 'normal');
        
        const contentWidth = (pageWidth - 28) * widthFactor - labelWidth;
        const splitText = doc.splitTextToSize(text, contentWidth);
        
        doc.text(splitText, 14 + labelWidth, yPos);
        yPos += (splitText.length * 5) + 2;
      } else {
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(text, (pageWidth - 28) * widthFactor);
        doc.text(splitText, 14, yPos);
        yPos += (splitText.length * 5) + 2;
      }
    };

    const addRow = (items: {label: string, text: string}[]) => {
      checkPageBreak(10);
      const cols = items.length;
      const colWidth = (pageWidth - 28) / cols;
      let maxHeight = 0;
      let startY = yPos;

      items.forEach((item, idx) => {
        const xPos = 14 + (idx * colWidth);
        const textToPrint = item.text || 'N/A';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${item.label}:`, xPos, startY);
        const labelWidth = doc.getTextWidth(`${item.label}: `);
        
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(textToPrint, colWidth - labelWidth - 2);
        doc.text(splitText, xPos + labelWidth, startY);
        
        if (splitText.length > maxHeight) {
          maxHeight = splitText.length;
        }
      });
      yPos += (maxHeight * 5) + 2;
    };

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text('Ficha Completa e Plano Individual de Atendimento (PIA)', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // 1. Identificação
    addSectionTitle('1. Dados Pessoais e de Identificação');
    addRow([
      { label: 'Nome', text: resident.name },
      { label: 'Idade', text: calculateAge(resident.birthDate) },
      { label: 'Data Nasc.', text: resident.birthDate }
    ]);
    addRow([
      { label: 'Gênero', text: resident.gender },
      { label: 'Naturalidade', text: resident.naturalness },
      { label: 'Estado Cívil', text: resident.maritalStatus }
    ]);
    addRow([
      { label: 'CPF', text: resident.cpf },
      { label: 'RG', text: resident.rg },
      { label: 'Cartão SUS', text: resident.susCard }
    ]);
    addRow([
      { label: 'Grau de Dependência', text: resident.dependencyLevel },
      { label: 'Acomodação', text: `${resident.room || ''} ${resident.bedNumber ? '(Leito '+resident.bedNumber+')' : ''}` },
      { label: 'Data Admissão', text: resident.admissionDate }
    ]);
    if (resident.cpf || resident.rg) yPos += 3;

    // 2. Saúde e Aspectos Gerais
    addSectionTitle('2. Histórico de Saúde e Triagem');
    addRow([
      { label: 'Alergias', text: interview?.allergies || 'N/A' },
      { label: 'Doenças Crôn.', text: interview?.chronicDiseases || 'N/A' }
    ]);
    addText('Medicação Contínua', interview?.continuousMedication === 'true' ? (`Sim - ${interview?.medicationDetails || ''}`) : 'Não');
    addText('Uso de Fraldas / Contenção', `${interview?.diaperUsage === 'Sim' ? 'Usa Fraldas. ' : ''}${interview?.continence || ''}`);
    addText('Deambulação / Mobilidade', interview?.ambulation || 'N/A');
    addText('Comportamento / Cognição', `${interview?.cognitiveImpairment === 'true' ? 'Alterado' : 'Preservado'}. ${interview?.cognitiveDetails || ''}`);
    addText('Parecer/Status Médico', medStatus);
    
    // 3. Avaliações Multidisciplinares
    addSectionTitle('3. Avaliações Multidisciplinares');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Nutrição', 14, yPos);
    yPos += 5;
    addText('Diagnóstico', nutInitial?.initialDiagnosis || 'N/A');
    addText('Suplementação', nutInitial?.needsSupplementation ? `Sim - ${nutInitial.supplementationDetails}` : 'Não');
    addText('Metas', nutInitial?.piaGoals || 'N/A');
    yPos += 3;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Psicologia', 14, yPos);
    yPos += 5;
    addText('Síntese/Demanda', psyInitial?.initialPsychologicalSynthesis || psyInitial?.demanda || 'N/A');
    addText('Humor/Comportamento', psyInitial?.humor || 'N/A');
    addText('Metas', psyInitial?.piaPsychologicalGoals || psyInitial?.objetivos || 'N/A');
    yPos += 3;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Terapia Ocupacional', 14, yPos);
    yPos += 5;
    addText('Síntese Funcional', otInitial?.functionalSynthesis || otInitial?.treatmentConductObservations || 'N/A');
    addText('Nível de Independência', otInitial?.independenceLevel || 'N/A');
    addText('Metas', otInitial?.piaGoals || otInitial?.therapeuticGoalsObservations || 'N/A');
    yPos += 3;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Fisioterapia', 14, yPos);
    yPos += 5;
    addText('Diagnóstico Cinesiofuncional', ptInitial?.kineticFunctionalDiagnosis || 'N/A');
    addText('Capacidade Motora', ptInitial?.motorAssessment || 'N/A');
    addText('Metas', ptInitial?.objectives || 'N/A');
    yPos += 5;

    // 4. Metas por Competência (PIA)
    addSectionTitle('4. Status e Acompanhamento das Metas (PIA)');
    const printGoalStatus = (competence: string, definedGoal: any, goalStatus: any) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(competence, 14, yPos);
      yPos += 4;
      addText('Metas Definidas', definedGoal || 'N/A');
      addRow([
        { label: 'Status', text: goalStatus?.status || 'N/A' },
        { label: 'Data Revisão', text: goalStatus?.reviewDate || 'N/A' }
      ]);
      addText('Observações', goalStatus?.observation || 'N/A');
      yPos += 3;
    };

    printGoalStatus('Nutrição', nutInitial?.piaGoals, localPia.goalsStatus.nutrition);
    printGoalStatus('Psicologia', psyInitial?.piaPsychologicalGoals || psyInitial?.objetivos, localPia.goalsStatus.psychology);
    printGoalStatus('Terapia Ocupacional', otInitial?.piaGoals || otInitial?.therapeuticGoalsObservations, localPia.goalsStatus.occupationalTherapy);
    printGoalStatus('Fisioterapia', ptInitial?.objectives, localPia.goalsStatus.physiotherapy);

    // 5. Plano de Intervenções
    addSectionTitle('5. Plano de Intervenções');
    addText('Nutrição', localPia.interventions.nutrition || 'N/A', true);
    addText('Psicologia', localPia.interventions.psychology || 'N/A', true);
    addText('Terapia Ocupacional', localPia.interventions.occupationalTherapy || 'N/A', true);
    addText('Fisioterapia', localPia.interventions.physiotherapy || 'N/A', true);
    addText('Médico', localPia.interventions.medical || 'N/A', true);

    // 6. Síntese Geral
    addSectionTitle('6. Síntese Geral da Equipe');
    addText('', localPia.generalSynthesis || 'N/A', false);
    yPos += 5;

    // 7. Histórico de Revisões
    addSectionTitle('7. Histórico de Revisões');
    if (localPia.revisions.length === 0) {
      addText('', 'Nenhuma revisão registrada.', false);
    } else {
      localPia.revisions.forEach(rev => {
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.text(`${rev.date} - ${rev.professional}`, 14, yPos);
        yPos += 4;
        addText('Alterações', rev.changes);
        if (rev.observation) {
          addText('Observação', rev.observation);
        }
        yPos += 3;
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 5;
      });
    }

    // Add page numbers
    await addPdfHeaderAndFooter(doc, settings, 'Plano Individual de Atendimento (PIA)');

    doc.save(`Ficha_Completa_PIA_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="bg-gradient-to-r from-[#004c99] to-blue-700 p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center md:items-start gap-4 text-white">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <FileText className="text-blue-200" size={28} />
            Ficha Completa e PIA
          </h2>
          <p className="text-sm font-medium text-blue-100 uppercase tracking-widest mt-1">Plano Individual de Atendimento Integrado</p>
        </div>
        <div className="flex gap-3">
          <button 
            type="button" 
            onClick={handleGeneratePDF}
            className="px-5 py-2.5 bg-white text-[#004c99] rounded-xl font-black text-xs uppercase hover:bg-blue-50 flex items-center gap-2 shadow-sm transition-all"
          >
            <Printer size={16} />
            Exportar PDF
          </button>
          {!isEditing ? (
            <button
              type="button"
              onClick={handleCreateOrEdit}
              className="bg-blue-800 hover:bg-blue-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-xs uppercase"
            >
              <Edit2 size={16} />
              {resident.pia ? 'Editar PIA' : 'Criar PIA'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-xs uppercase border border-green-400"
            >
              <Save size={16} />
              Salvar Alterações
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="space-y-8">
          {/* 1. Identificação */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3 flex items-center gap-2">
              <User size={16} /> Identificação do Residente
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Nome</div>
                <div className="font-bold text-sm text-gray-800">{resident.name}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Idade / Nasc.</div>
                <div className="font-bold text-sm text-gray-800">{calculateAge(resident.birthDate)} <span className="text-gray-400 font-normal text-xs">({resident.birthDate})</span></div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Gênero</div>
                <div className="font-bold text-sm text-gray-800">{resident.gender}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Grau de Dependência</div>
                <div className="font-bold text-sm text-gray-800">{resident.dependencyLevel || 'Não informado'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Acomodação</div>
                <div className="font-bold text-sm text-gray-800">{resident.room || '-'} {resident.bedNumber ? ` (Leito ${resident.bedNumber})` : ''}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Data Admissão</div>
                <div className="font-bold text-sm text-gray-800">{resident.admissionDate || 'Não informada'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">CPF</div>
                <div className="font-bold text-sm text-gray-800">{resident.cpf || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">RG</div>
                <div className="font-bold text-sm text-gray-800">{resident.rg || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Cartão SUS</div>
                <div className="font-bold text-sm text-gray-800">{resident.susCard || '-'}</div>
              </div>
            </div>
          </div>

          {/* 2. Saúde e Triagem */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-sm font-black text-red-600 uppercase tracking-widest border-b pb-3 flex items-center gap-2">
              <HeartPulse size={16} /> Histórico de Saúde e Triagem
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Alergias</div>
                <div className="text-sm font-medium text-gray-800">{interview?.allergies || 'Não informado'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Doenças Crônicas</div>
                <div className="text-sm font-medium text-gray-800">{interview?.chronicDiseases || 'Não informado'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Medicação Contínua</div>
                <div className="text-sm font-medium text-gray-800">
                  {interview?.continuousMedication === 'true' ? (`Sim - ${interview?.medicationDetails || ''}`) : 'Não / Não informado'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Mobilidade / Deambulação</div>
                <div className="text-sm font-medium text-gray-800">{interview?.ambulation || 'Não informado'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Continência / Uso Fraldas</div>
                <div className="text-sm font-medium text-gray-800">
                  {`${interview?.diaperUsage === 'Sim' ? 'Usa Fraldas. ' : ''}${interview?.continence || ''}`}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Cognição</div>
                <div className="text-sm font-medium text-gray-800">
                  {`${interview?.cognitiveImpairment === 'true' ? 'Alterado' : 'Preservado'}. ${interview?.cognitiveDetails || ''}`}
                </div>
              </div>
              <div className="col-span-1 md:col-span-2">
                <div className="text-[10px] font-black text-gray-400 uppercase">Parecer Médico</div>
                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-2 rounded-lg">{medStatus}</div>
              </div>
            </div>
          </div>
          
          {/* 6. Síntese Geral da Equipe */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
             <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest border-b pb-3 flex items-center gap-2">
               <Activity size={16} /> Síntese Geral da Equipe (PIA)
             </h3>
             <div className="mt-2">
               {isEditing ? (
                 <textarea
                   value={localPia.generalSynthesis}
                   onChange={(e) => setLocalPia({ ...localPia, generalSynthesis: e.target.value })}
                   className="w-full p-4 border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none text-sm font-medium min-h-[120px] transition-colors"
                   placeholder="Descreva a síntese geral e condutas alinhadas pela equipe multidisciplinar..."
                 />
               ) : (
                 <div className="p-4 bg-gray-50 rounded-xl text-sm border border-gray-100 min-h-[100px] whitespace-pre-wrap text-gray-700">
                   {localPia.generalSynthesis || <span className="text-gray-400 italic">Nenhuma síntese geral registrada.</span>}
                 </div>
               )}
             </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* 3 & 4. Avaliações e Metas Multidisciplinares */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3">Avaliações e Metas do PIA</h3>
            
            {/* Nutrição */}
            <div className="border border-blue-100 rounded-xl overflow-hidden">
              <div className="bg-blue-50/80 p-3 border-b border-blue-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <h4 className="text-xs font-black text-blue-800 uppercase">Nutrição</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Diagnóstico</div>
                    <div className="text-xs font-medium text-gray-800">{nutInitial?.initialDiagnosis || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Metas da Avaliação</div>
                    <div className="text-xs font-bold text-gray-800">{nutInitial?.piaGoals || '-'}</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-xl border space-y-3 mt-4">
                  <div className="text-[10px] font-black text-[#004c99] uppercase">Acompanhamento da Meta</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Status</label>
                      {isEditing ? (
                        <select
                          value={localPia.goalsStatus.nutrition.status}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, nutrition: { ...localPia.goalsStatus.nutrition, status: e.target.value as any } }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Selecione...</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Atingida">Atingida</option>
                          <option value="Não atingida">Não atingida</option>
                        </select>
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.nutrition.status || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Revisão</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={localPia.goalsStatus.nutrition.reviewDate}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, nutrition: { ...localPia.goalsStatus.nutrition, reviewDate: e.target.value } }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.nutrition.reviewDate ? new Date(localPia.goalsStatus.nutrition.reviewDate).toLocaleDateString('pt-BR') : '-'}</div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Anotações / Conduta (Intervenção)</label>
                      {isEditing ? (
                        <textarea
                          value={localPia.interventions.nutrition}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            interventions: { ...localPia.interventions, nutrition: e.target.value }
                          })}
                          className="w-full px-3 py-2 border rounded-lg text-xs font-medium min-h-[60px] outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">{localPia.interventions.nutrition || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Psicologia */}
            <div className="border border-purple-100 rounded-xl overflow-hidden">
              <div className="bg-purple-50/80 p-3 border-b border-purple-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <h4 className="text-xs font-black text-purple-800 uppercase">Psicologia</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Síntese / Demanda</div>
                    <div className="text-xs font-medium text-gray-800 capitalize line-clamp-2">{psyInitial?.initialPsychologicalSynthesis || psyInitial?.demanda || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Metas da Avaliação</div>
                    <div className="text-xs font-bold text-gray-800 capitalize line-clamp-2">{psyInitial?.piaPsychologicalGoals || psyInitial?.objetivos || '-'}</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-xl border space-y-3 mt-4">
                   <div className="text-[10px] font-black text-purple-700 uppercase">Acompanhamento da Meta</div>
                   <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Status</label>
                      {isEditing ? (
                        <select
                          value={localPia.goalsStatus.psychology.status}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, psychology: { ...localPia.goalsStatus.psychology, status: e.target.value as any } }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Selecione...</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Atingida">Atingida</option>
                          <option value="Não atingida">Não atingida</option>
                        </select>
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.psychology.status || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Revisão</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={localPia.goalsStatus.psychology.reviewDate}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, psychology: { ...localPia.goalsStatus.psychology, reviewDate: e.target.value } }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.psychology.reviewDate ? new Date(localPia.goalsStatus.psychology.reviewDate).toLocaleDateString('pt-BR') : '-'}</div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Anotações / Conduta (Intervenção)</label>
                      {isEditing ? (
                        <textarea
                          value={localPia.interventions.psychology}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            interventions: { ...localPia.interventions, psychology: e.target.value }
                          })}
                          className="w-full px-3 py-2 border rounded-lg text-xs font-medium min-h-[60px] outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">{localPia.interventions.psychology || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terapia Ocupacional */}
            <div className="border border-teal-100 rounded-xl overflow-hidden">
              <div className="bg-teal-50/80 p-3 border-b border-teal-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <h4 className="text-xs font-black text-teal-800 uppercase">Terapia Ocupacional</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Síntese Funcional</div>
                    <div className="text-xs font-medium text-gray-800 line-clamp-2">{otInitial?.functionalSynthesis || otInitial?.treatmentConductObservations || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Metas da Avaliação</div>
                    <div className="text-xs font-bold text-gray-800 line-clamp-2">{otInitial?.piaGoals || otInitial?.therapeuticGoalsObservations || '-'}</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-xl border space-y-3 mt-4">
                  <div className="text-[10px] font-black text-teal-700 uppercase">Acompanhamento da Meta</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Status</label>
                      {isEditing ? (
                        <select
                          value={localPia.goalsStatus.occupationalTherapy?.status || ''}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, occupationalTherapy: { ...localPia.goalsStatus.occupationalTherapy, status: e.target.value as any } as any }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Selecione...</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Atingida">Atingida</option>
                          <option value="Não atingida">Não atingida</option>
                        </select>
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.occupationalTherapy?.status || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Revisão</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={localPia.goalsStatus.occupationalTherapy?.reviewDate || ''}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, occupationalTherapy: { ...localPia.goalsStatus.occupationalTherapy, reviewDate: e.target.value } as any }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.occupationalTherapy?.reviewDate ? new Date(localPia.goalsStatus.occupationalTherapy?.reviewDate).toLocaleDateString('pt-BR') : '-'}</div>
                      )}
                    </div>
                    <div className="col-span-2">
                       <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Anotações / Conduta (Intervenção)</label>
                      {isEditing ? (
                        <textarea
                          value={localPia.interventions.occupationalTherapy || ''}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            interventions: { ...localPia.interventions, occupationalTherapy: e.target.value }
                          })}
                          className="w-full px-3 py-2 border rounded-lg text-xs font-medium min-h-[60px] outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">{localPia.interventions.occupationalTherapy || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Fisioterapia */}
            <div className="border border-indigo-100 rounded-xl overflow-hidden">
              <div className="bg-indigo-50/80 p-3 border-b border-indigo-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <h4 className="text-xs font-black text-indigo-800 uppercase">Fisioterapia</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Diagnóstico Cinesiofuncional</div>
                    <div className="text-xs font-medium text-gray-800 line-clamp-2">{ptInitial?.kineticFunctionalDiagnosis || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">Metas da Avaliação</div>
                    <div className="text-xs font-bold text-gray-800 line-clamp-2">{ptInitial?.objectives || '-'}</div>
                  </div>
                </div>
                
                 <div className="bg-gray-50 p-3 rounded-xl border space-y-3 mt-4">
                  <div className="text-[10px] font-black text-indigo-700 uppercase">Acompanhamento da Meta</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Status</label>
                      {isEditing ? (
                        <select
                          value={localPia.goalsStatus.physiotherapy?.status || ''}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, physiotherapy: { ...localPia.goalsStatus.physiotherapy, status: e.target.value as any } as any }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Selecione...</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Atingida">Atingida</option>
                          <option value="Não atingida">Não atingida</option>
                        </select>
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.physiotherapy?.status || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Revisão</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={localPia.goalsStatus.physiotherapy?.reviewDate || ''}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            goalsStatus: { ...localPia.goalsStatus, physiotherapy: { ...localPia.goalsStatus.physiotherapy, reviewDate: e.target.value } as any }
                          })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="font-bold text-xs">{localPia.goalsStatus.physiotherapy?.reviewDate ? new Date(localPia.goalsStatus.physiotherapy?.reviewDate).toLocaleDateString('pt-BR') : '-'}</div>
                      )}
                    </div>
                    <div className="col-span-2">
                       <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Anotações / Conduta (Intervenção)</label>
                      {isEditing ? (
                        <textarea
                          value={localPia.interventions.physiotherapy || ''}
                          onChange={(e) => setLocalPia({
                            ...localPia,
                            interventions: { ...localPia.interventions, physiotherapy: e.target.value }
                          })}
                          className="w-full px-3 py-2 border rounded-lg text-xs font-medium min-h-[60px] outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-xs text-gray-700 whitespace-pre-wrap">{localPia.interventions.physiotherapy || '-'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Medicina / Enfermagem / Geral */}
             <div className="border border-green-100 rounded-xl overflow-hidden">
               <div className="bg-green-50/80 p-3 border-b border-green-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <h4 className="text-xs font-black text-green-800 uppercase">Intervenções Médicas / Cuidado</h4>
              </div>
               <div className="p-4 bg-gray-50/50">
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Plano de Intervenção ou Cuidado Contínuo</label>
                  {isEditing ? (
                     <textarea
                       value={localPia.interventions.medical}
                       onChange={(e) => setLocalPia({
                         ...localPia,
                         interventions: { ...localPia.interventions, medical: e.target.value }
                       })}
                       className="w-full px-3 py-2 border rounded-lg text-xs font-medium min-h-[80px] outline-none focus:ring-1 focus:ring-blue-500"
                       placeholder="Descreva plano médico, de enfermagem e de assistência ao idoso..."
                     />
                   ) : (
                     <div className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-3 rounded-lg border">{localPia.interventions.medical || '-'}</div>
                   )}
               </div>
             </div>
          </div>
        </div>
      </div>
      
       {/* 7. Revisões e Acompanhamento */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm mt-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} /> Histórico de Revisões
            </h3>
            <p className="text-xs text-gray-500 mt-1">Revisões contínuas e ajustes no projeto terapêutico</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingRevision(true)}
            className="flex items-center gap-2 text-xs font-black text-[#004c99] hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors uppercase tracking-wider border border-blue-100"
          >
            <Plus size={14} />
            Nova Revisão
          </button>
        </div>

        {isAddingRevision && (
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4 mb-6">
            <h4 className="text-xs font-black text-[#004c99] uppercase tracking-widest border-b pb-2">Registrar Revisão do PIA</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Principais Alterações no Plano / Avaliação Geral</label>
                <textarea
                  value={newRevision.changes || ''}
                  onChange={e => setNewRevision({ ...newRevision, changes: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[80px]"
                  placeholder="Quais mudanças de conduta ou avaliação resultaram dessa revisão?"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Observações Adicionais</label>
                <textarea
                  value={newRevision.observation || ''}
                  onChange={e => setNewRevision({ ...newRevision, observation: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Profissional / Equipe Responsável</label>
                <input
                  type="text"
                  value={newRevision.professional || ''}
                  onChange={e => setNewRevision({ ...newRevision, professional: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs font-medium bg-white focus:ring-2 outline-none"
                  placeholder="Ex: Dra. Ana (Médica), João (Assistente)"
                />
              </div>
            </div>
            
             <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsAddingRevision(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                disabled={!newRevision.changes || !newRevision.professional}
                className="px-4 py-2 text-xs font-bold bg-[#004c99] text-white rounded-xl hover:bg-blue-800 transition-colors uppercase disabled:opacity-50"
              >
                Salvar Revisão
              </button>
            </div>
          </div>
        )}

        {localPia.revisions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 italic bg-gray-50 rounded-xl border border-dashed">
            Nenhuma revisão registrada até o momento.
          </div>
        ) : (
          <div className="space-y-4">
            {localPia.revisions.map((rev) => (
              <div key={rev.id} className="p-4 border rounded-xl hover:shadow-md transition-shadow bg-white">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-black text-gray-600 uppercase tracking-widest inline-flex items-center gap-2">
                    <Clock size={12} />
                    {rev.date}
                  </div>
                  <span className="text-xs font-bold text-[#004c99] uppercase pr-2">{rev.professional}</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-[10px] font-black text-gray-400 uppercase mb-1">Alterações Registradas</h5>
                    <p className="text-xs text-gray-800 whitespace-pre-wrap pl-2 border-l-2 border-blue-200">{rev.changes}</p>
                  </div>
                  {rev.observation && (
                    <div>
                      <h5 className="text-[10px] font-black text-gray-400 uppercase mb-1">Anotações</h5>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap pl-2 border-l-2 border-gray-200">{rev.observation}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
};

export default PiaTab;

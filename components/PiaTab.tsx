import React, { useState } from 'react';
import { Resident, PiaData, PiaGoalStatus, PiaRevision } from '../types';
import { Plus, Save, Edit2, CheckCircle, Clock, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PiaTabProps {
  resident: Resident;
  onChange: (pia: PiaData) => void;
}

const PiaTab: React.FC<PiaTabProps> = ({ resident, onChange }) => {
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
      occupationalTherapy: ''
    },
    goalsStatus: {
      nutrition: { status: '', reviewDate: '', observation: '' },
      psychology: { status: '', reviewDate: '', observation: '' },
      occupationalTherapy: { status: '', reviewDate: '', observation: '' }
    },
    revisions: []
  };

  const [localPia, setLocalPia] = useState<PiaData>(pia as PiaData);

  const handleCreateOrEdit = () => {
    setIsEditing(true);
  };

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

  // Extract data from competences
  const nutInitial = resident.nutrition?.initialAssessment;
  const psyInitial = resident.psychology?.initialAssessment || resident.psychology?.anamnese;
  const otInitial = resident.occupationalTherapy?.initialAssessment;
  const medStatus = resident.medicalStatus || resident.medicalOpinion || 'Sem registro médico';

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    const addSectionTitle = (title: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 76, 153);
      doc.text(title, 14, yPos);
      yPos += 2;
      doc.setDrawColor(0, 76, 153);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 6;
      doc.setTextColor(0, 0, 0);
    };

    const addText = (label: string, text: string, isBoldLabel = true) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(10);
      if (isBoldLabel) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, yPos);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(text || 'N/A', pageWidth - 14 - doc.getTextWidth(`${label}: `) - 5);
        doc.text(splitText, 14 + doc.getTextWidth(`${label}: `) + 2, yPos);
        yPos += (splitText.length * 5) + 2;
      } else {
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(text || 'N/A', pageWidth - 28);
        doc.text(splitText, 14, yPos);
        yPos += (splitText.length * 5) + 2;
      }
    };

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PIA – Plano Individual de Atendimento', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    
    // 1. Identificação
    addSectionTitle('1. Identificação e Status');
    addText('Residente', resident.name);
    addText('Data de Nascimento', resident.birthDate);
    addText('Grau de Dependência', resident.dependencyLevel);
    addText('Data de Admissão', resident.admissionDate);
    addText('Data de Criação do PIA', localPia.createdAt || 'N/A');
    addText('Status do PIA', localPia.status);
    
    const lastRev = localPia.revisions.length > 0 ? localPia.revisions[0].date : 'N/A';
    addText('Última Revisão', lastRev);
    yPos += 5;

    // 2. Diagnóstico Multidisciplinar Inicial
    addSectionTitle('2. Diagnóstico Multidisciplinar Inicial');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Nutrição:', 14, yPos);
    yPos += 5;
    addText('Diagnóstico', nutInitial?.initialDiagnosis || 'N/A');
    addText('Suplementação', nutInitial?.needsSupplementation ? `Sim - ${nutInitial.supplementationDetails}` : 'Não');
    addText('Metas Principais', nutInitial?.piaGoals || 'N/A');
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Psicologia:', 14, yPos);
    yPos += 5;
    addText('Síntese Inicial', psyInitial?.initialPsychologicalSynthesis || 'N/A');
    addText('Metas Principais', psyInitial?.piaPsychologicalGoals || 'N/A');
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Terapia Ocupacional:', 14, yPos);
    yPos += 5;
    addText('Síntese Funcional', otInitial?.functionalSynthesis || 'N/A');
    addText('Metas Principais', otInitial?.piaGoals || 'N/A');
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Médico:', 14, yPos);
    yPos += 5;
    addText('Status/Parecer', medStatus);
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Síntese Geral da Equipe:', 14, yPos);
    yPos += 5;
    addText('', localPia.generalSynthesis || 'N/A', false);
    yPos += 5;

    // 3. Metas por Competência
    addSectionTitle('3. Metas por Competência');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Nutrição:', 14, yPos);
    yPos += 5;
    addText('Metas Definidas', nutInitial?.piaGoals || 'N/A');
    addText('Status', localPia.goalsStatus.nutrition.status || 'N/A');
    addText('Previsão de Revisão', localPia.goalsStatus.nutrition.reviewDate || 'N/A');
    addText('Observação', localPia.goalsStatus.nutrition.observation || 'N/A');
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Psicologia:', 14, yPos);
    yPos += 5;
    addText('Metas Definidas', psyInitial?.piaPsychologicalGoals || 'N/A');
    addText('Status', localPia.goalsStatus.psychology.status || 'N/A');
    addText('Previsão de Revisão', localPia.goalsStatus.psychology.reviewDate || 'N/A');
    addText('Observação', localPia.goalsStatus.psychology.observation || 'N/A');
    yPos += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Terapia Ocupacional:', 14, yPos);
    yPos += 5;
    addText('Metas Definidas', otInitial?.piaGoals || 'N/A');
    addText('Status', localPia.goalsStatus.occupationalTherapy?.status || 'N/A');
    addText('Previsão de Revisão', localPia.goalsStatus.occupationalTherapy?.reviewDate || 'N/A');
    addText('Observação', localPia.goalsStatus.occupationalTherapy?.observation || 'N/A');
    yPos += 5;

    // 4. Plano de Intervenções
    addSectionTitle('4. Plano de Intervenções');
    doc.setFont('helvetica', 'bold');
    doc.text('Nutrição:', 14, yPos);
    yPos += 5;
    addText('', localPia.interventions.nutrition || 'N/A', false);
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Psicologia:', 14, yPos);
    yPos += 5;
    addText('', localPia.interventions.psychology || 'N/A', false);
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Terapia Ocupacional:', 14, yPos);
    yPos += 5;
    addText('', localPia.interventions.occupationalTherapy || 'N/A', false);
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Médico:', 14, yPos);
    yPos += 5;
    addText('', localPia.interventions.medical || 'N/A', false);
    yPos += 5;

    // 5. Histórico de Revisões
    addSectionTitle('5. Histórico de Revisões');
    if (localPia.revisions.length === 0) {
      addText('', 'Nenhuma revisão registrada.', false);
    } else {
      localPia.revisions.forEach(rev => {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`${rev.date} - ${rev.professional}`, 14, yPos);
        yPos += 5;
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
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`PIA_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      {/* 1. Identificação */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <div>
            <h2 className="text-xl font-black text-[#004c99] uppercase tracking-tighter">PIA – Plano Individual de Atendimento</h2>
            <p className="text-xs font-bold text-gray-400 uppercase mt-1">Identificação e Status</p>
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={handleGeneratePDF}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-black text-[10px] uppercase hover:bg-gray-200 flex items-center gap-2 shadow-sm transition-colors border border-gray-300"
            >
              <Printer size={14} />
              Gerar PDF
            </button>
            {!isEditing ? (
              <button
                type="button"
                onClick={handleCreateOrEdit}
                className="bg-[#004c99] hover:bg-blue-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
              >
                <Edit2 size={14} />
                {resident.pia ? 'Editar PIA' : 'Criar PIA'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
              >
                <Save size={14} />
                Salvar Alterações
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Nome do Residente</div>
            <div className="font-bold text-sm">{resident.name}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Data de Nascimento</div>
            <div className="font-bold text-sm">{resident.birthDate}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Grau de Dependência</div>
            <div className="font-bold text-sm">{resident.dependencyLevel || 'Não informado'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Data de Admissão</div>
            <div className="font-bold text-sm">{resident.admissionDate || 'Não informada'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Data de Criação do PIA</div>
            <div className="font-bold text-sm">{localPia.createdAt || 'Não criado'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Status do PIA</div>
            {isEditing ? (
              <select
                value={localPia.status}
                onChange={(e) => setLocalPia({ ...localPia, status: e.target.value as any })}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
              >
                <option value="Ativo">Ativo</option>
                <option value="Em revisão">Em revisão</option>
                <option value="Encerrado">Encerrado</option>
              </select>
            ) : (
              <div className={`font-black text-sm ${
                localPia.status === 'Ativo' ? 'text-green-600' : 
                localPia.status === 'Em revisão' ? 'text-orange-500' : 'text-gray-500'
              }`}>
                {localPia.status}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Diagnóstico Multidisciplinar Inicial */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 border-b pb-2">Diagnóstico Multidisciplinar Inicial</h3>
        
        <div className="space-y-4">
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <h4 className="text-[10px] font-black text-[#004c99] uppercase mb-2">Nutrição</h4>
            {nutInitial ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-bold">Diagnóstico:</span> {nutInitial.initialDiagnosis || 'Não informado'}</p>
                <p><span className="font-bold">Suplementação:</span> {nutInitial.needsSupplementation ? `Sim - ${nutInitial.supplementationDetails}` : 'Não'}</p>
                <p><span className="font-bold">Metas Principais:</span> {nutInitial.piaGoals || 'Não informadas'}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Sem avaliação nutricional inicial.</p>
            )}
          </div>

          <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
            <h4 className="text-[10px] font-black text-purple-700 uppercase mb-2">Psicologia</h4>
            {psyInitial ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-bold">Síntese Inicial:</span> {psyInitial.initialPsychologicalSynthesis || 'Não informada'}</p>
                <p><span className="font-bold">Metas Principais:</span> {psyInitial.piaPsychologicalGoals || 'Não informadas'}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Sem avaliação psicológica inicial.</p>
            )}
          </div>

          <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
            <h4 className="text-[10px] font-black text-teal-700 uppercase mb-2">Terapia Ocupacional</h4>
            {otInitial ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-bold">Síntese Funcional:</span> {otInitial.functionalSynthesis || 'Não informada'}</p>
                <p><span className="font-bold">Metas Principais:</span> {otInitial.piaGoals || 'Não informadas'}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Sem avaliação ocupacional inicial.</p>
            )}
          </div>

          <div className="bg-green-50/50 p-4 rounded-xl border border-green-100">
            <h4 className="text-[10px] font-black text-green-700 uppercase mb-2">Médico</h4>
            <div className="text-sm">
              <p><span className="font-bold">Status/Parecer:</span> {medStatus}</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-2">Síntese Geral da Equipe</label>
            {isEditing ? (
              <textarea
                value={localPia.generalSynthesis}
                onChange={(e) => setLocalPia({ ...localPia, generalSynthesis: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium min-h-[100px]"
                placeholder="Descreva a síntese geral da equipe..."
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100 min-h-[60px] whitespace-pre-wrap">
                {localPia.generalSynthesis || <span className="text-gray-400 italic">Nenhuma síntese geral registrada.</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Metas por Competência */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 border-b pb-2">Metas por Competência</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nutrição Metas */}
          <div className="border rounded-xl p-4">
            <h4 className="text-[10px] font-black text-[#004c99] uppercase mb-4 flex items-center gap-2">
              <CheckCircle size={14} /> Metas - Nutrição
            </h4>
            {nutInitial?.piaGoals ? (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50/50 rounded-lg text-sm border border-blue-100 whitespace-pre-wrap mb-4">
                  <span className="font-bold block mb-1 text-xs text-blue-800">Metas Definidas:</span>
                  {nutInitial.piaGoals}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Status</label>
                    {isEditing ? (
                      <select
                        value={localPia.goalsStatus.nutrition.status}
                        onChange={(e) => setLocalPia({
                          ...localPia,
                          goalsStatus: {
                            ...localPia.goalsStatus,
                            nutrition: { ...localPia.goalsStatus.nutrition, status: e.target.value as any }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                      >
                        <option value="">Selecione...</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Atingida">Atingida</option>
                        <option value="Não atingida">Não atingida</option>
                      </select>
                    ) : (
                      <div className="font-bold text-sm">{localPia.goalsStatus.nutrition.status || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Previsão de Revisão</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={localPia.goalsStatus.nutrition.reviewDate}
                        onChange={(e) => setLocalPia({
                          ...localPia,
                          goalsStatus: {
                            ...localPia.goalsStatus,
                            nutrition: { ...localPia.goalsStatus.nutrition, reviewDate: e.target.value }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                      />
                    ) : (
                      <div className="font-bold text-sm">{localPia.goalsStatus.nutrition.reviewDate || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Observação</label>
                    {isEditing ? (
                      <textarea
                        value={localPia.goalsStatus.nutrition.observation}
                        onChange={(e) => setLocalPia({
                          ...localPia,
                          goalsStatus: {
                            ...localPia.goalsStatus,
                            nutrition: { ...localPia.goalsStatus.nutrition, observation: e.target.value }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                        rows={2}
                      />
                    ) : (
                      <div className="text-sm">{localPia.goalsStatus.nutrition.observation || '-'}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 text-center rounded-lg text-xs text-gray-500 italic">
                Sem metas registradas nesta competência.
              </div>
            )}
          </div>

          {/* Psicologia Metas */}
          <div className="border rounded-xl p-4">
            <h4 className="text-[10px] font-black text-purple-700 uppercase mb-4 flex items-center gap-2">
              <CheckCircle size={14} /> Metas - Psicologia
            </h4>
            {psyInitial?.piaPsychologicalGoals ? (
              <div className="space-y-4">
                <div className="p-3 bg-purple-50/50 rounded-lg text-sm border border-purple-100 whitespace-pre-wrap mb-4">
                  <span className="font-bold block mb-1 text-xs text-purple-800">Metas Definidas:</span>
                  {psyInitial.piaPsychologicalGoals}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Status</label>
                    {isEditing ? (
                      <select
                        value={localPia.goalsStatus.psychology.status}
                        onChange={(e) => setLocalPia({
                          ...localPia,
                          goalsStatus: {
                            ...localPia.goalsStatus,
                            psychology: { ...localPia.goalsStatus.psychology, status: e.target.value as any }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                      >
                        <option value="">Selecione...</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Atingida">Atingida</option>
                        <option value="Não atingida">Não atingida</option>
                      </select>
                    ) : (
                      <div className="font-bold text-sm">{localPia.goalsStatus.psychology.status || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Previsão de Revisão</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={localPia.goalsStatus.psychology.reviewDate}
                        onChange={(e) => setLocalPia({
                          ...localPia,
                          goalsStatus: {
                            ...localPia.goalsStatus,
                            psychology: { ...localPia.goalsStatus.psychology, reviewDate: e.target.value }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                      />
                    ) : (
                      <div className="font-bold text-sm">{localPia.goalsStatus.psychology.reviewDate || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Observação</label>
                    {isEditing ? (
                      <textarea
                        value={localPia.goalsStatus.psychology.observation}
                        onChange={(e) => setLocalPia({
                          ...localPia,
                          goalsStatus: {
                            ...localPia.goalsStatus,
                            psychology: { ...localPia.goalsStatus.psychology, observation: e.target.value }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                        rows={2}
                      />
                    ) : (
                      <div className="text-sm">{localPia.goalsStatus.psychology.observation || '-'}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 text-center rounded-lg text-xs text-gray-500 italic">
                Sem metas registradas nesta competência.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Plano de Intervenções */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4 border-b pb-2">Plano de Intervenções</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-[#004c99] uppercase tracking-tighter mb-2">Intervenções - Nutrição</label>
            {isEditing ? (
              <textarea
                value={localPia.interventions.nutrition}
                onChange={(e) => setLocalPia({
                  ...localPia,
                  interventions: { ...localPia.interventions, nutrition: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium min-h-[80px]"
                placeholder="Descreva o plano de intervenção nutricional..."
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100 min-h-[40px] whitespace-pre-wrap">
                {localPia.interventions.nutrition || <span className="text-gray-400 italic">Nenhuma intervenção registrada.</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-purple-700 uppercase tracking-tighter mb-2">Intervenções - Psicologia</label>
            {isEditing ? (
              <textarea
                value={localPia.interventions.psychology}
                onChange={(e) => setLocalPia({
                  ...localPia,
                  interventions: { ...localPia.interventions, psychology: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium min-h-[80px]"
                placeholder="Descreva o plano de intervenção psicológica..."
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100 min-h-[40px] whitespace-pre-wrap">
                {localPia.interventions.psychology || <span className="text-gray-400 italic">Nenhuma intervenção registrada.</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-teal-700 uppercase tracking-tighter mb-2">Intervenções - Terapia Ocupacional</label>
            {isEditing ? (
              <textarea
                value={localPia.interventions.occupationalTherapy || ''}
                onChange={(e) => setLocalPia({
                  ...localPia,
                  interventions: { ...localPia.interventions, occupationalTherapy: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium min-h-[80px]"
                placeholder="Descreva o plano de intervenção ocupacional..."
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100 min-h-[40px] whitespace-pre-wrap">
                {localPia.interventions.occupationalTherapy || <span className="text-gray-400 italic">Nenhuma intervenção registrada.</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-green-700 uppercase tracking-tighter mb-2">Intervenções - Médico</label>
            {isEditing ? (
              <textarea
                value={localPia.interventions.medical}
                onChange={(e) => setLocalPia({
                  ...localPia,
                  interventions: { ...localPia.interventions, medical: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium min-h-[80px]"
                placeholder="Descreva o plano de intervenção médica..."
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100 min-h-[40px] whitespace-pre-wrap">
                {localPia.interventions.medical || <span className="text-gray-400 italic">Nenhuma intervenção registrada.</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Revisões do PIA */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Revisões do PIA</h3>
          <button
            type="button"
            onClick={() => setIsAddingRevision(true)}
            className="flex items-center gap-2 text-[10px] font-black text-white bg-gray-800 hover:bg-black px-3 py-1.5 rounded-lg transition-colors uppercase"
          >
            <Plus size={12} /> Nova Revisão
          </button>
        </div>

        {isAddingRevision && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 space-y-4">
            <h4 className="text-xs font-black uppercase text-gray-700">Registrar Nova Revisão</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Profissional Responsável</label>
                <input
                  type="text"
                  value={newRevision.professional || ''}
                  onChange={(e) => setNewRevision({ ...newRevision, professional: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                  placeholder="Nome do profissional"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Alterações Realizadas</label>
                <textarea
                  value={newRevision.changes || ''}
                  onChange={(e) => setNewRevision({ ...newRevision, changes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                  rows={2}
                  placeholder="O que foi alterado nesta revisão?"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Observação Geral</label>
                <textarea
                  value={newRevision.observation || ''}
                  onChange={(e) => setNewRevision({ ...newRevision, observation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-sm font-medium"
                  rows={2}
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsAddingRevision(false)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRevision}
                disabled={!newRevision.professional || !newRevision.changes}
                className="px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors uppercase disabled:opacity-50"
              >
                Salvar Revisão
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {localPia.revisions.length > 0 ? (
            localPia.revisions.map((rev) => (
              <div key={rev.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-[#004c99] font-black text-xs uppercase">
                    <Clock size={14} /> {rev.date}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md uppercase">
                    {rev.professional}
                  </div>
                </div>
                <div className="space-y-2 text-sm mt-3">
                  <p><span className="font-bold text-gray-700">Alterações:</span> {rev.changes}</p>
                  {rev.observation && (
                    <p><span className="font-bold text-gray-700">Observação:</span> {rev.observation}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm italic">
              Nenhuma revisão registrada para este PIA.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PiaTab;

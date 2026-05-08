const fs = require('fs');

const replacement = `import React, { useState } from 'react';
import { Resident, InstitutionSettings } from '../types';
import { Printer, FileText, User, HeartPulse, Clock, Activity, Settings, UserCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';

interface PiaTabProps {
  resident: Resident;
  onChange?: (pia: any) => void;
  settings?: InstitutionSettings | null;
}

const PiaTab: React.FC<PiaTabProps> = ({ resident, settings }) => {
  const [evolutionFilter, setEvolutionFilter] = useState<'all' | '6months' | 'last' | 'none'>('all');

  const calculateAge = (birthDateString: string) => {
    if (!birthDateString) return 'N/A';
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
  
  const interview = resident.interview;
  const medStatus = resident.medicalStatus || resident.medicalOpinion;

  // Evolutions logic
  const allEvolutions = [
    { area: 'Psicologia', evs: resident.psychology?.evolutions || [] },
    { area: 'Fisioterapia', evs: resident.physiotherapy?.evolutions || [] },
    { area: 'Nutrição', evs: resident.nutrition?.evolutions || [] },
    { area: 'Terapia Ocupacional', evs: resident.occupationalTherapy?.evolutions || [] }
  ];

  const getFilteredEvolutions = () => {
    if (evolutionFilter === 'none') return [];
    
    return allEvolutions.map(({ area, evs }) => {
      let areaEvs = evs.filter((e: any) => e.incluirNoPIA !== false);
      
      const now = new Date().getTime();
      const sixMonthsAgo = now - (6 * 30 * 24 * 60 * 60 * 1000);

      // Sort by date desc
      areaEvs.sort((a: any, b: any) => new Date(b.dataEvolucao || b.date || 0).getTime() - new Date(a.dataEvolucao || a.date || 0).getTime());

      if (evolutionFilter === '6months') {
        areaEvs = areaEvs.filter((e: any) => new Date(e.dataEvolucao || e.date || 0).getTime() >= sixMonthsAgo);
      } else if (evolutionFilter === 'last') {
        areaEvs = areaEvs.slice(0, 1);
      }

      return { area, evs: areaEvs };
    }).filter(group => group.evs.length > 0);
  };

  const filteredEvolutions = getFilteredEvolutions();

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

    const addSectionTitle = (title: string, customSize = 12) => {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(customSize);
      doc.setTextColor(30, 30, 30);
      doc.text(title, 14, yPos);
      yPos += 2;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 6;
    };

    const addText = (label: string, text: string) => {
      if (!text) text = '---';
      checkPageBreak(8);
      
      if (label) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(\`\${label}:\`, 14, yPos);
        const labelWidth = doc.getTextWidth(\`\${label}: \`);
        
        doc.setFont('helvetica', 'normal');
        const contentWidth = (pageWidth - 28) - labelWidth;
        const splitText = doc.splitTextToSize(text.toString(), contentWidth);
        
        doc.text(splitText, 14 + labelWidth, yPos);
        yPos += (splitText.length * 5) + 2;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitText = doc.splitTextToSize(text.toString(), (pageWidth - 28));
        doc.text(splitText, 14, yPos);
        yPos += (splitText.length * 5) + 2;
      }
    };

    // --- Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('PLANO INDIVIDUAL DE ATENDIMENTO - PIA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;
    
    // --- 1. Identificação ---
    addSectionTitle('1. Identificação do Residente');
    addText('Nome', resident.name || '-');
    addText('Data de Nascimento', \`\${resident.birthDate || '-'} (\${calculateAge(resident.birthDate)})\`);
    addText('Sexo', resident.gender || '-');
    addText('Estado Civil', resident.maritalStatus || '-');
    addText('Acomodação', \`\${resident.room || '-'} \${resident.bedNumber ? '(Leito '+resident.bedNumber+')' : ''}\`);
    addText('Data de Admissão', resident.admissionDate || '-');
    addText('CPF', resident.cpf || '-');
    addText('RG', resident.rg || '-');
    addText('Cartão SUS', resident.susCard || '-');
    addText('Grau de Dependência', resident.dependencyLevel || '-');
    
    // --- 2. Dados Gerais / Sociais ---
    yPos += 5;
    addSectionTitle('2. Dados Gerais / Sociais');
    if (interview) {
      addText('Naturalidade', resident.naturalness || '-');
      addText('Religião', resident.religion || '-');
      addText('Alergias', interview.allergies || '-');
      addText('Doenças Crônicas', interview.chronicDiseases || '-');
    } else {
      addText('', 'Nenhuma triagem inicial registrada.');
    }

    // --- 3. Dados Clínicos ---
    yPos += 5;
    addSectionTitle('3. Dados Clínicos');
    if (interview || medStatus) {
      addText('Uso de Fraldas', interview?.diaperUsage || '-');
      addText('Deambulação', interview?.ambulation || '-');
      addText('Alteração Cognitiva', interview?.cognitiveImpairment === 'true' ? 'Sim' : 'Não');
      addText('Detalhes Cognitivos', interview?.cognitiveDetails || '-');
      addText('Uso de Medicamentos', interview?.continuousMedication === 'true' ? 'Sim' : 'Não');
      addText('Detalhes de Medicação', interview?.medicationDetails || '-');
      addText('Parecer/Status Médico', medStatus || '-');
    } else {
      addText('', 'Nenhum dado clínico registrado.');
    }

    // --- 4. Primeiras Avaliações Profissionais ---
    yPos += 5;
    addSectionTitle('4. Primeiras Avaliações Profissionais');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Psicologia', 14, yPos); yPos += 5;
    if (psyInitial) {
      addText('Síntese / Demanda', psyInitial.initialPsychologicalSynthesis || psyInitial.demanda || '-');
      addText('Humor / Comportamento', psyInitial.humor || '-');
      addText('Metas', psyInitial.piaPsychologicalGoals || psyInitial.objetivos || '-');
    } else {
      addText('', 'Primeira avaliação não registrada.');
    }
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Fisioterapia', 14, yPos); yPos += 5;
    if (ptInitial) {
      addText('Diagnóstico Cinesiofuncional', ptInitial.kineticFunctionalDiagnosis || '-');
      addText('Avaliação Motora', ptInitial.motorAssessment || '-');
      addText('Metas', ptInitial.objectives || '-');
    } else {
      addText('', 'Primeira avaliação não registrada.');
    }
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Nutrição', 14, yPos); yPos += 5;
    if (nutInitial) {
      addText('Diagnóstico Inicial', nutInitial.initialDiagnosis || '-');
      addText('Suplementação', nutInitial.needsSupplementation ? \`Sim - \${nutInitial.supplementationDetails}\` : 'Não');
      addText('Metas', nutInitial.piaGoals || '-');
    } else {
      addText('', 'Primeira avaliação não registrada.');
    }
    yPos += 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Terapia Ocupacional', 14, yPos); yPos += 5;
    if (otInitial) {
      addText('Síntese Funcional', otInitial.functionalSynthesis || otInitial.treatmentConductObservations || '-');
      addText('Nível de Independência', otInitial.independenceLevel || '-');
      addText('Metas', otInitial.piaGoals || otInitial.therapeuticGoalsObservations || '-');
    } else {
      addText('', 'Primeira avaliação não registrada.');
    }
    
    // --- 5. Histórico de Evoluções ---
    yPos += 5;
    addSectionTitle('5. Histórico de Evoluções');
    if (filteredEvolutions.length === 0) {
      addText('', 'Não há evoluções registradas para o período.');
    } else {
      filteredEvolutions.forEach(group => {
        checkPageBreak(12);
        doc.setFont('helvetica', 'bold');
        doc.text(group.area, 14, yPos);
        yPos += 5;

        group.evs.forEach((e: any) => {
          checkPageBreak(15);
          const dt = e.dataEvolucao || e.date;
          const dtStr = dt ? new Date(dt).toLocaleDateString('pt-BR') : 'Sem data';
          const txt = e.descricaoEvolucao || e.newConduct || e.functionalEvolution || e.description || 'Evolução registrada.';
          
          let profName = e.professionalName || '';
          let profRole = e.professionalRole || '';
          let profSignature = profName ? \` (\${profName}\${profRole ? ' - '+profRole : ''})\` : '';

          addText('', \`\${dtStr}\${profSignature} — \${txt}\`);
        });
        yPos += 3;
      });
    }

    // Add page numbers
    await addPdfHeaderAndFooter(doc, settings, 'Plano Individual de Atendimento (PIA)');

    // 6. Assinaturas
    addPdfSignatureNode(doc);

    doc.save(\`PIA_\${resident.name.replace(/\\s+/g, '_')}.pdf\`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="bg-gradient-to-r from-[#004c99] to-blue-700 p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center md:items-start gap-6 text-white">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <FileText className="text-blue-200" size={28} />
            Central PIA
          </h2>
          <p className="text-sm font-medium text-blue-100 mt-1 max-w-2xl">Visualização consolidada do Plano Individual de Atendimento. Os dados são compilados automaticamente das fichas e avaliações do sistema.</p>
        </div>
      </div>

      {/* PDF Export Card */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-2">
            <Printer size={16} className="text-[#004c99]" /> Configurar e Exportar PDF
          </h3>
          <p className="text-xs text-gray-500">Selecione quais evoluções complementarão a primeira avaliação no documento final.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border w-full sm:w-auto">
            <SlidersHorizontal size={14} className="text-gray-400 ml-2" />
            <select
              value={evolutionFilter}
              onChange={(e) => setEvolutionFilter(e.target.value as any)}
              className="bg-transparent border-none text-xs font-bold text-gray-700 outline-none w-full cursor-pointer py-2 pr-4"
            >
              <option value="all">Todas as evoluções</option>
              <option value="6months">Últimos 6 meses</option>
              <option value="last">Apenas a última</option>
              <option value="none">Nenhuma evolução</option>
            </select>
          </div>
          <button 
            type="button" 
            onClick={handleGeneratePDF}
            className="w-full sm:w-auto px-6 py-3 bg-[#004c99] hover:bg-blue-800 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all whitespace-nowrap"
          >
            <Printer size={16} />
            Gerar PDF do PIA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="space-y-6">
          {/* 1. Identificação */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3 flex items-center gap-2">
              <User size={16} /> 1. Identificação do Residente
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
                <div className="text-[10px] font-black text-gray-400 uppercase">Acomodação</div>
                <div className="font-bold text-sm text-gray-800">{resident.room || '-'} {resident.bedNumber ? \` (Leito \${resident.bedNumber})\` : ''}</div>
              </div>
            </div>
          </div>

          {/* 2. Dados Gerais / Sociais */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3 flex items-center gap-2">
              <UserCheck size={16} /> 2. Dados Gerais / Sociais
            </h3>
            {!interview ? (
              <p className="text-xs text-gray-500 italic">Nenhuma triagem inicial registrada.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase">Alergias</div>
                  <div className="font-bold text-sm text-gray-800">{interview.allergies || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase">Doenças Crônicas</div>
                  <div className="font-bold text-sm text-gray-800">{interview.chronicDiseases || '-'}</div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Dados Clínicos */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3 flex items-center gap-2">
              <HeartPulse size={16} /> 3. Dados Clínicos
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase">Uso de Fraldas</div>
                  <div className="font-bold text-sm text-gray-800">{interview?.diaperUsage || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase">Deambulação</div>
                  <div className="font-bold text-sm text-gray-800">{interview?.ambulation || '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Medicamentos</div>
                <div className="font-bold text-sm text-gray-800">{interview?.continuousMedication === 'true' ? interview?.medicationDetails : 'Não'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Parecer / Status Médico</div>
                <div className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-xl border">{medStatus}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* 4. Primeiras Avaliações Profissionais */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3 flex items-center gap-2 mb-4">
              <Activity size={16} /> 4. Primeiras Avaliações Profissionais
            </h3>
            
            <div className="space-y-4">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <h4 className="text-xs font-black text-[#004c99] uppercase mb-2">Nutrição</h4>
                {!nutInitial ? (
                  <p className="text-xs text-gray-500 italic">Primeira avaliação não registrada.</p>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Diagnóstico Inicial</span>
                      <p className="text-xs text-gray-800">{nutInitial.initialDiagnosis || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Metas</span>
                      <p className="text-xs text-gray-800">{nutInitial.piaGoals || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                <h4 className="text-xs font-black text-purple-800 uppercase mb-2">Psicologia</h4>
                {!psyInitial ? (
                  <p className="text-xs text-gray-500 italic">Primeira avaliação não registrada.</p>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Síntese / Demanda</span>
                      <p className="text-xs text-gray-800 uppercase line-clamp-2">{psyInitial.initialPsychologicalSynthesis || psyInitial.demanda || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Metas</span>
                      <p className="text-xs text-gray-800 uppercase line-clamp-2">{psyInitial.piaPsychologicalGoals || psyInitial.objetivos || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                <h4 className="text-xs font-black text-teal-800 uppercase mb-2">Terapia Ocupacional</h4>
                {!otInitial ? (
                  <p className="text-xs text-gray-500 italic">Primeira avaliação não registrada.</p>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Síntese Funcional</span>
                      <p className="text-xs text-gray-800 uppercase line-clamp-2">{otInitial.functionalSynthesis || otInitial.treatmentConductObservations || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Metas</span>
                      <p className="text-xs text-gray-800 uppercase line-clamp-2">{otInitial.piaGoals || otInitial.therapeuticGoalsObservations || '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <h4 className="text-xs font-black text-indigo-800 uppercase mb-2">Fisioterapia</h4>
                {!ptInitial ? (
                  <p className="text-xs text-gray-500 italic">Primeira avaliação não registrada.</p>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Diagnóstico Cinesiofuncional</span>
                      <p className="text-xs text-gray-800 uppercase line-clamp-2">{ptInitial.kineticFunctionalDiagnosis || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-500 uppercase block">Metas</span>
                      <p className="text-xs text-gray-800 uppercase line-clamp-2">{ptInitial.objectives || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* 5. Histórico de Evoluções */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm mt-6">
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest border-b pb-3 flex items-center gap-2 mb-4">
          <Clock size={16} /> 5. Histórico de Evoluções Complementares (PIA)
        </h3>
        
        {filteredEvolutions.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-sm font-medium text-gray-500">Não há evoluções registradas para o período.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredEvolutions.map(group => (
              <div key={group.area} className="pb-4 border-b last:border-b-0 border-gray-100">
                <h4 className="text-xs font-black text-gray-600 border border-gray-200 uppercase tracking-widest mb-4 bg-gray-50 max-w-min whitespace-nowrap px-3 py-1 rounded-full">{group.area}</h4>
                <div className="space-y-4 pl-2">
                  {group.evs.map((e: any) => {
                     const dt = e.dataEvolucao || e.date;
                     const dtStr = dt ? new Date(dt).toLocaleDateString('pt-BR') : 'Sem data';
                     const txt = e.descricaoEvolucao || e.newConduct || e.functionalEvolution || e.description || 'Evolução registrada.';
                     let profName = e.professionalName || '';
                     let profRole = e.professionalRole || '';
                     return (
                       <div key={e.id} className="flex gap-4 items-start">
                         <span className="text-[10px] uppercase font-black text-[#004c99] tracking-widest shrink-0 mt-0.5 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">{dtStr}</span>
                         <div>
                           <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{txt}</p>
                           {profName && <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Profissional: {profName} {profRole ? \`(\${profRole})\` : ''}</p>}
                         </div>
                       </div>
                     )
                  })}
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
`

fs.writeFileSync('components/PiaTab.tsx', replacement);
console.log("Rewrote PiaTab!");

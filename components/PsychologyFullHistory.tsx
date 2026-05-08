import React from 'react';
import { Resident } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { addPdfSignatureNode } from '../lib/pdfUtils';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';

interface PsychologyFullHistoryProps {
  resident: Resident;
  settings?: any;
}

export const PsychologyFullHistory: React.FC<PsychologyFullHistoryProps> = ({ resident, settings }) => {
  const anamnese = resident.psychology?.anamnese || resident.psychology?.initialAssessment;
  const evolutions = resident.psychology?.evolutions || [];
  const attendances = resident.psychology?.attendances || [];

  const allRecords: any[] = [];

  if (anamnese) {
    allRecords.push({
      type: 'Primeira Avaliação',
      dateStr: anamnese.date,
      timestamp: new Date(anamnese.date).getTime(),
      content: `Síntese Psicológica: ${anamnese.initialPsychologicalSynthesis || (anamnese as any).demanda || (anamnese as any).observacao || 'N/A'}\nMetas PIA: ${anamnese.piaPsychologicalGoals || (anamnese as any).objetivos || 'N/A'}`,
      professional: 'Psicologia',
      isPrivate: false,
      rawData: anamnese
    });
  }

  evolutions.forEach((ev: any) => {
    const d = ev.dataEvolucao || ev.date;
    const contentArr = [];
    if (ev.descricaoEvolucao || ev.observacao || ev.description || ev.notes) contentArr.push(`Evolução: ${ev.descricaoEvolucao || ev.observacao || ev.description || ev.notes}`);
    if (ev.newConduct || ev.novaConduta) contentArr.push(`Nova Conduta: ${ev.newConduct || ev.novaConduta}`);
    if (ev.institutionalAdaptationStatus) contentArr.push(`Status Adaptação: ${ev.institutionalAdaptationStatus}`);
    if (ev.moodBehaviorEvolution) contentArr.push(`Humor e Comportamento: ${ev.moodBehaviorEvolution}`);
    
    allRecords.push({
      type: 'Evolução',
      dateStr: d,
      timestamp: new Date(d || 0).getTime(),
      content: contentArr.join('\n\n'),
      professional: ev.profissionalAssinaturaTexto || ev.profissionalNome || ev.professionalName || 'Psicólogo(a)',
      isPrivate: false,
      rawData: ev
    });
  });

  attendances.forEach((at: any) => {
    const d = at.dateTime || at.date;
    const contentArr = [];
    if (at.interventionType) contentArr.push(`Tipo de Intervenção: ${at.interventionType}`);
    if (at.descricaoAtendimento || at.attendanceEvolution || at.descricao || at.notes || at.atendimento) {
      contentArr.push(`Descrição: ${at.descricaoAtendimento || at.attendanceEvolution || at.descricao || at.notes || at.atendimento}`);
    }
    if (at.muralNotes) contentArr.push(`Compartilhado no Mural: ${at.muralNotes}`);

    // Check visibility
    let isPrivate = false;
    if (Array.isArray(at.visibilidade) && at.visibilidade.includes('privado')) isPrivate = true;
    if (at.visibilidade === 'privado') isPrivate = true;
    
    const currentUserJson = localStorage.getItem('ssvp_session');
    let hasAccess = false;
    if (currentUserJson) {
      const u = JSON.parse(currentUserJson);
      hasAccess = u.accessLevel === 'administrador' || u.accessLevel === 'psicologia';
    }

    if (isPrivate && !hasAccess) {
      contentArr.push("CONTEÚDO RESTRITO (Visível apenas para Psicologia/Administração)");
    } else if (at.privateNotes) {
      contentArr.push(`Notas Privadas: ${at.privateNotes}`);
    }

    allRecords.push({
      type: 'Atendimento',
      dateStr: d,
      timestamp: new Date(d || 0).getTime(),
      content: contentArr.join('\n\n'),
      professional: at.profissionalAssinaturaTexto || at.signature || at.profissionalNome || 'Psicólogo(a)',
      isPrivate: isPrivate && !hasAccess,
      rawData: at
    });
  });

  allRecords.sort((a, b) => b.timestamp - a.timestamp);

  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    await addPdfHeaderAndFooter(doc, settings, 'Histórico Psicológico Geral');
    yPos = 55; // Because addPdfHeaderAndFooter uses up to ~45-50

    const checkPageBreak = async (needed: number) => {
      if (yPos + needed > 280) {
        doc.addPage();
        await addPdfHeaderAndFooter(doc, settings, 'Histórico Psicológico Geral');
        yPos = 55;
      }
    };
    
    doc.setFontSize(10);
    doc.text(`Residente: ${resident.name}`, 14, yPos);
    yPos += 6;
    if (resident.birthDate) {
      doc.text(`Data de Nascimento: ${resident.birthDate}`, 14, yPos);
      yPos += 6;
    }
    if (resident.age) {
       doc.text(`Idade: ${resident.age}`, 14, yPos);
       yPos += 6;
    }
    if (resident.room || resident.bedNumber) {
       doc.text(`Quarto/Leito: ${resident.room || ''} ${resident.bedNumber ? '- Leito '+resident.bedNumber : ''}`, 14, yPos);
       yPos += 6;
    }

    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;

    if (allRecords.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('Nenhum registro encontrado.', 14, yPos);
    } else {
      for (const record of allRecords) {
        await checkPageBreak(30);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        
        let displayDate = 'Data não informada';
        if (record.dateStr) {
           displayDate = new Date(record.dateStr).toLocaleString('pt-BR');
        }

        let headerText = `${displayDate} - ${record.type}`;
        doc.text(headerText, 14, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitContent = doc.splitTextToSize(record.content, pageWidth - 28);
        doc.text(splitContent, 14, yPos);
        yPos += splitContent.length * 4.5 + 4;

        if (record.professional) {
          doc.setFont('helvetica', 'italic');
          doc.text(`Profissional: ${record.professional}`, 14, yPos);
          yPos += 8;
        }

        doc.setLineWidth(0.1);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 8;
      }
    }

    addPdfSignatureNode(doc);
    doc.save(`Historico_Psicologia_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-200">
        <div>
          <h2 className="text-lg font-black text-[#004c99] uppercase tracking-tighter">Histórico Psicológico Geral</h2>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">
            Visualização consolidada de anamnese, evoluções e atendimentos
          </p>
        </div>
        <button 
          onClick={generatePDF}
          className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase transition-all shadow-md hover:shadow-lg hover:bg-blue-800 flex items-center gap-2 whitespace-nowrap"
        >
          Exportar Histórico em PDF
        </button>
      </div>

      <div className="space-y-4">
        {allRecords.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl bg-gray-50/50">
            <p className="text-gray-400 font-bold uppercase text-sm">Nenhum registro psicológico encontrado.</p>
          </div>
        ) : (
          allRecords.map((record, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 transition-all">
              <div className="flex justify-between items-start mb-4 border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-blue-100 text-[#004c99] text-[10px] font-black uppercase tracking-widest rounded-lg">
                    {record.type}
                  </div>
                  {record.isPrivate && (
                    <div className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                      Acesso Restrito
                    </div>
                  )}
                  <div className="text-xs font-bold text-gray-500 uppercase">
                    {record.dateStr ? new Date(record.dateStr).toLocaleString('pt-BR') : 'Sem data'}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {record.content}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-black uppercase tracking-widest">
                Profissional: {record.professional}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

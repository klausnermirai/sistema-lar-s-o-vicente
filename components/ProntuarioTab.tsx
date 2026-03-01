import React, { useState, useMemo } from 'react';
import { Resident } from '../types';
import { Calendar, Clock, User, FileText, AlertCircle, Volume2, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ProntuarioTabProps {
  resident: Resident;
}

type TimelineEvent = {
  id: string;
  date: string;
  time?: string;
  competence: string;
  type: string;
  professional: string;
  summary: string;
  fullContent: React.ReactNode;
  isPrivate?: boolean;
  isShared?: boolean;
  timestamp: number;
};

const ProntuarioTab: React.FC<ProntuarioTabProps> = ({ resident }) => {
  const [filterCompetence, setFilterCompetence] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterSharedOnly, setFilterSharedOnly] = useState<boolean>(false);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    // --- Nutrição ---
    if (resident.nutrition?.initialAssessment) {
      const assess = resident.nutrition.initialAssessment;
      allEvents.push({
        id: `nutri-assess-${assess.date}`,
        date: assess.date,
        competence: 'Nutrição',
        type: 'Avaliação Inicial',
        professional: 'Nutricionista',
        summary: assess.initialDiagnosis || 'Avaliação nutricional inicial realizada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Diagnóstico:</strong> {assess.initialDiagnosis || 'N/A'}</p>
            <p><strong>Metas PIA:</strong> {assess.piaGoals || 'N/A'}</p>
            <p><strong>Via de Alimentação:</strong> {assess.feedingRoute || 'N/A'}</p>
            <p><strong>Consistência:</strong> {assess.dietConsistency || 'N/A'}</p>
            {assess.needsSupplementation && <p><strong>Suplementação:</strong> {assess.supplementationDetails}</p>}
          </div>
        ),
        timestamp: new Date(assess.date).getTime()
      });
    }

    resident.nutrition?.evolutions?.forEach(ev => {
      allEvents.push({
        id: `nutri-evo-${ev.id}`,
        date: ev.date,
        competence: 'Nutrição',
        type: 'Evolução',
        professional: 'Nutricionista',
        summary: ev.newConduct ? ev.newConduct.substring(0, 100) + '...' : 'Evolução nutricional registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Conduta:</strong> {ev.newConduct}</p>
            <p><strong>Aceitação Alimentar:</strong> {ev.foodAcceptance || 'N/A'}</p>
            <p><strong>Status Meta PIA:</strong> {ev.piaGoalStatus || 'N/A'}</p>
          </div>
        ),
        timestamp: new Date(ev.date).getTime()
      });
    });

    resident.nutrition?.attendances?.forEach(att => {
      const datePart = att.dateTime.split('T')[0];
      const timePart = att.dateTime.includes('T') ? att.dateTime.split('T')[1].substring(0, 5) : undefined;
      allEvents.push({
        id: `nutri-att-${att.id}`,
        date: datePart,
        time: timePart,
        competence: 'Nutrição',
        type: 'Atendimento',
        professional: att.signature || 'Nutricionista',
        summary: att.notes ? att.notes.substring(0, 100) + '...' : 'Atendimento nutricional registrado.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Motivo:</strong> {att.reason}</p>
            <p><strong>Anotação:</strong> {att.notes}</p>
            {att.muralNotes && <p><strong>Mural:</strong> {att.muralNotes}</p>}
          </div>
        ),
        isShared: !!att.muralNotes,
        timestamp: new Date(att.dateTime).getTime()
      });
    });

    // --- Psicologia ---
    if (resident.psychology?.anamnese) {
      const anamnesis = resident.psychology.anamnese;
      allEvents.push({
        id: `psico-anamnesis-${anamnesis.date}`,
        date: anamnesis.date,
        competence: 'Psicologia',
        type: 'Anamnese',
        professional: 'Psicólogo(a)',
        summary: anamnesis.initialPsychologicalSynthesis ? anamnesis.initialPsychologicalSynthesis.substring(0, 100) + '...' : 'Anamnese psicológica realizada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Síntese Inicial:</strong> {anamnesis.initialPsychologicalSynthesis}</p>
            <p><strong>Metas PIA:</strong> {anamnesis.piaPsychologicalGoals}</p>
          </div>
        ),
        timestamp: new Date(anamnesis.date).getTime()
      });
    }

    resident.psychology?.evolutions?.forEach(ev => {
      allEvents.push({
        id: `psico-evo-${ev.id}`,
        date: ev.date,
        competence: 'Psicologia',
        type: 'Evolução',
        professional: 'Psicólogo(a)',
        summary: ev.newConduct ? ev.newConduct.substring(0, 100) + '...' : 'Evolução psicológica registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Conduta:</strong> {ev.newConduct}</p>
            <p><strong>Status Adaptação:</strong> {ev.institutionalAdaptationStatus}</p>
            <p><strong>Evolução Humor/Comportamento:</strong> {ev.moodBehaviorEvolution}</p>
          </div>
        ),
        timestamp: new Date(ev.date).getTime()
      });
    });

    resident.psychology?.attendances?.forEach(att => {
      const datePart = att.dateTime.split('T')[0];
      const timePart = att.dateTime.includes('T') ? att.dateTime.split('T')[1].substring(0, 5) : undefined;
      allEvents.push({
        id: `psico-att-${att.id}`,
        date: datePart,
        time: timePart,
        competence: 'Psicologia',
        type: 'Atendimento',
        professional: att.signature || 'Psicólogo(a)',
        summary: att.attendanceEvolution ? att.attendanceEvolution.substring(0, 100) + '...' : 'Atendimento psicológico registrado.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Tipo de Intervenção:</strong> {att.interventionType}</p>
            <p><strong>Evolução:</strong> {att.attendanceEvolution}</p>
            {att.muralNotes && <p><strong>Mural:</strong> {att.muralNotes}</p>}
          </div>
        ),
        isShared: !!att.muralNotes,
        isPrivate: !!att.privateNotes,
        timestamp: new Date(att.dateTime).getTime()
      });
    });

    // --- Outros (Integração, Parecer, etc) ---
    if (resident.integrationDate) {
      allEvents.push({
        id: `integration-${resident.integrationDate}`,
        date: resident.integrationDate,
        competence: 'Integração',
        type: 'Parecer de Integração',
        professional: 'Equipe Multidisciplinar',
        summary: resident.integrationReport ? resident.integrationReport.substring(0, 100) + '...' : 'Integração registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p>{resident.integrationReport}</p>
          </div>
        ),
        timestamp: new Date(resident.integrationDate).getTime()
      });
    }

    if (resident.medicalOpinion) {
      // Assuming medical opinion date is the admission date or creation date if not specified
      const date = resident.admissionDate || resident.createdAt || new Date().toISOString().split('T')[0];
      allEvents.push({
        id: `medical-${date}`,
        date: date,
        competence: 'Médico',
        type: 'Parecer Médico',
        professional: 'Médico(a)',
        summary: resident.medicalOpinion.substring(0, 100) + '...',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Status:</strong> <span className="uppercase">{resident.medicalStatus}</span></p>
            <p>{resident.medicalOpinion}</p>
          </div>
        ),
        timestamp: new Date(date).getTime()
      });
    }

    if (resident.boardOpinion) {
      const date = resident.createdAt || new Date().toISOString().split('T')[0];
      allEvents.push({
        id: `board-${date}`,
        date: date,
        competence: 'Diretoria',
        type: 'Parecer da Diretoria',
        professional: 'Diretoria',
        summary: resident.boardOpinion.substring(0, 100) + '...',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p>{resident.boardOpinion}</p>
          </div>
        ),
        timestamp: new Date(date).getTime()
      });
    }

    // Sort by timestamp descending (newest first)
    return allEvents.sort((a, b) => b.timestamp - a.timestamp);
  }, [resident]);

  const filteredEvents = events.filter(ev => {
    if (filterCompetence && ev.competence !== filterCompetence) return false;
    if (filterSharedOnly && !ev.isShared) return false;
    if (filterStartDate && ev.date < filterStartDate) return false;
    if (filterEndDate && ev.date > filterEndDate) return false;
    return true;
  });

  const currentUser = { role: 'admin' }; // Mock user for now since authStore doesn't exist

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Prontuário Multidisciplinar', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Residente: ${resident.name}`, 14, 30);
    doc.text(`Data de Nascimento: ${resident.birthDate || 'N/A'}`, 14, 35);
    doc.text(`Data de Admissão: ${resident.admissionDate || 'N/A'}`, 14, 40);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 45);

    let yPos = 55;

    filteredEvents.forEach((ev, index) => {
      // Check page break
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 76, 153); // Blue
      doc.text(`${ev.date} ${ev.time ? `- ${ev.time}` : ''} | ${ev.competence} - ${ev.type}`, 14, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Profissional: ${ev.professional}`, 14, yPos);
      yPos += 6;

      doc.setTextColor(0, 0, 0);
      
      // Handle privacy
      const isPsychology = ev.competence === 'Psicologia';
      const hasPermission = currentUser?.role === 'admin' || currentUser?.role === 'psicologia';

      if (ev.isPrivate && isPsychology && !hasPermission) {
        doc.setFont('helvetica', 'italic');
        doc.text('Conteúdo restrito', 14, yPos);
        yPos += 8;
      } else {
        // Extract text from fullContent (this is a simplified approach, a real app might need a better way to store raw text for PDF)
        // Since fullContent is JSX, we'll use the summary and add a note about shared content
        
        // We need to extract the raw text data. Let's use the summary for now, and append mural notes if shared.
        // In a real scenario, the TimelineEvent should store raw text data for PDF generation.
        
        let contentText = ev.summary;
        
        // Try to get more detailed text based on the event type (this is a workaround since we don't have raw text in TimelineEvent)
        if (ev.type === 'Avaliação Inicial' && ev.competence === 'Nutrição') {
           const assess = resident.nutrition?.initialAssessment;
           if(assess) contentText = `Diagnóstico: ${assess.initialDiagnosis || 'N/A'}\nMetas PIA: ${assess.piaGoals || 'N/A'}\nVia de Alimentação: ${assess.feedingRoute || 'N/A'}\nConsistência: ${assess.dietConsistency || 'N/A'}${assess.needsSupplementation ? `\nSuplementação: ${assess.supplementationDetails}` : ''}`;
        } else if (ev.type === 'Evolução' && ev.competence === 'Nutrição') {
           const evo = resident.nutrition?.evolutions?.find(e => e.date === ev.date);
           if(evo) contentText = `Conduta: ${evo.newConduct}\nAceitação Alimentar: ${evo.foodAcceptance || 'N/A'}\nStatus Meta PIA: ${evo.piaGoalStatus || 'N/A'}`;
        } else if (ev.type === 'Atendimento' && ev.competence === 'Nutrição') {
           const att = resident.nutrition?.attendances?.find(a => a.dateTime.startsWith(ev.date));
           if(att) contentText = `Motivo: ${att.reason}\nAnotação: ${att.notes}`;
        } else if (ev.type === 'Anamnese' && ev.competence === 'Psicologia') {
           const anamnesis = resident.psychology?.anamnese;
           if(anamnesis) contentText = `Síntese Inicial: ${anamnesis.initialPsychologicalSynthesis}\nMetas PIA: ${anamnesis.piaPsychologicalGoals}`;
        } else if (ev.type === 'Evolução' && ev.competence === 'Psicologia') {
           const evo = resident.psychology?.evolutions?.find(e => e.date === ev.date);
           if(evo) contentText = `Conduta: ${evo.newConduct}\nStatus Adaptação: ${evo.institutionalAdaptationStatus}\nEvolução Humor/Comportamento: ${evo.moodBehaviorEvolution}`;
        } else if (ev.type === 'Atendimento' && ev.competence === 'Psicologia') {
           const att = resident.psychology?.attendances?.find(a => a.dateTime.startsWith(ev.date));
           if(att) {
             contentText = `Tipo de Intervenção: ${att.interventionType}\nEvolução: ${att.attendanceEvolution}`;
             if(att.privateNotes && hasPermission) {
                contentText += `\n\nNotas Privadas: ${att.privateNotes}`;
             }
           }
        } else if (ev.type === 'Parecer de Integração') {
           contentText = resident.integrationReport || '';
        } else if (ev.type === 'Parecer Médico') {
           contentText = `Status: ${resident.medicalStatus}\n${resident.medicalOpinion}`;
        } else if (ev.type === 'Parecer da Diretoria') {
           contentText = resident.boardOpinion || '';
        }

        const splitText = doc.splitTextToSize(contentText, pageWidth - 28);
        doc.text(splitText, 14, yPos);
        yPos += (splitText.length * 5) + 4;

        if (ev.isShared) {
          // Find mural notes
          let muralNotes = '';
          if (ev.competence === 'Nutrição') {
             const att = resident.nutrition?.attendances?.find(a => a.dateTime.startsWith(ev.date));
             if(att) muralNotes = att.muralNotes || '';
          } else if (ev.competence === 'Psicologia') {
             const att = resident.psychology?.attendances?.find(a => a.dateTime.startsWith(ev.date));
             if(att) muralNotes = att.muralNotes || '';
          }

          if (muralNotes) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(200, 100, 0); // Orange
            doc.text('Conteúdo compartilhável no mural:', 14, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            const splitMural = doc.splitTextToSize(muralNotes, pageWidth - 28);
            doc.text(splitMural, 14, yPos);
            yPos += (splitMural.length * 5) + 4;
          }
        }
      }
      
      yPos += 4; // Space between events
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 6;
    });

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`Prontuario_Multidisciplinar_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const uniqueCompetences = Array.from(new Set(events.map(e => e.competence)));

  return (
    <div className="p-8 animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Prontuário Multidisciplinar</h3>
          <p className="text-sm text-gray-500 font-medium mt-1">Timeline clínica do residente</p>
        </div>
        <button 
          type="button" 
          onClick={handleGeneratePDF}
          className="px-4 py-2 bg-[#004c99] text-white rounded-lg font-black text-xs uppercase hover:bg-blue-800 flex items-center gap-2 shadow-sm transition-colors"
        >
          <Printer size={16} />
          Gerar PDF
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-8 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Competência</label>
          <select 
            value={filterCompetence}
            onChange={(e) => setFilterCompetence(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
          >
            <option value="">Todas</option>
            {uniqueCompetences.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Inicial</label>
          <input 
            type="date" 
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Final</label>
          <input 
            type="date" 
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input 
            type="checkbox" 
            id="sharedOnly"
            checked={filterSharedOnly}
            onChange={(e) => setFilterSharedOnly(e.target.checked)}
            className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
          />
          <label htmlFor="sharedOnly" className="text-sm font-bold text-gray-700 cursor-pointer">Somente compartilhados no mural</label>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 pb-8">
        {filteredEvents.length === 0 ? (
          <div className="pl-8 text-gray-500 text-sm font-medium">Nenhum registro encontrado para os filtros selecionados.</div>
        ) : (
          filteredEvents.map((ev) => {
            const isExpanded = expandedEvents[ev.id];
            
            return (
              <div key={ev.id} className="relative pl-8">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-[#004c99]"></div>
                
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Event Header */}
                  <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-widest rounded-full">
                          {ev.competence}
                        </span>
                        <span className="text-sm font-bold text-gray-800">{ev.type}</span>
                        {ev.isShared && (
                          <span className="text-amber-500 flex items-center gap-1 text-[10px] font-black uppercase bg-amber-50 px-2 py-0.5 rounded-full" title="Compartilhado no mural">
                            <Volume2 size={12} /> Mural
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 font-medium mt-2">
                        <div className="flex items-center gap-1"><Calendar size={14} /> {new Date(ev.date).toLocaleDateString('pt-BR')}</div>
                        {ev.time && <div className="flex items-center gap-1"><Clock size={14} /> {ev.time}</div>}
                        <div className="flex items-center gap-1"><User size={14} /> {ev.professional}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleExpand(ev.id)}
                      className="text-[#004c99] hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase"
                    >
                      {isExpanded ? (
                        <><ChevronUp size={16} /> Ocultar</>
                      ) : (
                        <><ChevronDown size={16} /> Ver completo</>
                      )}
                    </button>
                  </div>

                  {/* Event Content */}
                  <div className="p-4">
                    {ev.isPrivate ? (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                        <div>
                          <h4 className="text-sm font-bold text-red-800 uppercase tracking-tight mb-1">Conteúdo Restrito</h4>
                          <p className="text-xs text-red-600 font-medium">Este registro é restrito à equipe de Psicologia. O conteúdo completo não pode ser exibido.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!isExpanded && (
                          <p className="text-sm text-gray-600 italic">"{ev.summary}"</p>
                        )}
                        {isExpanded && (
                          <div className="text-gray-800">
                            {ev.fullContent}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProntuarioTab;

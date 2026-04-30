import React, { useState, useMemo } from 'react';
import { Resident, InstitutionSettings } from '../types';
import { Calendar, Clock, User, FileText, AlertCircle, Volume2, ChevronDown, ChevronUp, Printer, Stethoscope, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';

interface ProntuarioTabProps {
  resident: Resident;
  settings?: InstitutionSettings | null;
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

const ProntuarioTab: React.FC<ProntuarioTabProps> = ({ resident, settings }) => {
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

    resident.nutrition?.groupActivities?.forEach(ga => {
      allEvents.push({
        id: `nutri-ga-${ga.id}`,
        date: ga.date,
        time: ga.time,
        competence: 'Nutrição',
        type: `Atividade em grupo - ${ga.type}`,
        professional: ga.responsibleProfessional,
        summary: ga.description.substring(0, 100) + '...',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Descrição:</strong> {ga.description}</p>
            <p><strong>Resultado:</strong> {ga.result}</p>
            {ga.observations && <p><strong>Observações:</strong> {ga.observations}</p>}
            {ga.involvedProfessionals.length > 0 && <p><strong>Profissionais envolvidos:</strong> {ga.involvedProfessionals.join(', ')}</p>}
          </div>
        ),
        isShared: ga.sharedToMural,
        timestamp: new Date(`${ga.date}T${ga.time}`).getTime()
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

    resident.psychology?.groupActivities?.forEach(ga => {
      allEvents.push({
        id: `psico-ga-${ga.id}`,
        date: ga.date,
        time: ga.time,
        competence: 'Psicologia',
        type: `Atividade em grupo - ${ga.type}`,
        professional: ga.responsibleProfessional,
        summary: ga.description.substring(0, 100) + '...',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Descrição:</strong> {ga.description}</p>
            <p><strong>Resultado:</strong> {ga.result}</p>
            {ga.observations && <p><strong>Observações:</strong> {ga.observations}</p>}
            {ga.involvedProfessionals.length > 0 && <p><strong>Profissionais envolvidos:</strong> {ga.involvedProfessionals.join(', ')}</p>}
          </div>
        ),
        isShared: ga.sharedToMural,
        timestamp: new Date(`${ga.date}T${ga.time}`).getTime()
      });
    });

    // --- Terapia Ocupacional ---
    if (resident.occupationalTherapy?.initialAssessment) {
      const assess = resident.occupationalTherapy.initialAssessment;
      allEvents.push({
        id: `to-assess-${assess.date}`,
        date: assess.date,
        competence: 'Terapeuta Ocupacional',
        type: 'Primeira Avaliação',
        professional: 'Terapeuta Ocupacional',
        summary: assess.functionalSynthesis ? assess.functionalSynthesis.substring(0, 100) + '...' : 'Avaliação ocupacional inicial realizada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Síntese Funcional:</strong> {assess.functionalSynthesis}</p>
            <p><strong>Metas PIA:</strong> {assess.piaGoals}</p>
            <p><strong>Nível de Independência:</strong> {assess.independenceLevel}</p>
            <p><strong>Mobilidade:</strong> {assess.mobility}</p>
          </div>
        ),
        timestamp: new Date(assess.date).getTime()
      });
    }

    resident.occupationalTherapy?.evolutions?.forEach(ev => {
      allEvents.push({
        id: `to-evo-${ev.id}`,
        date: ev.date,
        competence: 'Terapeuta Ocupacional',
        type: 'Evolução',
        professional: 'Terapeuta Ocupacional',
        summary: ev.newConduct ? ev.newConduct.substring(0, 100) + '...' : 'Evolução ocupacional registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Conduta:</strong> {ev.newConduct}</p>
            <p><strong>Evolução Funcional:</strong> {ev.functionalEvolution}</p>
            <p><strong>Participação:</strong> {ev.participationEvolution}</p>
          </div>
        ),
        timestamp: new Date(ev.date).getTime()
      });
    });

    resident.occupationalTherapy?.attendances?.forEach(att => {
      const datePart = att.dateTime.split('T')[0];
      const timePart = att.dateTime.includes('T') ? att.dateTime.split('T')[1].substring(0, 5) : undefined;
      allEvents.push({
        id: `to-att-${att.id}`,
        date: datePart,
        time: timePart,
        competence: 'Terapeuta Ocupacional',
        type: 'Atendimento',
        professional: att.signature || 'Terapeuta Ocupacional',
        summary: att.attendanceEvolution ? att.attendanceEvolution.substring(0, 100) + '...' : 'Atendimento ocupacional registrado.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Tipo:</strong> {att.attendanceType}</p>
            <p><strong>Evolução:</strong> {att.attendanceEvolution}</p>
            {att.prontuarioNotes && <p><strong>Anotação Interna:</strong> {att.prontuarioNotes}</p>}
            {att.muralNotes && <p><strong>Mural:</strong> {att.muralNotes}</p>}
          </div>
        ),
        isShared: !!att.muralNotes,
        timestamp: new Date(att.dateTime).getTime()
      });
    });

    resident.occupationalTherapy?.groupActivities?.forEach(ga => {
      allEvents.push({
        id: `to-ga-${ga.id}`,
        date: ga.date,
        time: ga.time,
        competence: 'Terapeuta Ocupacional',
        type: `Atividade em grupo - ${ga.type}`,
        professional: ga.responsibleProfessional,
        summary: ga.description.substring(0, 100) + '...',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Descrição:</strong> {ga.description}</p>
            <p><strong>Resultado:</strong> {ga.result}</p>
            {ga.observations && <p><strong>Observações:</strong> {ga.observations}</p>}
            {ga.involvedProfessionals.length > 0 && <p><strong>Profissionais envolvidos:</strong> {ga.involvedProfessionals.join(', ')}</p>}
          </div>
        ),
        isShared: ga.sharedToMural,
        timestamp: new Date(`${ga.date}T${ga.time}`).getTime()
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

    // --- Intercorrências ---
    resident.incidents?.forEach(inc => {
      allEvents.push({
        id: `incident-${inc.id}`,
        date: inc.date,
        competence: 'Cuidados / Enfermagem',
        type: `Intercorrência - ${inc.type}`,
        professional: inc.author,
        summary: inc.description.substring(0, 100) + '...',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Tipo:</strong> <span className="uppercase">{inc.type}</span></p>
            <p><strong>Descrição:</strong> {inc.description}</p>
            <p><strong>Conduta Toma:</strong> {inc.actionTaken}</p>
            {inc.sharedInMural && <p className="text-amber-600 font-bold">Compartilhado no Mural</p>}
          </div>
        ),
        isShared: inc.sharedInMural,
        timestamp: new Date(`${inc.date}T${inc.time || '00:00'}`).getTime()
      });
    });

    // --- Consultas e Exames ---
    resident.appointments?.forEach(app => {
      allEvents.push({
        id: `app-${app.id}`,
        date: app.date,
        time: app.time,
        competence: 'Médico / Saúde',
        type: `Atendimento Externo - ${app.type}`,
        professional: app.professional || 'Não informado',
        summary: `${app.specialty || app.type} - ${app.status}`,
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Especialidade/Título:</strong> {app.specialty}</p>
            <p><strong>Local:</strong> {app.location}</p>
            <p><strong>Status:</strong> <span className="uppercase font-bold">{app.status}</span></p>
            {app.notes && <p><strong>Observações:</strong> {app.notes}</p>}
            {app.companionId && <p><strong>Acompanhante:</strong> {app.companionId}</p>}
          </div>
        ),
        timestamp: new Date(`${app.date}T${app.time || '00:00'}`).getTime()
      });
    });

    // --- Solicitações de Exames ---
    resident.exams?.forEach(ex => {
      allEvents.push({
        id: `exam-${ex.id}`,
        date: ex.date,
        competence: 'Médico',
        type: 'Solicitação de Exame',
        professional: ex.doctorName,
        summary: `${ex.exams.join(', ')} - ${ex.status}`,
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Exames:</strong> {ex.exams.join(', ')}</p>
            {ex.otherExams && <p><strong>Outros:</strong> {ex.otherExams}</p>}
            <p><strong>Status:</strong> <span className="uppercase font-bold">{ex.status}</span></p>
            {ex.results && <p><strong>Resultados:</strong> {ex.results}</p>}
            {ex.resultsDate && <p><strong>Data Resultados:</strong> {ex.resultsDate}</p>}
          </div>
        ),
        timestamp: new Date(ex.date).getTime()
      });
    });

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

  const sessionStr = localStorage.getItem('ssvp_session');
  const session = sessionStr ? JSON.parse(sessionStr) : null;
  const accessLevel = session?.accessLevel?.toLowerCase() || '';
  const currentUser = { role: accessLevel === 'administrador' ? 'admin' : accessLevel };

  const handleGeneratePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let yPos = 45;

    filteredEvents.forEach((ev, index) => {
      // Check page break
      if (yPos > 270) {
        doc.addPage();
        yPos = 45;
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
        } else if (ev.type.startsWith('Atividade em grupo') && ev.competence === 'Nutrição') {
           const ga = resident.nutrition?.groupActivities?.find(a => a.date === ev.date);
           if(ga) contentText = `Descrição: ${ga.description}\nResultado: ${ga.result}\nObservações: ${ga.observations}`;
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
        } else if (ev.type.startsWith('Atividade em grupo') && ev.competence === 'Psicologia') {
           const ga = resident.psychology?.groupActivities?.find(a => a.date === ev.date);
           if(ga) contentText = `Descrição: ${ga.description}\nResultado: ${ga.result}\nObservações: ${ga.observations}`;
        } else if (ev.type === 'Primeira Avaliação' && ev.competence === 'Terapeuta Ocupacional') {
           const assess = resident.occupationalTherapy?.initialAssessment;
           if(assess) contentText = `Nível de Independência: ${assess.independenceLevel}\nMobilidade: ${assess.mobility}\nMetas PIA: ${assess.piaGoals}`;
        } else if (ev.type === 'Evolução' && ev.competence === 'Terapeuta Ocupacional') {
           const evo = resident.occupationalTherapy?.evolutions?.find(e => e.date === ev.date);
           if(evo) contentText = `Conduta: ${evo.newConduct}\nStatus Meta PIA: ${evo.piaGoalStatus}`;
        } else if (ev.type === 'Atendimento' && ev.competence === 'Terapeuta Ocupacional') {
           const att = resident.occupationalTherapy?.attendances?.find(a => a.dateTime.startsWith(ev.date));
           if(att) contentText = `Tipo: ${att.attendanceType}\nEvolução: ${att.attendanceEvolution}`;
        } else if (ev.type.startsWith('Atividade em grupo') && ev.competence === 'Terapeuta Ocupacional') {
           const ga = resident.occupationalTherapy?.groupActivities?.find(a => a.date === ev.date);
           if(ga) contentText = `Descrição: ${ga.description}\nResultado: ${ga.result}\nObservações: ${ga.observations}`;
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
          } else if (ev.competence === 'Terapeuta Ocupacional') {
             const att = resident.occupationalTherapy?.attendances?.find(a => a.dateTime.startsWith(ev.date));
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

    await addPdfHeaderAndFooter(doc, settings, 'Prontuário Multidisciplinar');

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

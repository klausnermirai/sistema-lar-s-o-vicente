import React, { useState, useMemo, useEffect } from 'react';
import { Resident, InstitutionSettings } from '../types';
import { Calendar, Clock, User, FileText, AlertCircle, Volume2, ChevronDown, ChevronUp, Printer, Stethoscope, Activity, Lock, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';

import 'jspdf-autotable';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';
import { createSocialWorkReauthToken, unlockConfidentialSocialRecord } from '../lib/api';

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
  isConfidential?: boolean;
  recordId?: string;
  timestamp: number;
};

const ProntuarioTab: React.FC<ProntuarioTabProps> = ({ resident, settings }) => {
  const [filterCompetence, setFilterCompetence] = useState<string>('');
  const CATEGORIES = [
    ['incidents', 'Intercorrências'], ['evolutions', 'Evoluções profissionais'],
    ['attendances', 'Atendimentos individuais'], ['groups', 'Atividades em grupo'],
    ['family', 'Contatos familiares e encaminhamentos'], ['other', 'Avaliações e outros registros']
  ] as const;
  const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES.map(([key]) => key));
  const formatLocalDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : (value || 'Sem data');
  const textFromNode = (node: React.ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textFromNode).filter(Boolean).join(' ');
    if (React.isValidElement(node)) return textFromNode((node.props as { children?: React.ReactNode }).children);
    return '';
  };
  const eventCategory = (ev: TimelineEvent): string => {
    if (ev.id.startsWith('incident-')) return 'incidents';
    if (ev.type.startsWith('Atividade em grupo')) return 'groups';
    if (ev.competence === 'Assistente Social' && /Contato com Família|Articulação de Rede|Visita Social|Documentação|Benefícios/i.test(ev.type)) return 'family';
    if (ev.type === 'Atendimento' || (ev.competence === 'Assistente Social' && /Atendimento Individual/i.test(ev.type))) return 'attendances';
    if (ev.type === 'Evolução' || ev.competence === 'Assistente Social') return 'evolutions';
    return 'other';
  };
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterSharedOnly, setFilterSharedOnly] = useState<boolean>(false);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [unlockedSocialRecords, setUnlockedSocialRecords] = useState<Record<string, { description: string; referrals: string }>>({});
  const [unlockingRecordId, setUnlockingRecordId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setUnlockedSocialRecords({});
    setUnlockingRecordId(null);
    setExpandedEvents({});
  }, [resident.id]);

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
        summary: (ev.descricaoEvolucao || ev.newConduct) ? (ev.descricaoEvolucao || ev.newConduct).substring(0, 100) + '...' : 'Evolução nutricional registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            {ev.descricaoEvolucao && <p><strong>Evolução:</strong> {ev.descricaoEvolucao}</p>}<p><strong>Conduta:</strong> {ev.novaConduta || ev.newConduct || 'N/A'}</p>
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
        summary: (att.descricaoAtendimento || att.notes) ? (att.descricaoAtendimento || att.notes).substring(0, 100) + '...' : 'Atendimento nutricional registrado.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Motivo:</strong> {att.reason}</p>
            <p><strong>Anotação:</strong> {att.descricaoAtendimento || att.notes}</p>
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
        summary: (ev.descricaoEvolucao || ev.newConduct) ? (ev.descricaoEvolucao || ev.newConduct).substring(0, 100) + '...' : 'Evolução psicológica registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Conduta:</strong> {ev.newConduct}</p>
            <p><strong>Evolução:</strong> {ev.descricaoEvolucao || (ev as any).evolutionDescription}</p>
            <p><strong>Mudanças observadas:</strong> {(ev as any).mudancasObservadas}</p>
            <p><strong>Nova conduta:</strong> {(ev as any).novaConduta || ev.newConduct}</p>
            <p><strong>Recomendações:</strong> {(ev as any).recomendacoes}</p>
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
        summary: (att.descricaoAtendimento || att.attendanceEvolution) ? (att.descricaoAtendimento || att.attendanceEvolution).substring(0, 100) + '...' : 'Atendimento psicológico registrado.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Tipo de Intervenção:</strong> {att.interventionType}</p>
            <p><strong>Evolução:</strong> {att.descricaoAtendimento || att.attendanceEvolution}</p>
            {att.muralNotes && <p><strong>Mural:</strong> {att.muralNotes}</p>}
          </div>
        ),
        isShared: !!att.muralNotes,
        isPrivate: !!(att as any).privateRestricted || (att as any).visibilidade === 'privado' || (Array.isArray((att as any).visibilidade) && (att as any).visibilidade.includes('privado')),
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
        summary: (ev.descricaoEvolucao || ev.newConduct) ? (ev.descricaoEvolucao || ev.newConduct).substring(0, 100) + '...' : 'Evolução ocupacional registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Conduta:</strong> {ev.newConduct}</p>
            <p><strong>Evolução:</strong> {ev.descricaoEvolucao || (ev as any).evolutionDescription}</p>
            <p><strong>Mudanças observadas:</strong> {(ev as any).mudancasObservadas}</p>
            <p><strong>Nova conduta:</strong> {(ev as any).novaConduta || ev.newConduct}</p>
            <p><strong>Recomendações:</strong> {(ev as any).recomendacoes}</p>
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
        summary: (att.descricaoAtendimento || att.attendanceEvolution) ? (att.descricaoAtendimento || att.attendanceEvolution).substring(0, 100) + '...' : 'Atendimento ocupacional registrado.',
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

    // Fisioterapia: formatos atuais e legados, evitando duplicação por ID.
    const phys = resident.physiotherapy as any;
    if (phys) {
      const seen = new Set<string>();
      const addPhys = (entry: any, kind: string, idx: number) => {
        const date = entry.dataEvolucao || entry.date || (entry.dateTime || '').split('T')[0] || '';
        const identity = String(entry.id || kind + ':' + idx + ':' + date);
        if (seen.has(identity)) return;
        seen.add(identity);
        const details = [
          ['Descrição', entry.descricaoAtendimento || entry.descricaoEvolucao || entry.description || entry.evolutionDescription || entry.attendanceEvolution],
          ['Mudanças observadas', entry.mudancasObservadas], ['Conduta', entry.novaConduta || entry.newConduct || entry.updatedConduct || entry.conduct],
          ['Recomendações', entry.recomendacoes], ['Objetivos', entry.objectives || entry.therapeuticGoals],
          ['Diagnóstico', entry.kineticFunctionalDiagnosis || entry.functionalDiagnosis],
          ['Avaliação motora', entry.motorAssessment], ['Avaliação respiratória', entry.respiratoryAssessment],
          ['Mobilidade', entry.mobilityConditions], ['Resultado', entry.result],
          ['Observações', entry.observations || entry.prontuarioNotes]
        ].filter(([, value]) => value != null && String(value).trim());
        const type = kind === 'assess' ? 'Avaliação Inicial' : kind === 'evo' ? 'Evolução' : kind === 'group' ? 'Atividade em grupo' : 'Atendimento';
        allEvents.push({
          id: 'fisio-' + kind + '-' + identity,
          date, time: entry.time || (entry.dateTime || '').split('T')[1]?.slice(0, 5),
          competence: 'Fisioterapia', type,
          professional: entry.profissionalAssinaturaTexto || entry.profissionalNome || entry.signature || entry.responsibleProfessional || 'Fisioterapeuta',
          summary: String(details[0]?.[1] || 'Registro de Fisioterapia').slice(0, 100),
          fullContent: <div className="space-y-2 text-sm">{details.map(([label, value], i) => <p key={i}><strong>{label}:</strong> {String(value)}</p>)}</div>,
          timestamp: new Date(date + 'T' + (entry.time || '12:00')).getTime() || 0
        });
      };
      if (phys.initialAssessment) addPhys(phys.initialAssessment, 'assess', 0);
      (phys.evolutions || []).forEach((e: any, i: number) => addPhys(e, 'evo', i));
      (phys.attendances || []).forEach((e: any, i: number) => addPhys(e, 'att', i));
      (phys.sessions || []).forEach((e: any, i: number) => addPhys(e, 'att', i));
      (phys.groupActivities || []).forEach((e: any, i: number) => addPhys(e, 'group', i));
    }

    // --- Assistência Social ---
    resident.socialWork?.evolutions?.forEach(ev => {
      const typeLabels: Record<string, string> = {
        atendimento_individual: 'Atendimento Individual',
        contato_familia: 'Contato com Família / Resp.',
        visita_domiciliar: 'Visita Social / Domiciliar',
        articulacao_rede: 'Articulação de Rede Socioassistencial',
        gestao_beneficios: 'Gestão de Benefícios (BPC/INSS)',
        documentacao: 'Regularização Documental',
        pia_social: 'Plano Individual de Atendimento (PIA)',
        reuniao_equipe: 'Estudo de Caso / Equipe',
        outro: 'Ação Social'
      };
      const isConfidential = ev.visibility === 'confidential';
      const description = ev.description || '';
      allEvents.push({
        id: `social-evo-${ev.id}`,
        recordId: ev.id,
        date: ev.date,
        time: ev.time,
        competence: 'Assistente Social',
        type: isConfidential ? 'Registro sigiloso' : (typeLabels[ev.type] || 'Ação Social'),
        professional: ev.professionalSignature || ev.professionalName || 'Assistente Social',
        summary: isConfidential
          ? 'Conteúdo protegido. Autenticação necessária para visualização.'
          : (ev.title ? `${ev.title}: ${description.substring(0, 80)}...` : (description ? description.substring(0, 100) + '...' : 'Atendimento do Serviço Social registrado.')),
        fullContent: isConfidential ? null : (
          <div className="space-y-2 text-sm">
            <p><strong>Assunto:</strong> {ev.title || typeLabels[ev.type] || 'Ação Social'}</p>
            <p><strong>Relato da Intervenção:</strong> {description}</p>
            {ev.targetPersonOrEntity && <p><strong>Envolvido / Órgão:</strong> {ev.targetPersonOrEntity}</p>}
            {ev.contactPhone && <p><strong>Telefone:</strong> {ev.contactPhone}</p>}
            {ev.referrals && <p><strong>Encaminhamentos / Providências:</strong> {ev.referrals}</p>}
            {ev.cress && <p className="text-xs text-gray-500 font-bold">CRESS: {ev.cress}</p>}
          </div>
        ),
        isConfidential,
        isShared: !isConfidential && !!ev.postToMural,
        timestamp: new Date(ev.date + (ev.time ? `T${ev.time}` : 'T12:00:00')).getTime()
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
      const incDate = (inc as any).date || inc.dataOperacional || (inc.timestamp ? new Date(inc.timestamp).toISOString().split('T')[0] : '');
      const incTime = (inc as any).time || (inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined);
      allEvents.push({
        id: `incident-${inc.id}`,
        date: incDate,
        time: incTime,
        competence: 'Cuidados / Enfermagem',
        type: `Intercorrência - ${inc.type}`,
        professional: inc.reporterName || inc.professionalName || (inc as any).author || 'Não informado',
        summary: inc.description ? (inc.description.substring(0, 100) + '...') : 'Intercorrência registrada.',
        fullContent: (
          <div className="space-y-2 text-sm">
            <p><strong>Tipo:</strong> <span className="uppercase">{inc.type}</span></p>
            <p><strong>Relatado por:</strong> {inc.reporterName || 'Não informado'}</p>
            <p><strong>Descrição:</strong> {inc.description}</p>
            <p><strong>Conduta Tomada:</strong> {inc.conduct || (inc as any).actionTaken || 'N/A'}</p>
            {((inc as any).sharedInMural || inc.visibilidade?.includes('publico')) && <p className="text-amber-600 font-bold">Compartilhado no Mural</p>}
          </div>
        ),
        isShared: (inc as any).sharedInMural || inc.visibilidade?.includes('publico'),
        timestamp: inc.timestamp || (incDate ? new Date(`${incDate}T${incTime || '00:00'}`).getTime() : Date.now())
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
    return allEvents.sort((a, b) => (Number.isFinite(b.timestamp) ? b.timestamp : 0) - (Number.isFinite(a.timestamp) ? a.timestamp : 0));
  }, [resident]);

  const filteredEvents = events.filter(ev => {
    if (!selectedCategories.includes(eventCategory(ev))) return false;
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
  const canUnlockSocialConfidential = accessLevel === 'assistente_social';

  const handleUnlockSocialRecord = async (recordId?: string) => {
    if (!recordId || !canUnlockSocialConfidential || unlockingRecordId) return;
    const password = window.prompt('Digite sua senha para visualizar este registro sigiloso:');
    if (!password) return;

    setUnlockingRecordId(recordId);
    try {
      const reauthToken = await createSocialWorkReauthToken(password);
      const content = await unlockConfidentialSocialRecord(resident.id, recordId, reauthToken);
      setUnlockedSocialRecords(prev => ({ ...prev, [recordId]: content }));
      setExpandedEvents(prev => ({ ...prev, [`social-evo-${recordId}`]: true }));
    } catch (error: any) {
      alert(error?.message || 'Não foi possível abrir o registro sigiloso.');
    } finally {
      setUnlockingRecordId(null);
    }
  };

  const handleGeneratePDF = async () => {
    if (isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    // Permite que o React atualize o botão antes do processamento síncrono mais pesado do jsPDF.
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    try {
      const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // A área útil precisa respeitar o cabeçalho/título aplicado posteriormente por
    // addPdfHeaderAndFooter e também o rodapé fixo do relatório.
    const CONTENT_TOP = 60;
    const CONTENT_BOTTOM = 278;
    const LEFT = 14;
    const TEXT_WIDTH = pageWidth - 28;
    const LINE_HEIGHT = 5;

    let yPos = CONTENT_TOP;

    const addContentPage = () => {
      doc.addPage();
      yPos = CONTENT_TOP;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (yPos + requiredHeight > CONTENT_BOTTOM) addContentPage();
    };

    const writeWrappedText = (
      value: string,
      options?: { font?: 'normal' | 'bold' | 'italic'; size?: number; color?: [number, number, number] }
    ) => {
      const text = String(value || '').trim();
      if (!text) return;

      doc.setFont('helvetica', options?.font || 'normal');
      doc.setFontSize(options?.size || 9);
      const color = options?.color || [0, 0, 0];
      doc.setTextColor(color[0], color[1], color[2]);

      const lines = doc.splitTextToSize(text, TEXT_WIDTH) as string[];
      lines.forEach((line) => {
        ensureSpace(LINE_HEIGHT);
        doc.text(line, LEFT, yPos);
        yPos += LINE_HEIGHT;
      });
    };

    const safeValue = (value: any, fallback = 'Não informado') => {
      if (value === undefined || value === null || String(value).trim() === '') return fallback;
      return String(value);
    };

    filteredEvents.forEach((ev) => {
      // Evita deixar apenas o cabeçalho do registro no final da página.
      ensureSpace(22);

      writeWrappedText(
        `${ev.date} ${ev.time ? `- ${ev.time}` : ''} | ${ev.competence} - ${ev.type}`,
        { font: 'bold', size: 11, color: [0, 76, 153] }
      );

      writeWrappedText(`Profissional: ${safeValue(ev.professional)}`, {
        size: 9,
        color: [100, 100, 100]
      });
      yPos += 1;

      // Mesmo conteúdo do cartão da timeline; nunca buscar outro registro pela data.
      if (ev.isConfidential) {
        writeWrappedText('[Registro sigiloso do Serviço Social — conteúdo protegido.]', { size: 9 });
      } else if (ev.isPrivate && currentUser.role !== 'admin' && currentUser.role !== 'psicologia') {
        writeWrappedText('Conteúdo restrito à Psicologia', { size: 9 });
      } else {
        writeWrappedText(textFromNode(ev.fullContent) || ev.summary, { size: 9 });
      }

      // Separador do registro, sempre dentro da área útil.
      ensureSpace(8);
      yPos += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(LEFT, yPos, pageWidth - LEFT, yPos);
      yPos += 5;
    });

    await addPdfHeaderAndFooter(doc, settings, 'Prontuário Multidisciplinar');

      addPdfSignatureNode(doc);
      doc.save(`Prontuario_Multidisciplinar_${resident.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF do prontuário multidisciplinar:', error);
      alert('Não foi possível gerar o PDF do prontuário multidisciplinar.');
    } finally {
      setIsGeneratingPdf(false);
    }
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
          disabled={isGeneratingPdf}
          className="px-4 py-2 bg-[#004c99] text-white rounded-lg font-black text-xs uppercase hover:bg-blue-800 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          <Printer size={16} />
          {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
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
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Mês/Ano</label>
          <input
            type="month"
            onChange={(e) => {
              const value = e.target.value;
              if (!value) {
                setFilterStartDate('');
                setFilterEndDate('');
                return;
              }
              const [year, month] = value.split('-');
              const lastDay = new Date(Number(year), Number(month), 0).getDate();
              setFilterStartDate(`${year}-${month}-01`);
              setFilterEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
            }}
            className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#004c99] outline-none"
            title="Atalho para preencher o período mensal"
          />
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
        <div className="w-full border-t pt-3 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold">Tipos de registro</span>
            <button type="button" className="text-xs text-blue-700 underline" onClick={() => setSelectedCategories(selectedCategories.length === CATEGORIES.length ? [] : CATEGORIES.map(([key]) => key))}>
              {selectedCategories.length === CATEGORIES.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map(([key, label]) => <label key={key} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={selectedCategories.includes(key)} onChange={e => setSelectedCategories(prev => e.target.checked ? [...prev, key] : prev.filter(item => item !== key))} />
              {label}
            </label>)}
          </div>
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
                
                <div className={`${ev.isConfidential ? 'bg-slate-50/70 border-slate-300 opacity-90' : 'bg-white border-gray-200'} border rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>
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
                        <div className="flex items-center gap-1"><Calendar size={14} /> {formatLocalDate(ev.date)}</div>
                        {ev.time && <div className="flex items-center gap-1"><Clock size={14} /> {ev.time}</div>}
                        <div className="flex items-center gap-1"><User size={14} /> {ev.professional}</div>
                      </div>
                    </div>
                    {ev.isConfidential ? (
                      canUnlockSocialConfidential && !unlockedSocialRecords[ev.recordId || ''] ? (
                        <button type="button"
                          onClick={() => handleUnlockSocialRecord(ev.recordId)}
                          disabled={unlockingRecordId === ev.recordId}
                          className="text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase disabled:opacity-50"
                        >
                          <Lock size={16} /> {unlockingRecordId === ev.recordId ? 'Validando...' : 'Visualizar registro'}
                        </button>
                      ) : unlockedSocialRecords[ev.recordId || ''] ? (
                        <button type="button" onClick={() => toggleExpand(ev.id)}
                          className="text-[#004c99] hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase">
                          <Eye size={16} /> {isExpanded ? 'Ocultar' : 'Ver conteúdo'}
                        </button>
                      ) : (
                        <span className="text-slate-500 p-2 flex items-center gap-2 text-xs font-bold uppercase"><Lock size={16} /> Protegido</span>
                      )
                    ) : (
                      <button type="button" 
                        onClick={() => toggleExpand(ev.id)}
                        className="text-[#004c99] hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase"
                      >
                        {isExpanded ? (
                          <><ChevronUp size={16} /> Ocultar</>
                        ) : (
                          <><ChevronDown size={16} /> Ver completo</>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Event Content */}
                  <div className="p-4">
                    {ev.isConfidential ? (
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                        <Lock className="text-slate-500 shrink-0 mt-0.5" size={18} />
                        <div className="w-full">
                          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-1">Registro sigiloso — Serviço Social</h4>
                          {unlockedSocialRecords[ev.recordId || ''] && isExpanded ? (
                            <div className="space-y-2 text-sm text-slate-800 mt-3">
                              <p><strong>Relato da Intervenção:</strong> {unlockedSocialRecords[ev.recordId || ''].description}</p>
                              {unlockedSocialRecords[ev.recordId || ''].referrals && <p><strong>Encaminhamentos / Providências:</strong> {unlockedSocialRecords[ev.recordId || ''].referrals}</p>}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-600 font-medium">Conteúdo protegido. Autenticação necessária para visualização.</p>
                          )}
                        </div>
                      </div>
                    ) : ev.isPrivate && currentUser.role !== 'admin' && currentUser.role !== 'psicologia' ? (
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

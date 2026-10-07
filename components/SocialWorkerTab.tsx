import React, { useEffect, useState } from 'react';
import { Resident, SocialWorkData, SocialWorkEvolution, SocialWorkActionType, MuralMessage, InstitutionSettings } from '../types';
import { 
  FileSearch, 
  Plus, 
  Save, 
  Printer, 
  MessageSquare, 
  Phone, 
  Home, 
  Users, 
  UserCheck, 
  Share2, 
  CreditCard, 
  FileText, 
  ClipboardList, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  Send, 
  Search,
  Filter,
  Info,
  X,
  Volume2,
  Lock,
  Eye
} from 'lucide-react';
import { getLocalDateString, formatDateToBR } from '../lib/utils';
import {
  getProfessionalSignature,
  saveSocialWorkRecord,
  updateSocialWorkRecord,
  deleteSocialWorkRecord,
  createSocialWorkReauthToken,
  unlockConfidentialSocialRecord
} from '../lib/api';
import { getHtmlPrintHeader, getHtmlPrintStyles, getHtmlPrintFooter, printHtml } from '../lib/pdfHelpers';

interface SocialWorkerTabProps {
  resident: Resident;
  settings?: InstitutionSettings;
  onChange: (data: SocialWorkData) => void;
  residents?: Resident[];
  onSaveResident?: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const ACTION_TYPE_CONFIG: Record<SocialWorkActionType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  atendimento_individual: {
    label: 'Atendimento Individual',
    icon: UserCheck,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  contato_familia: {
    label: 'Contato com Família / Resp.',
    icon: Users,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  visita_domiciliar: {
    label: 'Visita Domiciliar / Social',
    icon: Home,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  },
  articulacao_rede: {
    label: 'Articulação com a Rede (CRAS/CREAS/SUS)',
    icon: Share2,
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200'
  },
  gestao_beneficios: {
    label: 'Benefícios (BPC/INSS/CadÚnico)',
    icon: CreditCard,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200'
  },
  documentacao: {
    label: 'Regularização Documental',
    icon: FileText,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  },
  pia_social: {
    label: 'Plano Indiv. Atendimento (PIA)',
    icon: ClipboardList,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  },
  reuniao_equipe: {
    label: 'Estudo de Caso / Equipe',
    icon: MessageSquare,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200'
  },
  outro: {
    label: 'Outra Ação Social',
    icon: FileSearch,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200'
  }
};

export default function SocialWorkerTab({
  resident,
  settings,
  onChange
}: SocialWorkerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'acoes' | 'novo' | 'notificacao'>('acoes');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterVisibility, setFilterVisibility] = useState<string>('todos');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [evolutions, setEvolutions] = useState<SocialWorkEvolution[]>(resident.socialWork?.evolutions || []);
  const [unlockedRecords, setUnlockedRecords] = useState<Record<string, { description: string; referrals: string }>>({});
  const [unlockTarget, setUnlockTarget] = useState<SocialWorkEvolution | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const makeInitialForm = (): Partial<SocialWorkEvolution> => {
    const prof = getProfessionalSignature();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return {
      date: getLocalDateString(),
      time: timeStr,
      type: 'atendimento_individual',
      subtype: 'conversation',
      title: '',
      description: '',
      referrals: '',
      targetPersonOrEntity: '',
      contactPhone: '',
      professionalName: prof.profissionalNome || 'Assistente Social',
      professionalRole: prof.profissionalFuncao || 'Serviço Social',
      cress: prof.profissionalRegistro || '',
      professionalSignature: prof.profissionalAssinaturaTexto || '',
      visibility: 'institutional',
      postToMural: true
    };
  };

  const [formData, setFormData] = useState<Partial<SocialWorkEvolution>>(makeInitialForm);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setEvolutions(resident.socialWork?.evolutions || []);
    setUnlockedRecords({});
    setEditingId(null);
  }, [resident.id, resident.socialWork?.evolutions]);

  const activeRelatives = (resident.relatives || []).filter(r => !r.deceased);
  const responsible = activeRelatives.find(r => r.isResponsible) || activeRelatives[0];

  const resetForm = () => {
    setFormData(makeInitialForm());
    setEditingId(null);
  };

  const handleStartNew = () => {
    resetForm();
    setActiveSubTab('novo');
  };

  const isConfidential = (evo: SocialWorkEvolution) => evo.visibility === 'confidential';

  const getVisibleContent = (evo: SocialWorkEvolution) => {
    if (!isConfidential(evo)) {
      return { description: evo.description || '', referrals: evo.referrals || '' };
    }
    return unlockedRecords[evo.id] || null;
  };

  const handleStartEdit = (evo: SocialWorkEvolution) => {
    const unlocked = getVisibleContent(evo);
    if (isConfidential(evo) && !unlocked) {
      setUnlockTarget(evo);
      setUnlockPassword('');
      setUnlockError('Desbloqueie o registro antes de editá-lo.');
      return;
    }

    setEditingId(evo.id);
    setFormData({
      ...evo,
      description: unlocked?.description || evo.description || '',
      referrals: unlocked?.referrals || evo.referrals || ''
    });
    setActiveSubTab('novo');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro do Serviço Social?')) return;

    try {
      const result = await deleteSocialWorkRecord(resident.id, id);
      const nextSocialWork = result?.socialWork || { ...(resident.socialWork || {}), evolutions: evolutions.filter(e => e.id !== id) };
      setEvolutions(nextSocialWork.evolutions || []);
      onChange(nextSocialWork);
      setUnlockedRecords(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setFeedbackMsg('Registro excluído com sucesso!');
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir registro.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const description = formData.description?.trim() || '';
    if (!description) {
      alert('Por favor, descreva o atendimento realizado.');
      return;
    }

    const type: SocialWorkActionType = editingId && formData.type
      ? formData.type
      : (formData.type === 'contato_familia' ? 'contato_familia' : 'atendimento_individual');
    const visibility = formData.visibility === 'confidential' ? 'confidential' : 'institutional';

    const payload = {
      institutionId: resident.institutionId,
      residentId: resident.id,
      date: formData.date || getLocalDateString(),
      time: formData.time || '',
      type,
      subtype: type === 'atendimento_individual' ? formData.subtype : undefined,
      title: formData.title?.trim() || (type === 'contato_familia' ? 'Atendimento Familiar' : 'Atendimento Individual'),
      description,
      referrals: formData.referrals?.trim() || '',
      targetPersonOrEntity: formData.targetPersonOrEntity?.trim() || '',
      contactPhone: formData.contactPhone?.trim() || '',
      visibility
    };

    try {
      const result = editingId
        ? await updateSocialWorkRecord(editingId, payload)
        : await saveSocialWorkRecord(payload);

      const nextSocialWork = result?.socialWork || { ...(resident.socialWork || {}), evolutions: [] };
      const nextEvolutions = nextSocialWork.evolutions || [];
      setEvolutions(nextEvolutions);
      onChange(nextSocialWork);

      if (visibility === 'confidential' && result?.record?.id) {
        setUnlockedRecords(prev => ({
          ...prev,
          [result.record.id]: { description, referrals: payload.referrals }
        }));
      }

      setFeedbackMsg(editingId ? 'Atendimento atualizado com sucesso!' : 'Atendimento registrado no prontuário!');
      setTimeout(() => setFeedbackMsg(null), 3500);
      resetForm();
      setActiveSubTab('acoes');
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar atendimento.');
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockTarget || !unlockPassword) return;

    setIsUnlocking(true);
    setUnlockError('');
    try {
      const reauthToken = await createSocialWorkReauthToken(unlockPassword);
      const content = await unlockConfidentialSocialRecord(resident.id, unlockTarget.id, reauthToken);
      setUnlockedRecords(prev => ({
        ...prev,
        [unlockTarget.id]: {
          description: content?.description || '',
          referrals: content?.referrals || ''
        }
      }));
      setUnlockTarget(null);
      setUnlockPassword('');
    } catch (err: any) {
      setUnlockError(err?.message || 'Não foi possível desbloquear o registro.');
      setUnlockPassword('');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handlePrintSingleAction = async (evo: SocialWorkEvolution) => {
    const config = ACTION_TYPE_CONFIG[evo.type] || ACTION_TYPE_CONFIG.outro;
    const unlocked = getVisibleContent(evo);
    const printDescription = isConfidential(evo) && !unlocked
      ? '[CONTEÚDO SIGILOSO - PROTEGIDO POR SIGILO PROFISSIONAL]'
      : (unlocked?.description || evo.description || '');
    const printReferrals = isConfidential(evo) && !unlocked
      ? ''
      : (unlocked?.referrals || evo.referrals || '');
    const headerHtml = await getHtmlPrintHeader(settings, "RELATÓRIO DE AÇÃO DO SERVIÇO SOCIAL");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ação Social - ${resident.name}</title>
          <style>${getHtmlPrintStyles()}</style>
        </head>
        <body>
          ${headerHtml}

          <h2 class="section-title">1. Identificação do Idoso(a)</h2>
          <div class="flex-row">
            <div class="flex-col-full field">
              <span class="label">Nome Completo:</span>
              <span class="value" style="font-weight: 800; font-size: 14px;">${resident.name}</span>
            </div>
          </div>
          <div class="flex-row">
            <div class="flex-col field">
              <span class="label">Data de Nascimento:</span>
              <span class="value">${formatDateToBR(resident.birthDate)}</span>
            </div>
            <div class="flex-col field">
              <span class="label">CPF:</span>
              <span class="value">${resident.cpf || '-'}</span>
            </div>
            <div class="flex-col field">
              <span class="label">Quarto / Leito:</span>
              <span class="value">${resident.room || '-'} / ${resident.bedNumber || '-'}</span>
            </div>
          </div>

          <h2 class="section-title">2. Detalhes da Ação / Atendimento Social</h2>
          <div class="flex-row">
            <div class="flex-col field">
              <span class="label">Data:</span>
              <span class="value">${formatDateToBR(evo.date)}</span>
            </div>
            <div class="flex-col field">
              <span class="label">Horário:</span>
              <span class="value">${evo.time || '-'}</span>
            </div>
            <div class="flex-col field">
              <span class="label">Tipo de Ação:</span>
              <span class="value" style="font-weight: bold; color: #004c99;">${config.label}</span>
            </div>
          </div>
          <div class="flex-row">
            <div class="flex-col-full field">
              <span class="label">Assunto / Título:</span>
              <span class="value" style="font-weight: 700;">${evo.title}</span>
            </div>
          </div>
          ${evo.targetPersonOrEntity ? `
          <div class="flex-row">
            <div class="flex-col field">
              <span class="label">Familiar Contatado / Órgão ou Rede:</span>
              <span class="value">${evo.targetPersonOrEntity}</span>
            </div>
            ${evo.contactPhone ? `
            <div class="flex-col field">
              <span class="label">Telefone de Contato:</span>
              <span class="value">${evo.contactPhone}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}

          <h2 class="section-title">3. Relato da Intervenção Social</h2>
          <div class="paragraph" style="white-space: pre-wrap; line-height: 1.6; text-align: justify;">
            ${printDescription}
          </div>

          ${printReferrals ? `
          <h2 class="section-title">4. Encaminhamentos e Providências</h2>
          <div class="paragraph" style="white-space: pre-wrap; line-height: 1.6; background-color: #f8fafc; padding: 12px; border-left: 3px solid #004c99; font-weight: 500;">
            ${printReferrals}
          </div>
          ` : ''}

          <div class="signature-box" style="margin-top: 40px;">
            <div class="signature-line">
              ${evo.professionalName || 'Assistente Social'}<br/>
              ${evo.professionalRole || 'Serviço Social'}${evo.cress ? ` - CRESS: ${evo.cress}` : ''}
            </div>
            <div class="signature-role" style="margin-top: 5px;">
              Emitido em ${formatDateToBR(new Date())}
            </div>
          </div>

          ${getHtmlPrintFooter()}
        </body>
      </html>
    `;

    printHtml(html);
  };

  const handlePrintFullHistory = async () => {
    if (evolutions.length === 0) {
      alert('Não há registros de ações sociais para imprimir.');
      return;
    }

    const headerHtml = await getHtmlPrintHeader(settings, "PRONTUÁRIO SOCIAL - HISTÓRICO DE ATENDIMENTOS E EVOLUÇÕES");

    const rowsHtml = evolutions.map((evo, idx) => {
      const config = ACTION_TYPE_CONFIG[evo.type] || ACTION_TYPE_CONFIG.outro;
      return `
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 800; font-size: 13px; color: #004c99;">
              #${evolutions.length - idx} • ${formatDateToBR(evo.date)} ${evo.time ? `às ${evo.time}` : ''} - ${evo.title}
            </span>
            <span style="background-color: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              ${config.label}
            </span>
          </div>
          ${evo.targetPersonOrEntity ? `
            <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
              <strong>Envolvido / Contato:</strong> ${evo.targetPersonOrEntity} ${evo.contactPhone ? `(${evo.contactPhone})` : ''}
            </div>
          ` : ''}
          <div style="font-size: 12px; line-height: 1.5; color: #1e293b; margin-top: 6px; white-space: pre-wrap;">
            <strong>Relato:</strong> ${evo.visibility === 'confidential' ? '[REGISTRO SIGILOSO - CONTEÚDO NÃO INCLUÍDO NO HISTÓRICO GERAL]' : (evo.description || '')}
          </div>
          ${evo.visibility !== 'confidential' && evo.referrals ? `
            <div style="font-size: 11px; line-height: 1.4; color: #0f172a; margin-top: 6px; background-color: #f8fafc; padding: 6px 8px; border-left: 2px solid #004c99;">
              <strong>Encaminhamentos:</strong> ${evo.referrals}
            </div>
          ` : ''}
          <div style="font-size: 10px; color: #64748b; margin-top: 6px; text-align: right;">
            Registrado por: <strong>${evo.professionalName || 'Assistente Social'}</strong> ${evo.cress ? `(CRESS: ${evo.cress})` : ''}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prontuário Social - ${resident.name}</title>
          <style>${getHtmlPrintStyles()}</style>
        </head>
        <body>
          ${headerHtml}

          <h2 class="section-title">1. Identificação do Idoso(a)</h2>
          <div class="flex-row">
            <div class="flex-col-full field">
              <span class="label">Nome Completo:</span>
              <span class="value" style="font-weight: 800; font-size: 14px;">${resident.name}</span>
            </div>
          </div>
          <div class="flex-row">
            <div class="flex-col field">
              <span class="label">Data de Nascimento:</span>
              <span class="value">${formatDateToBR(resident.birthDate)}</span>
            </div>
            <div class="flex-col field">
              <span class="label">Data de Admissão:</span>
              <span class="value">${formatDateToBR(resident.admissionDate)}</span>
            </div>
            <div class="flex-col field">
              <span class="label">Quarto / Leito:</span>
              <span class="value">${resident.room || '-'} / ${resident.bedNumber || '-'}</span>
            </div>
          </div>

          <h2 class="section-title">2. Histórico Cronológico de Atendimentos e Intervenções Sociais</h2>
          <div style="margin-top: 10px;">
            ${rowsHtml}
          </div>

          <div class="signature-box" style="margin-top: 30px;">
            <div class="signature-line">
              Serviço Social - SSVP
            </div>
            <div class="signature-role" style="margin-top: 5px;">
              Documento gerado em ${formatDateToBR(new Date())}
            </div>
          </div>

          ${getHtmlPrintFooter()}
        </body>
      </html>
    `;

    printHtml(html);
  };

  // WhatsApp helper
  const generateRawMessage = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const updates: string[] = [];

    // Social Work updates
    if (evolutions.length > 0) {
      const recentSocial = evolutions.filter(e => {
        const d = new Date(e.date + 'T12:00:00');
        return d >= thirtyDaysAgo;
      });
      if (recentSocial.length > 0) {
        updates.push(`*Serviço Social:*`);
        recentSocial
          .filter(e => e.visibility !== 'confidential')
          .forEach(e => {
            const summary = (e.description || 'Atendimento registrado').slice(0, 90);
            updates.push(`- ${formatDateToBR(e.date)}: *${e.title}* - ${summary}${summary.length >= 90 ? '...' : ''}`);
          });
      }
    }

    // Nutrition
    if (resident.nutrition?.evolutions) {
      const recentNutri = resident.nutrition.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentNutri.length > 0) {
        updates.push(`*Nutrição:*`);
        recentNutri.forEach(e => {
          const parts = [e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '', e.weight ? `Peso: ${e.weight}kg` : '', e.foodAcceptance ? `Aceitação: ${e.foodAcceptance}` : ''].filter(Boolean);
          updates.push(`- ${formatDateToBR(e.dataEvolucao || e.date)}: ${parts.join(', ') || 'Evolução registrada.'}`);
        });
      }
    }

    // Psychology
    if (resident.psychology?.evolutions) {
      const recentPsi = resident.psychology.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentPsi.length > 0) {
        updates.push(`*Psicologia:*`);
        recentPsi.forEach(e => {
          const parts = [
            e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',
            e.institutionalAdaptationStatus ? `Adaptação: ${e.institutionalAdaptationStatus}` : '',
            e.moodBehaviorEvolution ? `Humor: ${e.moodBehaviorEvolution}` : ''
          ].filter(Boolean);
          updates.push(`- ${formatDateToBR(e.dataEvolucao || e.date)}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }

    // Occupational Therapy
    if (resident.occupationalTherapy?.evolutions) {
      const recentTo = resident.occupationalTherapy.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentTo.length > 0) {
        updates.push(`*Terapia Ocupacional:*`);
        recentTo.forEach(e => {
          const parts = [
            e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',
            e.functionalEvolution ? `Evolução: ${e.functionalEvolution}` : '', 
            e.participationEvolution ? `Participação: ${e.participationEvolution}` : ''
          ].filter(Boolean);
          updates.push(`- ${formatDateToBR(e.dataEvolucao || e.date)}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }

    // Physiotherapy
    if (resident.physiotherapy?.evolutions) {
      const recentFisio = resident.physiotherapy.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentFisio.length > 0) {
        updates.push(`*Fisioterapia:*`);
        recentFisio.forEach(e => {
          const parts = [
            e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',
            e.description ? `Descrição: ${e.description}` : '',
            e.treatmentResponse ? `Resposta: ${e.treatmentResponse}` : ''
          ].filter(Boolean);
          updates.push(`- ${formatDateToBR(e.dataEvolucao || e.date)}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }

    const updatesText = updates.length > 0 
      ? updates.join('\n\n') 
      : "Não houve novos registros multidisciplinares nos últimos 30 dias.";

    return `Olá${responsible?.name ? ` ${responsible.name}` : ''}! Aqui é o Serviço Social do Lar de Idosos.\n\n` +
      `Gostaríamos de compartilhar um resumo do acompanhamento do(a) residente *${resident.name}* referente aos últimos 30 dias:\n\n` +
      `📌 *Atualizações e Acompanhamento:*\n\n` +
      `${updatesText}\n\n` +
      `Seguimos à disposição para acolher qualquer dúvida ou agendar uma conversa.\n` +
      `Atenciosamente,\n*Equipe de Serviço Social*`;
  };

  const handleGeneratePreview = () => {
    if (!responsible?.phone) {
      alert("ATENÇÃO: O número de contato do familiar responsável não está preenchido no cadastro deste residente.");
      return;
    }
    setCustomMessage(generateRawMessage());
    setShowPreview(true);
  };

  const handleSendWhatsApp = () => {
    if (!responsible?.phone) return;
    const encodedMessage = encodeURIComponent(customMessage);
    const phone = responsible.phone.replace(/\D/g, '');
    const wppLink = `https://wa.me/55${phone}?text=${encodedMessage}`;
    window.open(wppLink, '_blank');
    setShowPreview(false);
  };

  // Filtered evolutions
  const filteredEvolutions = evolutions.filter(evo => {
    const visibility = evo.visibility === 'confidential' ? 'confidential' : 'institutional';
    if (filterType !== 'todos' && evo.type !== filterType) return false;
    if (filterVisibility !== 'todos' && visibility !== filterVisibility) return false;
    if (filterDateFrom && evo.date < filterDateFrom) return false;
    if (filterDateTo && evo.date > filterDateTo) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const unlocked = getVisibleContent(evo);
      const matchTitle = evo.title?.toLowerCase().includes(term);
      const matchDesc = unlocked?.description?.toLowerCase().includes(term);
      const matchRef = unlocked?.referrals?.toLowerCase().includes(term);
      const matchTarget = evo.targetPersonOrEntity?.toLowerCase().includes(term);
      if (!matchTitle && !matchDesc && !matchRef && !matchTarget) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 font-bold text-sm shadow-sm animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Header with Sub-tabs and Actions */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('acoes');
              setEditingId(null);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'acoes'
                ? 'bg-[#004c99] text-white shadow-md shadow-blue-900/20'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardList size={16} />
            <span>Ações & Atendimentos ({evolutions.length})</span>
          </button>

          <button
            type="button"
            onClick={handleStartNew}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'novo'
                ? 'bg-[#004c99] text-white shadow-md shadow-blue-900/20'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Plus size={16} />
            <span>{editingId ? 'Editar Ação Social' : 'Novo Atendimento'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('notificacao');
              setEditingId(null);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'notificacao'
                ? 'bg-[#004c99] text-white shadow-md shadow-blue-900/20'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Send size={16} />
            <span>Comunicação Familiar (WhatsApp)</span>
          </button>
        </div>

        {activeSubTab === 'acoes' && evolutions.length > 0 && (
          <button
            type="button"
            onClick={handlePrintFullHistory}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>Imprimir Histórico Social (PDF)</span>
          </button>
        )}
      </div>

      {/* SubTab 1: Lista / Histórico de Ações Sociais */}
      {activeSubTab === 'acoes' && (
        <div className="space-y-4">
          {/* Filters and Search Bar */}
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por título, relato, familiar ou encaminhamento..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#004c99] focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Filter size={16} className="text-gray-400 hidden sm:block" />
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#004c99] focus:outline-none"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="atendimento_individual">Atendimento Individual</option>
                  <option value="contato_familia">Atendimento Familiar</option>
                  {Object.entries(ACTION_TYPE_CONFIG)
                    .filter(([key]) => !['atendimento_individual', 'contato_familia'].includes(key))
                    .map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                </select>

                <select
                  value={filterVisibility}
                  onChange={e => setFilterVisibility(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#004c99] focus:outline-none"
                >
                  <option value="todos">Todas as visibilidades</option>
                  <option value="institutional">Institucional</option>
                  <option value="confidential">Sigiloso</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Período</span>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
              />
              <span className="text-[10px] font-bold text-gray-400">até</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
              />
              {(filterDateFrom || filterDateTo || filterVisibility !== 'todos' || filterType !== 'todos' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('todos');
                    setFilterVisibility('todos');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-[#004c99]"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Evolutions Timeline / Cards */}
          {filteredEvolutions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 text-[#004c99] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSearch size={28} />
              </div>
              <h3 className="text-base font-black text-gray-800 uppercase tracking-tight">
                Nenhum registro de ação social encontrado
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-6">
                {searchTerm || filterType !== 'todos'
                  ? 'Nenhum resultado corresponde aos filtros selecionados. Tente alterar o termo da busca.'
                  : 'O Serviço Social ainda não registrou intervenções ou atendimentos para este idoso. Clique no botão abaixo para adicionar.'}
              </p>
              <button
                type="button"
                onClick={handleStartNew}
                className="px-5 py-2.5 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#003d7a] transition-all shadow-md cursor-pointer"
              >
                <Plus size={16} />
                <span>Registrar Novo Atendimento</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvolutions.map((evo, index) => {
                const config = ACTION_TYPE_CONFIG[evo.type] || ACTION_TYPE_CONFIG.outro;
                const IconComponent = config.icon;
                const confidential = isConfidential(evo);
                const visibleContent = getVisibleContent(evo);
                const locked = confidential && !visibleContent;

                return (
                  <div
                    key={evo.id}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    {/* Top status bar */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-2xl ${config.bg} ${config.color} border ${config.border}`}>
                          <IconComponent size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${config.bg} ${config.color} ${config.border}`}>
                              {config.label}
                            </span>
                            {evo.postToMural && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                <Volume2 size={11} /> Mural
                              </span>
                            )}
                            {confidential && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                <Lock size={11} /> Sigiloso
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-gray-900 mt-1">
                            {evo.title}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right text-xs text-gray-500 font-bold mr-2">
                          <div className="flex items-center gap-1 text-gray-700 font-black">
                            <Calendar size={13} className="text-[#004c99]" />
                            <span>{formatDateToBR(evo.date)}</span>
                          </div>
                          {evo.time && (
                            <div className="flex items-center justify-end gap-1 text-[11px] text-gray-400">
                              <Clock size={11} />
                              <span>{evo.time}</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <button
                          type="button"
                          onClick={() => handlePrintSingleAction(evo)}
                          title="Imprimir esta ação em PDF"
                          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(evo)}
                          title="Editar registro"
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(evo.id)}
                          title="Excluir registro"
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Meta info: Target / Contact */}
                    {evo.targetPersonOrEntity && (
                      <div className="mt-3 px-3.5 py-2 bg-gray-50 rounded-2xl border border-gray-100 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-bold uppercase text-[10px]">Envolvido / Órgão:</span>
                          <span className="text-gray-900 font-bold">{evo.targetPersonOrEntity}</span>
                        </div>
                        {evo.contactPhone && (
                          <div className="flex items-center gap-1.5 text-blue-700">
                            <Phone size={12} />
                            <span>{evo.contactPhone}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Description / Relato */}
                    {locked ? (
                      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="flex items-start gap-3">
                          <Lock size={18} className="text-slate-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Registro sigiloso</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              O conteúdo é restrito ao Serviço Social e exige confirmação da sua senha de login.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUnlockTarget(evo);
                              setUnlockPassword('');
                              setUnlockError('');
                            }}
                            className="px-3 py-2 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                          >
                            <Eye size={13} /> Visualizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 text-xs font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {visibleContent?.description || evo.description || ''}
                        </div>

                        {(visibleContent?.referrals || evo.referrals) && (
                          <div className="mt-4 p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs">
                            <span className="text-[10px] font-black text-[#004c99] uppercase tracking-wider block mb-1">
                              Encaminhamentos / Providências:
                            </span>
                            <p className="text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                              {visibleContent?.referrals || evo.referrals}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Signature footer */}
                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400 font-semibold">
                      <span>
                        Registrado por: <strong className="text-gray-700">{evo.professionalName || 'Assistente Social'}</strong>
                        {evo.cress ? ` • CRESS: ${evo.cress}` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SubTab 2: Formulário de Nova / Edição de Ação Social */}
      {activeSubTab === 'novo' && (
        <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <FileSearch className="text-[#004c99]" size={20} />
                <span>{editingId ? 'Editar Ação do Serviço Social' : 'Novo Registro de Ação / Atendimento Social'}</span>
              </h3>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">
                Residente: <strong className="text-gray-800">{resident.name}</strong> • Quarto: {resident.room || '-'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveSubTab('acoes');
              }}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          {/* Data, horário e classificação do atendimento */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Data do Atendimento *</label>
              <input type="date" required value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Horário</label>
              <input type="time" value={formData.time || ''} onChange={e => setFormData({ ...formData, time: e.target.value })} className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Tipo de Atendimento *</label>
              <select
                value={formData.type || 'atendimento_individual'}
                onChange={e => setFormData({ ...formData, type: e.target.value as SocialWorkActionType, subtype: e.target.value === 'atendimento_individual' ? (formData.subtype || 'conversation') : undefined })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none"
              >
                {editingId && formData.type && !['atendimento_individual', 'contato_familia'].includes(formData.type) && (
                  <option value={formData.type}>{ACTION_TYPE_CONFIG[formData.type]?.label || 'Registro legado'}</option>
                )}
                <option value="atendimento_individual">Atendimento Individual</option>
                <option value="contato_familia">Atendimento Familiar</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Visibilidade *</label>
              <select
                value={formData.visibility || 'institutional'}
                disabled={!!editingId}
                onChange={e => {
                  const visibility = e.target.value === 'confidential' ? 'confidential' : 'institutional';
                  setFormData({ ...formData, visibility, postToMural: visibility === 'institutional' });
                }}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none disabled:opacity-60"
              >
                <option value="institutional">Institucional — vai para o mural</option>
                <option value="confidential">Sigiloso — somente Serviço Social</option>
              </select>
            </div>
          </div>

          {formData.type === 'atendimento_individual' && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Natureza do Atendimento Individual</label>
              <select value={formData.subtype || 'conversation'} onChange={e => setFormData({ ...formData, subtype: e.target.value as any })} className="w-full md:w-1/2 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none">
                <option value="conversation">Conversa / Acolhimento</option>
                <option value="specific_demand">Solução de demanda pontual</option>
              </select>
            </div>
          )}

          {formData.visibility === 'confidential' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
              <Lock size={18} className="text-slate-600 mt-0.5" />
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wide">Registro sigiloso</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">O relato e os encaminhamentos ficarão protegidos fora do documento do residente. O registro não será enviado ao mural e só poderá ser aberto por profissional do Serviço Social após confirmação de identidade.</p>
              </div>
            </div>
          )}

          {/* Title / Assunto */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider">
                Título / Assunto da Ação
              </label>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span>Sugestões rápidas:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, title: 'Entrevista Individual com o Idoso' })}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Entrevista
                </button>
                •
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, title: 'Contato / Orientação com Familiar' })}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Família
                </button>
                •
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, title: 'Revisão BPC / CadÚnico / INSS' })}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  BPC/INSS
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder="Ex.: Atendimento individual sobre convivência / Articulação com CRAS / Atualização CadÚnico"
              value={formData.title || ''}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none"
            />
          </div>

          {/* Involved Person or Entity & Contact Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Pessoa Contatada / Órgão ou Entidade Envolvida (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex.: Filha Maria (Responsável) / Assistente Social do CRAS Sul / UBS Central"
                value={formData.targetPersonOrEntity || ''}
                onChange={e => setFormData({ ...formData, targetPersonOrEntity: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Telefone de Contato (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex.: (11) 98765-4321"
                value={formData.contactPhone || ''}
                onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none"
              />
            </div>
          </div>

          {/* Description / Relato da Intervenção Social */}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
              Relato da Intervenção Social / Descrição do Atendimento *
            </label>
            <textarea
              required
              rows={5}
              placeholder="Descreva detalhadamente o atendimento realizado, escuta qualificada, demandas identificadas, orientações prestadas e situação social/familiar observada..."
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none leading-relaxed"
            />
          </div>

          {/* Referrals / Encaminhamentos */}
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
              Encaminhamentos, Providências e Próximos Passos
            </label>
            <textarea
              rows={3}
              placeholder="Ex.: Agendada visita domiciliar para a próxima semana; Solicitada 2ª via de certidão no cartório; Notificada equipe de enfermagem para acompanhamento..."
              value={formData.referrals || ''}
              onChange={e => setFormData({ ...formData, referrals: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-[#004c99] focus:outline-none leading-relaxed"
            />
          </div>

          {/* Assinatura e destino */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Profissional Responsável</span>
              <p className="text-xs font-black text-gray-800">
                {formData.professionalName || 'Assistente Social'} • {formData.professionalRole || 'Serviço Social'}
                {formData.cress ? ` • CRESS: ${formData.cress}` : ''}
              </p>
            </div>

            <div className={formData.visibility === 'confidential'
              ? "px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 bg-slate-100 text-slate-700 border-slate-200"
              : "px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 bg-amber-50 text-amber-700 border-amber-200"
            }>
              {formData.visibility === 'confidential' ? <Lock size={14} /> : <Volume2 size={14} />}
              {formData.visibility === 'confidential' ? 'Somente prontuário social sigiloso' : 'Prontuário + resumo no mural'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveSubTab('acoes');
              }}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#004c99] hover:bg-[#003d7a] text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>Salvar no Prontuário Social</span>
            </button>
          </div>
        </form>
      )}

      {/* SubTab 3: Notificação / WhatsApp Familiar */}
      {activeSubTab === 'notificacao' && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <Send className="text-emerald-600" size={20} />
                <span>Comunicação e Atualização Familiar via WhatsApp</span>
              </h3>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">
                Gera uma mensagem consolidada com as novidades da equipe multidisciplinar e do Serviço Social para os familiares.
              </p>
            </div>
          </div>

          {/* Responsible Card */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                Familiar / Contato Responsável Cadastrado:
              </span>
              {responsible ? (
                <div className="text-xs font-bold text-gray-800 flex items-center gap-2">
                  <span>{responsible.name}</span>
                  {responsible.kinship && <span className="text-gray-500 font-normal">({responsible.kinship})</span>}
                  {responsible.phone && (
                    <span className="text-emerald-700 font-black flex items-center gap-1">
                      <Phone size={12} /> {responsible.phone}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-700 font-bold">
                  Nenhum familiar ou responsável com telefone cadastrado para este residente.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleGeneratePreview}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Gerar Mensagem de Atualização</span>
            </button>
          </div>

          {/* Message preview and editor */}
          {showPreview && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                  Prévia da Mensagem (Você pode editar antes de enviar):
                </label>
                <textarea
                  rows={10}
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Fechar Prévia
                </button>

                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Send size={15} />
                  <span>Enviar pelo WhatsApp Web / App</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {unlockTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6 bg-[#004c99] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={18} />
                <h3 className="font-black uppercase tracking-tight">Acesso Sigiloso</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUnlockTarget(null);
                  setUnlockPassword('');
                  setUnlockError('');
                }}
                className="opacity-80 hover:opacity-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="p-6 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Confirme sua própria senha de login para visualizar este registro do Serviço Social.
              </p>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sua senha</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={e => setUnlockPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                  className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
                />
                {unlockError && <p className="text-xs font-bold text-red-600 mt-2">{unlockError}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockTarget(null);
                    setUnlockPassword('');
                    setUnlockError('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="px-5 py-2 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase disabled:opacity-60"
                >
                  {isUnlocking ? 'Confirmando...' : 'Desbloquear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

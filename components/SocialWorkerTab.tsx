import React, { useState } from 'react';
import { Resident } from '../types';
import { Search, Save, AlertTriangle, Plus, FileText, Send } from 'lucide-react';

interface SocialWorkerTabProps {
  resident: Resident;
  onChange: (data: any) => void;
}

export default function SocialWorkerTab({ resident, onChange }: SocialWorkerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'evolucao' | 'notificacao'>('evolucao');
  const [showPreview, setShowPreview] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  const responsible = resident.relatives?.find(r => r.isResponsible) || resident.relatives?.[0];

  const generateRawMessage = () => {
    // 1. Calculate dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDt = (d: Date) => d.toLocaleDateString('pt-BR');

    // 2. Gather updates
    const updates: string[] = [];

    // Nutrition
    if (resident.nutrition?.evolutions) {
      const recentNutri = resident.nutrition.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentNutri.length > 0) {
        updates.push(`*Nutrição (Evoluções):*`);
        recentNutri.forEach(e => {
            const parts = [e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '', e.weight ? `Peso: ${e.weight}kg` : '', e.foodAcceptance ? `Aceitação: ${e.foodAcceptance}` : ''].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.dataEvolucao || e.date))}: ${parts.join(', ') || 'Evolução registrada.'}`);
        });
      }
    }


    // Psychology
    if (resident.psychology?.evolutions) {
      const recentPsi = resident.psychology.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentPsi.length > 0) {
        updates.push(`*Psicologia (Evoluções):*`);
        recentPsi.forEach(e => {
            const parts = [
                e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',
                e.institutionalAdaptationStatus ? `Adaptação: ${e.institutionalAdaptationStatus}` : '',
                e.moodBehaviorEvolution ? `Humor: ${e.moodBehaviorEvolution}` : ''
            ].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.dataEvolucao || e.date))}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }

    
    // Occupational Therapy
    if (resident.occupationalTherapy?.evolutions) {
      const recentTo = resident.occupationalTherapy.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentTo.length > 0) {
        updates.push(`*Terapia Ocupacional (Evoluções):*`);
        recentTo.forEach(e => {
            const parts = [
                e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',
                e.functionalEvolution ? `Evolução Funcional: ${e.functionalEvolution}` : '', 
                e.participationEvolution ? `Participação: ${e.participationEvolution}` : ''
            ].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.dataEvolucao || e.date))}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }


    // Physiotherapy
    if (resident.physiotherapy?.evolutions) {
      const recentFisio = resident.physiotherapy.evolutions.filter(e => new Date(e.dataEvolucao || e.date) >= thirtyDaysAgo);
      if (recentFisio.length > 0) {
        updates.push(`*Fisioterapia (Evoluções):*`);
        recentFisio.forEach(e => {
            const parts = [
                e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',
                e.description ? `Descrição: ${e.description}` : '',
                e.treatmentResponse ? `Resposta: ${e.treatmentResponse}` : ''
            ].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.dataEvolucao || e.date))}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }

    const updatesText = updates.length > 0 
      ? updates.join('\n\n') 
      : "Não houve novos registros multidisciplinares selecionados para notificação nos últimos 30 dias.";

    return `Olá! Aqui é a Assistente Social do SSVP.\n\n` +
      `Gostaria de atualizar sobre o/a residente *${resident.name}* \n` +
      `Referente ao período de: ${formatDt(thirtyDaysAgo)} a ${formatDt(today)}\n\n` +
      `📌 *Atualizações Recentes:*\n\n` +
      `${updatesText}\n\n` +
      `Para mais detalhes, estamos à disposição no horário de atendimento.\n` +
      `Abraços, equipe SSVP.`;
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

  return (
    <div className="space-y-6">
      <div className="p-2">
        <div className="text-center py-10">
          <p className="text-sm font-bold text-gray-400 uppercase">
            As funcionalidades de Evolução Social serão implementadas aqui.
          </p>
        </div>
      </div>
    </div>
  );
}

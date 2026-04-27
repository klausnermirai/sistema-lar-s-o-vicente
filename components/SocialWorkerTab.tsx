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
      const recentNutri = resident.nutrition.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentNutri.length > 0) {
        updates.push(`*Nutrição (Evoluções):*`);
        recentNutri.forEach(e => {
            const parts = [e.weight ? `Peso: ${e.weight}kg` : '', e.foodAcceptance ? `Aceitação: ${e.foodAcceptance}` : ''].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.date))}: ${parts.join(', ') || 'Evolução registrada.'}`);
        });
      }
    }
    if (resident.nutrition?.attendances) {
      const notifyFamilyNutriAttes = resident.nutrition.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyNutriAttes.length > 0) {
         updates.push(`*Nutrição (Atendimentos):*`);
         notifyFamilyNutriAttes.forEach(a => {
            updates.push(`- ${formatDt(new Date(a.dateTime))}: ${a.reason}\n  Detalhes: ${a.notes || 'Sem registro detalhado'}`);
         });
      }
    }

    // Psychology
    if (resident.psychology?.evolutions) {
      const recentPsi = resident.psychology.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentPsi.length > 0) {
        updates.push(`*Psicologia (Evoluções):*`);
        recentPsi.forEach(e => {
            const parts = [
                e.institutionalAdaptationStatus ? `Adaptação: ${e.institutionalAdaptationStatus}` : '',
                e.moodBehaviorEvolution ? `Humor: ${e.moodBehaviorEvolution}` : ''
            ].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.date))}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }
    if (resident.psychology?.attendances) {
      const notifyFamilyPsiAttes = resident.psychology.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyPsiAttes.length > 0) {
         updates.push(`*Psicologia (Atendimentos):*`);
         notifyFamilyPsiAttes.forEach(a => {
            updates.push(`- ${formatDt(new Date(a.dateTime))}: ${a.interventionType}\n  Detalhes: ${a.attendanceEvolution || 'Sem registro detalhado'}`);
         });
      }
    }
    
    // Occupational Therapy
    if (resident.occupationalTherapy?.evolutions) {
      const recentTo = resident.occupationalTherapy.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentTo.length > 0) {
        updates.push(`*Terapia Ocupacional (Evoluções):*`);
        recentTo.forEach(e => {
            const parts = [
                e.functionalEvolution ? `Evolução Funcional: ${e.functionalEvolution}` : '', 
                e.participationEvolution ? `Participação: ${e.participationEvolution}` : ''
            ].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.date))}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }
    if (resident.occupationalTherapy?.attendances) {
      const notifyFamilyToAttes = resident.occupationalTherapy.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyToAttes.length > 0) {
         updates.push(`*T.O. (Atendimentos):*`);
         notifyFamilyToAttes.forEach(a => {
            updates.push(`- ${formatDt(new Date(a.dateTime))}: ${a.attendanceType}\n  Detalhes: ${a.attendanceEvolution || 'Sem registro detalhado'}`);
         });
      }
    }

    // Physiotherapy
    if (resident.physiotherapy?.evolutions) {
      const recentFisio = resident.physiotherapy.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentFisio.length > 0) {
        updates.push(`*Fisioterapia (Evoluções):*`);
        recentFisio.forEach(e => {
            const parts = [
                e.description ? `Descrição: ${e.description}` : '',
                e.treatmentResponse ? `Resposta: ${e.treatmentResponse}` : ''
            ].filter(Boolean);
            updates.push(`- ${formatDt(new Date(e.date))}: ${parts.join(' | ') || 'Evolução registrada.'}`);
        });
      }
    }
    if (resident.physiotherapy?.attendances) {
      const notifyFamilyFisioAttes = resident.physiotherapy.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyFisioAttes.length > 0) {
         updates.push(`*Fisioterapia (Atendimentos):*`);
         notifyFamilyFisioAttes.forEach(a => {
            updates.push(`- ${formatDt(new Date(a.dateTime))}: ${a.attendanceType}\n  Detalhes: ${a.attendanceEvolution || 'Sem registro detalhado'}`);
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
      <div className="flex border-b overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('evolucao')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'evolucao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Evolução
        </button>
        <button
          onClick={() => setActiveSubTab('notificacao')}
          className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeSubTab === 'notificacao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Notificação Familiar
        </button>
      </div>

      <div className="p-2">
        {activeSubTab === 'evolucao' && (
          <div className="text-center py-10">
            <p className="text-sm font-bold text-gray-400 uppercase">
              As funcionalidades de Evolução Social serão implementadas aqui.
            </p>
          </div>
        )}

        {activeSubTab === 'notificacao' && (
          <div className="space-y-6 bg-green-50 p-6 rounded-2xl border border-green-100">
            <div className="flex items-start gap-4">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm shrink-0">
                 <Send size={24} />
               </div>
               <div className="space-y-4 flex-1">
                 <div>
                   <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Contato com Familiar (WhatsApp)</h3>
                   <p className="text-xs text-gray-600 mt-1">
                     Gere uma prévia da mensagem com o resumo das atualizações de saúde e multidisciplinares dos últimos 30 dias para o contato responsável. Você poderá editar o texto antes de enviar.
                   </p>
                 </div>
                 
                 <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Contato do Responsável</p>
                    <p className="text-sm font-bold text-gray-800">
                      {responsible?.name || 'Não informado'} - {responsible?.phone || 'Telefone não inserido'}
                    </p>
                 </div>

                 {!showPreview ? (
                   <button
                     onClick={handleGeneratePreview}
                     className="px-6 py-3 bg-[#25D366] hover:bg-[#1ebd5b] text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all w-full md:w-auto"
                   >
                     <FileText size={16} /> Gerar Prévia da Mensagem
                   </button>
                 ) : (
                   <div className="space-y-3 bg-white p-4 rounded-xl border border-green-200 shadow-sm animate-fade-in">
                     <p className="text-[10px] font-black text-green-600 uppercase">Prévia da Mensagem (Editável)</p>
                     <textarea
                       value={customMessage}
                       onChange={(e) => setCustomMessage(e.target.value)}
                       className="w-full h-64 p-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none"
                     />
                     <div className="flex items-center gap-3 pt-2">
                       <button
                         onClick={handleSendWhatsApp}
                         disabled={!customMessage.trim()}
                         className="flex-1 py-3 bg-[#25D366] disabled:bg-gray-300 disabled:text-gray-500 hover:bg-[#1ebd5b] text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all"
                       >
                         <Send size={16} /> Enviar pelo WhatsApp
                       </button>
                       <button
                         onClick={() => setShowPreview(false)}
                         className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase flex items-center justify-center transition-all"
                       >
                         Cancelar
                       </button>
                     </div>
                   </div>
                 )}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

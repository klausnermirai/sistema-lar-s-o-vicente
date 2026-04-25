import React, { useState } from 'react';
import { Resident } from '../types';
import { Search, Save, AlertTriangle, Plus, FileText, Send } from 'lucide-react';

interface SocialWorkerTabProps {
  resident: Resident;
  onChange: (data: any) => void;
}

export default function SocialWorkerTab({ resident, onChange }: SocialWorkerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'evolucao' | 'notificacao'>('evolucao');

  // Helper function to build the family notification message
  const buildNotificationMessage = () => {
    // 1. Calculate dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDt = (d: Date) => d.toLocaleDateString('pt-BR');

    // 2. Gather updates (Nutrition, Psychology, TO, etc.)
    const updates: string[] = [];

    // This is a placeholder for dynamically picking up updates
    // In a real scenario, you'd loop through resident.nutrition.evolutions, etc.
    // and filter by the 30-day window.
    
    // Nutrition evolutions
    if (resident.nutrition?.evolutions) {
      const recentNutri = resident.nutrition.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentNutri.length > 0) {
        updates.push(`*Nutrição:* ${recentNutri.length} nova(s) evolução(ões) registradas.`);
      }
    }
    
    // Nutrition Attendances (flagged for family)
    if (resident.nutrition?.attendances) {
      const notifyFamilyNutriAttes = resident.nutrition.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyNutriAttes.length > 0) {
         updates.push(`*Atendimentos de Nutrição:* ${notifyFamilyNutriAttes.length} novo(s) atendimento(s) repassado(s).`);
         notifyFamilyNutriAttes.forEach(a => {
            updates.push(`- ${new Date(a.dateTime).toLocaleDateString('pt-BR')}: ${a.reason}`);
         });
      }
    }

    // Psychology evolutions
    if (resident.psychology?.evolutions) {
      const recentPsi = resident.psychology.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentPsi.length > 0) {
        updates.push(`*Psicologia:* ${recentPsi.length} nova(s) evolução(ões) registradas.`);
      }
    }

    // Psychology Attendances (flagged for family)
    if (resident.psychology?.attendances) {
      const notifyFamilyPsiAttes = resident.psychology.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyPsiAttes.length > 0) {
         updates.push(`*Atendimentos de Psicologia:* ${notifyFamilyPsiAttes.length} novo(s) atendimento(s) repassado(s).`);
         notifyFamilyPsiAttes.forEach(a => {
            updates.push(`- ${new Date(a.dateTime).toLocaleDateString('pt-BR')}: ${a.interventionType}`);
         });
      }
    }
    
    // Occupational Therapy evolutions
    if (resident.occupationalTherapy?.evolutions) {
      const recentTo = resident.occupationalTherapy.evolutions.filter(e => new Date(e.date) >= thirtyDaysAgo);
      if (recentTo.length > 0) {
        updates.push(`*Terapia Ocupacional:* ${recentTo.length} nova(s) evolução(ões) registradas.`);
      }
    }

    // Occupational Therapy Attendances (flagged for family)
    if (resident.occupationalTherapy?.attendances) {
      const notifyFamilyToAttes = resident.occupationalTherapy.attendances.filter(a => a.notifyFamily && new Date(a.dateTime) >= thirtyDaysAgo);
      if (notifyFamilyToAttes.length > 0) {
         updates.push(`*Atendimentos de T.O.:* ${notifyFamilyToAttes.length} novo(s) atendimento(s) repassado(s).`);
         notifyFamilyToAttes.forEach(a => {
            updates.push(`- ${new Date(a.dateTime).toLocaleDateString('pt-BR')}: ${a.attendanceType}`);
         });
      }
    }

    // Default message when no updates
    const updatesText = updates.length > 0 
      ? updates.join('\n') 
      : "Não houve novos registros multidisciplinares nos últimos 30 dias.";

    const message = `Olá! Aqui é a Assistente Social do SSVP.\n\n` +
      `Gostaria de atualizar sobre o/a residente *${resident.name}* \n` +
      `Referente ao período de: ${formatDt(thirtyDaysAgo)} a ${formatDt(today)}\n\n` +
      `📌 *Atualizações Recentes:*\n\n` +
      `${updatesText}\n\n` +
      `Para mais detalhes, estamos à disposição no horário de atendimento.\n` +
      `Abraços, equipe SSVP.`;

    const encodedMessage = encodeURIComponent(message);
    const responsible = resident.relatives?.find(r => r.isResponsible) || resident.relatives?.[0];
    const phone = responsible?.phone ? responsible.phone.replace(/\D/g, '') : '';
    
    return `https://wa.me/55${phone}?text=${encodedMessage}`;
  };

  const responsible = resident.relatives?.find(r => r.isResponsible) || resident.relatives?.[0];

  const handleSendWhatsApp = () => {
    if (!responsible?.phone) {
      alert("ATENÇÃO: O número de contato do familiar responsável não está preenchido no cadastro deste residente.");
      return;
    }
    
    const wppLink = buildNotificationMessage();
    window.open(wppLink, '_blank');
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
               <div className="space-y-2 flex-1">
                 <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Contato com Familiar (WhatsApp)</h3>
                 <p className="text-xs text-gray-600">
                   Gere e envie uma mensagem com o resumo das atualizações de saúde e multidisciplinares dos últimos 30 dias para o contato responsável do residente.
                 </p>
                 
                 <div className="bg-white p-4 rounded-xl border border-gray-200 mt-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Contato do Responsável</p>
                    <p className="text-sm font-bold text-gray-800">
                      {responsible?.name || 'Não informado'} - {responsible?.phone || 'Telefone não inserido'}
                    </p>
                 </div>

                 <button
                   onClick={handleSendWhatsApp}
                   className="mt-4 px-6 py-3 bg-[#25D366] hover:bg-[#1ebd5b] text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all w-full md:w-auto"
                 >
                   <Send size={16} /> Enviar Resumo Mensal pelo WhatsApp
                 </button>
               </div>
            </div>
            
            <div className="pt-4 border-t border-green-200">
                <p className="text-xs text-green-800 font-medium">
                  <strong>Aviso:</strong> Novas regras do que deve aparecer ou não na mensagem de notificação familiar serão adicionadas a esta seção conforme demanda.
                </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

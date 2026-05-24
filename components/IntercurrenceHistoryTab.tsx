import React, { useState } from 'react';
import { Resident, IncidentReport } from '../types';
import { AlertCircle, Clock, Plus, Save, X, MessageSquare, ChevronDown } from 'lucide-react';
import { saveMuralMessage } from '../lib/api';

interface IntercurrenceHistoryTabProps {
  resident: Resident;
  onUpdateIncidents?: (incidents: IncidentReport[]) => void;
}

const IntercurrenceHistoryTab: React.FC<IntercurrenceHistoryTabProps> = ({ resident, onUpdateIncidents }) => {
  const incidents = resident.incidents || [];
  
  const [filterPeriod, setFilterPeriod] = useState<'7_dias' | 'mes' | 'tudo'>('7_dias');
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationUser, setAnnotationUser] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredIncidents = incidents.filter(inc => {
    if (filterPeriod === 'tudo') return true;
    const now = Date.now();
    const diff = now - inc.timestamp;
    const days = diff / (1000 * 60 * 60 * 24);
    
    if (filterPeriod === '7_dias') return days <= 7;
    if (filterPeriod === 'mes') return days <= 30; // Considerando 30 dias
    
    return true;
  });

  const handleSaveAnnotation = async (incidentId: string) => {
    if (!annotationText || !annotationUser) return;
    setIsSaving(true);
    
    try {
      const newAction = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        user: annotationUser,
        text: annotationText
      };

      const updatedIncidents = incidents.map(inc => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            actions: [...(inc.actions || []), newAction]
          };
        }
        return inc;
      });

      if (onUpdateIncidents) {
        onUpdateIncidents(updatedIncidents);
      }
      
      const incident = incidents.find(i => i.id === incidentId);

      const muralMessage = {
        id: crypto.randomUUID(),
        institutionId: incident?.institutionId || resident.institutionId || '',
        author: 'Ação Intercorrência',
        authorName: annotationUser,
        authorRole: 'Coordenação/Equipe',
        text: `[Ação Intercorrência: ${incident?.type || 'Geral'}] ${resident.name}: ${annotationText}`,
        timestamp: Date.now(),
        visibilidade: ['admin', 'publico'],
        isPublic: true
      };
      
      await saveMuralMessage(muralMessage);
      
      setActiveAnnotationId(null);
      setAnnotationText('');
      setAnnotationUser('');
    } catch (e) {
      console.error('Failed to save to mural', e);
      alert('Houve um erro ao tentar enviar a anotação para o mural.');
    } finally {
      setIsSaving(false);
    }
  };

  if (incidents.length === 0) {
    return (
      <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Nenhuma intercorrência</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
          Este residente não possui nenhuma intercorrência registrada no histórico.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
            Histórico de Intercorrências
          </h3>
        </div>
        
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button 
            type="button"
            onClick={() => setFilterPeriod('7_dias')} 
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterPeriod === '7_dias' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            Últimos 7 Dias
          </button>
          <button 
            type="button"
            onClick={() => setFilterPeriod('mes')} 
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterPeriod === 'mes' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            Últimos 30 Dias
          </button>
          <button 
            type="button"
            onClick={() => setFilterPeriod('tudo')} 
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterPeriod === 'tudo' ? 'bg-[#004c99] text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            Tudo
          </button>
        </div>
      </div>

      {filteredIncidents.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 mt-4">
          <Clock size={32} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-sm font-black text-gray-600 uppercase tracking-tight">Nenhuma intercorrência no período</h3>
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent pt-4">
          {filteredIncidents.sort((a, b) => b.timestamp - a.timestamp).map((inc, index) => {
            const date = new Date(inc.timestamp);
            return (
              <div key={inc.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-red-100 text-red-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <AlertCircle size={16} />
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-3xl border shadow-sm group-hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-100">
                      {inc.type}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                      <Clock size={12} />
                      {date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-bold text-gray-800 mb-2">
                    Relatado por: {inc.professionalName || 'Equipe Enfermagem'}
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Descrição</p>
                      <p className="text-xs text-gray-700 font-medium">{inc.description}</p>
                    </div>
                    
                    {inc.conduct && (
                      <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Conduta</p>
                        <p className="text-xs text-blue-800 font-medium">{inc.conduct}</p>
                      </div>
                    )}
                    
                    {/* Ações / Anotações do Coordenador */}
                    {inc.actions && inc.actions.length > 0 && (
                      <div className="p-3 rounded-2xl border border-orange-100 bg-orange-50/50 space-y-3">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1">
                           <MessageSquare size={12} /> Ações / Anotações
                        </p>
                        {inc.actions.map((action: any) => (
                          <div key={action.id} className="bg-white p-3 rounded-xl shadow-sm border border-orange-100">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-gray-800">{action.user}</span>
                              <span className="text-[9px] font-bold text-gray-400">
                                {new Date(action.timestamp).toLocaleDateString('pt-BR')} {new Date(action.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700">{action.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeAnnotationId === inc.id ? (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-200 mt-4">
                        <h4 className="text-xs font-black uppercase tracking-tight text-gray-800 mb-2">Adicionar Ação/Anotação</h4>
                        <input
                          type="text"
                          placeholder="Seu Nome (Coordenação)"
                          value={annotationUser}
                          onChange={e => setAnnotationUser(e.target.value)}
                          className="w-full p-2 mb-2 text-xs border rounded-lg outline-none focus:border-[#004c99]"
                        />
                        <textarea
                          placeholder="Descreva a ação tomada... (Será postada no mural)"
                          value={annotationText}
                          onChange={e => setAnnotationText(e.target.value)}
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] min-h-[60px] resize-none mb-3"
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => setActiveAnnotationId(null)}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 rounded-lg transition-all"
                            disabled={isSaving}
                          >
                            Cancelar
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleSaveAnnotation(inc.id)}
                            className="px-3 py-1.5 bg-[#004c99] text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-blue-800 transition-all"
                            disabled={isSaving || !annotationText || !annotationUser}
                          >
                            <Save size={12} /> {isSaving ? 'Salvando...' : 'Salvar e Enviar p/ Mural'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => {
                          setActiveAnnotationId(inc.id);
                          setAnnotationText('');
                        }}
                        className="mt-2 w-full px-3 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all"
                      >
                        <Plus size={14} /> Adicionar Ação / Anotação
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IntercurrenceHistoryTab;

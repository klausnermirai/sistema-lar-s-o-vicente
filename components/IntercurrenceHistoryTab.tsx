import React from 'react';
import { Resident } from '../types';
import { AlertCircle, Clock } from 'lucide-react';

interface IntercurrenceHistoryTabProps {
  resident: Resident;
}

const IntercurrenceHistoryTab: React.FC<IntercurrenceHistoryTabProps> = ({ resident }) => {
  const incidents = resident.incidents || [];

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
      <div className="flex items-center gap-3 border-b pb-4">
        <AlertCircle className="text-red-600" size={24} />
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
          Histórico de Intercorrências
        </h3>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent pt-4">
        {incidents.sort((a, b) => b.timestamp - a.timestamp).map((inc, index) => {
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
                  
                  {inc.shareOnMural && (
                    <p className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded w-fit border border-green-100">
                      Compartilhado no Mural
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntercurrenceHistoryTab;

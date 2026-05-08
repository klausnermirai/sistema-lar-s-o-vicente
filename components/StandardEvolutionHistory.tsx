import React from 'react';
import { FileText, CheckCircle2, User } from 'lucide-react';

interface EvolutionItem {
  id: string;
  dataEvolucao?: string;
  date?: string; // Legacy
  descricaoEvolucao?: string;
  // Legacy descriptions usually vary per area, we will try to handle them below or rely on the parent mapping
  mudancasObservadas?: string;
  novaConduta?: string;
  newConduct?: string; // Legacy
  recomendacoes?: string;
  incluirNoPIA?: boolean;
  profissionalNome?: string;
  profissionalFuncao?: string;
  [key: string]: any; // Allow other legacy fields
}

interface StandardEvolutionHistoryProps {
  evolutions: EvolutionItem[];
  areaLabel: string;
  renderLegacyDetails?: (ev: EvolutionItem) => React.ReactNode;
}

export const StandardEvolutionHistory: React.FC<StandardEvolutionHistoryProps> = ({
  evolutions,
  areaLabel,
  renderLegacyDetails
}) => {
  if (!evolutions || evolutions.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed rounded-2xl p-8 text-center">
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
          Nenhuma evolução registrada nesta área.
        </p>
      </div>
    );
  }

  // Sort by date descending
  const sortedEvolutions = [...evolutions].sort((a, b) => {
    const d1 = new Date(b.dataEvolucao || b.date || b.criadoEm || 0).getTime();
    const d2 = new Date(a.dataEvolucao || a.date || a.criadoEm || 0).getTime();
    return d1 - d2;
  });

  return (
    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-blue-300 before:to-transparent">
      {sortedEvolutions.map((ev, index) => {
        const evDate = ev.dataEvolucao || ev.date;
        const displayDate = evDate ? new Date(evDate).toLocaleDateString('pt-BR') : 'Data não informada';
        const isIncluded = ev.incluirNoPIA ?? true; // Legacy assumes true if undefined
        
        return (
          <div key={ev.id || index} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Timeline Icon */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-[#004c99] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative">
              <FileText size={16} />
              {isIncluded && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full">
                  <CheckCircle2 size={12} className="text-green-500" title="Incluído no PIA" />
                </div>
              )}
            </div>
            
            {/* Card */}
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-2xl border shadow-sm group-hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <time className="text-[10px] uppercase font-black text-blue-800 tracking-widest bg-blue-50 px-2 py-1 rounded-md">
                  {displayDate}
                </time>
                <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border">
                  {isIncluded ? (
                    <span className="text-[9px] font-black uppercase text-green-600 tracking-widest">Aparece no PIA</span>
                  ) : (
                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Apenas Histórico</span>
                  )}
                </div>
              </div>
              
              {ev.descricaoEvolucao ? (
                <div className="mb-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{ev.descricaoEvolucao}</p>
                </div>
              ) : null}

              {ev.mudancasObservadas && (
                <div className="mt-3">
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 border-t pt-2">Mudanças Observadas</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ev.mudancasObservadas}</p>
                </div>
              )}

              {/* Legacy or explicit Conduct */}
              {(ev.novaConduta || ev.newConduct) && (
                <div className="mt-3">
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 border-t pt-2">Nova Conduta</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ev.novaConduta || ev.newConduct}</p>
                </div>
              )}

              {ev.recomendacoes && (
                <div className="mt-3">
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 border-t pt-2">Recomendações</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ev.recomendacoes}</p>
                </div>
              )}

              {renderLegacyDetails && renderLegacyDetails(ev)}

              {/* Professional Signature */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-gray-400" />
                  <span>{ev.profissionalNome || 'Profissional não identificado'}</span>
                </div>
                {ev.profissionalFuncao && <span>{ev.profissionalFuncao}</span>}
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
};

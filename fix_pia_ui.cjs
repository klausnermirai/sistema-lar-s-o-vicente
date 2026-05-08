const fs = require('fs');
let content = fs.readFileSync('components/PiaTab.tsx', 'utf8');

const uiReplacement = `
            {/* 8. Histórico de Evoluções */}
            <div className="bg-white rounded-2xl p-6 border shadow-sm mt-8">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Clock size={16} />
                </span>
                8. Histórico de Evoluções Complementares (PIA)
              </h3>
              
              <div className="space-y-6">
                {[ 
                  { area: 'Psicologia', evs: resident.psychology?.evolutions || [] },
                  { area: 'Fisioterapia', evs: resident.physiotherapy?.evolutions || [] },
                  { area: 'Nutrição', evs: resident.nutrition?.evolutions || [] },
                  { area: 'Terapia Ocupacional', evs: resident.occupationalTherapy?.evolutions || [] }
                ].map(({ area, evs }) => {
                  const piasEvs = evs.filter(e => e.incluirNoPIA !== false);
                  if (piasEvs.length === 0) return null;

                  const sorted = [...piasEvs].sort((a,b) => new Date(b.dataEvolucao || b.date || 0).getTime() - new Date(a.dataEvolucao || a.date || 0).getTime());

                  return (
                    <div key={area} className="pb-4 border-b last:border-b-0 border-gray-100">
                      <h4 className="text-xs font-black text-gray-400 border border-gray-200 uppercase tracking-widest mb-3 bg-gray-50 max-w-min whitespace-nowrap px-3 py-1 rounded-full">{area}</h4>
                      <div className="space-y-4">
                        {sorted.map(e => {
                           const dt = e.dataEvolucao || e.date;
                           const dtStr = dt ? new Date(dt).toLocaleDateString('pt-BR') : 'Sem data';
                           const txt = e.descricaoEvolucao || e.newConduct || e.functionalEvolution || e.description || 'Evolução registrada.';
                           return (
                             <div key={e.id} className="flex gap-4">
                               <span className="text-[10px] uppercase font-black text-[#004c99] tracking-widest shrink-0 mt-0.5 bg-blue-50 px-2 py-1 rounded-md">{dtStr}</span>
                               <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{txt}</p>
                             </div>
                           )
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
`;

// Insert after the end of section 7 in UI
const uiRegex = /(<\/div>\s*)(?=<\/div>\s*<\/div>\s*<\/div>\s*\)\s*;\s*\})/;

if(content.match(uiRegex)) {
  content = content.replace(uiRegex, "$1" + uiReplacement + "\n");
  fs.writeFileSync('components/PiaTab.tsx', content);
  console.log("PiaTab UI updated for evolutions!");
} else {
  console.log("Could not find boundaries");
}

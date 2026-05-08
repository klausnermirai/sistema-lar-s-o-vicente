const fs = require('fs');
let content = fs.readFileSync('components/PiaTab.tsx', 'utf8');

// For PDF: Find "// 7. Histórico de Revisões" block and add after its closing "});\n    }"
const pdfReplacement = `
    // 8. Histórico de Evoluções
    addSectionTitle('8. Histórico de Evoluções');
    const sectionsPDF = [
      { area: 'Psicologia', evs: resident.psychology?.evolutions || [] },
      { area: 'Fisioterapia', evs: resident.physiotherapy?.evolutions || [] },
      { area: 'Nutrição', evs: resident.nutrition?.evolutions || [] },
      { area: 'Terapia Ocupacional', evs: resident.occupationalTherapy?.evolutions || [] }
    ];

    let hasEvolutionsPDF = false;

    sectionsPDF.forEach(({ area, evs }) => {
      const piasEvs = evs.filter(e => e.incluirNoPIA !== false);
      if (piasEvs.length > 0) {
        hasEvolutionsPDF = true;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(area + ':', 14, yPos);
        yPos += 5;

        // Sort descending by date
        const sorted = [...piasEvs].sort((a,b) => new Date(b.dataEvolucao || b.date || 0).getTime() - new Date(a.dataEvolucao || a.date || 0).getTime());

        sorted.forEach(e => {
           checkPageBreak(15);
           const dt = e.dataEvolucao || e.date;
           const dtStr = dt ? new Date(dt).toLocaleDateString('pt-BR') : 'Sem data';
           const txt = e.descricaoEvolucao || e.newConduct || e.functionalEvolution || e.description || 'Evolução registrada.';
           
           addText('', \`\${dtStr} — \${txt}\`, false);
        });
        yPos += 3;
      }
    });

    if (!hasEvolutionsPDF) {
       addText('', 'Nenhuma evolução marcada para o PIA.', false);
    }
    yPos += 5;
`;

const pdfRegex = /(addSectionTitle\('7\. Histórico de Revisões'\);[\s\S]*?\}\s*\n)(\s*addPdfSignatureNode\(doc\);)/;
if(content.match(pdfRegex)) {
  content = content.replace(pdfRegex, "$1" + pdfReplacement + "$2");
}

// For UI: Adding to the PIA view
const uiReplacement = `
            {/* 7. Histórico de Revisão */}
            <div className="bg-white rounded-[32px] p-8 border shadow-sm col-span-1 md:col-span-2 mt-6">
              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <ClipboardList size={18} />
                </span>
                7. Histórico de Revisões
              </h3>
              
              <div className="space-y-4">
                {localPia.revisions.length === 0 ? (
                  <p className="text-sm font-bold text-gray-500 uppercase">Nenhuma revisão cadastrada.</p>
                ) : (
                  localPia.revisions.map(rev => (
                    <div key={rev.id} className="p-4 bg-gray-50 rounded-2xl border">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-white border rounded text-[10px] font-black uppercase text-gray-500">{rev.date}</span>
                        <span className="text-xs font-black text-gray-800 uppercase">{rev.author}</span>
                      </div>
                      <p className="text-sm text-gray-700">{rev.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 8. Histórico de Evoluções */}
            <div className="bg-white rounded-[32px] p-8 border shadow-sm col-span-1 md:col-span-2 mt-6">
              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </span>
                8. Histórico de Evoluções Complementares
              </h3>
              
              <div className="space-y-8">
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
                    <div key={area} className="pb-4 border-b last:border-b-0">
                      <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{area}</h4>
                      <div className="space-y-3">
                        {sorted.map(e => {
                           const dt = e.dataEvolucao || e.date;
                           const dtStr = dt ? new Date(dt).toLocaleDateString('pt-BR') : 'Sem data';
                           const txt = e.descricaoEvolucao || e.newConduct || e.functionalEvolution || e.description || 'Evolução registrada.';
                           return (
                             <div key={e.id} className="flex gap-3">
                               <span className="text-[10px] uppercase font-black text-blue-800 tracking-widest shrink-0 mt-0.5">{dtStr}</span>
                               <p className="text-sm text-gray-700 whitespace-pre-wrap">{txt}</p>
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

// Usually it's ` {/* 7. Histórico de Revisão */}` down to its closing `</div>` closing `</div>`.
const uiRegex = /\{\/\*\ 7\.\ Histórico de Revisão\ \*\/\}[\s\S]*?(?=\{\/\*\ \-\-\-\ \*\/\})/;
if(content.match(uiRegex)) {
  content = content.replace(uiRegex, uiReplacement + '\n\n          ');
} else {
  // alternative
  const uiRegex2 = /\{\/\*\ 7\.\ Histórico de Revisão\ \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*(?=<\/div>\s*<\/div>\s*<\/div>)/;
  if (content.match(uiRegex2)) {
    content = content.replace(uiRegex2, uiReplacement);
  }
}

fs.writeFileSync('components/PiaTab.tsx', content);
console.log("PiaTab updated for evolutions!");

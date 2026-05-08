const fs = require('fs');
let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

const imports = "import { StandardEvolutionForm } from './StandardEvolutionForm';\nimport { StandardEvolutionHistory } from './StandardEvolutionHistory';\n";
content = content.replace("import React, { useState } from 'react';", imports + "import React, { useState } from 'react';");

const replacement = `{activeSubTab === 'evolucao' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-blue-50/50 p-4 border rounded-2xl">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Evolução Fisioterapêutica</h3>
              <p className="text-[10px] uppercase font-bold text-gray-500 mt-1 tracking-widest">Registros de progresso</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportEvolutionPDF}
                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar Histórico
              </button>
              {!isAddingEvolution && (
                <button
                  type="button"
                  onClick={() => setIsAddingEvolution(true)}
                  className="px-4 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 shadow-xl flex items-center gap-2 transition-all"
                >
                  <Plus size={16} /> Nova Evolução
                </button>
              )}
            </div>
          </div>

          {isAddingEvolution && (
            <StandardEvolutionForm 
               areaLabel="Fisioterapêutica"
               onSave={(data) => {
                 const evolutions = resident.physiotherapy?.evolutions || [];
                 const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
                 onSaveData({
                   physiotherapy: {
                     ...(resident.physiotherapy || {}),
                     evolutions: newEvolutions as any
                   }
                 });
                 setIsAddingEvolution(false);
               }}
               onCancel={() => setIsAddingEvolution(false)}
            />
          )}

          {!isAddingEvolution && (
            <StandardEvolutionHistory 
               evolutions={(resident.physiotherapy?.evolutions as any) || []} 
               areaLabel="Fisioterapêutica" 
               renderLegacyDetails={(ev: any) => {
                 if(!ev.evolutionDescription && !ev.functionalObservations && !ev.treatmentResponse) return null;
                 return (
                   <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
                       {ev.evolutionDescription && <p className="mb-2 whitespace-pre-wrap">{ev.evolutionDescription}</p>}
                       {ev.functionalObservations && <p><strong>Observações Funcionais:</strong> {ev.functionalObservations}</p>}
                       {ev.treatmentResponse && <p><strong>Resposta ao Tratamento:</strong> {ev.treatmentResponse}</p>}
                   </div>
                 );
               }}
            />
          )}
        </div>
      )}`;

const startIndex = content.indexOf("{activeSubTab === 'evolucao' && (");
const endIndex = content.indexOf("{activeSubTab === 'atendimentos' && (");

if(startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + '\n      ' + content.substring(endIndex);
  fs.writeFileSync('components/PhysiotherapyTab.tsx', content);
  console.log("Replaced Physio successfully!");
} else {
  console.log("Could not find boundaries");
}

const fs = require('fs');
let content = fs.readFileSync('components/OccupationalTherapyTab.tsx', 'utf8');

const imports = "import { StandardEvolutionForm } from './StandardEvolutionForm';\nimport { StandardEvolutionHistory } from './StandardEvolutionHistory';\n";
content = content.replace("import React, { useState } from 'react';", imports + "import React, { useState } from 'react';");

const replacement = `{/* 2. Evolução */}
      {activeSubTab === 'evolucao' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 uppercase">Evoluções Terapêuticas</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportEvolutionPDF}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all font-black text-[10px] uppercase border"
              >
                <Printer size={14} />
                Exportar PDF
              </button>
              {!isAddingEvolution && (
                <button
                  type="button"
                  onClick={() => setIsAddingEvolution(true)}
                  className="bg-[#004c99] hover:bg-blue-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all font-black text-[10px] uppercase"
                >
                  <Plus size={14} />
                  Nova Evolução
                </button>
              )}
            </div>
          </div>

          {isAddingEvolution && (
             <StandardEvolutionForm 
                areaLabel="Terapêutica Ocupacional"
                onSave={(data) => {
                  const evolutions = resident.occupationalTherapy?.evolutions || [];
                  const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
                  onSaveData({
                    occupationalTherapy: {
                      ...(resident.occupationalTherapy || {}),
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
                evolutions={(resident.occupationalTherapy?.evolutions as any) || []} 
                areaLabel="Terapêutica Ocupacional" 
                renderLegacyDetails={(ev: any) => {
                  if(!ev.functionalEvolution && !ev.participationEvolution && !ev.currentIndependenceLevel && !ev.piaGoalStatus && !ev.evolutionDescription) return null;
                  return (
                    <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
                        {ev.evolutionDescription && <p className="mb-2 whitespace-pre-wrap">{ev.evolutionDescription}</p>}
                        {ev.functionalEvolution && <p><strong>Evolução Funcional:</strong> {ev.functionalEvolution}</p>}
                        {ev.participationEvolution && <p><strong>Participação:</strong> {ev.participationEvolution}</p>}
                        {ev.currentIndependenceLevel && <p><strong>Independência:</strong> {ev.currentIndependenceLevel}</p>}
                        {ev.piaGoalStatus && <p><strong>Status PIA:</strong> {ev.piaGoalStatus}</p>}
                    </div>
                  );
                }}
             />
          )}
        </div>
      )}`;

const startIndex = content.indexOf('{/* 2. Evolução */}');
const endIndex = content.indexOf('{/* 3. Atendimentos */}');

if(startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + '\n      ' + content.substring(endIndex);
  fs.writeFileSync('components/OccupationalTherapyTab.tsx', content);
  console.log("Replaced OT successfully!");
} else {
  console.log("Could not find boundaries");
}

import * as fs from 'fs';

let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

const evolutionLayoutStart = '<div className="bg-white p-6 rounded-2xl border shadow-lg space-y-4">';
const evolutionLayoutEnd = '<div className="flex justify-end gap-3 pt-6 border-t mt-6">';

const newEvolutionLayout = `
<div className="bg-white p-6 rounded-2xl border shadow-lg space-y-4">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest border-b pb-4">Registrar Nova Evolução</h3>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</label>
                <input
                  type="date"
                  value={newEvolution.date}
                  onChange={e => setNewEvolution({ ...newEvolution, date: e.target.value })}
                  className="w-full max-w-[200px] p-3 border rounded-xl text-xs font-bold outline-none focus:ring-2"
                />
              </div>

              <ChecklistGroup label="Situação Atual" options={currentSituationOptionsList} selected={newEvolution.currentSituationOptions} onChange={(s) => setNewEvolution({ ...newEvolution, currentSituationOptions: s })} isEditing={true} />
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição da Situação Atual</label>
                <textarea
                  value={newEvolution.evolutionDescription || ''}
                  onChange={e => setNewEvolution({ ...newEvolution, evolutionDescription: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[60px]"
                />
              </div>

              <ChecklistGroup label="Mobilidade e funcionalidade atual" options={currentMobilityOptionsList} selected={newEvolution.currentMobilityOptions} onChange={(s) => setNewEvolution({ ...newEvolution, currentMobilityOptions: s })} isEditing={true} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações funcionais</label>
                <textarea
                  value={newEvolution.functionalObservations || ''}
                  onChange={e => setNewEvolution({ ...newEvolution, functionalObservations: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[60px]"
                />
              </div>

              <ChecklistGroup label="Atualização dos objetivos para o PIA" options={piaGoalsUpdateOptionsList} selected={newEvolution.piaGoalsUpdateOptions} onChange={(s) => setNewEvolution({ ...newEvolution, piaGoalsUpdateOptions: s })} isEditing={true} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Objetivos atualizados</label>
                <textarea
                  value={newEvolution.updatedGoals || ''}
                  onChange={e => setNewEvolution({ ...newEvolution, updatedGoals: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[60px]"
                />
              </div>

              <ChecklistGroup label="Atualização da conduta" options={conductUpdateOptionsList} selected={newEvolution.conductUpdateOptions} onChange={(s) => setNewEvolution({ ...newEvolution, conductUpdateOptions: s })} isEditing={true} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conduta atualizada</label>
                <textarea
                  value={newEvolution.updatedConduct || ''}
                  onChange={e => setNewEvolution({ ...newEvolution, updatedConduct: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[60px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações finais da evolução</label>
                <textarea
                  value={newEvolution.finalObservations || ''}
                  onChange={e => setNewEvolution({ ...newEvolution, finalObservations: e.target.value })}
                  className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none transition-all min-h-[60px]"
                />
              </div>

              `;

const startIndex = content.indexOf(evolutionLayoutStart);
const endIndex = content.indexOf(evolutionLayoutEnd, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newEvolutionLayout + content.substring(endIndex);
}

fs.writeFileSync('components/PhysiotherapyTab.tsx', content);


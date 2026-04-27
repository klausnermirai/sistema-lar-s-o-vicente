import * as fs from 'fs';

let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

const handleAddEvolutionStart = 'const handleAddEvolution = () => {';
const handleAddEvolutionEnd = 'setNewEvolution({';

const handleAddEvolutionReplacement = `const handleAddEvolution = () => {
    const mainDesc = newEvolution.evolutionDescription || newEvolution.description;
    
    if (!mainDesc) {
      alert('Descrição da situação atual é obrigatória.');
      return;
    }

    const evolutionToSave: PhysiotherapyEvolution = {
      id: Date.now().toString(),
      date: newEvolution.date as string,
      description: mainDesc,
      treatmentResponse: newEvolution.updatedConduct || newEvolution.treatmentResponse || '',
      currentSituationOptions: newEvolution.currentSituationOptions,
      evolutionDescription: newEvolution.evolutionDescription,
      currentMobilityOptions: newEvolution.currentMobilityOptions,
      functionalObservations: newEvolution.functionalObservations,
      piaGoalsUpdateOptions: newEvolution.piaGoalsUpdateOptions,
      updatedGoals: newEvolution.updatedGoals,
      conductUpdateOptions: newEvolution.conductUpdateOptions,
      updatedConduct: newEvolution.updatedConduct,
      finalObservations: newEvolution.finalObservations
    };

    const newEvolutions = [...(ptData.evolutions || []), evolutionToSave];

    // Atualizar PIA automaticamente
    if (resident.pia) {
      const updatedPia = { ...resident.pia };
      
      updatedPia.goalsStatus = {
        ...updatedPia.goalsStatus,
        physiotherapy: {
          status: updatedPia.goalsStatus.physiotherapy?.status || 'Em andamento',
          reviewDate: updatedPia.goalsStatus.physiotherapy?.reviewDate || '',
          observation: \`\${updatedPia.goalsStatus.physiotherapy?.observation || ''}\\n\\nAtualização \${new Date().toLocaleDateString('pt-BR')}: \${evolutionToSave.treatmentResponse}\`
        }
      };

      onChange({
        ...ptData,
        evolutions: newEvolutions
      });
      
      onSaveResident({
        ...resident,
        physiotherapy: {
          ...ptData,
          evolutions: newEvolutions
        },
        pia: updatedPia
      });
    } else {
      onChange({
        ...ptData,
        evolutions: newEvolutions
      });
    }
    
    setIsAddingEvolution(false);
    `;

const startIndex = content.indexOf(handleAddEvolutionStart);
const endIndex = content.indexOf(handleAddEvolutionEnd, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + handleAddEvolutionReplacement + content.substring(endIndex);
}

// Ensure the form resets properly:
content = content.replace(/setNewEvolution\(\{\n[\s\S]*?treatmentResponse: ''\n[\s\S]*?\}\);/, `setNewEvolution({
      date: new Date().toISOString().split('T')[0],
      currentSituationOptions: [],
      currentMobilityOptions: [],
      piaGoalsUpdateOptions: [],
      conductUpdateOptions: []
    });`);

fs.writeFileSync('components/PhysiotherapyTab.tsx', content);

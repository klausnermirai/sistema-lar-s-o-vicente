const fs = require('fs');
let content = fs.readFileSync('components/MultidisciplinaryModule.tsx', 'utf8');

const replacement = `interface PsychologicalEvolutionSectionProps {
  resident: Resident;
  onSave: (evolutions: PsychologicalEvolution[]) => void;
}

const PsychologicalEvolutionSection: React.FC<PsychologicalEvolutionSectionProps> = ({ resident, onSave }) => {
  const [isCreating, setIsCreating] = useState(false);

  const evolutions = resident.psychology?.evolutions || [];

  if (isCreating) {
    return (
      <StandardEvolutionForm 
        areaLabel="Psicológica"
        onSave={(data) => {
          const newEvolutions = [{ id: Date.now().toString(), ...data }, ...evolutions];
          onSave(newEvolutions as any);
          setIsCreating(false);
        }}
        onCancel={() => setIsCreating(false)}
      />
    );
  }

  const renderLegacyDetails = (ev: any) => {
    if (!ev.institutionalAdaptationStatus && !ev.moodBehaviorEvolution && !ev.piaGoalStatus) return null;
    return (
      <div className="mt-3 bg-gray-50 p-3 rounded-lg border text-xs text-gray-600">
          {ev.institutionalAdaptationStatus && <p><strong>Adaptação:</strong> {ev.institutionalAdaptationStatus}</p>}
          {ev.moodBehaviorEvolution && <p><strong>Humor/Comportamento:</strong> {ev.moodBehaviorEvolution}</p>}
          {ev.piaGoalStatus && <p><strong>Status PIA:</strong> {ev.piaGoalStatus}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Evoluções</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
          >
            <Plus size={18} /> Nova Evolução
          </button>
        </div>
      </div>
      
      <StandardEvolutionHistory 
        evolutions={evolutions as any} 
        areaLabel="Psicológica" 
        renderLegacyDetails={renderLegacyDetails}
      />
    </div>
  );
};
`;

const startIndex = content.indexOf('interface PsychologicalEvolutionSectionProps {');
const endIndex = content.indexOf('interface PsychologicalAttendanceSectionProps {');

if(startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + '\n' + content.substring(endIndex);
  fs.writeFileSync('components/MultidisciplinaryModule.tsx', content);
  console.log("Replaced Psychological successfully!");
} else {
  console.log("Could not find boundaries");
}

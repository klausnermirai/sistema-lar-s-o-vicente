import * as fs from 'fs';

let content = fs.readFileSync('components/OccupationalTherapyTab.tsx', 'utf8');

const checklists = `
const adlOptionsList = ['Independente', 'Supervisão', 'Assistência leve', 'Assistência moderada', 'Assistência máxima', 'Dependente'];
const cognitiveOptionsList = ['Lúcido e orientado', 'Desorientado no tempo', 'Desorientado no espaço', 'Alteração de memória', 'Alteração de atenção', 'Agitação psicomotora'];
const motorSensoryOptionsList = ['Coordenação motora fina preservada', 'Coordenação motora global preservada', 'Déficit de preensão', 'Déficit visual', 'Déficit auditivo', 'Alteração de sensibilidade'];
const therapeuticGoalsOptionsList = ['Promover independência nas AVDs', 'Estimulação cognitiva', 'Treino de habilidades motoras corporais', 'Adequação postural', 'Prescrição de tecnologia assistiva', 'Atividades expressivas / lúdicas'];
const treatmentConductOptionsList = ['Treino de AVD', 'Oficinas terapêuticas', 'Exercícios cognitivos', 'Adaptação ambiental', 'Orientações à equipe', 'Atendimentos individuais'];

const currentSituationOptionsList = ['Mantém independência', 'Melhora na autonomia', 'Declínio funcional', 'Oscilação cognitiva'];
const piaGoalsUpdateOptionsList = ['Manter objetivos atuais', 'Alterar objetivos', 'Incluir novo objetivo', 'Encerrar objetivo alcançado'];
const conductUpdateOptionsList = ['Manter conduta', 'Modificar atividades', 'Encaminhamentos'];

const ChecklistGroup = ({ label, options, selected = [], onChange, isEditing }: { label: string, options: string[], selected?: string[], onChange: (s: string[]) => void, isEditing: boolean }) => {
  if (!isEditing && selected.length === 0) return null;
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-[#004c99] uppercase tracking-widest">{label}</label>
      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-white border rounded-xl">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer p-1 hover:bg-gray-50 rounded">
              <input type="checkbox" checked={selected.includes(opt)} onChange={(e) => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter(x => x !== opt));
              }} className="rounded border-gray-300 text-[#004c99] focus:ring-[#004c99]" />
              {opt}
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map(opt => (
            <span key={opt} className="px-3 py-1 bg-blue-50 text-[#004c99] rounded-lg text-[10px] font-bold uppercase">{opt}</span>
          ))}
        </div>
      )}
    </div>
  )
}
`;

content = content.replace(/import GroupActivityTab from '.\/GroupActivityTab';/, "import GroupActivityTab from './GroupActivityTab';\n" + checklists);

const assessmentReplacement = `  const [assessment, setAssessment] = useState<Partial<OccupationalTherapyAssessment>>(
    otData.initialAssessment || {
      date: new Date().toISOString().split('T')[0],
      adlOptions: [],
      cognitiveOptions: [],
      motorSensoryOptions: [],
      therapeuticGoalsOptions: [],
      treatmentConductOptions: []
    }
  );`;

content = content.replace(/  const \[assessment, setAssessment\] = useState<Partial<OccupationalTherapyAssessment>>\([\s\S]*?\} \|\| \{\n[\s\S]*?piaGoals: ''\n[\s\S]*?\}\n  \);/, assessmentReplacement);

const newEvolutionState = `  const [newEvolution, setNewEvolution] = useState<Partial<OccupationalTherapyEvolution>>({
    date: new Date().toISOString().split('T')[0],
    currentSituationOptions: [],
    piaGoalsUpdateOptions: [],
    conductUpdateOptions: []
  });`;

content = content.replace(/  const \[newEvolution, setNewEvolution\] = useState<Partial<OccupationalTherapyEvolution>>\(\{[\s\S]*?newConduct: ''\n  \}\);/, newEvolutionState);

const handleSaveAssessmentReplacement = `
      updatedPia.interventions = {
        ...updatedPia.interventions,
        occupationalTherapy: (assessment.treatmentConductOptions?.join(', ') || '') + '\\n' + (assessment.treatmentConductObservations || '')
      };`;

content = content.replace(/updatedPia\.interventions = \{\n[\s\S]*?occupationalTherapy: assessment\.piaGoals \|\| ''\n[\s\S]*?\};/, handleSaveAssessmentReplacement);

fs.writeFileSync('components/OccupationalTherapyTab.tsx', content);

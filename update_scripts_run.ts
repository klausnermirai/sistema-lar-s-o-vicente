import * as fs from 'fs';

let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

const assessmentReplacement = `  const [assessment, setAssessment] = useState<Partial<PhysiotherapyAssessment>>(
    ptData.initialAssessment || {
      date: new Date().toISOString().split('T')[0],
      motorAssessment: '',
      respiratoryAssessment: '',
      kineticFunctionalDiagnosis: '',
      objectives: '',
      conduct: '',
      mobilityConditions: [],
      balanceAndStrength: [],
      painAndLimitations: [],
      therapeuticGoals: [],
      treatmentConducts: []
    }
  );`;

content = content.replace(/  const \[assessment, setAssessment\] = useState<Partial<PhysiotherapyAssessment>>\([\s\S]*?conduct: ''\n    \}\n  \);/, assessmentReplacement);

const newEvolutionState = `  const [newEvolution, setNewEvolution] = useState<Partial<PhysiotherapyEvolution>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    treatmentResponse: '',
    currentSituationOptions: [],
    currentMobilityOptions: [],
    piaGoalsUpdateOptions: [],
    conductUpdateOptions: []
  });`;

content = content.replace(/  const \[newEvolution, setNewEvolution\] = useState<Partial<PhysiotherapyEvolution>>\(\{[\s\S]*?treatmentResponse: ''\n  \}\);/, newEvolutionState);

// Now let's inject Checklists arrays at the top under imports
const checklists = `
const mobilityOptionsList = ['Deambula sem auxílio', 'Deambula com bengala', 'Deambula com andador', 'Cadeirante', 'Acamado', 'Necessita auxílio parcial', 'Necessita auxílio total', 'Apresenta dificuldade para transferências', 'Apresenta risco de queda'];
const balanceOptionsList = ['Marcha preservada', 'Marcha instável', 'Déficit de equilíbrio', 'Fraqueza em membros inferiores', 'Fraqueza em membros superiores', 'Histórico de quedas', 'Necessita supervisão ao caminhar'];
const painOptionsList = ['Sem queixa de dor', 'Dor ao movimento', 'Dor lombar', 'Dor em joelho/quadril', 'Dor em ombro/braço', 'Rigidez articular', 'Limitação de amplitude de movimento', 'Sem alteração respiratória aparente', 'Necessita atenção respiratória'];
const therapeuticGoalsList = ['Manter mobilidade', 'Melhorar equilíbrio', 'Reduzir risco de quedas', 'Fortalecer membros inferiores', 'Fortalecer membros superiores', 'Melhorar transferências', 'Preservar autonomia', 'Prevenir contraturas', 'Melhorar conforto e posicionamento', 'Estimular marcha', 'Aliviar dor'];
const treatmentConductsList = ['Cinesioterapia', 'Alongamentos', 'Fortalecimento muscular', 'Treino de marcha', 'Treino de equilíbrio', 'Exercícios respiratórios', 'Mobilização passiva', 'Mobilização ativa-assistida', 'Posicionamento no leito/cadeira', 'Orientação à equipe de cuidados', 'Atendimento individual', 'Atividade em grupo'];

const currentSituationOptionsList = ['Mantém quadro anterior', 'Apresentou melhora', 'Apresentou piora', 'Apresentou oscilação funcional', 'Nova limitação identificada', 'Nova queda/intercorrência', 'Necessita ajuste no plano'];
const currentMobilityOptionsList = ['Mantém deambulação', 'Melhorou deambulação', 'Piorou deambulação', 'Necessita mais auxílio', 'Necessita menos auxílio', 'Mantém risco de queda', 'Reduziu risco de queda', 'Aumentou risco de queda', 'Apresenta dor ou limitação nova'];
const piaGoalsUpdateOptionsList = ['Manter objetivos atuais', 'Alterar objetivos', 'Incluir novo objetivo', 'Encerrar objetivo alcançado'];
const conductUpdateOptionsList = ['Manter plano atual', 'Intensificar acompanhamento', 'Reduzir acompanhamento', 'Alterar exercícios/condutas', 'Orientar equipe de cuidados', 'Encaminhar para avaliação médica', 'Registrar apenas acompanhamento'];

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


// Fix HandleSaveAssessment
const handleSaveAssessmentReplacement = `
      updatedPia.interventions = {
        ...updatedPia.interventions,
        physiotherapy: (assessment.treatmentConducts?.join(', ') || '') + '\\n' + (assessment.detailedTreatmentPlan || '')
      };`;

content = content.replace(/updatedPia.interventions = \{\n[\s\S]*?physiotherapy: assessment.conduct \|\| ''\n[\s\S]*?\};/, handleSaveAssessmentReplacement);

fs.writeFileSync('components/PhysiotherapyTab.tsx', content);

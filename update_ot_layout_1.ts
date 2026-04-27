import * as fs from 'fs';

let content = fs.readFileSync('components/OccupationalTherapyTab.tsx', 'utf8');

const assessmentLayoutStart = '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
const assessmentLayoutEnd = '{isEditingAssessment && (';

const newAssessmentLayout = `
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data da Avaliação</label>
                {isEditingAssessment ? (
                  <input
                    type="date"
                    value={assessment.date}
                    onChange={e => setAssessment({ ...assessment, date: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs font-bold bg-white focus:ring-2 outline-none transition-all"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-gray-800 border">
                    {assessment.date ? new Date(assessment.date).toLocaleDateString('pt-BR') : '-'}
                  </div>
                )}
              </div>

              <ChecklistGroup label="Atividades de Vida Diária (AVD)" options={adlOptionsList} selected={assessment.adlOptions} onChange={(s) => setAssessment({ ...assessment, adlOptions: s })} isEditing={isEditingAssessment} />
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre AVD</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.adlObservations || ''}
                    onChange={e => setAssessment({ ...assessment, adlObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[60px] whitespace-pre-wrap">{assessment.adlObservations || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Avaliação Cognitiva" options={cognitiveOptionsList} selected={assessment.cognitiveOptions} onChange={(s) => setAssessment({ ...assessment, cognitiveOptions: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Cognitivas</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.cognitiveObservations || ''}
                    onChange={e => setAssessment({ ...assessment, cognitiveObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[60px] whitespace-pre-wrap">{assessment.cognitiveObservations || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Aspectos Motores e Sensoriais" options={motorSensoryOptionsList} selected={assessment.motorSensoryOptions} onChange={(s) => setAssessment({ ...assessment, motorSensoryOptions: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Motores e Sensoriais</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.motorSensoryObservations || ''}
                    onChange={e => setAssessment({ ...assessment, motorSensoryObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[60px] whitespace-pre-wrap">{assessment.motorSensoryObservations || '-'}</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <ChecklistGroup label="Objetivos Terapêuticos (PIA)" options={therapeuticGoalsOptionsList} selected={assessment.therapeuticGoalsOptions} onChange={(s) => setAssessment({ ...assessment, therapeuticGoalsOptions: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Objetivos Terapêuticos Específicos</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.therapeuticGoalsObservations || assessment.piaGoals || ''}
                    onChange={e => setAssessment({ ...assessment, therapeuticGoalsObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[80px] whitespace-pre-wrap">{assessment.therapeuticGoalsObservations || assessment.piaGoals || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Conduta / Plano de Tratamento (PIA)" options={treatmentConductOptionsList} selected={assessment.treatmentConductOptions} onChange={(s) => setAssessment({ ...assessment, treatmentConductOptions: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plano de Tratamento Detalhado</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.treatmentConductObservations || assessment.functionalSynthesis || ''}
                    onChange={e => setAssessment({ ...assessment, treatmentConductObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[100px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[100px] whitespace-pre-wrap">{assessment.treatmentConductObservations || assessment.functionalSynthesis || '-'}</div>
                )}
              </div>
            </div>
          </div>
          `;

const startIndex = content.indexOf(assessmentLayoutStart);
const endIndex = content.indexOf(assessmentLayoutEnd, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newAssessmentLayout + content.substring(endIndex);
}

fs.writeFileSync('components/OccupationalTherapyTab.tsx', content);

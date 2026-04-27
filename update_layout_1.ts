import * as fs from 'fs';

let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

const assessmentLayoutStart = '<div className="grid grid-cols-1 md:grid-cols-2 gap-6">';
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

              <ChecklistGroup label="Condição motora e mobilidade" options={mobilityOptionsList} selected={assessment.mobilityConditions} onChange={(s) => setAssessment({ ...assessment, mobilityConditions: s })} isEditing={isEditingAssessment} />
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre mobilidade</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.mobilityObservations || ''}
                    onChange={e => setAssessment({ ...assessment, mobilityObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[60px] whitespace-pre-wrap">{assessment.mobilityObservations || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Equilíbrio, marcha e força" options={balanceOptionsList} selected={assessment.balanceAndStrength} onChange={(s) => setAssessment({ ...assessment, balanceAndStrength: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre marcha e força</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.balanceObservations || ''}
                    onChange={e => setAssessment({ ...assessment, balanceObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[60px] whitespace-pre-wrap">{assessment.balanceObservations || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Dor, limitações e respiração" options={painOptionsList} selected={assessment.painAndLimitations} onChange={(s) => setAssessment({ ...assessment, painAndLimitations: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações sobre dor e limitações</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.painObservations || ''}
                    onChange={e => setAssessment({ ...assessment, painObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[60px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[60px] whitespace-pre-wrap">{assessment.painObservations || '-'}</div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diagnóstico fisioterapêutico / funcional</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.functionalDiagnosis || assessment.kineticFunctionalDiagnosis || ''}
                    onChange={e => setAssessment({ ...assessment, functionalDiagnosis: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[80px] whitespace-pre-wrap">{assessment.functionalDiagnosis || assessment.kineticFunctionalDiagnosis || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Objetivos Terapêuticos (PIA)" options={therapeuticGoalsList} selected={assessment.therapeuticGoals} onChange={(s) => setAssessment({ ...assessment, therapeuticGoals: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Objetivos Específicos</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.specificGoals || assessment.objectives || ''}
                    onChange={e => setAssessment({ ...assessment, specificGoals: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[80px] whitespace-pre-wrap">{assessment.specificGoals || assessment.objectives || '-'}</div>
                )}
              </div>

              <ChecklistGroup label="Conduta / Plano de Tratamento (PIA)" options={treatmentConductsList} selected={assessment.treatmentConducts} onChange={(s) => setAssessment({ ...assessment, treatmentConducts: s })} isEditing={isEditingAssessment} />

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plano de Tratamento Detalhado</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.detailedTreatmentPlan || assessment.conduct || ''}
                    onChange={e => setAssessment({ ...assessment, detailedTreatmentPlan: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[100px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[100px] whitespace-pre-wrap">{assessment.detailedTreatmentPlan || assessment.conduct || '-'}</div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observações Finais</label>
                {isEditingAssessment ? (
                  <textarea
                    value={assessment.finalObservations || ''}
                    onChange={e => setAssessment({ ...assessment, finalObservations: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs bg-white focus:ring-2 outline-none min-h-[80px]"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 border min-h-[80px] whitespace-pre-wrap">{assessment.finalObservations || '-'}</div>
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

fs.writeFileSync('components/PhysiotherapyTab.tsx', content);


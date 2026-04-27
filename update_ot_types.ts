import * as fs from 'fs';

let content = fs.readFileSync('types.ts', 'utf8');

const assessmentReplacement = `export interface OccupationalTherapyAssessment {
  date: string;
  independenceLevel?: string;
  mobility?: string;
  feeding?: string;
  personalHygiene?: string;
  clothing?: string;
  bathing?: string;
  orientation?: string;
  attentionAndMemory?: string;
  participation?: string;
  occupationalInterest?: string;
  motorLimitations?: string;
  fallRisk?: string;
  deviceUsage?: string;
  environmentalAdaptationNeeds?: string;
  functionalSynthesis?: string;
  piaGoals?: string;

  adlOptions?: string[];
  adlObservations?: string;
  cognitiveOptions?: string[];
  cognitiveObservations?: string;
  motorSensoryOptions?: string[];
  motorSensoryObservations?: string;
  therapeuticGoalsOptions?: string[];
  therapeuticGoalsObservations?: string;
  treatmentConductOptions?: string[];
  treatmentConductObservations?: string;
}`;

content = content.replace(/export interface OccupationalTherapyAssessment \{[\s\S]*?piaGoals: string;\n\}/, assessmentReplacement);

const evolutionReplacement = `export interface OccupationalTherapyEvolution {
  id: string;
  date: string;
  functionalEvolution?: string;
  participationEvolution?: string;
  currentIndependenceLevel?: string;
  piaGoalStatus?: string;
  newConduct?: string;

  currentSituationOptions?: string[];
  evolutionDescription?: string;
  piaGoalsUpdateOptions?: string[];
  updatedGoals?: string;
  conductUpdateOptions?: string[];
  updatedConduct?: string;
  finalObservations?: string;
}`;

content = content.replace(/export interface OccupationalTherapyEvolution \{[\s\S]*?newConduct: string;\n\}/, evolutionReplacement);

fs.writeFileSync('types.ts', content);

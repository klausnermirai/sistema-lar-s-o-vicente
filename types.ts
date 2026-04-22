
export type InstitutionType = 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';

export interface Institution {
  id: string;
  cnpj: string;
  name: string;
  type: InstitutionType;
  parentId?: string; // ID do conselho imediatamente superior
  nacionalId?: string;
  metropolitanoId?: string;
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;
  address?: string;
  phone?: string;
  email?: string;
  capacityMale?: number;
  capacityFemale?: number;
  capacityGeneral?: number;
  roomsMale?: number;
  roomsFemale?: number;
}

export interface InstitutionSettings {
  entityType: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';
  name: string;
  cnpj: string;
  city?: string;
  
  // Hierarchy
  nacionalId?: string;
  metropolitanoId?: string;
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;

  // Capacity
  capacityMale?: number;
  capacityFemale?: number;
  capacityGeneral?: number;
  roomsMale?: number;
  roomsFemale?: number;
  logoUrl?: string;
}

export interface AssistedFamily {
  id: string;
  institutionId: string; // ID da Conferência
  nacionalId?: string;
  metropolitanoId?: string;
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;
  
  representativeName: string;
  cpf: string;
  address: string;
  phone: string;
  membersCount: number;
  situation: string;
  lastVisitDate: string;
  createdAt: string;
}

export interface User {
  id: string;
  institutionId: string;
  username: string;
  password?: string;
  fullName: string;
  role: string;
  accessLevel: 'gerencial' | 'equipe';
  institutionType?: InstitutionType; // Cache for easy access
}

export interface Relative {
  id: string;
  name: string;
  kinship: string;
  phone: string;
  observation: string;
  isResponsible: boolean;
}

export interface FamilyMemberRecord {
  id: string;
  name: string;
  kinship: string;
  age: string;
  job: string;
  income: string;
}

export interface VisitRecord {
  id: string;
  date: string;
  visitorName: string;
  visitorDoc: string; // RG or CPF
  timeIn: string;
  timeOut: string;
  observation: string;
}

export interface FinancialTransaction {
  id: string;
  date: string;
  type: 'entrada' | 'saída';
  description: string;
  amount: number;
}

export interface PersonalItem {
  id: string;
  description: string;
  status: 'Entrada' | 'Saída';
  date: string;
  observation: string;
}

export interface HealthUpdate {
  id: string;
  date: string;
  summary: string;
  professional: string;
  observation: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  stock: number;
  lastUpdate: string;
}

export type CandidateStage = 
  | 'agendamentos'
  | 'entrevista' 
  | 'aguardando_vaga' 
  | 'decisao_diretoria' 
  | 'avaliacao_medica' 
  | 'integracao' 
  | 'acolhido' 
  | 'arquivado';

export type WaitlistPriority = 'social_urgente' | 'dependencia_duvidosa' | 'padrao';

export interface InterviewData {
  // 3. Composição e Apoio
  residesWith: string;
  hasChildren: string;
  childrenCount: string;
  hasCaregiver: string;
  hasSupportNetwork: string;
  supportNetworkDetails: string;
  
  // 4. Composição Familiar (Tabela)
  familyTable: FamilyMemberRecord[];

  // 5. Moradia
  housingType: string;
  rentValue: string;

  // 6. Socioeconômica
  incomeSource: string;
  incomeValue: string;
  hasLoan: string;
  loanValue: string;
  canAffordCare: string;

  // 7. Saúde
  medicalDiagnoses: string;
  continuousMedication: string;
  medicationDetails: string;
  regularMedicalFollowup: string;
  cognitiveImpairment: string;
  cognitiveDetails: string;

  // 8. Dependência
  depHygiene: string;
  depFeeding: string;
  depMobility: string;
  depBathroom: string;
  depMedication: string;

  // Extras do topo da página 3
  needsFullTimeCare: string;

  // 9. Psicossociais
  familyConflicts: string;
  conflictDetails: string;
  elderlyAgrees: string;
  familyAgrees: string;

  // 10. Motivo
  requestReason: string;

  // 11. Parecer
  socialAnalysis: string;
}

export interface Candidate {
  id: string;
  stage: CandidateStage;
  priority?: WaitlistPriority;
  archiveReason?: string;
  
  // Campos de Agendamento
  scheduledDate?: string;
  scheduledPeriod?: 'manha' | 'tarde' | 'noite';
  scheduledNotes?: string;
  requestOrigin?: 'CREAS/PREFEITURA' | 'JUDICIAL' | 'CONFERÊNCIAS' | 'CONTATO DIRETO';
  requestDescription?: string;

  // Níveis de Decisão
  boardOpinion?: string;
  medicalOpinion?: string;
  medicalStatus?: 'favoravel' | 'desfavoravel';
  integrationDate?: string;
  integrationReport?: string;
  contractStatus?: 'pendente' | 'assinado';
  admissionDate?: string;

  // Identificação (Top-level para listas)
  name: string;
  birthDate: string;
  age: string;
  gender: string;
  maritalStatus: string;
  rg: string;
  cpf: string;
  address: string;
  phone: string;

  // Responsável (Top-level)
  repName: string;
  repKinship: string;
  repPhone: string;
  repAddress: string;

  // Campos para compatibilidade legada
  admissionReason: string;
  socialOpinion: string;

  // NOVA FICHA OFICIAL
  interview: InterviewData;
  
  createdAt: string;
  residentId?: string;
  
  // Hierarchy fields for querying
  nacionalId?: string;
  metropolitanoId?: string;
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;
  institutionId: string;
}

export interface InitialNutritionalAssessment {
  date: string;
  weight?: number;
  height?: number;
  calfCircumference?: number;
  armCircumference?: number;
  waistCircumference?: number;
  abdomenCircumference?: number;
  hipCircumference?: number;
  thighCircumference?: number;
  measurementsNotTakenDueToLimitation?: boolean;
  tricepsSkinfold?: number;
  bicepsSkinfold?: number;
  subscapularSkinfold?: number;
  suprailiacSkinfold?: number;
  skinfoldsNotTakenDueToLimitation?: boolean;
  gender?: string;
  age?: number;
  activityLevel?: string;
  chronicDiseases: string[];
  otherChronicDisease?: string;
  feedingRoute?: string;
  dietConsistency?: string;
  oralHealth: string[];
  foodLikes?: string;
  foodDislikes?: string;
  foodAllergies?: string;
  initialDiagnosis?: string;
  needsSupplementation: boolean;
  supplementationDetails?: string;
  piaGoals?: string;
  appetite?: string;
  recentWeightLoss?: string;
  mobility?: string;
  recentStress?: string;
  screeningScore?: number;
  screeningClassification?: string;
  screeningObservations?: string;
}

export interface NutritionalEvolution {
  id: string;
  date: string;
  weight?: number;
  weightVariationPercent?: number;
  foodAcceptance?: string;
  changedConsistencyOrRoute: boolean;
  changeJustification?: string;
  piaGoalStatus?: string;
  newConduct?: string;
}

export interface NutritionalAttendance {
  id: string;
  dateTime: string;
  reason: string;
  notes: string;
  muralNotes?: string;
  signature: string;
}

export interface NutritionData {
  initialAssessment?: InitialNutritionalAssessment;
  evolutions?: NutritionalEvolution[];
  attendances?: NutritionalAttendance[];
  groupActivities?: GroupActivity[];
}

export interface InitialPsychologicalAssessment {
  date: string;
  institutionalizationAwareness?: string;
  initialEmotionalReaction: string[];
  recentGriefsAndLosses?: string;
  traumasAndEmotionalTriggers?: string;
  orientationLevel?: string;
  moodScreeningGDS?: string;
  cognitiveScreeningMMSE?: number;
  familyBondQuality?: string;
  visitExpectations?: string;
  initialPsychologicalSynthesis?: string;
  piaPsychologicalGoals?: string;
}

export interface PsychologicalEvolution {
  id: string;
  date: string;
  institutionalAdaptationStatus?: string;
  moodBehaviorEvolution?: string;
  currentSocializationQuality: string[];
  piaGoalStatus?: string;
  newConduct?: string;
}

export interface PsychologicalAttendance {
  id: string;
  dateTime: string;
  interventionType: string;
  attendanceEvolution: string;
  muralNotes?: string;
  privateNotes?: string;
  needsTeamReport: boolean;
  signature: string;
}

export interface PsychologyData {
  initialAssessment?: InitialPsychologicalAssessment;
  anamnese?: InitialPsychologicalAssessment;
  evolutions?: PsychologicalEvolution[];
  attendances?: PsychologicalAttendance[];
  groupActivities?: GroupActivity[];
}

export interface OccupationalTherapyAssessment {
  date: string;
  independenceLevel: string;
  mobility: string;
  feeding: string;
  personalHygiene: string;
  clothing: string;
  bathing: string;
  orientation: string;
  attentionAndMemory: string;
  participation: string;
  occupationalInterest: string;
  motorLimitations: string;
  fallRisk: string;
  deviceUsage: string;
  environmentalAdaptationNeeds: string;
  functionalSynthesis: string;
  piaGoals: string;
}

export interface OccupationalTherapyEvolution {
  id: string;
  date: string;
  functionalEvolution: string;
  participationEvolution: string;
  currentIndependenceLevel: string;
  piaGoalStatus: string;
  newConduct: string;
}

export interface OccupationalTherapyAttendance {
  id: string;
  dateTime: string;
  attendanceType: string;
  attendanceEvolution: string;
  prontuarioNotes: string;
  muralNotes: string;
  signature: string;
}

export interface OccupationalTherapyData {
  initialAssessment?: OccupationalTherapyAssessment;
  evolutions?: OccupationalTherapyEvolution[];
  attendances?: OccupationalTherapyAttendance[];
  groupActivities?: GroupActivity[];
}

export interface PiaGoalStatus {
  status: 'Em andamento' | 'Atingida' | 'Não atingida' | '';
  reviewDate: string;
  observation: string;
}

export interface PiaRevision {
  id: string;
  date: string;
  changes: string;
  professional: string;
  observation: string;
}

export interface PiaData {
  createdAt?: string;
  status: 'Ativo' | 'Em revisão' | 'Encerrado';
  generalSynthesis: string;
  interventions: {
    nutrition: string;
    psychology: string;
    medical: string;
    occupationalTherapy?: string;
  };
  goalsStatus: {
    nutrition: PiaGoalStatus;
    psychology: PiaGoalStatus;
    occupationalTherapy?: PiaGoalStatus;
  };
  revisions: PiaRevision[];
}

export interface Resident {
  id: string;
  photo?: string;
  name: string;
  gender: 'Masculino' | 'Feminino' | 'Outro';
  birthDate: string;
  nationality: string;
  naturalness: string;
  maritalStatus: string;
  education: string;
  fatherName: string;
  motherName: string;
  nickname: string;
  profession: string;
  spouse: string;
  preferredHospitals: string;
  observations: string;
  
  cpf: string;
  rg: string;
  issuingBody: string;
  voterTitle: string;
  voterSection: string;
  voterZone: string;
  certType: string;
  certNumber: string;
  certPage: string;
  certBook: string;
  certCity: string;
  certState: string;
  certDate: string;

  samsCard: string;
  susCard: string;
  cadUnico: string;
  inssNumber: string;
  inssType: string;
  inssStatus: string;

  cep: string;
  city: string;
  state: string;
  neighborhood: string;
  address: string;
  addressNumber: string;
  reference: string;
  complement: string;

  stayType: string;
  admissionDate: string;
  room: string;
  bedNumber: string;
  income: string;
  admissionReason: string;
  residentGroup: string;
  dependencyLevel: string;
  previousInstitution: string;
  stayTime: string;
  changeReason: string;

  relatives: Relative[];
  visitRecords: VisitRecord[];
  financials: FinancialTransaction[];
  personalItems: PersonalItem[];
  healthUpdates: HealthUpdate[];
  medications: Medication[];

  // Hierarchy fields for querying
  nacionalId?: string;
  metropolitanoId?: string;
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;
  institutionId: string;

  // Campos importados da Triagem
  sourceCandidateId?: string;
  priority?: string;
  boardOpinion?: string;
  medicalOpinion?: string;
  medicalStatus?: string;
  integrationDate?: string;
  integrationReport?: string;
  interview?: InterviewData;
  nutrition?: NutritionData;
  psychology?: PsychologyData;
  occupationalTherapy?: OccupationalTherapyData;
  pia?: PiaData;
}

export interface MuralMessage {
  id: string;
  institutionId: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface GroupActivity {
  id: string;
  institutionId: string;
  competence: 'nutricionista' | 'psicologia' | 'terapeuta_ocupacional';
  date: string;
  time: string;
  type: string;
  description: string;
  participationType: 'Todos os residentes' | 'Grupo específico' | 'Participação parcial';
  selectedResidents: string[]; // IDs of residents
  responsibleProfessional: string;
  involvedProfessionals: string[];
  result: 'Excelente' | 'Boa' | 'Regular' | 'Baixa adesão';
  observations: string;
  sharedToMural: boolean;
  timestamp: number;
}

export enum AppRoute {
  RESIDENTS = 'residents',
  SCREENING = 'screening',
  SAUDE_CUIDADOS = 'saude-cuidados',
  ATENDIMENTOS_MULTIDISCIPLINARES = 'atendimentos-multidisciplinares',
  CONSULTAS_MEDICAS = 'consultas-medicas',
  SETTINGS = 'settings',
  AMENDMENTS = 'amendments'
}

export type SubTab = 'geral' | 'familiares-visitantes' | 'financeiro' | 'itens' | 'prontuario' | 'pia';

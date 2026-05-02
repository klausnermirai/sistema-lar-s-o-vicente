
export type InstitutionType = 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';

export interface AgendaEvent {
  id: string;
  institutionId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description?: string;
  professionalName: string;
  professionalRole: string;
  residentId?: string; // Optional related resident
  type?: 'comum' | 'consulta_exame' | 'atividade_grupo' | 'triagem' | 'salao_festas' | string;
  companion?: string;
  // Novos campos para salão de festas
  dates?: string[];
  endTime?: string;
  keyResponsible?: string;
  responsiblePhone?: string;
  group?: string;
}

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
  roles?: string[];
}

export interface InstitutionSettings {
  entityType: 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';
  name: string;
  cnpj: string;
  city?: string;
  agendaCentralEmail?: string;
  
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
  roles?: string[];
  muralPhone?: string;
  telegramBotToken?: string;
  telegramChatId?: string;

  reportConfig?: {
    institutionName: string;
    logoUrl?: string;
    cnpj?: string;
    address?: string;
    phone?: string;
    email?: string;
    cityState?: string;
    additionalText?: string;
  };
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
  professionalRegistration?: string;
  accessLevel: 'administrador' | 'assistente_social' | 'psicologia' | 'terapeuta_ocupacional' | 'fisioterapeuta' | 'nutricionista' | 'medico' | 'cuidados';
  institutionType?: InstitutionType;
  funcionarioId?: string;
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

export interface GlobalVisitRecord {
  id: string;
  institutionId: string;
  type: 'residente' | 'instituicao' | 'ssvp' | 'orgao_fiscalizador';
  date: string;
  rating: number; // 0 a 5
  comments: string;
  phone?: string;
  
  // Specific fields
  agencyName?: string; // orgao_fiscalizador
  conferenceName?: string; // ssvp
  residentId?: string; // residente
  visitorName?: string; // residente
  kinship?: string; // residente
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

export interface ExamRequest {
  id: string;
  date: string;
  doctorName: string;
  exams: string[];
  otherExams?: string;
  status: 'solicitado' | 'realizado';
  results?: string;
  resultsDate?: string;
}

export interface Medication {
  id: string;
  name: string;
  concentration: string;
  dose: string;
  frequency: number; // vezes ao dia
  times: string[]; // horários (ex: ["08:00", "20:00"])
  type: 'continuo' | 'temporario';
  durationDays?: number;
  startDate: string;
  observation?: string;
  stock?: number;
  lastUpdate?: string;
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
  incomeSource: string | string[];
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

export interface NursingScreening {
  id?: string;
  date: string;
  
  // 1. Sinais Vitais e Biometria
  vitalSigns: {
    paSystolic: number;
    paDiastolic: number;
    fc: number;
    fr: number;
    temperature: number;
    spo2: number;
    hgtValue: number;
    hgtType: 'jejum' | 'pos-prandial';
    weight: string;
    height: string;
  };

  // 2. Anamnese e Histórico Clínico
  clinicalHistory: {
    allergies: string;
    comorbidities: string[]; // Hipertensão, Diabetes, Alzheimer, Parkinson, Cardiopatias, Sequela de AVC, Outros
    otherComorbidities?: string;
    surgeries: string;
    habits: {
      smoking: boolean;
      smokingDetails?: string;
      alcohol: boolean;
      alcoholDetails?: string;
    };
    medications: string; // Listar remédios, dosagens e horários
  };

  // 3. Avaliação Funcional e Cognitiva
  functionalAssessment: {
    mobility: 'deambula' | 'dispositivo' | 'cadeirante' | 'acamado';
    continence: 'continente' | 'incontinencia_urinaria' | 'incontinencia_fecal' | 'fraldas';
    consciousness: 'lucido' | 'confuso' | 'letargico';
    communication: string[]; // Verbaliza bem, Apresenta déficit auditivo, Apresenta déficit visual
    dependencyLevel: 'independente' | 'parcial' | 'total'; // Base Katz
  };

  // 4. Exame Físico Simplificado
  physicalExam: {
    skinIntegrity: 'integra' | 'lesao_pressao' | 'escoriacoes_hematomas';
    skinDetails?: string;
    nutritionalStatus: 'via_oral' | 'dificuldade_degluticao' | 'sonda_enteral_gtt';
    sleepPattern: 'dorme_bem' | 'agitacao_noturna' | 'uso_medicacao_dormir';
  };

  // 5. Rede de Apoio de Saúde (Foco SUS)
  healthSupport: {
    susCard: string;
    referenceUBS: string;
    referenceDoctor: string;
    activeBenefits: string[]; // Retira fraldas pelo SUS, Retira medicamentos de alto custo/farmácia municipal
  };

  professionalName: string;
  signatureDate: string;
}

export interface JobCandidate {
  id: string;
  name: string;
  jobPosition: string;
  date: string;
  empathy: 'adequado' | 'a_desenvolver' | 'inadequado' | '';
  emotionalStability: 'adequado' | 'a_desenvolver' | 'inadequado' | '';
  teamwork: 'adequado' | 'a_desenvolver' | 'inadequado' | '';
  communication: 'adequado' | 'a_desenvolver' | 'inadequado' | '';
  strengths: string;
  attentionPoints: string;
  descriptiveReport: string;
  recommendation: 'recomendado' | 'nao_recomendado' | '';
  processStatus: 'pendente' | 'contratado' | 'nao_contratado' | 'cadastro_reserva';
  institutionId: string;
  isArchived: boolean;
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
  exams?: ExamRequest[];
  requestDescription?: string;

  // Níveis de Decisão
  boardOpinion?: string;
  medicalOpinion?: string;
  medicalStatus?: 'favoravel' | 'desfavoravel';
  integrationDate?: string;
  integrationReport?: string;
  
  psychology?: PsychologyData; // Para atendimentos na triagem
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
  nursingScreening?: NursingScreening;
  
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
  reason?: string;
  
  // Substituição de múltiplos campos por um só:
  descricaoAtendimento: string;
  visibilidade: string[] | string;
  
  // Legado (opcional para não quebrar o que já existe):
  notes?: string;
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
  interventionType?: string;
  
  descricaoAtendimento: string;
  visibilidade: string[] | string;
  
  // Legado
  attendanceEvolution?: string;
  muralNotes?: string;
  privateNotes?: string;
  
  needsTeamReport: boolean;
  signature: string;
  candidateStatus?: 'apto' | 'inapto' | 'necessita_atencao';
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
}

export interface OccupationalTherapyEvolution {
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
}

export interface OccupationalTherapyAttendance {
  id: string;
  dateTime: string;
  attendanceType?: string;
  
  descricaoAtendimento: string;
  visibilidade: string[] | string;
  
  // Legado
  attendanceEvolution?: string;
  prontuarioNotes?: string;
  muralNotes?: string;
  
  signature: string;
}

export interface OccupationalTherapyData {
  initialAssessment?: OccupationalTherapyAssessment;
  evolutions?: OccupationalTherapyEvolution[];
  attendances?: OccupationalTherapyAttendance[];
  groupActivities?: GroupActivity[];
}

export interface PhysiotherapyAssessment {
  date: string;
  motorAssessment?: string;
  respiratoryAssessment?: string;
  kineticFunctionalDiagnosis?: string;
  objectives?: string;
  conduct?: string;

  mobilityConditions?: string[];
  mobilityObservations?: string;
  balanceAndStrength?: string[];
  balanceObservations?: string;
  painAndLimitations?: string[];
  painObservations?: string;
  functionalDiagnosis?: string;
  therapeuticGoals?: string[];
  specificGoals?: string;
  treatmentConducts?: string[];
  detailedTreatmentPlan?: string;
  finalObservations?: string;
}

export interface PhysiotherapyEvolution {
  id: string;
  date: string;
  description?: string;
  treatmentResponse?: string;

  currentSituationOptions?: string[];
  evolutionDescription?: string;
  currentMobilityOptions?: string[];
  functionalObservations?: string;
  piaGoalsUpdateOptions?: string[];
  updatedGoals?: string;
  conductUpdateOptions?: string[];
  updatedConduct?: string;
  finalObservations?: string;
}

export interface PhysiotherapyAttendance {
  id: string;
  dateTime: string;
  attendanceType?: string;
  
  descricaoAtendimento: string;
  visibilidade: string[] | string;
  
  // Legado
  attendanceEvolution?: string;
  prontuarioNotes?: string;
  muralNotes?: string;
  
  signature: string;
}

export interface PhysiotherapyData {
  initialAssessment?: PhysiotherapyAssessment;
  evolutions?: PhysiotherapyEvolution[];
  attendances?: PhysiotherapyAttendance[];
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
    physiotherapy?: string;
  };
  goalsStatus: {
    nutrition: PiaGoalStatus;
    psychology: PiaGoalStatus;
    occupationalTherapy?: PiaGoalStatus;
    physiotherapy?: PiaGoalStatus;
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
  incomeSource?: string | string[];
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
  exams?: ExamRequest[];

  // Hierarchy fields for querying
  nacionalId?: string;
  metropolitanoId?: string;
  centralId?: string;
  particularId?: string;
  conferenciaId?: string;
  institutionId: string;

  // Arquivamento
  isArchived?: boolean;
  archivingDate?: string;
  archivingReason?: 'inadaptacao' | 'quebra_regras' | 'desistencia' | 'vontade_familiar' | 'falecimento';
  archivingNotes?: string;

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
  physiotherapy?: PhysiotherapyData;
  pia?: PiaData;
  per?: PerData;
  careNeeds?: {
    bathAssistance?: boolean;
    oralHygieneAssistance?: boolean;
    diaperChangeAssistance?: boolean;
    decubitusChangeAssistance?: boolean;
    feedingAssistance?: boolean;
    tricotomyAssistance?: boolean;
    nailCareAssistance?: boolean;
    observacoesAlimentacao?: string;
  };
  dailyRoutines?: DailyRoutineLog[];
  appointments?: Appointment[];
  incidents?: IncidentReport[];
}

export interface IncidentReport {
  id: string;
  institutionId?: string;
  dataOperacional?: string;
  turnoId?: string;
  turnoNome?: string;
  responsavelUserId?: string;
  timestamp: number;
  residentIds: string[];
  type: 'queda' | 'comportamental' | 'clinica' | 'outros' | 'lesao' | 'recusa_alimentacao' | 'recusa_medicacao' | 'sinais_vitais' | 'medicacao_procedimento' | 'comunicacao';
  description: string;
  conduct: string;
  visibilidade?: string[];
  professionalName: string;
}

export interface ShiftHandover {
  id: string;
  institutionId?: string;
  dataOperacional?: string;
  turnoId?: string;
  turnoNome?: string;
  responsavelUserId?: string;
  timestamp: number;
  shift: 'manha' | 'tarde' | 'noite' | string; // Allow any string for dynamic shifts
  summary: string;
  pendingTasks: string;
  visibilidade?: string[];
  professionalName: string;
}

export interface VitalSignEntry {
  id: string;
  date: string;
  paSystolic?: number;
  paDiastolic?: number;
  fc?: number;
  fr?: number;
  temperature?: number;
  spo2?: number;
  hgtValue?: number;
  hgtType?: 'jejum' | 'pos-prandial';
  weight?: string;
  height?: string;
  professionalName?: string;
}

export interface ClinicalProgressEntry {
  id: string;
  date: string;
  professionalName: string;
  crm?: string;
  note: string;
}

export interface PerData {
  lastUpdated: string;
  nursingAdmissionSummary?: string; 
  vitalSignsHistory: VitalSignEntry[];
  clinicalProgress?: ClinicalProgressEntry[];
  diagnoses: string[];
  allergies: string;
  clinicalHistory: string;
  functionalStatus: {
    mobility: string;
    continence: string;
    consciousness: string;
    dependencyLevel: string;
  };
  surgeryHistory?: string;
  habits?: {
    smoking: boolean;
    alcohol: boolean;
  };
  currentMedications?: string;
  healthSupport?: {
    susCard: string;
    ubs: string;
    doctor?: string;
  };
  dailyRoutines?: DailyRoutineLog[];
}

export interface DailyRoutineLog {
  id: string;
  taskId: string;
  taskName: string;
  status: 'concluido' | 'nao_concluido' | 'ausente';
  date: string; // ISO Date YYYY-MM-DD
  time?: string; // HH:mm
  shift?: 'Manhã' | 'Tarde' | 'Noite';
  timestamp: string;
  performedBy: string;
  observation?: string;
}

export interface Companion {
  id: string;
  institutionId: string;
  name: string;
  role: 'tecnico' | 'cuidador' | 'acompanhante' | 'homecare tecnico' | 'homecare cuidador';
  phone: string;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  location: string;
  specialty?: string;
  professional?: string;
  type: 'consulta' | 'retorno' | 'exame';
  companionId?: string;
  status: 'agendado' | 'realizado' | 'cancelado';
  notes?: string;
}

export interface MuralMessage {
  id: string;
  institutionId: string;
  author: string;
  authorName?: string;
  authorRole?: string;
  authorUserId?: string;
  authorEmail?: string;
  authorFuncionarioId?: string;
  authorDisplayName?: string;
  authorFunction?: string;
  authorProfessionalCouncil?: string;
  authorProfessionalRegistry?: string;
  authorRegistryUf?: string;
  authorSignatureText?: string;
  text: string;
  detailedContent?: string;
  visibilidade?: string[] | string; // Novo campo para controle padronizado
  isPublic?: boolean; // Legacy: If true, anyone can see detailed content. If false/undefined, only admin can.
  timestamp: number;
  likes?: string[]; // Array of usernames who liked this message
}

export interface GroupActivity {
  id: string;
  institutionId: string;
  competence: 'nutricionista' | 'psicologia' | 'terapeuta_ocupacional' | 'fisioterapeuta';
  status?: 'agendada' | 'realizada' | 'cancelada';
  date: string;
  time: string;
  type: string;
  description: string;
  participationType: 'Todos os residentes' | 'Grupo específico' | 'Participação parcial';
  selectedResidents: string[]; // IDs of residents
  responsibleProfessional: string;
  involvedProfessionals: string[];
  result?: 'Excelente' | 'Boa' | 'Regular' | 'Baixa adesão' | string;
  observations?: string;
  visibilidade?: string[];
  timestamp: number;
}

export enum AppRoute {
  HOME = 'home',
  RESIDENTS = 'residents',
  SCREENING = 'screening',
  SAUDE_CUIDADOS = 'saude-cuidados',
  ATENDIMENTOS_MULTIDISCIPLINARES = 'atendimentos-multidisciplinares',
  CONSULTAS_MEDICAS = 'consultas-medicas',
  SETTINGS = 'settings',
  AMENDMENTS = 'amendments',
  AGENDA = 'agenda',
  MEDICAMENTOS = 'medicamentos',
  GUIAS = 'guias',
  VISITANTES = 'visitantes',
  EMPLOYEES = 'employees'
}

export interface OperationalShift {
  id: string;
  institutionId: string;
  nomeTurno: string;
  horarioInicio: string; // HH:mm
  horarioFim: string; // HH:mm
  setor: string;
  ordem: number;
  status: 'ativo' | 'inativo';
  defineInicioDoDiaOperacional: boolean;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface MealConfiguration {
  id?: string;
  institutionId: string;
  nomeRefeicao: string;
  horarioAproximado: string;
  turnoId: string;
  turnoNome: string;
  ordem: number;
  status: 'ativo' | 'inativo';
  observacoes?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface ShiftProcedureLog {
  id?: string;
  institutionId: string;
  tipoProcedimento: string; // 'banho', 'higiene_oral', 'alimentacao', etc.
  dataOperacional: string;
  turnoId: string;
  turnoNome: string;
  
  // Specific fields for alimentacao
  refeicaoId?: string;
  refeicaoNome?: string;
  horarioAproximado?: string;
  registrosPorResidente?: Record<string, 'comeu' | 'comeu_pouco' | 'nao_comeu' | 'recusou'>;
  residentesComAcompanhamento?: string[];
  residentesAcompanhadosQueComeram?: string[];
  residentesAcompanhadosQueComeramPouco?: string[];
  residentesAcompanhadosQueNaoComeram?: string[];
  residentesAcompanhadosQueRecusaram?: string[];
  totalComeram?: number;
  totalComeramPouco?: number;
  totalNaoComeram?: number;
  totalRecusaram?: number;
  totalAcompanhamento?: number;
  observacoesGerais?: string;

  // General fields for other procedures
  residentesSelecionados: string[]; // IDs
  residentesDependentes: string[]; // IDs (those who need assistance)
  residentesDependentesAtendidos: string[]; // IDs
  residentesDependentesPendentes: string[]; // IDs
  totalSelecionados: number;
  totalDependentes: number;
  totalDependentesAtendidos: number;
  totalDependentesPendentes: number;
  
  responsavelUserId: string;
  responsavelNome: string;
  criadoEm: string;
  observacoes?: string;
}

export interface Employee {
  id: string;
  institutionId: string;
  nomeCompleto: string;
  nomeExibicao?: string;
  grupoOrigem?: string;
  funcao: string;
  areaProfissional?: string;
  conselhoProfissional?: string;
  numeroRegistro?: string;
  ufRegistro?: string;
  email?: string;
  telefone?: string;
  vinculo?: string;
  cargaHorariaSemanal?: number | string;
  dataAdmissao?: string;
  status: 'ativo' | 'inativo';
  criarUsuarioSistema?: boolean;
  nivelAcessoSugerido?: string;
  observacoes?: string;
  criadoEm: number;
  atualizadoEm: number;
  archived?: boolean;
  archivedAt?: number;
  archivedBy?: string;
}


export type SubTab = 'geral' | 'familiares-visitantes' | 'financeiro' | 'itens' | 'prontuario' | 'pia' | 'prontuario-medico' | 'medicamentos' | 'intercorrencias';

export interface MedicationProduct {
  id: string;
  name: string;
  activePrinciple?: string;
  concentration: string;
  form: 'Comprimido' | 'Gota' | 'Ampola' | 'Mililitro' | 'Pomada' | 'Outro';
  institutionStock: number;
  residentStock: Record<string, number>; // residentId -> quantity
  minimumStock: number;
  lastRestockDate?: string;
}

export interface MedicationStockEntry {
  id: string;
  medicationProductId: string;
  residentId?: string; // null/undefined means institution stock
  quantity: number;
  origin: 'Comprado' | 'Doação' | 'Prefeitura' | 'Alto Custo';
  date: string;
  note?: string;
}

export interface MedicationAdministrationLog {
  id: string;
  residentId: string;
  medicationId: string; // Refers to Resident's Medication ID in their prescription
  medicationName: string;
  dose: string;
  plannedTime: string;
  administeredTime?: string;
  date: string;
  status: 'administrado' | 'nao_administrado' | 'recusado' | 'pendente';
  professionalName?: string;
  observation?: string;
  shift: 'Manhã' | 'Tarde' | 'Noite';
}

export interface MedicationSeparationLog {
  id: string;
  date: string;
  shift: 'Manhã' | 'Tarde' | 'Noite';
  residentId: string;
  status: 'pendente' | 'separado';
  separatedBy?: string;
  separatedAt?: string;
  medications: {
    medicationId: string;
    medicationName: string;
    dose: string;
    plannedTime: string;
  }[];
}

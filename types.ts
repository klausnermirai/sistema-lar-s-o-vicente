
export type InstitutionType = 'nacional' | 'metropolitano' | 'central' | 'particular' | 'conferencia' | 'obra_unida';

export interface AgendaEvent {
  id: string;
  institutionId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description?: string;
  professionalName: string;
  actions?: { id: string, timestamp: number, user: string, text: string }[];
  professionalRole: string;
  residentId?: string; // Optional related resident
  type?: 'comum' | 'consulta_exame' | 'atividade_grupo' | 'triagem' | 'salao_festas' | string;
  companion?: string;
  // Status and lifecycle fields
  status?: 'agendado' | 'finalizado' | 'cancelado' | 'adiado';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  completedAt?: string;
  completedBy?: string;
  postponedHistory?: Array<{
    previousDate: string;
    previousTime?: string;
    newDate: string;
    newTime?: string;
    reason?: string;
    postponedAt: string;
    postponedBy: string;
  }>;
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
  conselhosParticulares?: ConselhoParticular[];
  
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
  employees?: any[];
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

export interface SystemUnit {
  id: string;
  name: string;
  type: 'conselho_central' | 'conselho_particular' | 'conferencia' | 'obra_unida' | 'lar' | string;
  cnpj?: string;
  city?: string;
  state?: string;
  parentName?: string;
}

export interface User {
  id: string;
  institutionId: string;
  institutionIds?: string[];
  allowedUnits?: SystemUnit[];
  hasAllUnitsAccess?: boolean;
  username: string;
  password?: string;
  fullName: string;
  role: string;
  professionalRegistration?: string;
  accessLevel: 'administrador' | 'assistente_social' | 'psicologia' | 'terapeuta_ocupacional' | 'fisioterapeuta' | 'nutricionista' | 'medico' | 'cuidados' | 'enfermeira' | 'auxiliar_administrativo' | 'visitante' | 'diretoria' | string;
  institutionType?: InstitutionType;
  funcionarioId?: string;
  membroId?: string;
  conferenciaId?: string;
  particularId?: string;
  centralId?: string;
  mustChangePassword?: boolean;
  isFirstLogin?: boolean;
  status?: 'ativo' | 'inativo' | string;
  phone?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Relative {
  id: string;
  name: string;
  kinship: string;
  phone: string;
  observation: string;
  isResponsible: boolean;
  document?: string;
  photoUrl?: string;
  faceDescriptor?: number[];
  lastVisitDate?: string;
  deceased?: boolean;
}

export interface FamilyMemberRecord {
  id: string;
  name: string;
  kinship: string;
  age: string;
  job: string;
  income: string;
  deceased?: boolean;
}

export interface RegisteredVisitor {
  id: string;
  institutionId: string;
  name: string;
  document?: string;
  phone?: string;
  type: 'residente' | 'instituicao' | 'ssvp' | 'orgao_fiscalizador';
  residentId?: string;
  residentName?: string;
  linkedResidents?: { residentId: string; residentName: string }[];
  kinship?: string;
  agencyName?: string;
  conferenceName?: string;
  photoUrl?: string;
  faceDescriptor?: number[];
  createdAt: string;
  lastVisitDate?: string;
  totalVisits?: number;
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
  residentName?: string;
  visitorName?: string; // residente
  kinship?: string; // residente
  visitorDoc?: string;
  photoUrl?: string;
  faceDescriptor?: number[];
  matchedVia?: 'facial' | 'manual';
  facialConfidence?: number;
  timeIn?: string;
  timeOut?: string;
}

export interface VisitRecord {
  id: string;
  date: string;
  visitorName: string;
  visitorDoc: string; // RG or CPF
  timeIn: string;
  timeOut: string;
  observation: string;
  photoUrl?: string;
  faceDescriptor?: number[];
  matchedVia?: 'facial' | 'manual';
  facialConfidence?: number;
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
  endDate?: string;
  observation?: string;
  stock?: number;
  lastUpdate?: string;
  
  route?: string; // via
  shiftIdCalculated?: string;
  shiftNameCalculated?: string;
  originalShiftFile?: string;
  originalResidentNameFile?: string;
  importOrigin?: string;
  originPage?: string;
  importObservations?: string;
  reviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type CandidateStage = 
  | 'agendamentos'
  | 'entrevista'
  | 'visita_social'
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
  actions?: { id: string, timestamp: number, user: string, text: string }[];
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
  contactName?: string;
  contactPhone?: string;
  contactRelation?: string;
  registeredBy?: string;
  scheduledDate?: string;
  scheduledPeriod?: 'manha' | 'tarde' | 'noite';
  scheduledNotes?: string;
  requestOrigin?: 'CREAS/PREFEITURA' | 'JUDICIAL' | 'CONFERÊNCIAS' | 'CONTATO DIRETO';
  exams?: ExamRequest[];
  requestDescription?: string;

  // Campos de Visita Social
  visitaSocialData?: string;
  visitaSocialLocal?: string;
  visitaSocialAssistenteId?: string;
  visitaSocialAssistenteNome?: string;
  visitaSocialAssistenteFuncao?: string;
  visitaSocialAssistenteDoc?: string;
  visitaSocialProfissionais?: string; // (comma separated or multiple) Let's use string and allow comma separation
  visitaSocialProfissionaisLista?: {
    id: string;
    nome: string;
    funcao?: string;
    documento?: string;
  }[];
  visitaSocialRelato?: string;
  visitaSocialObservacoes?: string;
  visitaSocialEncaminhamento?: string;
  visitaSocialCriadoEm?: string;
  visitaSocialAtualizadoEm?: string;

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

  // Assinatura do Serviço Social
  assistenteSocialResponsavelId?: string;
  assistenteSocialAssinaturaSnapshot?: {
    nome: string;
    funcao: string;
    registro: string;
  };

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
  changedConsistencyOrRoute?: boolean;
  changeJustification?: string;
  piaGoalStatus?: string;
  newConduct?: string;

  // New Standard Evolution Fields
  dataEvolucao?: string;
  descricaoEvolucao?: string;
  mudancasObservadas?: string;
  novaConduta?: string;
  recomendacoes?: string;
  incluirNoPIA?: boolean;
  profissionalId?: string;
  profissionalNome?: string;
  profissionalFuncao?: string;
  profissionalRegistro?: string;
  profissionalAssinaturaTexto?: string;
  criadoEm?: string;
  atualizadoEm?: string;
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
  currentSocializationQuality?: string[];
  piaGoalStatus?: string;
  newConduct?: string;

  // New Standard Evolution Fields
  dataEvolucao?: string;
  descricaoEvolucao?: string;
  mudancasObservadas?: string;
  novaConduta?: string;
  recomendacoes?: string;
  incluirNoPIA?: boolean;
  profissionalId?: string;
  profissionalNome?: string;
  profissionalFuncao?: string;
  profissionalRegistro?: string;
  profissionalAssinaturaTexto?: string;
  criadoEm?: string;
  atualizadoEm?: string;
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

  // New Standard Evolution Fields
  dataEvolucao?: string;
  descricaoEvolucao?: string;
  mudancasObservadas?: string;
  novaConduta?: string;
  recomendacoes?: string;
  incluirNoPIA?: boolean;
  profissionalId?: string;
  profissionalNome?: string;
  profissionalFuncao?: string;
  profissionalRegistro?: string;
  profissionalAssinaturaTexto?: string;
  criadoEm?: string;
  atualizadoEm?: string;
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

  // New Standard Evolution Fields
  dataEvolucao?: string;
  descricaoEvolucao?: string;
  mudancasObservadas?: string;
  novaConduta?: string;
  recomendacoes?: string;
  incluirNoPIA?: boolean;
  profissionalId?: string;
  profissionalNome?: string;
  profissionalFuncao?: string;
  profissionalRegistro?: string;
  profissionalAssinaturaTexto?: string;
  criadoEm?: string;
  atualizadoEm?: string;
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

export type SocialWorkActionType =
  | 'atendimento_individual'
  | 'contato_familia'
  | 'visita_domiciliar'
  | 'articulacao_rede'
  | 'gestao_beneficios'
  | 'documentacao'
  | 'pia_social'
  | 'reuniao_equipe'
  | 'outro';

export type SocialWorkVisibility = 'institutional' | 'confidential';
export type SocialWorkAttendanceSubtype = 'conversation' | 'specific_demand';

export interface SocialWorkEvolution {
  id: string;
  date: string;
  time?: string;
  type: SocialWorkActionType;
  subtype?: SocialWorkAttendanceSubtype;
  title: string;
  description?: string;
  referrals?: string; // Encaminhamentos / Providências
  targetPersonOrEntity?: string; // Familiar contatado, órgão/rede envolvida (CRAS, CREAS, INSS, UBS, etc.)
  contactPhone?: string;
  professionalName: string;
  professionalRole?: string;
  cress?: string;
  professionalSignature?: string;
  postToMural?: boolean;
  visibility?: SocialWorkVisibility;
  hasConfidentialContent?: boolean;
  authorUserId?: string;
  authorUsername?: string;
  timestamp?: number;
}

export interface SocialWorkRecordPayload {
  institutionId: string;
  residentId: string;
  id?: string;
  date: string;
  time?: string;
  type: 'atendimento_individual' | 'contato_familia';
  subtype?: SocialWorkAttendanceSubtype;
  title?: string;
  description: string;
  referrals?: string;
  targetPersonOrEntity?: string;
  contactPhone?: string;
  visibility: SocialWorkVisibility;
}

export interface SocialWorkData {
  evolutions?: SocialWorkEvolution[];
  initialAssessment?: any;
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
    socialWork?: string;
  };
  goalsStatus: {
    nutrition: PiaGoalStatus;
    psychology: PiaGoalStatus;
    occupationalTherapy?: PiaGoalStatus;
    physiotherapy?: PiaGoalStatus;
    socialWork?: PiaGoalStatus;
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
  initialBalance?: number;
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
  socialWork?: SocialWorkData;
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
    woundCareAssistance?: boolean;
    observacoesAlimentacao?: string;
  };
  grauDependenciaCalculado?: number;
  grauDependenciaManual?: number | null;
  grauDependenciaFinal?: number;
  grauDependenciaAtualizadoEm?: string;
  grauDependenciaAtualizadoPor?: string;
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
  reporterName?: string;
  actions?: { id: string, timestamp: number, user: string, text: string }[];
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
  reporterName?: string;
  actions?: { id: string, timestamp: number, user: string, text: string }[];
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
  actions?: { id: string, timestamp: number, user: string, text: string }[];
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
  ENFERMAGEM = 'enfermagem',
  ATENDIMENTOS_MULTIDISCIPLINARES = 'atendimentos-multidisciplinares',
  CONSULTAS_MEDICAS = 'consultas-medicas',
  SETTINGS = 'settings',
  AMENDMENTS = 'amendments',
  AGENDA = 'agenda',
  MEDICAMENTOS = 'medicamentos',
  GUIAS = 'guias',
  VISITANTES = 'visitantes',
  EMPLOYEES = 'employees',
  STOCK = 'compras',
  FINANCEIRO = 'financeiro',
  CONTROLE_FINANCEIRO_IDOSOS = 'controle-financeiro-idosos',
  CENTRAL_INFO = 'central-info',
  CENTRAL_BOARD = 'central-board',
  CENTRAL_OBRAS = 'central-obras',
  CENTRAL_CONSELHOS = 'central-conselhos',
  // Rotas Diretas do Novo Layout Vicentino (Guias/Abas)
  VICENTINO_FAMILIAS = 'vicentino-familias',
  VICENTINO_MEMBROS = 'vicentino-membros',
  VICENTINO_CONFERENCIAS = 'vicentino-conferencias',
  VICENTINO_PARTICULARES = 'vicentino-particulares',
  VICENTINO_CENTRAL = 'vicentino-central',
  VICENTINO_METROPOLITANO = 'vicentino-metropolitano',
  VICENTINO_NACIONAL = 'vicentino-nacional'
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

export interface ResidentMedicationStockMovement {
  id: string;
  institutionId: string;
  ownerType: 'resident' | 'institution';
  ownerId: string;
  residentId?: string; // quando ownerType = resident
  prescriptionId?: string; // quando houver vínculo com prescrição
  medicamentoPrescritoTexto: string;
  tipoMovimentacao: 'entrada' | 'saida' | 'ajuste';
  ajusteTipo?: 'positivo' | 'negativo'; // para quando tipoMovimentacao for 'ajuste'
  motivo: string;
  quantidade: number;
  unidade?: string;
  dataHora: string;
  responsavelUserId?: string;
  responsavelNome: string;
  origem: 'manual' | 'automatica';
  observacoes?: string;
  saldoAnterior?: number;
  saldoAtual?: number;
  criadoEm?: string;
}

export interface MedicationAdministrationLog {
  id: string;
  institutionId?: string;
  residentId: string;
  tipoMinistracao?: "fixa" | "eventual_sos";
  sintomaOuQueixa?: string;
  condutaSosId?: string;
  prescriptionId?: string; // Optional for SOS, Refers to Resident's Medication ID for Fixa
  medicamentoPrescritoTexto: string;
  horarioPrevisto: string;
  dataOperacional: string;
  turnoId?: string;
  turnoNome?: string;
  statusAdministracao: 'administrado' | 'recusado' | 'nao_administrado' | 'suspenso' | 'em_falta' | 'outro' | 'pendente';
  dataHoraRegistro: string;
  responsavelUserId?: string;
  responsavelNome: string;
  dosagem?: string;
  quantidade?: string;
  formaFarmaceutica?: string;
  via?: string;
  origemEstoque?: 'residente' | 'instituição' | 'qualquer' | 'sem_baixa_automatica';
  estoqueBaixado?: boolean;
  autorizadoPorNome?: string;
  autorizadoPorFuncao?: string;
  autorizadoPorRegistro?: string;
  observacoes?: string;
  
  profissionalId?: string;
  profissionalNome?: string;
  profissionalFuncao?: string;
  profissionalRegistro?: string;
  profissionalAssinaturaTexto?: string;
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

export interface SosProtocol {
  id: string;
  institutionId: string;
  residentId: string;
  sintomaOuQueixa: string;
  medicamentoAutorizado: string;
  dosagem: string;
  quantidade: string;
  formaFarmaceutica: string;
  via: string;
  intervaloMinimoHoras?: number;
  estoquePreferencial: 'residente' | 'instituição' | 'qualquer' | 'sem_baixa_automatica';
  autorizadoPorProfissionalId?: string;
  autorizadoPorNome: string;
  autorizadoPorFuncao?: string;
  autorizadoPorRegistro?: string;
  dataAutorizacao: string;
  dataRevisao?: string;
  observacoes?: string;
  status: 'ativo' | 'inativo';
  criadoEm: string;
  atualizadoEm: string;
}

export interface ProductStockItem {
  id: string;
  institutionId: string;
  name: string;
  unit: string;
  category: string;
  currentStock: number;
  minStock: number;
  status: 'Disponível' | 'Comprar' | 'Alerta' | string;
  updatedAt?: string;
  estimatedCost?: number;
}

export interface StockMovement {
  id?: string;
  institutionId: string;
  productId: string;
  productName: string;
  type: 'entrada' | 'saida';
  quantity: number;
  date: string;
  userName: string;
  notes?: string;
  reason?: 'compra' | 'doacao' | 'consumo' | 'descarte';
  price?: number;
  invoiceNumber?: string;
  supplierId?: string;
  supplierName?: string;
  donorId?: string;
  donorName?: string;
  donorPhone?: string;
}

export interface Donor {
  id?: string;
  institutionId: string;
  name: string;
  phone: string;
  createdAt?: string;
}

export interface Supplier {
  id?: string;
  institutionId: string;
  name: string;
  phone: string;
  representative: string;
  email: string;
  categories?: string[];
  createdAt?: string;
}

export interface ConselhoCustomRole {
  id: string;
  roleName: string;
  name: string;
  phone: string;
}

export interface ConselhoMember {
  membroId?: string;
  name: string;
  phone: string;
}

export interface ConselhoPastMandate {
  id: string;
  startDate: string;
  endDate: string;
  presidente: ConselhoMember;
  vicePresidente: ConselhoMember;
  secretario: ConselhoMember;
  tesoureiro: ConselhoMember;
  ecafo: ConselhoMember;
  coordenadorCCA: ConselhoMember;
  customRoles?: ConselhoCustomRole[];
  archivedAt: string;
}

export interface ConferenciaPastMandate {
  id: string;
  startDate: string;
  endDate: string;
  presidente: ConselhoMember;
  confradesCount: number;
  consociasCount: number;
  aspirantesCount: number;
  archivedAt: string;
}

export interface ConferenciaSubordinada {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  presidente: ConselhoMember;
  confradesCount: number;
  consociasCount: number;
  aspirantesCount: number;
  lastMembersUpdate?: string;
  mandateHistory?: ConferenciaPastMandate[];
}

export interface ConselhoParticular {
  id: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  startDate: string;
  endDate: string;
  presidente: ConselhoMember;
  vicePresidente: ConselhoMember;
  secretario: ConselhoMember;
  tesoureiro: ConselhoMember;
  ecafo: ConselhoMember;
  coordenadorCCA: ConselhoMember;
  customRoles?: ConselhoCustomRole[];
  mandateHistory?: ConselhoPastMandate[];
  conferencias?: ConferenciaSubordinada[];
}

export interface Benefactor {
  id?: string;
  name: string;
  type: 'pf' | 'pj';
  cpfCnpj?: string;
  phone?: string;
  email?: string;
  defaultCategory?: string; // ID of the category
  notes?: string;
  institutionId?: string;
}

export interface DonationCategory {
  id?: string;
  name: string;
  description?: string;
  institutionId?: string;
}

export interface FinanceDonation {
  id?: string;
  benefactorId?: string;
  benefactorName?: string;
  categoryId: string;
  categoryName: string;
  value: number;
  date: string; // YYYY-MM-DD
  paymentMethod?: string; // Pix, Dinheiro, Boleto, Carnê, etc.
  campaign?: string; // Telemarketing, Carnês, Doação Avulsa, etc.
  notes?: string;
  institutionId?: string;
}

export interface CarneParcela {
  numero: number; // 1 to 12
  mesReferencia: string; // Ex: "Janeiro/2026"
  vencimento: string; // YYYY-MM-DD
  valor: number;
  pago: boolean;
  dataPagamento?: string; // YYYY-MM-DD
  formaPagamento?: string; // Pix, Dinheiro, Boleto, Cartão, Transferência, Outro
  donationId?: string; // ID da FinanceDonation gerada quando foi paga
  observacao?: string;
}

export interface CarneWhatsAppLog {
  id: string;
  date: string;
  messageType: 'agradecimento' | 'lembrete';
  parcelaNumero?: number;
  textPreview?: string;
  phone?: string;
  userResponsible?: string;
  status: string;
}

export interface Carne {
  id?: string;
  benefactorId: string;
  benefactorName: string;
  ano: number; // Ex: 2026
  valorParcela: number; // Valor base de cada folha
  totalParcelas: number; // Padrão: 12
  categoryId?: string; // ID da categoria de receita vinculada (ex: Carnês de mensalidade)
  categoryName?: string;
  status: 'ativo' | 'quitado' | 'cancelado';
  notes?: string;
  parcelas: CarneParcela[];
  createdAt?: string;
  institutionId?: string;
  whatsappLogs?: CarneWhatsAppLog[];
  lastWhatsAppAt?: string;
  lastWhatsAppBy?: string;
}

export type CaixinhaMovementType = 'entrada' | 'saida';
export type CaixinhaCategory = 
  | 'servico_sem_nota' 
  | 'despesa_miuda' 
  | 'deposito_bancario' 
  | 'alimentacao_diaria' 
  | 'doacao_dinheiro' 
  | 'carne_dinheiro' 
  | 'entrada_avulsa' 
  | 'outro';

export interface CaixinhaMovement {
  id?: string;
  type: CaixinhaMovementType;
  category: CaixinhaCategory;
  categoryLabel?: string;
  description: string;
  value: number;
  date: string; // YYYY-MM-DD
  responsible?: string;
  receiptNumber?: string;
  originDonationId?: string;
  institutionId?: string;
  notes?: string;
  createdAt?: string;
  archived?: boolean;
}

// ==========================================
// NOVOS TIPOS PARA A HIERARQUIA CONSELHO CENTRAL / CONSELHOS PARTICULARES / CONFERÊNCIAS / MEMBROS
// ==========================================

export interface LegacyCounts {
  confrades: number;
  consocias: number;
  aspirantes: number;
}

export interface ConferenciaCountsCache {
  confrades: number;
  consocias: number;
  aspirantes: number;
  totalMembros: number;
  lastReconciledAt?: string;
}

export interface ConselhoParticularCountsCache {
  totalConferencias: number;
  totalConfrades: number;
  totalConsocias: number;
  totalAspirantes: number;
  lastReconciledAt?: string;
}

export interface StandaloneConselhoParticular {
  id: string; // ID imutável do documento
  centralId: string; // ID imutável da instituição (Conselho Central pai)
  name: string;
  normalizedName: string; // Nome normalizado em CAIXA ALTA sem acentos para busca
  code?: string;
  institutionDate?: string; // Data de Fundação / Instituição
  city?: string;
  phone?: string;
  email?: string;
  // Endereço completo da sede
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  startDate?: string;
  endDate?: string;
  presidente?: ConselhoMember;
  vicePresidente?: ConselhoMember;
  secretario?: ConselhoMember;
  tesoureiro?: ConselhoMember;
  ecafo?: ConselhoMember;
  coordenadorCCA?: ConselhoMember;
  customRoles?: ConselhoCustomRole[];
  mandateHistory?: ConselhoPastMandate[];
  countsCache?: ConselhoParticularCountsCache;
  notes?: string;
  status: 'ativo' | 'inativo';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  migrationId?: string;
}

export interface StandaloneConferencia {
  id: string; // ID imutável do documento
  particularId: string; // ID do Conselho Particular pai
  centralId: string; // ID da instituição (Conselho Central pai)
  name: string;
  normalizedName: string; // Nome normalizado em CAIXA ALTA sem acentos para busca
  code?: string;
  foundationDate?: string; // Data de Fundação
  aggregationDate?: string; // Data de Agregação
  meetingDay?: string;
  meetingTime?: string;
  location?: string;
  // Endereço completo do local de reuniões / sede
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  phone?: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  presidente?: ConselhoMember;
  vicePresidente?: ConselhoMember;
  secretario?: ConselhoMember;
  segundoSecretario?: ConselhoMember;
  tesoureiro?: ConselhoMember;
  segundoTesoureiro?: ConselhoMember;
  legacyCounts?: LegacyCounts; // Contadores estáticos históricos do sistema legado
  countsCache?: ConferenciaCountsCache; // Cache derivado exclusivamente de membros cadastrados individualmente
  mandateHistory?: ConferenciaPastMandate[];
  notes?: string;
  status: 'ativo' | 'inativo';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  migrationId?: string;
}

export interface MembroSSVP {
  id: string; // ID imutável do membro
  conferenciaId: string; // ID da Conferência à qual pertence
  particularId: string; // ID do Conselho Particular à qual pertence
  centralId: string; // ID do Conselho Central à qual pertence
  fullName: string;
  normalizedName: string; // Nome completo normalizado em CAIXA ALTA sem acentos para busca
  type: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
  gender?: 'feminino' | 'masculino' | 'outro' | string;
  birthDate?: string;
  cpf?: string;
  profession?: string;
  // Endereço completo
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  // Contatos
  phone?: string; // Telefone celular / WhatsApp
  normalizedPhone?: string;
  phoneResidential?: string; // Telefone Residencial
  phoneCommercial?: string; // Telefone Comercial
  email?: string;
  // Datas Vicentinas
  admissionDate?: string; // Data completa de ingresso
  acclamationDate?: string; // Data de aclamação
  proclamationDate?: string; // Data completa de proclamação
  role?: string;
  userId?: string; // ID do usuário vinculado na coleção users
  username?: string; // Nome de usuário de acesso (gerado a partir do primeiro nome)
  hasAccess?: boolean; // Se possui acesso de login ativo
  accessStatus?: string; // Status textual do acesso (ex: 'Acesso ativo', 'Acesso pendente — informe a data de nascimento')
  status: 'ativo' | 'inativo' | 'afastado';
  origin?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  migrationId?: string;
}

export interface AuditLog {
  id: string;
  centralId: string;
  entityType: 'conselho_particular' | 'conferencia' | 'membro_ssvp' | 'institution';
  entityId: string;
  action: 'create' | 'update' | 'inactivate' | 'reactivate' | 'transfer' | 'reconcile';
  changedBy: string;
  timestamp: string;
  changes?: Record<string, { before: any; after: any }>;
  notes?: string;
}

export interface MigrationLog {
  migrationId: string;
  timestamp: string;
  executedBy: string;
  dryRun: boolean;
  centralId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  counts: {
    legacyConselhosCount: number;
    migratedConselhosCount: number;
    legacyConferenciasCount: number;
    migratedConferenciasCount: number;
  };
  errors?: string[];
  completedAt?: string;
}

export interface ConselhoCentralPublicTokenConfig {
  id: string; // Document ID (usually centralId or token)
  centralId: string;
  token: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  createdBy?: string;
}

export interface PublicConsentRecord {
  accepted: boolean;
  acceptedAt: string;
  termVersion: string;
  ipHash?: string;
  userAgentSnippet?: string;
  isThirdParty?: boolean;
  representativeName?: string;
}

export interface SolicitacaoCadastroMembro {
  id: string;
  centralId: string;
  particularId: string;
  conferenciaId: string;
  fullName: string;
  normalizedName: string;
  type: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
  gender?: 'feminino' | 'masculino' | 'outro' | string;
  birthDate?: string;
  cpf?: string;
  profession?: string;
  // Endereço completo
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  // Contatos
  phone: string;
  normalizedPhone: string;
  phoneResidential?: string;
  phoneCommercial?: string;
  email?: string;
  // Datas
  admissionDate?: string;
  acclamationDate?: string;
  proclamationDate?: string;
  isThirdPartySubmission?: boolean;
  representativeName?: string;
  consent: PublicConsentRecord;
  status:
    | 'aguardando_aprovacao'
    | 'aprovado'
    | 'recusado'
    | 'processado_automaticamente'
    | 'aguardando_revisao_duplicidade'
    | 'parcialmente_processado';
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  membroId?: string;
  tipo?: 'novo_cadastro' | 'atualizacao_cadastral' | 'complementacao_cadastro';
  targetMembroId?: string;
  targetSubmissionId?: string;
  appliedChanges?: Record<string, any>;
  requestedChanges?: Record<string, any>;
  changesSummary?: Record<string, { before: any; after: any }>;
  requestId?: string;
  duplicityReasons?: string[];
  possibleDuplicates?: Array<{ membroId: string; fullName: string; matchedOn: string }>;
  isTransfer?: boolean;
  oldParticularId?: string;
  oldParticularName?: string;
  oldConferenciaId?: string;
  oldConferenciaName?: string;
}

export interface PublicHierarchyStructureResponse {
  centralName: string;
  conselhosParticulares: Array<{ id: string; name: string }>;
  conferencias: Array<{ id: string; particularId: string; name: string }>;
  termVersion: string;
  termTitle: string;
  termText: string;
}

export interface PublicMemberSubmissionPayload {
  particularId: string;
  conferenciaId: string;
  fullName: string;
  type: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
  gender?: 'feminino' | 'masculino' | 'outro' | string;
  birthDate?: string;
  cpf?: string;
  profession?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  phone: string;
  phoneResidential?: string;
  phoneCommercial?: string;
  email?: string;
  admissionDate?: string;
  acclamationDate?: string;
  proclamationDate?: string;
  consentAccepted: boolean;
  termVersion?: string;
  isThirdPartySubmission?: boolean;
  representativeName?: string;
  requestId?: string;
}

export interface PublicMemberLookupItem {
  idOpaco: string;
  fullName: string;
  type: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
}

export interface PublicMemberMaskedDetails {
  idOpaco: string;
  fullName: string;
  type: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
  gender?: string;
  profession?: string;
  particularName: string;
  conferenciaName: string;
  maskedPhone: string;
  maskedPhoneResidential?: string | null;
  maskedPhoneCommercial?: string | null;
  maskedCpf?: string | null;
  maskedEmail: string | null;
  maskedBirthDate: string | null;
  maskedAddress?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  admissionDateStatus: 'informada' | 'nao_informada';
  acclamationDateStatus: 'informada' | 'nao_informada';
  proclamationDateStatus: 'informada' | 'nao_informada';
}

export interface PublicMemberUpdateRequestPayload {
  fullName?: string;
  type?: 'confrade' | 'consocia' | 'vicentino' | 'aspirante' | 'afastado' | 'auxiliar';
  gender?: string;
  birthDate?: string;
  cpf?: string;
  profession?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  fullAddress?: string;
  phone?: string;
  phoneResidential?: string;
  phoneCommercial?: string;
  email?: string;
  admissionDate?: string;
  acclamationDate?: string;
  proclamationDate?: string;
  particularId?: string;
  conferenciaId?: string;
  isThirdPartySubmission?: boolean;
  representativeName?: string;
  consentAccepted: boolean;
  termVersion?: string;
}

// ==========================================
// MÓDULO DE FAMÍLIAS ASSISTIDAS E SINDICÂNCIA SSVP
// ==========================================

export interface MembroFamiliarComposicao {
  id: string;
  name: string;
  birthDate?: string;
  age?: number;
  isBatizado: boolean; // Sim/Não
  kinship?: string; // Parentesco (filho, neto, mãe, etc.)
  occupation?: string;
  income?: number;
}

export interface FichaSindicanciaData {
  // Cabeçalho e Cadastro Principal
  assistidoNome: string;
  assistidoDataNasc?: string;
  assistidoCpf?: string;
  assistidoRg?: string;
  assistidoTelefone?: string;
  conjugeNome?: string;
  conjugeDataNasc?: string;
  
  // Endereço e Moradia
  endereco: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
  estadoCivil?: 'solteiro' | 'casado' | 'uniao_estavel' | 'divorciado' | 'viuvo' | 'separado' | string;
  religiao?: string;
  situacaoMoradia?: 'propria' | 'alugada' | 'cedida' | 'invasao' | 'financiada' | 'outros' | string;

  // Membros da Família
  membrosFamilia: MembroFamiliarComposicao[];

  // Situação Financeira
  profissao?: string;
  quantosTrabalham?: number;
  valorAluguel?: number;
  rendaLiquida?: number;
  assistenciaGoverno?: string; // Bolsa Família, BPC, etc.
  valorAssistenciaGoverno?: number;
  outrasRendas?: number;

  // Observações Específicas da Sindicância
  alguemDoente?: string; // Alguém doente? Precisa de medicação?
  precisaMedicacao?: boolean;
  medicacaoDetalhes?: string;
  participacaoIgreja?: string; // Participação da Igreja?
  precisamSacramentos?: string; // Precisam dos sacramentos? (Crisma, Matrimônio, Batismo)
  observacoesGerais?: string; // Demais observações

  // Aprovação e Visitadores da 1ª Visita
  visitadoresPrimeiraVisita?: string[]; // Nomes ou IDs dos visitadores
  dataAprovacao?: string; // Data aprovado
  assinaturaPresidenteNome?: string;
  statusSindicancia?: 'em_analise' | 'aprovado' | 'reprovado';
}

export interface VisitaFamiliaSSVP {
  id: string;
  familiaId: string;
  conferenciaId: string;
  centralId: string;
  particularId: string;
  dataVisita: string; // YYYY-MM-DD
  mesAnoCompetencia: string; // YYYY-MM para controle mensal consolidado
  visitadoresIds: string[]; // IDs dos membros que visitaram
  visitadoresNomes: string[]; // Nomes dos membros para facilitar visualização
  entregueCesta: boolean; // Sim/Não
  quantidadeCestas?: number;
  tipoAuxilioExtra?: string; // Ex: Leite, Fralda, Roupas, Medicamento
  comentarios: string;
  proximaVisitaAgendada?: string;
  createdAt: string;
  createdBy?: string;
}

export interface FamiliaAssistidaCompleta {
  id: string;
  centralId: string;
  particularId: string;
  conferenciaId: string;
  
  // Dados Resumidos de Busca
  nomeAssistido: string;
  cpfAssistido?: string;
  telefone?: string;
  enderecoResumido: string;
  
  // Status de Ativação / Arquivamento
  status: 'ativo' | 'arquivado';
  motivoArquivamento?: 'promocao_social' | 'mudanca' | 'falecimento' | 'desistencia' | 'outro' | string;
  dataArquivamento?: string;
  detalhesArquivamento?: string;

  // Dados Completos da Sindicância
  sindicancia: FichaSindicanciaData;

  // Controle de Cestas e Visitas (Cache / Estatísticas Rápidas)
  totalVisitasRealizadas: number;
  totalCestasRecebidas: number;
  dataUltimaVisita?: string;
  recebeuCestaMesAtual?: boolean;
  ultimoMesAnoCesta?: string; // YYYY-MM

  // Metadados
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ControleCestasMensalStats {
  mesAno: string; // YYYY-MM
  conferenciaId: string;
  conferenciaNome?: string;
  totalFamiliasAtivas: number;
  totalFamiliasArquivadas: number;
  totalFamiliasAtendidasComCesta: number;
  totalCestasEntregues: number;
  familiasSemCestaNoMes: number;
}


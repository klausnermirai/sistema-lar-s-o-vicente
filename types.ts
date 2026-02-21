
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

  // Níveis de Decisão
  boardOpinion?: string;
  medicalOpinion?: string;
  medicalStatus?: 'favoravel' | 'desfavoravel';
  integrationDate?: string;
  integrationReport?: string;
  integrationObservations?: string;
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
}

export enum AppRoute {
  RESIDENTS = 'residents',
  SCREENING = 'screening',
  SETTINGS = 'settings'
}

export type SubTab = 'geral' | 'familiares-visitantes' | 'financeiro' | 'itens' | 'saude' | 'medicamentos' | 'convenio';

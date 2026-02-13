
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
  | 'entrevista' 
  | 'aguardando_vaga' 
  | 'decisao_diretoria' 
  | 'avaliacao_medica' 
  | 'integracao' 
  | 'acolhido' 
  | 'arquivado';

export type WaitlistPriority = 'social' | 'saude' | 'geral';

export interface Candidate {
  id: string;
  stage: CandidateStage;
  priority?: WaitlistPriority;
  archiveReason?: string;
  
  // 1. Identificação
  name: string;
  birthDate: string;
  age: string;
  gender: string;
  maritalStatus: string;
  rg: string;
  cpf: string;
  address: string;
  phone: string;

  // 2. Responsável
  repName: string;
  repKinship: string;
  repPhone: string;
  repAddress: string;

  // 3. Composição Familiar e Rede de Apoio
  residesWith: string; // Sozinho, Filhos, Familiares, Outros
  hasChildren: string;
  childrenCount: string;
  hasCaregiver: string; // Não, Sim, Familiar, Profissional
  hasSupportNetwork: string;
  supportNetworkDetails: string;

  // 4. Tabela Composição Familiar
  familyMembers: FamilyMemberRecord[];

  // 5. Condições de Moradia
  housingType: string; // Própria, Alugada, Cedida
  rentValue: string;

  // 6. Situação Socioeconômica
  incomeSource: string[]; // Aposentadoria, Pensão, BPC, Outros
  incomeValue: string;
  hasLoan: string;
  loanValue: string;
  canAffordCare: string; // Sim, Não, Parcialmente

  // 7. Condições de Saúde
  medicalDiagnoses: string;
  continuousMedication: string;
  medicationDetails: string;
  regularMedicalFollowup: string;
  cognitiveImpairment: string;
  cognitiveDetails: string;

  // 8. Grau de Dependência
  depHygiene: string;
  depFeeding: string;
  depMobility: string; // Sim, Não, Andador, Cadeira de Rodas
  depBathroom: string;
  depMedication: string;

  // 9. Aspectos Psicossociais
  needsFullTimeCare: string;
  familyConflicts: string;
  conflictDetails: string;
  elderlyAgrees: string; // Sim, Não, Parcialmente
  familyAgrees: string;

  // 10. Motivo da Solicitação
  admissionReason: string;

  // 11. Parecer Social
  socialOpinion: string;
  
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
  SCREENING = 'screening'
}

export type SubTab = 'geral' | 'familiares-visitantes' | 'financeiro' | 'itens' | 'saude' | 'medicamentos' | 'convenio';

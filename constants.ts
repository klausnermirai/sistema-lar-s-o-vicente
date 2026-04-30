
import { Resident, Candidate, NursingScreening, Companion } from './types';

export const COLORS = {
  primary: '#004c99',
  secondary: '#e31b23',
  accent: '#1e3a8a',
  background: '#f8fafc',
};

export const INITIAL_COMPANIONS: Companion[] = [
  { id: 'c1', institutionId: 'dummy', name: 'Ana Oliveira', role: 'tecnico', phone: '(11) 98888-7777' },
  { id: 'c2', institutionId: 'dummy', name: 'Roberto Santos', role: 'cuidador', phone: '(11) 97777-6666' },
  { id: 'c3', institutionId: 'dummy', name: 'Maria Silva', role: 'acompanhante', phone: '(11) 96666-5555' },
];

export const INITIAL_NURSING_SCREENING: NursingScreening = {
  date: new Date().toISOString().split('T')[0],
  vitalSigns: {
    paSystolic: 120,
    paDiastolic: 80,
    fc: 70,
    fr: 16,
    temperature: 36.5,
    spo2: 98,
    hgtValue: 90,
    hgtType: 'jejum',
    weight: '',
    height: ''
  },
  clinicalHistory: {
    allergies: '',
    comorbidities: [],
    surgeries: '',
    habits: {
      smoking: false,
      alcohol: false
    },
    medications: ''
  },
  functionalAssessment: {
    mobility: 'deambula',
    continence: 'continente',
    consciousness: 'lucido',
    communication: [],
    dependencyLevel: 'independente'
  },
  physicalExam: {
    skinIntegrity: 'integra',
    nutritionalStatus: 'via_oral',
    sleepPattern: 'dorme_bem'
  },
  healthSupport: {
    susCard: '',
    referenceUBS: '',
    referenceDoctor: '',
    activeBenefits: []
  },
  professionalName: '',
  signatureDate: new Date().toISOString().split('T')[0]
};

export const INITIAL_CANDIDATE: Candidate = {
  id: '',
  stage: 'agendamentos',
  name: '',
  birthDate: '',
  age: '',
  gender: '',
  maritalStatus: '',
  rg: '',
  cpf: '',
  address: '',
  phone: '',
  repName: '',
  repKinship: '',
  repPhone: '',
  repAddress: '',
  admissionReason: '',
  socialOpinion: '',
  priority: 'padrao',
  requestOrigin: 'CONTATO DIRETO',
  requestDescription: '',
  institutionId: '',
  createdAt: new Date().toISOString(),
  interview: {
    residesWith: '',
    hasChildren: '',
    childrenCount: '',
    hasCaregiver: '',
    hasSupportNetwork: '',
    supportNetworkDetails: '',
    familyTable: [],
    housingType: '',
    rentValue: '',
    incomeSource: '',
    incomeValue: '',
    hasLoan: '',
    loanValue: '',
    canAffordCare: '',
    medicalDiagnoses: '',
    continuousMedication: '',
    medicationDetails: '',
    regularMedicalFollowup: '',
    cognitiveImpairment: '',
    cognitiveDetails: '',
    depHygiene: '',
    depFeeding: '',
    depMobility: '',
    depBathroom: '',
    depMedication: '',
    needsFullTimeCare: '',
    familyConflicts: '',
    conflictDetails: '',
    elderlyAgrees: '',
    familyAgrees: '',
    requestReason: '',
    socialAnalysis: ''
  },
  nursingScreening: INITIAL_NURSING_SCREENING
};

export const INITIAL_RESIDENT: Resident = {
  id: '',
  name: '',
  gender: 'Masculino',
  birthDate: '',
  nationality: '',
  naturalness: '',
  maritalStatus: '',
  education: '',
  fatherName: '',
  motherName: '',
  nickname: '',
  profession: '',
  spouse: '',
  preferredHospitals: '',
  observations: '',
  cpf: '',
  rg: '',
  issuingBody: '',
  voterTitle: '',
  voterSection: '',
  voterZone: '',
  certType: '',
  certNumber: '',
  certPage: '',
  certBook: '',
  certCity: '',
  certState: '',
  certDate: '',
  samsCard: '',
  susCard: '',
  cadUnico: '',
  inssNumber: '',
  inssType: '',
  inssStatus: '',
  cep: '',
  city: '',
  state: '',
  neighborhood: '',
  address: '',
  addressNumber: '',
  reference: '',
  complement: '',
  stayType: 'Residente',
  admissionDate: '',
  room: '',
  bedNumber: '',
  income: '',
  admissionReason: '',
  residentGroup: '',
  dependencyLevel: '',
  previousInstitution: '',
  stayTime: '',
  changeReason: '',
  relatives: [],
  visitRecords: [],
  financials: [],
  personalItems: [],
  healthUpdates: [],
  medications: [],
  institutionId: '',
  isArchived: false,
};

export const DUMMY_CANDIDATES: Candidate[] = [
  {
    ...INITIAL_CANDIDATE,
    id: 'c0',
    name: 'LUÍS GONZAGA DA SILVA',
    stage: 'agendamentos',
    phone: '(16) 98112-9988',
    admissionReason: 'Solicitação via CRAS. Idoso em situação de isolamento severo.',
    createdAt: '2024-05-20'
  }
];

export const DUMMY_RESIDENTS: Resident[] = [
  {
    ...INITIAL_RESIDENT,
    id: '1',
    name: 'RAIMUNDO NONATO ROCHA',
    gender: 'Masculino',
    birthDate: '1931-08-15',
    naturalness: 'ARACAJU',
    maritalStatus: 'Solteiro(a)',
    profession: 'APOSENTADO',
    fatherName: 'MANOEL FURTADO DA ROCHA',
    motherName: 'FRANCISCA ROMAO DO NASCIMENTO',
    cpf: '755.588.158-68',
    rg: '19.492.935-8',
    issuingBody: 'SSP',
    admissionDate: '2022-12-21',
    room: 'Ala B - Quarto 06',
    stayType: 'Residente / Mensalista',
    photo: 'https://images.unsplash.com/photo-1544144433-d50aff500b91?w=400&h=400&fit=crop',
    relatives: [
      { id: 'r1', name: 'CARLOS ROCHA', kinship: 'Filho', phone: '(11) 98877-6655', isResponsible: true, observation: 'Contato preferencial para emergências' },
      { id: 'r2', name: 'ANA ROCHA', kinship: 'Filha', phone: '(11) 97766-5544', isResponsible: false, observation: 'Visitas aos domingos' }
    ],
    visitRecords: [
      { id: 'v1', date: '2024-05-15', visitorName: 'CARLOS ROCHA', visitorDoc: '12.345.678-9', timeIn: '14:00', timeOut: '16:30', observation: 'Visitou e trouxe frutas.' }
    ],
    financials: [
      { id: 'f1', date: '2024-05-01', type: 'entrada', description: 'Aposentadoria INSS', amount: 1412.00 },
      { id: 'f2', date: '2024-05-05', type: 'saída', description: 'Mensalidade Instituição', amount: 988.40 }
    ],
    personalItems: [
      { id: 'i1', description: 'Rádio de Pilha Sony', status: 'Entrada', date: '2022-12-21', observation: 'Uso constante no quarto' },
      { id: 'i2', description: 'Óculos de Grau', status: 'Entrada', date: '2022-12-21', observation: 'Armação preta' }
    ],
    healthUpdates: [
      { id: 'h1', date: '2024-05-10', summary: 'Check-up Mensal', professional: 'Dr. Marcos Silva', observation: 'Pressão arterial estável 12x8. Continuar medicação.' }
    ],
    medications: [
      { id: 'm1', name: 'Enalapril', concentration: '20mg', dose: '1 comprimido', frequency: 2, times: ['08:00', '20:00'], type: 'continuo', startDate: '2024-05-01', stock: 15, lastUpdate: '2024-05-01' },
      { id: 'm2', name: 'Metformina', concentration: '850mg', dose: '1 comprimido', frequency: 3, times: ['08:00', '14:00', '20:00'], type: 'continuo', startDate: '2024-05-01', stock: 4, lastUpdate: '2024-05-01' }
    ]
  }
];

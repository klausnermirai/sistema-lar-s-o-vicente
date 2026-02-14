
import { Resident, Candidate } from './types';

export const COLORS = {
  primary: '#004c99',
  secondary: '#e31b23',
  accent: '#1e3a8a',
  background: '#f8fafc',
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
  residesWith: '',
  hasChildren: '',
  childrenCount: '',
  hasCaregiver: '',
  hasSupportNetwork: '',
  supportNetworkDetails: '',
  familyMembers: [],
  housingType: '',
  rentValue: '',
  incomeSource: [],
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
  depHygiene: 'Sim',
  depFeeding: 'Sim',
  depMobility: 'Sim',
  depBathroom: 'Sim',
  depMedication: 'Sim',
  needsFullTimeCare: '',
  familyConflicts: '',
  conflictDetails: '',
  elderlyAgrees: '',
  familyAgrees: '',
  admissionReason: '',
  socialOpinion: '',
  createdAt: new Date().toISOString()
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
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c1',
    name: 'JOÃO PEREIRA DOS SANTOS',
    stage: 'aguardando_vaga',
    priority: 'social',
    phone: '(16) 99887-1122',
    admissionReason: 'Mora sozinho em situação de risco social grave. Sem rede de apoio familiar.',
    socialOpinion: 'Candidato apresenta alto risco social, residência insalubre e ausência de cuidadores.',
    createdAt: '2024-04-10'
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c2',
    name: 'CARMEN LÚCIA MENDES',
    stage: 'entrevista',
    phone: '(16) 99223-3344',
    createdAt: '2024-05-18'
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c3',
    name: 'ANTÔNIO MARCOS DA SILVA',
    stage: 'decisao_diretoria',
    priority: 'geral',
    phone: '(16) 99112-2233',
    admissionReason: 'Família não possui condições de custear cuidadores domiciliares.',
    createdAt: '2024-03-22'
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c4',
    name: 'MARIA APARECIDA OLIVEIRA',
    stage: 'avaliacao_medica',
    priority: 'saude',
    phone: '(16) 3202-0099',
    admissionReason: 'Apresenta início de demência senil e quedas frequentes.',
    createdAt: '2024-02-15'
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c5',
    name: 'BENEDITO JUSTINO',
    stage: 'integracao',
    priority: 'geral',
    phone: '(16) 99778-8811',
    admissionReason: 'Viuvez recente, entrando em quadro depressivo por isolamento.',
    createdAt: '2024-05-01'
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c6',
    name: 'RICARDO FERREIRA',
    stage: 'arquivado',
    archiveReason: 'Falecimento',
    phone: '(16) 3344-5566',
    admissionReason: 'Aguardava vaga mas veio a óbito por complicações cardíacas.',
    createdAt: '2023-11-12'
  },
  {
    ...INITIAL_CANDIDATE,
    id: 'c7',
    name: 'HELENA SOUZA',
    stage: 'arquivado',
    archiveReason: 'Inapto Saúde',
    phone: '(16) 99111-0000',
    admissionReason: 'Necessita de cuidados hospitalares contínuos não suportados pela ILPI.',
    createdAt: '2024-01-20'
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
      { id: 'm1', name: 'Enalapril 20mg', dosage: '1 comprimido', frequency: '12/12h', stock: 15, lastUpdate: '2024-05-01' },
      { id: 'm2', name: 'Metformina 850mg', dosage: '1 comprimido', frequency: '8/8h', stock: 4, lastUpdate: '2024-05-01' }
    ]
  }
];

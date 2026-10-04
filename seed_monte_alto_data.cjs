const fs = require('fs');

const csv = fs.readFileSync('legacy_data.csv', 'utf8');

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
    let match;
    const values = [];
    while ((match = regex.exec(line)) !== null) {
      let val = match[1] || '';
      if (val.startsWith('\"') && val.endsWith('\"')) {
        val = val.slice(1, -1).replace(/\"\"/g, '\"');
      }
      values.push(val);
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }
    while (values.length > headers.length) values.pop();
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

const csvRows = parseCSV(csv);

const monteAltoInstId = 'ga6jzrx1flf';
const monteAltoCnpj = '52.853.397/0001-68';

// Build candidates dictionary
const candidatesDict = {};
const residentsDict = {};

// 1. Convert CSV rows to Candidates and Residents
csvRows.forEach(row => {
  if (!row.nome_idoso || row.nome_idoso === 'teste' || row.nome_idoso === 'd+' || row.nome_idoso === 'JO') {
    // skip test placeholders if desired, or keep as test
    return;
  }

  const candidateId = row.id;
  const isAcolhido = row.etapa_codigo === 'acolhido';

  const candidateObj = {
    id: candidateId,
    name: row.nome_idoso,
    stage: row.etapa_codigo || 'agendamentos',
    priority: row.prioridade_codigo || 'padrao',
    phone: row.telefone || '',
    address: row.endereco_visita || '',
    admissionReason: row.descricao_caso || '',
    requestOrigin: row.origem_indicacao || 'CONTATO DIRETO',
    requestDescription: row.descricao_caso || '',
    institutionId: monteAltoInstId,
    createdAt: row.criado_em || new Date().toISOString().split('T')[0],
    admissionDate: row.data_admissao || '',
    socialOpinion: row.parecer_diretoria || '',
    archiveReason: row.motivo_arquivamento || '',
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
      requestReason: row.descricao_caso || '',
      socialAnalysis: ''
    }
  };

  candidatesDict[candidateId] = candidateObj;

  // If stage is 'acolhido', also create a Resident record
  if (isAcolhido) {
    const residentId = 'res-' + candidateId.substring(0, 8);
    residentsDict[residentId] = {
      id: residentId,
      name: row.nome_idoso,
      gender: 'Masculino',
      birthDate: '1945-01-01',
      admissionDate: row.data_admissao || '2026-04-14',
      status: 'ativo',
      institutionId: monteAltoInstId,
      cnpj: monteAltoCnpj,
      room: 'Ala A - Quarto 01',
      stayType: 'Residente / Mensalista',
      observations: row.descricao_caso || '',
      address: row.endereco_visita || 'Monte Alto, SP',
      phone: row.telefone || '',
      medications: [],
      relatives: [],
      financials: [],
      personalItems: [],
      healthUpdates: []
    };
  }
});

// 2. Add Raimundo Nonato Rocha as resident for Monte Alto
residentsDict['res-montealto-1'] = {
  id: 'res-montealto-1',
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
  institutionId: monteAltoInstId,
  cnpj: monteAltoCnpj,
  city: 'Monte Alto',
  state: 'SP',
  relatives: [
    { id: 'r1', name: 'CARLOS ROCHA', kinship: 'Filho', phone: '(16) 98877-6655', isResponsible: true, observation: 'Contato preferencial para emergências' }
  ],
  medications: [
    { id: 'm1', name: 'Enalapril', concentration: '20mg', dose: '1 comprimido', frequency: 2, times: ['08:00', '20:00'], type: 'continuo', startDate: '2024-05-01', stock: 15, lastUpdate: '2024-05-01' },
    { id: 'm2', name: 'Metformina', concentration: '850mg', dose: '1 comprimido', frequency: 3, times: ['08:00', '14:00', '20:00'], type: 'continuo', startDate: '2024-05-01', stock: 20, lastUpdate: '2024-05-01' }
  ],
  healthUpdates: [
    { id: 'h1', date: '2026-03-10', summary: 'Check-up Mensal', professional: 'Dr. Marcos Silva', observation: 'Pressão arterial estável 12x8. Continuar medicação.' }
  ]
};

// 3. Update db_fallback.json
const dbFallback = JSON.parse(fs.readFileSync('db_fallback.json', 'utf8'));

if (!dbFallback.candidates) {
  dbFallback.candidates = {};
}
Object.assign(dbFallback.candidates, candidatesDict);

if (!dbFallback.residents) {
  dbFallback.residents = {};
}
Object.assign(dbFallback.residents, residentsDict);

// Ensure institutions has Monte Alto correctly
dbFallback.institutions['ga6jzrx1flf'] = {
  id: 'ga6jzrx1flf',
  name: 'Lar São Vicente de Paulo de Monte Alto',
  cnpj: '52.853.397/0001-68',
  type: 'obra_unida',
  entityType: 'obra_unida',
  city: 'Monte Alto',
  createdAt: '2026-08-25T11:07:31.884Z'
};

dbFallback.institutions['52.853.397/0001-68'] = {
  id: '52.853.397/0001-68',
  name: 'Lar São Vicente de Paulo de Monte Alto',
  cnpj: '52.853.397/0001-68',
  type: 'obra_unida',
  entityType: 'obra_unida',
  city: 'Monte Alto',
  createdAt: '2026-08-25T11:07:31.884Z'
};

fs.writeFileSync('db_fallback.json', JSON.stringify(dbFallback, null, 2), 'utf8');

console.log('Seeding concluído com sucesso!');
console.log('Total de candidatos adicionados para Monte Alto:', Object.keys(candidatesDict).length);
console.log('Total de residentes adicionados para Monte Alto:', Object.keys(residentsDict).length);

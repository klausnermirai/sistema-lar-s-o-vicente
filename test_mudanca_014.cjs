const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

const root = __dirname;
const elderly = fs.readFileSync(path.join(root, 'components', 'ElderlyForm.tsx'), 'utf8');
const pront = fs.readFileSync(path.join(root, 'components', 'ProntuarioTab.tsx'), 'utf8');
const social = fs.readFileSync(path.join(root, 'components', 'SocialWorkerTab.tsx'), 'utf8');
const multi = fs.readFileSync(path.join(root, 'components', 'MultidisciplinaryModule.tsx'), 'utf8');

check(elderly.includes('fetchResidentById'), 'Cadastro geral busca residente completo sob demanda');
check(elderly.includes("activeTab !== 'prontuario'"), 'Carga completa é restrita à aba de prontuário');
check(elderly.includes('prontuarioResident || formData'), 'Prontuário usa residente completo sem sobrescrever formData');

check(social.includes('onChange(nextSocialWork)'), 'Serviço Social sincroniza estado pai após salvar/excluir');
check(multi.includes("setFullResident(prev => prev ? { ...prev, socialWork: socialData } : prev)"), 'Sincronização do Serviço Social não salva residente inteiro');

check(pront.includes("const isConfidential = ev.visibility === 'confidential'"), 'Prontuário identifica registro social sigiloso');
check(pront.includes('Conteúdo protegido. Autenticação necessária para visualização.'), 'Registro sigiloso permanece oculto por padrão');
check(pront.includes('createSocialWorkReauthToken'), 'Prontuário reaproveita reautenticação existente');
check(pront.includes('unlockConfidentialSocialRecord'), 'Prontuário reaproveita endpoint de desbloqueio existente');
check(pront.includes("accessLevel === 'assistente_social'"), 'Somente Assistente Social recebe opção de desbloqueio');
check(pront.includes("setUnlockedSocialRecords({})"), 'Conteúdo desbloqueado é limpo ao trocar de residente');
check(pront.includes('[Registro sigiloso do Serviço Social — conteúdo protegido.]'), 'PDF não revela conteúdo social sigiloso');
check(!pront.includes('ev.description.substring(0, 80)'), 'Prontuário não chama substring em description confidencial ausente');
check(pront.includes('const [filterCompetence, setFilterCompetence] = useState<string>(\'\');'), 'Filtro de competência inicia em Todas');

console.log('\nMudança 014:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

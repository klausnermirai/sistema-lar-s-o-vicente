const fs = require('fs');
const path = require('path');

const per = fs.readFileSync(path.join(__dirname, 'components', 'PerTab.tsx'), 'utf8');
const elderly = fs.readFileSync(path.join(__dirname, 'components', 'ElderlyForm.tsx'), 'utf8');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(per.includes('settings?: InstitutionSettings | null'), 'PER recebe settings institucional');
check(per.includes('handleGeneratePdf'), 'PER possui geração de PDF contextual');
check(per.includes('createPdfContext'), 'PER usa helper compartilhado de paginação');
check(per.includes('Prontuário Clínico do Residente'), 'PDF clínico usa título correto');
check(per.includes('Alergias e alertas'), 'PDF inclui alergias e alertas');
check(per.includes('Última aferição de sinais vitais'), 'PDF inclui última aferição');
check(per.includes('Resumo da admissão e histórico clínico'), 'PDF inclui histórico clínico');
check(per.includes('Quadro funcional e dependências'), 'PDF inclui dependências');
check(per.includes('Condutas SOS / medicações eventuais autorizadas'), 'PDF inclui protocolos SOS ativos');
check(per.includes('Registros de consultas e evolução clínica'), 'PDF inclui evoluções clínicas');
check(per.includes('progress.professionalName') && per.includes('progress.crm'), 'Evoluções preservam profissional e CRM');
check(!per.includes('window.print()'), 'PER não usa impressão da tela');
check(elderly.includes('settings={settings}') && elderly.includes('<PerTab'), 'ElderlyForm propaga settings ao PER');

console.log('\nMudança 015C:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

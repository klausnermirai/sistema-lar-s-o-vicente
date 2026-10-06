const fs = require('fs');
const path = require('path');

const elderly = fs.readFileSync(path.join(__dirname, 'components', 'ElderlyForm.tsx'), 'utf8');
const meds = fs.readFileSync(path.join(__dirname, 'components', 'MedicationTab.tsx'), 'utf8');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(elderly.includes('handleGenerateFinancePdf'), 'Financeiro possui PDF contextual');
check(elderly.includes('financeDateFrom') && elderly.includes('financeDateTo'), 'Financeiro possui filtro por período');
check(elderly.includes('Extrato Financeiro Individual'), 'PDF financeiro usa título correto');
check(elderly.includes('Saldo inicial') && elderly.includes('Saldo atual geral'), 'PDF financeiro inclui resumo');
check(elderly.includes('handleGenerateItemsPdf'), 'Itens pessoais possuem PDF contextual');
check(elderly.includes('Relação de Itens Pessoais'), 'PDF de itens usa título correto');
check(meds.includes('handleGeneratePdf'), 'Medicamentos possuem PDF contextual');
check(meds.includes('Relação de Medicamentos em Uso'), 'PDF de medicamentos usa título correto');
check(meds.includes('createPdfContext'), 'Medicamentos usam helper compartilhado de paginação');
check(meds.includes('settings?: InstitutionSettings | null'), 'Medicamentos recebem configuração institucional');
check(!meds.includes('window.print()'), 'Medicamentos não usam impressão de tela');
check(elderly.includes('createPdfContext'), 'Financeiro e Itens usam helper compartilhado');

console.log('\nMudança 015B:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

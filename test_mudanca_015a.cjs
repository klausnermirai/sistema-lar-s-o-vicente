const fs = require('fs');
const path = require('path');

const elderly = fs.readFileSync(path.join(__dirname, 'components', 'ElderlyForm.tsx'), 'utf8');
const incidents = fs.readFileSync(path.join(__dirname, 'components', 'IntercurrenceHistoryTab.tsx'), 'utf8');
const helpers = fs.readFileSync(path.join(__dirname, 'lib', 'pdfHelpers.ts'), 'utf8');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(!elderly.includes('window.print()'), 'Botão global não usa mais window.print');
check(!elderly.includes('printable-area'), 'Área legada de impressão foi removida');
check(elderly.includes('handleGenerateCadastroPdf'), 'Ficha cadastral possui PDF contextual');
check(elderly.includes('handleGenerateFamiliaresPdf'), 'Familiares possuem PDF contextual');
check(elderly.includes('handleGenerateVisitasPdf'), 'Visitas possuem PDF contextual');
check(elderly.includes('visitDateFrom') && elderly.includes('visitDateTo'), 'Relação de visitas possui filtro por período');
check(incidents.includes('handleGeneratePdf'), 'Intercorrências possuem PDF contextual');
check(incidents.includes('filteredIncidents'), 'PDF de intercorrências respeita o filtro atual');
check(helpers.includes('export const createPdfContext'), 'Helper mínimo compartilhado foi criado');
check(helpers.includes('CONTENT_TOP = 60') && helpers.includes('CONTENT_BOTTOM = 278'), 'Helper preserva área útil segura');
check(helpers.includes('ensureSpace') && helpers.includes('writeText') && helpers.includes('safeValue'), 'Helper centraliza paginação e valores seguros');
check(elderly.includes('settings={settings}'), 'Intercorrências recebem configuração institucional para cabeçalho');
check(elderly.includes('Gerar Ficha Cadastral PDF'), 'Botão contextual da ficha aparece na aba');
check(elderly.includes('GERAR CADASTRO PDF') && elderly.includes('GERAR RELAÇÃO PDF'), 'Botões contextuais de familiares e visitas aparecem');

console.log('\nMudança 015A:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

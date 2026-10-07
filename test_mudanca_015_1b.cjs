const fs = require('fs');
const path = require('path');

const social = fs.readFileSync(path.join(__dirname, 'components', 'SocialWorkerTab.tsx'), 'utf8');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(social.includes('const handlePrintSingleAction = async'), 'Impressão individual é assíncrona');
check(social.includes('await getHtmlPrintHeader(settings, "RELATÓRIO DE AÇÃO DO SERVIÇO SOCIAL")'), 'Impressão individual aguarda o cabeçalho');
check(social.includes('const handlePrintFullHistory = async'), 'Histórico completo é assíncrono');
check(social.includes('await getHtmlPrintHeader(settings, "PRONTUÁRIO SOCIAL - HISTÓRICO DE ATENDIMENTOS E EVOLUÇÕES")'), 'Histórico completo aguarda o cabeçalho');
check((social.match(/<style>\$\{getHtmlPrintStyles\(\)\}<\/style>/g) || []).length === 2, 'Os dois PDFs encapsulam CSS em style');
check(!social.includes('const headerHtml = getHtmlPrintHeader('), 'Não resta interpolação de Promise no cabeçalho');
check(social.includes('[REGISTRO SIGILOSO - CONTEÚDO NÃO INCLUÍDO NO HISTÓRICO GERAL]'), 'Sigilo do histórico geral foi preservado');
check(social.includes('[CONTEÚDO SIGILOSO - PROTEGIDO POR SIGILO PROFISSIONAL]'), 'Sigilo da impressão individual foi preservado');
check(social.includes('printHtml(html);'), 'Fluxo HTML existente continua sendo usado');

console.log('\nMudança 015.1B:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

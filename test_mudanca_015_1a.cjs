const fs = require('fs');
const path = require('path');

const prontuario = fs.readFileSync(path.join(__dirname, 'components', 'ProntuarioTab.tsx'), 'utf8');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(prontuario.includes('const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)'), 'Existe estado de geração do PDF');
check(prontuario.includes('if (isGeneratingPdf) return'), 'Clique duplo é bloqueado');
check(prontuario.includes("setIsGeneratingPdf(true)"), 'Estado de geração é ativado');
check(prontuario.includes("setIsGeneratingPdf(false)"), 'Estado de geração é restaurado');
check(prontuario.includes("finally"), 'Restauração ocorre em finally');
check(prontuario.includes("Gerando PDF..."), 'Botão informa processamento');
check(prontuario.includes("disabled={isGeneratingPdf}"), 'Botão é desabilitado durante geração');
check(prontuario.includes('type="month"'), 'Existe atalho Mês/Ano');
check(prontuario.includes("setFilterStartDate(`${year}-${month}-01`)"), 'Mês/Ano define primeiro dia');
check(prontuario.includes("new Date(Number(year), Number(month), 0).getDate()"), 'Mês/Ano calcula último dia corretamente');
check(prontuario.includes("setFilterEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`)"), 'Mês/Ano define último dia');
check(prontuario.includes("CONTENT_TOP = 60") && prontuario.includes("CONTENT_BOTTOM = 278"), 'Paginação 014.1 preservada');
check(prontuario.includes("[Registro sigiloso do Serviço Social — conteúdo protegido.]"), 'Sigilo do Serviço Social preservado');
check(prontuario.includes("Conteúdo restrito"), 'Restrição de Psicologia preservada');

console.log('\nMudança 015.1A:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

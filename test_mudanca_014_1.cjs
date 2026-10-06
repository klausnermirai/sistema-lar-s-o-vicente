const fs = require('fs');
const path = require('path');

const file = fs.readFileSync(path.join(__dirname, 'components', 'ProntuarioTab.tsx'), 'utf8');
let passed = 0;
let failed = 0;
const check = (cond, name) => {
  if (cond) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(file.includes('const CONTENT_TOP = 60;'), 'PDF reserva margem superior para cabeçalho/título');
check(file.includes('const CONTENT_BOTTOM = 278;'), 'PDF reserva margem inferior antes do rodapé');
check(file.includes('const ensureSpace = (requiredHeight: number)'), 'PDF possui controle centralizado de espaço');
check(file.includes('const writeWrappedText = ('), 'PDF escreve texto quebrado com paginação');
check(file.includes('lines.forEach((line) => {') && file.includes('ensureSpace(LINE_HEIGHT);'), 'Textos longos quebram entre páginas sem invadir rodapé');
check(file.includes('ensureSpace(22);'), 'Novo registro não inicia sem espaço mínimo');
check(file.includes("safeValue(att.attendanceEvolution, 'Não informada')"), 'Atendimentos sem evolução não imprimem undefined');
check(file.includes("[Registro sigiloso do Serviço Social — conteúdo protegido.]"), 'Sigilo do Serviço Social permanece protegido no PDF');
check(!file.includes('if (yPos > 270)'), 'Quebra antiga baseada apenas na posição foi removida');
check(!file.includes('let yPos = 45;'), 'Conteúdo não inicia mais sobre o cabeçalho');

console.log('\nCorreção 014.1:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const camera = read('components/FacialRecognitionCamera.tsx');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) {
    passed++;
    console.log('PASS:', name);
  } else {
    failed++;
    console.error('FAIL:', name);
  }
};

check(camera.includes('const RECOGNITION_WINDOW_MS = 3000'), 'janela de reconhecimento é 3 segundos');
check(camera.includes('const MIN_RECOGNITION_MS = 2000'), 'não confirma antes de 2 segundos');
check(camera.includes('const REQUIRED_STABLE_MATCHES = 3'), 'exige 3 matches estáveis');
check(camera.includes('stableMatchSimilaritiesRef'), 'armazena similaridades da sequência estável');
check(camera.includes('averageSimilarity'), 'confiança final usa média das leituras estáveis');
check(camera.includes('hasMinimumObservationTime && hasStableEvidence'), 'reconhecimento exige tempo mínimo e estabilidade');
check(camera.includes('showUnrecognizedResult'), 'estado de não reconhecido é explícito');
check(!camera.includes('openAutomaticQuickRegistration'), 'cadastro não abre automaticamente após falha');
check(camera.includes('Você pode tentar novamente ou cadastrar este visitante.'), 'UX oferece decisão simples após não reconhecimento');
check(camera.includes('Tentar Novamente'), 'ação de tentar novamente permanece disponível');
check(camera.includes('Cadastrar Novo'), 'ação de cadastrar novo permanece disponível');
check(!camera.includes('Cadastro rápido aberto automaticamente.'), 'mensagem antiga de cadastro automático foi removida');
check(!camera.includes('elapsedMs >= 4000'), 'lógica antiga de 4 segundos foi removida');
check(camera.includes('RECOGNITION_WINDOW_MS - elapsedMs'), 'progresso usa a nova janela temporal');
check(camera.includes("setScanSecondsLeft(3.0)"), 'contador é resetado para 3 segundos');
check(camera.includes("Não houve correspondência segura com os cadastros desta instituição."), 'mensagem de falha enfatiza correspondência segura');
check(!camera.includes('Mais próximo:'), 'UX não exibe candidato aproximado para usuário não reconhecido');

console.log('\nMudança 016C:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

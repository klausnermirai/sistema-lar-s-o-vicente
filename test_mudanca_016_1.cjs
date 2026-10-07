const fs = require('fs');
const path = require('path');

const camera = fs.readFileSync(path.join(__dirname, 'components/FacialRecognitionCamera.tsx'), 'utf8');

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

check(camera.includes('text-gray-900 placeholder:text-gray-400'), 'campos possuem texto escuro explícito');
check(camera.includes('Capturando biometria...'), 'estado de captura é explícito');
check(camera.includes('Biometria e Foto Prontas'), 'estado de sucesso é explícito');
check(camera.includes('Biometria não concluída'), 'estado de falha é explícito');
check(camera.includes('Não houve leituras faciais suficientes. Tente novamente antes de confirmar o cadastro.'), 'falha orienta nova captura');
check(camera.includes('Recapturar Biometria'), 'sucesso permite recaptura');
check(camera.includes('Capturar Biometria'), 'falha oferece nova captura');
check(camera.includes('disabled={isCapturingInModal}'), 'botão final só fica bloqueado durante captura');
check(!camera.includes('disabled={isCapturingInModal || !isFaceDescriptorValid(manualCapturedDescriptor)}'), 'botão não fica silenciosamente bloqueado por descriptor ausente');
check(camera.includes("alert('Não foi possível obter uma biometria facial válida. Recapture a foto ou utilize a entrada manual.');"), 'handler mantém bloqueio de integridade com feedback');
check(camera.includes('isFaceDescriptorValid(manualCapturedDescriptor) ? ('), 'status visual usa validade real do descriptor');
check(camera.includes('handleCaptureManualPhotoInModal'), 'rotina biométrica existente é reutilizada');

console.log('\nMudança 016.1:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

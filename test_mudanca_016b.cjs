const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const face = read('lib/faceRecognition.ts');
const camera = read('components/FacialRecognitionCamera.tsx');
const portal = read('components/VisitorPortal.tsx');

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

check(face.includes('export const averageFaceDescriptors'), 'helper de média de embeddings existe');
check(face.includes('export const captureFaceEnrollment'), 'helper de captura multi-amostral existe');
check(face.includes('durationMs = options?.durationMs ?? 3000'), 'cadastro usa janela padrão de 3 segundos');
check(face.includes('minSamples = options?.minSamples ?? 4'), 'cadastro exige mínimo de 4 amostras');
check(face.includes('maxSamples = options?.maxSamples ?? 8'), 'cadastro limita amostras');
check(face.includes('minimumConsistency = options?.minimumConsistency ?? 60'), 'cadastro rejeita amostras inconsistentes');
check(face.includes('calculateFaceSimilarity(descriptors[0], candidate) >= minimumConsistency'), 'consistência entre amostras é validada');
check(face.includes('average[i] /= norm'), 'centróide é normalizado em L2');
check(camera.includes('captureFaceEnrollment(videoRef.current)'), 'Portaria usa captura multi-amostral');
check(camera.includes('isCapturingLink'), 'vínculo existente tem estado de captura');
check(camera.includes("isCapturingInModal ? 'Capturando 3s...'"), 'cadastro rápido informa captura de 3 segundos');
check(camera.includes('const descriptorToUse = manualCapturedDescriptor'), 'cadastro rápido não salva descriptor de frame único');
check(camera.includes('disabled={isCapturingInModal || !isFaceDescriptorValid(manualCapturedDescriptor)}'), 'cadastro rápido bloqueia salvar sem biometria robusta');
check(portal.includes('captureFaceEnrollment(captureVideoRef.current)'), 'cadastro administrativo usa captura multi-amostral');
check(portal.includes('isCapturingFace'), 'cadastro administrativo controla estado de captura');
check(!portal.includes('extractFaceFromCanvasOrVideo'), 'cadastro administrativo não usa snapshot biométrico único');

console.log('\nMudança 016B:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

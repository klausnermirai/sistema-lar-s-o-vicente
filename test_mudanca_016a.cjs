const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const face = read('lib/faceRecognition.ts');
const camera = read('components/FacialRecognitionCamera.tsx');
const portal = read('components/VisitorPortal.tsx');
const copyScript = read('scripts/copy-human-models.mjs');

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

check(pkg.dependencies?.['@vladmandic/human'] === '3.3.6', 'Human 3.3.6 adicionado ao package.json');
check(pkg.scripts?.postinstall === 'node scripts/copy-human-models.mjs', 'postinstall copia modelos locais');
check(lock.packages?.['node_modules/@vladmandic/human']?.version === '3.3.6', 'package-lock contém Human 3.3.6');
check(copyScript.includes('blazeface.json') && copyScript.includes('blazeface.bin'), 'modelos BlazeFace são copiados');
check(copyScript.includes('facemesh.json') && copyScript.includes('facemesh.bin'), 'modelos FaceMesh são copiados');
check(copyScript.includes('faceres.json') && copyScript.includes('faceres.bin'), 'modelos FaceRes são copiados');
check(face.includes("import Human from '@vladmandic/human'"), 'motor usa @vladmandic/human');
check(face.includes("modelBasePath: '/models/'"), 'modelos são carregados localmente');
check(face.includes('rotation: true') && face.includes('description:') && face.includes('mesh:'), 'detecção usa rotação, mesh e descrição facial');
check(face.includes('body:') && face.includes('enabled: false') && face.includes('hand:') && face.includes('object:'), 'módulos desnecessários permanecem desabilitados');
check(face.includes('export const FACE_DESCRIPTOR_LENGTH = 1024'), 'novo embedding FaceRes usa dimensão esperada');
check(face.includes('human.match.similarity'), 'matching usa similaridade nativa do Human');
check(face.includes('human.match.distance'), 'distância usa implementação nativa do Human');
check(!/skinPixel|validateHumanFaceAnatomy|Local Binary Patterns|Pearson|HOG em/i.test(face), 'algoritmo facial artesanal foi removido');
check(camera.includes('await extractFaceFromCanvasOrVideo(videoRef.current)'), 'loop da câmera aguarda inferência neural');
check(camera.includes('recognitionLoopRunningRef.current'), 'loop bloqueia inferências concorrentes');
check(camera.includes('isFaceDescriptorValid(v.faceDescriptor)'), 'câmera ignora descritores biométricos legados');
check(!camera.includes('length === 128') && !camera.includes('length !== 128'), 'câmera não depende mais do descritor legado de 128 posições');
check(portal.includes('isFaceDescriptorValid(v.faceDescriptor)'), 'Portal valida apenas biometria neural compatível');
check(portal.includes('await extractFaceFromCanvasOrVideo(captureVideoRef.current)'), 'captura administrativa aguarda inferência neural');
check(!portal.includes('length === 128') && !portal.includes('length !== 128'), 'Portal não depende mais do descritor legado de 128 posições');

console.log('\nMudança 016A:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLVideoElement = dom.window.HTMLVideoElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 });
dom.window.HTMLMediaElement.prototype.play = async function () {
  assert.ok(this.srcObject, 'video must have a stream before play');
};
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');

let releaseModels;
const modelsReady = new Promise(resolve => { releaseModels = resolve; });
let opened = 0;
const streams = [];
navigator.mediaDevices = {
  enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'camera-1', label: 'Camera 1' }],
  getUserMedia: async () => {
    opened++;
    const track = { stopped: false, stop() { this.stopped = true; } };
    const stream = { getTracks: () => [track] };
    streams.push(stream);
    return stream;
  }
};
let releaseCapture;
let captureCalls = 0;
const validDescriptor = new Array(1024).fill(0.1);
const face = {
  initializeFaceRecognition: () => modelsReady,
  extractFaceFromCanvasOrVideo: async () => ({ detected: false, score: 0 }),
  findBestFaceMatch: () => ({ matched: false }),
  isFaceDescriptorValid: value => Array.isArray(value) && value.length === 1024,
  captureFaceEnrollment: () => {
    captureCalls++;
    return new Promise(resolve => { releaseCapture = resolve; });
  }
};
const source = fs.readFileSync(path.join(__dirname, 'components/FacialRecognitionCamera.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  reportDiagnostics: true
});
assert.equal(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const moduleObject = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  module: moduleObject, exports: moduleObject.exports,
  require: name => name === '../lib/faceRecognition' ? face : require(name),
  window, document, navigator, console, setInterval, clearInterval, setTimeout
});
const Camera = moduleObject.exports.FacialRecognitionCamera;
const root = createRoot(document.getElementById('root'));
const button = label => Array.from(document.querySelectorAll('button')).find(e => e.textContent.trim() === label);
const tick = () => new Promise(resolve => setImmediate(resolve));
const click = async label => {
  const element = button(label);
  assert.ok(element, 'button exists: ' + label);
  await act(async () => { element.click(); await tick(); });
};
const props = {
  institutionId: 'test',
  residents: [{ id: 'r1', name: 'Residente de teste' }],
  registeredVisitors: [],
  onConfirmEntry: async () => { throw new Error('test must not save entry'); },
  onUpdateVisitorFace: async () => { throw new Error('test must not save face'); },
  onRegisterQuickVisitor: async () => { throw new Error('test must not save visitor'); }
};

(async () => {
  await act(async () => { root.render(React.createElement(Camera, props)); await tick(); });
  assert.equal(opened, 0, 'camera waits for models');
  assert.match(document.body.textContent, /Preparando reconhecimento facial/);
  await act(async () => { releaseModels(); await tick(); });
  assert.equal(opened, 1, 'initial selection opens only one camera');
  const mainVideo = document.querySelector('video');
  assert.equal(mainVideo.srcObject, streams[0]);
  assert.ok(!mainVideo.className.includes('invisible'));
  await act(async () => {
    button('Reiniciar Câmera').click();
    button('Reiniciar Câmera').click();
    await tick();
  });
  assert.equal(opened, 2, 'rapid restart opens only newest request');
  assert.ok(streams[0].getTracks()[0].stopped, 'previous camera is stopped');
  // Drive the non-recognized state through the real recognition loop using valid detections.
  face.extractFaceFromCanvasOrVideo = async () => ({
    detected: true, score: 1, descriptor: validDescriptor, thumbnailDataUrl: 'data:image/jpeg;base64,test'
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 3900)); });
  assert.ok(button('Cadastrar Novo'), 'non-recognized face offers registration');
  await click('Cadastrar Novo');
  assert.equal(captureCalls, 0, 'opening registration does not capture automatically');
  assert.match(document.querySelector('input[type=tel]').className, /text-gray-900/);
  assert.match(document.querySelector('select').className, /text-gray-900/);
  await click('Capturar Biometria');
  assert.ok(document.querySelector('[role=dialog]'), 'dedicated capture dialog opens');
  assert.equal(document.querySelector('[role=dialog] video').srcObject, mainVideo.srcObject, 'preview shares existing camera');
  assert.equal(opened, 2, 'opening capture does not request another camera');
  await click('Iniciar captura');
  assert.equal(captureCalls, 1);
  assert.ok(button('Capturando...').disabled, 'capture cannot be started twice');
  await act(async () => { releaseCapture({ detected: false, samplesCollected: 0 }); await tick(); });
  assert.ok(document.querySelector('[role=dialog]'), 'failed capture remains open');
  assert.match(document.querySelector('[role=alert]').textContent, /leituras faciais suficientes/);
  await click('Iniciar captura');
  await act(async () => {
    releaseCapture({ detected: true, descriptor: validDescriptor, thumbnailDataUrl: 'data:image/jpeg;base64,test', samplesCollected: 4 });
    await tick();
  });
  assert.equal(document.querySelector('[role=dialog]'), null, 'successful capture returns to registration');
  assert.match(document.body.textContent, /Biometria e Foto Prontas/);
  assert.ok(button('Recapturar Biometria'), 'successful enrollment permits recapture');
  await act(async () => { root.unmount(); });
  assert.ok(streams.every(stream => stream.getTracks()[0].stopped), 'unmount stops every camera');
  dom.window.close();
  console.log('PASS: real React rendering, preparation, restart, capture modal, retry, success and cleanup');
})().catch(error => { console.error(error); dom.window.close(); process.exit(1); });

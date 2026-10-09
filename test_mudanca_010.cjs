const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('SUÍTE DE TESTES: MUDANÇA 010 (PORTARIA TABLET & RECONHECIMENTO FACIAL)');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedCount++;
  }
}

const serverContent = fs.readFileSync('server.ts', 'utf8');
const typesContent = fs.readFileSync('types.ts', 'utf8');
const visitorPortalContent = fs.readFileSync('components/VisitorPortal.tsx', 'utf8');
const facialCameraContent = fs.readFileSync('components/FacialRecognitionCamera.tsx', 'utf8');

// 1. Tipos e Modelo de Vínculos Múltiplos
console.log('--- 1. Modelo de Dados e Vínculos de Residentes (types.ts) ---');

runTest('RegisteredVisitor suporta linkedResidents?: { residentId: string; residentName: string }[]', () => {
  const rvBlock = typesContent.slice(
    typesContent.indexOf('export interface RegisteredVisitor'),
    typesContent.indexOf('export interface GlobalVisitRecord')
  );
  assert.strictEqual(rvBlock.includes('linkedResidents?: { residentId: string; residentName: string }[];'), true);
  assert.strictEqual(rvBlock.includes('residentId?: string;'), true);
  assert.strictEqual(rvBlock.includes('residentName?: string;'), true);
});

runTest('UnifiedVisitor suporta linkedResidents?: { residentId: string; residentName: string }[]', () => {
  const uvBlock = facialCameraContent.slice(
    facialCameraContent.indexOf('export interface UnifiedVisitor'),
    facialCameraContent.indexOf('interface FacialRecognitionCameraProps')
  );
  assert.strictEqual(uvBlock.includes('linkedResidents?: { residentId: string; residentName: string }[];'), true);
});

// 2. Fullscreen Contínuo e Modo Tablet
console.log('\n--- 2. Experiência de Tablet e Fullscreen Contínuo ---');

runTest('VisitorPortal renderiza botão "Iniciar Portaria em Tela Cheia"', () => {
  assert.strictEqual(visitorPortalContent.includes('Iniciar Portaria em Tela Cheia'), true);
  assert.strictEqual(visitorPortalContent.includes('onClick={enterFullscreen}'), true);
});

runTest('handleCloseFacialMode NÃO executa exitFullscreen()', () => {
  const closeFacialBlock = visitorPortalContent.slice(
    visitorPortalContent.indexOf('const handleCloseFacialMode = () => {'),
    visitorPortalContent.indexOf('const handleCloseFacialMode = () => {') + 100
  );
  assert.strictEqual(closeFacialBlock.includes('exitFullscreen()'), false);
  assert.strictEqual(closeFacialBlock.includes("setEntryMode('choice')"), true);
});

runTest('Finalização da visita facial volta para entryMode "choice" mantendo fullscreen', () => {
  assert.strictEqual(visitorPortalContent.includes("onEntryCompleted={() => setEntryMode('choice')}"), true);
});

// 3. Tela Inicial: Dois Fluxos Claros
console.log('\n--- 3. Tela Inicial da Portaria com Dois Fluxos ---');

runTest('Tela de escolha destaca Reconhecimento Facial para familiares/visitantes de residentes', () => {
  assert.strictEqual(visitorPortalContent.includes('Exclusivo para familiares e visitantes previamente vinculados a residentes.'), true);
});

runTest('Tela de escolha destaca Registro Manual para familiares, SSVP, fiscalização e institucionais', () => {
  assert.strictEqual(visitorPortalContent.includes('Para familiares, SSVP, fiscalização, visitas institucionais e demais acessos.'), true);
});

// 4. Base Facial Estrita
console.log('\n--- 4. Base Facial Estrita (Apenas Residentes e Familiares Vivos) ---');

runTest('facialVisitorsList filtra estritamente visitantes de residentes com biometria válida', () => {
  assert.strictEqual(visitorPortalContent.includes("v.type === 'residente'"), true);
  assert.strictEqual(visitorPortalContent.includes("v.sourceType !== 'global'"), true);
  assert.strictEqual(visitorPortalContent.includes("Array.isArray(v.faceDescriptor) && v.faceDescriptor.length === 128"), true);
});

runTest('Familiares falecidos (deceased: true) são excluídos da base facial', () => {
  assert.strictEqual(visitorPortalContent.includes("filter(rel => !rel.deceased)"), true);
});

runTest('FacialRecognitionCamera repassa registeredVisitors exclusivamente para visitantes com vínculo de residente', () => {
  assert.strictEqual(facialCameraContent.includes("v.type === 'residente' &&"), true);
  assert.strictEqual(facialCameraContent.includes("((Array.isArray(v.linkedResidents) && v.linkedResidents.length > 0) || !!v.residentId)"), true);
});

// 5. Janela de Reconhecimento de 4 Segundos e Estabilidade em 2 Leituras
console.log('\n--- 5. Janela de 4.0s e Estabilização Anti-Falso Positivo ---');

runTest('Janela de reconhecimento configurada para 4.0 segundos com indicador visual', () => {
  assert.strictEqual(facialCameraContent.includes("const [scanSecondsLeft, setScanSecondsLeft] = useState<number>(4.0);"), true);
  assert.strictEqual(facialCameraContent.includes("const remainingSec = Math.max(0, (4000 - elapsedMs) / 1000);"), true);
  assert.strictEqual(facialCameraContent.includes("setScanProgress(Math.min(100, Math.round((elapsedMs / 4000) * 100)));"), true);
});

runTest('Reconhecimento exige duas confirmações consecutivas do mesmo visitante antes de aceitar', () => {
  assert.strictEqual(facialCameraContent.includes("if (stableMatchVisitorIdRef.current === candidateId) {"), true);
  assert.strictEqual(facialCameraContent.includes("stableMatchCountRef.current += 1;"), true);
  assert.strictEqual(facialCameraContent.includes("if (stableMatchCountRef.current >= 2) {"), true);
});

runTest('Match instável reseta a contagem de estabilidade imediatamente', () => {
  assert.strictEqual(facialCameraContent.includes("stableMatchVisitorIdRef.current = null;\n            stableMatchCountRef.current = 0;"), true);
});

runTest('Threshold permanece configurado no padrão de 75', () => {
  assert.strictEqual(facialCameraContent.includes("const [selectedThreshold, setSelectedThreshold] = useState<number>(75);"), true);
});

// 6. Proteção Contra Duplicidade (Anti-Double POST)
console.log('\n--- 6. Proteção Contra Duplicidade e Concorrência ---');

runTest('entryInProgressRef trava imediatamente a câmera e impede múltiplos POSTs', () => {
  assert.strictEqual(facialCameraContent.includes("const entryInProgressRef = useRef<boolean>(false);"), true);
  assert.strictEqual(facialCameraContent.includes("if (!matchedVisitor || entryInProgressRef.current) return;"), true);
  assert.strictEqual(facialCameraContent.includes("entryInProgressRef.current = true;"), true);
});

// 7. Visitante Reconhecido — Um Residente vs Múltiplos Residentes
console.log('\n--- 7. Fluxo de Confirmação: 1 Residente vs Múltiplos Residentes ---');

runTest('Visitante com 1 único residente vinculado confirma entrada automaticamente após detecção', () => {
  assert.strictEqual(facialCameraContent.includes("const links = getVisitorLinkedResidents(matchedVisitor);"), true);
  assert.strictEqual(facialCameraContent.includes("if (links.length !== 1) return;"), true);
  assert.strictEqual(facialCameraContent.includes("void handleConfirmRecognizedEntry(links[0].residentId);"), true);
});

runTest('Visitante com múltiplos residentes vinculados exibe tela de escolha "Quem você veio visitar hoje?"', () => {
  assert.strictEqual(facialCameraContent.includes("Quem você veio visitar hoje?"), true);
  assert.strictEqual(facialCameraContent.includes("matchedLinkedResidents.map(link => ("), true);
  assert.strictEqual(facialCameraContent.includes("void handleConfirmRecognizedEntry(link.residentId);"), true);
});

runTest('Confirmação é exibida por 2 segundos antes de retornar ao início', () => {
  assert.strictEqual(facialCameraContent.includes("setTimeout(() => {\n        entryInProgressRef.current = false;\n        setConfirmedSuccess(null);\n        setEntryObservation('');\n        setScanSecondsLeft(4.0);\n        setScanProgress(0);\n        onEntryCompleted?.();\n      }, 2000);"), true);
});

// 8. Visitante Não Reconhecido e Cadastro Rápido Mínimo
console.log('\n--- 8. Cadastro Rápido Mínimo e Reutilização de Foto/Biometria ---');

runTest('Esgotados os 4 segundos, abre automaticamente o Cadastro Rápido com foto e biometria reaproveitadas', () => {
  assert.strictEqual(facialCameraContent.includes("openAutomaticQuickRegistration("), true);
  assert.strictEqual(facialCameraContent.includes("setShowQuickNewModal(true);"), true);
  assert.strictEqual(facialCameraContent.includes("setManualCapturedThumb(capturedPhoto || null);"), true);
  assert.strictEqual(facialCameraContent.includes("setManualCapturedDescriptor("), true);
});

runTest('Cadastro Rápido contém estritamente Nome, Telefone e Residente obrigatórios', () => {
  assert.strictEqual(facialCameraContent.includes("if (!quickName.trim()) {"), true);
  assert.strictEqual(facialCameraContent.includes("if (!quickPhone.trim()) {"), true);
  assert.strictEqual(facialCameraContent.includes("if (!quickResidentId) {"), true);
  // No modal de cadastro rápido, não são renderizados campos de doc, agency, conference
  const quickModalSection = facialCameraContent.slice(
    facialCameraContent.indexOf('Cadastro Facial de Visitante'),
    facialCameraContent.indexOf('Cadastrar e Registrar Entrada')
  );
  assert.strictEqual(quickModalSection.includes('CPF / RG'), false);
  assert.strictEqual(quickModalSection.includes('Conferência / Conselho'), false);
  assert.strictEqual(quickModalSection.includes('Órgão / Entidade'), false);
  assert.strictEqual(quickModalSection.includes('Perfil da Visita'), false);
});

runTest('Cadastro e registro de entrada são sequenciais e não poluem resident.relatives', () => {
  assert.strictEqual(facialCameraContent.includes("await onRegisterQuickVisitor(newVisitor);"), true);
  assert.strictEqual(facialCameraContent.includes("await onConfirmEntry({"), true);
  // Em VisitorPortal.tsx, handleRegisterQuickVisitor não adiciona em relatives
  const quickHandler = visitorPortalContent.slice(
    visitorPortalContent.indexOf('const handleRegisterQuickVisitor = async'),
    visitorPortalContent.indexOf('const handleClearAllBiometrics = async')
  );
  assert.strictEqual(quickHandler.includes("onSaveResident"), false);
  assert.strictEqual(quickHandler.includes("O cadastro facial é operacional da Portaria e não altera automaticamente o prontuário social (resident.relatives)."), true);
});

// 9. Validação no Backend (server.ts)
console.log('\n--- 9. Regras de Backend e Validação de Vínculos em server.ts ---');

runTest('POST /api/global-visits exige residentId obrigatório para matchedVia === "facial"', () => {
  assert.strictEqual(serverContent.includes("if (data.matchedVia === 'facial') {\n        if (!data.residentId || typeof data.residentId !== 'string') {\n          return res.status(400).json({ error: 'Entrada por reconhecimento facial exige residente vinculado obrigatoriamente.' });"), true);
});

runTest('POST /api/global-visits valida existência e pertencimento do residente à mesma instituição', () => {
  assert.strictEqual(serverContent.includes("validatedResident = await resolvePortalResident(data.residentId, realId);"), true);
  assert.strictEqual(serverContent.includes("if (!validatedResident) {\n          return res.status(400).json({ error: 'Residente inválido ou não pertencente à unidade da Portaria.' });"), true);
});

runTest('POST /api/global-visits remove photoUrl e faceDescriptor antes de salvar no banco', () => {
  assert.strictEqual(serverContent.includes("faceDescriptor: _discardedFaceDescriptor,"), true);
  assert.strictEqual(serverContent.includes("photoUrl: _discardedPhotoUrl,"), true);
  assert.strictEqual(serverContent.includes("...visitData"), true);
});

runTest('POST /api/registered-visitors valida que descritor biométrico exige 128 dimensões e residente vinculado', () => {
  assert.strictEqual(serverContent.includes("if (effectiveFaceDescriptor.length !== 128) {\n          return res.status(400).json({ error: 'Descritor facial inválido.' });"), true);
  assert.strictEqual(serverContent.includes("if (effectiveType !== 'residente' || normalizedLinks.length === 0) {\n          return res.status(400).json({ error: 'Cadastro com reconhecimento facial exige vínculo com pelo menos um residente.' });"), true);
});

// 10. Fallback Manual Operacional
console.log('\n--- 10. Fallback Operacional para Entrada Manual ---');

runTest('FacialRecognitionCamera oferece botão "Usar Entrada Manual" para qualquer contingência', () => {
  assert.strictEqual(facialCameraContent.includes("onUseManual?: () => void;"), true);
  assert.strictEqual(facialCameraContent.includes("Usar Entrada Manual"), true);
  assert.strictEqual(visitorPortalContent.includes("onUseManual={() => {\n                      handleResetManual();\n                      setEntryMode('manual');\n                    }}"), true);
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES MUDANÇA 010: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}

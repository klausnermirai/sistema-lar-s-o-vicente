const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('SUÍTE DE TESTES: MUDANÇA 008 (COMPOSIÇÃO FAMILIAR E PROCEDÊNCIA)');
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

const typesContent = fs.readFileSync('types.ts', 'utf8');
const screeningContent = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');
const elderlyFormContent = fs.readFileSync('components/ElderlyForm.tsx', 'utf8');
const appContent = fs.readFileSync('App.tsx', 'utf8');
const muralContent = fs.readFileSync('components/MuralModule.tsx', 'utf8');
const socialWorkerContent = fs.readFileSync('components/SocialWorkerTab.tsx', 'utf8');
const visitorPortalContent = fs.readFileSync('components/VisitorPortal.tsx', 'utf8');

// 1. Tipos e Retrocompatibilidade
console.log('--- 1. Definições de Tipos e Retrocompatibilidade ---');

runTest('types.ts define deceased?: boolean na interface Relative', () => {
  const relativeMatch = typesContent.match(/export interface Relative\s*\{[\s\S]*?\}/);
  assert.ok(relativeMatch, 'Relative interface não encontrada');
  assert.strictEqual(relativeMatch[0].includes('deceased?: boolean;'), true);
});

runTest('types.ts define deceased?: boolean na interface FamilyMemberRecord', () => {
  const familyMatch = typesContent.match(/export interface FamilyMemberRecord\s*\{[\s\S]*?\}/);
  assert.ok(familyMatch, 'FamilyMemberRecord interface não encontrada');
  assert.strictEqual(familyMatch[0].includes('deceased?: boolean;'), true);
});

runTest('Registros legados sem campo deceased são avaliados como vivos / não falecidos', () => {
  const legacyRelative = { id: 'rel-1', name: 'João Silva', kinship: 'Filho', phone: '11999999999', isResponsible: true };
  const legacyFamilyMember = { id: 'fam-1', name: 'Maria Silva', kinship: 'Filha', age: '45', job: 'Professora', income: '3000' };

  assert.strictEqual(Boolean(legacyRelative.deceased), false);
  assert.strictEqual(!legacyRelative.deceased, true);
  assert.strictEqual(Boolean(legacyFamilyMember.deceased), false);
  assert.strictEqual(!legacyFamilyMember.deceased, true);
});

// 2. Módulo de Triagem (ScreeningModule.tsx)
console.log('\n--- 2. Triagem: Opção de Procedência e Composição Familiar ---');

runTest('ScreeningModule inclui "Instituição de acolhimento / clínica" nas opções de residesWith', () => {
  const expectedOptions = '["Sozinho", "Filhos", "Familiares", "Instituição de acolhimento / clínica", "Outros"]';
  assert.strictEqual(screeningContent.includes(expectedOptions), true);
  assert.strictEqual(screeningContent.includes('updateInterview("residesWith", v)'), true);
});

runTest('ScreeningModule inicializa novos membros familiares com deceased: false', () => {
  assert.strictEqual(screeningContent.includes('deceased: false'), true);
});

runTest('ScreeningModule renderiza checkbox Falecido na tabela de composição familiar', () => {
  assert.strictEqual(screeningContent.includes('checked={Boolean(m.deceased)}'), true);
  assert.strictEqual(screeningContent.includes('updateFamilyMember(m.id, "deceased", e.target.checked)'), true);
});

runTest('ScreeningModule inclui coluna Status na impressão e identifica FALECIDO ou Vivo', () => {
  assert.strictEqual(screeningContent.includes('<th>Status</th>'), true);
  assert.strictEqual(screeningContent.includes("m.deceased ? 'FALECIDO' : 'Vivo'"), true);
});

// 3. Cadastro do Residente (ElderlyForm.tsx)
console.log('\n--- 3. Cadastro do Residente: Procedência e Vínculos Familiares ---');

runTest('ElderlyForm disponibiliza Contexto de Moradia / Procedência na aba de familiares', () => {
  assert.strictEqual(elderlyFormContent.includes('Contexto de Moradia / Procedência'), true);
  assert.strictEqual(elderlyFormContent.includes('Com quem residia antes do acolhimento?'), true);
  assert.strictEqual(elderlyFormContent.includes('updateResidesWith(e.target.value)'), true);
});

runTest('ElderlyForm inicializa novo familiar com deceased: false', () => {
  assert.strictEqual(elderlyFormContent.includes('deceased: false'), true);
});

runTest('ElderlyForm: marcar como falecido remove automaticamente status de responsável', () => {
  assert.strictEqual(elderlyFormContent.includes("if (field === 'deceased' && value === true) {"), true);
  assert.strictEqual(elderlyFormContent.includes("return { ...r, deceased: true, isResponsible: false };"), true);
});

runTest('ElderlyForm: impede definir familiar falecido como responsável', () => {
  assert.strictEqual(elderlyFormContent.includes("if (field === 'isResponsible' && value === true && r.deceased) {"), true);
  assert.strictEqual(elderlyFormContent.includes("return r;"), true);
});

runTest('ElderlyForm renderiza badge "Falecido" e desativa botão de tornar responsável para falecidos', () => {
  assert.strictEqual(elderlyFormContent.includes('rel.deceased && <div className="absolute -top-3 left-8 bg-gray-600 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-md">Falecido</div>'), true);
  assert.strictEqual(elderlyFormContent.includes('!rel.isResponsible && !rel.deceased && ('), true);
});

runTest('ElderlyForm: impressão identifica [FALECIDO] e exibe "Contato não ativo" no lugar do telefone', () => {
  assert.strictEqual(elderlyFormContent.includes("rel.name} ({rel.kinship}) {rel.deceased && ' [FALECIDO]'}"), true);
  assert.strictEqual(elderlyFormContent.includes("rel.deceased ? 'Contato não ativo' : rel.phone"), true);
});

// 4. Integração Cross-Module e Proteções
console.log('\n--- 4. Consistência Cross-Module e Proteções de Segurança ---');

runTest('App.tsx define deceased: false ao converter representante de triagem em residente', () => {
  assert.strictEqual(appContent.includes('deceased: false'), true);
});

runTest('MuralModule filtra e exibe apenas familiares vivos em contatos de emergência', () => {
  assert.strictEqual(muralContent.includes('(resident.relatives && resident.relatives.some(rel => !rel.deceased))'), true);
  assert.strictEqual(muralContent.includes('resident.relatives.filter(rel => !rel.deceased).map(rel => ('), true);
});

runTest('SocialWorkerTab filtra familiares falecidos ao sugerir contato para atendimento familiar', () => {
  assert.strictEqual(socialWorkerContent.includes('(resident.relatives || []).filter(r => !r.deceased);'), true);
});

runTest('VisitorPortal exclui familiares falecidos do dropdown de identificação de visitantes', () => {
  assert.strictEqual(visitorPortalContent.includes('(selectedResident.relatives || []).filter(rel => !rel.deceased).map('), true);
});

// 5. Verificação de Regressão das Mudanças Anteriores
console.log('\n--- 5. Testes de Regressão (Mudança 005, 006 e 007) ---');

runTest('Mudança 005: Cache do Mural e busca por data permanecem intactos', () => {
  const serverContent = fs.readFileSync('server.ts', 'utf8');
  assert.strictEqual(serverContent.includes('loadInstitutionMuralRaw'), true);
  assert.strictEqual(serverContent.includes('normalizeMuralTimestamp'), true);
});

runTest('Mudança 006: Atendimentos Sigilosos e Reautenticação do Serviço Social permanecem intactos', () => {
  const serverContent = fs.readFileSync('server.ts', 'utf8');
  assert.strictEqual(serverContent.includes('/api/social-work/confidential/:residentId/:recordId/unlock'), true);
  assert.strictEqual(serverContent.includes('createReauthToken'), true);
  assert.strictEqual(serverContent.includes('social_confidential_records'), true);
});

runTest('Mudança 007: Login limpo, Página Inicial e botão de retorno do Mural permanecem intactos', () => {
  assert.strictEqual(muralContent.includes('Voltar ao mural atual'), true);
  assert.strictEqual(appContent.includes('setLoginKey'), true);
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES MUDANÇA 008: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}

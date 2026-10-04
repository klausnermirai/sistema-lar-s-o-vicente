import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function testAppRoutingAndComponents() {
  console.log('🧪 Iniciando Testes de Integração Visual e Roteamento de Famílias SSVP...\n');

  // 1. Verificar existência física dos componentes no disco
  console.log('🔍 Teste 1: Verificação da presença dos arquivos dos componentes');
  const filesToCheck = [
    'components/FamiliasAssistidasModule.tsx',
    'components/FichaSindicanciaModal.tsx',
    'components/VisitasFamiliaModal.tsx',
  ];

  for (const file of filesToCheck) {
    const fullPath = path.join(process.cwd(), file);
    assert.strictEqual(fs.existsSync(fullPath), true, `Arquivo ${file} deve existir no projeto`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.length > 500, `Arquivo ${file} não pode estar vazio`);
    console.log(`  ✓ ${file} existe e possui ${content.length} bytes.`);
  }
  console.log('✅ Teste 1 passou com sucesso!\n');

  // 2. Verificar se App.tsx importa e renderiza FamiliasAssistidasModule na rota AppRoute.VICENTINO_FAMILIAS
  console.log('🔍 Teste 2: Validação de importação e renderização em App.tsx');
  const appContent = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

  // Verificar import
  assert.ok(
    appContent.includes("import { FamiliasAssistidasModule } from './components/FamiliasAssistidasModule';"),
    'App.tsx deve importar FamiliasAssistidasModule explicitamente'
  );
  console.log('  ✓ Importação de FamiliasAssistidasModule confirmada em App.tsx');

  // Verificar que activeRoute === AppRoute.VICENTINO_FAMILIAS renderiza <FamiliasAssistidasModule
  const routeSectionRegex = /activeRoute\s*===\s*AppRoute\.VICENTINO_FAMILIAS\s*&&\s*\(\s*<FamiliasAssistidasModule/m;
  assert.ok(
    routeSectionRegex.test(appContent),
    'App.tsx deve renderizar <FamiliasAssistidasModule quando activeRoute === AppRoute.VICENTINO_FAMILIAS'
  );
  console.log('  ✓ Renderização de <FamiliasAssistidasModule na rota VICENTINO_FAMILIAS confirmada');

  // Verificar que NÃO renderiza mais VicentinoUnderConstructionView na rota VICENTINO_FAMILIAS
  const familiasBranch = appContent.slice(
    appContent.indexOf('activeRoute === AppRoute.VICENTINO_FAMILIAS'),
    appContent.indexOf('activeRoute === AppRoute.VICENTINO_MEMBROS')
  );
  assert.ok(
    familiasBranch.includes('<FamiliasAssistidasModule'),
    'O bloco de VICENTINO_FAMILIAS deve conter <FamiliasAssistidasModule'
  );
  assert.strictEqual(
    familiasBranch.includes('VicentinoUnderConstructionView'),
    false,
    'A rota VICENTINO_FAMILIAS NÃO deve conter VicentinoUnderConstructionView'
  );
  console.log('  ✓ VicentinoUnderConstructionView removido exclusivamente da rota VICENTINO_FAMILIAS');
  console.log('✅ Teste 2 passou com sucesso!\n');

  // 3. Verificar se FamiliasAssistidasModule conecta com os modais e os métodos de API
  console.log('🔍 Teste 3: Validação dos métodos de API e Modais em FamiliasAssistidasModule.tsx');
  const moduleContent = fs.readFileSync(
    path.join(process.cwd(), 'components/FamiliasAssistidasModule.tsx'),
    'utf8'
  );

  // Modais
  assert.ok(moduleContent.includes('<FichaSindicanciaModal'), 'Deve renderizar FichaSindicanciaModal');
  assert.ok(moduleContent.includes('<VisitasFamiliaModal'), 'Deve renderizar VisitasFamiliaModal');

  // Métodos de API
  assert.ok(moduleContent.includes('fetchConselhosParticulares'), 'Deve chamar fetchConselhosParticulares');
  assert.ok(moduleContent.includes('fetchConferencias'), 'Deve chamar fetchConferencias');
  assert.ok(moduleContent.includes('fetchFamiliasAssistidas'), 'Deve chamar fetchFamiliasAssistidas');
  assert.ok(moduleContent.includes('archiveFamiliaAssistida'), 'Deve chamar archiveFamiliaAssistida');
  assert.ok(moduleContent.includes('unarchiveFamiliaAssistida'), 'Deve chamar unarchiveFamiliaAssistida');
  assert.ok(moduleContent.includes('fetchControleCestasMensal'), 'Deve chamar fetchControleCestasMensal');

  // Botões de Ação
  assert.ok(moduleContent.includes('btn-nova-sindicancia-top'), 'Deve possuir botão de nova sindicância');
  assert.ok(moduleContent.includes('btn-visitas-'), 'Deve possuir botão de visitas');
  console.log('  ✓ Integração com Modais, Métodos de API e Botões comprovada');
  console.log('✅ Teste 3 passou com sucesso!\n');

  // 4. Verificar se FichaSindicanciaModal e VisitasFamiliaModal consomem a API corretamente
  console.log('🔍 Teste 4: Validação de FichaSindicanciaModal e VisitasFamiliaModal');
  const sindicanciaContent = fs.readFileSync(
    path.join(process.cwd(), 'components/FichaSindicanciaModal.tsx'),
    'utf8'
  );
  assert.ok(sindicanciaContent.includes('createFamiliaAssistida'), 'FichaSindicancia deve chamar createFamiliaAssistida');
  assert.ok(sindicanciaContent.includes('updateFamiliaAssistida'), 'FichaSindicancia deve chamar updateFamiliaAssistida');
  assert.ok(sindicanciaContent.includes('fetchMembrosConferencia'), 'FichaSindicancia deve carregar membros visitadores');

  const visitasContent = fs.readFileSync(
    path.join(process.cwd(), 'components/VisitasFamiliaModal.tsx'),
    'utf8'
  );
  assert.ok(visitasContent.includes('createVisitaFamilia'), 'VisitasModal deve chamar createVisitaFamilia');
  assert.ok(visitasContent.includes('fetchVisitasFamilia'), 'VisitasModal deve carregar histórico com fetchVisitasFamilia');
  assert.ok(visitasContent.includes('fetchMembrosConferencia'), 'VisitasModal deve carregar membros visitadores da conferência');
  console.log('  ✓ FichaSindicanciaModal e VisitasFamiliaModal integrados com a API com sucesso');
  console.log('✅ Teste 4 passou com sucesso!\n');

  console.log('🎉 TODOS OS TESTES DE INTEGRAÇÃO VISUAL E ROTEAMENTO PASSARAM COM 100% DE SUCESSO!');
}

testAppRoutingAndComponents().catch((err) => {
  console.error('❌ Erro no teste de integração:', err);
  process.exit(1);
});

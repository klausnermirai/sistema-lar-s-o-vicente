import { LocalDbFallback } from '../lib/local_db_fallback.js';
import { FirestoreConselhoParticularRepository } from '../lib/firestore_conselho_particular_repository.js';
import { listConselhosParticulares } from '../lib/conselho_particular_service.js';

async function runTest() {
  console.log('================================================================================');
  console.log(' TESTE DE INTEGRAÇÃO: RESOLUÇÃO DE CONSELHOS PARTICULARES COM CONTEXTO DO CONSELHO CENTRAL');
  console.log('================================================================================\n');

  const db = new LocalDbFallback();
  const repo = new FirestoreConselhoParticularRepository(db as any);

  // Simula o contexto resolvido quando o cliente envia x-institution-id: "54.927.132/0001-92"
  const authContext = {
    allowed: true,
    validatedCentralId: '54.927.132/0001-92',
    userId: 'usr_admin',
  };

  const result = await listConselhosParticulares(authContext, repo, { status: 'ativo' });

  if (!result.success) {
    console.error('✗ FALHA AO CONSULTAR CONSELHOS PARTICULARES:', result.error);
    process.exit(1);
  }

  const cps = result.data.items;
  console.log(`✓ Consulta retornou ${cps.length} Conselhos Particulares:`);
  cps.forEach((cp, idx) => {
    console.log(`  ${idx + 1}. [${cp.id}] ${cp.name} - ${cp.city || 'Sem cidade'} (${cp.status})`);
  });

  if (cps.length !== 6) {
    console.error(`✗ Esperado 6 Conselhos Particulares, encontrado ${cps.length}`);
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('✓ TESTE CONCLUÍDO COM SUCESSO: Todos os 6 Conselhos Particulares foram carregados!');
  console.log('================================================================================');
}

runTest().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});

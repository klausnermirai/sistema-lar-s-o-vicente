import fs from 'fs';
import { LocalDbFallback } from '../lib/local_db_fallback.js';
import { FirestoreConselhoParticularRepository } from '../lib/firestore_conselho_particular_repository.js';
import { listConselhosParticulares } from '../lib/conselho_particular_service.js';

async function testQuery() {
  const db = new LocalDbFallback();
  const repo = new FirestoreConselhoParticularRepository(db as any);

  console.log('--- TESTE 1: Query com centralId = "54.927.132/0001-92" ---');
  const res1 = await listConselhosParticulares(
    { allowed: true, validatedCentralId: '54.927.132/0001-92', userId: 'test' },
    repo,
    { status: 'ativo' }
  );
  console.log('Resultado com 54.927.132/0001-92:', res1.success ? `Encontrados ${res1.data.items.length} CPs` : res1.error);
  if (res1.success) {
    res1.data.items.forEach(cp => console.log(` - ${cp.name} (cidade: ${cp.city})`));
  }

  console.log('\n--- TESTE 2: Query com centralId = "demo-institution-id" ---');
  const res2 = await listConselhosParticulares(
    { allowed: true, validatedCentralId: 'demo-institution-id', userId: 'test' },
    repo,
    { status: 'ativo' }
  );
  console.log('Resultado com demo-institution-id:', res2.success ? `Encontrados ${res2.data.items.length} CPs` : res2.error);
}

testQuery().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

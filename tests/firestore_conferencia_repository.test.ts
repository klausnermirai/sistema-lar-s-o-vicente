import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreConferenciaRepository } from '../lib/firestore_conferencia_repository.js';
import { StandaloneConferencia, StandaloneConselhoParticular } from '../types.js';

let passedTests = 0;
let failedTests = 0;

function assertEqual(actual: any, expected: any, message: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    console.log(`  ✓ PASSED: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${message}\n    Expected: ${JSON.stringify(expected)}\n    Actual:   ${JSON.stringify(actual)}`);
    failedTests++;
  }
}

function computeConferenciaLockId(centralId: string, particularId: string, normalizedName: string): string {
  const canonicalKey = `conf|${centralId}|${particularId}|${normalizedName}`;
  return crypto.createHash('sha256').update(canonicalKey).digest('hex');
}

function computeCpLockId(centralId: string, normalizedName: string): string {
  const canonicalKey = `cp|${centralId}|${normalizedName}`;
  return crypto.createHash('sha256').update(canonicalKey).digest('hex');
}

/**
 * Mock em memória do Firestore e de Transações para testes isolados e determinísticos.
 */
class InMemoryFirestoreMock {
  public store: Map<string, Map<string, any>> = new Map();
  public nextGeneratedId = 1;
  public shouldFailTransaction = false;
  public shouldFailQuery = false;

  constructor() {
    this.store.set('conselhos_particulares', new Map());
    this.store.set('conferencias', new Map());
    this.store.set('hierarchy_unique_keys', new Map());
  }

  private getCollectionStore(colName: string) {
    if (!this.store.has(colName)) {
      this.store.set(colName, new Map());
    }
    return this.store.get(colName)!;
  }

  collection(colName: string) {
    const colStore = this.getCollectionStore(colName);
    const self = this;

    const createQueryObj = (initialFilters: Array<{ field: string; op: string; value: any }> = []) => {
      const filters = [...initialFilters];
      let orderField: string | null = null;
      let orderDir: 'asc' | 'desc' = 'asc';
      let startAfterVal: any = null;
      let queryLimit: number | null = null;

      const queryObj: any = {
        where: (field: string, op: string, value: any) => {
          filters.push({ field, op, value });
          return queryObj;
        },
        orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => {
          orderField = field;
          orderDir = direction;
          return queryObj;
        },
        startAfter: (cursor: any) => {
          startAfterVal = cursor;
          return queryObj;
        },
        limit: (n: number) => {
          queryLimit = n;
          return queryObj;
        },
        get: async () => {
          if (self.shouldFailQuery) {
            throw new Error('Firestore connection pool exhausted: query failure.');
          }
          let results: any[] = [];
          for (const [dId, dData] of colStore.entries()) {
            let match = true;
            for (const f of filters) {
              if (f.op === '==' && dData[f.field] !== f.value) {
                match = false;
                break;
              }
            }
            if (match) {
              results.push({ id: dId, data: () => JSON.parse(JSON.stringify(dData)) });
            }
          }

          if (orderField) {
            results.sort((a, b) => {
              const valA = a.data()[orderField!];
              const valB = b.data()[orderField!];
              if (valA < valB) return orderDir === 'asc' ? -1 : 1;
              if (valA > valB) return orderDir === 'asc' ? 1 : -1;
              return 0;
            });
          }

          if (startAfterVal !== null && orderField) {
            const idx = results.findIndex((r) => r.data()[orderField!] === startAfterVal);
            if (idx !== -1) {
              results = results.slice(idx + 1);
            }
          }

          if (queryLimit !== null) {
            results = results.slice(0, queryLimit);
          }

          return {
            empty: results.length === 0,
            size: results.length,
            docs: results,
          };
        },
        _getDocs: () => {
          let results: any[] = [];
          for (const [dId, dData] of colStore.entries()) {
            let match = true;
            for (const f of filters) {
              if (f.op === '==' && dData[f.field] !== f.value) {
                match = false;
                break;
              }
            }
            if (match) {
              results.push({ id: dId, data: () => JSON.parse(JSON.stringify(dData)) });
            }
          }
          if (queryLimit !== null) {
            results = results.slice(0, queryLimit);
          }
          return {
            empty: results.length === 0,
            size: results.length,
            docs: results,
          };
        },
      };

      return queryObj;
    };

    return {
      doc: (id?: string) => {
        const docId = id || `generated-conf-id-${self.nextGeneratedId++}`;
        return {
          id: docId,
          path: `${colName}/${docId}`,
          get: async () => {
            const exists = colStore.has(docId);
            const data = exists ? JSON.parse(JSON.stringify(colStore.get(docId))) : undefined;
            return {
              id: docId,
              exists,
              data: () => data,
            };
          },
        };
      },
      where: (field: string, op: string, value: any) => {
        return createQueryObj([{ field, op, value }]);
      },
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    if (this.shouldFailTransaction) {
      throw new Error('Firestore connection pool exhausted: low-level driver failure.');
    }

    const stagedWrites: Array<() => void> = [];
    const self = this;

    const transaction = {
      get: async (target: any) => {
        if (typeof target._getDocs === 'function') {
          return target._getDocs();
        }
        const [colName, docId] = target.path.split('/');
        const colStore = self.getCollectionStore(colName);
        const exists = colStore.has(docId);
        const data = exists ? JSON.parse(JSON.stringify(colStore.get(docId))) : undefined;
        return {
          id: docId,
          exists,
          data: () => data,
        };
      },
      set: (docRef: any, data: any) => {
        stagedWrites.push(() => {
          const [colName, docId] = docRef.path.split('/');
          const colStore = self.getCollectionStore(colName);
          colStore.set(docId, JSON.parse(JSON.stringify(data)));
        });
      },
      delete: (docRef: any) => {
        stagedWrites.push(() => {
          const [colName, docId] = docRef.path.split('/');
          const colStore = self.getCollectionStore(colName);
          colStore.delete(docId);
        });
      },
    };

    const result = await updateFunction(transaction);

    // Commit transacional atômico
    for (const write of stagedWrites) {
      write();
    }

    return result;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log(' Executando Testes de FirestoreConferenciaRepository');
  console.log('======================================================================\n');

  // =========================================================================================
  // 1. Criação bem-sucedida
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    // Cadastra Conselho Particular pai ativo
    mockDb.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-1',
      name: 'Conselho Particular São José',
      normalizedName: 'conselhoparticularsaojose',
      status: 'ativo',
    });

    const payload: StandaloneConferencia = {
      id: '',
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conferência Santa Terezinha',
      normalizedName: 'conferenciasantaterezinha',
      status: 'ativo',
      createdAt: '2026-08-17T10:00:00.000Z',
      createdBy: 'user-admin',
      updatedAt: '2026-08-17T10:00:00.000Z',
      updatedBy: 'user-admin',
    };

    const result = await repo.createAtomically('central-1', 'cp-1', payload);

    assertEqual(result.created, true, 'TEST 1A: Criação atômica retorna created: true');
    const createdId = result.record?.id;
    assertEqual(typeof createdId === 'string' && createdId.length > 0, true, 'TEST 1B: ID foi gerado no repositório');
    assertEqual(result.record?.centralId, 'central-1', 'TEST 1C: centralId correto no registro retornado');
    assertEqual(result.record?.particularId, 'cp-1', 'TEST 1D: particularId correto no registro retornado');

    const expectedLockId = computeConferenciaLockId('central-1', 'cp-1', 'conferenciasantaterezinha');
    const lockStored = mockDb.store.get('hierarchy_unique_keys')?.get(expectedLockId);

    assertEqual(
      lockStored,
      {
        entityType: 'conferencia',
        entityId: createdId,
        centralId: 'central-1',
        particularId: 'cp-1',
        normalizedName: 'conferenciasantaterezinha',
      },
      'TEST 1E: Trava gravada na mesma transação com campos canônicos completos'
    );

    const docStored = mockDb.store.get('conferencias')?.get(createdId!);
    assertEqual(docStored?.name, 'Conferência Santa Terezinha', 'TEST 1F: Documento da Conferência persistido no Firestore');
  }

  // =========================================================================================
  // 2. Criação bloqueada por condições do pai ou trava
  // =========================================================================================
  {
    // 2A: Pai não existe
    const mockDb1 = new InMemoryFirestoreMock();
    const repo1 = new FirestoreConferenciaRepository(mockDb1 as unknown as Firestore);

    const payload: StandaloneConferencia = {
      id: '',
      centralId: 'central-1',
      particularId: 'cp-fantasma',
      name: 'Conferência Teste',
      normalizedName: 'conferenciateste',
      status: 'ativo',
      createdAt: '2026-08-17T10:00:00.000Z',
      createdBy: 'user-admin',
      updatedAt: '2026-08-17T10:00:00.000Z',
      updatedBy: 'user-admin',
    };

    const res1 = await repo1.createAtomically('central-1', 'cp-fantasma', payload);
    assertEqual(res1.created, false, 'TEST 2A.1: Criação bloqueada quando pai não existe');
    assertEqual(res1.reason, 'PARENT_NOT_FOUND', 'TEST 2A.2: Retorna PARENT_NOT_FOUND');

    // 2B: Pai está inativo
    const mockDb2 = new InMemoryFirestoreMock();
    const repo2 = new FirestoreConferenciaRepository(mockDb2 as unknown as Firestore);
    mockDb2.store.get('conselhos_particulares')?.set('cp-inativo', {
      id: 'cp-inativo',
      centralId: 'central-1',
      name: 'CP Inativo',
      normalizedName: 'cpinativo',
      status: 'inativo',
    });

    const res2 = await repo2.createAtomically('central-1', 'cp-inativo', payload);
    assertEqual(res2.created, false, 'TEST 2B.1: Criação bloqueada quando pai está inativo');
    assertEqual(res2.reason, 'PARENT_INACTIVE', 'TEST 2B.2: Retorna PARENT_INACTIVE');

    // 2C: Pai pertence a outra Central
    const mockDb3 = new InMemoryFirestoreMock();
    const repo3 = new FirestoreConferenciaRepository(mockDb3 as unknown as Firestore);
    mockDb3.store.get('conselhos_particulares')?.set('cp-outra-central', {
      id: 'cp-outra-central',
      centralId: 'central-OUTRA',
      name: 'CP Outra Central',
      normalizedName: 'cpoutracentral',
      status: 'ativo',
    });

    const res3 = await repo3.createAtomically('central-1', 'cp-outra-central', payload);
    assertEqual(res3.created, false, 'TEST 2C.1: Criação bloqueada quando pai pertence a outra Central');
    assertEqual(res3.reason, 'PARENT_CENTRAL_MISMATCH', 'TEST 2C.2: Retorna PARENT_CENTRAL_MISMATCH');

    // 2D: Trava de nome já existe
    const mockDb4 = new InMemoryFirestoreMock();
    const repo4 = new FirestoreConferenciaRepository(mockDb4 as unknown as Firestore);
    mockDb4.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-1',
      name: 'CP 1',
      normalizedName: 'cp1',
      status: 'ativo',
    });

    const existingLockId = computeConferenciaLockId('central-1', 'cp-1', 'conferenciateste');
    mockDb4.store.get('hierarchy_unique_keys')?.set(existingLockId, {
      entityType: 'conferencia',
      entityId: 'conf-ja-existente',
      centralId: 'central-1',
      particularId: 'cp-1',
      normalizedName: 'conferenciateste',
    });

    const res4 = await repo4.createAtomically('central-1', 'cp-1', payload);
    assertEqual(res4.created, false, 'TEST 2D.1: Criação bloqueada quando nome já existe no mesmo CP');
    assertEqual(res4.reason, 'DUPLICATE_NAME', 'TEST 2D.2: Retorna DUPLICATE_NAME');
  }

  // =========================================================================================
  // 3. Unicidade e Não-Colisão de Travas
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    // Cria CP-1 e CP-2
    mockDb.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-1',
      name: 'CP 1',
      normalizedName: 'cp1',
      status: 'ativo',
    });
    mockDb.store.get('conselhos_particulares')?.set('cp-2', {
      id: 'cp-2',
      centralId: 'central-1',
      name: 'CP 2',
      normalizedName: 'cp2',
      status: 'ativo',
    });

    // Cria trava de Conselho Particular com mesmo nome normalizado 'saojose'
    const cpLockId = computeCpLockId('central-1', 'saojose');
    mockDb.store.get('hierarchy_unique_keys')?.set(cpLockId, {
      entityType: 'conselho_particular',
      entityId: 'cp-1',
      centralId: 'central-1',
      normalizedName: 'saojose',
    });

    const confPayload1: StandaloneConferencia = {
      id: '',
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'São José',
      normalizedName: 'saojose',
      status: 'ativo',
      createdAt: '2026-08-17T10:00:00.000Z',
      createdBy: 'user',
      updatedAt: '2026-08-17T10:00:00.000Z',
      updatedBy: 'user',
    };

    // Cria Conferência São José no CP-1 (não pode colidir com CP São José)
    const resConf1 = await repo.createAtomically('central-1', 'cp-1', confPayload1);
    assertEqual(resConf1.created, true, 'TEST 3A: Trava de Conferência não colide com trava de Conselho Particular');

    // Tenta criar outra Conferência São José no CP-1 (deve bloquear)
    const resConf1Duplicate = await repo.createAtomically('central-1', 'cp-1', confPayload1);
    assertEqual(resConf1Duplicate.created, false, 'TEST 3B: Mesmo nome no mesmo Conselho Particular é bloqueado');
    assertEqual(resConf1Duplicate.reason, 'DUPLICATE_NAME', 'TEST 3C: Retorna DUPLICATE_NAME para duplicidade no mesmo CP');

    // Cria Conferência São José no CP-2 (deve permitir, pois pertence a outro Conselho Particular)
    const confPayload2: StandaloneConferencia = {
      id: '',
      centralId: 'central-1',
      particularId: 'cp-2',
      name: 'São José',
      normalizedName: 'saojose',
      status: 'ativo',
      createdAt: '2026-08-17T10:00:00.000Z',
      createdBy: 'user',
      updatedAt: '2026-08-17T10:00:00.000Z',
      updatedBy: 'user',
    };

    const resConf2 = await repo.createAtomically('central-1', 'cp-2', confPayload2);
    assertEqual(resConf2.created, true, 'TEST 3D: Mesmo nome em Conselhos Particulares diferentes é permitido com sucesso');
  }

  // =========================================================================================
  // 4. getById e getParticularById
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    const realDocId = 'conf-real-doc-456';
    mockDb.store.get('conferencias')?.set(realDocId, {
      id: 'id-falso-no-corpo',
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conferência Vicentina',
      normalizedName: 'conferenciavicentina',
      status: 'ativo',
    });

    const doc = await repo.getById(realDocId);
    assertEqual(doc?.id, realDocId, 'TEST 4A: getById retorna ID real do documento');
    assertEqual(doc?.name, 'Conferência Vicentina', 'TEST 4B: getById retorna dados da Conferência');

    const nonExistent = await repo.getById('nao-existe');
    assertEqual(nonExistent, null, 'TEST 4C: getById retorna null para registro inexistente');

    mockDb.store.get('conselhos_particulares')?.set('cp-real-789', {
      id: 'id-falso-cp',
      centralId: 'central-1',
      name: 'CP Santo Antônio',
      normalizedName: 'cpsantoantonio',
      status: 'ativo',
    });

    const cpDoc = await repo.getParticularById('cp-real-789');
    assertEqual(cpDoc?.id, 'cp-real-789', 'TEST 4D: getParticularById retorna ID real do documento do pai');
    assertEqual(cpDoc?.name, 'CP Santo Antônio', 'TEST 4E: getParticularById retorna dados do CP');

    const nonExistentCp = await repo.getParticularById('cp-nao-existe');
    assertEqual(nonExistentCp, null, 'TEST 4F: getParticularById retorna null para CP inexistente');
  }

  // =========================================================================================
  // 5. Edição
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    // CP pai ativo
    mockDb.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-1',
      name: 'CP 1',
      normalizedName: 'cp1',
      status: 'ativo',
    });

    const confId = 'conf-edit-1';
    const oldLockId = computeConferenciaLockId('central-1', 'cp-1', 'conforiginal');

    mockDb.store.get('conferencias')?.set(confId, {
      id: confId,
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Original',
      normalizedName: 'conforiginal',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'original-author',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'original-author',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(oldLockId, {
      entityType: 'conferencia',
      entityId: confId,
      centralId: 'central-1',
      particularId: 'cp-1',
      normalizedName: 'conforiginal',
    });

    // 5A: Preservação de campos imutáveis e atualização legítima
    const maliciousPayload: StandaloneConferencia = {
      id: 'hacked-id',
      centralId: 'hacked-central',
      particularId: 'hacked-cp',
      name: 'Conf Renomeada',
      normalizedName: 'confrenomeada',
      status: 'ativo',
      createdAt: '1999-01-01T00:00:00.000Z',
      createdBy: 'hacker',
      updatedAt: '2026-08-17T12:00:00.000Z',
      updatedBy: 'editor-legitimo',
    };

    const updateRes = await repo.updateAtomically(confId, 'central-1', 'cp-1', maliciousPayload);
    assertEqual(updateRes.updated, true, 'TEST 5A.1: Edição atômica realizada');
    assertEqual(updateRes.record?.id, confId, 'TEST 5A.2: id preservado intacto');
    assertEqual(updateRes.record?.centralId, 'central-1', 'TEST 5A.3: centralId preservado');
    assertEqual(updateRes.record?.particularId, 'cp-1', 'TEST 5A.4: particularId preservado');
    assertEqual(updateRes.record?.createdAt, '2026-01-01T00:00:00.000Z', 'TEST 5A.5: createdAt preservado');
    assertEqual(updateRes.record?.createdBy, 'original-author', 'TEST 5A.6: createdBy preservado');
    assertEqual(updateRes.record?.name, 'Conf Renomeada', 'TEST 5A.7: name atualizado');

    const newLockId = computeConferenciaLockId('central-1', 'cp-1', 'confrenomeada');
    assertEqual(mockDb.store.get('hierarchy_unique_keys')?.has(oldLockId), false, 'TEST 5A.8: Trava antiga removida na renomeação');
    assertEqual(mockDb.store.get('hierarchy_unique_keys')?.get(newLockId)?.entityId, confId, 'TEST 5A.9: Nova trava criada');

    // 5B: Bloqueia divergência de escopo
    const mismatchRes = await repo.updateAtomically(confId, 'central-OUTRA', 'cp-1', maliciousPayload);
    assertEqual(mismatchRes.updated, false, 'TEST 5B.1: Divergência de centralId bloqueada');
    assertEqual(mismatchRes.reason, 'INSTITUTION_SCOPE_MISMATCH', 'TEST 5B.2: Retorna INSTITUTION_SCOPE_MISMATCH');

    const mismatchCpRes = await repo.updateAtomically(confId, 'central-1', 'cp-OUTRO', maliciousPayload);
    assertEqual(mismatchCpRes.updated, false, 'TEST 5B.3: Divergência de particularId bloqueada');
    assertEqual(mismatchCpRes.reason, 'INSTITUTION_SCOPE_MISMATCH', 'TEST 5B.4: Retorna INSTITUTION_SCOPE_MISMATCH');

    // 5C: Pai inativado durante a edição
    mockDb.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-1',
      status: 'inativo',
    });
    const inactiveParentRes = await repo.updateAtomically(confId, 'central-1', 'cp-1', maliciousPayload);
    assertEqual(inactiveParentRes.updated, false, 'TEST 5C.1: Edição bloqueada quando pai fica inativo');
    assertEqual(inactiveParentRes.reason, 'PARENT_INACTIVE', 'TEST 5C.2: Retorna PARENT_INACTIVE');

    // 5D: Pai alterou Central durante a edição
    mockDb.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-DIVERGENTE',
      status: 'ativo',
    });
    const centralMismatchParentRes = await repo.updateAtomically(confId, 'central-1', 'cp-1', maliciousPayload);
    assertEqual(centralMismatchParentRes.updated, false, 'TEST 5D.1: Edição bloqueada quando pai diverge de Central');
    assertEqual(centralMismatchParentRes.reason, 'PARENT_CENTRAL_MISMATCH', 'TEST 5D.2: Retorna PARENT_CENTRAL_MISMATCH');

    // 5E: Restaura pai e testa bloqueio de nova trava pertencente a outra conferência
    mockDb.store.get('conselhos_particulares')?.set('cp-1', {
      id: 'cp-1',
      centralId: 'central-1',
      status: 'ativo',
    });

    const busyLockId = computeConferenciaLockId('central-1', 'cp-1', 'nomeocupado');
    mockDb.store.get('hierarchy_unique_keys')?.set(busyLockId, {
      entityType: 'conferencia',
      entityId: 'outra-conferencia',
      centralId: 'central-1',
      particularId: 'cp-1',
      normalizedName: 'nomeocupado',
    });

    const duplicatePayload: StandaloneConferencia = {
      ...maliciousPayload,
      name: 'Nome Ocupado',
      normalizedName: 'nomeocupado',
    };

    const dupRes = await repo.updateAtomically(confId, 'central-1', 'cp-1', duplicatePayload);
    assertEqual(dupRes.updated, false, 'TEST 5E.1: Edição bloqueada por nome ocupado por outra conferência');
    assertEqual(dupRes.reason, 'DUPLICATE_NAME', 'TEST 5E.2: Retorna DUPLICATE_NAME');

    // 5F: Proteção de trava antiga corrompida (pertencente a outro registro)
    const corruptedDocId = 'conf-corrompida';
    const oldCorruptedLockId = computeConferenciaLockId('central-1', 'cp-1', 'confcorrompida');

    mockDb.store.get('conferencias')?.set(corruptedDocId, {
      id: corruptedDocId,
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Corrompida',
      normalizedName: 'confcorrompida',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(oldCorruptedLockId, {
      entityType: 'conferencia',
      entityId: 'outro-registro-estranho',
      centralId: 'central-1',
      particularId: 'cp-1',
      normalizedName: 'confcorrompida',
    });

    const renameCorruptedPayload: StandaloneConferencia = {
      id: corruptedDocId,
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Novo Nome Seguro',
      normalizedName: 'novonomeseguro',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
      updatedAt: '2026-08-17T12:00:00.000Z',
      updatedBy: 'admin',
    };

    const corruptedRes = await repo.updateAtomically(corruptedDocId, 'central-1', 'cp-1', renameCorruptedPayload);
    assertEqual(corruptedRes.updated, false, 'TEST 5F.1: Edição abortada por divergência na trava antiga');
    assertEqual(corruptedRes.reason, 'STORAGE_ERROR', 'TEST 5F.2: Retorna STORAGE_ERROR');
    assertEqual(
      mockDb.store.get('hierarchy_unique_keys')?.get(oldCorruptedLockId)?.entityId,
      'outro-registro-estranho',
      'TEST 5F.3: Trava pertencente a outro registro NÃO foi excluída'
    );
  }

  // =========================================================================================
  // 6. Inativação
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    const confId = 'conf-inativar-1';
    const lockId = computeConferenciaLockId('central-1', 'cp-1', 'confinativar');

    mockDb.store.get('conferencias')?.set(confId, {
      id: confId,
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Inativar',
      normalizedName: 'confinativar',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'criador-original',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(lockId, {
      entityType: 'conferencia',
      entityId: confId,
      centralId: 'central-1',
      particularId: 'cp-1',
      normalizedName: 'confinativar',
    });

    // 6A: Inexistente
    const notFoundRes = await repo.inactivateAtomically('conf-fantasma', 'central-1', 'cp-1', 'audit');
    assertEqual(notFoundRes.inactivated, false, 'TEST 6A.1: Inativação de inexistente recusada');
    assertEqual(notFoundRes.reason, 'NOT_FOUND', 'TEST 6A.2: Retorna NOT_FOUND');

    // 6B: Escopo divergente
    const mismatchRes1 = await repo.inactivateAtomically(confId, 'central-OUTRA', 'cp-1', 'audit');
    assertEqual(mismatchRes1.inactivated, false, 'TEST 6B.1: Inativação com central divergente recusada');
    assertEqual(mismatchRes1.reason, 'INSTITUTION_SCOPE_MISMATCH', 'TEST 6B.2: Retorna INSTITUTION_SCOPE_MISMATCH');

    const mismatchRes2 = await repo.inactivateAtomically(confId, 'central-1', 'cp-OUTRO', 'audit');
    assertEqual(mismatchRes2.inactivated, false, 'TEST 6B.3: Inativação com particular divergente recusada');
    assertEqual(mismatchRes2.reason, 'INSTITUTION_SCOPE_MISMATCH', 'TEST 6B.4: Retorna INSTITUTION_SCOPE_MISMATCH');

    // 6C: Inativação legítima (soft-delete, preservação de campos e trava)
    const inactRes = await repo.inactivateAtomically(confId, 'central-1', 'cp-1', 'usuario-auditoria');
    assertEqual(inactRes.inactivated, true, 'TEST 6C.1: Inativação concluída com sucesso');
    assertEqual(inactRes.record?.status, 'inativo', 'TEST 6C.2: Status alterado para inativo');
    assertEqual(inactRes.record?.updatedBy, 'usuario-auditoria', 'TEST 6C.3: updatedBy auditado');
    assertEqual(inactRes.record?.createdBy, 'criador-original', 'TEST 6C.4: createdBy original preservado');
    assertEqual(inactRes.record?.createdAt, '2026-01-01T00:00:00.000Z', 'TEST 6C.5: createdAt original preservado');

    const docAfter = mockDb.store.get('conferencias')?.get(confId);
    assertEqual(docAfter !== undefined, true, 'TEST 6C.6: Documento NÃO foi excluído fisicamente');
    assertEqual(docAfter?.status, 'inativo', 'TEST 6C.7: Status persistido como inativo');

    const lockAfter = mockDb.store.get('hierarchy_unique_keys')?.get(lockId);
    assertEqual(lockAfter !== undefined, true, 'TEST 6C.8: Trava de nome permanece preservada no Firestore');

    // 6D: Já inativo
    const alreadyInactiveRes = await repo.inactivateAtomically(confId, 'central-1', 'cp-1', 'audit');
    assertEqual(alreadyInactiveRes.inactivated, false, 'TEST 6D.1: Inativação de já inativo recusada');
    assertEqual(alreadyInactiveRes.reason, 'ALREADY_INACTIVE', 'TEST 6D.2: Retorna ALREADY_INACTIVE');
  }

  // =========================================================================================
  // 7. Falhas inesperadas de Storage
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    mockDb.shouldFailTransaction = true; // Simula falha catastrófica de driver/rede

    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    const dummyPayload: StandaloneConferencia = {
      id: 'conf-err',
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Erro',
      normalizedName: 'conferro',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'user',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'user',
    };

    const createRes = await repo.createAtomically('central-1', 'cp-1', dummyPayload);
    assertEqual(createRes.created, false, 'TEST 7A.1: Criação com falha retorna created: false');
    assertEqual(createRes.reason, 'STORAGE_ERROR', 'TEST 7A.2: Criação com falha retorna STORAGE_ERROR');

    const updateRes = await repo.updateAtomically('conf-err', 'central-1', 'cp-1', dummyPayload);
    assertEqual(updateRes.updated, false, 'TEST 7B.1: Edição com falha retorna updated: false');
    assertEqual(updateRes.reason, 'STORAGE_ERROR', 'TEST 7B.2: Edição com falha retorna STORAGE_ERROR');

    const inactRes = await repo.inactivateAtomically('conf-err', 'central-1', 'cp-1', 'user');
    assertEqual(inactRes.inactivated, false, 'TEST 7C.1: Inativação com falha retorna inactivated: false');
    assertEqual(inactRes.reason, 'STORAGE_ERROR', 'TEST 7C.2: Inativação com falha retorna STORAGE_ERROR');
  }

  // =========================================================================================
  // 8. Isolamento Simultâneo por centralId e particularId e ID vindo de doc.id
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    // Alvo: central-1 + cp-1
    mockDb.store.get('conferencias')?.set('doc-conf-target', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conferência Alvo',
      normalizedName: 'conferenciaalvo',
      status: 'ativo',
    });
    // Outro CP: central-1 + cp-2
    mockDb.store.get('conferencias')?.set('doc-conf-outro-cp', {
      centralId: 'central-1',
      particularId: 'cp-2',
      name: 'Conferência Outro CP',
      normalizedName: 'conferenciaoutrocp',
      status: 'ativo',
    });
    // Outra Central: central-2 + cp-1
    mockDb.store.get('conferencias')?.set('doc-conf-outra-central', {
      centralId: 'central-2',
      particularId: 'cp-1',
      name: 'Conferência Outra Central',
      normalizedName: 'conferenciaoutracentral',
      status: 'ativo',
    });

    const listRes = await repo.listByParticularId('central-1', 'cp-1');
    assertEqual(listRes.items.length, 1, 'TEST 8A: Retorna apenas registros de central-1 E cp-1');
    assertEqual(listRes.items[0].id, 'doc-conf-target', 'TEST 8B: ID retornado vem de doc.id real');
    assertEqual(listRes.items[0].centralId, 'central-1', 'TEST 8C: centralId correto');
    assertEqual(listRes.items[0].particularId, 'cp-1', 'TEST 8D: particularId correto');
  }

  // =========================================================================================
  // 9. Filtros de Status (ativo, inativo e todos)
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    mockDb.store.get('conferencias')?.set('conf-a1', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Ativa 1',
      normalizedName: 'confativa1',
      status: 'ativo',
    });
    mockDb.store.get('conferencias')?.set('conf-a2', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Ativa 2',
      normalizedName: 'confativa2',
      status: 'ativo',
    });
    mockDb.store.get('conferencias')?.set('conf-i1', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Inativa 1',
      normalizedName: 'confinativa1',
      status: 'inativo',
    });

    const resAtivo = await repo.listByParticularId('central-1', 'cp-1', { status: 'ativo' });
    assertEqual(resAtivo.items.length, 2, 'TEST 9A: Filtro status ativo retorna 2 itens');

    const resInativo = await repo.listByParticularId('central-1', 'cp-1', { status: 'inativo' });
    assertEqual(resInativo.items.length, 1, 'TEST 9B: Filtro status inativo retorna 1 item');
    assertEqual(resInativo.items[0].id, 'conf-i1', 'TEST 9C: Retorna o item inativo correto');

    const resTodos = await repo.listByParticularId('central-1', 'cp-1', { status: 'todos' });
    assertEqual(resTodos.items.length, 3, 'TEST 9D: Filtro status todos retorna os 3 itens');
  }

  // =========================================================================================
  // 10. Ordenação alfabética por normalizedName
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    mockDb.store.get('conferencias')?.set('conf-z', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Zeta',
      normalizedName: 'confzeta',
      status: 'ativo',
    });
    mockDb.store.get('conferencias')?.set('conf-a', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Alfa',
      normalizedName: 'confalfa',
      status: 'ativo',
    });
    mockDb.store.get('conferencias')?.set('conf-m', {
      centralId: 'central-1',
      particularId: 'cp-1',
      name: 'Conf Meio',
      normalizedName: 'confmeio',
      status: 'ativo',
    });

    const resOrd = await repo.listByParticularId('central-1', 'cp-1');
    assertEqual(resOrd.items.length, 3, 'TEST 10A: Retorna os 3 itens');
    assertEqual(resOrd.items[0].normalizedName, 'confalfa', 'TEST 10B: Primeiro item é Alfa');
    assertEqual(resOrd.items[1].normalizedName, 'confmeio', 'TEST 10C: Segundo item é Meio');
    assertEqual(resOrd.items[2].normalizedName, 'confzeta', 'TEST 10D: Terceiro item é Zeta');
  }

  // =========================================================================================
  // 11. Paginação (limit + 1, startAfter, hasMore, nextCursor e sem repetição)
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    for (let i = 1; i <= 5; i++) {
      const pad = String(i).padStart(2, '0');
      mockDb.store.get('conferencias')?.set(`conf-${pad}`, {
        centralId: 'central-1',
        particularId: 'cp-1',
        name: `Conf ${pad}`,
        normalizedName: `conf${pad}`,
        status: 'ativo',
      });
    }

    // Página 1: limit 2
    const page1 = await repo.listByParticularId('central-1', 'cp-1', { limit: 2 });
    assertEqual(page1.items.length, 2, 'TEST 11A: Página 1 retorna 2 itens');
    assertEqual(page1.items[0].normalizedName, 'conf01', 'TEST 11B: Pág 1 item 1');
    assertEqual(page1.items[1].normalizedName, 'conf02', 'TEST 11C: Pág 1 item 2');
    assertEqual(page1.hasMore, true, 'TEST 11D: Página 1 hasMore === true');
    assertEqual(page1.nextCursor, 'conf02', 'TEST 11E: Página 1 nextCursor === conf02');

    // Página 2: limit 2, startAfter conf02
    const page2 = await repo.listByParticularId('central-1', 'cp-1', { limit: 2, cursor: page1.nextCursor });
    assertEqual(page2.items.length, 2, 'TEST 11F: Página 2 retorna 2 itens');
    assertEqual(page2.items[0].normalizedName, 'conf03', 'TEST 11G: Pág 2 item 1 sem repetir');
    assertEqual(page2.items[1].normalizedName, 'conf04', 'TEST 11H: Pág 2 item 2 sem repetir');
    assertEqual(page2.hasMore, true, 'TEST 11I: Página 2 hasMore === true');
    assertEqual(page2.nextCursor, 'conf04', 'TEST 11J: Página 2 nextCursor === conf04');

    // Página 3: limit 2, startAfter conf04 (última página)
    const page3 = await repo.listByParticularId('central-1', 'cp-1', { limit: 2, cursor: page2.nextCursor });
    assertEqual(page3.items.length, 1, 'TEST 11K: Página 3 retorna 1 item restante');
    assertEqual(page3.items[0].normalizedName, 'conf05', 'TEST 11L: Pág 3 item final');
    assertEqual(page3.hasMore, false, 'TEST 11M: Página 3 hasMore === false');
    assertEqual(page3.nextCursor, undefined, 'TEST 11N: Página 3 nextCursor === undefined');
  }

  // =========================================================================================
  // 12. Falha do Firestore não retorna lista vazia e é propagada como erro
  // =========================================================================================
  {
    const mockDb = new InMemoryFirestoreMock();
    mockDb.shouldFailQuery = true;
    const repo = new FirestoreConferenciaRepository(mockDb as unknown as Firestore);

    let threwError = false;
    let returnedEmptyList = false;

    try {
      const res = await repo.listByParticularId('central-1', 'cp-1');
      if (res && res.items && res.items.length === 0) {
        returnedEmptyList = true;
      }
    } catch {
      threwError = true;
    }

    assertEqual(threwError, true, 'TEST 12A: Falha do Firestore lança/propaga erro');
    assertEqual(returnedEmptyList, false, 'TEST 12B: Falha do Firestore NÃO retorna lista vazia');
  }

  console.log('\n======================================================================');
  console.log(` Resultado Final: ${passedTests} aprovados, ${failedTests} falhas.`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();

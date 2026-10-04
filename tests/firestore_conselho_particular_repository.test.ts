import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreConselhoParticularRepository } from '../lib/firestore_conselho_particular_repository.js';
import { StandaloneConselhoParticular } from '../types.js';

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

function computeLockId(centralId: string, normalizedName: string): string {
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
        const docId = id || `generated-id-${self.nextGeneratedId++}`;
        return {
          id: docId,
          path: `${colName}/${docId}`,
          get: async () => {
            if (self.shouldFailQuery) {
              throw new Error('Firestore connection pool exhausted: doc get failure.');
            }
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
  console.log(' Executando Testes de FirestoreConselhoParticularRepository');
  console.log('======================================================================\n');

  // -----------------------------------------------------------------------------------------
  // Teste 1: Criação grava Conselho e trava na mesma transação
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const payload: StandaloneConselhoParticular = {
      id: '',
      centralId: 'central-1',
      name: 'Conselho Particular São José',
      normalizedName: 'conselhoparticularsaojose',
      status: 'ativo',
      createdAt: '2026-08-17T10:00:00.000Z',
      createdBy: 'user-admin',
      updatedAt: '2026-08-17T10:00:00.000Z',
      updatedBy: 'user-admin',
    };

    const result = await repo.createAtomically(payload);

    assertEqual(result.created, true, 'TEST 1A: Criação atômica retorna created: true');
    const createdId = result.record?.id;
    assertEqual(typeof createdId === 'string' && createdId.length > 0, true, 'TEST 1B: ID foi gerado');

    const expectedLockId = computeLockId('central-1', 'conselhoparticularsaojose');
    const lockStored = mockDb.store.get('hierarchy_unique_keys')?.get(expectedLockId);

    assertEqual(
      lockStored,
      {
        entityType: 'conselho_particular',
        entityId: createdId,
        centralId: 'central-1',
        normalizedName: 'conselhoparticularsaojose',
      },
      'TEST 1C: Trava determinística foi gravada na mesma transação com os campos corretos'
    );

    const docStored = mockDb.store.get('conselhos_particulares')?.get(createdId!);
    assertEqual(docStored?.name, 'Conselho Particular São José', 'TEST 1D: Documento do conselho gravado com sucesso');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 2: Criação com trava existente retorna DUPLICATE_NAME
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const existingLockId = computeLockId('central-1', 'conselhoparticularsaojose');
    mockDb.store.get('hierarchy_unique_keys')?.set(existingLockId, {
      entityType: 'conselho_particular',
      entityId: 'cp-existente',
      centralId: 'central-1',
      normalizedName: 'conselhoparticularsaojose',
    });

    const payload: StandaloneConselhoParticular = {
      id: '',
      centralId: 'central-1',
      name: 'Conselho Particular São José',
      normalizedName: 'conselhoparticularsaojose',
      status: 'ativo',
      createdAt: '2026-08-17T10:00:00.000Z',
      createdBy: 'user-admin',
      updatedAt: '2026-08-17T10:00:00.000Z',
      updatedBy: 'user-admin',
    };

    const result = await repo.createAtomically(payload);

    assertEqual(result.created, false, 'TEST 2A: Criação abortada quando trava já existe');
    assertEqual(result.reason, 'DUPLICATE_NAME', 'TEST 2B: Retorna reason DUPLICATE_NAME');
    assertEqual(mockDb.store.get('conselhos_particulares')?.size, 0, 'TEST 2C: Nenhum documento de conselho foi criado');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 3: getById usa o ID real do documento
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const realDocId = 'cp-real-doc-123';
    // Armazena com um campo interno 'id' divergente de propósito
    mockDb.store.get('conselhos_particulares')?.set(realDocId, {
      id: 'id-falso-armazenado-no-corpo',
      centralId: 'central-1',
      name: 'CP Teste',
      normalizedName: 'cpteste',
      status: 'ativo',
    });

    const doc = await repo.getById(realDocId);

    assertEqual(doc?.id, realDocId, 'TEST 3A: getById retorna id idêntico ao docSnap.id real');
    assertEqual(doc?.name, 'CP Teste', 'TEST 3B: getById retorna os dados do registro');

    const nonExistent = await repo.getById('nao-existe');
    assertEqual(nonExistent, null, 'TEST 3C: getById retorna null para documento inexistente');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 4: Edição preserva id, centralId, createdAt e createdBy
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const docId = 'cp-preserve-test';
    const lockId = computeLockId('central-1', 'cporiginal');

    mockDb.store.get('conselhos_particulares')?.set(docId, {
      id: docId,
      centralId: 'central-1',
      name: 'CP Original',
      normalizedName: 'cporiginal',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'original-author',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'original-author',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(lockId, {
      entityType: 'conselho_particular',
      entityId: docId,
      centralId: 'central-1',
      normalizedName: 'cporiginal',
    });

    // Tentativa de payload malicioso tentando forjar id, centralId, createdAt, createdBy
    const maliciousPayload: StandaloneConselhoParticular = {
      id: 'hacked-id',
      centralId: 'hacked-central',
      name: 'CP Atualizado',
      normalizedName: 'cpatualizado',
      status: 'ativo',
      createdAt: '1999-01-01T00:00:00.000Z',
      createdBy: 'hacker',
      updatedAt: '2026-08-17T11:00:00.000Z',
      updatedBy: 'editor-legitimo',
    };

    const result = await repo.updateAtomically(docId, 'central-1', maliciousPayload);

    assertEqual(result.updated, true, 'TEST 4A: Edição concluída');
    assertEqual(result.record?.id, docId, 'TEST 4B: id preservado intacto');
    assertEqual(result.record?.centralId, 'central-1', 'TEST 4C: centralId preservado intacto');
    assertEqual(result.record?.createdAt, '2026-01-01T00:00:00.000Z', 'TEST 4D: createdAt preservado intacto');
    assertEqual(result.record?.createdBy, 'original-author', 'TEST 4E: createdBy preservado intacto');
    assertEqual(result.record?.name, 'CP Atualizado', 'TEST 4F: name atualizado com sucesso');
    assertEqual(result.record?.updatedBy, 'editor-legitimo', 'TEST 4G: updatedBy registrado');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 5: Edição bloqueia nova trava pertencente a outro registro
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const docIdA = 'cp-registro-a';
    const docIdB = 'cp-registro-b';

    const lockA = computeLockId('central-1', 'cpnomeantigoa');
    const lockB = computeLockId('central-1', 'cpnomeocupadob');

    mockDb.store.get('conselhos_particulares')?.set(docIdA, {
      id: docIdA,
      centralId: 'central-1',
      name: 'CP Nome Antigo A',
      normalizedName: 'cpnomeantigoa',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(lockA, {
      entityType: 'conselho_particular',
      entityId: docIdA,
      centralId: 'central-1',
      normalizedName: 'cpnomeantigoa',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(lockB, {
      entityType: 'conselho_particular',
      entityId: docIdB,
      centralId: 'central-1',
      normalizedName: 'cpnomeocupadob',
    });

    // Tentativa de alterar Registro A para usar o nome ocupado pelo Registro B
    const updatePayload: StandaloneConselhoParticular = {
      id: docIdA,
      centralId: 'central-1',
      name: 'CP Nome Ocupado B',
      normalizedName: 'cpnomeocupadob',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
      updatedAt: '2026-08-17T11:00:00.000Z',
      updatedBy: 'editor',
    };

    const result = await repo.updateAtomically(docIdA, 'central-1', updatePayload);

    assertEqual(result.updated, false, 'TEST 5A: Edição bloqueada para trava ocupada por outro registro');
    assertEqual(result.reason, 'DUPLICATE_NAME', 'TEST 5B: Retorna reason DUPLICATE_NAME');
    assertEqual(mockDb.store.get('hierarchy_unique_keys')?.get(lockA)?.entityId, docIdA, 'TEST 5C: Trava original do Registro A não foi apagada');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 6: Edição não remove trava antiga pertencente a outro registro
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const docId = 'cp-meu-registro';
    const oldLockId = computeLockId('central-1', 'cpcorrompido');

    mockDb.store.get('conselhos_particulares')?.set(docId, {
      id: docId,
      centralId: 'central-1',
      name: 'CP Corrompido',
      normalizedName: 'cpcorrompido',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    // A trava antiga no banco aponta para 'outro-registro-estranho'
    mockDb.store.get('hierarchy_unique_keys')?.set(oldLockId, {
      entityType: 'conselho_particular',
      entityId: 'outro-registro-estranho',
      centralId: 'central-1',
      normalizedName: 'cpcorrompido',
    });

    const updatePayload: StandaloneConselhoParticular = {
      id: docId,
      centralId: 'central-1',
      name: 'CP Novo Nome',
      normalizedName: 'cpnovonome',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
      updatedAt: '2026-08-17T11:00:00.000Z',
      updatedBy: 'editor',
    };

    const result = await repo.updateAtomically(docId, 'central-1', updatePayload);

    assertEqual(result.updated, false, 'TEST 6A: Edição abortada por colisão na trava antiga');
    assertEqual(result.reason, 'STORAGE_ERROR', 'TEST 6B: Retorna STORAGE_ERROR seguro');
    assertEqual(
      mockDb.store.get('hierarchy_unique_keys')?.get(oldLockId)?.entityId,
      'outro-registro-estranho',
      'TEST 6C: Trava pertencente a outro registro permaneceu intacta'
    );
  }

  // -----------------------------------------------------------------------------------------
  // Teste 7: Inativação com Conferência ativa retorna ACTIVE_CHILDREN_EXIST
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const cpId = 'cp-com-filhos';
    mockDb.store.get('conselhos_particulares')?.set(cpId, {
      id: cpId,
      centralId: 'central-1',
      name: 'CP Com Filhos',
      normalizedName: 'cpcomfilhos',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    // Adiciona uma conferência ativa vinculada a este Conselho Particular
    mockDb.store.get('conferencias')?.set('conf-ativa-1', {
      id: 'conf-ativa-1',
      particularId: cpId,
      status: 'ativo',
      name: 'Conferência Santa Terezinha',
    });

    const result = await repo.inactivateAtomically(cpId, 'central-1', 'audit-user');

    assertEqual(result.inactivated, false, 'TEST 7A: Inativação recusada');
    assertEqual(result.reason, 'ACTIVE_CHILDREN_EXIST', 'TEST 7B: Retorna ACTIVE_CHILDREN_EXIST');

    const cpDoc = mockDb.store.get('conselhos_particulares')?.get(cpId);
    assertEqual(cpDoc.status, 'ativo', 'TEST 7C: Status do conselho permanece ativo');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 8: Inativação altera status sem excluir documento ou trava
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const cpId = 'cp-para-inativar';
    const lockId = computeLockId('central-1', 'cpparainativar');

    mockDb.store.get('conselhos_particulares')?.set(cpId, {
      id: cpId,
      centralId: 'central-1',
      name: 'CP Para Inativar',
      normalizedName: 'cpparainativar',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    mockDb.store.get('hierarchy_unique_keys')?.set(lockId, {
      entityType: 'conselho_particular',
      entityId: cpId,
      centralId: 'central-1',
      normalizedName: 'cpparainativar',
    });

    // Inativação sem conferências ativas
    const result = await repo.inactivateAtomically(cpId, 'central-1', 'audit-inactivator');

    assertEqual(result.inactivated, true, 'TEST 8A: Inativação com sucesso');
    assertEqual(result.record?.status, 'inativo', 'TEST 8B: Status alterado para inativo');
    assertEqual(result.record?.updatedBy, 'audit-inactivator', 'TEST 8C: updatedBy auditado');

    const docAfter = mockDb.store.get('conselhos_particulares')?.get(cpId);
    assertEqual(docAfter !== undefined, true, 'TEST 8D: Documento do Conselho Particular NÃO foi excluído');
    assertEqual(docAfter?.status, 'inativo', 'TEST 8E: Documento persistido como inativo');

    const lockAfter = mockDb.store.get('hierarchy_unique_keys')?.get(lockId);
    assertEqual(lockAfter !== undefined, true, 'TEST 8F: Trava de nome permanece preservada para impedir duplicação');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 9: Exceções retornam STORAGE_ERROR sem detalhes internos
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    mockDb.shouldFailTransaction = true; // Força falha grave de driver/rede

    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    const dummyPayload: StandaloneConselhoParticular = {
      id: 'cp-dummy',
      centralId: 'central-1',
      name: 'CP Falha',
      normalizedName: 'cpfalha',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'admin',
    };

    const createRes = await repo.createAtomically(dummyPayload);
    assertEqual(createRes.created, false, 'TEST 9A: Criação com falha retorna created: false');
    assertEqual(createRes.reason, 'STORAGE_ERROR', 'TEST 9B: Criação retorna STORAGE_ERROR');

    const updateRes = await repo.updateAtomically('cp-dummy', 'central-1', dummyPayload);
    assertEqual(updateRes.updated, false, 'TEST 9C: Update com falha retorna updated: false');
    assertEqual(updateRes.reason, 'STORAGE_ERROR', 'TEST 9D: Update retorna STORAGE_ERROR');

    const inactRes = await repo.inactivateAtomically('cp-dummy', 'central-1', 'user');
    assertEqual(inactRes.inactivated, false, 'TEST 9E: Inativação com falha retorna inactivated: false');
    assertEqual(inactRes.reason, 'STORAGE_ERROR', 'TEST 9F: Inativação retorna STORAGE_ERROR');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 10: Isolamento por centralId e ID retornado vem de doc.id
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    mockDb.store.get('conselhos_particulares')?.set('doc-id-c1', {
      centralId: 'central-1',
      name: 'CP Central Um',
      normalizedName: 'cpcentralum',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    mockDb.store.get('conselhos_particulares')?.set('doc-id-c2', {
      centralId: 'central-2',
      name: 'CP Central Dois',
      normalizedName: 'cpcentraldois',
      status: 'ativo',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'admin',
    });

    const listRes = await repo.listByCentralId('central-1');
    assertEqual(listRes.items.length, 1, 'TEST 10A: Retorna apenas registros do central-1');
    assertEqual(listRes.items[0].id, 'doc-id-c1', 'TEST 10B: ID retornado vem do doc.id real');
    assertEqual(listRes.items[0].centralId, 'central-1', 'TEST 10C: centralId correto');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 11: Filtros de Status (ativo, inativo e todos)
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    mockDb.store.get('conselhos_particulares')?.set('cp-a1', {
      id: 'cp-a1',
      centralId: 'central-1',
      name: 'CP Ativo 1',
      normalizedName: 'cpativo1',
      status: 'ativo',
    });
    mockDb.store.get('conselhos_particulares')?.set('cp-a2', {
      id: 'cp-a2',
      centralId: 'central-1',
      name: 'CP Ativo 2',
      normalizedName: 'cpativo2',
      status: 'ativo',
    });
    mockDb.store.get('conselhos_particulares')?.set('cp-i1', {
      id: 'cp-i1',
      centralId: 'central-1',
      name: 'CP Inativo 1',
      normalizedName: 'cpinativo1',
      status: 'inativo',
    });

    const resAtivo = await repo.listByCentralId('central-1', { status: 'ativo' });
    assertEqual(resAtivo.items.length, 2, 'TEST 11A: Filtro status ativo retorna 2 itens');

    const resInativo = await repo.listByCentralId('central-1', { status: 'inativo' });
    assertEqual(resInativo.items.length, 1, 'TEST 11B: Filtro status inativo retorna 1 item');
    assertEqual(resInativo.items[0].id, 'cp-i1', 'TEST 11C: Retorna o item inativo correto');

    const resTodos = await repo.listByCentralId('central-1', { status: 'todos' });
    assertEqual(resTodos.items.length, 3, 'TEST 11D: Filtro status todos retorna os 3 itens');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 12: Ordenação alfabética por normalizedName
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    mockDb.store.get('conselhos_particulares')?.set('cp-z', {
      centralId: 'central-1',
      name: 'CP Zeta',
      normalizedName: 'cpzeta',
      status: 'ativo',
    });
    mockDb.store.get('conselhos_particulares')?.set('cp-a', {
      centralId: 'central-1',
      name: 'CP Alfa',
      normalizedName: 'cpalfa',
      status: 'ativo',
    });
    mockDb.store.get('conselhos_particulares')?.set('cp-m', {
      centralId: 'central-1',
      name: 'CP Meio',
      normalizedName: 'cpmeio',
      status: 'ativo',
    });

    const resOrd = await repo.listByCentralId('central-1');
    assertEqual(resOrd.items.length, 3, 'TEST 12A: Retorna os 3 itens');
    assertEqual(resOrd.items[0].normalizedName, 'cpalfa', 'TEST 12B: Primeiro item é Alfa');
    assertEqual(resOrd.items[1].normalizedName, 'cpmeio', 'TEST 12C: Segundo item é Meio');
    assertEqual(resOrd.items[2].normalizedName, 'cpzeta', 'TEST 12D: Terceiro item é Zeta');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 13: Paginação (limit + 1, startAfter, hasMore, nextCursor e sem repetição)
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    for (let i = 1; i <= 5; i++) {
      const pad = String(i).padStart(2, '0');
      mockDb.store.get('conselhos_particulares')?.set(`cp-${pad}`, {
        centralId: 'central-1',
        name: `CP ${pad}`,
        normalizedName: `cp${pad}`,
        status: 'ativo',
      });
    }

    // Página 1: limit 2
    const page1 = await repo.listByCentralId('central-1', { limit: 2 });
    assertEqual(page1.items.length, 2, 'TEST 13A: Página 1 retorna 2 itens');
    assertEqual(page1.items[0].normalizedName, 'cp01', 'TEST 13B: Pág 1 item 1');
    assertEqual(page1.items[1].normalizedName, 'cp02', 'TEST 13C: Pág 1 item 2');
    assertEqual(page1.hasMore, true, 'TEST 13D: Página 1 hasMore === true');
    assertEqual(page1.nextCursor, 'cp02', 'TEST 13E: Página 1 nextCursor === cp02');

    // Página 2: limit 2, startAfter cp02
    const page2 = await repo.listByCentralId('central-1', { limit: 2, cursor: page1.nextCursor });
    assertEqual(page2.items.length, 2, 'TEST 13F: Página 2 retorna 2 itens');
    assertEqual(page2.items[0].normalizedName, 'cp03', 'TEST 13G: Pág 2 item 1 sem repetir');
    assertEqual(page2.items[1].normalizedName, 'cp04', 'TEST 13H: Pág 2 item 2 sem repetir');
    assertEqual(page2.hasMore, true, 'TEST 13I: Página 2 hasMore === true');
    assertEqual(page2.nextCursor, 'cp04', 'TEST 13J: Página 2 nextCursor === cp04');

    // Página 3: limit 2, startAfter cp04 (última página)
    const page3 = await repo.listByCentralId('central-1', { limit: 2, cursor: page2.nextCursor });
    assertEqual(page3.items.length, 1, 'TEST 13K: Página 3 retorna 1 item restante');
    assertEqual(page3.items[0].normalizedName, 'cp05', 'TEST 13L: Pág 3 item final');
    assertEqual(page3.hasMore, false, 'TEST 13M: Página 3 hasMore === false');
    assertEqual(page3.nextCursor, undefined, 'TEST 13N: Página 3 nextCursor === undefined');
  }

  // -----------------------------------------------------------------------------------------
  // Teste 14: Falha do Firestore não retorna lista vazia e é propagada como erro
  // -----------------------------------------------------------------------------------------
  {
    const mockDb = new InMemoryFirestoreMock();
    mockDb.shouldFailQuery = true;
    const repo = new FirestoreConselhoParticularRepository(mockDb as unknown as Firestore);

    let threwError = false;
    let returnedEmptyList = false;

    try {
      const res = await repo.listByCentralId('central-1');
      if (res && res.items && res.items.length === 0) {
        returnedEmptyList = true;
      }
    } catch {
      threwError = true;
    }

    assertEqual(threwError, true, 'TEST 14A: Falha do Firestore lança/propaga erro');
    assertEqual(returnedEmptyList, false, 'TEST 14B: Falha do Firestore NÃO retorna lista vazia');
  }

  console.log('\n======================================================================');
  console.log(` Resultado Final: ${passedTests} aprovados, ${failedTests} falhas.`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();

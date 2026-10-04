import fs from 'fs';
import path from 'path';
import { generateFirstnameUsername, extractBirthDateDDMM, syncMemberUserAccess } from '../lib/membro_auth_helper';
import { FirestoreMembroRepository } from '../lib/firestore_membro_repository';

// Usaremos o db fallback local real do ambiente de desenvolvimento
const DB_FILE = path.join(process.cwd(), 'db_fallback.json');

class MockDocRef {
  id: string;
  dataObj: any;
  colName: string;
  rawDb: any;

  constructor(id: string, colName: string, rawDb: any) {
    this.id = id;
    this.colName = colName;
    this.rawDb = rawDb;
  }

  async get() {
    const col = this.rawDb[this.colName] || {};
    const data = col[this.id];
    return {
      exists: !!data,
      id: this.id,
      data: () => (data ? { ...data } : undefined)
    };
  }

  async set(data: any, options?: any) {
    if (!this.rawDb[this.colName]) {
      this.rawDb[this.colName] = {};
    }
    if (options?.merge && this.rawDb[this.colName][this.id]) {
      this.rawDb[this.colName][this.id] = { ...this.rawDb[this.colName][this.id], ...data };
    } else {
      this.rawDb[this.colName][this.id] = { ...data, id: this.id };
    }
    return true;
  }

  async update(data: any) {
    return this.set(data, { merge: true });
  }
}

class MockCollectionRef {
  colName: string;
  rawDb: any;

  constructor(colName: string, rawDb: any) {
    this.colName = colName;
    this.rawDb = rawDb;
  }

  doc(id?: string) {
    const docId = id || 'mock_doc_' + Math.random().toString(36).substring(2, 10);
    return new MockDocRef(docId, this.colName, this.rawDb);
  }

  where(field: string, op: string, val: any) {
    const that = this;
    return {
      async get() {
        const col = that.rawDb[that.colName] || {};
        const docs: any[] = [];
        for (const [k, v] of Object.entries(col)) {
          const item: any = v;
          if (op === '==' && item[field] === val) {
            docs.push({
              id: k,
              data: () => ({ ...item })
            });
          }
        }
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
          forEach: (cb: any) => docs.forEach(cb)
        };
      }
    };
  }

  async get() {
    const col = this.rawDb[this.colName] || {};
    const docs = Object.entries(col).map(([k, v]) => ({
      id: k,
      data: () => ({ ...(v as any) })
    }));
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb: any) => docs.forEach(cb)
    };
  }
}

class MockFirestoreInstance {
  rawDb: any;

  constructor(initialData: any) {
    this.rawDb = JSON.parse(JSON.stringify(initialData));
  }

  collection(name: string) {
    return new MockCollectionRef(name, this.rawDb);
  }
}

async function runCompleteTestSuite() {
  console.log('=====================================================');
  console.log('INÍCIO DA SUÍTE DE TESTES E EVIDÊNCIAS - FASE 1');
  console.log('=====================================================');

  const initialDbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const testDb = new MockFirestoreInstance(initialDbData);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[OK] ${testName}`);
      passed++;
    } else {
      console.error(`[FALHA] ${testName}`, detail || '');
      failed++;
    }
  }

  // TESTE 1, 2, 3: Membro fictício com nome e nascimento
  const membroFicticio1 = {
    id: 'membro_ficticio_001',
    fullName: 'Sebastião Vicente de Oliveira',
    birthDate: '1982-04-20',
    conferenciaId: '051o8ttpuyb7',
    particularId: 'zc4v4nwkwa',
    centralId: '54.927.132/0001-92',
    status: 'ativo' as const,
    type: 'confrade' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test_runner'
  };

  const syncRes1 = await syncMemberUserAccess(testDb as any, membroFicticio1, 'test_runner');
  
  assert(syncRes1.hasAccess === true, '1. Novo membro com nascimento tem hasAccess = true');
  assert(syncRes1.username === 'sebastiao', '2. Username normalizado a partir do primeiro nome: "sebastiao"');
  assert(syncRes1.mustChangePassword === false, '3. mustChangePassword é false');
  
  const userDoc1 = await testDb.collection('users').doc(syncRes1.userId!).get();
  const userData1 = userDoc1.data();
  assert(!!userData1, '4. Documento criado na coleção users');
  assert(userData1?.password === '2004', '5. Senha DDMM gerada com sucesso: 2004 para nascimento 1982-04-20');
  assert(userData1?.accessLevel === 'membro_conferencia', '6. Nível de acesso: membro_conferencia');
  assert(userData1?.conferenciaId === '051o8ttpuyb7', '7. ConferenciaId vinculado corretamente');

  const membroDoc1 = await testDb.collection('membros_ssvp').doc(membroFicticio1.id).get();
  const membroData1 = membroDoc1.data();
  assert(membroData1?.username === 'sebastiao', '8. Membro recebeu username no documento');
  assert(membroData1?.userId === syncRes1.userId, '9. Membro recebeu userId vinculado');
  assert(membroData1?.accessStatus === 'Acesso ativo', '10. Membro recebeu status "Acesso ativo"');

  // TESTE 4: Colisão de nomes (outro Sebastião)
  const membroFicticio2 = {
    id: 'membro_ficticio_002',
    fullName: 'Sebastião Pereira Santos',
    birthDate: '1975-11-08',
    conferenciaId: '051o8ttpuyb7',
    particularId: 'zc4v4nwkwa',
    centralId: '54.927.132/0001-92',
    status: 'ativo' as const,
    type: 'confrade' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test_runner'
  };

  const syncRes2 = await syncMemberUserAccess(testDb as any, membroFicticio2, 'test_runner');
  assert(syncRes2.username === 'sebastiao2', '11. Segundo membro fictício recebeu "sebastiao2"');
  const userDoc2 = await testDb.collection('users').doc(syncRes2.userId!).get();
  assert(userDoc2.data()?.password === '0811', '12. Senha DDMM de sebastiao2 gerada como 0811');

  // TESTE 5: Membro sem data de nascimento
  const membroSemNascimento = {
    id: 'membro_ficticio_003',
    fullName: 'Mariana Aparecida da Silva',
    birthDate: '',
    conferenciaId: '051o8ttpuyb7',
    particularId: 'zc4v4nwkwa',
    centralId: '54.927.132/0001-92',
    status: 'ativo' as const,
    type: 'consocia' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test_runner'
  };

  const syncRes3 = await syncMemberUserAccess(testDb as any, membroSemNascimento, 'test_runner');
  assert(syncRes3.hasAccess === false, '13. Membro sem nascimento tem hasAccess = false');
  assert(syncRes3.accessStatus === 'Acesso pendente — informe a data de nascimento', '14. Status registrado como pendente');
  assert(!syncRes3.userId, '15. Nenhum userId gerado na coleção users');

  // TESTE 6: Complementação posterior da data de nascimento
  membroSemNascimento.birthDate = '1995-12-25';
  const syncRes4 = await syncMemberUserAccess(testDb as any, membroSemNascimento, 'test_runner');
  assert(syncRes4.hasAccess === true, '16. Após preencher nascimento, hasAccess = true');
  assert(syncRes4.username === 'mariana', '17. Username "mariana" gerado');
  const userDoc4 = await testDb.collection('users').doc(syncRes4.userId!).get();
  assert(userDoc4.data()?.password === '2512', '18. Senha DDMM gerada como 2512');

  // TESTE 7 & 8: Salvamento repetido de membro com usuário (preservação de senha alterada)
  // Simulando que Mariana trocou sua senha voluntariamente
  await testDb.collection('users').doc(syncRes4.userId!).set({
    password: 'minha_senha_secreta_999',
    mustChangePassword: false
  }, { merge: true });

  // Salvando novamente o membro
  membroSemNascimento.fullName = 'Mariana Aparecida da Silva Santos';
  const syncRes5 = await syncMemberUserAccess(testDb as any, { ...membroSemNascimento, userId: syncRes4.userId, username: 'mariana' }, 'test_runner');
  const userDoc5 = await testDb.collection('users').doc(syncRes4.userId!).get();
  assert(userDoc5.data()?.password === 'minha_senha_secreta_999', '19. Senha personalizada NÃO foi sobrescrita pelo DDMM ao atualizar membro');
  assert(syncRes5.username === 'mariana', '20. Username original preservado');

  // TESTE 9 & 10: Falha simulada durante a criação do acesso (ex: falha de escrita no Firestore)
  const brokenDb = {
    collection(name: string) {
      if (name === 'users') {
        return {
          doc() {
            return {
              async get() { return { exists: false }; },
              async set() { throw new Error('Simulated network timeout in users collection'); }
            };
          },
          where() {
            return { async get() { return { empty: true, size: 0, docs: [] }; } };
          }
        };
      }
      return testDb.collection(name);
    }
  };

  const membroComFalha = {
    id: 'membro_ficticio_falha',
    fullName: 'Claudio Roberto Teste',
    birthDate: '1980-01-10',
    conferenciaId: '051o8ttpuyb7',
    particularId: 'zc4v4nwkwa',
    centralId: '54.927.132/0001-92',
    status: 'ativo' as const,
    type: 'confrade' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test_runner'
  };

  const syncResFalha = await syncMemberUserAccess(brokenDb as any, membroComFalha, 'test_runner');
  assert(syncResFalha.hasAccess === false, '21. Em caso de erro, hasAccess = false');
  assert(syncResFalha.accessStatus === 'Erro na criação do acesso', '22. accessStatus é "Erro na criação do acesso"');
  assert(!!syncResFalha.error, '23. Erro retornado internamente para o servidor');

  const membroFalhaDoc = await testDb.collection('membros_ssvp').doc(membroComFalha.id).get();
  assert(membroFalhaDoc.data()?.accessStatus === 'Erro na criação do acesso', '24. Membro persiste com status de erro explícito');

  // TESTE 11: Usuários administrativos intocados
  const adminDoc = await testDb.collection('users').doc('admin').get();
  assert(adminDoc.data()?.accessLevel === 'administrador', '25. Usuário admin preservado intacto');
  assert(adminDoc.data()?.username === 'admin', '26. Username admin preservado');

  console.log('\n-----------------------------------------------------');
  console.log(`TOTAL DE TESTES EXECUTADOS: ${passed + failed}`);
  console.log(`APROVADOS: ${passed}`);
  console.log(`REPROVADOS: ${failed}`);
  console.log('-----------------------------------------------------');
}

runCompleteTestSuite().catch(console.error);

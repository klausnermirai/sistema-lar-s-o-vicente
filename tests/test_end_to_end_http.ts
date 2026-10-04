import http from 'http';
import fs from 'fs';
import path from 'path';
import { syncMemberUserAccess } from '../lib/membro_auth_helper';

// Simular um cliente HTTP no servidor rodando
async function runEndToEndHttpTest() {
  console.log('--- TESTE END-TO-END HTTP: CRIANDO MEMBRO FICTÍCIO E TESTANDO LOGIN NA PORTA 3000 ---');

  const DB_FILE = path.join(process.cwd(), 'db_fallback.json');
  const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

  // Membro fictício
  const membroTesteHttp = {
    id: 'membro_http_val_001',
    fullName: 'Sebastião Alencar Pereira',
    birthDate: '1988-03-14',
    conferenciaId: '051o8ttpuyb7', // Conferência Nossa Senhora das Graças
    particularId: 'zc4v4nwkwa',    // CP Ozanam
    centralId: '54.927.132/0001-92',
    status: 'ativo' as const,
    type: 'confrade' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test_runner'
  };

  // 1. Criar diretamente no banco do servidor
  if (!dbData.membros_ssvp) dbData.membros_ssvp = {};
  if (!dbData.users) dbData.users = {};

  // Gerar o usuário com o mesmo helper do sistema
  const mockDbRef = {
    collection(name: string) {
      return {
        doc(id?: string) {
          const docId = id || 'user_http_' + Math.random().toString(36).substring(2, 9);
          return {
            id: docId,
            async get() {
              const data = dbData[name]?.[docId];
              return { exists: !!data, id: docId, data: () => data };
            },
            async set(data: any, opt?: any) {
              if (!dbData[name]) dbData[name] = {};
              if (opt?.merge && dbData[name][docId]) {
                dbData[name][docId] = { ...dbData[name][docId], ...data };
              } else {
                dbData[name][docId] = { ...data, id: docId };
              }
              fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
              return true;
            }
          };
        },
        where(f: string, op: string, val: any) {
          return {
            async get() {
              const col = dbData[name] || {};
              const docs: any[] = [];
              for (const [k, v] of Object.entries(col)) {
                if ((v as any)[f] === val) {
                  docs.push({ id: k, data: () => v });
                }
              }
              return { empty: docs.length === 0, size: docs.length, docs, forEach: (cb: any) => docs.forEach(cb) };
            }
          };
        }
      };
    }
  };

  const syncResult = await syncMemberUserAccess(mockDbRef as any, membroTesteHttp, 'test_runner');
  console.log('1. Resultado da sincronização de credencial:', syncResult);

  // 2. Agora chamar o endpoint HTTP REAL /api/login com as credenciais criadas
  const postData = JSON.stringify({
    username: syncResult.username,
    password: '1403' // DDMM de 1988-03-14
  });

  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      console.log('\n2. Resposta do Endpoint /api/login:');
      console.log('HTTP Status:', res.statusCode);
      const parsed = JSON.parse(raw);
      console.log('Corpo da Resposta:', JSON.stringify(parsed, null, 2));

      // Limpeza do dado fictício para não sujar o banco
      delete dbData.membros_ssvp['membro_http_val_001'];
      if (syncResult.userId) delete dbData.users[syncResult.userId];
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
      console.log('\n3. Limpeza concluída dos dados de teste.');
    });
  });

  req.on('error', (err) => {
    console.error('Erro na chamada HTTP:', err.message);
  });

  req.write(postData);
  req.end();
}

runEndToEndHttpTest();

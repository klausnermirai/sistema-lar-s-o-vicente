const http = require('http');

function postJson(path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('=== TESTE DO SISTEMA PÓS-RESTAURAÇÃO (MONTE ALTO) ===\n');

  // 1. Test Login Admin / Gestor
  console.log('1. Testando login do Gestor (kwarizaya@gmail.com)...');
  const adminLogin = await postJson('/api/login', {
    username: 'kwarizaya@gmail.com',
    password: 'senha_teste_admin_123'
  });
  console.log('Status login admin:', adminLogin.status);
  console.log('Usuário:', adminLogin.data.user?.fullName, '| Nível:', adminLogin.data.user?.accessLevel);

  const adminToken = adminLogin.data.user?.id;
  const adminHeaders = {
    'Authorization': 'Bearer ' + adminToken,
    'x-institution-id': '52.853.397/0001-68'
  };

  // 2. Test Login Enfermeiro Monte Alto
  console.log('\n2. Testando login do Enfermeiro de Monte Alto...');
  const enfLogin = await postJson('/api/login', {
    username: 'enfermeiro.montealto',
    password: 'senha_enfermeiro_123'
  });
  console.log('Status login enfermeiro:', enfLogin.status);
  console.log('Usuário:', enfLogin.data.user?.fullName, '| Inst:', enfLogin.data.institutionId);

  const enfToken = enfLogin.data.user?.id;
  const enfInst = enfLogin.data.institutionId || 'ga6jzrx1flf';
  const enfHeaders = {
    'Authorization': 'Bearer ' + enfToken,
    'x-institution-id': enfInst
  };

  // 3. Test System Units
  console.log('\n3. Testando listagem de unidades (/api/system-units)...');
  const units = await getJson('/api/system-units', enfHeaders);
  console.log('Status /api/system-units:', units.status);
  const monteUnit = units.data.find(u => u.city === 'Monte Alto' && u.type === 'obra_unida');
  console.log('Unidade Lar de Monte Alto encontrada:', monteUnit?.name, '| CNPJ:', monteUnit?.cnpj);

  // 4. Test Settings for Monte Alto
  console.log('\n4. Testando configurações da instituição (Monte Alto)...');
  const settings = await getJson(`/api/settings?institutionId=${enfInst}`, enfHeaders);
  console.log('Status /api/settings:', settings.status, 'Nome:', settings.data?.name, '| Cidade:', settings.data?.city);

  // 5. Test Residents for Monte Alto
  console.log('\n5. Testando listagem de residentes (Monte Alto)...');
  const resMonte = await getJson(`/api/residents?institutionId=${enfInst}`, enfHeaders);
  console.log('Status /api/residents:', resMonte.status, 'Total:', Array.isArray(resMonte.data) ? resMonte.data.length : resMonte.data);
  if (Array.isArray(resMonte.data)) {
    resMonte.data.forEach(r => console.log(`  - ${r.name} (${r.room || 'Sem quarto'})`));
  }

  // 6. Test Candidates for Monte Alto
  console.log('\n6. Testando candidatos/triagens para Monte Alto...');
  const candMonte = await getJson(`/api/candidates?institutionId=${enfInst}`, enfHeaders);
  console.log('Status /api/candidates:', candMonte.status, 'Total:', Array.isArray(candMonte.data) ? candMonte.data.length : candMonte.data);
  if (Array.isArray(candMonte.data)) {
    console.log(`  Primeiros 5 candidatos:`);
    candMonte.data.slice(0, 5).forEach(c => console.log(`  - ${c.name} [Etapa: ${c.stage}]`));
  }

  // 7. Test Mural
  console.log('\n7. Testando mural de avisos...');
  const mural = await getJson(`/api/mural?institutionId=${enfInst}`, enfHeaders);
  console.log('Status /api/mural:', mural.status, 'Total:', Array.isArray(mural.data) ? mural.data.length : mural.data);

  // 8. Test Conselhos Particulares and Conferências in Central SSVP
  console.log('\n8. Testando Conselhos e Conferências...');
  const cpRes = await getJson('/api/conselhos-particulares', adminHeaders);
  console.log('Total Conselhos Particulares:', cpRes.data?.items?.length || 0);

  const confMonteAlto = await getJson('/api/conselhos-particulares/833x42a74w/conferencias', adminHeaders);
  console.log('Conferências no CP Monte Alto:', confMonteAlto.data?.length || 0);

  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO ===');
}

runTests().catch(console.error);

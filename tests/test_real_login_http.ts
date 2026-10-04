import http from 'http';

async function testHttpLogin() {
  console.log('--- TESTE DE LOGIN REAL VIA HTTP ENDPOINT /api/login ---');

  const postData = JSON.stringify({
    username: 'sebastiao',
    password: '2004'
  });

  // Testar requisição direta no servidor em execução na porta 3000
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
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('HTTP Status Code:', res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log('Resposta JSON real do endpoint /api/login:');
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log('Resposta bruta:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Erro na requisição:', e.message);
  });

  req.write(postData);
  req.end();
}

testHttpLogin();

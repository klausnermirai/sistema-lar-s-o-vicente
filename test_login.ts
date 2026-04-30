import http from 'http';

const loginData = JSON.stringify({ cnpj: '', username: 'admin', password: 'admin123' });

const req = http.request({
  hostname: '0.0.0.0',
  port: 3000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Login Response:', res.statusCode, data);
    const parsed = JSON.parse(data);
    if (!parsed.error && parsed.user) {
      console.log('Fetching users with token:', parsed.user.id);
      http.get({
        hostname: '0.0.0.0',
        port: 3000,
        path: '/api/users?institutionId=' + parsed.institutionId,
        headers: { 'Authorization': 'Bearer ' + parsed.user.id }
      }, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => console.log('Users Response:', res2.statusCode, data2));
      });
    }
  });
});
req.on('error', e => console.error(e));
req.write(loginData);
req.end();

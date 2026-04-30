import http from 'http';
http.get('http://0.0.0.0:3000/api/settings?institutionId=demo-institution-id', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('GET /api/settings:', res.statusCode, data));
}).on('error', err => console.log(err.message));

import http from 'http';

http.get('http://0.0.0.0:3000/api/settings?institutionId=demo-institution-id', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
}).on('error', err => console.log('Error:', err.message));

http.get('http://0.0.0.0:3000/api/users?institutionId=demo-institution-id', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Users Response:', res.statusCode, data));
}).on('error', err => console.log('Error:', err.message));

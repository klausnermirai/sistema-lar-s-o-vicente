const data = {
  institutionId: 'demo-institution-id',
  author: 'Test Script',
  text: 'Testando pelo webhook...'
};

fetch('http://localhost:3000/api/mural/telegram', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
}).then(async r => {
  console.log(r.status, await r.json());
}).catch(console.error);

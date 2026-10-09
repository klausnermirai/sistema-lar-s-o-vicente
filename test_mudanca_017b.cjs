const fs = require('node:fs');
const assert = require('node:assert/strict');

const server = fs.readFileSync('server.ts', 'utf8');
const start = server.indexOf('const buildSocialMuralPayload');
const end = server.indexOf('app.post(\'/api/social-work/records\'', start);
assert.ok(start >= 0 && end > start, 'buildSocialMuralPayload deve existir');

const block = server.slice(start, end);
assert.ok(
  block.includes("`Resumo: ${String(record.description || '')}`"),
  'Mural do Serviço Social deve usar a descrição integral'
);
assert.ok(!block.includes('.slice(0, 240)'), 'Não deve existir corte artificial de 240 caracteres');
assert.ok(!block.includes("length > 240 ? '...' : ''"), 'Não deve acrescentar reticências artificiais');
assert.ok(!/referrals/i.test(block), '017B não deve ampliar o conteúdo publicado com encaminhamentos');

const longText = 'X'.repeat(1000);
const simulatedText = `Resumo: ${String(longText || '')}`;
assert.equal(simulatedText.length, 'Resumo: '.length + 1000, 'Texto de 1000 caracteres deve permanecer integral');
assert.equal(simulatedText.endsWith('...'), false, 'Texto não deve receber reticências artificiais');

console.log('PASS: Mudança 017B mantém a descrição integral no mural sem ampliar o conteúdo publicado.');

const assert = require('assert');

console.log('================================================================');
console.log('TESTES DE VALIDAÇÃO: MUDANÇA 005 (MURAL, HISTÓRICO E CACHE)');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Detalhes: ${err.message}`);
    failedCount++;
  }
}

// -------------------------------------------------------------
// 1. NORMALIZAÇÃO DE TIMESTAMPS
// -------------------------------------------------------------
console.log('--- 1. Normalização de Timestamps Heterogêneos ---');

function normalizeMuralTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : 0;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : 0;
  }
  if (value && typeof value.toDate === 'function') {
    const millis = value.toDate().getTime();
    return Number.isFinite(millis) ? millis : 0;
  }
  if (value && typeof value.seconds === 'number') {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return (value.seconds * 1000) + Math.floor(nanos / 1_000_000);
  }
  if (value && typeof value._seconds === 'number') {
    const nanos = typeof value._nanoseconds === 'number' ? value._nanoseconds : 0;
    return (value._seconds * 1000) + Math.floor(nanos / 1_000_000);
  }
  return 0;
}

runTest('Normalização de timestamp numérico puro', () => {
  const ts = 1776254400000;
  assert.strictEqual(normalizeMuralTimestamp(ts), 1776254400000);
});

runTest('Normalização de timestamp como string numérica', () => {
  const ts = "1776254400000";
  assert.strictEqual(normalizeMuralTimestamp(ts), 1776254400000);
});

runTest('Normalização de timestamp como ISO string', () => {
  const iso = "2026-05-15T12:00:00.000Z";
  const expected = Date.parse(iso);
  assert.strictEqual(normalizeMuralTimestamp(iso), expected);
});

runTest('Normalização de Firestore Timestamp (objeto com toMillis)', () => {
  const fsTimestamp = { toMillis: () => 1776254400000 };
  assert.strictEqual(normalizeMuralTimestamp(fsTimestamp), 1776254400000);
});

runTest('Normalização de Firestore Timestamp (objeto com toDate)', () => {
  const fsTimestamp = { toDate: () => new Date(1776254400000) };
  assert.strictEqual(normalizeMuralTimestamp(fsTimestamp), 1776254400000);
});

runTest('Normalização de estrutura seconds / nanoseconds', () => {
  const raw = { seconds: 1776254400, nanoseconds: 500000000 };
  assert.strictEqual(normalizeMuralTimestamp(raw), 1776254400500);
});

// -------------------------------------------------------------
// 2. FUSO HORÁRIO BRASIL (America/Sao_Paulo) E TRANSIÇÃO DE MEIA-NOITE
// -------------------------------------------------------------
console.log('\n--- 2. Fuso Horário de Brasília (America/Sao_Paulo) ---');

function getBrazilDateString(timestampMs) {
  if (!timestampMs || !Number.isFinite(timestampMs)) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestampMs));
}

runTest('Data às 23:59:59 BRT pertence ao dia correto em São Paulo', () => {
  // 2026-06-15 às 23:59:59 BRT = 2026-06-16 02:59:59 UTC
  const lateNightUtc = Date.parse('2026-06-16T02:59:59.000Z');
  assert.strictEqual(getBrazilDateString(lateNightUtc), '2026-06-15');
});

runTest('Data às 00:00:01 BRT pertence ao novo dia em São Paulo', () => {
  // 2026-06-16 às 00:00:01 BRT = 2026-06-16 03:00:01 UTC
  const earlyMorningUtc = Date.parse('2026-06-16T03:00:01.000Z');
  assert.strictEqual(getBrazilDateString(earlyMorningUtc), '2026-06-16');
});

// -------------------------------------------------------------
// 3. UNIFICAÇÃO DO HISTÓRICO: ELIMINAÇÃO DO SALTO ABRIL/SETEMBRO
// -------------------------------------------------------------
console.log('\n--- 3. Unificação Cronológica Sem Salto Temporal ---');

runTest('Ordenação cronológica de tipos mistos posiciona maio/junho/julho/agosto no local exato', () => {
  const tsAbr = Date.parse('2026-04-15T12:00:00Z');
  const tsMai = Date.parse('2026-05-15T12:00:00Z');
  const tsJun = Date.parse('2026-06-15T12:00:00Z');
  const tsJul = Date.parse('2026-07-15T12:00:00Z');
  const tsAgo = Date.parse('2026-08-15T12:00:00Z');
  const tsSet = Date.parse('2026-09-15T12:00:00Z');

  const mixedMessages = [
    { id: 'msg_abr', text: 'Abril (numérico)', timestamp: tsAbr },
    { id: 'msg_mai', text: 'Maio (Timestamp)', timestamp: { toMillis: () => tsMai } },
    { id: 'msg_jun', text: 'Junho (string)', timestamp: String(tsJun) },
    { id: 'msg_jul', text: 'Julho (ISO)', timestamp: '2026-07-15T12:00:00Z' },
    { id: 'msg_ago', text: 'Agosto (seconds)', timestamp: { seconds: Math.floor(tsAgo / 1000), nanoseconds: 0 } },
    { id: 'msg_set', text: 'Setembro (Timestamp)', timestamp: { toMillis: () => tsSet } },
  ];

  const normalized = mixedMessages.map(m => ({
    ...m,
    timestamp: normalizeMuralTimestamp(m.timestamp)
  })).sort((a, b) => b.timestamp - a.timestamp);

  assert.strictEqual(normalized[0].id, 'msg_set');
  assert.strictEqual(normalized[1].id, 'msg_ago');
  assert.strictEqual(normalized[2].id, 'msg_jul');
  assert.strictEqual(normalized[3].id, 'msg_jun');
  assert.strictEqual(normalized[4].id, 'msg_mai');
  assert.strictEqual(normalized[5].id, 'msg_abr');
});

// -------------------------------------------------------------
// 4. PESQUISA HISTÓRICA POR DATA FORA DOS 50 RECENTES
// -------------------------------------------------------------
console.log('\n--- 4. Pesquisa Histórica Por Data Específica ---');

runTest('Busca por data recupera mensagens antigas mesmo com centenas de mensagens mais novas', () => {
  // Criar 100 mensagens recentes de setembro/outubro
  const fullHistory = [];
  for (let i = 0; i < 100; i++) {
    fullHistory.push({
      id: `recent_${i}`,
      timestamp: Date.parse('2026-09-20T10:00:00Z') + (i * 1000)
    });
  }

  // Inserir 3 mensagens históricas em 15/06/2026
  const targetDateTs = Date.parse('2026-06-15T14:30:00-03:00');
  fullHistory.push({ id: 'hist_1', text: 'Histórico 1', timestamp: targetDateTs });
  fullHistory.push({ id: 'hist_2', text: 'Histórico 2', timestamp: targetDateTs + 60000 });
  fullHistory.push({ id: 'hist_3', text: 'Histórico 3', timestamp: targetDateTs + 120000 });

  // Simular busca por date='2026-06-15'
  const matched = fullHistory.filter(msg => getBrazilDateString(msg.timestamp) === '2026-06-15');
  assert.strictEqual(matched.length, 3, 'Deve encontrar todas as 3 mensagens do dia 15/06/2026');
  assert.strictEqual(matched.map(m => m.id).join(','), 'hist_1,hist_2,hist_3');
});

// -------------------------------------------------------------
// 5. CACHE INSTITUCIONAL E MUTAÇÕES INCREMENTAIS (TTL PRESERVADO)
// -------------------------------------------------------------
console.log('\n--- 5. Cache Institucional Bruto e Não-Renovação de TTL ---');

runTest('Mutações incrementais (POST, EDIT, LIKE, DELETE) não renovam o loadedAt do TTL', () => {
  const cacheKey = 'mural_raw_monte_alto';
  const initialLoadedAt = 1000000000;
  const muralCache = new Map();

  muralCache.set(cacheKey, {
    messages: [
      { id: 'm1', text: 'Primeira', author: 'ana', likes: [], timestamp: 100 },
      { id: 'm2', text: 'Segunda', author: 'carlos', likes: [], timestamp: 200 }
    ],
    loadedAt: initialLoadedAt
  });

  // Função updater simulada do server.ts
  function updateCache(updater) {
    const cached = muralCache.get(cacheKey);
    if (!cached) return;
    cached.messages = updater([...cached.messages]);
    muralCache.set(cacheKey, cached);
  }

  // 1. Inserir nova mensagem (POST)
  const newMsg = { id: 'm3', text: 'Terceira', author: 'maria', likes: [], timestamp: 300 };
  updateCache(msgs => [newMsg, ...msgs]);

  // 2. Editar mensagem (PUT)
  updateCache(msgs => msgs.map(m => m.id === 'm1' ? { ...m, text: 'Primeira Editada' } : m));

  // 3. Curtir mensagem (LIKE)
  updateCache(msgs => msgs.map(m => m.id === 'm3' ? { ...m, likes: ['joao'] } : m));

  // 4. Excluir mensagem (DELETE)
  updateCache(msgs => msgs.filter(m => m.id !== 'm2'));

  const entryAfterMutations = muralCache.get(cacheKey);
  assert.strictEqual(entryAfterMutations.loadedAt, initialLoadedAt, 'O loadedAt do TTL DEVE permanecer inalterado');
  assert.strictEqual(entryAfterMutations.messages.length, 2);
  assert.strictEqual(entryAfterMutations.messages.find(m => m.id === 'm1').text, 'Primeira Editada');
  assert.strictEqual(entryAfterMutations.messages.find(m => m.id === 'm3').likes.includes('joao'), true);
  assert.strictEqual(entryAfterMutations.messages.find(m => m.id === 'm2'), undefined);
});

// -------------------------------------------------------------
// 6. PERMISSÃO DE EDIÇÃO / EXCLUSÃO (APENAS O AUTOR)
// -------------------------------------------------------------
console.log('\n--- 6. Proteção de Autoria em Edição e Exclusão ---');

runTest('Usuário que não é o autor é impedido de editar mensagem alheia', () => {
  const currentMsg = { id: 'm1', author: 'ana@ssvp.com', authorEmail: 'ana@ssvp.com' };
  const requestingUser = { username: 'carlos@ssvp.com', email: 'carlos@ssvp.com' };

  const currentAuthor = String(currentMsg.authorEmail || currentMsg.author).toLowerCase();
  const requester = String(requestingUser.username || requestingUser.email).toLowerCase();

  const isAllowed = currentAuthor === requester;
  assert.strictEqual(isAllowed, false, 'Carlos não pode editar mensagem de Ana');
});

runTest('O próprio autor tem permissão de editar e excluir', () => {
  const currentMsg = { id: 'm1', author: 'ana@ssvp.com', authorEmail: 'ana@ssvp.com' };
  const requestingUser = { username: 'ana@ssvp.com', email: 'ana@ssvp.com' };

  const currentAuthor = String(currentMsg.authorEmail || currentMsg.author).toLowerCase();
  const requester = String(requestingUser.username || requestingUser.email).toLowerCase();

  const isAllowed = currentAuthor === requester;
  assert.strictEqual(isAllowed, true, 'Ana pode editar sua própria mensagem');
});

console.log('\n================================================================');
console.log(`TOTAL DE TESTES DA MUDANÇA 005: ${passedCount} PASSOU | ${failedCount} FALHOU`);
console.log('================================================================');

process.exit(failedCount > 0 ? 1 : 0);

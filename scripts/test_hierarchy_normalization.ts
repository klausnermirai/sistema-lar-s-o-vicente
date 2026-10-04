import { extractHierarchyList } from '../lib/hierarchy_api.js';

function runUnitTests() {
  console.log('====================================================');
  console.log(' EXECUTANDO TESTES DE NORMALIZAÇÃO DE RESPOSTAS DA API');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, message?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}: ${message || 'Asserção falhou'}`);
      failed++;
    }
  }

  // 1. Teste: Resposta paginada padrão do backend { items: [...] }
  const paginatedResponse = {
    items: [
      { id: '1', name: 'Conselho Particular Antonio Fred Ozanam' },
      { id: '2', name: 'Conselho Particular Monte Alto' },
    ],
    nextCursor: 'cursor123',
    hasMore: false,
    totalReturned: 2,
  };
  const listFromPaginated = extractHierarchyList<{ id: string; name: string }>(paginatedResponse);
  assert(
    'Extrai array de resposta paginada { items: [...] }',
    Array.isArray(listFromPaginated) &&
      listFromPaginated.length === 2 &&
      listFromPaginated[0].name === 'Conselho Particular Antonio Fred Ozanam'
  );

  // 2. Teste: Resposta direta em formato Array [...]
  const directArrayResponse = [
    { id: 'conf1', name: 'São João Apóstolo' },
    { id: 'conf2', name: 'São Tarcísio' },
    { id: 'conf3', name: 'São José' },
  ];
  const listFromDirect = extractHierarchyList<{ id: string; name: string }>(directArrayResponse);
  assert(
    'Mantém compatibilidade com array direto [...]',
    Array.isArray(listFromDirect) &&
      listFromDirect.length === 3 &&
      listFromDirect[2].name === 'São José'
  );

  // 3. Teste: Resposta vazia paginada { items: [] }
  const emptyPaginated = { items: [], totalReturned: 0 };
  const listFromEmptyPaginated = extractHierarchyList(emptyPaginated);
  assert(
    'Retorna array vazio para { items: [] }',
    Array.isArray(listFromEmptyPaginated) && listFromEmptyPaginated.length === 0
  );

  // 4. Teste: Resposta nula / undefined / vazia (sem causar tela branca)
  const listFromNull = extractHierarchyList(null);
  assert('Retorna array vazio para null', Array.isArray(listFromNull) && listFromNull.length === 0);

  const listFromUndefined = extractHierarchyList(undefined);
  assert('Retorna array vazio para undefined', Array.isArray(listFromUndefined) && listFromUndefined.length === 0);

  // 5. Teste: Resposta com objeto inesperado / string / número
  const listFromUnexpectedObj = extractHierarchyList({ status: 'ok', data: 123 });
  assert(
    'Retorna array vazio para objeto inesperado sem campo items',
    Array.isArray(listFromUnexpectedObj) && listFromUnexpectedObj.length === 0
  );

  const listFromString = extractHierarchyList('invalid json response');
  assert('Retorna array vazio para string', Array.isArray(listFromString) && listFromString.length === 0);

  // 6. Teste de imunidade do .filter() contra dados anômalos
  let filterErrored = false;
  try {
    const rawData: any = { items: [{ name: 'Test CP' }] };
    const safeData = extractHierarchyList(rawData);
    const filtered = safeData.filter((i: any) => i.name.includes('Test'));
    assert('Filter funciona sem erros em dados extraídos', filtered.length === 1);
  } catch (e) {
    filterErrored = true;
  }
  assert('Filter não lança exceção em tempo de execução', !filterErrored);

  console.log('\n====================================================');
  console.log(` TOTAL DE TESTES: ${passed + failed} | SUCESSO: ${passed} | FALHAS: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUnitTests();

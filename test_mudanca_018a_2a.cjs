const assert = require('assert');

const {
  MONTE_ALTO_OPERATIONAL_ID,
  MONTE_ALTO_CNPJ,
  MONTE_ALTO_DUPLICATE_IDS,
  isMonteAltoUnit,
  isKnownDuplicateMonteAltoId,
  getCanonicalInstitutionId,
  getMonteAltoQueryIds,
  isUserAuthorizedForInstitution,
  sanitizeCanonicalUnits
} = require('./lib/canonical_units.ts');

const LEGACY_ID = 'aJjdEdwW0lQqV1gC1uin';

assert.strictEqual(
  MONTE_ALTO_DUPLICATE_IDS.includes(LEGACY_ID),
  true,
  'O alias legado deve constar na lista de IDs conhecidos de Monte Alto.'
);

assert.strictEqual(
  isMonteAltoUnit(LEGACY_ID),
  true,
  'O alias legado deve ser reconhecido como Monte Alto.'
);

assert.strictEqual(
  isKnownDuplicateMonteAltoId(LEGACY_ID),
  true,
  'O alias legado deve ser reconhecido como ID duplicado conhecido.'
);

assert.strictEqual(
  getCanonicalInstitutionId(LEGACY_ID),
  MONTE_ALTO_OPERATIONAL_ID,
  'O alias legado deve resolver para o tenant operacional oficial.'
);

assert.strictEqual(
  getMonteAltoQueryIds().includes(LEGACY_ID),
  true,
  'As consultas compatíveis de Monte Alto devem incluir o alias legado.'
);

const legacyUser = {
  id: 'legacy-user',
  username: 'legacy-user@example.com',
  institutionId: LEGACY_ID
};

assert.strictEqual(
  isUserAuthorizedForInstitution(legacyUser, MONTE_ALTO_OPERATIONAL_ID),
  true,
  'Usuário do alias legado deve acessar o tenant oficial de Monte Alto.'
);

assert.strictEqual(
  isUserAuthorizedForInstitution(legacyUser, MONTE_ALTO_CNPJ),
  true,
  'Usuário do alias legado deve acessar Monte Alto também pelo CNPJ canônico.'
);

assert.strictEqual(
  isUserAuthorizedForInstitution(legacyUser, 'inst-outra-unidade'),
  false,
  'O alias legado de Monte Alto não pode conceder acesso a outra unidade.'
);

const sanitized = sanitizeCanonicalUnits([
  { id: MONTE_ALTO_OPERATIONAL_ID, cnpj: MONTE_ALTO_CNPJ, name: 'Lar São Vicente de Paulo de Monte Alto' },
  { id: LEGACY_ID, cnpj: MONTE_ALTO_CNPJ, name: 'Lar São Vicente de Paulo de Monte Alto - legado' }
]);

assert.strictEqual(
  sanitized.length,
  1,
  'A unidade legada e a oficial devem ser deduplicadas na seleção de unidades.'
);

assert.strictEqual(
  sanitized[0].id,
  MONTE_ALTO_OPERATIONAL_ID,
  'A unidade deduplicada deve preservar o ID operacional oficial.'
);

console.log('Mudança 018A.2A: validação do alias legado de Monte Alto aprovada.');

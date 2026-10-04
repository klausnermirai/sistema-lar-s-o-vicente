/**
 * Testes Unitários e de Integração para Membro SSVP (Validator, Service e API Client)
 */

import { validateMembroInput, normalizeName } from '../lib/membro_validator.ts';
import {
  createMembroConferencia,
  updateMembroConferencia,
  inactivateMembroConferencia,
  listMembrosConferencia,
  MembroRepository,
} from '../lib/membro_service.ts';
import { MembroSSVP, StandaloneConferencia } from '../types.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

// Mock Repository em memória
class MockMembroRepository implements MembroRepository {
  public conferencias: Map<string, StandaloneConferencia> = new Map();
  public membros: Map<string, MembroSSVP> = new Map();

  async getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null> {
    return this.conferencias.get(conferenciaId) || null;
  }

  async getById(id: string): Promise<MembroSSVP | null> {
    return this.membros.get(id) || null;
  }

  async listByConferencia(conferenciaId: string, options?: any): Promise<MembroSSVP[]> {
    let list = Array.from(this.membros.values()).filter((m) => m.conferenciaId === conferenciaId);
    if (options?.status && options.status !== 'todos') {
      list = list.filter((m) => m.status === options.status);
    }
    if (options?.type && options.type !== 'todos') {
      list = list.filter((m) => m.type === options.type);
    }
    return list;
  }

  async create(membro: Omit<MembroSSVP, 'id'>): Promise<MembroSSVP> {
    const id = `membro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const created: MembroSSVP = {
      ...membro,
      id,
    };
    this.membros.set(id, created);
    return created;
  }

  async update(id: string, updates: Partial<MembroSSVP>): Promise<MembroSSVP> {
    const existing = this.membros.get(id);
    if (!existing) throw new Error('Not found');
    const updated = { ...existing, ...updates };
    this.membros.set(id, updated);
    return updated;
  }

  async inactivate(id: string, userId: string): Promise<MembroSSVP> {
    const existing = this.membros.get(id);
    if (!existing) throw new Error('Not found');
    const updated: MembroSSVP = {
      ...existing,
      status: 'inativo',
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };
    this.membros.set(id, updated);
    return updated;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log(' Executando Testes Unitários de Membros da Conferência');
  console.log('======================================================================');

  // TEST 1: Validador
  console.log('\n[TEST 1] Validação de Dados de Membro');
  const validPayload = {
    fullName: '  José da Silva Sauro ',
    type: 'confrade',
    phone: '(11) 98765-4321',
    email: 'jose@ssvp.org.br',
    admissionDate: '2020-01-15',
    acclamationDate: '2021-03-20',
    proclamationDate: '2022-05-10',
  };
  const valResult = validateMembroInput(validPayload);
  assert(valResult.valid, 'Payload válido deve passar na validação');
  assert(valResult.cleanData?.fullName === 'José da Silva Sauro', 'Nome deve ser aparado');
  assert(valResult.cleanData?.normalizedName === 'JOSE DA SILVA SAURO', 'Nome normalizado correto');
  assert(valResult.cleanData?.admissionDate === '2020-01-15', 'Data de ingresso preservada');
  assert(valResult.cleanData?.acclamationDate === '2021-03-20', 'Data de aclamação preservada');
  assert(valResult.cleanData?.proclamationDate === '2022-05-10', 'Data de proclamação preservada');

  // TEST 2: Validador - Datas opcionais e tipos permitidos
  console.log('\n[TEST 2] Suporte a Confrade, Consócia, Auxiliar e Aspirante');
  ['confrade', 'consocia', 'auxiliar', 'aspirante'].forEach((t) => {
    const res = validateMembroInput({ fullName: `Membro ${t}`, type: t });
    assert(res.valid, `Tipo ${t} deve ser válido`);
  });

  const invalidTypeRes = validateMembroInput({ fullName: 'Membro Teste', type: 'invalido' });
  assert(invalidTypeRes.valid && invalidTypeRes.cleanData?.type === 'confrade', 'Tipo inválido deve adotar confrade como fallback seguro');

  // TEST 3: Service - Cadastro de Membro
  console.log('\n[TEST 3] Service - createMembroConferencia com Vínculos e Auditoria');
  const repo = new MockMembroRepository();
  repo.conferencias.set('conf-100', {
    id: 'conf-100',
    particularId: 'cp-50',
    centralId: 'central-1',
    name: 'Conferência Santa Dulce',
    normalizedName: 'CONFERENCIA SANTA DULCE',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-adm',
    updatedBy: 'user-adm',
  });

  const authContext = {
    allowed: true,
    validatedCentralId: 'central-1',
    userId: 'user-auth-123',
  };

  const createRes = await createMembroConferencia('conf-100', validPayload, authContext, repo);
  assert(createRes.success, 'Criação de membro deve ter sucesso');
  assert(createRes.data?.conferenciaId === 'conf-100', 'conferenciaId vinculado corretamente');
  assert(createRes.data?.particularId === 'cp-50', 'particularId herdado da Conferência');
  assert(createRes.data?.centralId === 'central-1', 'centralId validado do authContext');
  assert(createRes.data?.status === 'ativo', 'Status inicial deve ser ativo');
  assert(createRes.data?.createdBy === 'user-auth-123', 'Auditoria createdBy preenchida');

  const createdId = createRes.data?.id!;

  // TEST 4: Service - Edição de Membro
  console.log('\n[TEST 4] Service - updateMembroConferencia');
  const updateRes = await updateMembroConferencia(
    createdId,
    'conf-100',
    {
      fullName: 'José da Silva Sauro Jr',
      type: 'confrade',
      admissionDate: '2019-06-01',
    },
    authContext,
    repo
  );
  assert(updateRes.success, 'Atualização de membro deve ter sucesso');
  assert(updateRes.data?.fullName === 'José da Silva Sauro Jr', 'Nome atualizado com sucesso');
  assert(updateRes.data?.admissionDate === '2019-06-01', 'Data de ingresso atualizada');

  // TEST 5: Service - Inativação sem Exclusão
  console.log('\n[TEST 5] Service - inactivateMembroConferencia');
  const inactivateRes = await inactivateMembroConferencia(createdId, 'conf-100', authContext, repo);
  assert(inactivateRes.success, 'Inativação de membro deve ter sucesso');
  assert(inactivateRes.data?.status === 'inativo', 'Status deve mudar para inativo');

  // Não deve permitir inativar novamente
  const reInactivateRes = await inactivateMembroConferencia(createdId, 'conf-100', authContext, repo);
  assert(!reInactivateRes.success, 'Não deve permitir inativar membro já inativo');
  assert(reInactivateRes.code === 'ALREADY_INACTIVE', 'Código deve ser ALREADY_INACTIVE');

  // TEST 6: Service - Listagem e Filtros
  console.log('\n[TEST 6] Service - listMembrosConferencia');
  // Cadastrar mais membros
  await createMembroConferencia('conf-100', { fullName: 'Maria Aparecida', type: 'consocia' }, authContext, repo);
  await createMembroConferencia('conf-100', { fullName: 'Lucas Aspirante', type: 'aspirante' }, authContext, repo);
  await createMembroConferencia('conf-100', { fullName: 'Carlos Auxiliar', type: 'auxiliar' }, authContext, repo);

  const listAll = await listMembrosConferencia('conf-100', authContext, repo);
  assert(listAll.success, 'Listagem de membros deve ter sucesso');
  assert(listAll.data?.length === 4, 'Total de 4 membros na conferência');

  const listAtivos = await listMembrosConferencia('conf-100', authContext, repo, { status: 'ativo' });
  assert(listAtivos.data?.length === 3, 'Total de 3 membros ativos');

  const listConsocias = await listMembrosConferencia('conf-100', authContext, repo, { type: 'consocia' });
  assert(listConsocias.data?.length === 1, 'Total de 1 consócia');

  console.log('======================================================================');
  console.log(` RESULTADOS DOS TESTES: ${passed} Passou | ${failed} Falhou`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

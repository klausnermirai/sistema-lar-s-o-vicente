import assert from 'node:assert';
import {
  FamiliaRepository,
  listFamiliasService,
  createFamiliaService,
  updateFamiliaService,
  archiveFamiliaService,
  unarchiveFamiliaService,
  createVisitaService,
  ServiceAuthContext,
} from '../lib/familia_service.ts';
import {
  FamiliaAssistidaCompleta,
  StandaloneConferencia,
  VisitaFamiliaSSVP,
  ControleCestasMensalStats,
  FichaSindicanciaData,
} from '../types.ts';

// In-memory mock repository to test all service rules and flows without side-effects
class MockFamiliaRepository implements FamiliaRepository {
  public conferencias: Map<string, StandaloneConferencia> = new Map();
  public familias: Map<string, FamiliaAssistidaCompleta> = new Map();
  public visitas: Map<string, VisitaFamiliaSSVP[]> = new Map();

  async getConferenciaById(conferenciaId: string): Promise<StandaloneConferencia | null> {
    return this.conferencias.get(conferenciaId) || null;
  }

  async getFamiliaById(id: string): Promise<FamiliaAssistidaCompleta | null> {
    return this.familias.get(id) || null;
  }

  async listFamiliasByConferencia(conferenciaId: string, options?: any): Promise<FamiliaAssistidaCompleta[]> {
    let list = Array.from(this.familias.values());
    if (conferenciaId && conferenciaId !== 'all') {
      list = list.filter((f) => f.conferenciaId === conferenciaId);
    }
    if (options?.status && options.status !== 'todos') {
      list = list.filter((f) => f.status === options.status);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (f) =>
          f.nomeAssistido.toLowerCase().includes(q) ||
          (f.cpfAssistido || '').includes(q) ||
          f.enderecoResumido.toLowerCase().includes(q)
      );
    }
    return list;
  }

  async createFamilia(data: Omit<FamiliaAssistidaCompleta, 'id'>): Promise<FamiliaAssistidaCompleta> {
    const id = 'fam_' + Math.random().toString(36).substring(2, 9);
    const created: FamiliaAssistidaCompleta = { id, ...data };
    this.familias.set(id, created);
    return created;
  }

  async updateFamilia(id: string, updates: Partial<FamiliaAssistidaCompleta>): Promise<FamiliaAssistidaCompleta> {
    const existing = this.familias.get(id);
    if (!existing) throw new Error('Familia não encontrada');
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.familias.set(id, updated);
    return updated;
  }

  async listVisitasByFamilia(familiaId: string): Promise<VisitaFamiliaSSVP[]> {
    return this.visitas.get(familiaId) || [];
  }

  async createVisita(visita: Omit<VisitaFamiliaSSVP, 'id'>): Promise<VisitaFamiliaSSVP> {
    const id = 'vis_' + Math.random().toString(36).substring(2, 9);
    const created: VisitaFamiliaSSVP = { id, ...visita };
    const list = this.visitas.get(visita.familiaId) || [];
    list.unshift(created);
    this.visitas.set(visita.familiaId, list);

    const fam = this.familias.get(visita.familiaId);
    if (fam) {
      fam.totalVisitasRealizadas = (fam.totalVisitasRealizadas || 0) + 1;
      fam.dataUltimaVisita = visita.dataVisita;
      if (visita.entregueCesta) {
        fam.totalCestasRecebidas = (fam.totalCestasRecebidas || 0) + (visita.quantidadeCestas || 1);
        fam.ultimoMesAnoCesta = visita.mesAnoCompetencia;
        fam.recebeuCestaMesAtual = true;
      }
      this.familias.set(fam.id, fam);
    }
    return created;
  }

  async deleteVisita(familiaId: string, visitaId: string): Promise<boolean> {
    const list = this.visitas.get(familiaId) || [];
    this.visitas.set(
      familiaId,
      list.filter((v) => v.id !== visitaId)
    );
    return true;
  }

  async getControleCestasMensal(conferenciaId: string, mesAno: string): Promise<ControleCestasMensalStats> {
    const conf = this.conferencias.get(conferenciaId);
    const todasFamilias = Array.from(this.familias.values()).filter((f) => f.conferenciaId === conferenciaId);
    const ativas = todasFamilias.filter((f) => f.status === 'ativo');
    const arquivadas = todasFamilias.filter((f) => f.status === 'arquivado');

    let totalCestas = 0;
    let atendidas = 0;

    for (const fam of ativas) {
      const visList = this.visitas.get(fam.id) || [];
      const visMes = visList.filter((v) => v.mesAnoCompetencia === mesAno && v.entregueCesta);
      if (visMes.length > 0) {
        atendidas += 1;
        totalCestas += visMes.reduce((s, v) => s + (v.quantidadeCestas || 1), 0);
      }
    }

    return {
      mesAno,
      conferenciaId,
      conferenciaNome: conf?.name || 'Conferência Teste',
      totalFamiliasAtivas: ativas.length,
      totalFamiliasArquivadas: arquivadas.length,
      totalFamiliasAtendidasComCesta: atendidas,
      totalCestasEntregues: totalCestas,
      familiasSemCestaNoMes: Math.max(0, ativas.length - atendidas),
    };
  }
}

async function runAllTests() {
  console.log('🚀 Iniciando bateria de testes do Módulo de Famílias Assistidas SSVP...\n');

  const repo = new MockFamiliaRepository();

  // Mock de Conferência e Conselho Central
  const conf1: StandaloneConferencia = {
    id: 'conf_1',
    name: 'Conferência São Vicente de Paulo',
    particularId: 'cp_1',
    centralId: 'central_abc',
    status: 'ativo',
    meetingDay: 'Sábado',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  repo.conferencias.set(conf1.id, conf1);

  const authOk: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'central_abc',
    userId: 'user_123',
  };

  const authUnauthorized: ServiceAuthContext = {
    allowed: false,
    validatedCentralId: undefined,
  };

  const authOtherCentral: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'central_xyz',
  };

  // ----------------------------------------------------
  // TESTE 1: Validação de Autorização e Conselho Central
  // ----------------------------------------------------
  console.log('🧪 Teste 1: Validação de Autorização e Conselho Central');
  const resAuthFail = await listFamiliasService('conf_1', authUnauthorized, repo);
  assert.strictEqual(resAuthFail.success, false, 'Deve rejeitar usuário não autorizado');
  assert.strictEqual(resAuthFail.code, 'UNAUTHORIZED');

  const resCentralMismatch = await listFamiliasService('conf_1', authOtherCentral, repo);
  assert.strictEqual(resCentralMismatch.success, false, 'Deve rejeitar conselho incompatível');
  assert.strictEqual(resCentralMismatch.code, 'CENTRAL_MISMATCH');
  console.log('✅ Teste 1 passou com sucesso!');

  // ----------------------------------------------------
  // TESTE 2: Criação de Família com Ficha de Sindicância
  // ----------------------------------------------------
  console.log('\n🧪 Teste 2: Criação de Família com Ficha de Sindicância (1ª Visita)');
  const sindicanciaData: FichaSindicanciaData = {
    assistidoNome: 'Maria Aparecida da Silva',
    assistidoDataNasc: '1980-05-15',
    assistidoCpf: '123.456.789-00',
    assistidoTelefone: '(11) 98765-4321',
    conjugeNome: 'José da Silva',
    conjugeDataNasc: '1978-02-10',
    endereco: 'Rua das Flores',
    numero: '120',
    bairro: 'Jardim Esperança',
    cidade: 'Franca',
    estado: 'SP',
    estadoCivil: 'casado',
    religiao: 'Católica',
    situacaoMoradia: 'alugada',
    membrosFamilia: [
      { id: 'm1', name: 'Lucas da Silva', age: 10, isBatizado: true, kinship: 'Filho' },
      { id: 'm2', name: 'Ana da Silva', age: 6, isBatizado: false, kinship: 'Filha' },
    ],
    profissao: 'Diarista',
    quantosTrabalham: 1,
    valorAluguel: 600,
    rendaLiquida: 1200,
    assistenciaGoverno: 'Bolsa Família',
    valorAssistenciaGoverno: 600,
    outrasRendas: 0,
    alguemDoente: 'Não',
    precisaMedicacao: false,
    participacaoIgreja: 'Frequentam missas aos domingos',
    precisamSacramentos: 'Crisma do filho mais velho',
    observacoesGerais: 'Família humilde e acolhedora.',
    visitadoresPrimeiraVisita: ['Confrade João', 'Consócia Maria'],
    dataAprovacao: '2026-08-01',
    assinaturaPresidenteNome: 'Presidente Paulo',
    statusSindicancia: 'aprovado',
  };

  const createRes = await createFamiliaService('conf_1', { sindicancia: sindicanciaData }, authOk, repo);
  assert.strictEqual(createRes.success, true, 'Deve criar família com sucesso');
  assert.ok(createRes.data?.id, 'Família deve possuir ID gerado');
  assert.strictEqual(createRes.data?.nomeAssistido, 'Maria Aparecida da Silva');
  assert.strictEqual(createRes.data?.status, 'ativo');
  assert.strictEqual(createRes.data?.sindicancia.membrosFamilia.length, 2);
  const familiaId = createRes.data!.id;
  console.log('✅ Teste 2 passou com sucesso! Família ID:', familiaId);

  // ----------------------------------------------------
  // TESTE 3: Listagem e Busca de Famílias
  // ----------------------------------------------------
  console.log('\n🧪 Teste 3: Listagem e Busca com Filtros');
  const listRes = await listFamiliasService('conf_1', authOk, repo, { search: 'Aparecida' });
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.data?.length, 1);
  assert.strictEqual(listRes.data![0].id, familiaId);

  const searchNenhum = await listFamiliasService('conf_1', authOk, repo, { search: 'NomeInexistenteXYZ' });
  assert.strictEqual(searchNenhum.data?.length, 0);
  console.log('✅ Teste 3 passou com sucesso!');

  // ----------------------------------------------------
  // TESTE 4: Registro de Visita com Entrega de Cesta
  // ----------------------------------------------------
  console.log('\n🧪 Teste 4: Registro de Visita e Atualização Automática de Cestas');
  const visitaRes = await createVisitaService(
    familiaId,
    {
      dataVisita: '2026-08-15',
      visitadoresIds: ['membro_1', 'membro_2'],
      visitadoresNomes: ['Confrade Carlos', 'Consócia Teresa'],
      entregueCesta: true,
      quantidadeCestas: 1,
      tipoAuxilioExtra: 'Leite e Fraldas',
      comentarios: 'Visita realizada com sucesso. Família em boa saúde.',
    },
    authOk,
    repo
  );

  assert.strictEqual(visitaRes.success, true, 'Deve registrar visita');
  assert.strictEqual(visitaRes.data?.mesAnoCompetencia, '2026-08');

  // Checar se a família teve os contadores atualizados
  const famAtualizada = await repo.getFamiliaById(familiaId);
  assert.strictEqual(famAtualizada?.totalVisitasRealizadas, 1, 'Total de visitas deve ser 1');
  assert.strictEqual(famAtualizada?.totalCestasRecebidas, 1, 'Total de cestas deve ser 1');
  assert.strictEqual(famAtualizada?.dataUltimaVisita, '2026-08-15');
  console.log('✅ Teste 4 passou com sucesso!');

  // ----------------------------------------------------
  // TESTE 5: Controle Mensal de Cestas da Conferência
  // ----------------------------------------------------
  console.log('\n🧪 Teste 5: Cálculo do Controle Mensal de Cestas');
  const statsAgo = await repo.getControleCestasMensal('conf_1', '2026-08');
  assert.strictEqual(statsAgo.totalFamiliasAtivas, 1);
  assert.strictEqual(statsAgo.totalFamiliasAtendidasComCesta, 1);
  assert.strictEqual(statsAgo.totalCestasEntregues, 1);
  assert.strictEqual(statsAgo.familiasSemCestaNoMes, 0);

  const statsSet = await repo.getControleCestasMensal('conf_1', '2026-09');
  assert.strictEqual(statsSet.totalFamiliasAtivas, 1);
  assert.strictEqual(statsSet.totalFamiliasAtendidasComCesta, 0, 'No mês seguinte deve estar pendente');
  assert.strictEqual(statsSet.familiasSemCestaNoMes, 1);
  console.log('✅ Teste 5 passou com sucesso!');

  // ----------------------------------------------------
  // TESTE 6: Arquivamento e Desarquivamento
  // ----------------------------------------------------
  console.log('\n🧪 Teste 6: Fluxo de Arquivamento e Desarquivamento');
  const archiveRes = await archiveFamiliaService(
    familiaId,
    'promocao_social',
    'Família alcançou autonomia financeira',
    authOk,
    repo
  );
  assert.strictEqual(archiveRes.success, true);
  assert.strictEqual(archiveRes.data?.status, 'arquivado');
  assert.strictEqual(archiveRes.data?.motivoArquivamento, 'promocao_social');

  // Listar ativas não deve trazer a família
  const listAtivas = await listFamiliasService('conf_1', authOk, repo, { status: 'ativo' });
  assert.strictEqual(listAtivas.data?.length, 0);

  // Listar arquivadas deve trazer
  const listArquivadas = await listFamiliasService('conf_1', authOk, repo, { status: 'arquivado' });
  assert.strictEqual(listArquivadas.data?.length, 1);

  // Desarquivar
  const unarchiveRes = await unarchiveFamiliaService(familiaId, authOk, repo);
  assert.strictEqual(unarchiveRes.success, true);
  assert.strictEqual(unarchiveRes.data?.status, 'ativo');
  console.log('✅ Teste 6 passou com sucesso!');

  // ----------------------------------------------------
  // TESTE 7: Isolamento por Conferência do Vicentino Comum (Membro)
  // ----------------------------------------------------
  console.log('\n🧪 Teste 7: Isolamento por Conferência do Vicentino Comum');
  const conf2: StandaloneConferencia = {
    id: 'conf_2',
    name: 'Conferência São Vicente',
    centralId: 'central_abc',
    particularId: 'cp_1',
    status: 'ativo',
  };
  repo.conferencias.set(conf2.id, conf2);

  const authMembroConf1: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'central_abc',
    userId: 'wanderson_1',
    isAdmin: false,
    conferenciaId: 'conf_1',
    role: 'Membro da Conferência',
    accessLevel: 'membro_conferencia',
  };

  // Membro de conf_1 tentando criar família em conf_2
  const createConf2Blocked = await createFamiliaService('conf_2', { sindicancia: sindicanciaData }, authMembroConf1, repo);
  assert.strictEqual(createConf2Blocked.success, false);
  assert.strictEqual(createConf2Blocked.code, 'UNAUTHORIZED');

  // Membro de conf_1 tentando listar famílias de conf_2
  const listConf2Blocked = await listFamiliasService('conf_2', authMembroConf1, repo);
  assert.strictEqual(listConf2Blocked.success, false);
  assert.strictEqual(listConf2Blocked.code, 'UNAUTHORIZED');

  // Membro de conf_1 listando sua própria conferência conf_1 (deve funcionar)
  const listConf1Allowed = await listFamiliasService('conf_1', authMembroConf1, repo);
  assert.strictEqual(listConf1Allowed.success, true);

  // Criar família em conf_2 usando admin para testar bloqueio de visita
  const authAdmin: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: 'central_abc',
    userId: 'admin_1',
    isAdmin: true,
  };
  const createFam2Admin = await createFamiliaService('conf_2', { sindicancia: { ...sindicanciaData, assistidoNome: 'Família Conf 2' } }, authAdmin, repo);
  assert.strictEqual(createFam2Admin.success, true);
  const fam2Id = createFam2Admin.data!.id;

  // Membro de conf_1 tentando registrar visita na família de conf_2
  const visitaBlocked = await createVisitaService(
    fam2Id,
    {
      dataVisita: '2026-08-20',
      visitadoresIds: ['wanderson_1'],
      visitadoresNomes: ['Wanderson'],
      entregueCesta: true,
      quantidadeCestas: 1,
      comentarios: 'Tentativa não autorizada',
    },
    authMembroConf1,
    repo
  );
  assert.strictEqual(visitaBlocked.success, false);
  assert.strictEqual(visitaBlocked.code, 'UNAUTHORIZED');

  // Membro de conf_1 tentando alterar família de conf_2
  const updateBlocked = await updateFamiliaService(fam2Id, { telefone: '123' }, authMembroConf1, repo);
  assert.strictEqual(updateBlocked.success, false);
  assert.strictEqual(updateBlocked.code, 'UNAUTHORIZED');

  console.log('✅ Teste 7 passou com sucesso!');

  console.log('\n🎉 TODOS OS 7 TESTES DE NEGÓCIO, ISOLAMENTO E REGRESSÃO PASSARAM COM SUCESSO (100% GREEN)!');
}

runAllTests().catch((err) => {
  console.error('❌ Erro durante a execução dos testes:', err);
  process.exit(1);
});

import { LocalDbFallback } from '../lib/local_db_fallback.js';
import { FirestoreConselhoParticularRepository } from '../lib/firestore_conselho_particular_repository.js';
import { FirestoreConferenciaRepository } from '../lib/firestore_conferencia_repository.js';
import { createConselhoParticular, listConselhosParticulares, ServiceAuthContext } from '../lib/conselho_particular_service.js';
import { createConferencia, listConferencias } from '../lib/conferencia_service.js';
import { normalizeName } from '../lib/hierarchy_utils.js';

interface RawConferenciaImport {
  name: string;
}

interface RawCpImport {
  name: string;
  city: string;
  address: string;
  cep: string;
  phone: string;
  email: string;
  startDate: string;
  endDate: string;
  presidenteName: string;
  presidentePhone: string;
  conferencias: RawConferenciaImport[];
}

const IMPORT_DATA: RawCpImport[] = [
  {
    name: 'Conselho Particular Antonio Fred Ozanam',
    city: 'Jaboticabal',
    address: 'Av. José Batista Ferreira, 795 - Aparecida',
    cep: '14882-115',
    phone: '(16) 99723-1683',
    email: 'cpaf.ozanam@gmail.com, mariadonadon@outlook.com',
    startDate: '2024-12-05',
    endDate: '2028-12-04',
    presidenteName: 'CARLA HELENA D. CAETANO',
    presidentePhone: '(16) 99723-1683',
    conferencias: [
      { name: 'SÃO JOÃO APÓSTOLO' },
      { name: 'SÃO TARCÍSIO' },
      { name: 'SÃO JOSÉ' },
      { name: 'SANTA ISABEL' },
      { name: 'NOSSA SENHORA APARECIDA' },
      { name: 'NOSSA SENHORA DE FÁTIMA' },
      { name: 'SANTA TERESA DE JESUS' },
      { name: 'SÃO FRANCISCO DE ASSIS' },
      { name: 'SÃO MATEUS' },
    ],
  },
  {
    name: 'Conselho Particular Santo Antônio de Santana Galvão (Monte Alto)',
    city: 'Monte Alto',
    address: 'Travessa da Saudade, s/n - Centro',
    cep: '15910-000',
    phone: '(16) 98137-9063',
    email: 'cpfreigalvaoma@gmail.com, norbertoquintini31@gmail.com',
    startDate: '2025-07-24',
    endDate: '2029-07-23',
    presidenteName: 'Norberto Quintino Costa',
    presidentePhone: '(16) 98137-9063',
    conferencias: [
      { name: 'NOSSA SENHORA APARECIDA' },
      { name: 'SANTA CATARINA LABOURÉ' },
      { name: 'SÃO SEBASTIÃO' },
      { name: 'SÃO BENEDITO' },
      { name: 'SÃO BRÁS' },
      { name: 'SANTO AGOSTINHO' },
      { name: 'SANTA RITA (VISTA ALEGRE)' },
      { name: 'SANTA LUZIA (FERNANDO PRESTES)' },
    ],
  },
  {
    name: 'Conselho Particular Imaculada Conceição (Taiaçú)',
    city: 'Taiaçu',
    address: 'Rua São Sebastião, 379 - Centro',
    cep: '14725-000',
    phone: '(16) 99274-9316',
    email: 'ferminoodair9@gmail.com',
    startDate: '2026-03-02',
    endDate: '2030-03-01',
    presidenteName: 'ODAIR FERMINO',
    presidentePhone: '(16) 99274-9316',
    conferencias: [
      { name: 'BOM PASTOR (TAIUVA)' },
      { name: 'IMACULADO CORAÇÃO DE MARIA' },
      { name: 'SÃO FRANCISCO (TAIAÇU)' },
      { name: 'SÃO JOSÉ (TAIAÇU)' },
      { name: 'SANTO ANTONIO (PIRANGI)' },
      { name: 'SANTA CATARINA (PIRANGI)' },
      { name: 'NOSSA SENHORA APARECIDA (BEBEDOURO)' },
      { name: 'NOSSA SENHORA APARECIDA (VIRADOURO)' },
      { name: 'NOSSA SENHORA APARECIDA (CCA=TAIAÇÚ)' },
    ],
  },
  {
    name: 'Conselho Particular Nossa Senhora do Carmo',
    city: 'Jaboticabal',
    address: 'Av. Prudêncio Ortiz, 341',
    cep: '14870-690',
    phone: '(16) 99260-1015',
    email: 'alex.melossvp@gmail.com',
    startDate: '2026-06-27',
    endDate: '2029-06-26',
    presidenteName: 'Alex Aparecido de Melo',
    presidentePhone: '(16) 99260-1015',
    conferencias: [
      { name: 'SÃO MATHEUS (BARRINHA)' },
      { name: 'MARIA DE NAZARÉ' },
      { name: 'SÃO CAMILO DE LELLIS' },
      { name: 'JESUS CRUCIFICADO' },
      { name: 'SANTO ANTONIO' },
      { name: 'SÃO JUDAS TADEU' },
      { name: 'SÃO BENEDITO' },
      { name: 'CCA São Tarcísio (Barrinha)' },
    ],
  },
  {
    name: 'Conselho Particular de Taquaritinga',
    city: 'Taquaritinga',
    address: 'Av. Antônio Micali, 1467 - Jd São Vicente',
    cep: '15900-000',
    phone: '(16) 99736-0146, (16) 3252-3055',
    email: 'ssvptaquaritinga@hotmail.com',
    startDate: '2024-12-12',
    endDate: '2026-12-12',
    presidenteName: 'Maria Claudete Marotti Rizzo',
    presidentePhone: '(16) 99736-0146',
    conferencias: [
      { name: 'SÃO LUIZ GONZAGA' },
      { name: 'SÃO SEBASTIÃO' },
      { name: 'SANTA TEREZINHA M. JESUS' },
      { name: 'SANTO AGOSTINHO' },
      { name: 'SÃO JOSÉ' },
      { name: 'SÃO JOÃO' },
      { name: 'SAGRADO CORAÇÃO DE JESUS' },
      { name: 'SANTA RITA DE CÁSSIA - CCA' },
      { name: 'SANTÍSSIMA TRINDADE' },
      { name: 'SÃO CAETANO' },
      { name: 'SÃO FRANC. DE PAULA (DOBRADA)' },
    ],
  },
  {
    name: 'Conselho Particular Monte Alto',
    city: 'Monte Alto',
    address: 'Largo 08 de Fevereiro, 1384 - Centro',
    cep: '15910-000',
    phone: '(16) 99631-1718',
    email: 'conselhoparticularmontealto@gmail.com',
    startDate: '2026-07-04',
    endDate: '2030-07-03',
    presidenteName: 'Ailton Roberto Costa',
    presidentePhone: '(16) 99631-1718',
    conferencias: [
      { name: 'NOSSA SENHORA DE PERPÉTUO SOCORRO' },
      { name: 'SÃO JUDAS TADEU' },
      { name: 'SÃO CAMILO DE LELIS' },
      { name: 'SÃO CRISTOVÃO' },
      { name: 'SR. BOM JESUS' },
      { name: 'SAGRADO CORAÇÃO DE JESUS (CCA)' },
      { name: 'SANTA RITA DE CÁSSIA' },
    ],
  },
];

async function runRealImport() {
  console.log('======================================================================');
  console.log(' INICIANDO IMPORTAÇÃO REAL E IDEMPOTENTE: CONSELHO CENTRAL DE JABOTICABAL');
  console.log('======================================================================\n');

  const centralId = '54.927.132/0001-92';
  const authContext: ServiceAuthContext = {
    allowed: true,
    validatedCentralId: centralId,
    userId: 'importacao-pdf-oficial',
  };

  const db = new LocalDbFallback() as any;
  const cpRepo = new FirestoreConselhoParticularRepository(db);
  const confRepo = new FirestoreConferenciaRepository(db);

  // Garantir existência da instituição Conselho Central no banco de dados se não existir
  const instSnap = await db.collection('institutions').doc(centralId).get();
  if (!instSnap.exists) {
    console.log(`[INSTITUIÇÃO] Cadastrando/Garantindo Conselho Central no banco (${centralId})...`);
    await db.collection('institutions').doc(centralId).set({
      id: centralId,
      name: 'Conselho Central de Jaboticabal',
      cnpj: centralId,
      city: 'Jaboticabal',
      entityType: 'conselho_central',
      type: 'conselho_central',
      createdAt: new Date().toISOString(),
    });
  }

  // Estatísticas de execução
  const stats = {
    cpsCreated: 0,
    cpsIgnored: 0,
    cpsConflict: 0,
    confCreated: 0,
    confIgnored: 0,
    confConflict: 0,
    unimported: [] as Array<{ type: string; name: string; parent?: string; reason: string }>,
  };

  // Buscar CPs existentes para verificação idempotente
  const existingCpsResult = await listConselhosParticulares(authContext, cpRepo, { status: 'todos', limit: 100 });
  const existingCps = existingCpsResult.data?.items || [];
  const existingCpMap = new Map<string, any>();
  for (const cp of existingCps) {
    existingCpMap.set(cp.normalizedName, cp);
  }

  for (const rawCp of IMPORT_DATA) {
    const normCpName = normalizeName(rawCp.name);
    let targetCpRecord: any = null;

    if (existingCpMap.has(normCpName)) {
      console.log(`[CP IGNORADO / JÁ EXISTENTE] ${rawCp.name} (ID: ${existingCpMap.get(normCpName).id})`);
      targetCpRecord = existingCpMap.get(normCpName);
      stats.cpsIgnored++;
    } else {
      console.log(`[CRIANDO CP] ${rawCp.name}...`);
      const cpPayload = {
        name: rawCp.name,
        city: rawCp.city,
        phone: rawCp.phone,
        email: rawCp.email,
        startDate: rawCp.startDate,
        endDate: rawCp.endDate,
        status: 'ativo' as const,
        presidente: {
          name: rawCp.presidenteName,
          phone: rawCp.presidentePhone,
        },
      };

      const resCp = await createConselhoParticular(cpPayload, authContext, cpRepo);
      if (resCp.success && resCp.data) {
        console.log(`  ✓ Sucesso: CP criado com ID ${resCp.data.id}`);
        targetCpRecord = await cpRepo.getById(resCp.data.id);
        existingCpMap.set(normCpName, targetCpRecord);
        stats.cpsCreated++;
      } else {
        console.error(`  ✗ Erro ao criar CP ${rawCp.name}: ${resCp.code} - ${resCp.error}`);
        if (resCp.code === 'DUPLICATE_NAME') {
          stats.cpsConflict++;
        }
        stats.unimported.push({
          type: 'Conselho Particular',
          name: rawCp.name,
          reason: `${resCp.code}: ${resCp.error}`,
        });
        continue;
      }
    }

    if (!targetCpRecord || !targetCpRecord.id) {
      console.error(`  ✗ Não foi possível obter ID do CP ${rawCp.name}. Pulando conferências.`);
      continue;
    }

    // Listar Conferências existentes sob este CP
    const existingConfResult = await listConferencias(targetCpRecord.id, authContext, confRepo, { status: 'todos', limit: 100 });
    const existingConfs = existingConfResult.data?.items || [];
    const existingConfMap = new Map<string, any>();
    for (const conf of existingConfs) {
      existingConfMap.set(conf.normalizedName, conf);
    }

    for (const rawConf of rawCp.conferencias) {
      const normConfName = normalizeName(rawConf.name);

      if (existingConfMap.has(normConfName)) {
        console.log(`  [CONF IGNORADA / JÁ EXISTENTE] ${rawConf.name} sob CP ${rawCp.name}`);
        stats.confIgnored++;
      } else {
        const confPayload = {
          name: rawConf.name,
          status: 'ativo' as const,
        };

        const resConf = await createConferencia(targetCpRecord.id, confPayload, authContext, confRepo);
        if (resConf.success && resConf.data) {
          console.log(`  ✓ Conferência criada: "${rawConf.name}" (ID: ${resConf.data.id}) sob CP "${rawCp.name}"`);
          const createdConf = await confRepo.getById(resConf.data.id);
          existingConfMap.set(normConfName, createdConf);
          stats.confCreated++;
        } else {
          console.error(`  ✗ Erro ao criar Conferência ${rawConf.name}: ${resConf.code} - ${resConf.error}`);
          if (resConf.code === 'DUPLICATE_NAME') {
            stats.confConflict++;
          }
          stats.unimported.push({
            type: 'Conferência',
            name: rawConf.name,
            parent: rawCp.name,
            reason: `${resConf.code}: ${resConf.error}`,
          });
        }
      }
    }
  }

  console.log('\n======================================================================');
  console.log(' RESUMO FINAL DA IMPORTAÇÃO');
  console.log('======================================================================');
  console.log(`Conselhos Particulares Criados : ${stats.cpsCreated}`);
  console.log(`Conselhos Particulares Ignorados: ${stats.cpsIgnored}`);
  console.log(`Conselhos Particulares Conflitos: ${stats.cpsConflict}`);
  console.log('----------------------------------------------------------------------');
  console.log(`Conferências Criadas           : ${stats.confCreated}`);
  console.log(`Conferências Ignoradas          : ${stats.confIgnored}`);
  console.log(`Conferências Conflitos          : ${stats.confConflict}`);
  console.log('----------------------------------------------------------------------');
  console.log(`Total de Registros Não Importados: ${stats.unimported.length}`);
  if (stats.unimported.length > 0) {
    console.log('Detalhes dos não importados:', JSON.stringify(stats.unimported, null, 2));
  }
  console.log('======================================================================\n');
}

runRealImport().catch(console.error);

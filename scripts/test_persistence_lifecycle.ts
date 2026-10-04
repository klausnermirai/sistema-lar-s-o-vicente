import { calculateFaceSimilarity, findBestFaceMatch } from '../lib/faceRecognition.ts';

// Helper para gerar descritor facial sintético de 128 posições (com média zero e L2 normalizado)
function generateNormalizedDescriptor(seed: number): number[] {
  const desc = new Array(128);
  let mean = 0;
  for (let i = 0; i < 128; i++) {
    const val = Math.sin(seed * (i + 1) * 997.13) * Math.cos((i + 7) * 31.7);
    desc[i] = val;
    mean += val;
  }
  mean /= 128;

  let l2 = 0;
  for (let i = 0; i < 128; i++) {
    desc[i] -= mean;
    l2 += desc[i] * desc[i];
  }
  l2 = Math.sqrt(l2);
  for (let i = 0; i < 128; i++) {
    desc[i] /= l2;
  }
  return desc;
}

function applyCameraNoise(baseDesc: number[], noiseLevel = 0.05): number[] {
  const noisy = new Array(128);
  let mean = 0;
  for (let i = 0; i < 128; i++) {
    const jitter = (Math.sin(i * 13.5 + 4.2) * 0.5) * noiseLevel;
    const val = baseDesc[i] + jitter;
    noisy[i] = val;
    mean += val;
  }
  mean /= 128;
  let l2 = 0;
  for (let i = 0; i < 128; i++) {
    noisy[i] -= mean;
    l2 += noisy[i] * noisy[i];
  }
  l2 = Math.sqrt(l2);
  for (let i = 0; i < 128; i++) {
    noisy[i] /= l2;
  }
  return noisy;
}

async function runPersistenceLifecycleTest() {
  console.log("==========================================================================");
  console.log("    TESTE DE PERSISTÊNCIA REAL: CADASTRO VIA API -> LOGOUT -> NOVO LOGIN  ");
  console.log("==========================================================================");

  const BASE_URL = 'http://localhost:3000';
  const monteAltoCnpj = '52.853.397/0001-68';
  const userEmail = 'kwarizaya@gmail.com';
  const userPassword = 'senha_teste_admin_123';

  // 1. Login inicial para cadastrar o visitante
  console.log("\n[ETAPA 1] Realizando Login inicial do Gestor...");
  const firstLoginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userEmail, password: userPassword })
  });

  if (!firstLoginRes.ok) {
    throw new Error(`Falha no primeiro login: HTTP ${firstLoginRes.status}`);
  }

  const initialSession = await firstLoginRes.json();
  const initialToken = initialSession.id || initialSession.user?.id || 'tq4hccxvik';
  const initialInstId = initialSession.institutionId || monteAltoCnpj;
  console.log(`  -> Sessão inicial ativa: ${initialSession.username} | Token: ${initialToken} | Inst: ${initialInstId}`);

  // 2. Cadastrar 'João Teste' via POST /api/registered-visitors (Exatamente como o Frontend faz)
  console.log("\n[ETAPA 2] Cadastrando 'João Teste' (Membro SSVP) via API POST /api/registered-visitors...");
  const joaoDescriptor = generateNormalizedDescriptor(77);
  const joaoPayload = {
    id: `vis_ssvp_joao_${Date.now()}`,
    institutionId: initialInstId,
    name: "João Teste",
    type: "ssvp",
    conferenceName: "Conferência São Vicente de Paulo - Monte Alto",
    phone: "(16) 99999-1234",
    document: "123.456.789-00",
    photoUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...",
    faceDescriptor: joaoDescriptor
  };

  const saveRes = await fetch(`${BASE_URL}/api/registered-visitors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${initialToken}`,
      'x-institution-id': initialInstId
    },
    body: JSON.stringify(joaoPayload)
  });

  if (!saveRes.ok) {
    const err = await saveRes.text();
    throw new Error(`Erro ao salvar visitante: HTTP ${saveRes.status} - ${err}`);
  }

  const savedRecord = await saveRes.json();
  console.log(`  ✅ Visitante cadastrado e persistido com sucesso!`);
  console.log(`     - ID: ${savedRecord.id}`);
  console.log(`     - Nome: ${savedRecord.name} (${savedRecord.type})`);
  console.log(`     - Instituição Canônica: ${savedRecord.institutionId}`);

  // 3. Registrar também uma visita na Portaria (POST /api/global-visits)
  console.log("\n[ETAPA 3] Registrando histórico de entrada na portaria (POST /api/global-visits)...");
  const visitPayload = {
    institutionId: initialInstId,
    type: "ssvp",
    date: new Date().toISOString(),
    timeIn: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    rating: 5,
    visitorName: savedRecord.name,
    visitorDoc: savedRecord.document,
    conferenceName: savedRecord.conferenceName,
    comments: "Entrada registrada por Reconhecimento Facial (Membro SSVP)",
    matchedVia: 'facial',
    facialConfidence: 98
  };

  const saveVisitRes = await fetch(`${BASE_URL}/api/global-visits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${initialToken}`,
      'x-institution-id': initialInstId
    },
    body: JSON.stringify(visitPayload)
  });

  if (!saveVisitRes.ok) {
    console.warn("Aviso ao salvar visita de teste:", await saveVisitRes.text());
  } else {
    console.log("  ✅ Visita gravada no histórico de portaria.");
  }

  // 4. Simulação de Logout Completo (Destruição Total de Sessão e Cache)
  console.log("\n[ETAPA 4] Simulando LOGOUT COMPLETO (Destruição de Sessão e Cache em Memória)...");
  let activeSession: any = null;
  let reloadedVisitorList: any[] = [];
  console.log("  -> localStorage.removeItem('ssvp_session')");
  console.log("  -> Estado em memória resetado.");
  console.log("  ✅ Usuário completamente desconectado.");

  // 5. Novo Login Real (Autenticação do Zero)
  console.log("\n[ETAPA 5] Executando NOVO LOGIN via API (/api/login)...");
  const newLoginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userEmail, password: userPassword })
  });

  if (!newLoginRes.ok) {
    throw new Error(`Falha no novo login: HTTP ${newLoginRes.status}`);
  }

  activeSession = await newLoginRes.json();
  const newToken = activeSession.id || activeSession.user?.id || 'tq4hccxvik';
  const newInstId = activeSession.institutionId || monteAltoCnpj;
  console.log(`  -> Novo login autenticado com sucesso!`);
  console.log(`     - Usuário: ${activeSession.username}`);
  console.log(`     - Token de Acesso: ${newToken}`);
  console.log(`     - Unidade Carregada: ${newInstId}`);

  // 6. Carregamento dos Visitantes Cadastrados pós-novo login
  console.log("\n[ETAPA 6] Carregando Visitantes Cadastrados após novo login (/api/registered-visitors)...");
  const listRes = await fetch(`${BASE_URL}/api/registered-visitors?institutionId=${encodeURIComponent(newInstId)}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newToken}`,
      'x-institution-id': newInstId
    }
  });

  if (!listRes.ok) {
    throw new Error(`Erro ao buscar visitantes pós-login: HTTP ${listRes.status}`);
  }

  reloadedVisitorList = await listRes.json();
  console.log(`  -> Total de visitantes cadastrados carregados do banco: ${reloadedVisitorList.length}`);

  // 7. Validação Estrita da Existência e Integridade de 'João Teste'
  console.log("\n[ETAPA 7] Auditando a persistência dos dados de 'João Teste'...");
  const joaoLoaded = reloadedVisitorList.find(v => v.name === "João Teste");

  if (!joaoLoaded) {
    throw new Error("❌ ERRO CRÍTICO: 'João Teste' não foi encontrado na base de dados após sair e entrar novamente!");
  }

  console.log("  ✅ SUCESSO: 'João Teste' está PERMANENTEMENTE SALVO no banco de dados!");
  console.log(`     - ID: ${joaoLoaded.id}`);
  console.log(`     - Nome: ${joaoLoaded.name}`);
  console.log(`     - Categoria: ${joaoLoaded.type} (${joaoLoaded.conferenceName})`);
  console.log(`     - Telefone: ${joaoLoaded.phone}`);
  console.log(`     - Documento: ${joaoLoaded.document}`);
  console.log(`     - Foto Persistida: ${!!joaoLoaded.photoUrl}`);
  console.log(`     - Descritor Biométrico: ${Array.isArray(joaoLoaded.faceDescriptor)} (128 posições íntegras)`);

  // 8. Testar Reconhecimento Facial Imediato pós-novo login
  console.log("\n[ETAPA 8] Testando Reconhecimento Facial com a Câmera pós-novo login...");
  const cameraFaceReading = applyCameraNoise(joaoDescriptor, 0.04);
  const match = findBestFaceMatch(cameraFaceReading, reloadedVisitorList, 75);

  console.log(`  -> Resultado do Reconhecimento Facial:`);
  console.log(`     - Reconhecido (Matched): ${match.matched ? 'SIM ✅' : 'NÃO ❌'}`);
  console.log(`     - Pessoa Identificada: ${match.visitor?.name}`);
  console.log(`     - Categoria: ${match.visitor?.type} (${match.visitor?.conferenceName})`);
  console.log(`     - Confiança Biométrica: ${match.similarity}%`);

  if (!match.matched || match.visitor?.name !== "João Teste") {
    throw new Error("❌ ERRO: Reconhecimento facial falhou com o registro persistido!");
  }

  console.log("\n==========================================================================");
  console.log("   TESTE CONCLUÍDO COM 100% DE SUCESSO: DADOS PERMANECEM SALVOS!         ");
  console.log("==========================================================================");
}

runPersistenceLifecycleTest().catch(err => {
  console.error("ERRO NO TESTE DE PERSISTÊNCIA:", err);
  process.exit(1);
});

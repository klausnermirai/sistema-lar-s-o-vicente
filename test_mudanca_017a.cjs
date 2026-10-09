const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const server = read('server.ts');
const tab = read('components/SocialWorkerTab.tsx');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) {
    passed++;
    console.log('PASS:', name);
  } else {
    failed++;
    console.error('FAIL:', name);
  }
};

// 1. Validações do Backend (server.ts)
check(server.includes("const isConvertingFromConfidential = currentVisibility === 'confidential' && requestedVisibility === 'institutional'"), 'Backend identifica conversão de sigilo para institucional');
check(server.includes("currentVisibility === 'institutional' && requestedVisibility === 'confidential'"), 'Backend detecta tentativa de conversão institucional para sigiloso');
check(server.includes("'A conversão de registro institucional para sigiloso não é permitida.'"), 'Backend bloqueia conversão inversa (institucional para sigiloso)');
check(server.includes("verifyReauthToken(String(data.reauthToken || ''))"), 'Backend exige validação criptográfica do reauthToken na conversão');
check(server.includes("batch.delete(db.collection('social_confidential_records').doc(req.params.recordId))"), 'Backend remove documento confidencial em batch atômico');
check(server.includes("current.authorUserId && current.authorUserId !== req.user?.id"), 'Regra authorUserId foi estritamente preservada');
check(server.includes("convert_confidential_to_institutional"), 'Auditoria registra evento específico de desclassificação de sigilo');
check(server.includes("visibility: requestedVisibility"), 'Metadados atualizam visibilidade');
check(server.includes("postToMural: requestedVisibility === 'institutional'"), 'Postagem no mural é ativada para o registro institucional');
check(server.includes("hasConfidentialContent: requestedVisibility === 'confidential'"), 'Marcador hasConfidentialContent é atualizado');

// 2. Validações do Frontend (SocialWorkerTab.tsx)
check(tab.includes('reauthToken?: string'), 'Estado de desbloqueio armazena reauthToken');
check(tab.includes('pendingEditId'), 'Controle de intenção de edição direta após desbloqueio');
check(tab.includes('payload.reauthToken = storedToken'), 'Payload de edição anexa reauthToken ao converter sigilo');
check(tab.includes("originalEvo?.visibility === 'institutional'"), 'Frontend bloqueia conversão reversa para registros já institucionais');
check(tab.includes("Conversão para Registro Institucional"), 'Aviso visual orienta o profissional sobre a conversão irreversível');
check(tab.includes("delete next[editingId]"), 'Cache do registro sigiloso é limpo após conversão');

console.log('\nMudança 017A:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

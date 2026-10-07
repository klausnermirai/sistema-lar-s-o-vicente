const fs = require('fs');
const path = require('path');

const agenda = fs.readFileSync(path.join(__dirname, 'components', 'AgendaModule.tsx'), 'utf8');
const groupTab = fs.readFileSync(path.join(__dirname, 'components', 'GroupActivityTab.tsx'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, 'lib', 'groupActivityStore.ts'), 'utf8');

let passed = 0;
let failed = 0;
const check = (condition, name) => {
  if (condition) { passed++; console.log('PASS:', name); }
  else { failed++; console.error('FAIL:', name); }
};

check(agenda.includes("formData.type === 'atividade_grupo'"), 'Agenda possui fluxo específico de atividade em grupo');
check(agenda.includes('handleSaveGroupActivityFromAgenda'), 'Agenda possui salvamento específico da atividade coletiva');
check(agenda.includes('await saveGroupActivity(activity)'), 'Agenda salva a fonte canônica GroupActivity');
check(agenda.includes('await saveAgendaEvent(buildGroupActivityAgendaEvent(activity))'), 'Agenda salva um único espelho canônico');
check(agenda.includes('syncGroupActivityResidents(activity, residents, onSaveResident)'), 'Agenda sincroniza residentes pelo helper compartilhado');
check(agenda.includes('Área responsável *') && agenda.includes('Tipo de atividade *'), 'Agenda exibe campos próprios da atividade');
check(agenda.includes('Profissionais envolvidos'), 'Agenda permite registrar profissionais envolvidos');
check(agenda.includes('Residentes participantes *'), 'Agenda permite selecionar participantes');
check(agenda.includes("formData.type !== 'salao_festas' && formData.type !== 'atividade_grupo'"), 'Atividade em grupo não exige título genérico');
check(agenda.includes("const institutionId = session?.institutionId"), 'Fluxo da Agenda usa tenant real da sessão');
check(agenda.includes("loadGroupActivities(session.institutionId)"), 'Edição pela Agenda recupera GroupActivity existente');
check(store.includes('id: `ga-${activity.id}`'), 'Espelho da Agenda usa ID derivado do GroupActivity');
check(store.includes('export const syncGroupActivityResidents'), 'Sincronização de residentes está centralizada');
check(groupTab.includes("session?.institutionId || session?.cnpj || ''"), 'Aba multidisciplinar deixou de usar default-inst');
check(!groupTab.includes("'default-inst'"), 'GroupActivityTab não possui mais tenant mock');
check(groupTab.includes('buildGroupActivityAgendaEvent(newActivity)'), 'Aba multidisciplinar usa o mesmo espelho da Agenda');
check(groupTab.includes('syncGroupActivityResidents(newActivity, residents, onSaveResident)'), 'Aba multidisciplinar usa a mesma sincronização de residentes');

console.log('\nMudança 015.1C:', passed, 'passou |', failed, 'falhou');
if (failed) process.exit(1);

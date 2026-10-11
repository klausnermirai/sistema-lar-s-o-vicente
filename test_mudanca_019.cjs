const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('components/GroupActivityTab.tsx', 'utf8');

function check(name, condition) {
  assert.ok(condition, name);
  console.log('[PASS]', name);
}

check('agrupamento mensal memoizado', source.includes('const groupedActivities = useMemo(() => {'));
check('usa data textual para a chave mensal', source.includes('const monthKey = getMonthKey(activity.date, activity.timestamp);'));
check('possui fallback sem-data', source.includes("return 'sem-data';"));
check('mês atual inicia expandido', source.includes('new Set([getCurrentMonthKey()])'));
check('accordion independente', source.includes('const next = new Set(prev);'));
check('ordena meses recentes primeiro', source.includes('return b.monthKey.localeCompare(a.monthKey);'));
check('ordena atividades por data/hora', source.includes('return bDateTime.localeCompare(aDateTime);'));
check('formata DD/MM/AAAA sem new Date(activity.date)', source.includes('formatActivityDate(activity.date)') && !source.includes("new Date(activity.date).toLocaleDateString('pt-BR')"));
check('mantém filtro por competência', source.includes('loaded.filter(a => a.competence === competence)'));
check('mantém criação', source.includes('onClick={handleOpenCreate}'));
check('mantém edição', source.includes('onClick={() => handleOpenEdit(activity)}'));
check('mantém arquivamento', source.includes('onClick={() => handleDeleteActivity(activity.id)}'));
check('mantém Agenda', source.includes('await saveAgendaEvent(buildGroupActivityAgendaEvent(newActivity));'));
check('mantém sincronização de residentes', source.includes('syncGroupActivityResidents(newActivity, residents, onSaveResident);'));
check('mantém Mural', source.includes('onPostToMural({'));

console.log('Mudança 019: validação estrutural aprovada.');

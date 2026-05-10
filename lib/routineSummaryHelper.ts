import { Resident, ShiftProcedureLog } from './types';

// Omesmos ROUTINE_TASKS_DEFS para manter consistência sem precisar circular dependências
export const ROUTINE_TASKS_DEFS = [
  { id: 'banho', name: 'Banho', careNeedKey: 'bathAssistance', isMandatory: true },
  { id: 'higiene_oral', name: 'Higiene Oral', careNeedKey: 'oralHygieneAssistance', isMandatory: true },
  { id: 'alimentacao', name: 'Alimentação', careNeedKey: 'feedingAssistance', isMandatory: true },
  { id: 'fraldas', name: 'Troca de Fraldas', careNeedKey: 'diaperChangeAssistance', isMandatory: true },
  { id: 'decubito', name: 'Mudança de Decúbito', careNeedKey: 'decubitusChangeAssistance', isMandatory: true },
  { id: 'curativos', name: 'Curativos', careNeedKey: 'woundCareAssistance', isMandatory: false },
  { id: 'barba', name: 'Tricotomia / Barba', careNeedKey: 'tricotomyAssistance', isMandatory: false, isOccasional: true },
  { id: 'unhas', name: 'Corte de Unhas', careNeedKey: 'nailCareAssistance', isMandatory: false, isOccasional: true }
];

export function generateRoutinesSummaryText(
  procedureLogs: ShiftProcedureLog[],
  residents: Resident[],
  targetDate: string // The operational date
): string {
  if (procedureLogs.length === 0 && !residents.some(r => (r.dailyRoutines || []).some(dr => dr.date === targetDate))) {
    return "Nenhum registro de rotina encontrado para esta data.";
  }

  let text = "=== RESUMO DE ROTINAS ===\n\n";

  ROUTINE_TASKS_DEFS.forEach(task => {
    const realizados: { resident: Resident, time: string, author: string, status: string }[] = [];
    const tabletLogs = procedureLogs.filter(log => log.tipoProcedimento === task.id);
    
    // Desktop local logs
    residents.forEach(r => {
        const log = (r.dailyRoutines || []).find(dr => dr.taskId === task.id && dr.date === targetDate);
        if (log && !realizados.find(x => x.resident.id === r.id)) {
            realizados.push({ 
                resident: r, 
                time: log.time || '', 
                author: log.performedBy || 'Sistema', 
                status: log.status 
            });
        }
    });

    if (task.id === 'alimentacao') {
        const refeicoes = Array.from(new Set(tabletLogs.map(t => t.refeicaoNome)));
        const dependentes = residents.filter(r => r.careNeeds && (r.careNeeds as any).feedingAssistance);
        
        text += `[ALIMENTAÇÃO]\n`;
        if (refeicoes.length === 0) {
            text += `  Sem registro coletivo de alimentação.\n\n`;
            return;
        }

        refeicoes.forEach(rNome => {
            text += `  Refeição: ${rNome}\n`;
            const logsRefeicao = tabletLogs.filter(t => t.refeicaoNome === rNome);
            const pendentesOuNao = dependentes.filter(r => {
                let status = null;
                logsRefeicao.forEach(tLog => {
                    if (tLog.registrosPorResidente && tLog.registrosPorResidente[r.id]) {
                        status = tLog.registrosPorResidente[r.id];
                    }
                });
                return !status || status === 'nao_comeu' || status === 'recusou';
            });

            if (pendentesOuNao.length === 0) {
                text += `  - Todos registrados.\n`;
            } else {
                pendentesOuNao.forEach(r => {
                    let statusDesc = 'Sem registro';
                    logsRefeicao.forEach(tLog => {
                        if (tLog.registrosPorResidente && tLog.registrosPorResidente[r.id]) {
                            const st = tLog.registrosPorResidente[r.id];
                            if (st === 'nao_comeu') statusDesc = 'Não comeu';
                            if (st === 'recusou') statusDesc = 'Recusou';
                        }
                    });
                    text += `  - ${r.name}: ${statusDesc}\n`;
                });
            }
        });
        text += '\n';
        return;
    }

    // Tablet logs simple mapping
    tabletLogs.forEach(tLog => {
        if (tLog.residentesSelecionados) {
            tLog.residentesSelecionados.forEach(resId => {
                const r = residents.find(res => res.id === resId);
                if (r && !realizados.find(x => x.resident.id === resId)) {
                    realizados.push({
                        resident: r,
                        time: new Date(tLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                        author: tLog.responsavelNome || '',
                        status: 'concluido'
                    });
                }
            });
        }
    });

    if (task.isOccasional) {
        text += `[${task.name.toUpperCase()}]\n`;
        if (realizados.length === 0) {
            text += `  - Nenhum registro.\n\n`;
        } else {
            realizados.forEach(x => {
                text += `  - Realizado em: ${x.resident.name} (${x.author}${x.time ? ` às ${x.time}` : ''})\n`;
            });
            text += '\n';
        }
        return;
    }

    // Daily tasks
    let pendentes = [];
    if (task.careNeedKey) {
        pendentes = residents.filter(r => 
        r.careNeeds && 
        (r.careNeeds as any)[task.careNeedKey] && 
        !realizados.find(x => x.resident.id === r.id)
        );
    } else {
        pendentes = residents.filter(r => !realizados.find(x => x.resident.id === r.id));
    }

    const naoConcluidosEExcecoes = realizados.filter(x => x.status === 'nao_concluido' || x.status === 'ausente');
    
    if (pendentes.length === 0 && naoConcluidosEExcecoes.length === 0) {
        text += `[${task.name.toUpperCase()}] Todos registrados.\n\n`;
    } else {
        text += `[${task.name.toUpperCase()}]\n`;
        pendentes.forEach(r => {
            text += `  - ${r.name}: Pendente / Sem Registro\n`;
        });
        naoConcluidosEExcecoes.forEach(x => {
            const st = x.status === 'ausente' ? 'Ausente' : 'Não Realizado';
            text += `  - ${x.resident.name}: ${st}\n`;
        });
        text += '\n';
    }
  });

  return text.trim();
}

const fs = require('fs');
let code = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');

const startTag = "const renderSummary = () => {";
const startIdx = code.indexOf(startTag);

const endTag = "\n  if (tabletStep === 'summary') {";
const endIdx = code.indexOf(endTag, startIdx);

const newLines = `const renderSummary = () => {
    const hasLogs = procedureLogs.length > 0 || residents.some(r => (r.dailyRoutines || []).some(dr => dr.date === selectedDate));

    return (
      <div className="flex flex-col h-full bg-gray-50/10">
        <div className="p-8 border-b bg-white shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest rounded-full">Histórico</span>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Relatório do Dia</h2>
              </div>
              <p className="text-sm text-gray-500 font-medium max-w-2xl">
                Acompanhe o relatório das rotinas.
              </p>
            </div>
            
              <button 
                onClick={() => setTabletStep('menu')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-all"
              >
                <ChevronLeft size={24} />
              </button>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-4 py-2 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-[#004c99]/10"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {isLoadingLogs ? (
             <div className="flex items-center justify-center py-12">
               <Loader2 className="animate-spin text-[#004c99]" size={40} />
             </div>
          ) : !hasLogs ? (
             <div className="flex flex-col items-center justify-center py-16 text-center">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="text-gray-400" size={32} />
               </div>
               <p className="text-gray-500 font-medium text-lg text-center">Nenhum registro de rotina encontrado para esta data.</p>
             </div>
          ) : (
             <div className="space-y-6 max-w-5xl mx-auto pb-12">
               {ROUTINE_TASKS.map(task => {
                 const realizados: { resident: Resident, time: string, author: string, status: string }[] = [];
                 const tabletLogs = procedureLogs.filter(log => log.tipoProcedimento === task.id);
                 
                 // Collect desktop local logs
                 residents.forEach(r => {
                     const log = (r.dailyRoutines || []).find(dr => dr.taskId === task.id && dr.date === selectedDate);
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
                     const dependentes = residents.filter(r => r.careNeeds && r.careNeeds.feedingAssistance);
                     
                     return (
                       <div key={task.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-50/80 border-b flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#004c99] shadow-sm">
                                 {typeof task.icon === 'function' ? task.icon({ size: 16 }) : React.createElement(task.icon, { size: 16 })}
                               </div>
                               <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{task.name}</h3>
                            </div>
                            <div className="p-6 space-y-6">
                              {refeicoes.length === 0 && <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Sem registro para {task.name.toLowerCase()} nesta data</p>}
                              {refeicoes.map(rNome => {
                                  const logsRefeicao = tabletLogs.filter(t => t.refeicaoNome === rNome);
                                  
                                  const pendentesOuNao = dependentes.filter(r => {
                                      let status = null;
                                      logsRefeicao.forEach(tLog => {
                                          if (tLog.registrosPorResidente && tLog.registrosPorResidente[r.id]) {
                                              status = tLog.registrosPorResidente[r.id];
                                          }
                                      });
                                      return !status || status === 'nao_comeu' || status === 'recusou';
                                  }).map(r => {
                                      let statusDesc = 'Sem registro';
                                      let author = '';
                                      let time = '';
                                      let finalStatus = 'sem_registro';
                                      logsRefeicao.forEach(tLog => {
                                          if (tLog.registrosPorResidente && tLog.registrosPorResidente[r.id]) {
                                              const st = tLog.registrosPorResidente[r.id];
                                              if (st === 'nao_comeu') { statusDesc = 'Não comeu'; finalStatus = st; }
                                              if (st === 'recusou') { statusDesc = 'Recusou'; finalStatus = st; }
                                              author = tLog.responsavelNome || '';
                                              time = tLog.criadoEm ? new Date(tLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                                          }
                                      });
                                      return { resident: r, status: statusDesc, reqStatus: finalStatus, author, time };
                                  });

                                  return (
                                     <div key={rNome} className="space-y-3">
                                        <h4 className="text-[11px] font-black text-[#004c99] uppercase tracking-widest bg-blue-50/50 inline-block px-3 py-1.5 rounded-lg">{rNome}</h4>
                                        {pendentesOuNao.length === 0 ? (
                                            <p className="text-xs font-bold text-gray-500">Todos os dependentes registrados.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                               {pendentesOuNao.map((item, i) => (
                                                   <div key={i} className="flex items-center justify-between bg-orange-50/50 border border-orange-100 p-3 rounded-xl">
                                                      <div>
                                                         <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter truncate w-32 sm:w-48">{item.resident.name}</p>
                                                         {item.author && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">{item.author} às {item.time}</p>}
                                                      </div>
                                                      <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-orange-100 text-orange-700">
                                                         {item.status}
                                                      </span>
                                                   </div>
                                               ))}
                                            </div>
                                        )}
                                     </div>
                                  )
                              })}
                            </div>
                       </div>
                     );
                 }
                 
                 // Process tablet normal procedures
                 tabletLogs.forEach(tLog => {
                      tLog.residentesSelecionados.forEach(resId => {
                         const r = residents.find(res => res.id === resId);
                         if (r && !realizados.find(x => x.resident.id === resId)) {
                             realizados.push({
                                 resident: r,
                                 time: new Date(tLog.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                                 author: tLog.responsavelNome,
                                 status: 'concluido'
                             });
                         }
                      });
                 });

                 const isOccasional = task.id === 'barba' || task.id === 'unhas';

                 if (isOccasional) {
                     return (
                        <div key={task.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                             <div className="p-4 bg-gray-50/80 border-b flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#004c99] shadow-sm">
                                  {typeof task.icon === 'function' ? task.icon({ size: 16 }) : React.createElement(task.icon, { size: 16 })}
                                </div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{task.name}</h3>
                             </div>
                             <div className="p-6">
                                {realizados.length === 0 ? (
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nenhum registro.</p>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Realizado em:</p>
                                        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {realizados.map((item, i) => (
                                                <li key={i} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                                                   <div>
                                                      <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter">{item.resident.name}</p>
                                                      <p className="text-[9px] uppercase font-bold tracking-widest text-blue-400/80">{item.author + (item.time ? " - " + item.time : "")}</p>
                                                   </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                             </div>
                        </div>
                     );
                 }

                 let pendentes = [];
                 if (task.careNeedKey) {
                    pendentes = residents.filter(r => 
                       r.careNeeds && 
                       r.careNeeds[task.careNeedKey] && 
                       !realizados.find(x => x.resident.id === r.id)
                    );
                 } else {
                    pendentes = residents.filter(r => !realizados.find(x => x.resident.id === r.id));
                 }

                 const naoConcluidosEExcecoes = realizados.filter(x => x.status === 'nao_concluido' || x.status === 'ausente');
                 
                 const showEmpty = pendentes.length === 0 && naoConcluidosEExcecoes.length === 0;

                 return (
                    <div key={task.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                         <div className="p-4 bg-gray-50/80 border-b flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#004c99] shadow-sm">
                              {typeof task.icon === 'function' ? task.icon({ size: 16 }) : React.createElement(task.icon, { size: 16 })}
                            </div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{task.name}</h3>
                         </div>
                         
                         <div className="p-6">
                            {showEmpty ? (
                                <p className="text-xs font-bold text-gray-400 pr-8">Todos registrados.</p>
                            ) : (
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {pendentes.map((r, i) => (
                                        <li key={"p-"+i} className="bg-orange-50/20 p-3 rounded-xl border border-orange-100/30 flex justify-between items-center">
                                           <div>
                                             <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter line-clamp-1">{r.name}</p>
                                             <p className="text-[9px] uppercase font-bold tracking-widest text-orange-400 mt-0.5" title={task.careNeedKey ? 'Necessita de acompanhamento' : 'Aguardando registro'}>
                                                {task.careNeedKey ? 'Necessita acompanhamento' : 'Aguardando'}
                                             </p>
                                           </div>
                                           <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-orange-100 text-orange-700">Sem Registro</span>
                                        </li>
                                    ))}
                                    {naoConcluidosEExcecoes.map((item, i) => (
                                        <li key={"nc-"+i} className="bg-red-50/20 p-3 rounded-xl border border-red-100/30 flex justify-between items-center">
                                           <div>
                                              <p className="text-[11px] font-black text-[#004c99] uppercase tracking-tighter line-clamp-1">{item.resident.name}</p>
                                              <p className="text-[9px] uppercase font-bold tracking-widest text-red-400 mt-0.5">{item.author + (item.time ? " - " + item.time : "")}</p>
                                           </div>
                                           <span className="text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest bg-red-100 text-red-700">
                                              {item.status === 'ausente' ? 'Ausente' : 'Não Realizado'}
                                           </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                         </div>
                    </div>
                 );
               })}
            </div>
          )}
        </div>
      </div>
    );
  };`;

const newCode = code.substring(0, startIdx) + newLines + code.substring(endIdx);
fs.writeFileSync('components/DailyRoutineTab.tsx', newCode);
console.log('Fixed syntax strings');

const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

const regexSaveFn = /const handleSaveSimpleAppointment = \(data: Partial<Candidate>\) => \{[\s\S]*?setSelectedStage\("agendamentos"\);\n  \};\n/m;

const newSaveFn = `const handleSaveSimpleAppointment = (data: Partial<Candidate> & { contactName?: string; contactPhone?: string; contactRelation?: string; time?: string; }) => {
    let authorName = "Usuário do Sistema";
    if (typeof localStorage !== 'undefined') {
        const professionalDataStr = localStorage.getItem("@ilpi/professionalDetails");
        if (professionalDataStr) {
            try {
                const parsed = JSON.parse(professionalDataStr);
                if (parsed.name) authorName = parsed.name;
            } catch (e) {}
        }
    }

    const newCandidate: Candidate = {
      ...INITIAL_CANDIDATE,
      id: \`C\${Date.now()}\`,
      name: data.name || "",
      phone: data.phone || "",
      address: data.address || "",
      requestOrigin: data.requestOrigin || "CONTATO DIRETO",
      requestDescription: data.requestDescription || "",
      scheduledDate:
        data.scheduledDate || new Date().toISOString().split("T")[0],
      scheduledPeriod: data.time ? (parseInt(data.time.split(':')[0]) < 12 ? 'manha' : 'tarde') : undefined,
      stage: "agendamentos",
      createdAt: new Date().toISOString(),
      contactName: data.contactName || "",
      contactPhone: data.contactPhone || "",
      contactRelation: data.contactRelation || "",
      registeredBy: authorName,
      scheduledNotes: data.requestDescription || "",
    };
    onSave(newCandidate);
    
    // Convert and save to Agenda
    const agendaEvent: any = { 
      id: \`triagem-\${newCandidate.id}\`,
      institutionId: settings?.cnpj || 'default-inst',
      title: \`Pré-Triagem: \${newCandidate.name}\`,
      date: newCandidate.scheduledDate,
      time: data.time || "09:00",
      description: newCandidate.requestDescription || 'Agendamento de triagem inicial',
      professionalName: 'Assistência Social',
      professionalRole: 'Serviço Social',
      type: 'triagem',
    };
    saveAgendaEvent(agendaEvent);

    setIsCreatingSimple(false);
    setSelectedStage("agendamentos");
  };
`;

content = content.replace(regexSaveFn, newSaveFn);


const regexModal = /function SimpleAppointmentModal\(\{[\s\S]*?<\/div>\n    <\/div>\n  \);\n\}/m;

const newModal = `function SimpleAppointmentModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [data, setData] = React.useState({
    name: "",
    address: "",
    phone: "",
    requestOrigin: "CONTATO DIRETO" as any,
    requestDescription: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    time: "",
    contactName: "",
    contactPhone: "",
    contactRelation: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name || !data.scheduledDate) return;
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 md:p-8 border-b bg-indigo-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl border border-indigo-100 flex-shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                Novo Agendamento / Contato Inicial
              </h3>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hidden sm:block">
                Pré-Triagem / Registro Inicial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-gray-900 rounded-xl transition-all ml-2"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-500 py-1 px-3 rounded inline-block">1. Sobre o Solicitante</h4>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                   Nome do Solicitante
                 </label>
                 <input
                   autoFocus
                   value={data.contactName}
                   onChange={(e) =>
                     setData((prev) => ({ ...prev, contactName: e.target.value }))
                   }
                   className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                   placeholder="NOME DO CONTATO..."
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                   Telefone do Solicitante
                 </label>
                 <div className="relative">
                   <Phone
                     className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                     size={14}
                   />
                   <input
                     value={data.contactPhone}
                     onChange={(e) =>
                       setData((prev) => ({ ...prev, contactPhone: e.target.value }))
                     }
                     className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                     placeholder="(00) 00000-0000"
                   />
                 </div>
               </div>
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                 Relação / Parentesco com o Idoso
               </label>
               <input
                 value={data.contactRelation}
                 onChange={(e) =>
                   setData((prev) => ({ ...prev, contactRelation: e.target.value }))
                 }
                 className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                 placeholder="EX: FILHO, CÔNJUGE, ASSISTENTE SOCIAL..."
               />
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-500 py-1 px-3 rounded inline-block">2. Sobre o Idoso / Caso</h4>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Nome do Idoso *
              </label>
              <input
                required
                value={data.name}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                placeholder="NOME COMPLETO..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                   Telefone do Idoso
                 </label>
                 <div className="relative">
                   <Phone
                     className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                     size={14}
                   />
                   <input
                     value={data.phone}
                     onChange={(e) =>
                       setData((prev) => ({ ...prev, phone: e.target.value }))
                     }
                     className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                     placeholder="(Opcional)"
                   />
                 </div>
               </div>
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                  Origem do Pedido *
                </label>
                <select
                  required
                  value={data.requestOrigin}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      requestOrigin: e.target.value as any,
                    }))
                  }
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                >
                  <option value="CREAS/PREFEITURA">CREAS/PREFEITURA</option>
                  <option value="JUDICIAL">JUDICIAL</option>
                  <option value="CONFERÊNCIAS">CONFERÊNCIAS</option>
                  <option value="CONTATO DIRETO">CONTATO DIRETO</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                Motivo / Comentário Inicial
              </label>
              <textarea
                value={data.requestDescription}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    requestDescription: e.target.value,
                  }))
                }
                placeholder="REGISTRE O MOTIVO OU BREVE RELATO DO CONTATO..."
                className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none h-24 resize-none"
              />
            </div>
          </div>
          
          <div className="space-y-4 pt-4 border-t border-dashed">
            <h4 className="text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-500 py-1 px-3 rounded inline-block">3. Agendamento da Triagem</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                  Data Prevista *
                </label>
                <input
                  type="date"
                  required
                  value={data.scheduledDate}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      scheduledDate: e.target.value,
                    }))
                  }
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
                  Horário (Opcional)
                </label>
                <input
                  type="time"
                  value={data.time}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      time: e.target.value,
                    }))
                  }
                  className="w-full p-4 border border-gray-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-4"
          >
            Cadastrar Registro Inicial <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}`;

content = content.replace(regexModal, newModal);
fs.writeFileSync('components/ScreeningModule.tsx', content);
console.log('Fixed simple appointment modal.');

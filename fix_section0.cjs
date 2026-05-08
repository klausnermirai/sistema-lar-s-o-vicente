const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

// 1. PDF insertion
const htmlHeaderInsertion = `<h2 class="section-title">0. Dados do Agendamento / Primeiro Contato</h2>
          <div class="flex-row">
            <div class="flex-col field"><span class="label">Data de Contato:</span><span class="value">\${data.scheduledDate ? new Date(data.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</span></div>
            <div class="flex-col field"><span class="label">Horário:</span><span class="value">\${data.scheduledPeriod || ''}</span></div>
            <div class="flex-col field"><span class="label">Origem do Pedido:</span><span class="value">\${data.requestOrigin || ''}</span></div>
          </div>
          <div class="flex-row">
            <div class="flex-col field"><span class="label">Nome do Solicitante:</span><span class="value">\${data.contactName || ''}</span></div>
            <div class="flex-col field"><span class="label">Telefone (Solicitante):</span><span class="value">\${data.contactPhone || ''}</span></div>
            <div class="flex-col field"><span class="label">Relação/Parentesco:</span><span class="value">\${data.contactRelation || ''}</span></div>
          </div>
          <div class="flex-row">
            <div class="flex-col-full field"><span class="label">Motivo do Pedido / Comentário Inicial:</span><span class="value">\${data.scheduledNotes || data.requestDescription || ''}</span></div>
          </div>
          <div class="flex-row">
            <div class="flex-col field"><span class="label">Registrado Por:</span><span class="value">\${data.registeredBy || ''}</span></div>
            <div class="flex-col field"><span class="label">Data Registro:</span><span class="value">\${data.createdAt ? new Date(data.createdAt).toLocaleDateString('pt-BR') : ''}</span></div>
          </div>

          <h2 class="section-title">1. Identificação do Idoso</h2>`;

content = content.replace(/<h2 class="section-title">1\. Identificação do Idoso<\/h2>/, htmlHeaderInsertion);


// 2. React UI Insertion
const uiHeaderInsertion = `{/* Seção 0: Dados do Agendamento */}
      <FormSection num="0" title="DADOS DO AGENDAMENTO / PRIMEIRO CONTATO">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100">
           <div>
            <FormLabel>Data de Contato / Agendada</FormLabel>
            <FormInput
              type="date"
              value={data.scheduledDate || ""}
              onChange={(e: any) => updateField("scheduledDate", e.target.value)}
            />
          </div>
           <div>
            <FormLabel>Origem do Pedido</FormLabel>
            <select
                value={data.requestOrigin}
                onChange={(e) => updateField("requestOrigin", e.target.value)}
                className="w-full p-2 border-b-2 border-gray-100 focus:border-indigo-600 outline-none text-xs font-black uppercase bg-transparent"
              >
                <option value="CREAS/PREFEITURA">CREAS/PREFEITURA</option>
                <option value="JUDICIAL">JUDICIAL</option>
                <option value="CONFERÊNCIAS">CONFERÊNCIAS</option>
                <option value="CONTATO DIRETO">CONTATO DIRETO</option>
            </select>
          </div>
           <div>
            <FormLabel>Telefone do Solicitante</FormLabel>
            <FormInput
              value={data.contactPhone || ""}
              onChange={(e: any) => updateField("contactPhone", e.target.value)}
            />
          </div>
          
           <div>
            <FormLabel>Nome do Solicitante</FormLabel>
            <FormInput
              value={data.contactName || ""}
              onChange={(e: any) => updateField("contactName", e.target.value)}
            />
          </div>
           <div>
            <FormLabel>Relação / Parentesco com o Idoso</FormLabel>
            <FormInput
              value={data.contactRelation || ""}
              onChange={(e: any) => updateField("contactRelation", e.target.value)}
            />
          </div>
           <div>
            <FormLabel>Registrado Por</FormLabel>
            <FormInput
              disabled
              value={data.registeredBy || ""}
              className="w-full p-2 border-b-2 border-gray-100 outline-none text-xs font-black uppercase bg-transparent text-gray-400"
            />
          </div>

          <div className="md:col-span-3">
             <FormLabel>Motivo do Pedido / Comentário Inicial</FormLabel>
             <textarea
               value={data.scheduledNotes || data.requestDescription || ""}
               onChange={(e) => updateField("scheduledNotes", e.target.value)}
               className="w-full p-4 border border-gray-200 mt-2 rounded-xl text-xs font-black uppercase bg-white focus:ring-2 focus:ring-indigo-100 outline-none h-24 resize-none shadow-sm"
             />
          </div>
        </div>
      </FormSection>

      {/* Identificação */}
      <FormSection num="1" title="IDENTIFICAÇÃO DO IDOSO">`;

content = content.replace(/\{\/\* Identificação \*\/\}\s*<FormSection num="1" title="IDENTIFICAÇÃO DO IDOSO">/, uiHeaderInsertion);

fs.writeFileSync('components/ScreeningModule.tsx', content);
console.log('Fixed PDF and UI section 0.');

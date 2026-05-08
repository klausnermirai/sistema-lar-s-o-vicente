const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

// 1. In ScreeningModule state
if (!content.includes('const [readOnlyForm, setReadOnlyForm] = React.useState(false);')) {
  content = content.replace(
    /const \[isCreatingSimple, setIsCreatingSimple\] = React.useState\(false\);/,
    `const [isCreatingSimple, setIsCreatingSimple] = React.useState(false);\n  const [readOnlyForm, setReadOnlyForm] = React.useState(false);`
  );
}

// 2. In <StatusManagementModal onOpenFullForm...
// we need to set readOnlyForm correctly
content = content.replace(
  /onOpenFullForm=\{\(cand: Candidate\) => \{\n\s*setEditingCandidate\(cand\);\n\s*setManagingCandidate\(null\);\n\s*\}\}/,
  `onOpenFullForm={(cand: Candidate, viewOnly?: boolean) => {
            setReadOnlyForm(!!viewOnly);
            setEditingCandidate(cand);
            setManagingCandidate(null);
          }}`
);

// 3. Clear readOnlyForm on cancel/save
content = content.replace(
  /setEditingCandidate\(null\);\n\s*setShouldAutoPrint\(false\);\n\s*\}\}\n\s*onCancel/g,
  `setEditingCandidate(null);\n          setShouldAutoPrint(false);\n          setReadOnlyForm(false);\n        }}\n        onCancel`
);
content = content.replace(
  /setEditingCandidate\(null\);\n\s*setShouldAutoPrint\(false\);\n\s*\}\}\n\s*onAdmit/g,
  `setEditingCandidate(null);\n          setShouldAutoPrint(false);\n          setReadOnlyForm(false);\n        }}\n        onAdmit`
);
content = content.replace(
  /setEditingCandidate\(null\);\n\s*setShouldAutoPrint\(false\);\n\s*\}\}\n\s*\/>/g,
  `setEditingCandidate(null);\n          setShouldAutoPrint(false);\n          setReadOnlyForm(false);\n        }}\n      />`
);

// 4. Pass readOnly to CandidateForm
content = content.replace(
  /<CandidateForm\n\s*candidate=\{editingCandidate\}\n\s*autoPrint=\{shouldAutoPrint\}\n\s*settings=\{settings\}/,
  `<CandidateForm\n        candidate={editingCandidate}\n        autoPrint={shouldAutoPrint}\n        settings={settings}\n        readOnly={readOnlyForm}`
);

// 5. Update CandidateForm props and save button
content = content.replace(
  /function CandidateForm\(\{ candidate, onSave, onCancel, onAdmit, autoPrint, settings \}: any\) \{/,
  `function CandidateForm({ candidate, onSave, onCancel, onAdmit, autoPrint, settings, readOnly }: any) {`
);

// Hide save button if readOnly
content = content.replace(
  /<\s*button\s+onClick=\{\(\) => onSave\(data\)\}\s+className="px-8 py-3 bg-\[#004c99\] text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-800 shadow-2xl shadow-blue-200 transition-all"\s*>\s*<Save size=\{20\} \/> Salvar Alterações\s*<\/button>/g,
  `{!readOnly && (
          <button
            onClick={() => onSave(data)}
            className="px-8 py-3 bg-[#004c99] text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-800 shadow-2xl shadow-blue-200 transition-all"
          >
            <Save size={20} /> Salvar Alterações
          </button>
          )}`
);

// Wrap fieldset
content = content.replace(
  /\{\/\* Seção 0: Dados do Agendamento \*\/\}/,
  `<fieldset disabled={readOnly} className={readOnly ? "opacity-90 pointer-events-none" : ""}>\n      {/* Seção 0: Dados do Agendamento */}`
);

content = content.replace(
  /<\/FormSection>\n\s*\{\/\* Ações Inferiores \*\/\}/,
  `</FormSection>\n      </fieldset>\n\n      {/* Ações Inferiores */}`
);

// 6. Fix 'aguardando_vaga' module to have THREE buttons
const aguardandoButtons = `
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => onOpenFullForm(data, true)}
                  className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={16} /> Ver Ficha
                </button>
                <button
                  onClick={() => onOpenFullForm(data, false)}
                  className="w-full py-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Edit size={16} /> Editar Ficha
                </button>
                <button
                  onClick={() => onEdit(true)}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Gerar PDF
                </button>
              </div>`;

content = content.replace(
  /<div className="flex gap-3">\s*<button[\s\S]*?Ver \/ Editar Ficha\s*<\/button>\s*<button[\s\S]*?Gerar PDF\s*<\/button>\s*<\/div>/,
  aguardandoButtons
);

fs.writeFileSync('components/ScreeningModule.tsx', content);
console.log('Done');

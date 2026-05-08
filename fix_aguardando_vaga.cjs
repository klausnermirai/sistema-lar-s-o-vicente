const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

const regexSaveFn = /case "aguardando_vaga":\s*return \(\s*<div className="space-y-6">([\s\S]*?)<\/div>\s*\);\s*case "decisao_diretoria":/m;

const match = content.match(regexSaveFn);
if (match) {
  let inside = match[1];
  
  const buttonsHtml = `
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onSave(data);
                    onOpenFullForm(data);
                  }}
                  className="w-1/2 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={16} /> Ver / Editar Ficha
                </button>
                <button
                  onClick={() => {
                    onSave(data);
                    onEdit(true);
                  }}
                  className="w-1/2 py-3.5 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Gerar PDF
                </button>
              </div>`;

  inside = inside.replace(/<div className="grid grid-cols-1 gap-3">/, `<div className="grid grid-cols-1 gap-3">\n${buttonsHtml}`);
  content = content.replace(regexSaveFn, `case "aguardando_vaga":\n        return (\n          <div className="space-y-6">${inside}</div>\n        );\n      case "decisao_diretoria":`);
  
  fs.writeFileSync('components/ScreeningModule.tsx', content);
  console.log('Fixed aguardando_vaga');
} else {
  console.log('Not found');
}

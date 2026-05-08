const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

const regexOldPrintButton = /<\s*button\s+onClick=\{\(\)\s*=>\s*\{\s*onSave\(data\);\s*onEdit\(true\);\s*\}\}\s+className="w-full py-3.5 bg-gray-900 border-2 border-gray-900 text-white rounded-2xl text-\[11px\] font-black uppercase shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"\s*>\s*<Printer size=\{16\} \/> Acessar Ficha p\/ Gerar PDF\s*<\/button>/g;

const newButtons = `<div className="flex gap-3">
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

content = content.replace(regexOldPrintButton, newButtons);

const regexOldPrintButton2 = /<\s*button\s+onClick=\{\(\)\s*=>\s*\{\s*onSave\(data\);\s*handleGenerateFullReport\(\);\s*\}\}\s+className="w-full py-3.5 bg-gray-900 border-2 border-gray-900 text-white rounded-2xl text-\[11px\] font-black uppercase shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"\s*>\s*<Printer size=\{16\} \/> Acessar Ficha p\/ Gerar PDF\s*<\/button>/g;

const newButtons2 = `<div className="flex gap-3">
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
                    handleGenerateFullReport();
                  }}
                  className="w-1/2 py-3.5 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Gerar PDF
                </button>
              </div>`;

content = content.replace(regexOldPrintButton2, newButtons2);

// Fix the one inside `arquivado` state or `acolhidos`
const regexOldPrintButton3 = /<\s*button\s+onClick=\{handleGenerateFullReport\}\s+className="w-full py-4 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl text-\[10px\] font-black uppercase shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"\s*>\s*<FileText size=\{16\} \/> Ver Ficha Completa\s*<\/button>/g;

const newButtons3 = `<div className="flex gap-3">
                <button
                  onClick={() => onOpenFullForm(data)}
                  className="w-1/2 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={16} /> Ver Ficha
                </button>
                <button
                  onClick={handleGenerateFullReport}
                  className="w-1/2 py-3.5 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-sm hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Gerar PDF
                </button>
              </div>`;

content = content.replace(regexOldPrintButton3, newButtons3);

fs.writeFileSync('components/ScreeningModule.tsx', content);
console.log('Fixed screening actions logic inside Modal.');

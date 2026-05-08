const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

// 1. Add other "Pareceres" to CandidateForm UI
const newSectionsUI = `      </FormSection>

      {/* PARECERES ADICIONAIS */}
      {data.boardOpinion && (
        <FormSection num="12" title="PARECER DA DIRETORIA">
          <div className="p-4 bg-purple-50 text-purple-900 rounded-xl text-xs font-black uppercase whitespace-pre-wrap">
            {data.boardOpinion}
          </div>
        </FormSection>
      )}

      {data.medicalOpinion && (
        <FormSection num="13" title="PARECER MÉDICO">
          <div className="p-4 bg-teal-50 text-teal-900 rounded-xl text-xs font-black uppercase whitespace-pre-wrap">
            {data.medicalOpinion}
          </div>
        </FormSection>
      )}

      {data.integrationReport && (
        <FormSection num="14" title="RELATÓRIO DE INTEGRAÇÃO (ACOLHIMENTO)">
          <div className="p-4 bg-pink-50 text-pink-900 rounded-xl text-xs font-black uppercase whitespace-pre-wrap">
            {data.integrationReport}
          </div>
        </FormSection>
      )}`;

content = content.replace(
  /<\/FormSection>\n\s*<\/fieldset>\n\n\s*\{\/\* Ações Inferiores \*\/\}/,
  `${newSectionsUI}\n      </fieldset>\n\n      {/* Ações Inferiores */}`
);

// 2. Add other "Pareceres" to the PDF inside handlePrintCandidate

const htmlPareceresAdditions = `          <h2 class="section-title">11. Parecer Social</h2>
          <div class="paragraph">\${data.interview?.socialAnalysis || ''}</div>

          \${data.boardOpinion ? \`
          <h2 class="section-title">12. Parecer da Diretoria</h2>
          <div class="paragraph">\${data.boardOpinion}</div>
          \` : ''}

          \${data.medicalOpinion ? \`
          <h2 class="section-title">13. Parecer Médico</h2>
          <div class="paragraph">\${data.medicalOpinion}</div>
          \` : ''}

          \${data.integrationReport ? \`
          <h2 class="section-title">14. Relatório de Integração</h2>
          <div class="paragraph">\${data.integrationReport}</div>
          \` : ''}`;

content = content.replace(
  /<h2 class="section-title">11\. Parecer Social<\/h2>\s*<div class="paragraph">\$\{data\.interview\?\.socialAnalysis \|\| ''\}<\/div>/,
  htmlPareceresAdditions
);

fs.writeFileSync('components/ScreeningModule.tsx', content);
console.log('Pareceres added to Form and PDF.');

const fs = require('fs');
let content = fs.readFileSync('components/ScreeningModule.tsx', 'utf8');

content = content.replace(
  /             <\/p>\n          \)}\n        <\/div>\n      <\/FormSection>(\s*<\/div>\s*<\/div>\s*\)\;\s*\})/m,
  `             </p>\n          )}\n        </div>\n      </FormSection>\n      </fieldset>\n$1`
);
// And I need to insert the other Pareceres before the </fieldset>, since they didn't get inserted!
const newSectionsUI = `
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
      )}
`;

content = content.replace(/<\/FormSection>\n      <\/fieldset>/, `</FormSection>${newSectionsUI}\n      </fieldset>`);

fs.writeFileSync('components/ScreeningModule.tsx', content);

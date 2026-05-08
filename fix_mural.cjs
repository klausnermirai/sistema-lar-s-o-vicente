const fs = require('fs');
let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

const regexOldMuralPost = /onPostToMural\(\{\s*title:\s*'Primeira Avaliação de Fisioterapia Registrada',\s*content:\s*`A Primeira Avaliação de Fisioterapia foi registrada para a\(o\) residente \$\{resident\.name\} pelo\(a\) profissional \$\{signatureName\}\$\{role\}\.`,\s*author:\s*signatureName,\s*category:\s*'atendimento',\s*visibilidade:\s*\['admin'\]\s*\}\);/g;

const newMuralPost = `onPostToMural({
          author: signatureName,
          text: \`**Primeira Avaliação Registrada**\\n\\n**Área:** Fisioterapia\\n**Residente:** \${resident.name}\\n**Profissional:** \${signatureName}\${role}\\n**Data:** \${new Date().toLocaleString('pt-BR')}\`,
          visibilidade: ['admin'] // Sugestão para visibilidade de administração
        });`;

content = content.replace(regexOldMuralPost, newMuralPost);
fs.writeFileSync('components/PhysiotherapyTab.tsx', content);
console.log('Fixed mural post variables');

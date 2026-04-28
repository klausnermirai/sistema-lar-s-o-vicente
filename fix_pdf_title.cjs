const fs = require('fs');
let content = fs.readFileSync('components/MultidisciplinaryModule.tsx', 'utf8');

content = content.replace(/Residente: \$\{resident\.name\}/g, "Residente/Candidato: ${resident.name}");

fs.writeFileSync('components/MultidisciplinaryModule.tsx', content, 'utf8');

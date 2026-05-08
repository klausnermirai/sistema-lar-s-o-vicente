const fs = require('fs');
let content = fs.readFileSync('components/SocialWorkerTab.tsx', 'utf8');

// For Nutrição
content = content.replace(
  "const parts = [e.weight ? `Peso: ${e.weight}kg` : '', e.foodAcceptance ? `Aceitação: ${e.foodAcceptance}` : ''].filter(Boolean);",
  "const parts = [e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '', e.weight ? `Peso: ${e.weight}kg` : '', e.foodAcceptance ? `Aceitação: ${e.foodAcceptance}` : ''].filter(Boolean);"
);

// For Psicologia
content = content.replace(
  "e.institutionalAdaptationStatus ? `Adaptação: ${e.institutionalAdaptationStatus}` : '',",
  "e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',\n                e.institutionalAdaptationStatus ? `Adaptação: ${e.institutionalAdaptationStatus}` : '',"
);

// For TO
content = content.replace(
  "e.functionalEvolution ? `Evolução Funcional: ${e.functionalEvolution}` : '',",
  "e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',\n                e.functionalEvolution ? `Evolução Funcional: ${e.functionalEvolution}` : '',"
);

// For Fisio
content = content.replace(
  "e.description ? `Descrição: ${e.description}` : '',",
  "e.descricaoEvolucao ? `${e.descricaoEvolucao}` : '',\n                e.description ? `Descrição: ${e.description}` : '',"
);

// Now change `new Date(e.date)` to `new Date(e.dataEvolucao || e.date)` in all filters and formats
content = content.replaceAll("new Date(e.date)", "new Date(e.dataEvolucao || e.date)");

fs.writeFileSync('components/SocialWorkerTab.tsx', content);
console.log("SocialWorkerTab updated!");

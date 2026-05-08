const fs = require('fs');
let content = fs.readFileSync('components/ProntuarioTab.tsx', 'utf8');

// For date parsing
content = content.replaceAll("ev.date", "(ev.dataEvolucao || ev.date)");

content = content.replace(/ev\.newConduct \?/g, "(ev.descricaoEvolucao || ev.newConduct) ?");
content = content.replace(/ev\.newConduct\.substring/g, "(ev.descricaoEvolucao || ev.newConduct).substring");

content = content.replace(
  "<p><strong>Conduta:</strong> {ev.newConduct}</p>",
  "{ev.descricaoEvolucao && <p><strong>Evolução:</strong> {ev.descricaoEvolucao}</p>}<p><strong>Conduta:</strong> {ev.novaConduta || ev.newConduct || 'N/A'}</p>"
);

fs.writeFileSync('components/ProntuarioTab.tsx', content);
console.log("ProntuarioTab format updated!");

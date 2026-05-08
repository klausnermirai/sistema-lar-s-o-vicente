const fs = require('fs');

let content = fs.readFileSync('components/PiaTab.tsx', 'utf8');

const regex = /\/\/ 6\. Assinaturas\s+addPdfSignatureNode\(doc\);/g;
const replacement = `// 6. Assinaturas
    const uniqueSignatures = new Set<string>();

    [psyInitial, ptInitial, nutInitial, otInitial].forEach((assess: any) => {
      if (assess && assess.profissionalAssinaturaTexto) {
        uniqueSignatures.add(assess.profissionalAssinaturaTexto);
      }
    });

    filteredEvolutions.forEach(group => {
      group.evs.forEach((e: any) => {
        if (e.profissionalAssinaturaTexto) {
          uniqueSignatures.add(e.profissionalAssinaturaTexto);
        } else if (e.professionalName) {
           const role = e.professionalRole || '';
           uniqueSignatures.add(\`\${e.professionalName}\\n\${role}\`);
        }
      });
    });

    if (uniqueSignatures.size === 0) {
      addPdfSignatureNode(doc);
    } else {
      let currentY = yPos + 20;
      doc.addPage();
      currentY = 40;
      const colWidth = pageWidth / 2;
      const signs = Array.from(uniqueSignatures);
      
      signs.forEach((signStr, idx) => {
        if (idx > 0 && idx % 2 === 0) {
          currentY += 35;
          if (currentY > 260) {
             doc.addPage();
             currentY = 40;
          }
        }
        
        const xPos = (idx % 2 === 0) ? (colWidth / 2) : (colWidth + colWidth / 2);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        doc.line(xPos - 35, currentY, xPos + 35, currentY);
        
        const lines = (signStr as string).split('\\n');
        let lineY = currentY + 5;
        lines.forEach(line => {
           doc.text(line, xPos, lineY, { align: 'center' });
           lineY += 5;
        });
      });
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync('components/PiaTab.tsx', content);
console.log("Updated signatures logic!");

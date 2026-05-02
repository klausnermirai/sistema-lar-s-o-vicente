const fs = require('fs');
const path = require('path');

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (var i in files) {
      if (files[i] === 'ui' && dir.includes('components')) continue;
      const name = dir + '/' + files[i];
      if (fs.statSync(name).isDirectory()) {
          getFiles(name, files_);
      } else if (name.endsWith('.tsx')) {
          files_.push(name);
      }
  }
  return files_;
}

const files = getFiles('components');

const importStatement = "\nimport { addPdfSignatureNode } from '../lib/pdfUtils';\n";

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  if (content.includes('doc.save(')) {
    if (!content.includes('addPdfSignatureNode')) {
        content = content.replace("import jsPDF from 'jspdf';", "import jsPDF from 'jspdf';" + importStatement);
        if (!content.includes('addPdfSignatureNode')) {
            content = content.replace("import { jsPDF } from 'jspdf';", "import { jsPDF } from 'jspdf';" + importStatement);
        }
    }

    // Usually before doc.save we can insert addPdfSignatureNode(doc);
    // Let's use regex to find doc.save(
    content = content.replace(/doc\.save\(/g, "addPdfSignatureNode(doc);\n    doc.save(");

    // Some places use `(doc as any).save` or `doc.output` but mostly doc.save
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
  }
});

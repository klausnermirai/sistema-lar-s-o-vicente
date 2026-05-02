const fs = require('fs');
const glob = require('glob');

const files = glob.sync('components/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Make sure getProfessionalSignature is imported
  if (content.includes('id: Date.now().toString()') || content.includes('timestamp: Date.now()') || content.includes('id: crypto.randomUUID()')) {
    if (!content.includes('getProfessionalSignature')) {
      content = content.replace(
        "import { fetchResidentById", 
        "import { fetchResidentById, getProfessionalSignature"
      );
      if (!content.includes('getProfessionalSignature')) {
        content = content.replace(
          "import React", 
          "import { getProfessionalSignature } from '../lib/api';\nimport React"
        );
      }
    }

    content = content.replace(
      /id:\s*Date\.now\(\)\.toString\(\),/g,
      "id: Date.now().toString(), ...getProfessionalSignature(),"
    );
    content = content.replace(
      /timestamp:\s*Date\.now\(\),/g,
      "timestamp: Date.now(), ...getProfessionalSignature(),"
    );
    content = content.replace(
      /id:\s*crypto\.randomUUID\(\),/g,
      "id: crypto.randomUUID(), ...getProfessionalSignature(),"
    );

    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Updated ' + file);
    }
  }
});

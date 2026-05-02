const fs = require('fs');
const path = require('path');

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (var i in files) {
      if (files[i] === 'ui' && dir.includes('components')) continue; // Skip ui dir if needed
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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  if (content.includes('id: Date.now().toString()') || content.includes('timestamp: Date.now()') || content.includes('id: crypto.randomUUID()')) {
    if (!content.includes('getProfessionalSignature')) {
      content = content.replace(
        "import React", 
        "import { getProfessionalSignature } from '../lib/api';\nimport React"
      );
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

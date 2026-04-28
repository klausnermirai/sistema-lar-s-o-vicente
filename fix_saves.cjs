const fs = require('fs');
let content = fs.readFileSync('components/MultidisciplinaryModule.tsx', 'utf8');

content = content.replace(/onChange=\{\(data\) => onSaveResident\(\{ \.\.\.selectedResident/g, "onChange={(data) => handleSaveEntity({ ...selectedResident");
content = content.replace(/onSaveResident\(updatedResident\)/g, "handleSaveEntity(updatedResident)");

fs.writeFileSync('components/MultidisciplinaryModule.tsx', content, 'utf8');

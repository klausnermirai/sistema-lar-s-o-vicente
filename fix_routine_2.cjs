const fs = require('fs');
const content = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');

let updated = content.replace(/if \(isTabletMode && tabletStep === 'register'\)/g, "if (tabletStep === 'register')");

fs.writeFileSync('components/DailyRoutineTab.tsx', updated);
console.log('Fixed line 145');

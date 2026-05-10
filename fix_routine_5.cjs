const fs = require('fs');
let text = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');
text = text.replace(/\\n/g, ""); // regex replace string literal \n to nothing
// Actually the text is just \n exactly. Oh wait! I want to replace the literal text "\n" which has backslash and 'n'.
text = text.replace(/\\\\n/g, "");
fs.writeFileSync('components/DailyRoutineTab.tsx', text);
console.log('Fixed export');

const fs = require('fs');
const content = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');

const lines = content.split('\\n');
const fixedLines = lines.map(line => {
    if (line.trim() === ')}') {
	    // Need to make sure it's one of those three. I'll just look for closing button and then } on the next line.
        // Actually, just find the specific lines using a quick regex.
    }
    return line;
});

// Since the error gives exact lines: 353, 495, 819
let linesArr = content.split('\\n');
linesArr[352] = ''; // index 352 is line 353
linesArr[494] = ''; // index 494 is line 495
linesArr[818] = ''; // index 818 is line 819

fs.writeFileSync('components/DailyRoutineTab.tsx', linesArr.join('\\n'));
console.log('Fixed syntax errors');

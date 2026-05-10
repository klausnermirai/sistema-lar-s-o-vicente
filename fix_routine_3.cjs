const fs = require('fs');
const content = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');

let updated = content.replace(/\{true && \(/g, "");

// also remove the closing parenthesis to balance it. Wait, the closing `)}` might be hard to safely replace via regex.
// let's do it correctly by providing precise string replacements.

updated = updated.replace(
`            {true && (
              <button 
                onClick={() => setTabletStep('menu')}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all"
              >
                <ChevronLeft size={28} />
              </button>
            )}`,
`            <button 
              onClick={() => setTabletStep('menu')}
              className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all shrink-0"
            >
              <ChevronLeft size={28} />
            </button>`
);

updated = updated.replace(
`            {true && (
              <button 
                onClick={() => setTabletStep('menu')}
                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all shrink-0"
              >
                <ChevronLeft size={28} />
              </button>
            )}`,
`            <button 
              onClick={() => setTabletStep('menu')}
              className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl flex items-center justify-center transition-all shrink-0"
            >
              <ChevronLeft size={28} />
            </button>`
);

updated = updated.replace(
`            {true && (
              <button 
                onClick={() => setTabletStep('menu')}
                className="w-12 h-12 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-all"
              >
                <ChevronLeft size={24} />
              </button>
            )}`,
`            <button 
              onClick={() => setTabletStep('menu')}
              className="w-12 h-12 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-all shrink-0"
            >
              <ChevronLeft size={24} />
            </button>`
);

fs.writeFileSync('components/DailyRoutineTab.tsx', updated);
console.log('Fixed true && checks');

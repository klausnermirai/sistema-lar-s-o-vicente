const fs = require('fs');

const content = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');

// Replace tablet-specific checks with just checking the step
let updated = content.replace(/if \(isTabletMode && tabletStep === 'menu'\)/g, "if (tabletStep === 'menu')");
updated = updated.replace(/if \(isTabletMode && tabletStep === 'summary'\)/g, "if (tabletStep === 'summary')");

// Also remove isTabletMode checks for the back button
updated = updated.replace(/{isTabletMode && \(/g, "{true && (");

// Remove the old desktop return entirely.
const desktopReturnStart = updated.indexOf('return (\n    <div className="flex bg-gray-50/10 h-full min-h-0');
if (desktopReturnStart !== -1) {
    const desktopReturnReplacement = `return (
    <div className="flex bg-gray-50/10 h-full min-h-0 animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {renderRegisterContent()}
      </div>
    </div>
  );`;
    updated = updated.substring(0, desktopReturnStart) + desktopReturnReplacement + '\n}\n\nexport default DailyRoutineTab;';
}

fs.writeFileSync('components/DailyRoutineTab.tsx', updated);
console.log('Fixed DailyRoutineTab');

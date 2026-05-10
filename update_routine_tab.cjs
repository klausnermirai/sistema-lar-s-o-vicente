const fs = require('fs');
const content = fs.readFileSync('components/DailyRoutineTab.tsx', 'utf8');

const lines = content.split('\n');

// Find the start of the Main Content Area
const startIdx = lines.findIndex(l => l.includes('{/* Main Content Area */}'));

// Find the very end of the file
const endIdx = lines.findIndex(l => l.includes('export default DailyRoutineTab;'));

if (startIdx !== -1 && endIdx !== -1) {
    const before = lines.slice(0, startIdx).join('\n');
    const after = lines.slice(endIdx).join('\n');
    
    // Replace the sidebar lines
    let newBefore = before.replace(
        '<div className="w-72 border-r bg-white flex flex-col shrink-0 min-h-0">',
        '{!isTabletMode && (\n        <div className="w-72 border-r bg-white flex flex-col shrink-0 min-h-0 hidden md:flex">'
    );
    
    newBefore = newBefore.replace(
        '          </div>\n        </div>\n      </div>',
        '          </div>\n        </div>\n      </div>\n      )}'
    );
    
    const newMainContent = `      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {(isTabletMode ? tabletStep === 'summary' : viewMode === 'summary') ? (
           <div className="h-full bg-white flex flex-col animate-in fade-in duration-300 min-h-0">
             {renderSummary()}
           </div>
        ) : (
           renderRegisterContent()
        )}
      </div>
    </div>
  );
};

`;
    
    fs.writeFileSync('components/DailyRoutineTab.tsx', newBefore + '\n' + newMainContent + after);
    console.log("File updated!");
} else {
    console.log("Could not find start or end index.");
}

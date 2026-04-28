const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

// Also replace the default route again from VISITAS to HOME
app = app.replace(
  "if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;\n    return AppRoute.RESIDENTS;",
  "if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;\n    return AppRoute.HOME;"
);

// We need to inject the JSX block for AppRoute.HOME
const homeJsx = `
      {activeRoute === AppRoute.HOME && (
        <div className="h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col pt-4 min-h-[500px]">
          <MuralModule institutionId={session?.institutionId || session?.cnpj || ''} cnpj={session?.cnpj} username={session?.username || ''} hideHeader />
        </div>
      )}
`;

app = app.replace(
  "{activeRoute === AppRoute.RESIDENTS && (",
  homeJsx + "\n      {activeRoute === AppRoute.RESIDENTS && ("
);

// We need to import MuralModule in App.tsx if it isn't imported
if (!app.includes("import MuralModule")) {
  app = app.replace(
    "import SettingsModule from './components/SettingsModule';",
    "import SettingsModule from './components/SettingsModule';\nimport MuralModule from './components/MuralModule';"
  );
}

fs.writeFileSync('App.tsx', app);

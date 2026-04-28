const fs = require('fs');

// Patch types.ts
let types = fs.readFileSync('types.ts', 'utf8');
types = types.replace(
  "export enum AppRoute {",
  "export enum AppRoute {\n  HOME = 'home',"
);
fs.writeFileSync('types.ts', types);

// Patch App.tsx
let app = fs.readFileSync('App.tsx', 'utf8');
app = app.replace(
  "if (session?.accessLevel === 'medico') return AppRoute.CONSULTAS_MEDICAS;\n    if (session?.accessLevel === 'cuidados') return AppRoute.SAUDE_CUIDADOS;\n    if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;\n    return AppRoute.RESIDENTS;",
  "if (session?.accessLevel === 'medico') return AppRoute.CONSULTAS_MEDICAS;\n    if (session?.accessLevel === 'visitante') return AppRoute.VISITANTES;\n    return AppRoute.HOME;"
);
app = app.replace(
  "const renderContent = () => {",
  `const renderContent = () => {\n    if (activeRoute === AppRoute.HOME) {\n      return (\n        <div className="h-full bg-white rounded-[32px] overflow-hidden flex flex-col">\n          <MuralModule session={session} />\n        </div>\n      );\n    }`
);

// We need to import MuralModule in App.tsx if it isn't imported
if (!app.includes("import MuralModule")) {
  app = app.replace(
    "import SettingsModule from './components/SettingsModule';",
    "import SettingsModule from './components/SettingsModule';\nimport MuralModule from './components/MuralModule';"
  );
}

fs.writeFileSync('App.tsx', app);

// Patch Layout.tsx
let layout = fs.readFileSync('components/Layout.tsx', 'utf8');
layout = layout.replace(
  "import { Search, Bell, Settings, FileSearch, Users, HeartPulse, Stethoscope, Pill, Calendar, Activity, BarChart3, LogOut, DollarSign, Package, ChevronLeft, ChevronRight, MessageSquare, AlertCircle, FileText } from 'lucide-react';",
  "import { Search, Bell, Settings, FileSearch, Users, HeartPulse, Stethoscope, Pill, Calendar, Activity, BarChart3, LogOut, DollarSign, Package, ChevronLeft, ChevronRight, MessageSquare, AlertCircle, FileText, Home } from 'lucide-react';"
);

// We need to add 'home' to atendimentoRoutes
layout = layout.replace(
  "const atendimentoRoutes = [",
  "const atendimentoRoutes = [\n      AppRoute.HOME,"
);

// Replace default item lists in Layout
layout = layout.replace(
  "let atendimentoItems = [\n    { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },",
  "let atendimentoItems = [\n    { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },\n    { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },"
);
layout = layout.replace(
  "if (isEnfermeira) {\n    atendimentoItems = [\n      { id: AppRoute.GUIAS, label: 'Guias', icon: FileText, disabled: true } as any,\n      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },",
  "if (isEnfermeira) {\n    atendimentoItems = [\n      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },\n      { id: AppRoute.GUIAS, label: 'Guias', icon: FileText, disabled: true } as any,\n      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },"
);
layout = layout.replace(
  "} else if (isAssistenteSocial) {\n    atendimentoItems = [\n      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },",
  "} else if (isAssistenteSocial) {\n    atendimentoItems = [\n      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },\n      { id: AppRoute.SCREENING, label: 'Triagens', icon: FileSearch },"
);
layout = layout.replace(
  "} else if (isCuidados) {\n    atendimentoItems = [\n      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },",
  "} else if (isCuidados) {\n    atendimentoItems = [\n      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },\n      { id: AppRoute.AGENDA, label: 'Agenda', icon: Calendar },"
);
layout = layout.replace(
  "} else if (isPsicologia || isTerapeutaOcupacional || isFisioterapeuta || isNutricionista) {\n    atendimentoItems = [\n      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },",
  "} else if (isPsicologia || isTerapeutaOcupacional || isFisioterapeuta || isNutricionista) {\n    atendimentoItems = [\n      { id: AppRoute.HOME, label: 'Página Inicial', icon: Home },\n      { id: AppRoute.RESIDENTS, label: 'Residentes', icon: Users },"
);

// Remove 'Mural' from top header
layout = layout.replace(
  /\{\!\(isMedico \|\| isVisitante\) && \(\n[\s\S]*?className="bg-blue-50 text-blue-800 px-6 py-2\.5 rounded-md font-bold uppercase text-\[10px\] tracking-widest flex items-center gap-2 hover:bg-blue-100 transition-colors"\n[\s\S]*?Mural.*\n[\s\S]*?<\/button>\n\s*\)\}/m,
  ""
);

fs.writeFileSync('components/Layout.tsx', layout);

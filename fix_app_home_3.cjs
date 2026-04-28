const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

app = app.replace(
  "    } else if (session?.accessLevel === 'visitante' && activeRoute === AppRoute.RESIDENTS) {\n      setActiveRoute(AppRoute.VISITANTES);\n    }",
  "    } else if (session?.accessLevel === 'visitante' && (activeRoute === AppRoute.RESIDENTS || activeRoute === AppRoute.HOME)) {\n      setActiveRoute(AppRoute.VISITANTES);\n    }"
);

fs.writeFileSync('App.tsx', app);

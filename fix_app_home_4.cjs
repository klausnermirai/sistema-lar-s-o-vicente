const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

app = app.replace(
  "<MuralModule institutionId={session?.institutionId || session?.cnpj || ''} cnpj={session?.cnpj} username={session?.username || ''} hideHeader />",
  "<MuralModule institutionId={session?.institutionId || session?.cnpj || ''} cnpj={session?.cnpj} username={session?.username || ''} />"
);

fs.writeFileSync('App.tsx', app);

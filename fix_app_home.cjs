const fs = require('fs');

let app = fs.readFileSync('App.tsx', 'utf8');

// Find the <MuralModule session={session} /> and replace it
app = app.replace(
  "<MuralModule session={session} />",
  "<MuralModule institutionId={session?.institutionId || session?.cnpj || ''} cnpj={session?.cnpj} username={session?.username || ''} hideHeader />"
);

fs.writeFileSync('App.tsx', app);

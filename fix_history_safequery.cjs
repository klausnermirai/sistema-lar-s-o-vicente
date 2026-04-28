const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
  "const snapshot = await query.get();\n      const dbResidents = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);",
  "const dbResidents = await safeQuery(async () => {\n        const snapshot = await query.get();\n        return snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived);\n      }, []);"
);

fs.writeFileSync('server.ts', server);

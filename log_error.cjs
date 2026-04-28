const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
  "res.status(500).json({ error: 'Erro ao buscar histórico multidisciplinar' });",
  "res.status(500).json({ error: 'Erro ao buscar histórico multidisciplinar', details: error.message });"
);

fs.writeFileSync('server.ts', server);

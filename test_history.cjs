const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(
  "res.json(events.slice(0, 20));",
  "console.log('Sending history events for ' + competence + ':', events.length);\n      res.json(events.slice(0, 20));"
);

fs.writeFileSync('server.ts', server);

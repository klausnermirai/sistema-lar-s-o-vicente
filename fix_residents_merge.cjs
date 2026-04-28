const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

const regexMerge = /return \[\.\.\.demoResidents, \.\.\.dbResidents\];/g;
const newMerge = `
        const merged = new Map();
        [...demoResidents, ...dbResidents].forEach((r: any) => {
          // db ones come later, so they overwrite demo ones if they have the same ID
          merged.set(r.id, r);
        });
        return Array.from(merged.values());
`;

server = server.replace(regexMerge, newMerge);

fs.writeFileSync('server.ts', server);

const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/snapshot\.docs\.map\(doc => \(\{ \.\.\.doc\.data\(\), id: doc\.id \}\)\)/g, "snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived)");
code = code.replace(/snapshot\.docs\.map\(\(doc: any\) => \(\{ \.\.\.doc\.data\(\), id: doc\.id \}\)\)/g, "snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })).filter((item: any) => !item.archived)");
fs.writeFileSync('server.ts', code, 'utf8');

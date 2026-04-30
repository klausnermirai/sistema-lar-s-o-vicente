import { spawn } from 'child_process';
import http from 'http';

const server = spawn('npm', ['run', 'dev']);
server.stdout.on('data', data => console.log(`STDOUT: ${data}`));
server.stderr.on('data', data => console.log(`STDERR: ${data}`));

setTimeout(() => {
  http.get('http://127.0.0.1:3000/api/test-db', (res) => {
     let data = '';
     res.on('data', chunk => data += chunk);
     res.on('end', () => {
       console.log('API Response:', data);
       server.kill();
       process.exit(0);
     });
  });
}, 3000);

const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "app.get('/api/residents', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante']), async (req, res) => {",
  "app.get('/api/residents', requireRole(['enfermeira', 'assistente_social', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'gerencial', 'visitante', 'medico', 'administrador']), async (req, res) => {"
);

code = code.replace(
  "app.get('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial']), async (req, res) => {",
  "app.get('/api/candidates', requireRole(['assistente_social', 'enfermeira', 'gerencial', 'psicologia', 'terapeuta_ocupacional', 'fisioterapeuta', 'nutricionista', 'cuidados', 'medico', 'administrador']), async (req, res) => {"
);

fs.writeFileSync('server.ts', code);

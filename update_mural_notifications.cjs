const fs = require('fs');

function updateFile(filePath, replacer) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = replacer(content);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes made to ${filePath}`);
  }
}

// 1. MultidisciplinaryModule.tsx
updateFile('components/MultidisciplinaryModule.tsx', (content) => {
  // Nutrition
  content = content.replace(
    /\/\/ Post to mural if requested\s+if \(attendance\.muralNotes\) \{\s+onPostToMural\(\{\s+author: attendance\.signature \|\| 'Nutricionista',\s+text: `\[Nutrição\] \$\{resident\.name\}: \$\{attendance\.muralNotes\}`,\s+\}\);\s+\}/,
    `// Emit notification to mural
    let muralText = \`[Nutrição] Atendimento de \${resident.name} finalizado.\`;
    if (attendance.muralNotes) muralText += \` Notas: \${attendance.muralNotes}\`;
    onPostToMural({
      author: attendance.signature || 'Nutricionista',
      text: muralText,
    });`
  );
  
  // Psychology
  content = content.replace(
    /\/\/ Post to mural if requested\s+if \(attendance\.muralNotes\) \{\s+onPostToMural\(\{\s+author: attendance\.signature \|\| 'Psicologia',\s+text: `\[Psicologia\] \$\{resident\.name\}: \$\{attendance\.muralNotes\}`,\s+\}\);\s+\}/,
    `// Emit notification to mural
    let muralText = \`[Psicologia] Atendimento de \${resident.name} finalizado.\`;
    if (attendance.muralNotes) muralText += \` Notas: \${attendance.muralNotes}\`;
    onPostToMural({
      author: attendance.signature || 'Psicologia',
      text: muralText,
    });`
  );
  return content;
});

// 2. PhysiotherapyTab.tsx
updateFile('components/PhysiotherapyTab.tsx', (content) => {
  return content.replace(
    /if \(newAttendance\.muralNotes && onPostToMural\) \{\s+onPostToMural\(\{\s+author: newAttendance\.professionalName \|\| 'Fisioterapeuta',\s+text: `\[Fisioterapia\] \$\{resident\.name\}: \$\{newAttendance\.muralNotes\}`,\s+\}\);\s+\}/,
    `if (onPostToMural) {
      let muralText = \`[Fisioterapia] Atendimento de \${resident.name} finalizado.\`;
      if (newAttendance.muralNotes) muralText += \` Notas: \${newAttendance.muralNotes}\`;
      onPostToMural({
        author: newAttendance.professionalName || 'Fisioterapeuta',
        text: muralText,
      });
    }`
  );
});

// 3. OccupationalTherapyTab.tsx
updateFile('components/OccupationalTherapyTab.tsx', (content) => {
  return content.replace(
    /if \(attendance\.muralNotes && onPostToMural\) \{\s+onPostToMural\(\{\s+author: attendance\.professionalName \|\| 'Terapeuta Ocupacional',\s+text: `\[Terapia Ocupacional\] \$\{resident\.name\}: \$\{attendance\.muralNotes\}`,\s+\}\);\s+\}/,
    `if (onPostToMural) {
        let muralText = \`[Terapia Ocupacional] Atendimento de \${resident.name} finalizado.\`;
        if (attendance.muralNotes) muralText += \` Notas: \${attendance.muralNotes}\`;
        onPostToMural({
          author: attendance.professionalName || 'Terapeuta Ocupacional',
          text: muralText,
        });
      }`
  );
});

// 4. MedicalModule.tsx
updateFile('components/MedicalModule.tsx', (content) => {
  if (!content.includes('onPostToMural?: ')) {
    content = content.replace(
      'session?: any;',
      `session?: any;\n  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;`
    );
  }
  
  if (!content.includes('onPostToMural }) =>')) {
    content = content.replace(
      'onSaveCandidate, session }) => {',
      'onSaveCandidate, session, onPostToMural }) => {'
    );
  }

  // Handle Evolucao
  if (!content.includes('[Médico] Evolução')) {
    content = content.replace(
      /setNextAppointmentTime\(''\);\s+alert\('Evolução médica salva com sucesso!'\);/g,
      `setNextAppointmentTime('');
    if (onPostToMural) {
      onPostToMural({
        author: session?.username || 'Médico',
        text: \`[Médico] Evolução clínica salva para o residente \${resident.name}.\`
      });
    }
    alert('Evolução médica salva com sucesso!');`
    );
  }

  // Handle Parecer
  if (!content.includes('[Médico] Parecer')) {
    content = content.replace(
      /setMedicalStatus\(undefined\);\s+alert\('Parecer médico salvo com sucesso!'\);/g,
      `setMedicalStatus(undefined);
    if (onPostToMural) {
      onPostToMural({
        author: session?.username || 'Médico',
        text: \`[Médico] Parecer médico salvo para a admissão de \${selectedPerson.name}.\`
      });
    }
    alert('Parecer médico salvo com sucesso!');`
    );
  }
  return content;
});

// 5. App.tsx (inject to MedicalModule)
updateFile('App.tsx', (content) => {
  if (!content.includes('onPostToMural={handlePostToMural}')) {
    // If it's missing entirely (but we know others have it). Let's just find <MedicalModule
    // and append onPostToMural if not present.
    // Wait, the easiest way is to use regex.
  }
  content = content.replace(
    /(<MedicalModule\s+residents=\{residents\}\s+onSaveResident=\{handleSaveResident\}\s+candidates=\{candidates\}\s+onSaveCandidate=\{handleSaveCandidate\}\s+session=\{session\})/g,
    `$1\n          onPostToMural={handlePostToMural}`
  );
  return content;
});

// 6. HealthCareModule.tsx
// It already uses onPostToMural for Handover, but let's check its text for Handover.
updateFile('components/HealthCareModule.tsx', (content) => {
  if (!content.includes('[Saúde/Cuidados] Plantão')) {
    content = content.replace(
      /\/\/ Handover is usually global, for now we log it as a mural post\s+console\.log\("Handover saved", handover\);/g,
      `// Handover is usually global, for now we log it as a mural post
            onPostToMural({
              author: handover.nurseName || 'Enfermagem',
              text: \`[Saúde/Cuidados] Plantão finalizado (\${handover.shift}). Notas: \${handover.notes}\`
            });`
    );
  }
  return content;
});

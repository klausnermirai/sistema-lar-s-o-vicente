const fs = require('fs');

// Fix OccupationalTherapyTab
let ot = fs.readFileSync('components/OccupationalTherapyTab.tsx', 'utf8');
ot = ot.replace(/const handleSaveAssessment = \(\) => {\s*onChange\([\s\S]*?\}\);\s*\};\s*/, `const handleSaveAssessment = () => {
    try {
      onChange({
        ...otData,
        initialAssessment: assessment as any
      });
      alert('Avaliação Salva com Sucesso!');
    } catch(e) {
      alert('Erro ao salvar avaliação.');
    }
  };\n\n  `);
fs.writeFileSync('components/OccupationalTherapyTab.tsx', ot);

// Fix MultidisciplinaryModule (Nutrition Assessment)
let multi = fs.readFileSync('components/MultidisciplinaryModule.tsx', 'utf8');
multi = multi.replace(/const handleSubmit = \(e: React\.FormEvent\) => {\s+e\.preventDefault\(\);\s+onSave\(\{[\s\S]*?\}\);\s+\};/, `const handleSubmit = (e: React.FormEvent) => {
    try {
      e.preventDefault();
      onSave({
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        calfCircumference: formData.calfCircumference ? parseFloat(formData.calfCircumference) : undefined,
        skinfoldsNotTakenDueToLimitation: formData.skinfoldsNotTakenDueToLimitation,
        tricepsSkinfold: formData.tricepsSkinfold ? parseFloat(formData.tricepsSkinfold) : undefined,
        subscapularSkinfold: formData.subscapularSkinfold ? parseFloat(formData.subscapularSkinfold) : undefined,
        bicepsSkinfold: formData.bicepsSkinfold ? parseFloat(formData.bicepsSkinfold) : undefined,
        suprailiacSkinfold: formData.suprailiacSkinfold ? parseFloat(formData.suprailiacSkinfold) : undefined,
      });
      alert('Avaliação salva com sucesso!');
    } catch(err) {
      alert('Erro ao salvar avaliação.');
    }
  };`);

// Psychology Initial Assessment
multi = multi.replace(/const handleSubmit = \(e: React\.FormEvent\) => {\s+e\.preventDefault\(\);\s+onSave\(\{[\n\s]+...formData,[\n\s]+cognitiveScreeningMMSE: formData.cognitiveScreeningMMSE \? parseFloat\(formData.cognitiveScreeningMMSE\) : undefined,[\n\s]+\}\);\s+\};/, `const handleSubmit = (e: React.FormEvent) => {
    try {
      e.preventDefault();
      onSave({
        ...formData,
        cognitiveScreeningMMSE: formData.cognitiveScreeningMMSE ? parseFloat(formData.cognitiveScreeningMMSE) : undefined,
      });
      alert('Avaliação Psicológica salva com sucesso!');
    } catch(err) {
      alert('Erro ao salvar avaliação.');
    }
  };`);

fs.writeFileSync('components/MultidisciplinaryModule.tsx', multi);
console.log("Fixed alerts!");

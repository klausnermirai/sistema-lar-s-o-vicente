const fs = require('fs');

let content = fs.readFileSync('components/PhysiotherapyTab.tsx', 'utf8');

// Replace handleExportAssessmentPDF
const exportOld = `  const handleExportAssessmentPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Avaliação de Fisioterapia', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(\`Residente: \${resident.name}\`, 14, 30);
    doc.text(\`Data da Avaliação: \${assessment.date}\`, 14, 35);

    const tableData = [
      ['Avaliação Motora', { content: assessment.motorAssessment || 'N/A', colSpan: 3 }],
      ['Avaliação Respiratória', { content: assessment.respiratoryAssessment || 'N/A', colSpan: 3 }],
      ['Diagnóstico Cinético', { content: assessment.kineticFunctionalDiagnosis || 'N/A', colSpan: 3 }],
      ['Objetivos', { content: assessment.objectives || 'N/A', colSpan: 3 }],
      ['Conduta', { content: assessment.conduct || 'N/A', colSpan: 3 }]
    ];

    (doc as any).autoTable({
      startY: 45,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    addPdfSignatureNode(doc);
    doc.save(\`Avaliacao_Fisio_\${resident.name.replace(/\\s+/g, '_')}.pdf\`);
  };`;

const exportNew = `  const handleExportAssessmentPDF = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = 'PRIMEIRA AVALIAÇÃO DE FISIOTERAPIA';
    const { getHtmlPrintHeader, getHtmlPrintFooter, getHtmlPrintStyles } = await import('../lib/pdfHelpers');
    
    const headerHtml = await getHtmlPrintHeader(settings, title);
    const sigData = getProfessionalSignature();
    const signatureName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Profissional não identificado';
    const role = sigData.profissionalRole ? \` - \${sigData.profissionalRole}\` : ' - Fisioterapeuta';

    const calculateAgePDF = (birthDateString: string) => {
      if (!birthDateString) return '';
      let parts = birthDateString.split('/');
      let birthDate = parts.length === 3 
        ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) 
        : new Date(birthDateString);
      if (isNaN(birthDate.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return age + ' anos';
    };

    const ageCalculated = resident.birthDate ? calculateAgePDF(resident.birthDate) : '';
    const ageText = ageCalculated ? \` (Idade: \${ageCalculated})\` : '';
    
    const contentHtml = \`
      <div class="field">
        <span class="label">Residente:</span>
        <span class="value">\${resident.name || 'Não informado'} \${ageText}</span>
      </div>
      <div class="field">
        <span class="label">Data de Nascimento:</span>
        <span class="value">\${resident.birthDate || 'Não informado'}</span>
      </div>
      <div class="field">
        <span class="label">Quarto/Leito:</span>
        <span class="value">\${resident.room || 'Não informado'} \${resident.bedNumber ? '- Leito ' + resident.bedNumber : ''}</span>
      </div>
      <div class="field">
        <span class="label">Data da Avaliação:</span>
        <span class="value">\${assessment.date ? new Date(assessment.date).toLocaleDateString('pt-BR') : 'Não informado'}</span>
      </div>

      <div class="section-title">Avaliação Motora</div>
      <div class="paragraph">\${assessment.motorAssessment || 'Não informado'}</div>

      <div class="section-title">Avaliação Respiratória</div>
      <div class="paragraph">\${assessment.respiratoryAssessment || 'Não informado'}</div>

      <div class="section-title">Diagnóstico Cinesiofuncional</div>
      <div class="paragraph">\${assessment.kineticFunctionalDiagnosis || 'Não informado'}</div>

      <div class="section-title">Objetivos Terapêuticos</div>
      <div class="paragraph">\${assessment.objectives || 'Não informado'}</div>

      <div class="section-title">Condutas Terapêuticas</div>
      <div class="paragraph">\${assessment.conduct || 'Não informado'}</div>

      <div class="section-title">Plano de Tratamento Detalhado</div>
      <div class="paragraph">\${assessment.detailedTreatmentPlan || 'Não informado'}</div>

      <div class="section-title">Observações Finais</div>
      <div class="paragraph">\${assessment.finalObservations || 'Não informado'}</div>

      <div class="signature-box" style="margin-top: 60px;">
        <div class="signature-line" style="border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 5px; font-weight: bold; text-align: center;">\${signatureName}</div>
        <div class="signature-role" style="font-size: 10px; color: #666; text-align: center;">\${role.replace(' - ', '')}</div>
      </div>
    \`;

    const footerHtml = getHtmlPrintFooter();
    const styles = getHtmlPrintStyles();

    printWindow.document.write(\\\`
      <html>
        <head>
          <title>\\\${title}</title>
          <style>
            \\\${styles}
            .paragraph { font-family: sans-serif; }
            .section-title { margin-top: 25px; }
          </style>
        </head>
        <body>
          <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            \\\${headerHtml}
            \\\${contentHtml}
            \\\${footerHtml}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    \\\`);
    printWindow.document.close();
  };`;


content = content.replace(exportOld, exportNew);

const saveOld = `  const handleSaveAssessment = () => {
    try {
      let finalResident = { ...resident };
      
      finalResident.physiotherapy = {
        ...ptData,
        initialAssessment: assessment as PhysiotherapyAssessment
      };
      
      // Atualizar PIA automaticamente se existir
      if (finalResident.pia) {
        finalResident.pia = {
          ...finalResident.pia,
          interventions: {
            ...finalResident.pia.interventions,
            physiotherapy: (assessment.treatmentConducts?.join(', ') || '') + '\\n' + (assessment.detailedTreatmentPlan || '')
          }
        };
      }
      
      // Salva uma única vez para evitar condições de corrida (evitando chamar onChange e onSaveResident simultaneamente)
      onSaveResident(finalResident);
      alert('Avaliação Inicial Fisioterapêutica salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      alert('Ocorreu um erro ao salvar a avaliação.');
    }
  };`;

const saveNew = `  const handleSaveAssessment = () => {
    try {
      let finalResident = { ...resident };
      
      finalResident.physiotherapy = {
        ...ptData,
        initialAssessment: assessment as PhysiotherapyAssessment
      };
      
      // Atualizar PIA automaticamente se existir
      if (finalResident.pia) {
        finalResident.pia = {
          ...finalResident.pia,
          interventions: {
            ...finalResident.pia.interventions,
            physiotherapy: (assessment.treatmentConducts?.join(', ') || '') + '\\n' + (assessment.detailedTreatmentPlan || '')
          }
        };
      }
      
      // Salva uma única vez para evitar condições de corrida (evitando chamar onChange e onSaveResident simultaneamente)
      onSaveResident(finalResident);
      
      // Post to Mural
      if (onPostToMural) {
        const sigData = getProfessionalSignature();
        const role = sigData.profissionalRole ? \` - \${sigData.profissionalRole}\` : ' - Fisioterapeuta';
        const signatureName = sigData.profissionalAssinaturaTexto || sigData.profissionalNome || 'Profissional não identificado';
        
        onPostToMural({
          title: 'Primeira Avaliação de Fisioterapia Registrada',
          content: \`A Primeira Avaliação de Fisioterapia foi registrada para a(o) residente \${resident.name} pelo(a) profissional \${signatureName}\${role}.\`,
          author: signatureName,
          category: 'atendimento',
          visibilidade: ['admin']
        });
      }

      alert('Avaliação Inicial Fisioterapêutica salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      alert('Ocorreu um erro ao salvar a avaliação.');
    }
  };`;

content = content.replace(saveOld, saveNew);

fs.writeFileSync('components/PhysiotherapyTab.tsx', content);
console.log('Fixed export and save.');

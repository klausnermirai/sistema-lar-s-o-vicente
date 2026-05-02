import { getProfessionalSignature } from './api';

export const addPdfSignatureNode = (doc: any, recordObj?: any) => {
    let finalStr = '';
    
    // Se o próprio registro tiver a assinatura (individual reports)
    if (recordObj?.profissionalAssinaturaTexto) {
        finalStr = recordObj.profissionalAssinaturaTexto;
    } else {
        // Fallback for list reports or if single record does not have it
        const fallback = getProfessionalSignature() as any;
        if (fallback?.profissionalAssinaturaTexto) {
            finalStr = fallback.profissionalAssinaturaTexto;
        } else if (fallback?.profissionalNome) {
             finalStr = `${fallback.profissionalNome}\n${fallback.profissionalFuncao || ''}`;
        }
    }

    if (!finalStr) return; // Silent if still empty

    // Move Y cursor properly. Assuming `(doc as any).lastAutoTable` is populated
    let yPos = 250; 
    const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 30 : 220;
    yPos = Math.max(currentY, yPos);
    
    // Check page boundaries (standard A4 is 297 high)
    if (yPos > 270) {
        doc.addPage();
        yPos = 40;
    }

    // Set styling and draw
    const startX = doc.internal.pageSize.getWidth() / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const lines = finalStr.split('\n');
    doc.line(startX - 40, yPos, startX + 40, yPos); // a signature line
    yPos += 5;
    
    lines.forEach((line) => {
        doc.text(line, startX, yPos, { align: 'center' });
        yPos += 5;
    });
};

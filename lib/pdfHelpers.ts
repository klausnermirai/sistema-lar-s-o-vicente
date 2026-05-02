import { jsPDF } from "jspdf";
import { InstitutionSettings } from "../types";

export const urlToBase64 = async (url: string): Promise<string> => {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  
  try {
    // Attempt to load via proxy to bypass Firebase storage CORS restrictions
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Proxy HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Proxy failed, trying direct Image object fallback...", error);
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image object load failed'));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png");
      }
      return '';
    } catch (fallbackError) {
      console.error("All image load attempts failed:", fallbackError);
      return '';
    }
  }
};

export const addPdfHeaderAndFooter = async (
  doc: jsPDF,
  settings: InstitutionSettings | null | undefined,
  title: string,
) => {
  const cfg = settings?.reportConfig;
  const name = cfg?.institutionName || settings?.name || "SSVP";
  const cnpj = cfg?.cnpj || settings?.cnpj || "";
  const address = cfg?.address || "";
  const phone = cfg?.phone || "";
  const email = cfg?.email || "";
  const cityState = cfg?.cityState || settings?.city || "";
  const additional = cfg?.additionalText || "";
  const logoUrl = cfg?.logoUrl || settings?.logoUrl || "";

  const totalPages = (doc as any).internal.getNumberOfPages();
  const dateStr = new Date().toLocaleDateString("pt-BR");

  const loadedImageStr = await urlToBase64(logoUrl);

  for (let i = 1; i <= totalPages; i++) {

    doc.setPage(i);
    let startY = 15;

    // Cabeçalho
    if (loadedImageStr) {
      try {
        // use PNG format since toDataURL outputs PNG
        doc.addImage(loadedImageStr, "PNG", 14, 10, 25, 25);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(name, 45, 16);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        let lineY = 22;
        const details = [
          [cnpj ? `CNPJ: ${cnpj}` : "", cityState].filter(Boolean).join(" | "),
          [address, phone].filter(Boolean).join(" - "),
          email,
        ].filter(Boolean);

        details.forEach((d) => {
          doc.text(d, 45, lineY);
          lineY += 5;
        });

        if (additional) {
          doc.setFontSize(8);
          doc.text(additional, 45, lineY);
          lineY += 5;
        }
        startY = Math.max(40, lineY + 5);
      } catch (e) {
        console.error("Error adding image to PDF doc:", e);
        // Fallback
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(name, 14, 16);
        startY = 25;
      }
    } else {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(name, 14, 16);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      let lineY = 22;
      [
        [cnpj ? `CNPJ: ${cnpj}` : "", cityState].filter(Boolean).join(" | "),
        [address, phone].filter(Boolean).join(" - "),
        email,
        additional,
      ]
        .filter(Boolean)
        .forEach((d) => {
          doc.text(d, 14, lineY);
          lineY += 5;
        });
      startY = lineY + 5;
    }

    // Linha separadora
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(14, startY - 3, 196, startY - 3);

    // Título do Relatório
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, startY + 5);

    // Rodapé
    const pageHeight =
      doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    doc.setDrawColor(200);
    doc.line(14, pageHeight - 12, 196, pageHeight - 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Sistema SSVP ILPI - Emissão: ${dateStr}`, 14, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPages}`, 196, pageHeight - 7, {
      align: "right",
    });
    doc.setTextColor(0); // reseta cor
  }
};

export const getHtmlPrintHeader = async (
  settings: InstitutionSettings | null | undefined,
  title: string = "",
) => {
  const cfg = settings?.reportConfig;
  const name = cfg?.institutionName || settings?.name || "SSVP";
  const cnpj = cfg?.cnpj || settings?.cnpj || "";
  const address = cfg?.address || "";
  const phone = cfg?.phone || "";
  const email = cfg?.email || "";
  const cityState = cfg?.cityState || settings?.city || "";
  const additional = cfg?.additionalText || "";
  const logoUrl = cfg?.logoUrl || settings?.logoUrl || "";

  const base64Logo = await urlToBase64(logoUrl);

  return `
    <div class="print-header">
      <div class="header-logo">
        ${base64Logo ? `<img src="${base64Logo}" alt="Logo">` : ""}
      </div>
      <div class="header-info">
        <h1>${name}</h1>
        <p>${[cnpj ? "CNPJ: " + cnpj : "", cityState].filter(Boolean).join(" | ")}</p>
        <p>${[address, phone].filter(Boolean).join(" - ")}</p>
        <p>${email}</p>
        ${additional ? `<p class="additional-text">${additional}</p>` : ""}
      </div>
    </div>
    ${title ? `<div class="report-title">${title}</div>` : ""}
  `;
};

export const getHtmlPrintFooter = () => {
  const dateStr = new Date().toLocaleDateString("pt-BR");
  return `
    <div class="print-footer">
      <span>Sistema SSVP ILPI - Emissão: ${dateStr}</span>
    </div>
  `;
};

export const getHtmlPrintStyles = () => `
  @media print {
    @page { margin: 15mm; size: A4 portrait; }
    body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
  }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #000; line-height: 1.4; padding: 20px; }
  
  .print-header {
    display: flex;
    align-items: center;
    gap: 20px;
    border-bottom: 2px solid #000;
    padding-bottom: 15px;
    margin-bottom: 20px;
  }
  .print-header .header-logo img {
    max-width: 80px;
    max-height: 80px;
    object-fit: contain;
  }
  .print-header .header-info h1 {
    font-size: 18px;
    font-weight: bold;
    text-transform: uppercase;
    margin: 0 0 5px 0;
  }
  .print-header .header-info p {
    font-size: 10px;
    margin: 2px 0;
    color: #333;
  }
  .print-header .header-info .additional-text {
    font-size: 9px;
    font-style: italic;
    color: #666;
    margin-top: 4px;
  }
  
  .print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    border-top: 1px solid #ccc;
    padding-top: 10px;
    font-size: 9px;
    color: #555;
    text-align: center;
    background: #fff;
  }
  
  /* Utilities for the actual content */
  .report-title {
    font-size: 14px;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 20px;
    text-align: center;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; font-size: 10px; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
  th { background-color: #f0f0f0; font-weight: bold; text-transform: uppercase; }
  
  .flex-row { display: flex; flex-wrap: wrap; margin-bottom: 6px; }
  .flex-col { flex: 1; min-width: 30%; padding-right: 10px; box-sizing: border-box; }
  .flex-col-half { flex: 0 0 50%; padding-right: 10px; box-sizing: border-box; }
  .flex-col-full { flex: 0 0 100%; margin-bottom: 6px; box-sizing: border-box; }
  
  .label { font-weight: bold; color: #333; margin-right: 4px; }
  .value { border-bottom: 1px dotted #999; padding-bottom: 1px; flex: 1; }
  .field { display: flex; margin-bottom: 6px; align-items: baseline; }
  
  .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #000; border-bottom: 1px solid #000; margin-top: 20px; margin-bottom: 10px; padding-bottom: 2px; }
  .paragraph { text-align: justify; white-space: pre-wrap; font-size: 11px; margin-top: 5px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; }
  
  .signature-box { margin-top: 50px; text-align: center; }
  .signature-line { border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 5px; font-weight: bold; }
  .signature-role { font-size: 10px; color: #666; }
`;

export const printAttendanceHtmlPdf = async (
  attendance: any,
  resident: any,
  settings: any,
  area: string
) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const title = `Relatório de Atendimento - ${area}`;
  const headerHtml = await getHtmlPrintHeader(settings, title);
  
  const rawDate = attendance.dateTime || attendance.date;
  let dateStr = "";
  let timeStr = "";
  if (rawDate) {
    try {
      const dt = new Date(rawDate);
      if (!isNaN(dt.getTime())) {
        dateStr = dt.toLocaleDateString("pt-BR");
        // If it's a full ISO string (has T) or has hours
        if (rawDate.includes('T') || rawDate.includes(' ')) {
          timeStr = dt.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        }
      } else {
        dateStr = rawDate.split('T')[0].split('-').reverse().join('/');
      }
    } catch {
      dateStr = rawDate;
    }
  }

  const tipo = attendance.attendanceType || attendance.interventionType || attendance.reason || "Não especificado";
  const desc = attendance.descricaoAtendimento || attendance.attendanceEvolution || attendance.notes || "Sem descrição";
  
  let residentBirth = "";
  let residentAge = "";
  if (resident.birthDate) {
    const dt = new Date(resident.birthDate + 'T12:00:00');
    residentBirth = dt.toLocaleDateString("pt-BR");
  }
  if (resident.age) {
    residentAge = resident.age.toString();
  } else if (resident.birthDate) {
    const bd = new Date(resident.birthDate);
    const ageDifMs = Date.now() - bd.getTime();
    const ageDate = new Date(ageDifMs);
    residentAge = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
  }

  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          ${getHtmlPrintStyles()}
        </style>
      </head>
      <body>
        ${headerHtml}

        <h2 class="section-title">1. Dados do Residente</h2>
        <div class="flex-row">
          <div class="flex-col-full field">
            <span class="label">Nome Completo:</span>
            <span class="value">${resident.name || ""}</span>
          </div>
        </div>
        <div class="flex-row">
          <div class="flex-col field">
            <span class="label">Data de Nascimento:</span>
            <span class="value">${residentBirth}</span>
          </div>
          <div class="flex-col field">
            <span class="label">Idade:</span>
            <span class="value">${residentAge ? residentAge + ' anos' : ''}</span>
          </div>
        </div>

        <h2 class="section-title">2. Dados do Atendimento</h2>
        <div class="flex-row">
          <div class="flex-col field">
            <span class="label">Data:</span>
            <span class="value">${dateStr}</span>
          </div>
          <div class="flex-col field">
            <span class="label">Horário:</span>
            <span class="value">${timeStr || "N/A"}</span>
          </div>
        </div>
        <div class="flex-row">
          <div class="flex-col field">
            <span class="label">Área/Especialidade:</span>
            <span class="value">${area}</span>
          </div>
          <div class="flex-col field">
            <span class="label">Profissional Responsável:</span>
            <span class="value">${attendance.signature || "Não especificado"}</span>
          </div>
        </div>
        <div class="flex-row">
          <div class="flex-col-full field">
            <span class="label">Tipo/Motivo:</span>
            <span class="value">${tipo}</span>
          </div>
        </div>

        <h2 class="section-title">3. Descrição do Atendimento</h2>
        <div class="paragraph">${desc}</div>

        <div class="signature-box" style="margin-top: 50px; text-align: center;">
          <div class="signature-line" style="border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 5px; font-weight: bold;">
            ${(attendance.profissionalAssinaturaTexto || attendance.signature || "Assinatura do Profissional").replace(/\n/g, '<br/>')}
          </div>
          <div class="signature-role" style="font-size: 10px; color: #666; margin-top: 2px;">
            ${area}
          </div>
          <div class="signature-role" style="font-size: 10px; color: #666; margin-top: 2px;">
            ${dateStr}
          </div>
        </div>

        ${getHtmlPrintFooter()}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};


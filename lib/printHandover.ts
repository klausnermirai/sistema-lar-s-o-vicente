import { ShiftHandover, Resident, OperationalShift, InstitutionSettings, IncidentReport, ShiftProcedureLog } from '../types';
import { getHtmlPrintHeader, getHtmlPrintStyles, getHtmlPrintFooter } from './pdfHelpers';

export const printHandoverHtmlPdf = async (
  handover: ShiftHandover,
  logs: ShiftProcedureLog[],
  vitalSigns: any[],
  incidents: any[],
  settings: InstitutionSettings | null | undefined,
  professionalSignature: { name: string, role: string, doc: string }
) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const headerHtml = await getHtmlPrintHeader(settings, "Registro de Plantão e Intercorrências");
  
  const dateStr = handover.dataOperacional ? handover.dataOperacional.split('-').reverse().join('/') : '';
  const timestampStr = new Date(handover.timestamp).toLocaleString('pt-BR');

  const banhos = logs.filter(l => l.tipoProcedimento === 'banho');
  const higieneOral = logs.filter(l => l.tipoProcedimento === 'higiene_oral');
  const decubito = logs.filter(l => l.tipoProcedimento === 'decubito');
  const barbaTrico = logs.filter(l => l.tipoProcedimento === 'barba_trico');
  const unhas = logs.filter(l => l.tipoProcedimento === 'unhas');
  const fralda = logs.filter(l => l.tipoProcedimento === 'fralda');
  const alimentacao = logs.filter(l => l.tipoProcedimento === 'alimentacao');

  const getBanhosText = () => {
    if (banhos.length === 0) return "Nenhum registro de banho.";
    return `Total realizados: ${banhos.length}`;
  };

  const getHigieneOralText = () => {
    if (higieneOral.length === 0) return "Nenhum registro de higiene oral.";
    return `Realizados: ${higieneOral.length}`;
  };

  const getFraldasText = () => {
    if (fralda.length === 0) return "Nenhum registro de fralda.";
    return `Total de registros: ${fralda.length}`;
  };

  const getAlimentacaoText = () => {
    if (alimentacao.length === 0) return "Nenhum registro de alimentação.";
    return alimentacao.map(a => `${a.refeicaoNome || 'Refeição'}: ${a.horarioAproximado || 'S/hora'} (${Object.keys(a.registrosPorResidente || {}).length} registros)`).join('<br>');
  };

  const html = `
    <html>
      <head>
        <title>Plantão - ${handover.shift || handover.turnoNome}</title>
        <style>
          ${getHtmlPrintStyles()}
          .subtitle { text-align: center; font-size: 11px; color: #666; margin-top: -15px; margin-bottom: 20px; font-weight: bold; text-transform: uppercase; }
        </style>
      </head>
      <body>
        ${headerHtml}
        <div class="subtitle">Saúde e Cuidados / Passagem de Plantão</div>

        <div class="flex-row" style="margin-bottom: 20px;">
          <div class="flex-col-half field">
            <span class="label">Data operacional:</span>
            <span class="value">${dateStr}</span>
          </div>
          <div class="flex-col-half field">
            <span class="label">Turno:</span>
            <span class="value">${handover.shift || handover.turnoNome || 'Não especificado'}</span>
          </div>
          <div class="flex-col-half field">
            <span class="label">Registrado em:</span>
            <span class="value">${timestampStr}</span>
          </div>
          <div class="flex-col-half field">
            <span class="label">Responsável:</span>
            <span class="value">${handover.professionalName || professionalSignature.name}</span>
          </div>
          <div class="flex-col-half field">
            <span class="label">Função:</span>
            <span class="value">${professionalSignature.role || 'Não especificado'}</span>
          </div>
          <div class="flex-col-half field">
            <span class="label">Registro:</span>
            <span class="value">${professionalSignature.doc || 'Não especificado'}</span>
          </div>
        </div>

        <h2 class="section-title">1. Relatório do Plantão</h2>
        <div class="paragraph">${handover.summary || "Sem relatório registrado."}</div>

        <h2 class="section-title">2. Pendências para o Próximo Turno</h2>
        <div class="paragraph">${handover.pendingTasks || "Sem pendências registradas."}</div>

        <h2 class="section-title">3. Rotinas Registradas no Turno</h2>
        ${logs.length > 0 ? `
          <div class="flex-row">
            <div class="flex-col-full field">
              <span class="label">Banho:</span> <span class="value" style="border:none;">${getBanhosText()}</span>
            </div>
            <div class="flex-col-full field">
              <span class="label">Higiene oral:</span> <span class="value" style="border:none;">${getHigieneOralText()}</span>
            </div>
            <div class="flex-col-full field">
              <span class="label">Alimentação:</span> <span class="value" style="border:none;">${getAlimentacaoText()}</span>
            </div>
            <div class="flex-col-full field">
              <span class="label">Troca de fraldas:</span> <span class="value" style="border:none;">${getFraldasText()}</span>
            </div>
            <div class="flex-col-full field">
              <span class="label">Mudança de decúbito:</span> <span class="value" style="border:none;">Total de registros: ${decubito.length}</span>
            </div>
            <div class="flex-col-full field">
              <span class="label">Tricotomia / Barba:</span> <span class="value" style="border:none;">Total de registros: ${barbaTrico.length}</span>
            </div>
            <div class="flex-col-full field">
              <span class="label">Corte de Unhas:</span> <span class="value" style="border:none;">Total de registros: ${unhas.length}</span>
            </div>
          </div>
        ` : `
          <div class="paragraph" style="border:none; padding: 0;">Não há rotinas registradas para este turno.</div>
        `}

        <h2 class="section-title">4. Sinais Vitais Registrados</h2>
        ${vitalSigns.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Residente</th>
                <th>Horário</th>
                <th>Sinais</th>
              </tr>
            </thead>
            <tbody>
              ${vitalSigns.map(v => {
                const parts = [];
                if (v.paSystolic) parts.push('PA ' + v.paSystolic + 'x' + v.paDiastolic);
                if (v.hgtValue) parts.push('Glic ' + v.hgtValue);
                if (v.temperature) parts.push('Temp ' + v.temperature + '°');
                if (v.spo2) parts.push('SpO2 ' + v.spo2 + '%');
                if (v.fc) parts.push('FC ' + v.fc);
                if (v.fr) parts.push('FR ' + v.fr);
                
                const timeOnly = v.date ? new Date(v.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
                return `
                  <tr>
                    <td>${v.residentName}</td>
                    <td>${timeOnly}</td>
                    <td>${parts.join(', ')}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        ` : `
          <div class="paragraph" style="border:none; padding: 0;">Não há sinais vitais registrados para este turno.</div>
        `}

        <h2 class="section-title">5. Intercorrências</h2>
        ${incidents.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Residente</th>
                <th>Tipo</th>
                <th>Descrição / Conduta</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              ${incidents.map(inc => {
                const time = new Date(inc.timestamp).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return `
                  <tr>
                    <td style="white-space: nowrap;">${time}</td>
                    <td>${inc.residentName}</td>
                    <td><span style="text-transform: uppercase;">${inc.type}</span></td>
                    <td>
                      <b>Desc:</b> ${inc.description}<br/>
                      <b>Conduta:</b> ${inc.conduct || ''}
                    </td>
                    <td>${inc.professionalName || ''}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : `
          <div class="paragraph" style="border:none; padding: 0;">Sem intercorrências registradas.</div>
        `}

        <div class="signature-box">
          <div class="signature-line">
            ${handover.professionalName || professionalSignature.name || "Profissional não identificado"}
          </div>
          <div class="signature-role">
            ${professionalSignature.role || ''} ${professionalSignature.doc ? '— ' + professionalSignature.doc : ''}
          </div>
          <div class="signature-role">
            Responsável pelo registro do plantão
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

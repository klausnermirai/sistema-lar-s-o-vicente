import { generateRoutinesSummaryText } from './routineSummaryHelper';
import { ShiftHandover, Resident, OperationalShift, InstitutionSettings, IncidentReport, ShiftProcedureLog } from '../types.ts';
import { getHtmlPrintHeader, getHtmlPrintStyles, getHtmlPrintFooter, printHtml } from './pdfHelpers';

export const printHandoverHtmlPdf = async (
  handover: ShiftHandover,
  logs: ShiftProcedureLog[],
  vitalSigns: any[],
  incidents: any[],
  settings: InstitutionSettings | null | undefined,
  professionalSignature: { name: string, role: string, doc: string },
  residents: Resident[] = [] // added residents param with fallback
) => {
  // Removed direct window.open setup to use printHtml export

  const headerHtml = await getHtmlPrintHeader(settings, "Registro de Plantão e Intercorrências");
  
  const dateStr = handover.dataOperacional ? handover.dataOperacional.split('-').reverse().join('/') : '';
  const timestampStr = new Date(handover.timestamp).toLocaleString('pt-BR');

  const routinesText = generateRoutinesSummaryText(logs, residents, handover.dataOperacional || '');

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
        <div class="print-wrapper">
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

        <h2 class="section-title">3. Rotinas do Dia e Turno</h2>
        <div class="paragraph" style="white-space: pre-wrap; font-family: monospace; font-size: 11px;">${routinesText}</div>

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
        </div>

        ${getHtmlPrintFooter()}
      </body>
    </html>
  `;

  printHtml(html);
};

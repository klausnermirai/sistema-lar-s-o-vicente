import React, { useState } from 'react';
import { FileText, Printer, RefreshCcw } from 'lucide-react';
import { apiFetch, getAuthHeaders } from '../lib/api';
import { getHtmlPrintHeader, getHtmlPrintFooter, getHtmlPrintStyles, printHtml } from '../lib/pdfHelpers';
import type { InstitutionSettings } from '../types';

interface Props { institutionId: string; accessLevel?: string; settings: InstitutionSettings | null; }
const esc = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
const rows = (values: Record<string, number> = {}) => Object.entries(values).map(([name, count]) => `<tr><td>${esc(name)}</td><td style="text-align:right">${count}</td></tr>`).join('') || '<tr><td colspan="2">Sem registros no período</td></tr>';
const formatDate = (date: string) => date.split('-').reverse().join('/');
const current = new Date();
const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
const localDate = (d: Date) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');

export const InstitutionalActivitiesReport: React.FC<Props> = ({ institutionId, accessLevel, settings }) => {
  const [dateFrom, setDateFrom] = useState(localDate(firstDay));
  const [dateTo, setDateTo] = useState(localDate(current));
  const canInternal = ['administrador','gerencial'].includes(String(accessLevel || '').trim().toLowerCase().replace(/[\s-]+/g,'_'));
  const [mode, setMode] = useState<'institutional'|'internal'>('institutional');
  const [results, setResults] = useState('');
  const [challenges, setChallenges] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    if (!institutionId || !dateFrom || !dateTo || dateFrom > dateTo) { setError('Informe um período válido.'); return; }
    setLoading(true); setError(''); setData(null);
    try {
      const query = new URLSearchParams({ institutionId, dateFrom, dateTo, mode });
      const response = await apiFetch(`/api/reports/institutional-activities?${query}`, { headers: getAuthHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível consultar os indicadores.');
      setData(body);
    } catch (err: any) { setError(err.message || 'Falha ao consultar relatório.'); }
    finally { setLoading(false); }
  };

  const printReport = async () => {
    if (!data) return;
    const header = await getHtmlPrintHeader(settings, 'Relatório Institucional de Atividades');
    const professional = Object.entries(data.professional || {}).map(([area, v]: [string, any]) =>
      `<tr><td>${esc(area)}</td><td>${v.registered}</td><td>${v.recordedPerformances}</td><td>${v.notPerformed}</td><td>${v.evolutions}</td><td>${v.initialAssessments}</td></tr>`).join('');
    const narrative = [
      ['Resultados e atividades relevantes', results],
      ['Dificuldades e necessidades', challenges],
      ['Considerações finais e encaminhamentos', conclusion]
    ].filter(([,txt])=>String(txt).trim()).map(([title,txt])=>`<h3>${esc(title)}</h3><p style="white-space:pre-wrap">${esc(txt)}</p>`).join('');
    const highlights = (data.groupActivities?.highlights || []).map((activity:any) =>
      `<tr><td>${esc(formatDate(activity.date || ''))}</td><td>${esc(activity.competence)}</td><td>${esc(activity.type)}</td><td>${esc(activity.professional)}</td></tr>`).join('');
    const ranking = (data.incidents?.topFive || []).map((item:any,i:number) =>
      `<tr><td>${i+1}º</td><td>${esc(mode === 'internal' ? item.name : 'Identificação reservada')}</td><td>${item.count}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${getHtmlPrintStyles()}
      body{font-family:Arial,sans-serif;color:#172033;padding:18px;font-size:12px}
      h2{color:#004c99;border-bottom:1px solid #ccc;padding-bottom:5px;margin-top:22px}
      h3{color:#24364b;margin-top:16px}table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #d9e1e8;padding:7px;vertical-align:top}
      th{background:#edf3f8;text-align:left}p{line-height:1.5}
      .methodology{font-size:10px;color:#555}.report-section{break-inside:avoid}
      </style></head><body>
      ${header}
      <p><strong>Período:</strong> ${formatDate(dateFrom)} a ${formatDate(dateTo)}
      | <strong>Modalidade:</strong> ${mode === 'internal' ? 'Interna — uso restrito' : 'Institucional'}</p>
      <h2>1. Produção por área profissional</h2>
      <table><tr><th>Área</th><th>Registros</th><th>Produção registrada*</th><th>Recusas / não realizados</th><th>Evoluções</th><th>Avaliações iniciais</th></tr>${professional}</table>
      <p class="methodology">*Produção documental identificada. Modalidades não padronizadas devem ser conferidas antes de utilização externa. Avaliações e evoluções não são somadas aos atendimentos.</p>
      <h2>2. Atividades coletivas</h2>
      <p><strong>Realizadas:</strong> ${data.groupActivities?.total || 0}. <strong>Participações identificadas:</strong> ${data.groupActivities?.knownParticipations || 0}. <strong>Eventos sem lista histórica completa:</strong> ${data.groupActivities?.eventsWithoutParticipantList || 0}.</p>
      <table><tr><th>Área</th><th>Atividades</th></tr>${rows(data.groupActivities?.byArea)}</table>
      ${highlights ? `<h3>Atividades registradas (até 25 eventos)</h3><table><tr><th>Data</th><th>Área</th><th>Atividade</th><th>Profissional</th></tr>${highlights}</table>` : ''}
      <h2>3. Serviço Social</h2>
      <p><strong>Registros de ações:</strong> ${data.socialWork?.total || 0}. Informações sigilosas e textos de prontuário não são exibidos.</p>
      <table><tr><th>Tipo de ação</th><th>Quantidade</th></tr>${rows(data.socialWork?.byType)}</table>
      <h2>4. Triagem e movimentação institucional</h2>
      <p>Cadastros/agendamentos de candidatos datados no período: <strong>${data.screening?.newContacts || 0}</strong>.
      Visitas sociais datadas: <strong>${data.screening?.socialVisits || 0}</strong>.
      Triagens concluídas: <strong>não disponível para apuração confiável</strong>.</p>
      <p>Novos acolhimentos por data de admissão: <strong>${data.residentMovement?.admissions || 0}</strong>.
      Encerramentos registrados: <strong>${data.residentMovement?.recordedClosures || 0}</strong>.</p>
      <table><tr><th>Motivo de encerramento</th><th>Quantidade</th></tr>${rows(data.residentMovement?.closureReasons)}</table>
      <p class="methodology">${esc(data.residentMovement?.description)}</p>
      <h2>5. Intercorrências</h2>
      <p><strong>Ocorrências distintas:</strong> ${data.incidents?.total || 0}. O mesmo evento com dois residentes conta uma vez no total institucional.</p>
      <table><tr><th>Categoria</th><th>Quantidade</th></tr>${rows(data.incidents?.byType)}</table>
      <h3>Residentes com maior número de intercorrências — Top 5</h3>
      <table><tr><th>Posição</th><th>Residente</th><th>Ocorrências</th></tr>${ranking}</table>
      <p class="methodology">${mode === 'internal' ? 'Documento nominal de uso restrito à gestão.' : 'Identidades omitidas nesta modalidade. Ranking detalhado disponível apenas no relatório interno.'}</p>
      <h2>6. Análise institucional do período</h2>
      ${narrative || '<p>Nenhuma consideração qualitativa informada.</p>'}
      <h2>Metodologia</h2><div class="methodology">${(data.methodology || []).map((line:string)=>`<p>${esc(line)}</p>`).join('')}</div>
      ${getHtmlPrintFooter()}</body></html>`;
    printHtml(html);
  };

  return <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-5">
    <div className="flex items-center gap-3"><FileText size={24} className="text-[#004c99]"/><div><h1 className="text-xl font-black">Relatório Institucional de Atividades</h1><p className="text-sm text-gray-500">Indicadores e síntese de atividades por período</p></div></div>
    <div className="flex flex-wrap gap-4 items-end">
      <label className="text-sm font-semibold">Data inicial<input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setData(null);}} className="block mt-1 p-2 border rounded-lg"/></label>
      <label className="text-sm font-semibold">Data final<input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setData(null);}} className="block mt-1 p-2 border rounded-lg"/></label>
      <label className="text-sm font-semibold">Modalidade<select className="block mt-1 p-2 border rounded-lg" value={mode} onChange={e=>{setMode(e.target.value as any);setData(null);}}>
        <option value="institutional">Institucional (sem nomes)</option>{canInternal && <option value="internal">Interna (ranking nominal)</option>}
      </select></label>
      <button type="button" disabled={loading} onClick={fetchReport} className="flex items-center gap-2 rounded-lg px-4 py-2 bg-[#004c99] text-white font-bold disabled:opacity-50"><RefreshCcw size={16}/> {loading ? 'Consultando…' : 'Gerar indicadores'}</button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {data && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Atividades em grupo',data.groupActivities.total],
          ['Registros do Serviço Social',data.socialWork.total],
          ['Acolhimentos',data.residentMovement.admissions],
          ['Intercorrências',data.incidents.total]
        ].map(([label,value])=><div key={String(label)} className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-black">{value}</p></div>)}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Área</th><th className="p-2">Registros</th><th className="p-2">Produção documental*</th><th className="p-2">Recusas</th></tr></thead><tbody>
        {Object.entries(data.professional).map(([area, info]:[string,any])=><tr key={area} className="border-b"><td className="p-2">{area}</td><td className="p-2">{info.registered}</td><td className="p-2">{info.recordedPerformances}</td><td className="p-2">{info.notPerformed}</td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-slate-600">*Os indicadores descrevem lançamentos documentais, não certificam a realização de todas as modalidades. A classificação de recusas depende dos campos preenchidos.</p>
      <p className="text-sm text-slate-600">Triagens concluídas: não disponível para apuração confiável. Encerramentos: contados pela data registrada de arquivamento.</p>
      {mode === 'internal' && <div className="text-sm"><h2 className="font-bold">Top 5 — Intercorrências</h2>{data.incidents.topFive.map((v:any,i:number)=><p key={i}>{i+1}º {v.name}: {v.count}</p>)}</div>}
      <h2 className="font-bold pt-2">Análise do período (preenchimento opcional)</h2>
      {[
        ['Resultados e atividades relevantes',results,setResults],
        ['Dificuldades e necessidades',challenges,setChallenges],
        ['Considerações finais e encaminhamentos',conclusion,setConclusion]
      ].map(([label,value,setValue]:any)=><label key={label} className="block text-sm font-semibold">{label}<textarea rows={3} value={value} onChange={e=>setValue(e.target.value)} className="w-full mt-1 p-2 border rounded-xl"/></label>)}
      <button type="button" onClick={printReport} className="inline-flex items-center gap-2 bg-[#004c99] text-white px-5 py-3 rounded-xl font-bold"><Printer size={18}/> Imprimir / Salvar PDF</button>
    </>}
  </section>;
};

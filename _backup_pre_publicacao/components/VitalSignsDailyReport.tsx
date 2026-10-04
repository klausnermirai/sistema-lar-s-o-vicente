import React, { useState } from 'react';
import { ChevronLeft, FileText } from 'lucide-react';
import { Resident } from '../types';

interface VitalSignsDailyReportProps {
  residents: Resident[];
  onBack: () => void;
}

export const VitalSignsDailyReport: React.FC<VitalSignsDailyReportProps> = ({ residents, onBack }) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const allRecords = residents.flatMap(r => 
    (r.per?.vitalSignsHistory || []).map(record => ({ ...record, residentName: r.name }))
  ).filter(r => new Date(r.date).toISOString().split('T')[0] === selectedDate)
   .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Logs temporários para diagnóstico
  console.log("Data do relatório diário:", selectedDate);
  console.log("Registros do relatório diário:", allRecords);

  return (
    <div className="flex flex-col h-full bg-gray-50/10">
      <div className="p-8 border-b bg-white shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-full">Relatório</span>
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Relatório do Dia</h2>
            </div>
            <p className="text-sm text-gray-500 font-medium max-w-2xl">
              Consulte todos os sinais vitais registrados nesta data.
            </p>
          </div>
          <button 
            onClick={onBack}
            className="w-12 h-12 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center transition-all"
          >
            <ChevronLeft size={24} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {allRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
               <FileText className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-500 font-medium text-lg text-center">Nenhum sinal vital registrado para esta data.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Residente</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Horário</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Glicose</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">PA</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">FC</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Sat. O2</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Temp.</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Peso/Alt.</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allRecords.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-xs font-black text-emerald-700 uppercase tracking-tighter">{record.residentName}</td>
                      <td className="p-4 text-xs font-bold text-gray-600">
                        {new Date(record.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-700">
                        {record.hgtValue ? `${record.hgtValue} (${record.hgtType === 'jejum' ? 'J' : 'PP'})` : '-'}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-700">
                        {record.paSystolic ? `${record.paSystolic}x${record.paDiastolic}` : '-'}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-700">
                        {record.fc ? `${record.fc}` : '-'}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-700">
                        {record.spo2 ? `${record.spo2}` : '-'}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-700">
                        {record.temperature ? `${record.temperature}` : '-'}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-700">
                        {record.weight ? `${record.weight}` : '-'}
                        {record.height ? ` / ${record.height}` : ''}
                      </td>
                      <td className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {record.professionalName || 'S/ Assinatura'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { X, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, ChevronRight, Save } from 'lucide-react';
import { Resident, OperationalShift, Medication } from '../types';
import { fetchShifts } from '../lib/api';

interface ImportPrescriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  residents: Resident[];
  institutionId: string;
  onConfirmImport: (medicationsUpdate: Record<string, Medication[]>) => Promise<void>; // Grouped by residentId
}

interface PreviewRow {
  index: number;
  originalResident: string;
  originalName: string; // medicamento
  originalTime: string;
  originalShiftFile: string;
  originalFrequency: string;
  originalRoute: string; // via
  originalStatus: string;
  importOrigin: string; // origem do pdf/csv
  originPage: string; 
  importComments: string;

  matchedResidentId?: string;
  matchedResidentName?: string;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';

  shiftIdCalculated?: string;
  shiftNameCalculated?: string;
  
  isValid: boolean;
  duplicateWarning?: boolean;
}

export const ImportPrescriptionsModal: React.FC<ImportPrescriptionsModalProps> = ({ isOpen, onClose, residents, institutionId, onConfirmImport }) => {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shifts, setShifts] = useState<OperationalShift[]>([]);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && institutionId) {
      fetchShifts(institutionId).then(data => {
        setShifts(data || []);
      }).catch(err => console.error("Could not fetch shifts", err));
    } else {
      setStep(1);
      setPreviewData([]);
    }
  }, [isOpen, institutionId]);

  if (!isOpen) return null;

  const getMatchByResident = (rowCpf: string, rowRg: string, rowName: string) => {
    if (!rowName) return { id: undefined, name: undefined, confidence: 'none' as const };
    
    // 1. Exact CPF
    if (rowCpf) {
      const match = residents.find(r => r.cpf && r.cpf.replace(/\D/g, '') === rowCpf.replace(/\D/g, ''));
      if (match) return { id: match.id, name: match.name, confidence: 'high' as const };
    }
    // 2. Exact RG
    if (rowRg) {
      const match = residents.find(r => r.rg && r.rg.replace(/\D/g, '') === rowRg.replace(/\D/g, ''));
      if (match) return { id: match.id, name: match.name, confidence: 'high' as const };
    }

    // 3. Name Match
    const cleanRowName = rowName.toLowerCase().trim();
    // exact name
    let match = residents.find(r => r.name.toLowerCase().trim() === cleanRowName);
    if (match) return { id: match.id, name: match.name, confidence: 'high' as const };
    
    // substring name (more than 5 letters matching)
    match = residents.find(r => r.name.toLowerCase().includes(cleanRowName) || cleanRowName.includes(r.name.toLowerCase()));
    if (match) return { id: match.id, name: match.name, confidence: 'medium' as const };

    return { id: undefined, name: undefined, confidence: 'none' as const };
  };

  const getCalculateShift = (timeStr: string) => {
    if (!timeStr || shifts.length === 0) return { id: undefined, name: undefined };
    // Basic logic: convert timeStr to minutes, find shift
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h)) return { id: undefined, name: undefined };
    const mins = h * 60 + (m || 0);

    for (const shift of shifts) {
      if (shift.horarioInicio && shift.horarioFim) {
        const [sh, sm] = shift.horarioInicio.split(':').map(Number);
        const startMins = sh * 60 + (sm || 0);
        const [eh, em] = shift.horarioFim.split(':').map(Number);
        const endMins = eh * 60 + (em || 0);

        if (endMins < startMins) {
           // crosses midnight
           if (mins >= startMins || mins <= endMins) return { id: shift.id, name: shift.nomeTurno };
        } else {
           if (mins >= startMins && mins <= endMins) return { id: shift.id, name: shift.nomeTurno };
        }
      }
    }
    return { id: undefined, name: undefined };
  };

  const checkDuplicate = (residentId: string, medName: string, time: string) => {
    const resident = residents.find(r => r.id === residentId);
    if (!resident || !resident.medications) return false;
    const cleanNm = medName.toLowerCase().trim();
    return resident.medications.some(m => 
      m.name.toLowerCase().trim() === cleanNm && 
      m.times.includes(time)
    );
  };

  const processData = (data: any[]) => {
    const processed: PreviewRow[] = data.map((row, i) => {
      const resName = row['residente'] || row['Residente'] || '';
      const cpf = row['cpf'] || row['CPF'] || '';
      const rg = row['rg_rne'] || row['RG'] || '';
      const medName = row['medicamento_prescrito'] || row['Medicamento'] || '';
      const time = row['horario'] || row['Horário'] || row['Horario'] || '';
      
      const match = getMatchByResident(cpf, rg, resName);
      const shiftMatch = getCalculateShift(time);
      
      const isDuplicate = match.id ? checkDuplicate(match.id, medName, time) : false;

      return {
        index: i,
        originalResident: resName,
        originalName: medName,
        originalTime: time,
        originalShiftFile: row['turno'] || row['Turno'] || '',
        originalFrequency: row['frequencia'] || row['Frequência'] || '',
        originalRoute: row['via'] || row['Via'] || '',
        originalStatus: row['status'] || row['Status'] || '',
        importOrigin: row['origem'] || row['Origem'] || 'Arquivo Genérico',
        originPage: row['pagina_origem'] || row['Página'] || '',
        importComments: row['observacoes_importacao'] || row['Observações'] || '',
        
        matchedResidentId: match.id,
        matchedResidentName: match.name,
        matchConfidence: match.confidence,

        shiftIdCalculated: shiftMatch.id,
        shiftNameCalculated: shiftMatch.name,
        
        isValid: !!match.id && !!medName && !!time,
        duplicateWarning: isDuplicate
      };
    });

    setPreviewData(processed);
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processData(data);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const validRows = previewData.filter(r => r.isValid && r.matchedResidentId);
      
      // Group by resident
      const updatesByResident: Record<string, Medication[]> = {};
      
      validRows.forEach(row => {
        if (!row.matchedResidentId) return;
        if (!updatesByResident[row.matchedResidentId]) {
           const existing = residents.find(r => r.id === row.matchedResidentId)?.medications || [];
           updatesByResident[row.matchedResidentId] = [...existing];
        }

        // Add new med
        const newMed: Medication = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: row.originalName,
          concentration: '', // Usually not split in OCR yet
          dose: '',
          frequency: parseInt(row.originalFrequency) || 1,
          times: [row.originalTime],
          type: 'continuo',
          startDate: new Date().toISOString().split('T')[0],
          route: row.originalRoute,
          shiftIdCalculated: row.shiftIdCalculated,
          shiftNameCalculated: row.shiftNameCalculated,
          originalShiftFile: row.originalShiftFile,
          originalResidentNameFile: row.originalResident,
          importOrigin: row.importOrigin,
          originPage: row.originPage,
          importObservations: row.importComments,
          reviewed: false, // MANDATORY requirement
          lastUpdate: new Date().toISOString()
        };

        updatesByResident[row.matchedResidentId].push(newMed);
      });

      await onConfirmImport(updatesByResident);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao importar.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMatch = (index: number, residentId: string) => {
     setPreviewData(prev => prev.map((item, i) => {
        if (i !== index) return item;
        const res = residents.find(r => r.id === residentId);
        return {
           ...item,
           matchedResidentId: residentId,
           matchedResidentName: res?.name,
           matchConfidence: 'high',
           isValid: !!residentId && !!item.originalName && !!item.originalTime,
           duplicateWarning: residentId ? checkDuplicate(residentId, item.originalName, item.originalTime) : false
        };
     }));
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-6 border-b flex items-center justify-between shrink-0 bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Importar Prescrições</h2>
              <p className="text-xs text-gray-500 font-medium">Arquivos suportados: CSV, XLSX</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          
          {step === 1 && (
             <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-[30px] p-10 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}>
               <input 
                 type="file" 
                 accept=".csv,.xlsx" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload}
                 className="hidden" 
               />
               <Upload size={48} className="text-gray-400 group-hover:text-blue-500 mb-6 transition-colors" />
               <p className="text-lg font-black uppercase text-gray-700 tracking-tight mb-2">Clique para selecionar o arquivo</p>
               <p className="text-xs text-gray-500 max-w-md text-center leading-relaxed font-medium">
                 O arquivo deve conter as colunas: <br/> <strong className="text-gray-700">residente, medicamento_prescrito, horario, turno, frequencia, via</strong>. Opcionais: cpf, rg, origem, etc.
               </p>
             </div>
          )}

          {step === 2 && (
             <div className="flex flex-col gap-6">
                <div className="flex bg-blue-50 p-4 border border-blue-100 rounded-2xl gap-4 items-center">
                   <AlertCircle className="text-blue-600" size={24} />
                   <div>
                     <p className="text-sm font-black uppercase tracking-tight text-blue-800">Conferência de Importação</p>
                     <p className="text-xs text-blue-700/80">Revise os vínculos automáticos. Registros que não puderam ser vinculados precisam de ajuste manual. Linhas laranjas indicam possível duplicidade.</p>
                   </div>
                </div>

                <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">Ação</th>
                          <th className="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b whitespace-nowrap">Residente (Arquivo)</th>
                          <th className="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b min-w-[200px]">Residente Vinculado (Sistema)</th>
                          <th className="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b min-w-[200px]">Medicamento</th>
                          <th className="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">Horário</th>
                          <th className="p-4 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b min-w-[150px]">Turno (Calculado)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row) => (
                           <tr key={row.index} className={`hover:bg-gray-50 align-top transition-colors border-b last:border-b-0 ${row.duplicateWarning ? 'bg-orange-50/50' : ''}`}>
                             <td className="p-4">
                                {row.isValid ? (
                                   row.duplicateWarning ? (
                                     <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 uppercase"><AlertCircle size={12}/> Duplicado?</span>
                                   ) : (
                                     <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase"><CheckCircle2 size={12}/> Válido</span>
                                   )
                                ) : (
                                   <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase"><AlertCircle size={12}/> Inválido</span>
                                )}
                             </td>
                             <td className="p-4 text-xs font-medium text-gray-700">{row.originalResident}</td>
                             <td className="p-4">
                               <select 
                                 className={`w-full p-2 text-xs font-bold uppercase rounded-lg border outline-none ${
                                   row.matchConfidence === 'high' ? 'bg-green-50 border-green-200 text-green-800' :
                                   row.matchConfidence === 'medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                   row.matchedResidentId ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200 text-red-800'
                                 }`}
                                 value={row.matchedResidentId || ''}
                                 onChange={e => updateMatch(row.index, e.target.value)}
                               >
                                 <option value="">-- SELECIONAR --</option>
                                 {residents.map(r => (
                                   <option key={r.id} value={r.id}>{r.name} (CPF: {r.cpf || 'N/A'})</option>
                                 ))}
                               </select>
                             </td>
                             <td className="p-4 text-xs font-bold text-gray-800 uppercase">{row.originalName}</td>
                             <td className="p-4 text-xs text-gray-600">{row.originalTime}</td>
                             <td className="p-4 text-[10px] font-bold uppercase text-gray-500">
                               {row.shiftNameCalculated ? (
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{row.shiftNameCalculated}</span>
                               ) : row.originalTime ? (
                                  <span className="text-gray-400">Sem turno atrelado</span>
                               ) : '-'}
                             </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t bg-gray-50/50 shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
             {step === 2 && `${previewData.filter(p => p.isValid).length} registros válidos para importar`}
          </p>
          <div className="flex gap-4">
             <button onClick={onClose} className="px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 transition-colors">
               Cancelar
             </button>
             {step === 2 && (
               <button 
                 onClick={handleConfirm}
                 disabled={isProcessing}
                 className="px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-[#004c99] text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
               >
                 <Save size={16} /> {isProcessing ? 'Importando...' : 'Confirmar Importação'}
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

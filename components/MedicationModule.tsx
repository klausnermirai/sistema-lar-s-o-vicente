import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { addPdfSignatureNode } from '../lib/pdfUtils';

import 'jspdf-autotable';
import { Pill, Package, Clock, Users, CheckCircle2, AlertCircle, Plus, Search, Calendar, ChevronRight } from 'lucide-react';
import { Resident, MedicationProduct, MedicationSeparationLog, MedicationAdministrationLog, Medication } from '../types';
import MedicationTab from './MedicationTab';
import { ImportPrescriptionsModal } from './ImportPrescriptionsModal';
import { IndividualInventoryTab } from './IndividualInventoryTab';
import { IndividualAdministrationTab } from './IndividualAdministrationTab';
import { IndividualSeparationTab } from './IndividualSeparationTab';
import { fetchInventory, bulkSaveInventory } from '../lib/api';
import { addPdfHeaderAndFooter } from '../lib/pdfHelpers';
import { InstitutionSettings } from '../types';

interface MedicationModuleProps {
  residents: Resident[];
  session: any;
  onSaveResident?: (resident: Resident) => void;
  onBulkSaveResidents?: (residents: Resident[]) => Promise<void>;
  settings?: InstitutionSettings | null;
  onPostToMural?: any;
}

const MODULES = [
  { id: 'prescricao', label: 'Prescrição', icon: Users },
  { id: 'estoque', label: 'Estoque / Cadastro', icon: Package },
  { id: 'separacao', label: 'Separação', icon: AlertCircle },
  { id: 'ministracao', label: 'Ministração', icon: CheckCircle2 }
] as const;

export const MedicationModule: React.FC<MedicationModuleProps> = ({ residents, session, onSaveResident, onBulkSaveResidents, settings, onPostToMural }) => {
  const [activeTab, setActiveTab] = useState<typeof MODULES[number]['id']>('prescricao');

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#004c99]/10 rounded-2xl flex items-center justify-center">
            <Pill className="text-[#004c99]" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-tight">Controle de Medicação</h1>
            <p className="text-xs text-gray-500 font-medium">Gestão individual, estoque por prescrição e prontuário de ministração</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-4 bg-white border-b shrink-0 flex gap-6 overflow-x-auto">
        {MODULES.map(m => {
          const Icon = m.icon;
          const isActive = activeTab === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              className={`pb-4 px-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                isActive ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={16} /> {m.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        {activeTab === 'prescricao' && (
          <PrescriptionListTab residents={residents} onSaveResident={onSaveResident!} onPostToMural={onPostToMural} session={session} onBulkSaveResidents={onBulkSaveResidents} />
        )}
        {activeTab === 'estoque' && (
          <IndividualInventoryTab residents={residents} session={session} settings={settings} />
        )}
        {activeTab === 'separacao' && (
          <IndividualSeparationTab residents={residents} session={session} settings={settings} />
        )}
        {activeTab === 'ministracao' && (
          <IndividualAdministrationTab residents={residents} session={session} />
        )}
      </div>
    </div>
  );
};

const InventoryTab: React.FC<{ inventory: MedicationProduct[], setInventory: (inv: MedicationProduct[]) => void, residents: Resident[], settings?: InstitutionSettings | null }> = ({ inventory, setInventory, residents, settings }) => {
  const [view, setView] = useState<'geral' | 'por_idoso' | 'sugestoes'>('geral');
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isExitOpen, setIsExitOpen] = useState(false);
  const [entryResidentId, setEntryResidentId] = useState(residents[0]?.id || '');
  const [entryMedName, setEntryMedName] = useState('');
  const [entryMedConcentration, setEntryMedConcentration] = useState('');
  const [entryMedForm, setEntryMedForm] = useState('Comprimido');
  const [quantity, setQuantity] = useState('');
  const [exitReason, setExitReason] = useState('vencimento');
  const [origin, setOrigin] = useState<'Comprado'|'Doação'|'Prefeitura'|'Alto Custo'>('Comprado');

  const getTotalStock = (item: MedicationProduct) => {
    return Object.values(item.residentStock || {}).reduce((a,b) => Number(a)+Number(b), 0);
  };

  const handleEntryMedNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchName = e.target.value;
    const allMeds = JSON.parse(localStorage.getItem('susMedicationsFull') || '[]');
    const match = allMeds.find((m: any) => `${m.name} - ${m.concentration}` === searchName || m.name === searchName);
    
    if (match) {
      setEntryMedName(match.name);
      setEntryMedConcentration(match.concentration || '');
      setEntryMedForm(match.form || 'Comprimido');
    } else {
      setEntryMedName(searchName);
    }
  };

  const handleEntry = () => {
    if (!entryMedName || !quantity || !entryResidentId) return;
    
    const existingMed = inventory.find(i => 
       i.name.toLowerCase() === entryMedName.toLowerCase() && 
       i.concentration.toLowerCase() === entryMedConcentration.toLowerCase()
    );

    let finalInventory = [...inventory];
    let targetMedId = '';

    if (existingMed) {
      targetMedId = existingMed.id;
    } else {
      targetMedId = Math.random().toString(36).substr(2, 9);
      finalInventory.push({
        id: targetMedId,
        name: entryMedName,
        concentration: entryMedConcentration,
        form: entryMedForm as any,
        institutionStock: 0,
        residentStock: {},
        minimumStock: 20
      });
    }

    setInventory(finalInventory.map(item => {
      if(item.id === targetMedId) {
         const newResStock = { ...(item.residentStock || {}) };
         newResStock[entryResidentId] = (newResStock[entryResidentId] || 0) + Number(quantity);
         return { ...item, residentStock: newResStock, lastRestockDate: new Date().toISOString() };
      }
      return item;
    }));
    
    setIsEntryOpen(false);
    setQuantity('');
    setEntryMedName('');
    setEntryMedConcentration('');
  };

  const handleExit = () => {
    if (!entryMedName || !quantity || !entryResidentId) return;
    const q = parseInt(quantity);
    if (isNaN(q) || q <= 0) return;

    setInventory(inventory.map(item => {
      if (item.name === entryMedName && (!entryMedConcentration || item.concentration === entryMedConcentration)) {
           const currentStock = item.residentStock[entryResidentId] || 0;
           return { 
             ...item, 
             residentStock: { 
               ...item.residentStock, 
               [entryResidentId]: Math.max(0, currentStock - q) 
             } 
           };
      }
      return item;
    }));
    
    setIsExitOpen(false);
    setQuantity('');
    setEntryMedName('');
    setEntryMedConcentration('');
  };

  const exportInventoryPDF = async () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    
    // Add title
    doc.setFontSize(18);
    doc.text(`Relatório de Estoque - ${view === 'geral' ? 'Geral' : view === 'por_idoso' ? 'Por Idoso' : 'Sugestões de Compra'}`, 40, 60);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 40, 80);

    let head: any[] = [[]];
    let body: any[] = [[]];

    if (view === 'geral') {
      head = [['Medicamento', 'Forma', 'Estoque Total (Dos Idosos)', 'Mínimo']];
      body = inventory.map(item => {
        return [
          `${item.name} (${item.concentration})`,
          item.form,
          getTotalStock(item).toString(),
          item.minimumStock?.toString() || '0'
        ];
      });
    } else if (view === 'por_idoso') {
       head = [['Residente', 'Medicamento', 'Forma', 'Quantidade']];
       const rows: any[] = [];
       residents.forEach(resident => {
          inventory.forEach(item => {
            const stock = item.residentStock?.[resident.id];
            if (stock && stock > 0) {
              rows.push([
                resident.name,
                `${item.name} (${item.concentration})`,
                item.form,
                stock.toString()
              ]);
            }
          });
       });
       body = rows;
    } else if (view === 'sugestoes') {
       head = [['Medicamento', 'Forma', 'Estoque Total', 'Estoque Mínimo']];
       body = inventory
        .filter(item => getTotalStock(item) <= (item.minimumStock || 0))
        .map(item => [
          `${item.name} (${item.concentration})`,
          item.form,
          getTotalStock(item).toString(),
          item.minimumStock?.toString() || '0'
        ]);
    }

    (doc as any).autoTable({
      startY: 100,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [0, 76, 153], textColor: [255, 255, 255] },
      margin: { top: 45, bottom: 20 }
    });

    await addPdfHeaderAndFooter(doc, settings, `Relatório de Estoque - ${view === 'todos' ? 'Todos' : view === 'baixo' ? 'Baixo Estoque' : 'Vencidos/Próximos'}`);
    addPdfSignatureNode(doc);
    doc.save(`estoque_${view}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="bg-white rounded-[40px] shadow-sm border p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Estoque de Medicamentos</h2>
          <p className="text-[11px] text-gray-500">Controle o inventário geral e individual</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportInventoryPDF}
            className="px-4 py-3 bg-white text-[#004c99] border hover:bg-blue-50 border-[#004c99] rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
          >
            Exportar PDF
          </button>
          <button 
            onClick={() => setIsExitOpen(true)}
            className="px-4 py-3 bg-white text-red-600 border border-red-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 transition-colors"
          >
            Saída Manual
          </button>
          <button 
            onClick={() => setIsEntryOpen(true)}
            className="px-4 py-3 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-800 transition-colors"
          >
            <Plus size={16} /> Entrada
          </button>
        </div>
      </div>

      {isExitOpen && (
        <div className="mb-8 p-6 bg-red-50/50 border border-red-100 rounded-3xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-4">
          <div className="xl:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Medicamento (Busca na lista do SUS ou preencha)</label>
            <input 
              type="text" 
              list="sus-meds"
              className="w-full border p-3 rounded-xl text-xs font-bold uppercase" 
              value={entryMedName} 
              onChange={handleEntryMedNameChange} 
              placeholder="Ex: Losartana" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Concentração</label>
            <input type="text" className="w-full border p-3 rounded-xl text-xs font-bold uppercase" value={entryMedConcentration} onChange={e=>setEntryMedConcentration(e.target.value)} placeholder="Ex: 50mg" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Destino / Baixa</label>
            <select className="w-full border p-3 rounded-xl text-xs font-bold uppercase bg-white" value={entryResidentId} onChange={e=>setEntryResidentId(e.target.value)}>
              <option value="" disabled>Selecione um idoso</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Motivo</label>
            <select className="w-full border p-3 rounded-xl text-xs font-bold uppercase bg-white" value={exitReason} onChange={e=>setExitReason(e.target.value)}>
              <option value="vencimento">Vencimento</option>
              <option value="sem_prescricao">Sem Prescrição</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Quantidade</label>
            <input type="number" min="1" className="w-full border p-3 rounded-xl text-xs font-bold" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div className="flex gap-2 xl:col-span-2">
            <button onClick={() => setIsExitOpen(false)} className="flex-1 py-3 bg-white text-gray-500 border rounded-xl text-[10px] font-black uppercase">Cancelar</button>
            <button onClick={handleExit} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase">Registrar Saída</button>
          </div>
        </div>
      )}

      {isEntryOpen && (
        <div className="mb-8 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-4">
          <div className="xl:col-span-2">
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Medicamento (Busca na lista do SUS ou preencha)</label>
            <input 
              type="text" 
              list="sus-meds"
              className="w-full border p-3 rounded-xl text-xs font-bold uppercase" 
              value={entryMedName} 
              onChange={handleEntryMedNameChange} 
              placeholder="Ex: Losartana" 
            />
            <datalist id="sus-meds">
              {JSON.parse(localStorage.getItem('susMedicationsFull') || '[]').map((m: any) => (
                <option key={`${m.name} - ${m.concentration}`} value={`${m.name} - ${m.concentration}`} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Concentração</label>
            <input type="text" className="w-full border p-3 rounded-xl text-xs font-bold uppercase" value={entryMedConcentration} onChange={e=>setEntryMedConcentration(e.target.value)} placeholder="Ex: 50mg" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Formato</label>
            <select className="w-full border p-3 rounded-xl text-xs font-bold uppercase" value={entryMedForm} onChange={e=>setEntryMedForm(e.target.value as any)}>
              <option value="Comprimido">Comprimido</option>
              <option value="Gota">Gota</option>
              <option value="Ampola">Ampola</option>
              <option value="Mililitro">Mililitro</option>
              <option value="Pomada">Pomada</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Destino (Idoso do dono do estoque)</label>
            <select className="w-full border p-3 rounded-xl text-xs font-bold" value={entryResidentId} onChange={e=>setEntryResidentId(e.target.value)}>
              <option value="" disabled>Selecione um idoso</option>
              {residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Origem / Custeio</label>
            <select className="w-full border p-3 rounded-xl text-xs font-bold" value={origin} onChange={e=>setOrigin(e.target.value as any)}>
              <option value="Comprado">Comprado</option>
              <option value="Doação">Doação</option>
              <option value="Prefeitura">Posto / Prefeitura</option>
              <option value="Alto Custo">Alto Custo (Estado)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">Quantidade</label>
            <input type="number" min="1" className="w-full border p-3 rounded-xl text-xs font-bold" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsEntryOpen(false)} className="flex-1 py-3 bg-white text-gray-500 border rounded-xl text-[10px] font-black uppercase">Cancelar</button>
            <button onClick={handleEntry} className="flex-1 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase">Salvar</button>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <button onClick={() => setView('geral')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'geral' ? 'bg-[#004c99] text-white' : 'bg-gray-100 text-gray-500'}`}>Visão Geral</button>
        <button onClick={() => setView('por_idoso')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'por_idoso' ? 'bg-[#004c99] text-white' : 'bg-gray-100 text-gray-500'}`}>Por Idoso</button>
        <button onClick={() => setView('sugestoes')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'sugestoes' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>Sugestões de Compra</button>
      </div>

      <div className="overflow-hidden rounded-3xl border">
        {view === 'geral' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-4 text-[10px] font-black tracking-widest text-gray-400 uppercase border-b">Medicamento</th>
                <th className="p-4 text-[10px] font-black tracking-widest text-gray-400 uppercase border-b">Forma</th>
                <th className="p-4 text-[10px] font-black tracking-widest text-gray-400 uppercase border-b">Estoque Total</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {inventory.map(item => {
                const total = getTotalStock(item);
                const isLow = total <= item.minimumStock;
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <p className="font-bold text-gray-800 uppercase">{item.name}</p>
                      <p className="text-[10px] text-gray-500">{item.concentration}</p>
                    </td>
                    <td className="p-4 text-gray-600 uppercase text-xs font-bold">{item.form}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        isLow 
                          ? 'bg-red-50 text-red-600 border border-red-100' 
                          : 'bg-green-50 text-green-600 border border-green-100'
                      }`}>
                        {total} unid.
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {view === 'por_idoso' && (
          <div className="p-6 space-y-6">
            {residents.map(r => {
              const meds = inventory.filter(i => (i.residentStock[r.id] || 0) > 0);
              if (meds.length === 0) return null;
              return (
                <div key={r.id} className="border rounded-2xl p-4">
                  <div className="font-bold text-gray-800 uppercase text-xs mb-4 flex items-center gap-2">
                    <Users size={16} /> {r.name}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meds.map(m => (
                      <div key={m.id} className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border">
                        <div>
                          <p className="font-bold text-[11px] uppercase">{m.name} <span className="text-gray-400 font-normal">{m.concentration}</span></p>
                        </div>
                        <span className="font-black text-[#004c99] text-xs px-3 py-1 bg-white border rounded-lg">{m.residentStock[r.id]} unid.</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {residents.filter(r => inventory.some(i => (i.residentStock[r.id] || 0) > 0)).length === 0 && (
              <p className="text-center text-gray-400 text-[10px] uppercase font-black py-4">Nenhum estoque vinculado a idosos específicos.</p>
            )}
          </div>
        )}

        {view === 'sugestoes' && (
          <div className="p-6">
            {inventory.filter(i => getTotalStock(i) <= i.minimumStock).length === 0 ? (
              <p className="text-center text-gray-400 text-[10px] uppercase font-black py-8">Todos os estoques estão adequados.</p>
            ) : (
              <div className="space-y-4">
                {inventory.filter(i => getTotalStock(i) <= i.minimumStock).map(i => (
                  <div key={i.id} className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-bold uppercase text-orange-900 text-sm">{i.name} ({i.concentration})</p>
                      <p className="text-[10px] text-orange-700 mt-1">Estoque atual: <strong>{getTotalStock(i)}</strong> / Mínimo: {i.minimumStock}</p>
                    </div>
                    <button className="px-4 py-2 border border-orange-300 text-orange-800 bg-white rounded-xl text-[10px] font-black uppercase">
                      Solicitar Compra/Reposição
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SeparationTab: React.FC<{ 
  residents: Resident[], 
  session: any, 
  logs: Record<string, MedicationSeparationLog>, 
  setLogs: React.Dispatch<React.SetStateAction<Record<string, MedicationSeparationLog>>>,
  inventory: MedicationProduct[],
  setInventory: (inv: MedicationProduct[]) => void,
  settings?: InstitutionSettings | null
}> = ({ residents, session, logs, setLogs, inventory, setInventory, settings }) => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const allTimes = Array.from(new Set(residents.flatMap(r => r.medications?.flatMap(m => m.times) || []))).sort();
  const availableTimes = allTimes.length > 0 ? allTimes : ['Manhã', 'Tarde', 'Noite'];
  const [shift, setShift] = useState<string>(availableTimes[0] || 'Manhã');
  
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({});

  const getShiftMeds = (resident: Resident) => {
    return (resident.medications || []).filter(m => {
      if (!m.times || m.times.length === 0) return true;
      return m.times.some(time => time.toLowerCase() === shift.toLowerCase());
    });
  };

  const handleSeparateResident = (r: Resident) => {
    const medsToSeparate = getShiftMeds(r);
    const logId = `${r.id}-${date}-${shift}`;
    setLogs(prev => ({
      ...prev,
      [logId]: {
        id: logId,
        date,
        shift,
        residentId: r.id,
        status: 'separado',
        separatedBy: session?.username || 'Enfermeiro',
        separatedAt: new Date().toISOString(),
        medications: medsToSeparate.map(m => ({
          medicationId: m.id,
          medicationName: m.name,
          dose: m.dose,
          plannedTime: shift
        }))
      }
    }));

    // Deduct stock
    let updatedInventory = [...inventory];
    for (const m of medsToSeparate) {
      // Find matching item in inventory by name (case insensitive)
      const invIdx = updatedInventory.findIndex(i => i.name.toLowerCase() === m.name.toLowerCase());
      if (invIdx >= 0) {
        const item = { ...updatedInventory[invIdx] };
        
        // Try to parse quantity to deduct from dose
        let q = 1;
        const match = m.dose.match(/(\d+[\.,]?\d*)/);
        if (match) {
          q = parseInt(match[0].replace(',', '.'), 10);
        } else if (m.dose.toLowerCase().includes('meio') || m.dose.includes('1/2')) {
          q = 1; // Since stock is integers, we might have issues with fraction. Round up for now.
        }
        
        if (isNaN(q) || q <= 0) q = 1;

        // Deduct from resident stock
        const resStock = item.residentStock[r.id] || 0;
        item.residentStock = { ...item.residentStock, [r.id]: Math.max(0, resStock - q) };
        
        updatedInventory[invIdx] = item;
      }
    }
    setInventory(updatedInventory);
  };

  const toggleCheck = (residentId: string, medId: string) => {
    const key = `${date}-${shift}-${residentId}-${medId}`;
    setCheckedMeds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    let y = 50;
    
    residents.forEach(r => {
       const shiftMeds = getShiftMeds(r);
       if (shiftMeds.length === 0) return;
       
       if (y > 270) {
         doc.addPage();
         y = 50;
       }

       doc.setFontSize(12);
       doc.setFont('helvetica', 'bold');
       doc.text(r.name, 14, y);
       y += 8;
       
       doc.setFontSize(9);
       doc.setFont('helvetica', 'normal');
       shiftMeds.forEach(m => {
           if (y > 280) {
             doc.addPage();
             y = 50;
           }
           doc.rect(14, y - 3, 4, 4);
           doc.text(`${m.name} - ${m.concentration} (${m.dose})`, 22, y);
           y += 6;
       });
       y += 6;
    });

    await addPdfHeaderAndFooter(doc, settings, `Ficha de Separação - ${shift} - ${date.split('-').reverse().join('/')}`);
    
    addPdfSignatureNode(doc);
    doc.save(`separacao_${shift}_${date}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex gap-4 items-center justify-between mb-6 border-b pb-4">
        <div className="flex gap-6 items-center">
          <div className="flex gap-4 items-center">
            <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border p-2 rounded-xl text-xs font-bold bg-white"
            />
          </div>
          
          <div className="flex gap-4 items-center">
            <label className="text-[10px] font-black uppercase text-gray-400">Horário:</label>
            <select
               value={shift}
               onChange={e => setShift(e.target.value)}
               className="border p-2 rounded-xl text-xs font-bold bg-white uppercase"
            >
              {availableTimes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button 
          onClick={handleExportPDF}
          className="px-4 py-2 bg-white text-[#004c99] border hover:bg-blue-50 border-[#004c99] rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
        >
          Exportar PDF de Ficha
        </button>
      </div>

      <div className="space-y-6">
        {residents.filter(r => getShiftMeds(r).length > 0).length === 0 ? (
          <div className="py-20 text-center bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
            <Package className="text-gray-200 mx-auto mb-4" size={48} />
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhuma medicação para este horário</p>
          </div>
        ) : (
          residents.map(r => {
             const shiftMeds = getShiftMeds(r);
             if (shiftMeds.length === 0) return null;
             
             const logId = `${r.id}-${date}-${shift}`;
             const isSeparated = logs[logId]?.status === 'separado';
             
             return (
               <div key={r.id} className={`bg-white border rounded-[32px] p-6 shadow-sm overflow-hidden relative transition-colors ${isSeparated ? 'border-green-200 bg-green-50/20' : ''}`}>
                 {isSeparated && (
                   <div className="absolute top-0 right-0 bg-green-100 text-green-700 px-4 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                     <CheckCircle2 size={10} /> Separado
                   </div>
                 )}
                 <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                     <Users size={20} className="text-gray-400" />
                   </div>
                   <div>
                     <h3 className="font-black text-gray-800 uppercase text-lg">{r.name}</h3>
                     <p className="text-[10px] text-gray-500 uppercase">{shiftMeds.length} medicamentos previstos</p>
                   </div>
                 </div>

                 <div className="space-y-2 mb-6">
                   {shiftMeds.map(m => {
                     const checkKey = `${date}-${shift}-${r.id}-${m.id}`;
                     const isChecked = checkedMeds[checkKey];
                     return (
                       <label key={m.id} className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'}`}>
                         <input 
                           type="checkbox" 
                           checked={isChecked || false} 
                           onChange={() => toggleCheck(r.id, m.id)} 
                           className="w-5 h-5 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                         />
                         <div className="flex-1">
                           <p className="font-bold text-gray-800 uppercase text-sm">{m.name}</p>
                           <p className="text-xs text-gray-500">{m.concentration} - {m.dose}</p>
                         </div>
                       </label>
                     );
                   })}
                 </div>

                 {!isSeparated && (
                   <button 
                     onClick={() => handleSeparateResident(r)}
                     className="w-full py-4 bg-yellow-400 text-yellow-900 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-2"
                   >
                     <Package size={16} /> Concluir Separação (Residente)
                   </button>
                 )}
               </div>
             );
          })
        )}
      </div>
    </div>
  );
};

const AdministrationTab: React.FC<{ 
  residents: Resident[], 
  session: any, 
  separatedLogs: Record<string, MedicationSeparationLog>,
  administeredLogs: Record<string, MedicationAdministrationLog[]>,
  setAdministeredLogs: React.Dispatch<React.SetStateAction<Record<string, MedicationAdministrationLog[]>>>,
  settings?: InstitutionSettings | null
}> = ({ residents, session, separatedLogs, administeredLogs, setAdministeredLogs, settings }) => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const allTimes = Array.from(new Set(residents.flatMap(r => r.medications?.flatMap(m => m.times) || []))).sort();
  const availableTimes = allTimes.length > 0 ? allTimes : ['Manhã', 'Tarde', 'Noite'];
  const [shift, setShift] = useState<string>(availableTimes[0] || 'Manhã');
  
  const [checkedMeds, setCheckedMeds] = useState<Record<string, boolean>>({});

  const toggleCheck = (residentId: string, medId: string) => {
    const key = `${date}-${shift}-${residentId}-${medId}`;
    setCheckedMeds(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAdministerResident = (residentId: string, separatedMeds: any[]) => {
    const key = `${residentId}-${date}-${shift}`;
    setAdministeredLogs(prev => {
      const current = prev[key] || [];
      const newLogs = separatedMeds.map(m => ({
        id: Math.random().toString(36).substr(2, 9),
        residentId,
        medicationId: m.medicationId,
        medicationName: m.medicationName,
        dose: m.dose,
        plannedTime: shift,
        date,
        shift,
        status: 'administrado' as const,
        professionalName: session?.username || 'Equipe'
      }));
      
      const existingIds = current.map(c => c.medicationId);
      const toAdd = newLogs.filter(n => !existingIds.includes(n.medicationId));

      return {
        ...prev,
        [key]: [...current, ...toAdd]
      };
    });
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    let y = 50;
    residents.forEach(r => {
       const logId = `${r.id}-${date}-${shift}`;
       const separation = separatedLogs[logId];
       if (!separation || separation.medications.length === 0) return;
       
       if (y > 270) {
         doc.addPage();
         y = 50;
       }

       doc.setFontSize(12);
       doc.setFont('helvetica', 'bold');
       doc.text(r.name, 14, y);
       y += 8;
       
       doc.setFontSize(9);
       doc.setFont('helvetica', 'normal');
       separation.medications.forEach(m => {
           if (y > 280) {
             doc.addPage();
             y = 50;
           }
           doc.rect(14, y - 3, 4, 4);
           doc.text(`${m.medicationName} - Dose: ${m.dose}`, 22, y);
           y += 6;
       });
       y += 6;
    });
    
    await addPdfHeaderAndFooter(doc, settings, `Ficha de Ministração - ${shift} - ${date.split('-').reverse().join('/')}`);

    addPdfSignatureNode(doc);
    doc.save(`ministracao_${shift}_${date}.pdf`);
  };

  const residentsWithSeparation = residents.filter(r => {
    const logId = `${r.id}-${date}-${shift}`;
    return separatedLogs[logId] && separatedLogs[logId].medications.length > 0;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex gap-4 items-center justify-between mb-6 border-b pb-4">
        <div className="flex gap-6 items-center">
          <div className="flex gap-4 items-center">
            <label className="text-[10px] font-black uppercase text-gray-400">Data:</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border p-2 rounded-xl text-xs font-bold bg-white"
            />
          </div>
          
          <div className="flex gap-4 items-center">
            <label className="text-[10px] font-black uppercase text-gray-400">Horário Prescrito:</label>
            <select
               value={shift}
               onChange={e => setShift(e.target.value)}
               className="border p-2 rounded-xl text-xs font-bold bg-white uppercase"
            >
              {availableTimes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button 
          onClick={handleExportPDF}
          className="px-4 py-2 bg-white text-[#004c99] border hover:bg-blue-50 border-[#004c99] rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
        >
          Exportar PDF de Ficha
        </button>
      </div>

      <div className="space-y-6">
        {residentsWithSeparation.length === 0 ? (
          <div className="py-20 text-center bg-gray-50 border border-dashed rounded-[40px] border-gray-200">
            <CheckCircle2 className="text-gray-200 mx-auto mb-4" size={48} />
            <p className="text-sm font-black uppercase tracking-widest text-gray-400">Nenhum medicamento separado para este turno.</p>
            <p className="text-[10px] text-gray-400 mt-2">Vá na aba "Separação" para liberar as bandejas deste turno antes de ministrar.</p>
          </div>
        ) : (
          residentsWithSeparation.map(r => {
             const logId = `${r.id}-${date}-${shift}`;
             const separation = separatedLogs[logId];
             const adminLogsForShift = administeredLogs[logId] || [];
             const pendingCount = separation.medications.length - adminLogsForShift.length;
             const isFullyAdministered = pendingCount === 0 && separation.medications.length > 0;
             
             return (
               <div key={r.id} className={`bg-white border rounded-[32px] p-6 shadow-sm overflow-hidden relative transition-colors ${isFullyAdministered ? 'border-green-200 bg-green-50/20' : ''}`}>
                 {isFullyAdministered && (
                   <div className="absolute top-0 right-0 bg-green-100 text-green-700 px-4 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                     <CheckCircle2 size={10} /> Completo
                   </div>
                 )}
                 <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                     <Users size={20} className="text-gray-400" />
                   </div>
                   <div>
                     <h3 className="font-black text-gray-800 uppercase text-lg">{r.name}</h3>
                     <p className={`text-[10px] uppercase font-black ${isFullyAdministered ? 'text-green-600' : 'text-gray-500'}`}>
                       {isFullyAdministered ? 'Todos Checados' : `${pendingCount} medicamentos pendentes`}
                     </p>
                   </div>
                 </div>

                 <div className="space-y-2 mb-6">
                   {separation.medications.map(m => {
                     const checkKey = `${date}-${shift}-${r.id}-${m.medicationId}`;
                     const hasAdminLog = adminLogsForShift.some(a => a.medicationId === m.medicationId);
                     const isChecked = checkedMeds[checkKey] || hasAdminLog;

                     return (
                       <label key={m.medicationId} className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${hasAdminLog ? 'bg-green-50 border-green-200' : isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'}`}>
                         <input 
                           type="checkbox" 
                           checked={isChecked} 
                           disabled={hasAdminLog}
                           onChange={() => toggleCheck(r.id, m.medicationId)} 
                           className="w-5 h-5 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99] disabled:opacity-50"
                         />
                         <div className="flex-1 flex justify-between items-center">
                           <div>
                             <p className="font-bold text-gray-800 uppercase text-sm">{m.medicationName}</p>
                             <p className="text-xs text-gray-500">Dose: {m.dose}</p>
                           </div>
                           {hasAdminLog && (
                             <span className="text-[9px] font-black uppercase tracking-widest text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200">
                               Administrado
                             </span>
                           )}
                         </div>
                       </label>
                     );
                   })}
                 </div>

                 {!isFullyAdministered && (
                   <button 
                     onClick={() => handleAdministerResident(r.id, separation.medications)}
                     className="w-full py-4 bg-[#004c99] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                   >
                     <CheckCircle2 size={16} /> Concluir Ministração (Residente)
                   </button>
                 )}
               </div>
             );
          })
        )}
      </div>
    </div>
  );
};

const PrescriptionListTab: React.FC<{ residents: Resident[], onSaveResident: (r: Resident) => void, onBulkSaveResidents?: (rs: Resident[]) => Promise<void>, onPostToMural?: any, session: any }> = ({ residents, onSaveResident, onBulkSaveResidents, onPostToMural, session }) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const selectedResident = residents.find(r => r.id === selectedResidentId);
  const filteredResidents = residents.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleConfirmImport = async (updatesByResident: Record<string, Medication[]>) => {
    if (onBulkSaveResidents) {
       const toSave = Object.keys(updatesByResident).map(resId => {
          const res = residents.find(r => r.id === resId);
          if (res) return { ...res, medications: updatesByResident[resId] };
          return null;
       }).filter(Boolean) as Resident[];
       
       if (toSave.length > 0) {
          await onBulkSaveResidents(toSave);
       }
    } else {
      // Process one by one if bulk is not available.
      for (const resId of Object.keys(updatesByResident)) {
         const resident = residents.find(r => r.id === resId);
         if (resident && onSaveResident) {
            onSaveResident({ ...resident, medications: updatesByResident[resId] });
         }
      }
    }
    alert("Importação concluída com sucesso. Por favor, revise as prescrições importadas.");
  };

  const canImport = ['administrador', 'gerencial', 'enfermagem'].includes(session?.accessLevel?.toLowerCase());

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto h-full">
      {canImport && (
        <div className="flex justify-end">
          <button 
             onClick={() => setIsImportModalOpen(true)}
             className="px-6 py-3 rounded-2xl bg-[#004c99] text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm"
          >
             Importar Prescrições
          </button>
        </div>
      )}
      
      <ImportPrescriptionsModal 
         isOpen={isImportModalOpen} 
         onClose={() => setIsImportModalOpen(false)} 
         residents={residents} 
         institutionId={session?.institutionId} 
         onConfirmImport={handleConfirmImport} 
      />

      <div className="bg-white rounded-[40px] shadow-sm border p-6 flex flex-col relative z-10">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#004c99] mb-4 flex items-center gap-2">
           <Users size={18} />
           Selecione o Residente
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder={selectedResident ? `Selecionado: ${selectedResident.name} (Clique para alterar)` : "Buscar residente por nome..."}
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold uppercase text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:normal-case"
          />
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        {isDropdownOpen && filteredResidents.length > 0 && (
          <div className="absolute top-full left-6 right-6 mt-2 bg-white border rounded-2xl shadow-xl max-h-60 overflow-y-auto z-50">
             {filteredResidents.map(r => (
               <button
                 key={r.id}
                 onClick={() => {
                    setSelectedResidentId(r.id);
                    setSearchTerm('');
                    setIsDropdownOpen(false);
                 }}
                 className="w-full text-left p-4 hover:bg-blue-50 border-b last:border-0 transition-colors flex items-center justify-between"
               >
                 <span className="font-bold text-gray-800 uppercase text-xs">{r.name}</span>
                 <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full text-gray-500 uppercase">{r.medications?.length || 0} meds</span>
               </button>
             ))}
          </div>
        )}
      </div>
      
      <div className="flex-1 bg-white rounded-[40px] shadow-sm border overflow-visible h-full min-h-[500px]">
        {selectedResident ? (
          <div className="h-full p-6">
            <MedicationTab 
              resident={selectedResident} 
              onUpdateMedications={(newMeds) => {
                if (onSaveResident) {
                  onSaveResident({ ...selectedResident, medications: newMeds });
                }
              }}
              onPostToMural={onPostToMural}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20 bg-gray-50 rounded-[40px]">
            <Pill size={48} className="mb-4 opacity-30 text-[#004c99]" />
            <p className="text-sm font-black uppercase tracking-widest text-gray-500">Selecione um residente</p>
            <p className="text-[10px] mt-2 max-w-xs text-center leading-relaxed">
              Utilize a barra de pesquisa acima para encontrar um residente e visualizar sua prescrição médica
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationModule;

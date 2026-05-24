import React, { useState, useEffect } from 'react';
import { Pill, Search, Plus, X, Activity, Edit3, Trash2 } from 'lucide-react';
import { Resident, SosProtocol } from '../types';
import { fetchSosProtocols, saveSosProtocol } from '../lib/api';

export const SosProtocolsTab: React.FC<{ residents: Resident[], session: any }> = ({ residents, session }) => {
  const [protocols, setProtocols] = useState<SosProtocol[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Partial<SosProtocol> | null>(null);

  useEffect(() => {
    if (session?.institutionId && selectedResidentId) {
      fetchSosProtocols(session.institutionId, selectedResidentId).then(data => {
        setProtocols(data || []);
      }).catch(console.error);
    } else {
      setProtocols([]);
    }
  }, [session?.institutionId, selectedResidentId]);

  const handleSave = async () => {
    if (!editingProtocol || !selectedResidentId) return;
    
    const protocolToSave: any = {
      ...editingProtocol,
      institutionId: session.institutionId,
      residentId: selectedResidentId,
      status: editingProtocol.status || 'ativo',
      autorizadoPorNome: editingProtocol.autorizadoPorNome || session?.username || 'Usuário Atual',
      dataAutorizacao: editingProtocol.dataAutorizacao || new Date().toISOString().split('T')[0]
    };

    try {
      const saved = await saveSosProtocol(protocolToSave);
      setProtocols(prev => {
        const existing = prev.findIndex(p => p.id === saved.id);
        if (existing >= 0) {
          const newArr = [...prev];
          newArr[existing] = { ...saved, id: saved.id || protocolToSave.id };
          return newArr;
        }
        return [...prev, { ...saved, id: saved.id || Math.random().toString() }];
      });
      setIsModalOpen(false);
      setEditingProtocol(null);
    } catch (e) {
      alert("Erro ao salvar conduta.");
    }
  };

  const handleInactivate = async (proto: SosProtocol) => {
    if (confirm("Deseja realmente inativar esta conduta?")) {
      try {
        await saveSosProtocol({ ...proto, status: 'inativo' });
        setProtocols(prev => prev.map(p => p.id === proto.id ? { ...p, status: 'inativo' } : p));
      } catch (e) {}
    }
  };

  const filteredResidents = residents.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedResident = residents.find(r => r.id === selectedResidentId);

  return (
    <div className="flex h-full gap-6">
      {/* List of residents */}
      <div className="w-80 bg-white rounded-[32px] border shadow-sm flex flex-col overflow-hidden shrink-0">
         <div className="p-6 border-b">
           <h3 className="text-sm font-black uppercase text-gray-800 tracking-widest mb-4">Residentes</h3>
           <div className="relative">
             <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
             <input
               type="text"
               placeholder="Buscar residente..."
               className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#004c99]/20"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
         </div>
         <div className="flex-1 overflow-y-auto p-2">
           {filteredResidents.map(r => (
             <button type="button"
               key={r.id}
               onClick={() => setSelectedResidentId(r.id)}
               className={`w-full text-left p-4 rounded-2xl transition-colors mb-1 ${selectedResidentId === r.id ? 'bg-[#004c99] text-white' : 'hover:bg-gray-50 text-gray-700'}`}
             >
               <h4 className="font-bold uppercase text-sm truncate">{r.name}</h4>
             </button>
           ))}
         </div>
      </div>

      {/* Protocols for selected resident */}
      <div className="flex-1 bg-white rounded-[32px] border shadow-sm flex flex-col overflow-hidden">
         {!selectedResident ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
               <Activity size={48} className="mb-4 opacity-50" />
               <p className="font-black uppercase tracking-widest text-sm">Selecione um residente</p>
            </div>
         ) : (
            <>
              <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                 <div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">{selectedResident.name}</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Condutas SOS / Medicações Eventuais Autorizadas</p>
                 </div>
                 <button type="button" 
                   onClick={() => {
                     setEditingProtocol({
                       estoquePreferencial: 'qualquer',
                       status: 'ativo'
                     });
                     setIsModalOpen(true);
                   }}
                   className="px-5 py-3 bg-[#004c99] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-800 transition-colors shadow-md"
                 >
                   <Plus size={14} /> Nova Conduta
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                 {protocols.length === 0 ? (
                   <div className="text-center py-20">
                      <p className="font-bold text-gray-400 uppercase text-xs tracking-widest">Nenhuma conduta cadastrada</p>
                   </div>
                 ) : (
                   protocols.map(p => (
                     <div key={p.id} className={`p-6 border rounded-2xl shadow-sm ${p.status === 'inativo' ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                        <div className="flex justify-between items-start mb-4">
                           <div>
                             <h4 className="font-black text-gray-800 text-lg uppercase">{p.sintomaOuQueixa}</h4>
                             <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest py-1 px-2 bg-purple-50 inline-block rounded mt-1">
                               {p.medicamentoAutorizado}
                             </p>
                           </div>
                           <div className="flex items-center gap-2">
                              {p.status === 'inativo' && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded font-black uppercase tracking-widest">Inativo</span>}
                              <button type="button" onClick={() => { setEditingProtocol(p); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-lg transition-colors"><Edit3 size={16} /></button>
                              {p.status === 'ativo' && <button type="button" onClick={() => handleInactivate(p)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>}
                           </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mt-4">
                           <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Dosagem</span><span className="font-bold text-gray-700">{p.dosagem || '-'}</span></div>
                           <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Qtd</span><span className="font-bold text-gray-700">{p.quantidade || '-'}</span></div>
                           <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Via</span><span className="font-bold text-gray-700">{p.via || '-'}</span></div>
                           <div><span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Intervalo Mín.</span><span className="font-bold text-gray-700">{p.intervaloMinimoHoras ? `${p.intervaloMinimoHoras}h` : '-'}</span></div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Autorizado por</span>
                             <span className="text-xs text-gray-600 uppercase font-bold">{p.autorizadoPorNome} {p.autorizadoPorRegistro ? `(${p.autorizadoPorRegistro})` : ''}</span>
                           </div>
                           {p.observacoes && (
                             <div>
                               <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Observações</span>
                               <span className="text-xs text-gray-600">{p.observacoes}</span>
                             </div>
                           )}
                        </div>
                     </div>
                   ))
                 )}
              </div>
            </>
         )}
      </div>

      {isModalOpen && editingProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-6 shrink-0">
                 <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Conduta SOS</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{selectedResident?.name}</p>
                 </div>
                 <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-full">
                    <X size={20} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="md:col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Motivo / Sintoma / Queixa <span className="text-red-500">*</span></label>
                     <input type="text" value={editingProtocol.sintomaOuQueixa || ''} onChange={e => setEditingProtocol({...editingProtocol, sintomaOuQueixa: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" placeholder="Ex: Dor de cabeça" />
                   </div>

                   <div className="md:col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Medicamento Autorizado <span className="text-red-500">*</span></label>
                     <input type="text" value={editingProtocol.medicamentoAutorizado || ''} onChange={e => setEditingProtocol({...editingProtocol, medicamentoAutorizado: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" placeholder="Ex: Dipirona 500mg" />
                   </div>

                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Dosagem / Quantidade</label>
                     <input type="text" value={editingProtocol.quantidade || ''} onChange={e => setEditingProtocol({...editingProtocol, quantidade: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" placeholder="Ex: 1 comprimido, 40 gotas..." />
                   </div>

                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Via de Administração</label>
                     <input type="text" value={editingProtocol.via || ''} onChange={e => setEditingProtocol({...editingProtocol, via: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" placeholder="Ex: Oral, Intravenosa..." />
                   </div>

                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Intervalo Mínimo (em horas)</label>
                     <input type="number" value={editingProtocol.intervaloMinimoHoras || ''} onChange={e => setEditingProtocol({...editingProtocol, intervaloMinimoHoras: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" placeholder="Ex: 6" />
                   </div>

                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Estoque Preferencial</label>
                     <select value={editingProtocol.estoquePreferencial || 'qualquer'} onChange={e => setEditingProtocol({...editingProtocol, estoquePreferencial: e.target.value as any})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700">
                        <option value="qualquer">Qualquer / Não se aplica</option>
                        <option value="residente">Residente</option>
                        <option value="instituição">Institucional</option>
                        <option value="sem_baixa_automatica">Sem baixa automática</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Autorizado Por (Nome)</label>
                     <input type="text" value={editingProtocol.autorizadoPorNome || ''} onChange={e => setEditingProtocol({...editingProtocol, autorizadoPorNome: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" placeholder="Nome do profissional" />
                   </div>
                   <div>
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Registro Profissional (Coren/CRM)</label>
                     <input type="text" value={editingProtocol.autorizadoPorRegistro || ''} onChange={e => setEditingProtocol({...editingProtocol, autorizadoPorRegistro: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm outline-none font-bold text-gray-700" />
                   </div>

                   <div className="md:col-span-2">
                     <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Observações Técnicas</label>
                     <textarea value={editingProtocol.observacoes || ''} onChange={e => setEditingProtocol({...editingProtocol, observacoes: e.target.value})} className="w-full p-4 bg-gray-50 border rounded-2xl text-sm min-h-[80px] outline-none font-bold text-gray-700" placeholder="Recomendações e contraindicações específicas..."></textarea>
                   </div>
                 </div>
              </div>
              
              <div className="pt-6 shrink-0 flex gap-4">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-700 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                 <button type="button" disabled={!editingProtocol.sintomaOuQueixa || !editingProtocol.medicamentoAutorizado} onClick={handleSave} className="flex-1 py-4 bg-[#004c99] text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-800 transition-colors shadow-lg disabled:opacity-50">Salvar Conduta</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

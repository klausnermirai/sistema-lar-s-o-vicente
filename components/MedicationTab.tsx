import React, { useState } from 'react';
import { Resident, Medication } from '../types';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Calendar, 
  AlertCircle,
  Pill,
  CheckCircle2,
  X,
  Edit2
} from 'lucide-react';

interface MedicationTabProps {
  resident: Resident;
  onUpdateMedications: (meds: Medication[]) => void;
}

const MedicationTab: React.FC<MedicationTabProps> = ({ resident, onUpdateMedications }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  
  const initialMedState: Omit<Medication, 'id'> = {
    name: '',
    concentration: '',
    dose: '',
    frequency: 1,
    times: ['08:00'],
    type: 'continuo',
    startDate: new Date().toISOString().split('T')[0],
    observation: ''
  };

  const [formData, setFormData] = useState<Omit<Medication, 'id'>>(initialMedState);

  const handleOpenModal = (med?: Medication) => {
    if (med) {
      setEditingMedId(med.id);
      const { id, ...rest } = med;
      setFormData(rest);
    } else {
      setEditingMedId(null);
      setFormData(initialMedState);
    }
    setIsModalOpen(true);
  };

  const handleFrequencyChange = (freq: number) => {
    const newTimes = [...formData.times];
    if (freq > newTimes.length) {
      for (let i = newTimes.length; i < freq; i++) {
        newTimes.push('');
      }
    } else {
      newTimes.splice(freq);
    }
    setFormData({ ...formData, frequency: freq, times: newTimes });
  };

  const handleTimeChange = (index: number, val: string) => {
    const newTimes = [...formData.times];
    newTimes[index] = val;
    setFormData({ ...formData, times: newTimes });
  };

  const handleSave = () => {
    const currentMeds = resident.medications || [];
    if (editingMedId) {
      const updatedMeds = currentMeds.map(m => 
        m.id === editingMedId ? { ...formData, id: editingMedId } : m
      );
      onUpdateMedications(updatedMeds);
    } else {
      const newMed: Medication = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9)
      };
      onUpdateMedications([...currentMeds, newMed]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir este medicamento?')) {
      const updatedMeds = (resident.medications || []).filter(m => m.id !== id);
      onUpdateMedications(updatedMeds);
    }
  };

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
            <Pill className="text-[#004c99]" size={24} />
            Farmácia e Controle de Medicamentos
          </h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Gestão de prescrições e horários de administração
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl flex items-center gap-2"
        >
          <Plus size={16} /> Adicionar Medicamento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(resident.medications || []).length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Pill className="text-gray-200" size={40} />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum medicamento cadastrado</p>
          </div>
        ) : (
          (resident.medications || []).map(med => (
            <div key={med.id} className="bg-white border rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className={`absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-widest ${med.type === 'continuo' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                {med.type === 'continuo' ? 'Uso Contínuo' : `Temporário (${med.durationDays} dias)`}
              </div>

              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 text-[#004c99] rounded-2xl flex items-center justify-center">
                  <Pill size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleOpenModal(med)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                   <button onClick={() => handleDelete(med.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>

              <h4 className="text-base font-black text-gray-800 uppercase tracking-tight truncate">{med.name}</h4>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                {med.concentration} - {med.dose}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {med.times.map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border rounded-xl">
                    <Clock size={12} className="text-blue-500" />
                    <span className="text-[10px] font-black text-gray-700">{t}</span>
                  </div>
                ))}
              </div>

              {med.observation && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl border-l-4 border-blue-200">
                  <p className="text-[10px] text-gray-500 leading-tight italic">{med.observation}</p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                <span className="text-gray-400">Início: {new Date(med.startDate).toLocaleDateString('pt-BR')}</span>
                <span className="text-[#004c99]">{med.frequency}x ao dia</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b bg-[#004c99] text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Pill size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">
                    {editingMedId ? 'Editar Medicamento' : 'Novo Medicamento'}
                  </h3>
                  <p className="text-[10px] font-bold uppercase opacity-80">
                    Detalhes da prescrição médica
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-3 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X size={28} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nome do Medicamento</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Losartana Potássica"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Concentração</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 50mg"
                    value={formData.concentration}
                    onChange={e => setFormData({ ...formData, concentration: e.target.value })}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Dose / Posologia</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 1 comprimido"
                    value={formData.dose}
                    onChange={e => setFormData({ ...formData, dose: e.target.value })}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div className="p-6 bg-white border rounded-[32px] space-y-6">
                 <div className="flex flex-wrap gap-8">
                   <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Tipo de Uso</label>
                     <div className="flex gap-2">
                       <button 
                         onClick={() => setFormData({ ...formData, type: 'continuo' })}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${formData.type === 'continuo' ? 'bg-[#004c99] border-[#004c99] text-white' : 'bg-white border-gray-100 text-gray-400'}`}
                       >
                         Contínuo
                       </button>
                       <button 
                         onClick={() => setFormData({ ...formData, type: 'temporario' })}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${formData.type === 'temporario' ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-gray-100 text-gray-400'}`}
                       >
                         Temporário
                       </button>
                     </div>
                   </div>

                   {formData.type === 'temporario' && (
                     <div className="animate-in slide-in-from-left duration-300">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Duração (Dias)</label>
                       <input 
                         type="number" 
                         value={formData.durationDays || 0}
                         onChange={e => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                         className="w-24 p-2 bg-gray-50 border rounded-xl text-sm font-black outline-none"
                       />
                     </div>
                   )}

                   <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Frequência</label>
                     <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          min="1"
                          max="24"
                          value={formData.frequency}
                          onChange={e => handleFrequencyChange(parseInt(e.target.value))}
                          className="w-16 p-2 bg-gray-50 border rounded-xl text-sm font-black outline-none"
                        />
                        <span className="text-[10px] font-black text-gray-400 uppercase">vezes ao dia</span>
                     </div>
                   </div>
                 </div>

                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Horários de Administração</label>
                   <div className="flex flex-wrap gap-3">
                     {formData.times.map((time, idx) => (
                       <div key={idx} className="flex flex-col gap-1">
                         <span className="text-[8px] font-black text-gray-400 uppercase ml-1">{idx + 1}ª Dose</span>
                         <input 
                           type="time" 
                           value={time}
                           onChange={e => handleTimeChange(idx, e.target.value)}
                           className="p-3 bg-gray-50 border rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-100"
                         />
                       </div>
                     ))}
                   </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Data de Início</label>
                  <input 
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-black outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Observações / Recomendações</label>
                  <textarea 
                    placeholder="Ex: Administrar após o café da manhã. Não triturar o comprimido."
                    value={formData.observation}
                    onChange={e => setFormData({ ...formData, observation: e.target.value })}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase outline-none min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 border-t bg-gray-50 flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-100 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={18} /> {editingMedId ? 'Atualizar Medicamento' : 'Salvar Medicamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationTab;

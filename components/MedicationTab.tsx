import React, { useState } from 'react';
import { Resident, Medication, InstitutionSettings } from '../types';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Calendar, 
  AlertCircle,
  Pill,
  CheckCircle2,
  X,
  Edit2,
  Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import { addPdfHeaderAndFooter, createPdfContext } from '../lib/pdfHelpers';

interface MedicationTabProps {
  resident: Resident;
  settings?: InstitutionSettings | null;
  onUpdateMedications: (meds: Medication[]) => void;
  onPostToMural?: any;
}

const MedicationTab: React.FC<MedicationTabProps> = ({ resident, settings, onUpdateMedications, onPostToMural }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [visibilidade, setVisibilidade] = useState<string[]>(['admin', 'publico']);
  
  const initialMedState: Omit<Medication, 'id'> = {
    name: '',
    concentration: '',
    dose: '',
    frequency: 1,
    times: ['Manhã'],
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
    setVisibilidade(['admin', 'publico']);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const currentMeds = resident.medications || [];
    if (editingMedId) {
      const updatedMeds = currentMeds.map(m => 
        m.id === editingMedId ? { ...formData, id: editingMedId } : m
      );
      onUpdateMedications(updatedMeds);
      if (onPostToMural && formData.observation && visibilidade.length > 0) {
        onPostToMural({
          author: 'Sistema de Cuidados',
          text: `Prescrição de medicamento atualizada: ${formData.name} - ${resident.name}`,
          detailedContent: `Dose: ${formData.dose}\nObservações: ${formData.observation}`,
          visibilidade
        });
      }
    } else {
      const newMed: Medication = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9)
      };
      onUpdateMedications([...currentMeds, newMed]);
      if (onPostToMural && formData.observation && visibilidade.length > 0) {
        onPostToMural({
          author: 'Sistema de Cuidados',
          text: `Nova prescrição de medicamento: ${formData.name} - ${resident.name}`,
          detailedContent: `Dose: ${formData.dose}\nObservações: ${formData.observation}`,
          visibilidade
        });
      }
    }
    setIsModalOpen(false);
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Não informado';
    const base = value.includes('T') ? value.split('T')[0] : value;
    const [year, month, day] = base.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  };

  const handleGeneratePdf = async () => {
    const doc = new jsPDF();
    const pdf = createPdfContext(doc);
    const medications = [...(resident.medications || [])].sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
      return bTime - aTime;
    });

    pdf.writeField('Residente', resident.name);
    pdf.writeSection('Medicamentos em uso');

    if (!medications.length) {
      pdf.writeText('Nenhum medicamento cadastrado.', { font: 'italic' });
    } else {
      medications.forEach((med, index) => {
        pdf.ensureSpace(32);
        pdf.writeText(`${index + 1}. ${pdf.safeValue(med.name)}${med.concentration ? ` — ${med.concentration}` : ''}`, { font: 'bold', size: 10 });
        pdf.writeField('Dose', med.dose);
        pdf.writeField('Via', med.route);
        pdf.writeField('Tipo', med.type === 'continuo' ? 'Contínuo' : 'Temporário');
        pdf.writeField('Frequência', med.frequency ? `${med.frequency} vez(es) ao dia` : 'Não informada');
        pdf.writeField('Horários', med.times?.length ? med.times.join(', ') : 'Não informados');
        pdf.writeField('Início', formatDate(med.startDate));
        if (med.endDate) pdf.writeField('Término', formatDate(med.endDate));
        if (med.type === 'temporario' && med.durationDays) pdf.writeField('Duração', `${med.durationDays} dia(s)`);
        if (med.observation) pdf.writeField('Observação', med.observation);
        if (med.reviewed === false) pdf.writeField('Situação', 'Pendente de revisão');
        pdf.separator();
      });
    }

    await addPdfHeaderAndFooter(doc, settings, 'Relação de Medicamentos em Uso');
    doc.save(`Medicamentos_${resident.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja arquivar este medicamento?')) {
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGeneratePdf}
            className="px-5 py-3 border-2 border-[#004c99] text-[#004c99] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2"
          >
            <Printer size={16} /> Gerar Relação PDF
          </button>
          <button type="button"
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl flex items-center gap-2"
          >
            <Plus size={16} /> Adicionar Medicamento
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {(resident.medications || []).length === 0 ? (
          <div className="py-20 text-center bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Pill className="text-gray-200" size={40} />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Nenhum medicamento cadastrado</p>
          </div>
        ) : (
          (() => {
            const allMeds = resident.medications || [];
            const allDefinedTimes = Array.from(new Set(allMeds.flatMap(m => m.times || [])));
            const defaultShifts = ['Manhã', 'Tarde', 'Noite'];
            const customTimes = allDefinedTimes.filter(t => !defaultShifts.includes(t as string)).sort();
            const displayGroups = [...defaultShifts, ...customTimes];

            return displayGroups.map(timeGroup => {
              const medsInGroup = allMeds.filter(m => m.times?.includes(timeGroup));
              if (medsInGroup.length === 0) return null;

              return (
                <div key={timeGroup} className="bg-white border rounded-[32px] p-6 shadow-sm">
                  <h4 className="text-base font-black text-[#004c99] uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Clock size={18} /> {timeGroup}
                  </h4>
                  <div className="space-y-3">
                    {medsInGroup.map(med => (
                      <div key={med.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group gap-4 transition-all hover:border-blue-100 hover:bg-blue-50/30">
                        <div className="flex items-start sm:items-center gap-4">
                          <div className="w-10 h-10 bg-white shadow-sm text-[#004c99] rounded-xl flex items-center justify-center shrink-0">
                            <Pill size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-black text-gray-800 uppercase text-sm">{med.name}</h5>
                              <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full ${med.type === 'continuo' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {med.type === 'continuo' ? 'Contínuo' : `${med.durationDays} dias`}
                              </span>
                              {med.reviewed === false && (
                                <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full bg-red-100 text-red-700 flex items-center gap-1 border border-red-200">
                                  <AlertCircle size={10} /> REVISAR
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase mt-0.5">
                              {med.concentration} {med.concentration && '•'} <span className="text-[#004c99]">{med.dose || `Via: ${med.route || 'Não informada'}`}</span>
                            </p>
                            {(med.observation || med.importOrigin || med.importObservations) && (
                              <div className="flex flex-col gap-1 mt-1">
                                {med.observation && (
                                  <p className="text-[10px] text-gray-400 italic bg-white px-2 py-1 rounded border inline-block fit-content self-start">
                                    Obs: {med.observation}
                                  </p>
                                )}
                                {(med.importOrigin || med.importObservations) && (
                                  <p className="text-[9px] text-[#004c99]/70 font-bold uppercase tracking-widest bg-blue-50/50 px-2 py-1 rounded border border-blue-100 inline-block self-start">
                                    Origem: {med.importOrigin} {med.originPage ? `(Pág: ${med.originPage})` : ''} | {med.importObservations || ''}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-14 sm:ml-0">
                          {med.reviewed === false && (
                            <button type="button" 
                              onClick={() => {
                                const newMeds = (resident.medications || []).map(m => 
                                  m.id === med.id ? { ...m, reviewed: true, reviewedAt: new Date().toISOString() } : m
                                );
                                onUpdateMedications(newMeds);
                              }}
                              className="px-3 py-2 bg-green-50 text-green-700 font-bold text-[10px] uppercase rounded-xl hover:bg-green-100 transition-colors border border-green-200 shadow-sm flex items-center gap-1"
                            >
                              <CheckCircle2 size={12} /> Ok
                            </button>
                          )}
                          <div className={`flex items-center gap-2 transition-opacity ${med.reviewed === false ? 'opacity-100' : 'sm:opacity-0 group-hover:opacity-100'}`}>
                            <button type="button" onClick={() => handleOpenModal(med)} className="p-2.5 bg-white shadow-sm hover:bg-blue-50 text-blue-600 rounded-xl transition-colors border">
                              <Edit2 size={14} />
                            </button>
                            <button type="button" onClick={() => handleDelete(med.id)} className="p-2.5 bg-white shadow-sm hover:bg-red-50 text-red-600 rounded-xl transition-colors border">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()
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
              <button type="button"
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
                    list="sus-meds-prescribe"
                    placeholder="Ex: Losartana Potássica"
                    value={formData.name}
                    onChange={e => {
                      const searchName = e.target.value;
                      const allMeds = JSON.parse(localStorage.getItem('susMedicationsFull') || '[]');
                      const match = allMeds.find((m: any) => `${m.name} - ${m.concentration}` === searchName || m.name === searchName);
                      if (match) {
                        setFormData({
                          ...formData,
                          name: match.name,
                          concentration: match.concentration || formData.concentration,
                          form: match.form ? match.form : formData.form
                        });
                      } else {
                        setFormData({ ...formData, name: searchName });
                      }
                    }}
                    className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <datalist id="sus-meds-prescribe">
                    {JSON.parse(localStorage.getItem('susMedicationsFull') || '[]').map((m: any) => (
                      <option key={`${m.name} - ${m.concentration}`} value={`${m.name} - ${m.concentration}`} />
                    ))}
                  </datalist>
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
                       <button type="button" 
                         onClick={() => setFormData({ ...formData, type: 'continuo' })}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${formData.type === 'continuo' ? 'bg-[#004c99] border-[#004c99] text-white' : 'bg-white border-gray-100 text-gray-400'}`}
                       >
                         Contínuo
                       </button>
                       <button type="button" 
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

                   <div className="md:col-span-2 space-y-4">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Turnos / Horários de Administração</label>
                     <div className="flex flex-wrap gap-4 items-center">
                       {['Manhã', 'Tarde', 'Noite'].map(shift => (
                         <label key={shift} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
                           <input 
                             type="checkbox" 
                             checked={formData.times.includes(shift)} 
                             onChange={(e) => {
                               const newTimes = e.target.checked 
                                 ? [...formData.times, shift] 
                                 : formData.times.filter(t => t !== shift);
                               setFormData({...formData, times: newTimes, frequency: newTimes.length});
                             }}
                             className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                           />
                           <span className="text-xs font-black text-gray-700 uppercase">{shift}</span>
                         </label>
                       ))}
                       <button 
                         type="button" 
                         onClick={() => {
                           const newTimes = [...formData.times, '08:00'];
                           setFormData({...formData, times: newTimes, frequency: newTimes.length});
                         }} 
                         className="text-[#004c99] hover:bg-blue-50 px-3 py-2 flex items-center gap-1 rounded-xl uppercase tracking-widest text-[10px] font-black border border-blue-200"
                       >
                         + Adicionar Horário Específico
                       </button>
                     </div>
                     
                     {formData.times.filter(t => t !== 'Manhã' && t !== 'Tarde' && t !== 'Noite').length > 0 && (
                       <div className="flex flex-wrap gap-3 mt-4 p-4 border border-dashed rounded-2xl bg-gray-50/50">
                         {formData.times.map((time, idx) => {
                           if (time === 'Manhã' || time === 'Tarde' || time === 'Noite') return null;
                           return (
                             <div key={idx} className="flex flex-col gap-1 relative">
                               <span className="text-[8px] font-black text-gray-400 uppercase ml-1">Horário {idx + 1}</span>
                               <div className="flex items-center gap-1">
                                 <input 
                                   type="time" 
                                   value={time}
                                   onChange={e => {
                                     const newTimes = [...formData.times];
                                     newTimes[idx] = e.target.value;
                                     setFormData({...formData, times: newTimes});
                                   }}
                                   className="p-3 bg-white border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-100"
                                 />
                                 <button 
                                   type="button"
                                   onClick={() => {
                                     const newTimes = formData.times.filter((_, i) => i !== idx);
                                     setFormData({...formData, times: newTimes, frequency: newTimes.length});
                                   }}
                                   className="p-3 text-red-500 hover:bg-red-50 rounded-xl"
                                 >
                                   Remover
                                 </button>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     )}
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

            <div className="p-8 border-t bg-gray-50 flex flex-col gap-4">
              <div className="flex items-center gap-4 bg-white border border-gray-200 p-3 rounded-2xl">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Visibilidade no Mural:</label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={visibilidade.includes('publico')}
                    onChange={(e) => {
                      if (e.target.checked) setVisibilidade([...visibilidade, 'publico']);
                      else setVisibilidade(visibilidade.filter(v => v !== 'publico'));
                    }}
                    className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                  />
                  <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-[#004c99] transition-colors">Público</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={visibilidade.includes('admin')}
                    onChange={(e) => {
                      if (e.target.checked) setVisibilidade([...visibilidade, 'admin']);
                      else setVisibilidade(visibilidade.filter(v => v !== 'admin'));
                    }}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
                  />
                  <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-purple-600 transition-colors">Direção e coordenação</span>
                </label>
              </div>
              <div className="flex gap-4">
                <button type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:bg-gray-100 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button type="button"
                  onClick={handleSave}
                  className="flex-1 py-4 bg-[#004c99] text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={18} /> {editingMedId ? 'Atualizar Medicamento' : 'Salvar Medicamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationTab;

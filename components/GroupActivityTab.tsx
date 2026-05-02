import { getProfessionalSignature } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Resident, GroupActivity, MuralMessage } from '../types';
import { Plus, Save, ArrowLeft, Users, Calendar, CheckCircle, Edit, Search, Trash2 } from 'lucide-react';
import { loadGroupActivities, saveGroupActivity, deleteGroupActivity } from '../lib/groupActivityStore';
import { saveAgendaEvent } from '../lib/agendaStore';

interface GroupActivityTabProps {
  competence: 'nutricionista' | 'psicologia' | 'terapeuta_ocupacional' | 'fisioterapeuta';
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
  onPostToMural?: (message: Omit<MuralMessage, 'id' | 'timestamp' | 'institutionId'>) => void;
}

const ACTIVITY_TYPES = [
  'Recreativa',
  'Cognitiva',
  'Motora',
  'Social',
  'Espiritual',
  'Outro'
];

const RESULTS = [
  'Excelente',
  'Boa',
  'Regular',
  'Baixa adesão'
];

const GroupActivityTab: React.FC<GroupActivityTabProps> = ({ competence, residents, onSaveResident, onPostToMural }) => {
  const currentUser = { name: 'Profissional Logado', institutionId: 'default-inst' }; // Mock user
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [residentSearchTerm, setResidentSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<Partial<GroupActivity>>({
    status: 'agendada',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().substring(0, 5),
    type: '',
    description: '',
    participationType: 'Todos os residentes',
    selectedResidents: [],
    responsibleProfessional: currentUser.name || 'Profissional',
    involvedProfessionals: [],
    result: '',
    observations: '',
    visibilidade: ['admin', 'publico']
  });

  const [involvedInput, setInvolvedInput] = useState('');

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      status: 'agendada',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().substring(0, 5),
      type: '',
      description: '',
      participationType: 'Todos os residentes',
      selectedResidents: [],
      responsibleProfessional: currentUser.name || 'Profissional',
      involvedProfessionals: [],
      result: '',
      observations: '',
      visibilidade: ['admin', 'publico']
    });
    setResidentSearchTerm('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (activity: GroupActivity) => {
    setEditingId(activity.id);
    setFormData(activity);
    setResidentSearchTerm('');
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (currentUser?.institutionId) {
      loadGroupActivities(currentUser.institutionId).then(loaded => {
        setActivities(loaded.filter(a => a.competence === competence).sort((a, b) => b.timestamp - a.timestamp));
      }).catch(console.error);
    }
  }, [currentUser?.institutionId, competence]);

  const handleAddInvolved = () => {
    if (involvedInput.trim()) {
      setFormData(prev => ({
        ...prev,
        involvedProfessionals: [...(prev.involvedProfessionals || []), involvedInput.trim()]
      }));
      setInvolvedInput('');
    }
  };

  const handleRemoveInvolved = (index: number) => {
    setFormData(prev => ({
      ...prev,
      involvedProfessionals: prev.involvedProfessionals?.filter((_, i) => i !== index)
    }));
  };

  const handleResidentToggle = (residentId: string) => {
    setFormData(prev => {
      const selected = prev.selectedResidents || [];
      if (selected.includes(residentId)) {
        return { ...prev, selectedResidents: selected.filter(id => id !== residentId) };
      } else {
        return { ...prev, selectedResidents: [...selected, residentId] };
      }
    });
  };

  const handleSave = async () => {
    if (!formData.date || !formData.time || !formData.type || !formData.description) {
      alert('Por favor, preencha todos os campos obrigatórios (Data, Hora, Tipo e Descrição).');
      return;
    }

    if ((formData.participationType === 'Grupo específico' || formData.participationType === 'Participação parcial') && (!formData.selectedResidents || formData.selectedResidents.length === 0)) {
      alert('Selecione pelo menos um residente.');
      return;
    }

    const newActivity: GroupActivity = {
      id: editingId || Date.now().toString(),
      institutionId: currentUser?.institutionId || 'default-inst',
      competence,
      status: formData.status as any,
      date: formData.date!,
      time: formData.time!,
      type: formData.type!,
      description: formData.description!,
      participationType: formData.participationType as any,
      selectedResidents: formData.selectedResidents || [],
      responsibleProfessional: formData.responsibleProfessional!,
      involvedProfessionals: formData.involvedProfessionals || [],
      result: formData.result as any,
      observations: formData.observations || '',
      visibilidade: formData.visibilidade || ['admin', 'publico'],
      timestamp: Date.now()
    };

    // Save to global store
    await saveGroupActivity(newActivity);
    
    // Convert and save to Agenda
    const agendaEvent: any = { // Use any briefly or import AgendaEvent
      id: `ga-${newActivity.id}`,
      institutionId: newActivity.institutionId,
      title: `Atividade em Grupo: ${newActivity.type} (${newActivity.competence.replace('_', ' ')})`,
      date: newActivity.date,
      time: newActivity.time,
      description: newActivity.description,
      professionalName: newActivity.responsibleProfessional,
      professionalRole: newActivity.competence,
      type: 'atividade_grupo'
    };
    await saveAgendaEvent(agendaEvent);
    
    setActivities(prev => {
      if (editingId) {
        return prev.map(a => a.id === editingId ? newActivity : a);
      }
      return [newActivity, ...prev];
    });

    // Save to Mural if visibilidade length > 0 and not already shared or just updating
    if (newActivity.visibilidade && newActivity.visibilidade.length > 0 && onPostToMural && !editingId) {
      onPostToMural({
        author: newActivity.responsibleProfessional,
        text: `Atividade em Grupo (${newActivity.type}): ${newActivity.description}`,
        detailedContent: `Data e Hora: ${newActivity.date} às ${newActivity.time}\nCompetência: ${newActivity.competence}\nParticipantes selecionados: ${newActivity.selectedResidents?.length || 0}\n\nDescrição:\n${newActivity.description}\n\nResultado/Evolução:\n${newActivity.result || 'Sem resultado registrado.'}`,
        visibilidade: newActivity.visibilidade
      });
    }

    // Save to each participating resident's attendances
    let participatingResidents: Resident[] = [];
    if (newActivity.participationType === 'Todos os residentes') {
      participatingResidents = residents;
    } else if (newActivity.participationType === 'Grupo específico' || newActivity.participationType === 'Participação parcial') {
      participatingResidents = residents.filter(r => newActivity.selectedResidents.includes(r.id));
    }

    participatingResidents.forEach(res => {
      const updatedResident = { ...res };
      
      if (competence === 'nutricionista') {
        const existingGAs = updatedResident.nutrition?.groupActivities || [];
        const index = existingGAs.findIndex(a => a.id === newActivity.id);
        const replaced = index >= 0 ? existingGAs.map(a => a.id === newActivity.id ? newActivity : a) : [newActivity, ...existingGAs];
        updatedResident.nutrition = { ...updatedResident.nutrition, groupActivities: replaced };
      } else if (competence === 'psicologia') {
        const existingGAs = updatedResident.psychology?.groupActivities || [];
        const index = existingGAs.findIndex(a => a.id === newActivity.id);
        const replaced = index >= 0 ? existingGAs.map(a => a.id === newActivity.id ? newActivity : a) : [newActivity, ...existingGAs];
        updatedResident.psychology = { ...updatedResident.psychology, groupActivities: replaced };
      } else if (competence === 'terapeuta_ocupacional') {
        const existingGAs = updatedResident.occupationalTherapy?.groupActivities || [];
        const index = existingGAs.findIndex(a => a.id === newActivity.id);
        const replaced = index >= 0 ? existingGAs.map(a => a.id === newActivity.id ? newActivity : a) : [newActivity, ...existingGAs];
        updatedResident.occupationalTherapy = { ...updatedResident.occupationalTherapy, groupActivities: replaced };
      } else if (competence === 'fisioterapeuta') {
        const existingGAs = updatedResident.physiotherapy?.groupActivities || [];
        const index = existingGAs.findIndex(a => a.id === newActivity.id);
        const replaced = index >= 0 ? existingGAs.map(a => a.id === newActivity.id ? newActivity : a) : [newActivity, ...existingGAs];
        updatedResident.physiotherapy = { ...updatedResident.physiotherapy, groupActivities: replaced };
      }
      
      onSaveResident(updatedResident);
    });

    setIsFormOpen(false);
  };

  const handleDeleteActivity = async (id: string) => {
    if (window.confirm('Tem certeza que deseja arquivar esta atividade? O histórico será preservado.')) {
      await deleteGroupActivity(id);
      setActivities(prev => prev.filter(a => a.id !== id));
      
      // Update residents
      residents.forEach(res => {
        let updated = false;
        const updatedResident = { ...res };
        
        if (competence === 'nutricionista' && updatedResident.nutrition?.groupActivities) {
          const l = updatedResident.nutrition.groupActivities.length;
          updatedResident.nutrition.groupActivities = updatedResident.nutrition.groupActivities.filter(a => a.id !== id);
          if (l !== updatedResident.nutrition.groupActivities.length) updated = true;
        } else if (competence === 'psicologia' && updatedResident.psychology?.groupActivities) {
          const l = updatedResident.psychology.groupActivities.length;
          updatedResident.psychology.groupActivities = updatedResident.psychology.groupActivities.filter(a => a.id !== id);
          if (l !== updatedResident.psychology.groupActivities.length) updated = true;
        } else if (competence === 'terapeuta_ocupacional' && updatedResident.occupationalTherapy?.groupActivities) {
          const l = updatedResident.occupationalTherapy.groupActivities.length;
          updatedResident.occupationalTherapy.groupActivities = updatedResident.occupationalTherapy.groupActivities.filter(a => a.id !== id);
          if (l !== updatedResident.occupationalTherapy.groupActivities.length) updated = true;
        } else if (competence === 'fisioterapeuta' && updatedResident.physiotherapy?.groupActivities) {
          const l = updatedResident.physiotherapy.groupActivities.length;
          updatedResident.physiotherapy.groupActivities = updatedResident.physiotherapy.groupActivities.filter(a => a.id !== id);
          if (l !== updatedResident.physiotherapy.groupActivities.length) updated = true;
        }

        if (updated) {
          onSaveResident(updatedResident);
        }
      });
    }
  };

  if (isFormOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsFormOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-500" />
            </button>
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
              {editingId ? 'Editar Atividade' : 'Nova Atividade em Grupo'}
            </h3>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#004c99] text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors"
          >
            <Save size={16} /> Salvar Atividade
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Informações Básicas</h4>
              <div className="mb-4">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Status da Atividade</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, status: 'agendada' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                      formData.status === 'agendada' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Agendada
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, status: 'realizada' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                      formData.status === 'realizada' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Realizada
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, status: 'cancelada' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                      formData.status === 'cancelada' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    Cancelada
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Data</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Hora</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Tipo de Atividade</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                >
                  <option value="">Selecione...</option>
                  {ACTIVITY_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                  rows={3}
                  placeholder="Ex: Bingo com estímulo cognitivo e socialização"
                />
              </div>
            </div>

            {formData.status === 'realizada' && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 animate-in fade-in duration-300">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Resultado</h4>
                <div className="mb-4">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Resultado Geral</label>
                  <select
                    value={formData.result || ''}
                    onChange={(e) => setFormData({ ...formData, result: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                  >
                    <option value="">Selecione o Resultado...</option>
                    {RESULTS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Observações</label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                    rows={3}
                    placeholder="Observações adicionais sobre a atividade..."
                  />
                </div>
              </div>
            )}
            
            {formData.status === 'cancelada' && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in duration-300">
                <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Motivo do Cancelamento</h4>
                <div>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-3 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium bg-white"
                    rows={3}
                    placeholder="Especifique o motivo do cancelamento..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Participantes</h4>
              <div className="mb-4">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Participação dos Residentes</label>
                <select
                  value={formData.participationType}
                  onChange={(e) => setFormData({ ...formData, participationType: e.target.value as any, selectedResidents: [] })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                >
                  <option value="Todos os residentes">Todos os residentes</option>
                  <option value="Grupo específico">Grupo específico</option>
                  <option value="Participação parcial">Participação parcial</option>
                </select>
              </div>

              {(formData.participationType === 'Grupo específico' || formData.participationType === 'Participação parcial') && (
                <div className="mt-4 border border-gray-200 rounded-lg p-3 bg-white flex flex-col h-64">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-2">Selecione os Residentes</label>
                  
                  <div className="relative mb-3 flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Pesquisar por nome..."
                      value={residentSearchTerm}
                      onChange={(e) => setResidentSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#004c99] outline-none"
                    />
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                    {residents
                      .filter(r => r.name.toLowerCase().includes(residentSearchTerm.toLowerCase()))
                      .map(r => (
                      <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={formData.selectedResidents?.includes(r.id)}
                          onChange={() => handleResidentToggle(r.id)}
                          className="rounded border-gray-300 text-[#004c99] focus:ring-[#004c99]"
                        />
                        <span className="font-medium">{r.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Profissionais</h4>
              <div className="mb-4">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Profissional Responsável</label>
                <input
                  type="text"
                  value={formData.responsibleProfessional}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Profissionais Envolvidos (Opcional)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={involvedInput}
                    onChange={(e) => setInvolvedInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddInvolved()}
                    placeholder="Nome do profissional..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                  />
                  <button
                    onClick={handleAddInvolved}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-bold"
                  >
                    Adicionar
                  </button>
                </div>
                {formData.involvedProfessionals && formData.involvedProfessionals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.involvedProfessionals.map((prof, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold">
                        {prof}
                        <button onClick={() => handleRemoveInvolved(idx)} className="hover:text-red-500 ml-1">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-50 border p-2 rounded-xl">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Mural:</label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={formData.visibilidade?.includes('publico')}
                  onChange={(e) => {
                    const v = formData.visibilidade || [];
                    setFormData({ ...formData, visibilidade: e.target.checked ? [...v, 'publico'] : v.filter((x: string) => x !== 'publico') });
                  }}
                  className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-[#004c99] transition-colors">Público</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={formData.visibilidade?.includes('admin')}
                  onChange={(e) => {
                    const v = formData.visibilidade || [];
                    setFormData({ ...formData, visibilidade: e.target.checked ? [...v, 'admin'] : v.filter((x: string) => x !== 'admin') });
                  }}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-600"
                />
                <span className="text-[10px] font-black uppercase text-gray-600 group-hover:text-purple-600 transition-colors">Direção e coordenação</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
          <Users size={20} className="text-[#004c99]" />
          Atividades em Grupo
        </h3>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#004c99] text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors"
        >
          <Plus size={16} /> Nova Atividade
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Nenhuma atividade em grupo registrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map(activity => (
            <div key={activity.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#004c99] text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      {activity.type}
                    </span>
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(activity.date).toLocaleDateString('pt-BR')} às {activity.time}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                      activity.status === 'realizada' ? 'bg-green-100 text-green-700' :
                      activity.status === 'cancelada' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {activity.status || 'agendada'}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900">{activity.description}</h4>
                </div>
                <div className="flex gap-2 items-start">
                  {activity.result && (
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      activity.result === 'Excelente' ? 'bg-green-100 text-green-700' :
                      activity.result === 'Boa' ? 'bg-blue-100 text-blue-700' :
                      activity.result === 'Regular' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {activity.result}
                    </span>
                  )}
                  <button 
                    onClick={() => handleOpenEdit(activity)}
                    className="p-1.5 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-lg bg-white shadow-sm border border-gray-100 transition-colors"
                    title="Editar Atividade"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteActivity(activity.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg bg-white shadow-sm border border-gray-100 transition-colors"
                    title="Arquivar Atividade"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 text-sm">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Participação</p>
                  <p className="font-medium text-gray-700">{activity.participationType}</p>
                  {activity.participationType === 'Grupo específico' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {activity.selectedResidents.length} residente(s) selecionado(s)
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Profissionais</p>
                  <p className="font-medium text-gray-700">{activity.responsibleProfessional}</p>
                  {activity.involvedProfessionals.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      + {activity.involvedProfessionals.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              
              {activity.observations && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Observações</p>
                  {activity.observations}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupActivityTab;

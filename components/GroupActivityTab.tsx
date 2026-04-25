import React, { useState, useEffect } from 'react';
import { Resident, GroupActivity, MuralMessage } from '../types';
import { Plus, Save, ArrowLeft, Users, Calendar, CheckCircle } from 'lucide-react';
import { loadGroupActivities, saveGroupActivity } from '../lib/groupActivityStore';

interface GroupActivityTabProps {
  competence: 'nutricionista' | 'psicologia' | 'terapeuta_ocupacional';
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
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState<Partial<GroupActivity>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().substring(0, 5),
    type: '',
    description: '',
    participationType: 'Todos os residentes',
    selectedResidents: [],
    responsibleProfessional: currentUser.name || 'Profissional',
    involvedProfessionals: [],
    result: 'Boa',
    observations: '',
    sharedToMural: false
  });

  const [involvedInput, setInvolvedInput] = useState('');

  useEffect(() => {
    if (currentUser?.institutionId) {
      const loaded = loadGroupActivities(currentUser.institutionId);
      setActivities(loaded.filter(a => a.competence === competence).sort((a, b) => b.timestamp - a.timestamp));
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

  const handleSave = () => {
    if (!formData.date || !formData.time || !formData.type || !formData.description || !formData.result) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (formData.participationType === 'Grupo específico' && (!formData.selectedResidents || formData.selectedResidents.length === 0)) {
      alert('Selecione pelo menos um residente para o grupo específico.');
      return;
    }

    const newActivity: GroupActivity = {
      id: Date.now().toString(),
      institutionId: currentUser?.institutionId || 'default-inst',
      competence,
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
      sharedToMural: formData.sharedToMural || false,
      timestamp: Date.now()
    };

    // Save to global store
    saveGroupActivity(newActivity);
    setActivities(prev => [newActivity, ...prev]);

    // Save to Mural if checked
    if (newActivity.sharedToMural && onPostToMural) {
      onPostToMural({
        author: newActivity.responsibleProfessional,
        text: `Atividade em Grupo (${newActivity.type}): ${newActivity.description}. Resultado: ${newActivity.result}.`,
      });
    }

    // Save to each participating resident's attendances
    let participatingResidents: Resident[] = [];
    if (newActivity.participationType === 'Todos os residentes') {
      participatingResidents = residents;
    } else if (newActivity.participationType === 'Grupo específico') {
      participatingResidents = residents.filter(r => newActivity.selectedResidents.includes(r.id));
    }
    // If 'Participação parcial', participatingResidents remains empty, so it's not saved to individual timelines.

    participatingResidents.forEach(res => {
      const updatedResident = { ...res };
      const dateTime = `${newActivity.date}T${newActivity.time}`;
      
      if (competence === 'nutricionista') {
        updatedResident.nutrition = {
          ...updatedResident.nutrition,
          groupActivities: [newActivity, ...(updatedResident.nutrition?.groupActivities || [])]
        };
      } else if (competence === 'psicologia') {
        updatedResident.psychology = {
          ...updatedResident.psychology,
          groupActivities: [newActivity, ...(updatedResident.psychology?.groupActivities || [])]
        };
      } else if (competence === 'terapeuta_ocupacional') {
        updatedResident.occupationalTherapy = {
          ...updatedResident.occupationalTherapy,
          groupActivities: [newActivity, ...(updatedResident.occupationalTherapy?.groupActivities || [])]
        };
      }
      
      onSaveResident(updatedResident);
    });

    setIsCreating(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().substring(0, 5),
      type: '',
      description: '',
      participationType: 'Todos os residentes',
      selectedResidents: [],
      responsibleProfessional: currentUser.name || 'Profissional',
      involvedProfessionals: [],
      result: 'Boa',
      observations: '',
      sharedToMural: false
    });
  };

  if (isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCreating(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-500" />
            </button>
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Nova Atividade em Grupo</h3>
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

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Resultado</h4>
              <div className="mb-4">
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-1">Resultado Geral</label>
                <select
                  value={formData.result}
                  onChange={(e) => setFormData({ ...formData, result: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm font-medium"
                >
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

              {formData.participationType === 'Grupo específico' && (
                <div className="mt-4 border border-gray-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-tighter mb-2">Selecione os Residentes</label>
                  <div className="space-y-2">
                    {residents.map(r => (
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

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.sharedToMural}
                  onChange={(e) => setFormData({ ...formData, sharedToMural: e.target.checked })}
                  className="w-5 h-5 rounded border-blue-300 text-[#004c99] focus:ring-[#004c99]"
                />
                <div>
                  <span className="block text-sm font-bold text-blue-900">Compartilhar no Mural</span>
                  <span className="block text-xs text-blue-700">Enviar resumo desta atividade para o mural da equipe</span>
                </div>
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
          onClick={() => setIsCreating(true)}
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
                  </div>
                  <h4 className="font-bold text-gray-900">{activity.description}</h4>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    activity.result === 'Excelente' ? 'bg-green-100 text-green-700' :
                    activity.result === 'Boa' ? 'bg-blue-100 text-blue-700' :
                    activity.result === 'Regular' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {activity.result}
                  </span>
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

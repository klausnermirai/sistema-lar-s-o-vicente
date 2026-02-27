import React, { useState, useEffect } from 'react';
import { Resident, NutritionalEvolution, NutritionalAttendance, PsychologicalEvolution, PsychologicalAttendance } from '../types';
import { Search, Save, AlertTriangle, Plus, ChevronRight, ArrowLeft } from 'lucide-react';

interface MultidisciplinaryModuleProps {
  residents: Resident[];
  onSaveResident: (resident: Resident) => void;
}

const MultidisciplinaryModule: React.FC<MultidisciplinaryModuleProps> = ({ residents, onSaveResident }) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [activeCompetence, setActiveCompetence] = useState<'nutricionista' | 'psicologia'>('nutricionista');
  const [activeTab, setActiveTab] = useState<'avaliacao' | 'evolucao' | 'atendimentos' | 'anamnese'>('avaliacao');
  
  const selectedResident = residents.find(r => r.id === selectedResidentId);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Atendimento Multidisciplinar</h1>
        <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">
          Selecione um residente e a competência desejada
        </p>
        
        <div className="mt-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <select
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] bg-white shadow-inner text-sm font-medium appearance-none"
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
            >
              <option value="">Selecione um residente...</option>
              {residents.map(r => (
                <option key={r.id} value={r.id}>{r.name} (CPF: {r.cpf})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedResident && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Competence Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Competências</h3>
              </div>
              <div className="p-2 space-y-1">
                <button
                  onClick={() => setActiveCompetence('nutricionista')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold uppercase transition-all ${
                    activeCompetence === 'nutricionista'
                      ? 'bg-[#004c99] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Nutricionista
                </button>
                <button
                  onClick={() => setActiveCompetence('psicologia')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold uppercase transition-all ${
                    activeCompetence === 'psicologia'
                      ? 'bg-[#004c99] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Psicologia
                </button>
                {/* Outras competências podem ser adicionadas aqui no futuro */}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden">
            {activeCompetence === 'nutricionista' && (
              <>
                <div className="flex border-b overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveTab('avaliacao')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'avaliacao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Primeira Avaliação Nutricional
                  </button>
                  <button
                    onClick={() => setActiveTab('evolucao')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'evolucao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Evolução Nutricional
                  </button>
                  <button
                    onClick={() => setActiveTab('atendimentos')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'atendimentos' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Atendimentos
                  </button>
                </div>

                <div className="p-6">
                  {activeTab === 'avaliacao' && (
                    <NutritionalAssessmentForm 
                      resident={selectedResident} 
                      onSave={(data) => {
                        const updatedResident = {
                          ...selectedResident,
                          nutrition: {
                            ...selectedResident.nutrition,
                            initialAssessment: data
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                  {activeTab === 'evolucao' && (
                    <NutritionalEvolutionSection 
                      resident={selectedResident} 
                      onSave={(evolutions) => {
                        const updatedResident = {
                          ...selectedResident,
                          nutrition: {
                            ...selectedResident.nutrition,
                            evolutions: evolutions
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                  {activeTab === 'atendimentos' && (
                    <NutritionalAttendanceSection 
                      resident={selectedResident} 
                      onSave={(attendances) => {
                        const updatedResident = {
                          ...selectedResident,
                          nutrition: {
                            ...selectedResident.nutrition,
                            attendances: attendances
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                </div>
              </>
            )}
            {activeCompetence === 'psicologia' && (
              <>
                <div className="flex border-b overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveTab('anamnese')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'anamnese' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Anamnese
                  </button>
                  <button
                    onClick={() => setActiveTab('avaliacao')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'avaliacao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Primeira Avaliação Psicológica
                  </button>
                  <button
                    onClick={() => setActiveTab('evolucao')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'evolucao' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Evolução Psicológica
                  </button>
                  <button
                    onClick={() => setActiveTab('atendimentos')}
                    className={`px-6 py-4 text-[10px] font-black uppercase transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === 'atendimentos' ? 'border-[#004c99] text-[#004c99]' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Atendimentos
                  </button>
                </div>

                <div className="p-6">
                  {activeTab === 'anamnese' && (
                    <PsychologicalAssessmentForm 
                      resident={selectedResident} 
                      isAnamnese={true}
                      onSave={(data) => {
                        const updatedResident = {
                          ...selectedResident,
                          psychology: {
                            ...selectedResident.psychology,
                            anamnese: data
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                  {activeTab === 'avaliacao' && (
                    <PsychologicalAssessmentForm 
                      resident={selectedResident} 
                      onSave={(data) => {
                        const updatedResident = {
                          ...selectedResident,
                          psychology: {
                            ...selectedResident.psychology,
                            initialAssessment: data
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                  {activeTab === 'evolucao' && (
                    <PsychologicalEvolutionSection 
                      resident={selectedResident} 
                      onSave={(evolutions) => {
                        const updatedResident = {
                          ...selectedResident,
                          psychology: {
                            ...selectedResident.psychology,
                            evolutions: evolutions
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                  {activeTab === 'atendimentos' && (
                    <PsychologicalAttendanceSection 
                      resident={selectedResident} 
                      onSave={(attendances) => {
                        const updatedResident = {
                          ...selectedResident,
                          psychology: {
                            ...selectedResident.psychology,
                            attendances: attendances
                          }
                        };
                        onSaveResident(updatedResident);
                      }} 
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface NutritionalAssessmentFormProps {
  resident: Resident;
  onSave: (data: any) => void;
}

const NutritionalAssessmentForm: React.FC<NutritionalAssessmentFormProps> = ({ resident, onSave }) => {
  const initialData = resident.nutrition?.initialAssessment || {
    date: new Date().toISOString().split('T')[0],
    weight: '',
    height: '',
    calfCircumference: '',
    chronicDiseases: [],
    otherChronicDisease: '',
    feedingRoute: '',
    dietConsistency: '',
    oralHealth: [],
    foodLikes: '',
    foodDislikes: '',
    foodAllergies: '',
    initialDiagnosis: '',
    needsSupplementation: false,
    supplementationDetails: '',
    piaGoals: ''
  };

  const [formData, setFormData] = useState<any>(initialData);

  const calculateBMI = () => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (w > 0 && h > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return '';
  };

  const handleCheckboxChange = (field: string, value: string) => {
    const currentList = formData[field] as string[];
    if (currentList.includes(value)) {
      setFormData({ ...formData, [field]: currentList.filter(item => item !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentList, value] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      height: formData.height ? parseFloat(formData.height) : undefined,
      calfCircumference: formData.calfCircumference ? parseFloat(formData.calfCircumference) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Primeira Avaliação Nutricional (Abastece o PIA)</h2>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
      </div>

      {/* A) Dados Antropométricos e Clínicos */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">A) Dados Antropométricos e Clínicos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peso Atual (kg)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.weight} 
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Altura (m)</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.height} 
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">IMC Atual</label>
            <input 
              type="text" 
              value={calculateBMI()} 
              readOnly
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Circunf. Panturrilha (cm)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.calfCircumference} 
              onChange={(e) => setFormData({ ...formData, calfCircumference: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Doenças Crônicas de Impacto Nutricional</label>
          <div className="flex flex-wrap gap-4">
            {['Diabetes', 'Hipertensão', 'Dislipidemia', 'Doença Renal', 'Outro'].map(disease => (
              <label key={disease} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.chronicDiseases.includes(disease)}
                  onChange={() => handleCheckboxChange('chronicDiseases', disease)}
                  className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                {disease}
              </label>
            ))}
          </div>
          {formData.chronicDiseases.includes('Outro') && (
            <div className="mt-3">
              <input 
                type="text" 
                placeholder="Qual?"
                value={formData.otherChronicDisease} 
                onChange={(e) => setFormData({ ...formData, otherChronicDisease: e.target.value })}
                className="w-full md:w-1/2 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              />
            </div>
          )}
        </div>
      </section>

      {/* B) Via e Perfil de Alimentação */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">B) Via e Perfil de Alimentação</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Via de Alimentação</label>
            <select 
              value={formData.feedingRoute} 
              onChange={(e) => setFormData({ ...formData, feedingRoute: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Oral">Oral</option>
              <option value="Sonda Nasoenteral (SNE)">Sonda Nasoenteral (SNE)</option>
              <option value="Gastrostomia (GTT)">Gastrostomia (GTT)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consistência da Dieta Recomendada</label>
            <select 
              value={formData.dietConsistency} 
              onChange={(e) => setFormData({ ...formData, dietConsistency: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Normal/Livre">Normal/Livre</option>
              <option value="Branda">Branda</option>
              <option value="Pastosa">Pastosa</option>
              <option value="Líquida-pastosa">Líquida-pastosa</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Saúde Oral e Deglutição</label>
          <div className="flex flex-wrap gap-4">
            {['Usa prótese dentária total', 'Usa prótese dentária parcial', 'Ausência de dentes', 'Histórico de engasgos/disfagia'].map(item => (
              <label key={item} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.oralHealth.includes(item)}
                  onChange={() => handleCheckboxChange('oralHealth', item)}
                  className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                />
                {item}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* C) Preferências e Necessidades */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">C) Preferências e Necessidades</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gostos Alimentares</label>
            <textarea 
              rows={3}
              value={formData.foodLikes} 
              onChange={(e) => setFormData({ ...formData, foodLikes: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aversões e Restrições/Intolerâncias</label>
            <textarea 
              rows={3}
              value={formData.foodDislikes} 
              onChange={(e) => setFormData({ ...formData, foodDislikes: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Alergias Alimentares Graves</label>
          <div className={`relative rounded-xl border ${formData.foodAllergies ? 'border-red-300 bg-red-50' : 'border-gray-200'} overflow-hidden transition-colors`}>
            {formData.foodAllergies && (
              <div className="absolute top-3 right-3 text-red-500">
                <AlertTriangle size={20} />
              </div>
            )}
            <textarea 
              rows={2}
              value={formData.foodAllergies} 
              onChange={(e) => setFormData({ ...formData, foodAllergies: e.target.value })}
              className={`w-full p-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none bg-transparent ${formData.foodAllergies ? 'text-red-900 font-bold' : ''}`}
              placeholder="Descreva alergias graves (se houver)..."
            />
          </div>
        </div>
      </section>

      {/* D) Conclusão para o PIA */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">D) Conclusão para o PIA</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Diagnóstico Nutricional Inicial</label>
            <textarea 
              rows={3}
              value={formData.initialDiagnosis} 
              onChange={(e) => setFormData({ ...formData, initialDiagnosis: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Necessidade de Suplementação?</label>
            <div className="flex items-center gap-6 mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="radio" 
                  checked={formData.needsSupplementation === true}
                  onChange={() => setFormData({ ...formData, needsSupplementation: true })}
                  className="w-4 h-4 text-[#004c99] focus:ring-[#004c99]"
                />
                Sim
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input 
                  type="radio" 
                  checked={formData.needsSupplementation === false}
                  onChange={() => setFormData({ ...formData, needsSupplementation: false, supplementationDetails: '' })}
                  className="w-4 h-4 text-[#004c99] focus:ring-[#004c99]"
                />
                Não
              </label>
            </div>
            {formData.needsSupplementation && (
              <input 
                type="text" 
                placeholder="Qual suplementação?"
                value={formData.supplementationDetails} 
                onChange={(e) => setFormData({ ...formData, supplementationDetails: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metas Nutricionais para o PIA</label>
            <textarea 
              rows={3}
              value={formData.piaGoals} 
              onChange={(e) => setFormData({ ...formData, piaGoals: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={() => setFormData(initialData)}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Avaliação</span>
        </button>
      </div>
    </form>
  );
};

interface NutritionalEvolutionSectionProps {
  resident: Resident;
  onSave: (evolutions: NutritionalEvolution[]) => void;
}

const NutritionalEvolutionSection: React.FC<NutritionalEvolutionSectionProps> = ({ resident, onSave }) => {
  const [editingEvolution, setEditingEvolution] = useState<NutritionalEvolution | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const evolutions = resident.nutrition?.evolutions || [];

  const handleSave = (evolution: NutritionalEvolution) => {
    let newEvolutions;
    if (isCreating) {
      newEvolutions = [evolution, ...evolutions];
    } else {
      newEvolutions = evolutions.map(e => e.id === evolution.id ? evolution : e);
    }
    
    // Sort by date descending
    newEvolutions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    onSave(newEvolutions);
    setEditingEvolution(null);
    setIsCreating(false);
  };

  if (isCreating || editingEvolution) {
    return (
      <NutritionalEvolutionForm 
        resident={resident}
        evolution={editingEvolution}
        onSave={handleSave}
        onCancel={() => {
          setEditingEvolution(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Evoluções</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
        >
          <Plus size={18} /> Nova Evolução
        </button>
      </div>

      {evolutions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-bold uppercase text-sm">Nenhuma evolução registrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {evolutions.map(evolution => (
            <div key={evolution.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-[#004c99] transition-colors group">
              <div>
                <div className="font-black text-gray-800 text-sm">{new Date(evolution.date).toLocaleDateString('pt-BR')}</div>
                <div className="text-xs text-gray-500 font-bold uppercase mt-1">
                  Peso: {evolution.weight} kg 
                  {evolution.weightVariationPercent !== undefined && (
                    <span className={`ml-2 ${evolution.weightVariationPercent <= -5 ? 'text-red-600' : 'text-gray-400'}`}>
                      ({evolution.weightVariationPercent > 0 ? '+' : ''}{evolution.weightVariationPercent}%)
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setEditingEvolution(evolution)}
                className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface NutritionalEvolutionFormProps {
  resident: Resident;
  evolution: NutritionalEvolution | null;
  onSave: (evolution: NutritionalEvolution) => void;
  onCancel: () => void;
}

const NutritionalEvolutionForm: React.FC<NutritionalEvolutionFormProps> = ({ resident, evolution, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(evolution || {
    id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    weight: '',
    foodAcceptance: '',
    changedConsistencyOrRoute: false,
    changeJustification: '',
    piaGoalStatus: '',
    newConduct: ''
  });

  const getReferenceWeight = () => {
    if (evolution && evolution.weightVariationPercent !== undefined) {
      // If editing an existing evolution, we don't recalculate unless weight changes, 
      // but for simplicity, let's find the previous weight.
      // Actually, we should find the most recent weight *before* this evolution's date.
    }
    
    const evolutions = resident.nutrition?.evolutions || [];
    // Sort ascending by date
    const sortedEvolutions = [...evolutions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let refWeight: number | undefined;
    
    if (evolution) {
      // Find the evolution just before this one
      const currentIndex = sortedEvolutions.findIndex(e => e.id === evolution.id);
      if (currentIndex > 0) {
        refWeight = sortedEvolutions[currentIndex - 1].weight;
      }
    } else {
      // Creating new: get the last evolution's weight
      if (sortedEvolutions.length > 0) {
        refWeight = sortedEvolutions[sortedEvolutions.length - 1].weight;
      }
    }

    // If no previous evolution, fallback to initial assessment
    if (refWeight === undefined) {
      refWeight = resident.nutrition?.initialAssessment?.weight;
    }

    return refWeight;
  };

  const calculateVariation = (currentWeight: string | number) => {
    const w = typeof currentWeight === 'string' ? parseFloat(currentWeight) : currentWeight;
    if (isNaN(w) || w <= 0) return undefined;

    const refWeight = getReferenceWeight();
    if (refWeight && refWeight > 0) {
      return Number((((w - refWeight) / refWeight) * 100).toFixed(1));
    }
    return undefined;
  };

  const variation = calculateVariation(formData.weight);
  const isAlert = variation !== undefined && variation <= -5.0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      weightVariationPercent: variation,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {evolution ? 'Editar Evolução Nutricional' : 'Nova Evolução Nutricional'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Peso Atual (kg)</label>
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              step="0.1"
              value={formData.weight} 
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
              required
            />
            {variation !== undefined && (
              <div className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${isAlert ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {variation > 0 ? '+' : ''}{variation}%
              </div>
            )}
          </div>
          {isAlert && (
            <div className="mt-2 flex items-center gap-2 text-red-600 text-xs font-bold uppercase">
              <AlertTriangle size={14} />
              ALERTA: Perda de peso &gt; 5%
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aceitação Alimentar no Período</label>
          <select 
            value={formData.foodAcceptance} 
            onChange={(e) => setFormData({ ...formData, foodAcceptance: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Excelente">Excelente</option>
            <option value="Boa">Boa</option>
            <option value="Regular">Regular</option>
            <option value="Ruim/Recusa">Ruim/Recusa</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status da Meta do PIA</label>
          <select 
            value={formData.piaGoalStatus} 
            onChange={(e) => setFormData({ ...formData, piaGoalStatus: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Atingida">Atingida</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Não atingida">Não atingida</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Houve mudança na consistência ou via de alimentação?</label>
        <div className="flex items-center gap-6 mb-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input 
              type="radio" 
              checked={formData.changedConsistencyOrRoute === true}
              onChange={() => setFormData({ ...formData, changedConsistencyOrRoute: true })}
              className="w-4 h-4 text-[#004c99] focus:ring-[#004c99]"
            />
            Sim
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input 
              type="radio" 
              checked={formData.changedConsistencyOrRoute === false}
              onChange={() => setFormData({ ...formData, changedConsistencyOrRoute: false, changeJustification: '' })}
              className="w-4 h-4 text-[#004c99] focus:ring-[#004c99]"
            />
            Não
          </label>
        </div>
        {formData.changedConsistencyOrRoute && (
          <input 
            type="text" 
            placeholder="Qual a justificativa da mudança?"
            value={formData.changeJustification} 
            onChange={(e) => setFormData({ ...formData, changeJustification: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        )}
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nova Conduta / Ajuste de Plano</label>
        <textarea 
          rows={4}
          value={formData.newConduct} 
          onChange={(e) => setFormData({ ...formData, newConduct: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Evolução</span>
        </button>
      </div>
    </form>
  );
};

interface NutritionalAttendanceSectionProps {
  resident: Resident;
  onSave: (attendances: NutritionalAttendance[]) => void;
}

const NutritionalAttendanceSection: React.FC<NutritionalAttendanceSectionProps> = ({ resident, onSave }) => {
  const [editingAttendance, setEditingAttendance] = useState<NutritionalAttendance | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const attendances = resident.nutrition?.attendances || [];

  const handleSave = (attendance: NutritionalAttendance) => {
    let newAttendances;
    if (isCreating) {
      newAttendances = [attendance, ...attendances];
    } else {
      newAttendances = attendances.map(a => a.id === attendance.id ? attendance : a);
    }
    
    // Sort by date descending
    newAttendances.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    
    onSave(newAttendances);
    setEditingAttendance(null);
    setIsCreating(false);
  };

  if (isCreating || editingAttendance) {
    return (
      <NutritionalAttendanceForm 
        attendance={editingAttendance}
        onSave={handleSave}
        onCancel={() => {
          setEditingAttendance(null);
          setIsCreating(false);
        }}
      />
    );
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Atendimentos</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
        >
          <Plus size={18} /> Novo Atendimento
        </button>
      </div>

      {attendances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-bold uppercase text-sm">Nenhum atendimento registrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendances.map(attendance => (
            <div key={attendance.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-[#004c99] transition-colors group">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-black text-gray-800 text-sm">{formatDateTime(attendance.dateTime)}</div>
                  {attendance.muralNotes && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      Vai para o mural
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-bold uppercase mt-1">
                  Motivo: <span className="text-gray-700">{attendance.reason}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                  Profissional: {attendance.signature}
                </div>
              </div>
              <button 
                onClick={() => setEditingAttendance(attendance)}
                className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface NutritionalAttendanceFormProps {
  attendance: NutritionalAttendance | null;
  onSave: (attendance: NutritionalAttendance) => void;
  onCancel: () => void;
}

const NutritionalAttendanceForm: React.FC<NutritionalAttendanceFormProps> = ({ attendance, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(attendance || {
    id: Date.now().toString(),
    dateTime: new Date().toISOString().slice(0, 16), // YYYY-MM-DDThh:mm
    reason: '',
    notes: '',
    muralNotes: '',
    signature: ''
  });

  useEffect(() => {
    if (!attendance) {
      // Try to get the logged-in user's name
      const sessionStr = localStorage.getItem('ssvp_session');
      let signatureName = 'Usuário';
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          if (session.username) {
            signatureName = session.username;
          }
        } catch (e) {
          console.error('Error parsing session', e);
        }
      }
      
      // Adjust timezone offset for local datetime-local input
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);

      setFormData(prev => ({
        ...prev,
        dateTime: localISOTime,
        signature: signatureName
      }));
    }
  }, [attendance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as NutritionalAttendance);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {attendance ? 'Visualizar / Editar Atendimento' : 'Novo Atendimento'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data e Hora</label>
          <input 
            type="datetime-local" 
            value={formData.dateTime} 
            onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Motivo do Registro</label>
          <select 
            value={formData.reason} 
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Visita de rotina">Visita de rotina</option>
            <option value="Queixa do residente">Queixa do residente</option>
            <option value="Solicitação da enfermagem">Solicitação da enfermagem</option>
            <option value="Recusa alimentar pontual">Recusa alimentar pontual</option>
            <option value="Alteração intestinal">Alteração intestinal</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Anotação do Prontuário</label>
        <textarea 
          rows={6}
          value={formData.notes} 
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Compartilhar no Mural <span className="text-[#004c99] lowercase">(opcional)</span></label>
        <textarea 
          rows={4}
          value={formData.muralNotes} 
          onChange={(e) => setFormData({ ...formData, muralNotes: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          placeholder="Anotação que será visível para toda a equipe no mural..."
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assinatura do Profissional</label>
        <input 
          type="text" 
          value={formData.signature} 
          readOnly
          className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm"
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Atendimento</span>
        </button>
      </div>
    </form>
  );
};

interface PsychologicalAssessmentFormProps {
  resident: Resident;
  isAnamnese?: boolean;
  onSave: (data: any) => void;
}

const PsychologicalAssessmentForm: React.FC<PsychologicalAssessmentFormProps> = ({ resident, isAnamnese, onSave }) => {
  const initialData = (isAnamnese ? resident.psychology?.anamnese : resident.psychology?.initialAssessment) || {
    date: new Date().toISOString().split('T')[0],
    institutionalizationAwareness: '',
    initialEmotionalReaction: [],
    recentGriefsAndLosses: '',
    traumasAndEmotionalTriggers: '',
    orientationLevel: '',
    moodScreeningGDS: '',
    cognitiveScreeningMMSE: '',
    familyBondQuality: '',
    visitExpectations: '',
    initialPsychologicalSynthesis: '',
    piaPsychologicalGoals: ''
  };

  const [formData, setFormData] = useState<any>(initialData);

  const handleCheckboxChange = (field: string, value: string) => {
    const currentList = formData[field] as string[];
    if (currentList.includes(value)) {
      setFormData({ ...formData, [field]: currentList.filter(item => item !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentList, value] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      cognitiveScreeningMMSE: formData.cognitiveScreeningMMSE ? parseFloat(formData.cognitiveScreeningMMSE) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {isAnamnese ? 'Anamnese' : 'Primeira Avaliação Psicológica (Abastece o PIA)'}
        </h2>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
      </div>

      {/* A) Histórico e Aspectos Emocionais */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">A) Histórico e Aspectos Emocionais</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Consciência da Institucionalização</label>
            <select 
              value={formData.institutionalizationAwareness} 
              onChange={(e) => setFormData({ ...formData, institutionalizationAwareness: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Veio por vontade própria">Veio por vontade própria</option>
              <option value="Veio persuadido/sem clareza">Veio persuadido/sem clareza</option>
              <option value="Trouxe resistência">Trouxe resistência</option>
              <option value="Incapaz de opinar devido à cognição">Incapaz de opinar devido à cognição</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Reação Emocional Inicial</label>
            <div className="flex flex-wrap gap-4">
              {['Apatia', 'Tristeza/Choro', 'Agressividade/Irritação', 'Ansiedade', 'Tranquilidade/Aceitação'].map(item => (
                <label key={item} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.initialEmotionalReaction.includes(item)}
                    onChange={() => handleCheckboxChange('initialEmotionalReaction', item)}
                    className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lutos e Perdas Recentes</label>
            <textarea 
              rows={3}
              value={formData.recentGriefsAndLosses} 
              onChange={(e) => setFormData({ ...formData, recentGriefsAndLosses: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Traumas e Gatilhos Emocionais</label>
            <div className={`relative rounded-xl border ${formData.traumasAndEmotionalTriggers ? 'border-red-300 bg-red-50' : 'border-gray-200'} overflow-hidden transition-colors`}>
              {formData.traumasAndEmotionalTriggers && (
                <div className="absolute top-3 right-3 text-red-500">
                  <AlertTriangle size={20} />
                </div>
              )}
              <textarea 
                rows={3}
                value={formData.traumasAndEmotionalTriggers} 
                onChange={(e) => setFormData({ ...formData, traumasAndEmotionalTriggers: e.target.value })}
                className={`w-full p-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none bg-transparent ${formData.traumasAndEmotionalTriggers ? 'text-red-900 font-bold' : ''}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* B) Rastreio Cognitivo e de Humor */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">B) Rastreio Cognitivo e de Humor (opcional)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nível de Orientação</label>
            <select 
              value={formData.orientationLevel} 
              onChange={(e) => setFormData({ ...formData, orientationLevel: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Orientado no tempo e espaço">Orientado no tempo e espaço</option>
              <option value="Desorientação leve/flutuante">Desorientação leve/flutuante</option>
              <option value="Desorientação grave">Desorientação grave</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rastreio de Humor (GDS)</label>
            <select 
              value={formData.moodScreeningGDS} 
              onChange={(e) => setFormData({ ...formData, moodScreeningGDS: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Sem indicativo">Sem indicativo</option>
              <option value="Depressão Leve">Depressão Leve</option>
              <option value="Depressão Severa">Depressão Severa</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rastreio Cognitivo (Mini-Mental)</label>
            <input 
              type="number" 
              value={formData.cognitiveScreeningMMSE} 
              onChange={(e) => setFormData({ ...formData, cognitiveScreeningMMSE: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            />
          </div>
        </div>
      </section>

      {/* C) Rede de Apoio e Vínculos */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">C) Rede de Apoio e Vínculos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Qualidade do Vínculo Familiar</label>
            <select 
              value={formData.familyBondQuality} 
              onChange={(e) => setFormData({ ...formData, familyBondQuality: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            >
              <option value="">Selecione...</option>
              <option value="Preservado/Presente">Preservado/Presente</option>
              <option value="Conflituoso">Conflituoso</option>
              <option value="Frágil/Ausente">Frágil/Ausente</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expectativa de Visitas</label>
            <textarea 
              rows={3}
              value={formData.visitExpectations} 
              onChange={(e) => setFormData({ ...formData, visitExpectations: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>
      </section>

      {/* D) Conclusão para o PIA */}
      <section>
        <h3 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">D) Conclusão para o PIA</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Síntese Psicológica Inicial</label>
            <textarea 
              rows={3}
              value={formData.initialPsychologicalSynthesis} 
              onChange={(e) => setFormData({ ...formData, initialPsychologicalSynthesis: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Metas Psicológicas para o PIA <span className="text-[#004c99] lowercase">(alimentará o PIA futuramente)</span></label>
            <textarea 
              rows={3}
              value={formData.piaPsychologicalGoals} 
              onChange={(e) => setFormData({ ...formData, piaPsychologicalGoals: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={() => setFormData(initialData)}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Avaliação</span>
        </button>
      </div>
    </form>
  );
};

interface PsychologicalEvolutionSectionProps {
  resident: Resident;
  onSave: (evolutions: PsychologicalEvolution[]) => void;
}

const PsychologicalEvolutionSection: React.FC<PsychologicalEvolutionSectionProps> = ({ resident, onSave }) => {
  const [editingEvolution, setEditingEvolution] = useState<PsychologicalEvolution | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const evolutions = resident.psychology?.evolutions || [];

  const handleSave = (evolution: PsychologicalEvolution) => {
    let newEvolutions;
    if (isCreating) {
      newEvolutions = [evolution, ...evolutions];
    } else {
      newEvolutions = evolutions.map(e => e.id === evolution.id ? evolution : e);
    }
    
    // Sort by date descending
    newEvolutions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    onSave(newEvolutions);
    setEditingEvolution(null);
    setIsCreating(false);
  };

  if (isCreating || editingEvolution) {
    return (
      <PsychologicalEvolutionForm 
        evolution={editingEvolution}
        onSave={handleSave}
        onCancel={() => {
          setEditingEvolution(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Evoluções</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
        >
          <Plus size={18} /> Nova Evolução
        </button>
      </div>

      {evolutions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-bold uppercase text-sm">Nenhuma evolução registrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {evolutions.map(evolution => (
            <div key={evolution.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-[#004c99] transition-colors group">
              <div>
                <div className="font-black text-gray-800 text-sm">{new Date(evolution.date).toLocaleDateString('pt-BR')}</div>
                <div className="text-xs text-gray-500 font-bold uppercase mt-1">
                  Adaptação: <span className="text-gray-700">{evolution.institutionalAdaptationStatus || 'N/D'}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                  Meta PIA: {evolution.piaGoalStatus || 'N/D'}
                </div>
              </div>
              <button 
                onClick={() => setEditingEvolution(evolution)}
                className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface PsychologicalEvolutionFormProps {
  evolution: PsychologicalEvolution | null;
  onSave: (evolution: PsychologicalEvolution) => void;
  onCancel: () => void;
}

const PsychologicalEvolutionForm: React.FC<PsychologicalEvolutionFormProps> = ({ evolution, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(evolution || {
    id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    institutionalAdaptationStatus: '',
    moodBehaviorEvolution: '',
    currentSocializationQuality: [],
    piaGoalStatus: '',
    newConduct: ''
  });

  const handleCheckboxChange = (field: string, value: string) => {
    const currentList = formData[field] as string[];
    if (currentList.includes(value)) {
      setFormData({ ...formData, [field]: currentList.filter(item => item !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentList, value] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as PsychologicalEvolution);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {evolution ? 'Editar Evolução Psicológica' : 'Nova Evolução Psicológica'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status de Adaptação Institucional</label>
          <select 
            value={formData.institutionalAdaptationStatus} 
            onChange={(e) => setFormData({ ...formData, institutionalAdaptationStatus: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Totalmente adaptado">Totalmente adaptado</option>
            <option value="Em adaptação">Em adaptação</option>
            <option value="Não adaptado/Resistente">Não adaptado/Resistente</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Evolução do Humor e Comportamento</label>
          <select 
            value={formData.moodBehaviorEvolution} 
            onChange={(e) => setFormData({ ...formData, moodBehaviorEvolution: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Estável">Estável</option>
            <option value="Melhora progressiva">Melhora progressiva</option>
            <option value="Declínio cognitivo notado">Declínio cognitivo notado</option>
            <option value="Piora no humor/Apatia">Piora no humor/Apatia</option>
            <option value="Aumento de agitação">Aumento de agitação</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status da Meta do PIA</label>
          <select 
            value={formData.piaGoalStatus} 
            onChange={(e) => setFormData({ ...formData, piaGoalStatus: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Atingida">Atingida</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Não atingida">Não atingida</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Qualidade da Socialização Atual</label>
        <div className="flex flex-wrap gap-4">
          {['Participa das atividades propostas', 'Interage com colegas', 'Tende ao isolamento', 'Fica restrito ao leito'].map(item => (
            <label key={item} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={formData.currentSocializationQuality.includes(item)}
                onChange={() => handleCheckboxChange('currentSocializationQuality', item)}
                className="w-4 h-4 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nova Conduta / Ajuste de Plano</label>
        <textarea 
          rows={4}
          value={formData.newConduct} 
          onChange={(e) => setFormData({ ...formData, newConduct: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Evolução</span>
        </button>
      </div>
    </form>
  );
};

interface PsychologicalAttendanceSectionProps {
  resident: Resident;
  onSave: (attendances: PsychologicalAttendance[]) => void;
}

const PsychologicalAttendanceSection: React.FC<PsychologicalAttendanceSectionProps> = ({ resident, onSave }) => {
  const [editingAttendance, setEditingAttendance] = useState<PsychologicalAttendance | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const attendances = resident.psychology?.attendances || [];

  const handleSave = (attendance: PsychologicalAttendance) => {
    let newAttendances;
    if (isCreating) {
      newAttendances = [attendance, ...attendances];
    } else {
      newAttendances = attendances.map(a => a.id === attendance.id ? attendance : a);
    }
    
    // Sort by date descending
    newAttendances.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    
    onSave(newAttendances);
    setEditingAttendance(null);
    setIsCreating(false);
  };

  if (isCreating || editingAttendance) {
    return (
      <PsychologicalAttendanceForm 
        attendance={editingAttendance}
        onSave={handleSave}
        onCancel={() => {
          setEditingAttendance(null);
          setIsCreating(false);
        }}
      />
    );
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Histórico de Atendimentos</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 text-xs font-black text-white bg-[#004c99] hover:bg-blue-800 px-6 py-3 rounded-xl shadow-lg uppercase transition-all"
        >
          <Plus size={18} /> Novo Atendimento
        </button>
      </div>

      {attendances.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-bold uppercase text-sm">Nenhum atendimento registrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendances.map(attendance => (
            <div key={attendance.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-[#004c99] transition-colors group">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-black text-gray-800 text-sm">{formatDateTime(attendance.dateTime)}</div>
                  {attendance.muralNotes && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      Vai para o mural
                    </span>
                  )}
                  {attendance.privateNotes && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      Privado: preenchido
                    </span>
                  )}
                  {attendance.needsTeamReport && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      <AlertTriangle size={10} /> Repasse
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-bold uppercase mt-1">
                  Intervenção: <span className="text-gray-700">{attendance.interventionType}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                  Profissional: {attendance.signature}
                </div>
              </div>
              <button 
                onClick={() => setEditingAttendance(attendance)}
                className="p-2 text-gray-400 hover:text-[#004c99] hover:bg-blue-50 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface PsychologicalAttendanceFormProps {
  attendance: PsychologicalAttendance | null;
  onSave: (attendance: PsychologicalAttendance) => void;
  onCancel: () => void;
}

const PsychologicalAttendanceForm: React.FC<PsychologicalAttendanceFormProps> = ({ attendance, onSave, onCancel }) => {
  const [formData, setFormData] = useState<any>(attendance || {
    id: Date.now().toString(),
    dateTime: new Date().toISOString().slice(0, 16), // YYYY-MM-DDThh:mm
    interventionType: '',
    attendanceEvolution: '',
    muralNotes: '',
    privateNotes: '',
    needsTeamReport: false,
    signature: ''
  });

  const [isPrivateUnlocked, setIsPrivateUnlocked] = useState(false);
  const PRIVATE_PASSWORD = 'PSICO';

  const handleUnlockPrivate = () => {
    const password = prompt('Digite a senha para desbloquear a anotação privada:');
    if (password === PRIVATE_PASSWORD) {
      setIsPrivateUnlocked(true);
    } else if (password !== null) {
      alert('Senha incorreta.');
    }
  };

  useEffect(() => {
    if (!attendance) {
      // Try to get the logged-in user's name
      const sessionStr = localStorage.getItem('ssvp_session');
      let signatureName = 'Usuário';
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          if (session.username) {
            signatureName = session.username;
          }
        } catch (e) {
          console.error('Error parsing session', e);
        }
      }
      
      // Adjust timezone offset for local datetime-local input
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);

      setFormData(prev => ({
        ...prev,
        dateTime: localISOTime,
        signature: signatureName
      }));
    }
  }, [attendance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as PsychologicalAttendance);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
          {attendance ? 'Visualizar / Editar Atendimento' : 'Novo Atendimento'}
        </h2>
      </div>

      {formData.needsTeamReport && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle size={24} className="text-red-500" />
          <div>
            <h4 className="font-bold text-sm uppercase">Repasse à equipe necessário</h4>
            <p className="text-xs">Este atendimento foi marcado como necessitando de repasse para a equipe multidisciplinar.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data e Hora</label>
          <input 
            type="datetime-local" 
            value={formData.dateTime} 
            onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Intervenção</label>
          <select 
            value={formData.interventionType} 
            onChange={(e) => setFormData({ ...formData, interventionType: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm bg-white"
            required
          >
            <option value="">Selecione...</option>
            <option value="Acolhimento individual">Acolhimento individual</option>
            <option value="Observação em área comum">Observação em área comum</option>
            <option value="Intervenção em crise/agitação">Intervenção em crise/agitação</option>
            <option value="Mediação de conflito com outro idoso">Mediação de conflito com outro idoso</option>
            <option value="Atendimento/Orientação a familiares">Atendimento/Orientação a familiares</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Anotação do Prontuário</label>
        <textarea 
          rows={6}
          value={formData.attendanceEvolution} 
          onChange={(e) => setFormData({ ...formData, attendanceEvolution: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Compartilhar no Mural <span className="text-[#004c99] lowercase">(opcional)</span></label>
        <textarea 
          rows={4}
          value={formData.muralNotes} 
          onChange={(e) => setFormData({ ...formData, muralNotes: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004c99] text-sm resize-none"
          placeholder="Anotação que será visível para toda a equipe no mural..."
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Anotação Particular (Privada)</label>
          {!isPrivateUnlocked && (
            <button 
              type="button"
              onClick={handleUnlockPrivate}
              className="text-[10px] font-bold text-[#004c99] uppercase hover:underline"
            >
              Desbloquear anotação privada
            </button>
          )}
        </div>
        
        {isPrivateUnlocked ? (
          <textarea 
            rows={4}
            value={formData.privateNotes} 
            onChange={(e) => setFormData({ ...formData, privateNotes: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm resize-none bg-white"
            placeholder="Conteúdo sensível..."
          />
        ) : (
          <div className="w-full p-3 border border-gray-200 rounded-xl bg-gray-100 text-gray-400 text-sm italic flex items-center justify-center h-[104px]">
            Conteúdo bloqueado. Clique em "Desbloquear" para visualizar ou editar.
          </div>
        )}
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <label className="flex items-center gap-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={formData.needsTeamReport}
            onChange={(e) => setFormData({ ...formData, needsTeamReport: e.target.checked })}
            className="w-5 h-5 text-[#004c99] rounded border-gray-300 focus:ring-[#004c99]"
          />
          <span className="text-sm font-bold text-gray-700 uppercase">Precisa de Repasse à Equipe?</span>
        </label>
      </div>

      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assinatura do Profissional</label>
        <input 
          type="text" 
          value={formData.signature} 
          readOnly
          className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm"
        />
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold text-xs uppercase hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          className="bg-[#004c99] hover:bg-blue-800 text-white px-8 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all font-bold text-xs uppercase"
        >
          <Save size={18} />
          <span>Salvar Atendimento</span>
        </button>
      </div>
    </form>
  );
};

export default MultidisciplinaryModule;

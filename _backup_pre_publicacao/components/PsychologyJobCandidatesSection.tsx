import React, { useState, useEffect } from 'react';
import { JobCandidate } from '../types';
import { fetchJobCandidates, saveJobCandidate, deleteJobCandidate } from '../lib/api';
import { User, Briefcase, Calendar, CheckCircle, AlertTriangle, XCircle, FileText, Search, Plus, Trash2, Edit2, Play, Users, MessageSquare, History, UserCheck, UserX, Clock, Save, RefreshCw } from 'lucide-react';

interface PsychologyJobCandidatesSectionProps {
  institutionId: string;
}

const PsychologyJobCandidatesSection: React.FC<PsychologyJobCandidatesSectionProps> = ({ institutionId }) => {
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [viewMode, setViewMode] = useState<'ativos' | 'arquivados'>('ativos');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<JobCandidate | null>(null);

  useEffect(() => {
    loadCandidates();
  }, [institutionId]);

  const loadCandidates = async () => {
    try {
      setIsLoading(true);
      const data = await fetchJobCandidates(institutionId);
      setCandidates(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (candidate: JobCandidate) => {
    try {
      // Regra de Arquivamento:
      // se status for contratado ou nao_contratado, marca isArchived = true
      if (candidate.processStatus === 'contratado' || candidate.processStatus === 'nao_contratado') {
        candidate.isArchived = true;
      } else {
        candidate.isArchived = false;
      }
      
      await saveJobCandidate(candidate);
      setIsFormOpen(false);
      setEditingCandidate(null);
      loadCandidates();
    } catch (error) {
      alert('Erro ao salvar candidato');
    }
  };

  const handleUnarchive = async (candidate: JobCandidate) => {
    const updated = { ...candidate, isArchived: false, processStatus: 'pendente' as const };
    try {
      await saveJobCandidate(updated);
      loadCandidates();
    } catch (e) {
      alert('Erro ao desarquivar');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`ATENÇÃO (LGPD): Deseja excluir definitivamente os dados de ${name}? Esta ação não pode ser desfeita.`)) {
      try {
        await deleteJobCandidate(id);
        loadCandidates();
      } catch (e) {
        alert('Erro ao excluir definitivamente.');
      }
    }
  };

  const displayedCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.jobPosition.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (viewMode === 'ativos') {
      return !c.isArchived && matchesSearch;
    } else {
      return c.isArchived && matchesSearch;
    }
  });

  if (isFormOpen || editingCandidate) {
    return (
      <JobCandidateForm 
        candidate={editingCandidate} 
        institutionId={institutionId}
        onSave={handleSave} 
        onCancel={() => {
          setIsFormOpen(false);
          setEditingCandidate(null);
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setViewMode('ativos')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              viewMode === 'ativos' ? 'bg-white text-[#004c99] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Candidatos Ativos
          </button>
          <button
            onClick={() => setViewMode('arquivados')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              viewMode === 'arquivados' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Arquivo Morto
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#004c99]"
            />
          </div>
          {viewMode === 'ativos' && (
             <button
               onClick={() => setIsFormOpen(true)}
               className="bg-[#004c99] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-800 transition flex items-center gap-2"
             >
               <Plus size={16} /> Novo
             </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-gray-400"><RefreshCw className="animate-spin mx-auto mb-2" /> Carregando...</div>
      ) : displayedCandidates.length === 0 ? (
        <div className="p-10 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          Nenhum candidato encontrado nesta visão.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedCandidates.map(candidate => (
            <div key={candidate.id} className={`p-5 rounded-2xl border bg-white ${viewMode === 'arquivados' ? 'border-gray-200 bg-gray-50' : 'border-blue-100 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-800">{candidate.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 font-medium"><Briefcase size={12}/> Vaga: {candidate.jobPosition}</span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                  candidate.processStatus === 'pendente' ? 'bg-orange-100 text-orange-700' :
                  candidate.processStatus === 'contratado' ? 'bg-green-100 text-green-700' :
                  candidate.processStatus === 'cadastro_reserva' ? 'bg-purple-100 text-purple-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {(candidate.processStatus || 'pendente').replace('_', ' ')}
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded line-clamp-2">
                 <span className="font-bold block mb-1 text-gray-600">Recomendação da Psicologia:</span>
                 {candidate.recommendation === 'recomendado' ? <span className="text-green-600 font-bold">RECOMENDADO</span> : candidate.recommendation === 'nao_recomendado' ? <span className="text-red-500 font-bold">NÃO RECOMENDADO</span> : <span className="text-gray-400 uppercase">Pendente Emissão de Parecer</span>}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setEditingCandidate(candidate)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  <Edit2 size={14} /> Editar
                </button>
                {viewMode === 'arquivados' && (
                  <>
                    <button
                      onClick={() => handleUnarchive(candidate)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    >
                      <RefreshCw size={14} /> Desarquivar
                    </button>
                    <button
                      onClick={() => handleDelete(candidate.id, candidate.name)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface JobCandidateFormProps {
  candidate: JobCandidate | null;
  institutionId: string;
  onSave: (c: JobCandidate) => void;
  onCancel: () => void;
}

const JobCandidateForm: React.FC<JobCandidateFormProps> = ({ candidate, institutionId, onSave, onCancel }) => {
  const [formData, setFormData] = useState<JobCandidate>(candidate || {
    id: '',
    name: '',
    jobPosition: '',
    date: new Date().toISOString().split('T')[0],
    empathy: '',
    emotionalStability: '',
    teamwork: '',
    communication: '',
    strengths: '',
    attentionPoints: '',
    descriptiveReport: '',
    recommendation: '',
    processStatus: 'pendente',
    institutionId: institutionId,
    isArchived: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const EvaluationRadio = ({ label, field }: { label: string, field: keyof JobCandidate }) => (
    <div className="mb-4">
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
              {['adequado', 'a_desenvolver', 'inadequado'].map((val) => (
          <label key={val} className={`flex-1 flex justify-center items-center gap-2 p-3 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer ${
            (formData[field] || '') === val ? 
              (val === 'adequado' ? 'border-green-500 bg-green-50 text-green-700' : 
               val === 'a_desenvolver' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-red-500 bg-red-50 text-red-700')
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
             <input
               type="radio"
               name={field}
               value={val}
               checked={(formData[field] || '') === val}
               onChange={(e) => setFormData({...formData, [field]: e.target.value as any})}
               className="sr-only"
               required
             />
             {val.replace('_', ' ')}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
      <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
        <UserCheck className="text-[#004c99]" />
        {candidate ? 'Editar Avaliação Psicológica' : 'Nova Avaliação Psicológica'}
      </h2>

      <div className="space-y-8">
        {/* DADOS BÁSICOS */}
        <section>
          <h3 className="text-xs font-bold text-[#004c99] uppercase tracking-widest border-b pb-2 mb-4">1. Dados Básicos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nome do Candidato</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#004c99] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vaga Pretendida</label>
              <input type="text" value={formData.jobPosition} onChange={e => setFormData({...formData, jobPosition: e.target.value})} required className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#004c99] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data da Avaliação</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#004c99] focus:outline-none" />
            </div>
          </div>
        </section>

        {/* AVALIAÇÃO COMPORTAMENTAL */}
        <section>
          <h3 className="text-xs font-bold text-[#004c99] uppercase tracking-widest border-b pb-2 mb-4">2. Avaliação Comportamental</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <EvaluationRadio label="Empatia / Acolhimento" field="empathy" />
            <EvaluationRadio label="Estabilidade Emocional" field="emotionalStability" />
            <EvaluationRadio label="Trabalho em Equipe / Relacionamento Interpessoal" field="teamwork" />
            <EvaluationRadio label="Comunicação" field="communication" />
          </div>
        </section>

        {/* PARECER PSICOLÓGICO */}
        <section>
          <h3 className="text-xs font-bold text-[#004c99] uppercase tracking-widest border-b pb-2 mb-4">3. Parecer Psicológico</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 pl-1">Pontos Fortes</label>
              <textarea rows={3} value={formData.strengths} onChange={e => setFormData({...formData, strengths: e.target.value})} className="w-full p-3 border border-emerald-100 bg-emerald-50/30 rounded-xl focus:border-emerald-500 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1 pl-1">Pontos de Atenção</label>
              <textarea rows={3} value={formData.attentionPoints} onChange={e => setFormData({...formData, attentionPoints: e.target.value})} className="w-full p-3 border border-orange-100 bg-orange-50/30 rounded-xl focus:border-orange-500 focus:outline-none resize-none" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 pl-1">Parecer Descritivo Completo (Síntese)</label>
            <textarea rows={5} value={formData.descriptiveReport} onChange={e => setFormData({...formData, descriptiveReport: e.target.value})} required className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#004c99] focus:outline-none resize-none" />
          </div>

          <div>
             <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 pl-1">Recomendação da Psicologia</label>
             <div className="flex gap-4">
               <label className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-all ${formData.recommendation === 'recomendado' ? 'border-green-500 bg-green-50 text-green-700 scale-[1.02] shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                 <input type="radio" name="recommendation" value="recomendado" checked={formData.recommendation === 'recomendado'} onChange={e => setFormData({...formData, recommendation: e.target.value as any})} className="sr-only" required />
                 <CheckCircle size={20} /> <span className="font-bold uppercase tracking-wide">Recomendado</span>
               </label>
               <label className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-all ${formData.recommendation === 'nao_recomendado' ? 'border-red-500 bg-red-50 text-red-700 scale-[1.02] shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                 <input type="radio" name="recommendation" value="nao_recomendado" checked={formData.recommendation === 'nao_recomendado'} onChange={e => setFormData({...formData, recommendation: e.target.value as any})} className="sr-only" required />
                 <XCircle size={20} /> <span className="font-bold uppercase tracking-wide">Não Recomendado</span>
               </label>
             </div>
          </div>
        </section>

        {/* DECISÃO RH / DIRETORIA */}
        <section className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
           <h3 className="text-xs font-bold text-[#004c99] uppercase tracking-widest mb-4 flex items-center gap-2"><Briefcase size={16}/> 4. Decisão Final (RH / Diretoria)</h3>
           <div>
             <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Status do Processo</label>
             <select value={formData.processStatus} onChange={e => setFormData({...formData, processStatus: e.target.value as any})} className="w-full md:w-1/2 p-3 border border-blue-200 rounded-xl focus:border-[#004c99] focus:outline-none bg-white font-bold">
               <option value="pendente">⏳ Pendente / Em Análise</option>
               <option value="cadastro_reserva">📚 Cadastro Reserva</option>
               <option value="contratado">✅ Contratado</option>
               <option value="nao_contratado">❌ Não Contratado</option>
             </select>
             <p className="text-[10px] text-gray-500 mt-2 font-medium">Nota: Candidatos "Contratados" ou "Não Contratados" são arquivados automaticamente na visão principal.</p>
           </div>
        </section>

      </div>

      <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition uppercase tracking-widest text-xs">
          Cancelar
        </button>
        <button type="submit" className="px-8 py-3 rounded-xl font-black text-white bg-[#004c99] hover:bg-blue-800 transition shadow-lg shadow-blue-900/20 uppercase tracking-widest flex items-center gap-2 text-xs">
          <Save size={16} /> Salvar Avaliação
        </button>
      </div>
    </form>
  )
}

export default PsychologyJobCandidatesSection;

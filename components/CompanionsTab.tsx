
import React, { useState } from 'react';
import { User, Phone, Briefcase, Plus, X, Search, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { Companion } from '../types';

interface CompanionsTabProps {
  companions: Companion[];
  onSaveCompanion: (companion: Omit<Companion, 'id' | 'institutionId'> & { id?: string }) => void;
  onDeleteCompanion: (id: string) => void;
}

const CompanionsTab: React.FC<CompanionsTabProps> = ({ 
  companions, 
  onSaveCompanion, 
  onDeleteCompanion 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Omit<Companion, 'id' | 'institutionId'> & { id?: string }>({
    name: '',
    phone: '',
    role: 'acompanhante'
  });

  const filteredCompanions = companions.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const handleEdit = (companion: Companion) => {
    setFormData({
      id: companion.id,
      name: companion.name,
      phone: companion.phone,
      role: companion.role
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', phone: '', role: 'acompanhante' });
    setIsEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Por favor, preencha o nome e o telefone.");
      return;
    }
    onSaveCompanion(formData);
    handleCancel();
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 border-b bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Banco de Acompanhantes</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
              Gestão de acompanhantes para consultas e exames externos
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por nome, função ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-100 rounded-xl text-[10px] font-black uppercase tracking-tight outline-none w-full sm:w-64"
              />
            </div>
            {!isEditing && (
              <button type="button"
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-xl flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={16} /> Novo Acompanhante
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gray-50/50">
        {/* Form Column - Conditional */}
        {isEditing && (
          <div className="w-full md:w-96 bg-white border-r p-8 animate-in slide-in-from-left duration-300 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                {formData.id ? 'Editar Acompanhante' : 'Cadastro de Acompanhante'}
              </h3>
              <button type="button" onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block px-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: João da Silva"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-[#004c99]/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block px-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-[#004c99]/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block px-1">Formação / Função</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as any})}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl text-[11px] font-black outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[#004c99]/20 transition-all shadow-sm"
                  >
                    <option value="tecnico">Técnico de Enfermagem</option>
                    <option value="cuidador">Cuidador</option>
                    <option value="acompanhante">Acompanhante</option>
                    <option value="homecare tecnico">HomeCare (Técnico)</option>
                    <option value="homecare cuidador">HomeCare (Cuidador)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <button 
                  type="submit"
                  className="w-full py-5 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
                >
                  <Plus size={18} /> {formData.id ? 'Salvar Alterações' : 'Cadastrar agora'}
                </button>
                <button 
                  type="button"
                  onClick={handleCancel}
                  className="w-full py-4 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List Column */}
        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredCompanions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCompanions.map((companion) => (
                  <div 
                    key={companion.id} 
                    className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#004c99] font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                        {companion.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-black text-gray-800 uppercase tracking-tight group-hover:text-[#004c99] transition-all">
                          {companion.name}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <Phone size={12} className="text-blue-300" /> {companion.phone}
                          </span>
                        </div>
                        <div className="mt-3">
                           <span className="px-3 py-1 bg-blue-50 text-[#004c99] rounded-lg text-[9px] font-black uppercase tracking-widest inline-block shadow-sm">
                             {companion.role}
                           </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" 
                          onClick={() => handleEdit(companion)}
                          className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button type="button" 
                          onClick={() => onDeleteCompanion(companion.id)}
                          className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                          title="Remover"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center bg-white border-2 border-dashed rounded-[40px] opacity-60">
                 <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mb-6 text-gray-300">
                    <User size={40} />
                 </div>
                 <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Nenhum acompanhante</h3>
                 <p className="text-sm text-gray-400 mt-2 font-bold uppercase tracking-widest">
                   {searchTerm ? 'Nenhum resultado para sua busca' : 'O banco de acompanhantes está vazio'}
                 </p>
                 {!isEditing && (
                   <button type="button" 
                     onClick={() => setIsEditing(true)}
                     className="mt-8 px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                   >
                     Cadastrar meu primeiro acompanhante
                   </button>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanionsTab;

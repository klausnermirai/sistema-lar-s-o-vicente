import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { getProfessionalSignature } from '../lib/api';

interface StandardEvolutionFormProps {
  areaLabel: string;
  onSave: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const StandardEvolutionForm: React.FC<StandardEvolutionFormProps> = ({
  areaLabel,
  onSave,
  onCancel,
  isLoading
}) => {
  const [dataEvolucao, setDataEvolucao] = useState(new Date().toISOString().split('T')[0]);
  const [descricaoEvolucao, setDescricaoEvolucao] = useState('');
  const [mudancasObservadas, setMudancasObservadas] = useState('');
  const [novaConduta, setNovaConduta] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [incluirNoPIA, setIncluirNoPIA] = useState(true);

  const handleSubmit = () => {
    if (!dataEvolucao || !descricaoEvolucao.trim()) {
      alert('Data e Descrição são obrigatórios.');
      return;
    }
    
    onSave({
      dataEvolucao,
      // For compatibility, also send legacy "date" and "evolutionDescription" / "newConduct"
      date: dataEvolucao,
      descricaoEvolucao,
      mudancasObservadas,
      novaConduta,
      newConduct: novaConduta, // Legacy compatibility
      recomendacoes,
      incluirNoPIA,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      ...getProfessionalSignature()
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-md mb-6 relative animate-in fade-in zoom-in-95 duration-200">
      <h4 className="text-sm font-black text-[#004c99] uppercase tracking-widest mb-4 border-b pb-2">
        Registrar Nova Evolução {areaLabel}
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            Data da evolução *
          </label>
          <input
            type="date"
            required
            value={dataEvolucao}
            onChange={e => setDataEvolucao(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] transition-all font-medium text-gray-700"
          />
        </div>
      </div>

      <div className="space-y-6 mb-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            Descrição da evolução *
          </label>
          <textarea
            required
            value={descricaoEvolucao}
            onChange={e => setDescricaoEvolucao(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] transition-all min-h-[120px] font-medium text-gray-700 leading-relaxed"
            placeholder={`Descreva a evolução ${areaLabel.toLowerCase()}...`}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
            Mudanças observadas
          </label>
          <textarea
            value={mudancasObservadas}
            onChange={e => setMudancasObservadas(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] transition-all min-h-[80px] font-medium text-gray-700"
            placeholder="O que mudou desde a última avaliação? (Opcional)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Nova conduta / Intervenção
            </label>
            <textarea
              value={novaConduta}
              onChange={e => setNovaConduta(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] transition-all min-h-[80px] font-medium text-gray-700"
              placeholder="(Opcional)"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Recomendações
            </label>
            <textarea
              value={recomendacoes}
              onChange={e => setRecomendacoes(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-[#004c99] focus:ring-1 focus:ring-[#004c99] transition-all min-h-[80px] font-medium text-gray-700"
              placeholder="(Opcional)"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <input
            type="checkbox"
            id="incluirNoPIA"
            checked={incluirNoPIA}
            onChange={e => setIncluirNoPIA(e.target.checked)}
            className="w-5 h-5 text-[#004c99] border-gray-300 rounded focus:ring-[#004c99]"
          />
          <div className="flex flex-col">
            <label htmlFor="incluirNoPIA" className="text-sm font-bold text-gray-800 select-none cursor-pointer">
              Incluir no PIA (Plano Individual de Atendimento)
            </label>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Se marcado, esta evolução aparecerá no documento final do residente.
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-6 py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-800 transition-all disabled:opacity-50"
        >
          <Save size={16} />
          {isLoading ? 'Salvando...' : 'Salvar Evolução'}
        </button>
      </div>
    </div>
  );
};

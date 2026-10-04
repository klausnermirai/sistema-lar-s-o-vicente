import React, { useState } from 'react';
import { 
  Hammer, 
  Sparkles, 
  Users, 
  Home, 
  HeartHandshake, 
  Building, 
  Landmark, 
  Globe2, 
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { useVicentinoHierarchy, VicentinoCascadeSelector } from './VicentinoHierarchyContext';

interface VicentinoUnderConstructionViewProps {
  moduleName?: string;
  title?: string;
  badge?: string;
  moduleIcon?: 'familias' | 'membros' | 'metropolitano' | 'nacional';
  sphereName?: string;
  description: string;
  expectedFeatures: string[];
  targetLevel?: 'conferencia' | 'particular' | 'central' | 'metropolitano';
}

export const VicentinoUnderConstructionView: React.FC<VicentinoUnderConstructionViewProps> = ({
  moduleName,
  title,
  badge,
  moduleIcon = 'familias',
  sphereName,
  description,
  expectedFeatures,
  targetLevel = 'conferencia',
}) => {
  const {
    selection,
    isMultiAccess,
    userScopeType,
    clearSelection,
  } = useVicentinoHierarchy();

  const finalTitle = title || moduleName || 'Módulo Vicentino';
  const finalSphere = sphereName || (
    targetLevel === 'conferencia' 
      ? 'Conferências' 
      : targetLevel === 'particular'
      ? 'Conselhos Particulares'
      : targetLevel === 'metropolitano'
      ? 'Conselho Metropolitano'
      : 'Conselho Nacional'
  );

  // Se o módulo exige seleção de Conferência ou CP e o usuário tem multi-acesso mas ainda não escolheu
  const needsSelection = isMultiAccess && (
    (targetLevel === 'conferencia' && !selection?.conferenciaId) ||
    (targetLevel === 'particular' && !selection?.particularId)
  );

  const getIcon = () => {
    switch (moduleIcon) {
      case 'familias':
        return <HeartHandshake className="w-12 h-12 text-blue-600" />;
      case 'membros':
        return <Users className="w-12 h-12 text-indigo-600" />;
      case 'metropolitano':
        return <Building className="w-12 h-12 text-purple-600" />;
      case 'nacional':
        return <Globe2 className="w-12 h-12 text-emerald-600" />;
      default:
        return <Hammer className="w-12 h-12 text-blue-600" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 animate-in fade-in duration-300">
      {/* Seletor em Cascata Quando Necessário */}
      {needsSelection ? (
        <div className="space-y-6">
          <VicentinoCascadeSelector 
            targetLevel={targetLevel}
            title={`Selecione o Contexto para ${finalTitle}`}
            subtitle={`Como você possui acesso amplo, selecione a unidade que deseja abrir para visualizar ${finalTitle}.`}
          />
        </div>
      ) : (
        <>
          {/* Card de Contexto Ativo com Botão de Troca para Multi-acesso */}
          {selection && isMultiAccess && (
            <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">
                    Unidade em Atendimento
                  </span>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span>{selection.centralName}</span>
                    {selection.particularName && (
                      <>
                        <span className="text-slate-300">›</span>
                        <span className="text-indigo-700">{selection.particularName}</span>
                      </>
                    )}
                    {selection.conferenciaName && (
                      <>
                        <span className="text-slate-300">›</span>
                        <span className="text-emerald-700">{selection.conferenciaName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <RefreshCw size={13} />
                Trocar Unidade
              </button>
            </div>
          )}

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-5">
                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner shrink-0">
                  {getIcon()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-400/20 text-blue-200 border border-blue-300/30 flex items-center gap-1">
                      <Hammer size={12} className="text-amber-400" />
                      {badge || 'Módulo em Construção'}
                    </span>
                    <span className="text-xs font-semibold text-blue-200/80">
                      Esfera: {finalSphere}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                    {finalTitle}
                  </h1>
                  <p className="text-sm text-blue-100/90 font-medium max-w-2xl mt-1 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Funcionalidades Previstas e Especificações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Coluna Principal: O que será implementado */}
            <div className="md:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                      Recursos em Desenvolvimento
                    </h2>
                    <p className="text-xs text-slate-500">
                      Estrutura técnica planejada para a próxima etapa deste módulo
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                  Próxima Fase
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {expectedFeatures.map((feature, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start gap-3"
                  >
                    <div className="mt-0.5 p-1 bg-blue-100 text-blue-700 rounded-md shrink-0">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 leading-snug">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900">
                <ShieldCheck size={20} className="text-amber-600 shrink-0" />
                <p className="text-xs font-medium leading-relaxed">
                  <strong>Integração com a Regra da SSVP:</strong> Todos os campos e fluxos estão sendo projetados respeitando o Regulamento da Sociedade de São Vicente de Paulo.
                </p>
              </div>
            </div>

            {/* Coluna Lateral: Status e Informações da Guia */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Status da Guia
                </h3>
                
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Layout Base</span>
                    <span className="font-bold text-emerald-600">Integrado</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Permissões de Acesso</span>
                    <span className="font-bold text-indigo-600">Configuradas</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Seletor de Contexto</span>
                    <span className="font-bold text-emerald-600">Ativo</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 font-medium">Tabelas e Formulários</span>
                    <span className="font-bold text-amber-600">Em Modelagem</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-100 rounded-2xl text-center space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Sociedade de São Vicente de Paulo
                </span>
                <span className="text-xs font-bold text-slate-800 block">
                  Conselho Central de Santo André
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

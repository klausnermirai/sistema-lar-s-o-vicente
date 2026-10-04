import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  AlertCircle,
  Check,
  Send,
  History,
  Gift,
  RefreshCw,
} from 'lucide-react';
import {
  FamiliaAssistidaCompleta,
  VisitaFamiliaSSVP,
  MembroSSVP,
} from '../types';
import {
  fetchVisitasFamilia,
  createVisitaFamilia,
  fetchMembrosConferencia,
} from '../lib/hierarchy_api';

export interface VisitasFamiliaModalProps {
  isOpen: boolean;
  onClose: () => void;
  familia: FamiliaAssistidaCompleta;
  conferenciaName?: string;
  institutionId?: string;
  onVisitaSaved: () => void;
}

export const VisitasFamiliaModal: React.FC<VisitasFamiliaModalProps> = ({
  isOpen,
  onClose,
  familia,
  conferenciaName,
  institutionId,
  onVisitaSaved,
}) => {
  // 1. Estados de Visitas
  const [visitas, setVisitas] = useState<VisitaFamiliaSSVP[]>([]);
  const [membrosConferencia, setMembrosConferencia] = useState<MembroSSVP[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(true);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 2. Estado da Nova Visita
  const [dataVisita, setDataVisita] = useState<string>(
    () => new Date().toISOString().substring(0, 10)
  );
  const [selectedVisitadoresIds, setSelectedVisitadoresIds] = useState<string[]>([]);
  const [selectedVisitadoresNomes, setSelectedVisitadoresNomes] = useState<string[]>([]);
  const [entregueCesta, setEntregueCesta] = useState<boolean>(true);
  const [quantidadeCestas, setQuantidadeCestas] = useState<number>(1);
  const [tipoAuxilioExtra, setTipoAuxilioExtra] = useState<string>('');
  const [comentarios, setComentarios] = useState<string>('');
  const [proximaVisitaAgendada, setProximaVisitaAgendada] = useState<string>('');

  // 3. Aba Ativa dentro do Modal
  const [activeTab, setActiveTab] = useState<'nova_visita' | 'historico'>('nova_visita');

  // Carregar histórico de visitas da família
  const loadVisitas = async () => {
    if (!familia?.id) return;
    try {
      setLoadingVisitas(true);
      const data = await fetchVisitasFamilia(familia.id, institutionId);
      setVisitas(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar visitas:', err);
      setErrorMsg('Não foi possível carregar o histórico de visitas.');
    } finally {
      setLoadingVisitas(false);
    }
  };

  // Carregar membros da conferência para seleção rápida dos visitadores
  const loadMembros = async () => {
    if (!familia?.conferenciaId) return;
    try {
      setLoadingMembros(true);
      const membros = await fetchMembrosConferencia(familia.conferenciaId, { status: 'ativo' }, institutionId);
      setMembrosConferencia(membros || []);
    } catch (err) {
      console.error('Erro ao buscar membros da conferência:', err);
    } finally {
      setLoadingMembros(false);
    }
  };

  useEffect(() => {
    if (isOpen && familia?.id) {
      loadVisitas();
      loadMembros();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, familia?.id]);

  if (!isOpen) return null;

  // Alternar seleção de visitador
  const toggleVisitador = (membro: MembroSSVP) => {
    const isSelected = selectedVisitadoresIds.includes(membro.id);
    if (isSelected) {
      setSelectedVisitadoresIds(selectedVisitadoresIds.filter((id) => id !== membro.id));
      setSelectedVisitadoresNomes(selectedVisitadoresNomes.filter((name) => name !== membro.fullName));
    } else {
      setSelectedVisitadoresIds([...selectedVisitadoresIds, membro.id]);
      setSelectedVisitadoresNomes([...selectedVisitadoresNomes, membro.fullName]);
    }
  };

  // Salvar registro de nova visita
  const handleCreateVisita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataVisita) {
      setErrorMsg('A Data da Visita é obrigatória.');
      return;
    }
    if (selectedVisitadoresNomes.length === 0) {
      setErrorMsg('Selecione pelo menos um membro visitador da conferência.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      await createVisitaFamilia(
        familia.id,
        {
          dataVisita,
          visitadoresIds: selectedVisitadoresIds,
          visitadoresNomes: selectedVisitadoresNomes,
          entregueCesta,
          quantidadeCestas: entregueCesta ? quantidadeCestas : 0,
          tipoAuxilioExtra,
          comentarios,
          proximaVisitaAgendada: proximaVisitaAgendada || undefined,
        },
        institutionId
      );

      setSuccessMsg('Visita registrada com sucesso!');
      setComentarios('');
      setTipoAuxilioExtra('');
      loadVisitas();
      onVisitaSaved();
      
      // Mudar para aba de histórico após salvar
      setTimeout(() => {
        setActiveTab('historico');
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      console.error('Erro ao registrar visita:', err);
      setErrorMsg(err.message || 'Erro ao registrar visita.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="visitas-familia-modal" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Acompanhamento e Visitas</span>
                {conferenciaName && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[11px] font-semibold text-blue-200 border border-blue-400/20">
                    {conferenciaName}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                {familia.nomeAssistido}
              </h2>
              <p className="text-xs text-blue-200/70 truncate max-w-md">
                {familia.enderecoResumido}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo Rápido no Topo */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Total de Visitas:</span>
              <span className="font-extrabold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                {visitas.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Cestas Recebidas:</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {visitas.filter((v) => v.entregueCesta).length}
              </span>
            </div>
          </div>

          {/* Abas */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('nova_visita')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'nova_visita'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Registrar Visita</span>
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'historico'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Histórico ({visitas.length})</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Conteúdo Principal com Scroll */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {/* ABA 1: REGISTRAR NOVA VISITA */}
          {activeTab === 'nova_visita' && (
            <form onSubmit={handleCreateVisita} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Data da Visita <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dataVisita}
                    onChange={(e) => setDataVisita(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Previsão da Próxima Visita (Opcional)
                  </label>
                  <input
                    type="date"
                    value={proximaVisitaAgendada}
                    onChange={(e) => setProximaVisitaAgendada(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Seleção dos Visitadores da Conferência */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">
                  Membros Visitadores (Selecione quem realizou a visita) <span className="text-rose-500">*</span>
                </label>
                {loadingMembros ? (
                  <p className="text-slate-400">Carregando membros da conferência...</p>
                ) : membrosConferencia.length === 0 ? (
                  <p className="text-slate-500 italic">
                    Nenhum membro cadastrado nesta Conferência. Cadastre membros na aba "Membros" para seleção em 1 clique.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {membrosConferencia.map((m) => {
                      const isSelected = selectedVisitadoresIds.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => toggleVisitador(m)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          <span>{m.fullName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção Cesta Básica & Auxílios */}
              <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 font-extrabold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entregueCesta}
                      onChange={(e) => setEntregueCesta(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded-lg focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm">Entregue Cesta de Alimentos nesta visita?</span>
                  </label>

                  {entregueCesta && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">Qtd. Cestas:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={quantidadeCestas}
                        onChange={(e) => setQuantidadeCestas(Number(e.target.value))}
                        className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-slate-800"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Outros Auxílios Entregues (Opcional)
                  </label>
                  <input
                    type="text"
                    value={tipoAuxilioExtra}
                    onChange={(e) => setTipoAuxilioExtra(e.target.value)}
                    placeholder="Ex: 2L de Leite, Fraldas tamanho G, Cobertores, Medicamentos..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Comentários / Relato da Visita */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Relato da Visita e Observações
                </label>
                <textarea
                  rows={3}
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  placeholder="Descreva como estava a família, novas necessidades observadas, orientações dadas ou motivos de oração..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Botão de Gravar Visita */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Gravando Visita...' : 'Registrar Visita Realizada'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ABA 2: HISTÓRICO / LINHA DO TEMPO DE VISITAS */}
          {activeTab === 'historico' && (
            <div className="space-y-4">
              {loadingVisitas ? (
                <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Carregando linha do tempo...</span>
                </div>
              ) : visitas.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">Nenhuma visita registrada ainda.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Utilize a aba "Registrar Visita" para lançar as visitas periódicas realizadas a esta família.
                  </p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                  {visitas.map((visita) => (
                    <div key={visita.id} className="relative group">
                      {/* Ponto na linha do tempo */}
                      <div
                        className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                          visita.entregueCesta ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                      />

                      <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {new Date(visita.dataVisita + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              (Comp. {visita.mesAnoCompetencia})
                            </span>
                          </div>

                          {visita.entregueCesta ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>{visita.quantidadeCestas || 1} Cesta(s) Entregue(s)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 font-medium text-[11px]">
                              Visita sem cesta
                            </span>
                          )}
                        </div>

                        {/* Visitadores */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-semibold">Visitadores:</span>
                          <span className="font-medium text-slate-800">
                            {visita.visitadoresNomes && visita.visitadoresNomes.length > 0
                              ? visita.visitadoresNomes.join(', ')
                              : 'Não informados'}
                          </span>
                        </div>

                        {/* Auxílio Extra se houver */}
                        {visita.tipoAuxilioExtra && (
                          <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200/60">
                            <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="font-semibold">Auxílio adicional:</span>
                            <span>{visita.tipoAuxilioExtra}</span>
                          </div>
                        )}

                        {/* Relato / Comentários */}
                        {visita.comentarios && (
                          <div className="text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed">
                            <span className="font-bold block text-slate-500 mb-0.5">Relato da visita:</span>
                            {visita.comentarios}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

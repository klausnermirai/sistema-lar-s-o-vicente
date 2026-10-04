import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  Eye,
  Info,
  X,
  Building2,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { apiFetch, getAuthHeaders } from '../lib/api';

interface PreviaItem {
  membroId: string;
  nome: string;
  conselhoParticularNome: string;
  conferenciaNome: string;
  status: string;
  temNascimento: boolean;
  usernameSugerido: string;
  temConflito: boolean;
  acaoPrevista: string;
  situacaoAtual: string;
}

interface InconsistenciaItem {
  membroId: string;
  nome: string;
  conselhoParticularNome: string;
  conferenciaNome: string;
  tipo: string;
  descricao: string;
}

interface PreviaData {
  success: boolean;
  totalAnalisados: number;
  totalElegiveis: number;
  totalJaRegularizados: number;
  totalSemNascimento: number;
  totalInativos: number;
  totalInconsistencias: number;
  elegiveis: PreviaItem[];
  inconsistencias: InconsistenciaItem[];
  error?: string;
}

interface ExecucaoItem {
  membroId: string;
  nome: string;
  conferenciaNome: string;
  userIdCriado?: string;
  usernameAtribuido?: string;
  status: 'criado' | 'ignorado' | 'erro' | 'inconsistente';
  motivo?: string;
}

interface ExecucaoData {
  success: boolean;
  totalProcessados: number;
  totalCriados: number;
  totalIgnorados: number;
  totalInconsistencias: number;
  totalErros: number;
  detalhes: ExecucaoItem[];
  executedAt: string;
  executedBy: string;
  error?: string;
}

interface MemberAccessRegularizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const MemberAccessRegularizationModal: React.FC<MemberAccessRegularizationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loadingPrevia, setLoadingPrevia] = useState(false);
  const [loadingExecucao, setLoadingExecucao] = useState(false);
  const [previaData, setPreviaData] = useState<PreviaData | null>(null);
  const [execucaoData, setExecucaoData] = useState<ExecucaoData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (!isOpen) return null;

  const handleFetchPrevia = async () => {
    setLoadingPrevia(true);
    setErrorMsg(null);
    setExecucaoData(null);

    try {
      const response = await apiFetch('/api/membros/regularizacao-acessos/previa', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao obter prévia da regularização.');
      }

      const data = await response.json();
      setPreviaData(data);
    } catch (err: any) {
      console.error('Erro na prévia de regularização:', err);
      setErrorMsg(err?.message || 'Erro de comunicação ao carregar a prévia.');
    } finally {
      setLoadingPrevia(false);
    }
  };

  const handleExecuteRegularizacao = async () => {
    setShowConfirmModal(false);
    setLoadingExecucao(true);
    setErrorMsg(null);

    try {
      const response = await apiFetch('/api/membros/regularizacao-acessos/executar', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao executar a regularização de acessos.');
      }

      const data = await response.json();
      setExecucaoData(data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Erro na execução da regularização:', err);
      setErrorMsg(err?.message || 'Erro de comunicação ao executar a regularização.');
    } finally {
      setLoadingExecucao(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* CABEÇALHO */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Regularização de Acessos dos Membros Antigos
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 tracking-wider">
                  Carga Inicial Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Análise e geração automática e idempotente de credenciais para membros ativos pré-existentes.
              </p>
            </div>
          </div>
          <button
            id="btn-close-regularization-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* AVISO INICIAL / STATUS DE BANCO */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <Info className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Regras de Segurança e Integridade da Base</span>
            </div>
            <p>
              • A rotina opera <strong>exclusivamente sobre o Cloud Firestore oficial</strong>, sem uso de fallbacks ou dados locais.
            </p>
            <p>
              • Apenas membros com <strong>cadastro ativo</strong> e <strong>data de nascimento preenchida</strong> são elegíveis.
            </p>
            <p>
              • Nenhum usuário administrativo, funcionário ou de Obras Unidas é afetado. Nenhuma senha personalizada é sobrescrita.
            </p>
          </div>

          {/* MENSAGEM DE ERRO */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <p className="font-bold">Não foi possível processar a operação</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* BARRA DE AÇÕES DA PRÉVIA */}
          {!execucaoData && (
            <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-800">1. Consulta e Prévia da Base Oficial</h3>
                <p className="text-xs text-slate-500">
                  Gere um relatório somente de leitura dos membros elegíveis antes de efetuar qualquer gravação.
                </p>
              </div>
              <button
                id="btn-fetch-previa"
                onClick={handleFetchPrevia}
                disabled={loadingPrevia || loadingExecucao}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingPrevia ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Consultando Cloud Firestore...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Visualizar Prévia da Regularização</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* RESULTADO DA PRÉVIA */}
          {previaData && !execucaoData && (
            <div className="space-y-6">
              {/* CARDS DE RESUMO */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analisados</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{previaData.totalAnalisados}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Elegíveis</p>
                  <p className="text-xl font-black text-emerald-800 mt-1">{previaData.totalElegiveis}</p>
                </div>
                <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Já Regularizados</p>
                  <p className="text-xl font-black text-blue-800 mt-1">{previaData.totalJaRegularizados}</p>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Sem Nascimento</p>
                  <p className="text-xl font-black text-amber-800 mt-1">{previaData.totalSemNascimento}</p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inativos</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{previaData.totalInativos}</p>
                </div>
                <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 text-center">
                  <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Inconsistências</p>
                  <p className="text-xl font-black text-purple-800 mt-1">{previaData.totalInconsistencias}</p>
                </div>
              </div>

              {/* INCONSISTÊNCIAS IDENTIFICADAS (SE HOUVER) */}
              {previaData.inconsistencias && previaData.inconsistencias.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    <span>Inconsistências Identificadas ({previaData.inconsistencias.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {previaData.inconsistencias.map((inc, i) => (
                      <div key={i} className="text-xs text-amber-900 bg-white/80 p-2.5 rounded-lg border border-amber-200/60">
                        <span className="font-bold">{inc.nome}</span> ({inc.conferenciaNome}): {inc.descricao}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TABELA DE MEMBROS ELEGÍVEIS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Relação de Membros Elegíveis para Regularização ({previaData.elegiveis.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Nenhum dado pessoal sensível (CPF, senha, telefone) é exibido nesta prévia.
                  </span>
                </div>

                {previaData.elegiveis.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                    Todos os membros ativos com data de nascimento já possuem acessos regularizados no sistema.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Membro Vicentino</th>
                          <th className="py-2.5 px-3">Conselho Particular</th>
                          <th className="py-2.5 px-3">Conferência</th>
                          <th className="py-2.5 px-3">Username Previsto</th>
                          <th className="py-2.5 px-3 text-center">Colisão?</th>
                          <th className="py-2.5 px-3">Ação Prevista</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previaData.elegiveis.map((item) => (
                          <tr key={item.membroId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.nome}</td>
                            <td className="py-2.5 px-3 text-slate-600">{item.conselhoParticularNome}</td>
                            <td className="py-2.5 px-3 text-slate-600">{item.conferenciaNome}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md font-semibold border border-emerald-200">
                                {item.usernameSugerido}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.temConflito ? (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                  Sim (Sufixo)
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium text-[11px]">Livre</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-700 font-medium">{item.acaoPrevista}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* BOTÃO DE EXECUÇÃO */}
              {previaData.totalElegiveis > 0 && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    Pronto para regularizar <strong>{previaData.totalElegiveis} membro(s)</strong> elegível(is).
                  </div>
                  <button
                    id="btn-trigger-execute-modal"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={loadingExecucao}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Executar Regularização dos {previaData.totalElegiveis} Membros</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RELATÓRIO FINAL DE EXECUÇÃO */}
          {execucaoData && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-emerald-950 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  <span>Regularização Concluída com Sucesso</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
                  <div className="bg-white p-3 rounded-lg border border-emerald-200/80">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Processados</p>
                    <p className="text-lg font-black text-slate-800">{execucaoData.totalProcessados}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200/80">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Criados / Ativados</p>
                    <p className="text-lg font-black text-emerald-800">{execucaoData.totalCriados}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200/80">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Ignorados</p>
                    <p className="text-lg font-black text-slate-800">{execucaoData.totalIgnorados}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200/80">
                    <p className="text-[10px] font-bold text-rose-700 uppercase">Erros</p>
                    <p className="text-lg font-black text-rose-800">{execucaoData.totalErros}</p>
                  </div>
                </div>
              </div>

              {/* DETALHES DOS REGISTROS PROCESSADOS */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Detalhamento dos Resultados por Membro
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <th className="py-2 px-3">Membro</th>
                        <th className="py-2 px-3">Conferência</th>
                        <th className="py-2 px-3">Username Atribuído</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3">Motivo / Retorno</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {execucaoData.detalhes.map((det, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{det.nome}</td>
                          <td className="py-2 px-3 text-slate-600">{det.conferenciaNome}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-emerald-700">
                            {det.usernameAtribuido || '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {det.status === 'criado' && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
                                Criado
                              </span>
                            )}
                            {det.status === 'ignorado' && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-full text-[10px]">
                                Ignorado
                              </span>
                            )}
                            {det.status === 'erro' && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full text-[10px]">
                                Erro
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">{det.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            id="btn-close-footer-modal"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DA EXECUÇÃO */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-slate-900 text-base">Confirmação de Regularização</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a criar os acessos para <strong>{previaData?.totalElegiveis} membro(s)</strong> no Cloud Firestore oficial.
              Cada membro receberá seu login único e senha inicial DDMM vinculada à sua Conferência.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-confirm-exec"
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-execute"
                onClick={handleExecuteRegularizacao}
                disabled={loadingExecucao}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Confirmar e Executar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

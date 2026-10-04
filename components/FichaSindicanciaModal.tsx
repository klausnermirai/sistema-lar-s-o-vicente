import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Save,
  Plus,
  Trash2,
  Calendar,
  Home,
  DollarSign,
  Heart,
  UserCheck,
  Printer,
  AlertCircle,
  Users,
  Check,
} from 'lucide-react';
import {
  FamiliaAssistidaCompleta,
  FichaSindicanciaData,
  MembroFamiliarComposicao,
  MembroSSVP,
} from '../types';
import {
  createFamiliaAssistida,
  updateFamiliaAssistida,
  fetchMembrosConferencia,
} from '../lib/hierarchy_api';

export interface FichaSindicanciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (familia: FamiliaAssistidaCompleta) => void;
  conferenciaId: string;
  conferenciaName?: string;
  familiaToEdit?: FamiliaAssistidaCompleta | null;
  institutionId?: string;
}

export const FichaSindicanciaModal: React.FC<FichaSindicanciaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  conferenciaId,
  conferenciaName,
  familiaToEdit,
  institutionId,
}) => {
  // 1. Estados do Formulário de Sindicância
  const [formData, setFormData] = useState<FichaSindicanciaData>({
    assistidoNome: '',
    assistidoDataNasc: '',
    assistidoCpf: '',
    assistidoRg: '',
    assistidoTelefone: '',
    conjugeNome: '',
    conjugeDataNasc: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: 'SP',
    cep: '',
    complemento: '',
    estadoCivil: 'casado',
    religiao: 'Católica',
    situacaoMoradia: 'alugada',
    membrosFamilia: [],
    profissao: '',
    quantosTrabalham: 0,
    valorAluguel: 0,
    rendaLiquida: 0,
    assistenciaGoverno: '',
    valorAssistenciaGoverno: 0,
    outrasRendas: 0,
    alguemDoente: '',
    precisaMedicacao: false,
    medicacaoDetalhes: '',
    participacaoIgreja: '',
    precisamSacramentos: '',
    observacoesGerais: '',
    visitadoresPrimeiraVisita: [],
    dataAprovacao: new Date().toISOString().substring(0, 10),
    assinaturaPresidenteNome: '',
    statusSindicancia: 'aprovado',
  });

  const [membrosConferencia, setMembrosConferencia] = useState<MembroSSVP[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2. Inicializar com dados da família se estiver editando
  useEffect(() => {
    if (familiaToEdit && familiaToEdit.sindicancia) {
      setFormData({
        ...familiaToEdit.sindicancia,
        membrosFamilia: Array.isArray(familiaToEdit.sindicancia.membrosFamilia)
          ? familiaToEdit.sindicancia.membrosFamilia
          : [],
      });
    } else {
      // Novo Cadastro em Branco
      setFormData({
        assistidoNome: '',
        assistidoDataNasc: '',
        assistidoCpf: '',
        assistidoRg: '',
        assistidoTelefone: '',
        conjugeNome: '',
        conjugeDataNasc: '',
        endereco: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: 'SP',
        cep: '',
        complemento: '',
        estadoCivil: 'casado',
        religiao: 'Católica',
        situacaoMoradia: 'alugada',
        membrosFamilia: [],
        profissao: '',
        quantosTrabalham: 0,
        valorAluguel: 0,
        rendaLiquida: 0,
        assistenciaGoverno: '',
        valorAssistenciaGoverno: 0,
        outrasRendas: 0,
        alguemDoente: '',
        precisaMedicacao: false,
        medicacaoDetalhes: '',
        participacaoIgreja: '',
        precisamSacramentos: '',
        observacoesGerais: '',
        visitadoresPrimeiraVisita: [],
        dataAprovacao: new Date().toISOString().substring(0, 10),
        assinaturaPresidenteNome: '',
        statusSindicancia: 'aprovado',
      });
    }
    setErrorMsg(null);
  }, [familiaToEdit, isOpen]);

  // 3. Carregar membros da conferência para selecionar visitadores da sindicância
  useEffect(() => {
    if (conferenciaId && isOpen) {
      fetchMembrosConferencia(conferenciaId, { status: 'ativo' }, institutionId)
        .then((membros) => setMembrosConferencia(membros || []))
        .catch((err) => console.error('Erro ao carregar membros da conferência:', err));
    }
  }, [conferenciaId, isOpen, institutionId]);

  if (!isOpen) return null;

  // --- Manipulação de Membros Familiares ---
  const handleAddMembro = () => {
    const novoMembro: MembroFamiliarComposicao = {
      id: Math.random().toString(36).substring(2, 9),
      name: '',
      birthDate: '',
      isBatizado: false,
      kinship: 'Filho(a)',
    };
    setFormData((prev) => ({
      ...prev,
      membrosFamilia: [...(prev.membrosFamilia || []), novoMembro],
    }));
  };

  const handleUpdateMembro = (id: string, field: keyof MembroFamiliarComposicao, value: any) => {
    setFormData((prev) => ({
      ...prev,
      membrosFamilia: prev.membrosFamilia.map((m) => {
        if (m.id === id) {
          const updated = { ...m, [field]: value };
          // Calcular idade se data de nascimento mudou
          if (field === 'birthDate' && value) {
            const birth = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const mDiff = today.getMonth() - birth.getMonth();
            if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
              age--;
            }
            updated.age = age >= 0 ? age : 0;
          }
          return updated;
        }
        return m;
      }),
    }));
  };

  const handleRemoveMembro = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      membrosFamilia: prev.membrosFamilia.filter((m) => m.id !== id),
    }));
  };

  // --- Seleção de Visitadores ---
  const toggleVisitador = (nome: string) => {
    setFormData((prev) => {
      const list = prev.visitadoresPrimeiraVisita || [];
      if (list.includes(nome)) {
        return { ...prev, visitadoresPrimeiraVisita: list.filter((v) => v !== nome) };
      } else {
        return { ...prev, visitadoresPrimeiraVisita: [...list, nome] };
      }
    });
  };

  // --- Salvar Ficha de Sindicância ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assistidoNome.trim()) {
      setErrorMsg('O Nome do Assistido é obrigatório.');
      return;
    }
    if (!formData.endereco.trim()) {
      setErrorMsg('O Endereço é obrigatório.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      let savedFamilia: FamiliaAssistidaCompleta;

      if (familiaToEdit) {
        // Atualizar
        savedFamilia = await updateFamiliaAssistida(
          familiaToEdit.id,
          {
            nomeAssistido: formData.assistidoNome.trim(),
            cpfAssistido: formData.assistidoCpf?.trim() || '',
            telefone: formData.assistidoTelefone?.trim() || '',
            enderecoResumido: `${formData.endereco}, ${formData.numero || 's/n'} - ${formData.bairro || ''}`,
            sindicancia: formData,
          },
          institutionId
        );
      } else {
        // Criar Novo
        savedFamilia = await createFamiliaAssistida(conferenciaId, formData, institutionId);
      }

      onSuccess(savedFamilia);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar sindicância:', err);
      setErrorMsg(err.message || 'Erro ao salvar ficha de sindicância.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="ficha-sindicancia-modal" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/15">
              <FileText className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">SSVP • Sindicância</span>
                {conferenciaName && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[11px] font-semibold text-blue-200 border border-blue-400/20">
                    {conferenciaName}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {familiaToEdit ? 'Editar Ficha de Sindicância' : 'Ficha de Sindicância e Cadastro de Assistidos'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Imprimir Ficha"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulário com Scroll Interno */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* SEÇÃO 1: CADASTRO DO ASSISTIDO E CÔNJUGE */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-200 pb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>CADASTRO PRINCIPAL</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome do(a) Assistido(a) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.assistidoNome}
                  onChange={(e) => setFormData({ ...formData, assistidoNome: e.target.value })}
                  placeholder="Nome completo do chefe da família"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data de Nasc.</label>
                <input
                  type="date"
                  value={formData.assistidoDataNasc || ''}
                  onChange={(e) => setFormData({ ...formData, assistidoDataNasc: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nome do(a) Cônjuge</label>
                <input
                  type="text"
                  value={formData.conjugeNome || ''}
                  onChange={(e) => setFormData({ ...formData, conjugeNome: e.target.value })}
                  placeholder="Nome do cônjuge / companheiro(a)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dt Nasc. Cônjuge</label>
                <input
                  type="date"
                  value={formData.conjugeDataNasc || ''}
                  onChange={(e) => setFormData({ ...formData, conjugeDataNasc: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  Endereço (Rua/Avenida) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Ex: Rua São Vicente de Paulo"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Número</label>
                <input
                  type="text"
                  value={formData.numero || ''}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="Nº ou S/N"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={formData.bairro || ''}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  placeholder="Bairro"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={formData.cidade || ''}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  placeholder="Cidade"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.assistidoTelefone || ''}
                  onChange={(e) => setFormData({ ...formData, assistidoTelefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CPF (Opcional)</label>
                <input
                  type="text"
                  value={formData.assistidoCpf || ''}
                  onChange={(e) => setFormData({ ...formData, assistidoCpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estado Civil</label>
                <select
                  value={formData.estadoCivil || 'casado'}
                  onChange={(e) => setFormData({ ...formData, estadoCivil: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="uniao_estavel">União Estável</option>
                  <option value="divorciado">Divorciado(a) / Separado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Religião</label>
                <input
                  type="text"
                  value={formData.religiao || ''}
                  onChange={(e) => setFormData({ ...formData, religiao: e.target.value })}
                  placeholder="Ex: Católica, Evangélica..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Situação da Moradia</label>
                <select
                  value={formData.situacaoMoradia || 'alugada'}
                  onChange={(e) => setFormData({ ...formData, situacaoMoradia: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="propria">Própria</option>
                  <option value="alugada">Alugada</option>
                  <option value="cedida">Cedida / Emprestada</option>
                  <option value="invasao">Invasão / Ocupação</option>
                  <option value="financiada">Financiada</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: MEMBROS DA FAMÍLIA */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                <Users className="w-4 h-4 text-blue-600" />
                <span>MEMBROS DA FAMÍLIA (COMPOSIÇÃO)</span>
              </div>
              <button
                type="button"
                onClick={handleAddMembro}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Adicionar Membro</span>
              </button>
            </div>

            {formData.membrosFamilia.length === 0 ? (
              <div className="py-6 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="font-semibold">Nenhum outro membro familiar adicionado.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clique no botão acima para incluir filhos, netos, pais ou outros parentes que residem na casa.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {formData.membrosFamilia.map((membro, idx) => (
                  <div
                    key={membro.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2.5 items-center justify-between"
                  >
                    <div className="w-full sm:w-1/3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Nome ({idx + 1})
                      </label>
                      <input
                        type="text"
                        placeholder="Nome do familiar"
                        value={membro.name}
                        onChange={(e) => handleUpdateMembro(membro.id, 'name', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="w-full sm:w-1/4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Data Nascimento {membro.age !== undefined ? `(${membro.age} anos)` : ''}
                      </label>
                      <input
                        type="date"
                        value={membro.birthDate || ''}
                        onChange={(e) => handleUpdateMembro(membro.id, 'birthDate', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="w-full sm:w-1/4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Parentesco
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Filho, Mãe, Neto"
                        value={membro.kinship || ''}
                        onChange={(e) => handleUpdateMembro(membro.id, 'kinship', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="w-full sm:w-auto flex items-center gap-3 justify-end pt-2 sm:pt-0">
                      <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={membro.isBatizado}
                          onChange={(e) => handleUpdateMembro(membro.id, 'isBatizado', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span>Batizado?</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveMembro(membro.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remover Membro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEÇÃO 3: SITUAÇÃO FINANCEIRA */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-200 pb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>SITUAÇÃO FINANCEIRA</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Profissão / Ocupação</label>
                <input
                  type="text"
                  value={formData.profissao || ''}
                  onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                  placeholder="Ex: Diarista, Pedreiro, Aposentado..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantos Trabalham?</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantosTrabalham ?? 0}
                  onChange={(e) => setFormData({ ...formData, quantosTrabalham: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor do Aluguel (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valorAluguel ?? 0}
                  onChange={(e) => setFormData({ ...formData, valorAluguel: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Renda Líquida Total (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.rendaLiquida ?? 0}
                  onChange={(e) => setFormData({ ...formData, rendaLiquida: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assistência do Governo</label>
                <input
                  type="text"
                  value={formData.assistenciaGoverno || ''}
                  onChange={(e) => setFormData({ ...formData, assistenciaGoverno: e.target.value })}
                  placeholder="Ex: Bolsa Família, BPC, Vale Gás..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor do Benefício (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.valorAssistenciaGoverno ?? 0}
                  onChange={(e) => setFormData({ ...formData, valorAssistenciaGoverno: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: OBSERVAÇÕES DA SINDICÂNCIA */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-200 pb-2">
              <Heart className="w-4 h-4 text-rose-600" />
              <span>OBSERVAÇÕES DA SINDICÂNCIA</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alguém doente na família? Precisa de medicação contínua?
                </label>
                <input
                  type="text"
                  value={formData.alguemDoente || ''}
                  onChange={(e) => setFormData({ ...formData, alguemDoente: e.target.value })}
                  placeholder="Descreva se há enfermos, idosos acamados ou necessidades de remédios..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Participação da Igreja?
                </label>
                <input
                  type="text"
                  value={formData.participacaoIgreja || ''}
                  onChange={(e) => setFormData({ ...formData, participacaoIgreja: e.target.value })}
                  placeholder="Ex: Frequenta a paróquia local, pastoral, etc."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Precisam dos sacramentos? (Batismo, Crisma, Matrimônio...)
                </label>
                <input
                  type="text"
                  value={formData.precisamSacramentos || ''}
                  onChange={(e) => setFormData({ ...formData, precisamSacramentos: e.target.value })}
                  placeholder="Ex: Casamento religioso, batismo dos filhos..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Demais Observações
                </label>
                <textarea
                  rows={3}
                  value={formData.observacoesGerais || ''}
                  onChange={(e) => setFormData({ ...formData, observacoesGerais: e.target.value })}
                  placeholder="Condições da casa, necessidades imediatas, impressões da primeira visita vicentina..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 5: VISITADORES E APROVAÇÃO */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm border-b border-slate-200 pb-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>VISITADORES DA SINDICÂNCIA & APROVAÇÃO</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Visitadores que realizaram a sindicância:
              </label>
              {membrosConferencia.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {membrosConferencia.map((m) => {
                    const isSelected = formData.visitadoresPrimeiraVisita?.includes(m.fullName);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleVisitador(m.fullName)}
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
              ) : (
                <input
                  type="text"
                  value={(formData.visitadoresPrimeiraVisita || []).join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      visitadoresPrimeiraVisita: e.target.value.split(',').map((s) => s.trim()),
                    })
                  }
                  placeholder="Nomes dos visitadores separados por vírgula"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Aprovado em (Data)</label>
                <input
                  type="date"
                  value={formData.dataAprovacao || ''}
                  onChange={(e) => setFormData({ ...formData, dataAprovacao: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Presidente da Conferência</label>
                <input
                  type="text"
                  value={formData.assinaturaPresidenteNome || ''}
                  onChange={(e) => setFormData({ ...formData, assinaturaPresidenteNome: e.target.value })}
                  placeholder="Nome do Presidente que aprovou"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Rodapé e Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-all text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 text-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Salvando Ficha...' : 'Salvar Ficha de Sindicância'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

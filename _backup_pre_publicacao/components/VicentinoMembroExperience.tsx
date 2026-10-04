import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  User, 
  HeartHandshake, 
  LogOut, 
  KeyRound, 
  Phone, 
  Home, 
  CheckCircle2, 
  Clock, 
  ArrowLeft,
  Edit3,
  CalendarCheck,
  FolderOpen,
  Building2,
  AlertCircle
} from 'lucide-react';
import { Session, apiFetch, getAuthHeaders } from '../lib/api';
import { 
  StandaloneConferencia, 
  StandaloneConselhoParticular, 
  FamiliaAssistidaCompleta, 
  VisitaFamiliaSSVP 
} from '../types';
import { 
  fetchFamiliasAssistidas, 
  fetchVisitasFamilia 
} from '../lib/hierarchy_api';
import { FichaSindicanciaModal } from './FichaSindicanciaModal';
import { VisitasFamiliaModal } from './VisitasFamiliaModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { MeuPerfilVicentino } from './MeuPerfilVicentino';
import { DiretoriaChoiceView } from './DiretoriaChoiceView';
import { GestaoConferenciaInicialView } from './GestaoConferenciaInicialView';

interface VicentinoMembroExperienceProps {
  session: Session;
  onLogout: () => void;
}

type TabType = 'familias' | 'visitas' | 'perfil';
type DirectorScreenMode = 'cards' | 'familias' | 'gestao';

export const VicentinoMembroExperience: React.FC<VicentinoMembroExperienceProps> = ({
  session,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('familias');
  const [searchTerm, setSearchTerm] = useState('');
  const [familias, setFamilias] = useState<FamiliaAssistidaCompleta[]>([]);
  const [visitasGerais, setVisitasGerais] = useState<{ visita: VisitaFamiliaSSVP; familiaNome: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFamilia, setSelectedFamilia] = useState<FamiliaAssistidaCompleta | null>(null);

  // Vínculo autenticado e dinamicamente verificado da Diretoria (fonte final é a resposta protegida do backend)
  const [boardRole, setBoardRole] = useState<any>(null);
  const [isVerifyingBoard, setIsVerifyingBoard] = useState(true);
  const [boardVerifyError, setBoardVerifyError] = useState<string | null>(null);

  // Modo de tela: para membro comum permanece 'familias'.
  // Para membro com diretoria confirmada em tempo real (isDirector: true), torna-se 'cards'.
  const [directorMode, setDirectorMode] = useState<DirectorScreenMode>('familias');
  
  // Modais
  const [isSindicanciaOpen, setIsSindicanciaOpen] = useState(false);
  const [editingFamilia, setEditingFamilia] = useState<FamiliaAssistidaCompleta | null>(null);
  const [isVisitaModalOpen, setIsVisitaModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Estado de nomes resolvidos da API de perfil como fallback dinâmico
  const [profileConferenciaNome, setProfileConferenciaNome] = useState<string>('');
  const [profileParticularNome, setProfileParticularNome] = useState<string>('');

  const conferenciaId = session.conferenciaId || session.hierarchy?.conferenciaId || '';
  const particularId = session.particularId || session.hierarchy?.particularId || '';

  // Resolução do Nome da Conferência:
  // 1. session.hierarchy?.conferenciaNome
  // 2. Unidade do tipo conferencia em session.availableUnits cujo ID corresponda ao conferenciaId autorizado
  // 3. Nome retornado pelo endpoint do perfil, quando disponível
  // 4. Fallback "Minha Conferência"
  const conferenciaNome = useMemo(() => {
    if (session.hierarchy?.conferenciaNome && session.hierarchy.conferenciaNome.trim()) {
      return session.hierarchy.conferenciaNome;
    }
    if (session.conferenciaNome && session.conferenciaNome.trim()) {
      return session.conferenciaNome;
    }
    if (session.availableUnits && Array.isArray(session.availableUnits)) {
      const matchingUnit = session.availableUnits.find(
        u => u.type === 'conferencia' && (!conferenciaId || u.id === conferenciaId)
      );
      if (matchingUnit && matchingUnit.name && matchingUnit.name.trim()) {
        return matchingUnit.name;
      }
    }
    if (profileConferenciaNome && profileConferenciaNome.trim()) {
      return profileConferenciaNome;
    }
    return 'Minha Conferência';
  }, [session.hierarchy?.conferenciaNome, session.conferenciaNome, session.availableUnits, conferenciaId, profileConferenciaNome]);

  // Resolução do Nome do Conselho Particular (apenas onde necessário internamente):
  // 1. session.hierarchy?.particularNome
  // 2. Unidade ou parentName em session.availableUnits
  // 3. Nome retornado pelo endpoint do perfil
  // 4. Fallback "Conselho Particular Vinculado"
  const particularNome = useMemo(() => {
    if (session.hierarchy?.particularNome && session.hierarchy.particularNome.trim()) {
      return session.hierarchy.particularNome;
    }
    if (session.particularNome && session.particularNome.trim()) {
      return session.particularNome;
    }
    if (session.availableUnits && Array.isArray(session.availableUnits)) {
      const matchingUnit = session.availableUnits.find(
        u => (!particularId || u.particularId === particularId || u.id === particularId) && u.parentName
      );
      if (matchingUnit && matchingUnit.parentName) {
        return matchingUnit.parentName;
      }
    }
    if (profileParticularNome && profileParticularNome.trim()) {
      return profileParticularNome;
    }
    return '';
  }, [session.hierarchy?.particularNome, session.particularNome, session.availableUnits, particularId, profileParticularNome]);

  // Criar objetos compatíveis para os modais
  const mockConferencia: StandaloneConferencia = useMemo(() => ({
    id: conferenciaId,
    name: conferenciaNome,
    particularId: particularId,
    status: 'ativo'
  }), [conferenciaId, conferenciaNome, particularId]);

  const mockCP: StandaloneConselhoParticular = useMemo(() => ({
    id: particularId,
    name: particularNome || 'Conselho Particular Vinculado',
    centralId: session.centralId || session.institutionId || '',
    status: 'ativo'
  }), [particularId, particularNome, session.centralId, session.institutionId]);

  // Carregar dados de famílias e histórico da conferência
  const loadData = async () => {
    if (!conferenciaId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const resFamilias = await fetchFamiliasAssistidas(conferenciaId);
      const famList = Array.isArray(resFamilias) ? resFamilias : [];
      setFamilias(famList);

      // Se há uma família selecionada, atualizar seus dados na memória
      if (selectedFamilia) {
        const updated = famList.find(f => f.id === selectedFamilia.id);
        if (updated) setSelectedFamilia(updated);
      }

      // Buscar visitas de todas as famílias para a aba geral de visitas
      const allVisitas: { visita: VisitaFamiliaSSVP; familiaNome: string }[] = [];
      for (const fam of famList) {
        try {
          const vList = await fetchVisitasFamilia(fam.id);
          if (Array.isArray(vList)) {
            vList.forEach(v => {
              allVisitas.push({
                visita: v,
                familiaNome: fam.nomeAssistido || fam.sindicancia?.assistidoNome || 'Família Assistida'
              });
            });
          }
        } catch (e) {
          console.error(`Erro ao carregar visitas da família ${fam.id}:`, e);
        }
      }
      // Ordenar visitas da mais recente para a mais antiga
      allVisitas.sort((a, b) => new Date(b.visita.dataVisita).getTime() - new Date(a.visita.dataVisita).getTime());
      setVisitasGerais(allVisitas);

    } catch (err) {
      console.error('Erro ao carregar famílias da conferência:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [conferenciaId]);

  // Verificação dinâmica de autorização de diretoria a cada carregamento com cabeçalho de autenticação
  const verifyBoardRole = useCallback(async () => {
    setIsVerifyingBoard(true);
    setBoardVerifyError(null);
    try {
      const res = await apiFetch('/api/me/diretoria-conferencia', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.isDirector === true) {
          setBoardRole(data);
          setDirectorMode('cards');
        } else {
          setBoardRole(null);
          setDirectorMode('familias');
        }
      } else if (res.status === 401) {
        // Sessão não autenticada como diretoria ou token inválido: mantém membro em famílias
        setBoardRole(null);
        setDirectorMode('familias');
      } else {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Falha ao verificar permissões de diretoria.');
      }
    } catch (err: any) {
      console.error('Erro ao verificar cargo de diretoria:', err);
      setBoardVerifyError(err.message || 'Não foi possível verificar as permissões de diretoria.');
      setBoardRole(null);
      setDirectorMode('familias');
    } finally {
      setIsVerifyingBoard(false);
    }
  }, []);

  useEffect(() => {
    verifyBoardRole();
  }, [verifyBoardRole]);

  const primeiroNome = useMemo(() => {
    if (boardRole?.primeiroNome) return boardRole.primeiroNome;
    const rawName = session.fullName || session.username || '';
    const parts = rawName.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const first = parts[0];
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
    return 'Vicentino(a)';
  }, [boardRole?.primeiroNome, session.fullName, session.username]);

  // Filtragem de famílias pela busca
  const filteredFamilias = useMemo(() => {
    if (!searchTerm.trim()) return familias.filter(f => f.status !== 'arquivado');
    const term = searchTerm.toLowerCase();
    return familias.filter(f => 
      f.status !== 'arquivado' && (
        (f.nomeAssistido && f.nomeAssistido.toLowerCase().includes(term)) ||
        (f.sindicancia?.assistidoNome && f.sindicancia.assistidoNome.toLowerCase().includes(term)) ||
        (f.sindicancia?.bairro && f.sindicancia.bairro.toLowerCase().includes(term)) ||
        (f.enderecoResumido && f.enderecoResumido.toLowerCase().includes(term))
      )
    );
  }, [familias, searchTerm]);

  // Formatação de data
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não registrada';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Enquanto a verificação estiver sendo realizada, evita mostrar brevemente a tela de Famílias antes dos cards
  if (isVerifyingBoard) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans antialiased text-slate-800">
        <div className="w-10 h-10 border-4 border-blue-100 border-t-[#0b4d8c] rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          Carregando perfil e permissões...
        </p>
      </div>
    );
  }

  // Se a consulta falhar, não concede Gestão da Conferência e apresenta opção simples para tentar novamente sem desconectar
  if (boardVerifyError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans antialiased text-slate-800">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-lg border border-slate-100 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Verificação de Diretoria</h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Não foi possível verificar o vínculo de diretoria da Conferência no momento.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              onClick={() => verifyBoardRole()}
              className="w-full py-3 bg-[#0b4d8c] hover:bg-[#093d70] text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-blue-900/10 cursor-pointer"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => {
                setBoardVerifyError(null);
                setBoardRole(null);
                setDirectorMode('familias');
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-2xl transition-all cursor-pointer"
            >
              Prosseguir para Famílias
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se o usuário possui vínculo ativo na diretoria e está no modo 'cards', exibe a tela de escolha
  if (boardRole?.isDirector && directorMode === 'cards') {
    return (
      <DiretoriaChoiceView
        primeiroNome={primeiroNome}
        roleTitle={boardRole.formattedRoleTitle || 'Membro da Diretoria'}
        conferenciaNome={conferenciaNome}
        onSelectFamilias={() => {
          setDirectorMode('familias');
          setActiveTab('familias');
        }}
        onSelectGestao={() => {
          setDirectorMode('gestao');
        }}
        onOpenProfile={() => {
          setDirectorMode('familias');
          setActiveTab('perfil');
        }}
        onLogout={onLogout}
      />
    );
  }

  // Se o usuário possui vínculo ativo na diretoria e acessou a gestão inicial da conferência
  if (boardRole?.isDirector && directorMode === 'gestao') {
    return (
      <GestaoConferenciaInicialView
        conferenciaId={conferenciaId}
        conferenciaNome={conferenciaNome}
        roleTitle={boardRole.formattedRoleTitle}
        onBack={() => setDirectorMode('cards')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 pb-24">
      
      {/* CABEÇALHO AZUL OFICIAL (Conforme imagem anexada) */}
      <header className="bg-[#0b4d8c] text-white px-5 pt-8 pb-6 rounded-b-[28px] shadow-md sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            {boardRole?.isDirector ? (
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setDirectorMode('cards')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-0.5 rounded-full border border-white/20 transition-all cursor-pointer"
                  title="Retornar para a tela inicial de escolha"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Início
                </button>
                <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase">
                  {boardRole.primaryRole || 'Diretoria'}
                </span>
              </div>
            ) : (
              <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase block mb-0.5">
                Minha Conferência
              </span>
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
              {conferenciaNome}
            </h1>
          </div>
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <HeartHandshake className="w-5 h-5 text-blue-100" />
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (Mobile-First / Max-W-MD) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-5">
        
        {/* ABA: FAMÍLIAS */}
        {activeTab === 'familias' && (
          <div>
            {/* SE UMA FAMÍLIA ESPECÍFICA ESTIVER ABERTA (Ficha Detalhada) */}
            {selectedFamilia ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Botão Voltar */}
                <button
                  onClick={() => setSelectedFamilia(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b4d8c] hover:text-blue-800 transition-colors py-1 px-1 -ml-1 rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para lista de famílias
                </button>

                {/* Card Cabeçalho da Família */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">
                          {selectedFamilia.nomeAssistido || selectedFamilia.sindicancia?.assistidoNome}
                        </h2>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                          <CheckCircle2 className="w-3 h-3" /> Assistência Ativa
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ação de maior destaque: Registrar nova visita */}
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 gap-2.5">
                    <button
                      onClick={() => setIsVisitaModalOpen(true)}
                      className="w-full bg-[#0b4d8c] hover:bg-[#093c6e] text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all text-base cursor-pointer"
                    >
                      <CalendarCheck className="w-5 h-5 text-blue-200" />
                      Registrar nova visita
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setEditingFamilia(selectedFamilia);
                          setIsSindicanciaOpen(true);
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-sm transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 text-slate-500" />
                        Editar dados
                      </button>

                      <button
                        onClick={() => setIsVisitaModalOpen(true)}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-sm transition-colors cursor-pointer"
                      >
                        <Clock className="w-4 h-4 text-slate-500" />
                        Ver histórico
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resumo da Sindicância e Moradia */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Informações e Localização
                  </h3>

                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-800">
                        {selectedFamilia.sindicancia?.endereco || selectedFamilia.enderecoResumido || 'Endereço não informado'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Bairro {selectedFamilia.sindicancia?.bairro || 'Não informado'} • {selectedFamilia.sindicancia?.cidade || 'Jaboticabal'}/SP
                      </p>
                    </div>
                  </div>

                  {selectedFamilia.sindicancia?.assistidoTelefone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-700 font-medium">{selectedFamilia.sindicancia.assistidoTelefone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm">
                    <Home className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">
                      Moradia: <strong className="capitalize text-slate-900">{selectedFamilia.sindicancia?.tipoMoradia || 'Não especificada'}</strong>
                      {selectedFamilia.sindicancia?.valorAluguel ? ` (Aluguel: R$ ${selectedFamilia.sindicancia.valorAluguel})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">
                      Data da Sindicância: <strong className="text-slate-900">{formatDate(selectedFamilia.sindicancia?.dataSindicancia)}</strong>
                    </span>
                  </div>
                </div>

                {/* Composição Familiar */}
                {selectedFamilia.sindicancia?.membrosFamilia && selectedFamilia.sindicancia.membrosFamilia.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Composição Familiar ({selectedFamilia.sindicancia.membrosFamilia.length} pessoas)
                    </h3>
                    <div className="divide-y divide-slate-100">
                      {selectedFamilia.sindicancia.membrosFamilia.map((m, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                          <div>
                            <p className="font-semibold text-slate-800">{m.nome}</p>
                            <p className="text-xs text-slate-500">{m.parentesco || 'Membro familiar'} {m.idade ? `• ${m.idade} anos` : ''}</p>
                          </div>
                          {m.ocupacao && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
                              {m.ocupacao}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parecer da Conferência */}
                {selectedFamilia.sindicancia?.parecerConferencia && (
                  <div className="bg-blue-50/70 rounded-2xl p-4 border border-blue-100 space-y-1.5">
                    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Parecer e Encaminhamento da Conferência
                    </h4>
                    <p className="text-sm text-blue-950 leading-relaxed italic">
                      "{selectedFamilia.sindicancia.parecerConferencia}"
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* LISTAGEM DE FAMÍLIAS (Conforme Referência Visual) */
              <div className="space-y-4">
                
                {/* Título da Tela */}
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Famílias Assistidas
                </h2>

                {/* Campo de Busca */}
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar família..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4d8c] focus:border-transparent text-sm shadow-sm transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Botão Principal: + Nova família / Sindicância */}
                <button
                  onClick={() => {
                    setEditingFamilia(null);
                    setIsSindicanciaOpen(true);
                  }}
                  className="w-full bg-[#0b4d8c] hover:bg-[#093c6e] active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-base cursor-pointer"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  Nova família / Sindicância
                </button>

                {/* Lista de Famílias */}
                <div className="space-y-3.5 pt-1">
                  {isLoading ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="w-8 h-8 border-3 border-[#0b4d8c] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium">Carregando famílias da conferência...</p>
                    </div>
                  ) : filteredFamilias.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-3">
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0b4d8c] flex items-center justify-center mx-auto">
                        <FolderOpen className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Nenhuma família encontrada</h3>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        {searchTerm ? 'Nenhuma família corresponde aos termos da busca.' : 'Cadastre a primeira família da sua conferência clicando no botão acima.'}
                      </p>
                    </div>
                  ) : (
                    filteredFamilias.map((fam) => {
                      const nome = fam.nomeAssistido || fam.sindicancia?.assistidoNome || 'Família Assistida';
                      const bairro = fam.sindicancia?.bairro || (fam.enderecoResumido ? fam.enderecoResumido.split(',')[1] || 'Bairro Centro' : 'Bairro não informado');
                      const ultimaVisitaData = fam.dataUltimaVisita;

                      return (
                        <div
                          key={fam.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-blue-200 transition-all space-y-3"
                        >
                          {/* Topo do Card: Ícone + Nome do Responsável */}
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                              <Users className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-slate-900 truncate">
                                {nome}
                              </h3>
                              
                              {/* Bairro */}
                              <div className="flex items-center gap-1 text-xs text-slate-600 mt-1 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Bairro: {bairro.trim()}</span>
                              </div>

                              {/* Última Visita */}
                              <div className="flex items-center gap-1 text-xs text-slate-600 mt-1 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Última visita: {formatDate(ultimaVisitaData)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Botão de Abertura da Família */}
                          <button
                            onClick={() => setSelectedFamilia(fam)}
                            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0b4d8c] font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer"
                          >
                            <span>Abrir família</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA: VISITAS (Histórico Geral da Conferência) */}
        {activeTab === 'visitas' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Visitas Domiciliares
            </h2>
            <p className="text-xs text-slate-500 -mt-2">
              Histórico das visitas realizadas pelas duplas da {conferenciaNome}.
            </p>

            {isLoading ? (
              <div className="py-12 text-center text-slate-400">
                <div className="w-8 h-8 border-3 border-[#0b4d8c] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Carregando histórico de visitas...</p>
              </div>
            ) : visitasGerais.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0b4d8c] flex items-center justify-center mx-auto">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Nenhuma visita registrada</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Abra uma família na aba "Famílias" para registrar a visita semanal com entrega de auxílios.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visitasGerais.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">{item.familiaNome}</h4>
                      <span className="text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                        {formatDate(item.visita.dataVisita)}
                      </span>
                    </div>

                    {item.visita.visitadoresNomes && item.visita.visitadoresNomes.length > 0 && (
                      <p className="text-xs text-slate-600">
                        <strong className="text-slate-700">Visitadores:</strong> {item.visita.visitadoresNomes.join(', ')}
                      </p>
                    )}

                    {item.visita.entregueCesta && (
                      <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Cesta Básica Entregue ({item.visita.quantidadeCestas || 1} un)
                      </div>
                    )}

                    {item.visita.comentarios && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                        "{item.visita.comentarios}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: MEU PERFIL */}
        {activeTab === 'perfil' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Meu Perfil
            </h2>

            {/* Ficha Completa e Edição de Dados Pessoais */}
            <MeuPerfilVicentino
              conferenciaNomeDefault={conferenciaNome}
              particularNomeDefault={particularNome}
              usernameDefault={session.username}
              onProfileLoaded={(data) => {
                if (data.conferenciaNome) {
                  setProfileConferenciaNome(data.conferenciaNome);
                }
                if (data.particularNome) {
                  setProfileParticularNome(data.particularNome);
                }
              }}
            />

            {/* Ações de Conta */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {boardRole?.isDirector && (
                <button
                  onClick={() => setDirectorMode('gestao')}
                  className="w-full p-4 flex items-center justify-between hover:bg-blue-50/60 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0b4d8c] flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Gestão da Conferência</p>
                      <p className="text-xs text-slate-500">Acessar dados e diretoria da unidade</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Alterar minha senha</p>
                    <p className="text-xs text-slate-500">Atualize sua senha de acesso</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={onLogout}
                className="w-full p-4 flex items-center justify-between hover:bg-rose-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-rose-600">Sair do sistema</p>
                    <p className="text-xs text-rose-400">Encerrar sessão no dispositivo</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400" />
              </button>
            </div>
          </div>
        )}

      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA (Conforme imagem: Famílias | Visitas | Meu perfil) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 px-6 z-40 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around">
          
          {/* Botão Famílias */}
          <button
            onClick={() => {
              setActiveTab('familias');
              setSelectedFamilia(null);
            }}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'familias' ? 'text-[#0b4d8c]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-[11px] font-bold">Famílias</span>
          </button>

          {/* Botão Visitas */}
          <button
            onClick={() => {
              setActiveTab('visitas');
              setSelectedFamilia(null);
            }}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'visitas' ? 'text-[#0b4d8c]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-[11px] font-bold">Visitas</span>
          </button>

          {/* Botão Meu perfil */}
          <button
            onClick={() => {
              setActiveTab('perfil');
              setSelectedFamilia(null);
            }}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'perfil' ? 'text-[#0b4d8c]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-[11px] font-bold">Meu perfil</span>
          </button>

        </div>
      </nav>

      {/* MODAL: FICHA DE SINDICÂNCIA (REUTILIZADA COM CONFERÊNCIA BLOQUEADA) */}
      {isSindicanciaOpen && (
        <FichaSindicanciaModal
          isOpen={isSindicanciaOpen}
          onClose={() => {
            setIsSindicanciaOpen(false);
            setEditingFamilia(null);
          }}
          conferencia={mockConferencia}
          conselhoParticular={mockCP}
          editingFamilia={editingFamilia}
          onSuccess={() => {
            setIsSindicanciaOpen(false);
            setEditingFamilia(null);
            loadData();
          }}
        />
      )}

      {/* MODAL: REGISTRO DE VISITA E HISTÓRICO (REUTILIZADO) */}
      {isVisitaModalOpen && selectedFamilia && (
        <VisitasFamiliaModal
          isOpen={isVisitaModalOpen}
          onClose={() => {
            setIsVisitaModalOpen(false);
            loadData();
          }}
          familia={selectedFamilia}
          conferenciaNome={conferenciaNome}
          onVisitaSaved={() => loadData()}
        />
      )}

      {/* MODAL: ALTERAR SENHA DO MEMBRO (REUTILIZADO) */}
      {isChangePasswordOpen && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          userId={session.user?.id || session.username}
          userName={session.name || session.username}
        />
      )}

    </div>
  );
};

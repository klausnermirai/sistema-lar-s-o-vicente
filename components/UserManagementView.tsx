import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  SystemUnit 
} from '../types';
import { 
  fetchUsers, 
  saveUser, 
  deleteUser, 
  fetchSystemUnits, 
  apiFetch, 
  getAuthHeaders 
} from '../lib/api';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Key, 
  Save, 
  AlertCircle,
  UserCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Search,
  Building2,
  Landmark,
  Home,
  Check,
  X,
  RefreshCw,
  Edit3,
  Users,
  Shield,
  Briefcase,
  Phone,
  Sparkles,
  Layers,
  HeartHandshake,
  Brain,
  Activity,
  Apple,
  Palette,
  Stethoscope,
  HeartPulse,
  Filter,
  CheckSquare,
  Square,
  Globe
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

interface UserManagementViewProps {
  institutionId: string;
  currentUserId?: string;
  roles?: string[];
  onMessage: (text: string, type: 'success' | 'error') => void;
}

const ACCESS_LEVELS = [
  {
    id: 'administrador',
    label: 'Administrador Geral',
    icon: ShieldCheck,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentColor: 'border-indigo-500 bg-indigo-50/60',
    description: 'Acesso irrestrito às configurações, cadastros, relatórios e gestão financeira da entidade.'
  },
  {
    id: 'auxiliar_administrativo',
    label: 'Auxiliar Administrativo',
    icon: Briefcase,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    accentColor: 'border-blue-500 bg-blue-50/60',
    description: 'Gestão operacional de residentes, documentos, triagens e rotinas administrativas.'
  },
  {
    id: 'assistente_social',
    label: 'Assistente Social',
    icon: HeartHandshake,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentColor: 'border-emerald-500 bg-emerald-50/60',
    description: 'Triagens sociais, prontuário social, PIA, visitas familiares e relatórios técnicos.'
  },
  {
    id: 'psicologia',
    label: 'Psicologia',
    icon: Brain,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    accentColor: 'border-purple-500 bg-purple-50/60',
    description: 'Avaliações psicológicas, evolução de saúde mental, testes e acompanhamento.'
  },
  {
    id: 'fisioterapeuta',
    label: 'Fisioterapia',
    icon: Activity,
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    accentColor: 'border-teal-500 bg-teal-50/60',
    description: 'Avaliação motora, escalas funcionais, reabilitação física e planos terapêuticos.'
  },
  {
    id: 'nutricionista',
    label: 'Nutrição',
    icon: Apple,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    accentColor: 'border-amber-500 bg-amber-50/60',
    description: 'Triagem nutricional, elaboração de cardápios, dietas especiais e antropometria.'
  },
  {
    id: 'terapeuta_ocupacional',
    label: 'Terapeuta Ocupacional',
    icon: Palette,
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    accentColor: 'border-rose-500 bg-rose-50/60',
    description: 'Oficinas terapêuticas, estímulo cognitivo, autonomia e atividades em grupo.'
  },
  {
    id: 'medico',
    label: 'Médico',
    icon: Stethoscope,
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accentColor: 'border-cyan-500 bg-cyan-50/60',
    description: 'Consultas clínicas, diagnósticos, prescrição médica e evolução clínica.'
  },
  {
    id: 'enfermeira',
    label: 'Enfermagem',
    icon: HeartPulse,
    color: 'bg-red-50 text-red-700 border-red-200',
    accentColor: 'border-red-500 bg-red-50/60',
    description: 'Sinais vitais, administração de medicamentos, curativos e rotina de saúde.'
  },
  {
    id: 'cuidados',
    label: 'Cuidados / Cuidador',
    icon: Users,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    accentColor: 'border-orange-500 bg-orange-50/60',
    description: 'Rotina de cuidados, higiene, auxílio na alimentação e registro de plantão.'
  },
  {
    id: 'diretoria',
    label: 'Diretoria Vicentina',
    icon: Landmark,
    color: 'bg-slate-100 text-slate-800 border-slate-300',
    accentColor: 'border-slate-600 bg-slate-100',
    description: 'Acompanhamento institucional, visão dos Conselhos e relatórios gerenciais.'
  },
  {
    id: 'visitante',
    label: 'Visitante / Consulta',
    icon: Eye,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    accentColor: 'border-gray-400 bg-gray-50',
    description: 'Acesso apenas de leitura para consultas pontuais e familiares.'
  }
];

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  institutionId,
  currentUserId,
  roles = [],
  onMessage
}) => {
  const [subTab, setSubTab] = useState<'list' | 'form'>('list');
  const [users, setUsers] = useState<User[]>([]);
  const [systemUnits, setSystemUnits] = useState<SystemUnit[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtros da listagem de usuários
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'obras' | 'conselhos' | 'conferencias'>('all');

  // Estado do formulário de edição/criação
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string } | null>(null);

  // Form State
  const [formState, setFormState] = useState<{
    username: string;
    fullName: string;
    phone: string;
    password: string;
    role: string;
    professionalRegistration: string;
    accessLevel: string;
    funcionarioId: string;
    status: 'ativo' | 'inativo';
    hasAllUnitsAccess: boolean;
    selectedUnitIds: string[];
    notes: string;
  }>({
    username: '',
    fullName: '',
    phone: '',
    password: '',
    role: '',
    professionalRegistration: '',
    accessLevel: 'administrador',
    funcionarioId: '',
    status: 'ativo',
    hasAllUnitsAccess: false,
    selectedUnitIds: [],
    notes: ''
  });

  // Filtros de seleção de unidades dentro do formulário
  const [unitSearch, setUnitSearch] = useState('');
  const [unitTypeTab, setUnitTypeTab] = useState<'todos' | 'obras' | 'conselhos' | 'conferencias'>('todos');

  // Extrai com precisão todos os identificadores de unidades vinculadas ao usuário
  const extractUnitIdsFromUser = (user: any, units: SystemUnit[]): string[] => {
    if (!user) return [];
    const rawList: any[] = [];
    
    if (Array.isArray(user.allowedUnits)) rawList.push(...user.allowedUnits);
    if (Array.isArray(user.authorizedUnits)) rawList.push(...user.authorizedUnits);
    if (Array.isArray(user.institutionIds)) rawList.push(...user.institutionIds);
    if (user.institutionId) rawList.push(user.institutionId);
    if (user.conferenciaId) rawList.push(user.conferenciaId);
    if (user.particularId) rawList.push(user.particularId);

    const matchedSet = new Set<string>();

    rawList.forEach(item => {
      if (!item) return;
      let key = '';
      if (typeof item === 'string') {
        key = item.trim();
      } else if (typeof item === 'object') {
        key = item.id || item.cnpj || item.institutionId || item.name || '';
      }
      if (!key) return;

      let foundMatch = false;
      units.forEach(su => {
        const suId = su.id || '';
        const suCnpj = su.cnpj || '';
        const suName = su.name || '';
        if ((suId && suId === key) || (suCnpj && suCnpj === key) || (suName && suName.toLowerCase() === key.toLowerCase())) {
          if (suId) matchedSet.add(suId);
          if (suCnpj) matchedSet.add(suCnpj);
          foundMatch = true;
        }
      });

      if (!foundMatch) {
        matchedSet.add(key);
      }
    });

    return Array.from(matchedSet).filter(Boolean);
  };

  useEffect(() => {
    loadAllData();
  }, [institutionId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [usersData, unitsData] = await Promise.all([
        fetchUsers(institutionId, true),
        fetchSystemUnits().catch(() => [])
      ]);
      setUsers(usersData || []);
      setSystemUnits(unitsData || []);

      // Carrega colaboradores de RH para vincular
      apiFetch('/api/employees', { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => setEmployees(Array.isArray(data) ? data : []))
        .catch(() => setEmployees([]));
    } catch (err) {
      console.error('Erro ao carregar dados de usuários:', err);
      onMessage('Falha ao carregar usuários e unidades.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewUser = () => {
    setEditingUserId(null);
    setFormState({
      username: '',
      fullName: '',
      phone: '',
      password: '',
      role: '',
      professionalRegistration: '',
      accessLevel: 'administrador',
      funcionarioId: '',
      status: 'ativo',
      hasAllUnitsAccess: false,
      selectedUnitIds: institutionId ? [institutionId] : [],
      notes: ''
    });
    setShowPassword(false);
    setSubTab('form');
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUserId(user.id);
    const selectedIds = extractUnitIdsFromUser(user, systemUnits);
    const hasExplicitGlobal = user.hasAllUnitsAccess === true;

    setFormState({
      username: user.username || '',
      fullName: user.fullName || '',
      phone: user.phone || '',
      password: '', // Não preenche senha na edição
      role: user.role || '',
      professionalRegistration: user.professionalRegistration || '',
      accessLevel: user.accessLevel || 'administrador',
      funcionarioId: user.funcionarioId || '',
      status: (user.status as 'ativo' | 'inativo') || 'ativo',
      hasAllUnitsAccess: hasExplicitGlobal,
      selectedUnitIds: selectedIds.length > 0 ? selectedIds : (institutionId ? [institutionId] : []),
      notes: user.notes || ''
    });
    setShowPassword(false);
    setSubTab('form');
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormState(prev => ({ ...prev, password: pass }));
    setShowPassword(true);
    onMessage(`Senha gerada com sucesso: ${pass}`, 'success');
  };

  const toggleUnitSelection = (unitIdOrCnpj: string) => {
    setFormState(prev => {
      const matchedUnit = systemUnits.find(u => u.id === unitIdOrCnpj || u.cnpj === unitIdOrCnpj);
      const keysToMatch = new Set<string>([unitIdOrCnpj]);
      if (matchedUnit) {
        if (matchedUnit.id) keysToMatch.add(matchedUnit.id);
        if (matchedUnit.cnpj) keysToMatch.add(matchedUnit.cnpj);
      }

      const isChecked = prev.selectedUnitIds.some(id => keysToMatch.has(id));

      let updated: string[];
      if (isChecked) {
        updated = prev.selectedUnitIds.filter(id => !keysToMatch.has(id));
      } else {
        const primaryKey = matchedUnit?.id || matchedUnit?.cnpj || unitIdOrCnpj;
        updated = [...prev.selectedUnitIds, primaryKey];
        if (matchedUnit?.cnpj && matchedUnit.cnpj !== primaryKey) {
          updated.push(matchedUnit.cnpj);
        }
      }
      return { ...prev, selectedUnitIds: Array.from(new Set(updated)) };
    });
  };

  const selectAllUnitsOfCategory = (type: 'obras' | 'conselhos' | 'conferencias' | 'all') => {
    const targetUnits = systemUnits.filter(u => {
      if (type === 'obras') return u.type === 'obra_unida' || u.type === 'lar';
      if (type === 'conselhos') return u.type === 'conselho_central' || u.type === 'conselho_particular';
      if (type === 'conferencias') return u.type === 'conferencia';
      return true;
    });

    const targetIds = targetUnits.flatMap(u => [u.id, u.cnpj].filter(Boolean) as string[]);
    setFormState(prev => {
      const merged = Array.from(new Set([...prev.selectedUnitIds, ...targetIds]));
      return { ...prev, selectedUnitIds: merged };
    });
  };

  const clearUnitsOfCategory = (type: 'obras' | 'conselhos' | 'conferencias' | 'all') => {
    if (type === 'all') {
      setFormState(prev => ({ ...prev, selectedUnitIds: [] }));
      return;
    }

    const targetUnits = systemUnits.filter(u => {
      if (type === 'obras') return u.type === 'obra_unida' || u.type === 'lar';
      if (type === 'conselhos') return u.type === 'conselho_central' || u.type === 'conselho_particular';
      if (type === 'conferencias') return u.type === 'conferencia';
      return false;
    });

    const targetKeys = new Set(targetUnits.flatMap(u => [u.id, u.cnpj].filter(Boolean) as string[]));
    setFormState(prev => ({
      ...prev,
      selectedUnitIds: prev.selectedUnitIds.filter(id => !targetKeys.has(id))
    }));
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.username.trim()) {
      onMessage('O e-mail / nome de usuário é obrigatório.', 'error');
      return;
    }
    if (!editingUserId && !formState.password.trim()) {
      onMessage('A senha inicial é obrigatória para novos usuários.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Monta os dados das unidades autorizadas selecionadas
      const allowedUnitsData: SystemUnit[] = formState.hasAllUnitsAccess
        ? []
        : systemUnits.filter(u => {
            const uId = u.id || '';
            const uCnpj = u.cnpj || '';
            return formState.selectedUnitIds.includes(uId) || (uCnpj && formState.selectedUnitIds.includes(uCnpj));
          });

      const primaryInstitutionId = (!formState.hasAllUnitsAccess && formState.selectedUnitIds.length > 0)
        ? formState.selectedUnitIds[0]
        : (editingUserId ? (users.find(u => u.id === editingUserId)?.institutionId || institutionId) : institutionId);

      const userPayload: any = {
        ...(editingUserId ? { id: editingUserId } : {}),
        username: formState.username.trim().toLowerCase(),
        fullName: formState.fullName.trim(),
        phone: formState.phone.trim(),
        role: formState.role.trim(),
        professionalRegistration: formState.professionalRegistration.trim(),
        accessLevel: formState.accessLevel,
        funcionarioId: formState.funcionarioId || undefined,
        status: formState.status,
        hasAllUnitsAccess: formState.hasAllUnitsAccess,
        institutionId: primaryInstitutionId,
        institutionIds: formState.hasAllUnitsAccess ? [] : formState.selectedUnitIds,
        authorizedUnits: formState.hasAllUnitsAccess ? [] : formState.selectedUnitIds,
        allowedUnits: allowedUnitsData,
        notes: formState.notes.trim(),
        ...(formState.password ? { password: formState.password } : {})
      };

      const saved = await saveUser(userPayload);

      if (editingUserId) {
        setUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...saved } : u));
        onMessage('Usuário e escopo de acesso atualizados com sucesso!', 'success');
      } else {
        setUsers(prev => [...prev, saved]);
        onMessage('Usuário cadastrado com sucesso!', 'success');
      }

      setSubTab('list');
      setEditingUserId(null);
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      onMessage(err?.message || 'Falha ao salvar usuário.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUserClick = async (user: User) => {
    if (!window.confirm(`Tem certeza que deseja desativar o acesso de ${user.fullName || user.username}?`)) return;

    try {
      await deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      onMessage('Usuário desativado com sucesso.', 'success');
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      onMessage('Falha ao excluir usuário.', 'error');
    }
  };

  // Filtragem da lista principal de usuários
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || 
        (user.fullName || '').toLowerCase().includes(term) ||
        (user.username || '').toLowerCase().includes(term) ||
        (user.role || '').toLowerCase().includes(term) ||
        (user.professionalRegistration || '').toLowerCase().includes(term);

      const matchAccess = accessFilter === 'all' || user.accessLevel === accessFilter;
      const matchStatus = statusFilter === 'all' || (user.status || 'ativo') === statusFilter;

      let matchScope = true;
      if (scopeFilter === 'global') {
        matchScope = user.hasAllUnitsAccess === true || user.accessLevel === 'super_admin';
      } else if (scopeFilter === 'obras') {
        const uIds = extractUnitIdsFromUser(user, systemUnits);
        const hasObra = systemUnits.some(u => (u.type === 'obra_unida' || u.type === 'lar') && (uIds.includes(u.id) || (u.cnpj && uIds.includes(u.cnpj))));
        matchScope = user.hasAllUnitsAccess === true || hasObra;
      } else if (scopeFilter === 'conselhos') {
        const uIds = extractUnitIdsFromUser(user, systemUnits);
        const hasConselho = systemUnits.some(u => (u.type === 'conselho_central' || u.type === 'conselho_particular') && (uIds.includes(u.id) || (u.cnpj && uIds.includes(u.cnpj))));
        matchScope = user.hasAllUnitsAccess === true || hasConselho;
      } else if (scopeFilter === 'conferencias') {
        const uIds = extractUnitIdsFromUser(user, systemUnits);
        const hasConf = systemUnits.some(u => u.type === 'conferencia' && (uIds.includes(u.id) || (u.cnpj && uIds.includes(u.cnpj))));
        matchScope = user.hasAllUnitsAccess === true || hasConf;
      }

      return matchSearch && matchAccess && matchStatus && matchScope;
    });
  }, [users, searchTerm, accessFilter, statusFilter, scopeFilter, systemUnits]);

  // Contagens para os cards de estatísticas
  const stats = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter(u => u.accessLevel === 'administrador').length;
    const multiCount = users.filter(u => ['assistente_social', 'psicologia', 'fisioterapeuta', 'nutricionista', 'terapeuta_ocupacional', 'medico', 'enfermeira', 'cuidados'].includes(u.accessLevel)).length;
    const activeCount = users.filter(u => (u.status || 'ativo') === 'ativo').length;
    return { total, adminCount, multiCount, activeCount };
  }, [users]);

  // Estatísticas de unidades por categoria para o modal de unidades
  const unitStats = useMemo(() => {
    const obras = systemUnits.filter(u => u.type === 'obra_unida' || u.type === 'lar');
    const conselhos = systemUnits.filter(u => u.type === 'conselho_central' || u.type === 'conselho_particular');
    const conferencias = systemUnits.filter(u => u.type === 'conferencia');

    const isSelected = (u: SystemUnit) => {
      const uId = u.id || '';
      const uCnpj = u.cnpj || '';
      return formState.selectedUnitIds.includes(uId) || (uCnpj && formState.selectedUnitIds.includes(uCnpj));
    };

    const selectedObras = obras.filter(isSelected).length;
    const selectedConselhos = conselhos.filter(isSelected).length;
    const selectedConferencias = conferencias.filter(isSelected).length;
    const selectedTotal = systemUnits.filter(isSelected).length;

    return {
      obrasCount: obras.length,
      selectedObras,
      conselhosCount: conselhos.length,
      selectedConselhos,
      conferenciasCount: conferencias.length,
      selectedConferencias,
      totalCount: systemUnits.length,
      selectedTotal
    };
  }, [systemUnits, formState.selectedUnitIds]);

  // Filtragem de Unidades no Modal de Permissão
  const filteredUnits = useMemo(() => {
    return systemUnits.filter(unit => {
      const term = unitSearch.toLowerCase().trim();
      const matchesSearch = !term || 
        (unit.name || '').toLowerCase().includes(term) ||
        (unit.city || '').toLowerCase().includes(term) ||
        (unit.cnpj || '').includes(term) ||
        ((unit as any).parentName || '').toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (unitTypeTab === 'obras') {
        return unit.type === 'obra_unida' || unit.type === 'lar';
      }
      if (unitTypeTab === 'conselhos') {
        return unit.type === 'conselho_central' || unit.type === 'conselho_particular';
      }
      if (unitTypeTab === 'conferencias') {
        return unit.type === 'conferencia';
      }
      return true;
    });
  }, [systemUnits, unitSearch, unitTypeTab]);

  return (
    <div className="space-y-6">
      {/* Barra Superior com Navegação de Abas Dedicadas */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#004c99]" />
            <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
              Gestão de Usuários & Níveis de Acesso
            </h2>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Crie novos logins, defina permissões de equipe e selecione com precisão as Obras, Conselhos ou Conferências de cada usuário.
          </p>
        </div>

        {/* Botões de Alternância de Abas */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubTab('list')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              subTab === 'list'
                ? 'bg-[#004c99] text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Lista de Usuários ({users.length})
          </button>
          <button
            type="button"
            onClick={handleOpenNewUser}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              subTab === 'form' && !editingUserId
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            + Criar Novo Usuário
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: LISTA DE USUÁRIOS */}
      {/* ========================================================================= */}
      {subTab === 'list' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Usuários</span>
                <span className="text-xl font-black text-slate-800">{stats.total}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administradores</span>
                <span className="text-xl font-black text-slate-800">{stats.adminCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Equipe Técnica</span>
                <span className="text-xl font-black text-slate-800">{stats.multiCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Usuários Ativos</span>
                <span className="text-xl font-black text-slate-800">{stats.activeCount}</span>
              </div>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            {/* Abas de Escopo de Entidades */}
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filtrar Escopo:
              </span>
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  scopeFilter === 'all'
                    ? 'bg-[#004c99] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('obras')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  scopeFilter === 'obras'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Obras Unidas / Lares
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('conselhos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  scopeFilter === 'conselhos'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Conselhos (Central & Particulares)
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('conferencias')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  scopeFilter === 'conferencias'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                Conferências
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('global')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  scopeFilter === 'global'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                Acesso Global
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, e-mail, cargo ou registro profissional..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={accessFilter}
                  onChange={e => setAccessFilter(e.target.value)}
                  className="flex-1 md:flex-initial px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">Todos os Perfis</option>
                  {ACCESS_LEVELS.map(level => (
                    <option key={level.id} value={level.id}>{level.label}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="flex-1 md:flex-initial px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">Todos os Status</option>
                  <option value="ativo">Apenas Ativos</option>
                  <option value="inativo">Apenas Inativos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Cards de Usuários */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p className="text-xs font-bold uppercase tracking-wider">Carregando usuários do sistema...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                <p className="text-sm font-bold text-slate-600">Nenhum usuário encontrado</p>
                <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou crie um novo acesso usando o botão acima.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const accessConfig = ACCESS_LEVELS.find(l => l.id === user.accessLevel) || {
                    id: user.accessLevel,
                    label: user.accessLevel,
                    icon: Shield,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                    accentColor: '',
                    description: ''
                  };
                  const Icon = accessConfig.icon;
                  const isCurrentLogged = user.id === currentUserId;

                  return (
                    <div 
                      key={user.id} 
                      className="p-5 sm:p-6 hover:bg-slate-50/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Avatar e Informações Principais */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0 font-black text-sm uppercase shadow-xs">
                          {user.fullName ? user.fullName.substring(0, 2) : user.username.substring(0, 2)}
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                              {user.fullName || user.username}
                            </h3>
                            {isCurrentLogged && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                                Você
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${accessConfig.color}`}>
                              <Icon className="w-3 h-3" />
                              {accessConfig.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              (user.status || 'ativo') === 'ativo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {(user.status || 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-semibold text-slate-500">
                            <span className="text-blue-700 font-bold">@{user.username}</span>
                            {user.role && <span>• Cargo: <strong className="text-slate-700">{user.role}</strong></span>}
                            {user.professionalRegistration && (
                              <span>• Registro: <strong className="text-slate-700">{user.professionalRegistration}</strong></span>
                            )}
                            {user.phone && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Phone className="w-3 h-3" /> {user.phone}
                              </span>
                            )}
                          </div>

                          {/* Escopo de Obras e Conselhos */}
                          <div className="pt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                              Acesso às Unidades:
                            </span>
                            {user.hasAllUnitsAccess === true ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                <Globe className="w-3 h-3 text-purple-600" />
                                Acesso Global (Todas as Unidades SSVP)
                              </span>
                            ) : (() => {
                              const userUnitIds = extractUnitIdsFromUser(user, systemUnits);
                              const userMatchedUnits = systemUnits.filter(u => 
                                userUnitIds.includes(u.id || '') || (u.cnpj && userUnitIds.includes(u.cnpj))
                              );

                              if (userMatchedUnits.length > 0) {
                                return (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {userMatchedUnits.slice(0, 4).map((unit, idx) => {
                                      const isConf = unit.type === 'conferencia';
                                      const isCP = unit.type === 'conselho_particular';
                                      const isCC = unit.type === 'conselho_central' || unit.cnpj === '54.927.132/0001-92';
                                      return (
                                        <span 
                                          key={unit.id || idx}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                            isConf
                                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                                              : isCP
                                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                                              : isCC
                                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          }`}
                                        >
                                          <Building2 className="w-3 h-3 opacity-70" />
                                          {unit.name}
                                        </span>
                                      );
                                    })}
                                    {userMatchedUnits.length > 4 && (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        +{userMatchedUnits.length - 4} outra(s)
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (user.institutionId) {
                                const mainUnit = systemUnits.find(u => u.id === user.institutionId || u.cnpj === user.institutionId);
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    <Building2 className="w-3 h-3 text-slate-500" />
                                    {mainUnit?.name || 'Unidade Padrão'}
                                  </span>
                                );
                              }

                              return (
                                <span className="text-[10px] font-semibold text-slate-400 italic">
                                  Nenhuma unidade vinculada
                                </span>
                              );
                            })()}
                          </div>

                          {/* Vínculo com RH */}
                          {user.funcionarioId && employees.find(e => e.id === user.funcionarioId) && (() => {
                            const emp = employees.find(e => e.id === user.funcionarioId);
                            return (
                              <div className="mt-1 text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md inline-block">
                                <span className="font-bold text-slate-700">Vínculo RH:</span> {emp.nomeCompleto} ({emp.funcao})
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(user)}
                          className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#004c99] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-blue-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar Permissões
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetPasswordUser({ id: user.id, name: user.fullName || user.username })}
                          className="px-3 py-2 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                          title="Alterar Senha"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Senha
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUserClick(user)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Desativar Acesso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: CADASTRAR / EDITAR USUÁRIO */}
      {/* ========================================================================= */}
      {subTab === 'form' && (
        <form onSubmit={handleSaveUserSubmit} className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header do Formulário */}
            <div className="p-6 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#004c99] text-white rounded-xl">
                  {editingUserId ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {editingUserId ? 'Editar Usuário & Escopo de Obras' : 'Novo Cadastro de Usuário'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    {editingUserId 
                      ? 'Defina o que este usuário pode ver e quais Obras, Conselhos ou Conferências terá acesso.' 
                      : 'Preencha as credenciais e marque as Obras, Conselhos ou Conferências autorizadas.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('list')}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Voltar à Lista
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
              {/* SEÇÃO 1: DADOS DE ACESSO & IDENTIFICAÇÃO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <UserCircle className="w-4 h-4 text-[#004c99]" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    1. Identificação & Credenciais de Acesso
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      E-mail de Usuário (Login) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formState.username}
                      onChange={e => setFormState({ ...formState, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                      placeholder="usuario@dominio.com"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Nome Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.fullName}
                      onChange={e => setFormState({ ...formState, fullName: e.target.value })}
                      placeholder="Ex: Ailton Santos"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={formState.phone}
                      onChange={e => setFormState({ ...formState, phone: e.target.value })}
                      placeholder="(16) 99999-9999"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Senha e Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        {editingUserId ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha de Acesso *'}
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Gerar Senha Segura
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!editingUserId}
                        value={formState.password}
                        onChange={e => setFormState({ ...formState, password: e.target.value })}
                        placeholder={editingUserId ? 'Deixe em branco para não alterar' : 'Digite uma senha segura'}
                        className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Status do Acesso
                    </label>
                    <div className="flex items-center gap-3 pt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="userStatus"
                          checked={formState.status === 'ativo'}
                          onChange={() => setFormState({ ...formState, status: 'ativo' })}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-emerald-700 uppercase">Ativo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="userStatus"
                          checked={formState.status === 'inativo'}
                          onChange={() => setFormState({ ...formState, status: 'inativo' })}
                          className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-xs font-bold text-rose-700 uppercase">Inativo / Bloqueado</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: PERFIL & NÍVEL DE ACESSO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-[#004c99]" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    2. Perfil & Nível de Acesso no Sistema
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ACCESS_LEVELS.map(level => {
                    const isSelected = formState.accessLevel === level.id;
                    const Icon = level.icon;

                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setFormState({ ...formState, accessLevel: level.id })}
                        className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? `${level.accentColor} border-2 shadow-xs`
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-xl border ${level.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-black text-slate-900 uppercase">
                              {level.label}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="p-1 bg-[#004c99] text-white rounded-full">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                          {level.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Cargo, Registro Profissional e Vínculo RH */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Cargo / Função na Entidade
                    </label>
                    <input
                      type="text"
                      value={formState.role}
                      onChange={e => setFormState({ ...formState, role: e.target.value })}
                      placeholder="Ex: Diretor, Assistente, Coordenador..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Registro Profissional (se aplicável)
                    </label>
                    <input
                      type="text"
                      value={formState.professionalRegistration}
                      onChange={e => setFormState({ ...formState, professionalRegistration: e.target.value })}
                      placeholder="Ex: CRM 12345, CRESS 6789..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Vincular Funcionário (RH)
                    </label>
                    <select
                      value={formState.funcionarioId}
                      onChange={e => setFormState({ ...formState, funcionarioId: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-semibold uppercase bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">(Nenhum vínculo RH)</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nomeCompleto} - {emp.funcao}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: ACESSO A UNIDADES VICENTINAS (OBRAS, CONSELHOS E CONFERÊNCIAS) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#004c99]" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      3. Escopo de Acesso a Unidades (Obras, Conselhos e Conferências)
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {formState.hasAllUnitsAccess ? 'Acesso Global' : `${unitStats.selectedTotal} unidade(s) selecionada(s)`}
                  </span>
                </div>

                {/* Alternância Acesso Total vs Seleção Específica */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    !formState.hasAllUnitsAccess 
                      ? 'bg-blue-50/60 border-blue-400 shadow-xs ring-1 ring-blue-400' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="allUnitsAccess"
                      checked={!formState.hasAllUnitsAccess}
                      onChange={() => setFormState({ ...formState, hasAllUnitsAccess: false })}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-900 uppercase block">
                        Selecionar Unidades Específicas (Recomendado)
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium leading-relaxed block mt-0.5">
                        O usuário terá acesso restrito exclusivamente às Obras Unidas, Conselhos ou Conferências marcadas abaixo. Não verá dados de outras unidades.
                      </span>
                    </div>
                  </label>

                  <label className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    formState.hasAllUnitsAccess 
                      ? 'bg-purple-50/60 border-purple-400 shadow-xs ring-1 ring-purple-400' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="allUnitsAccess"
                      checked={formState.hasAllUnitsAccess}
                      onChange={() => setFormState({ ...formState, hasAllUnitsAccess: true })}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-900 uppercase block">
                        Acesso Total / Global (Super Admin)
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium leading-relaxed block mt-0.5">
                        O usuário poderá alternar e acessar livremente todas as unidades cadastradas no sistema (todas as Obras, Conselhos e Conferências).
                      </span>
                    </div>
                  </label>
                </div>

                {/* Selecionador Granular de Unidades */}
                {!formState.hasAllUnitsAccess && (
                  <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    {/* Abas com Contadores Claros */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setUnitTypeTab('todos')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                            unitTypeTab === 'todos' 
                              ? 'bg-slate-900 text-white shadow-xs' 
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Todas ({unitStats.totalCount})
                          {unitStats.selectedTotal > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              unitTypeTab === 'todos' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {unitStats.selectedTotal}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setUnitTypeTab('obras')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                            unitTypeTab === 'obras' 
                              ? 'bg-emerald-700 text-white shadow-xs' 
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          Obras Unidas / Lares ({unitStats.obrasCount})
                          {unitStats.selectedObras > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              unitTypeTab === 'obras' ? 'bg-white text-emerald-800' : 'bg-emerald-200 text-emerald-900'
                            }`}>
                              {unitStats.selectedObras}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setUnitTypeTab('conselhos')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                            unitTypeTab === 'conselhos' 
                              ? 'bg-amber-700 text-white shadow-xs' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          Conselhos ({unitStats.conselhosCount})
                          {unitStats.selectedConselhos > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              unitTypeTab === 'conselhos' ? 'bg-white text-amber-800' : 'bg-amber-200 text-amber-900'
                            }`}>
                              {unitStats.selectedConselhos}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setUnitTypeTab('conferencias')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                            unitTypeTab === 'conferencias' 
                              ? 'bg-[#004c99] text-white shadow-xs' 
                              : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          Conferências ({unitStats.conferenciasCount})
                          {unitStats.selectedConferencias > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              unitTypeTab === 'conferencias' ? 'bg-white text-blue-900' : 'bg-blue-200 text-blue-900'
                            }`}>
                              {unitStats.selectedConferencias}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Ações Rápidas de Seleção */}
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => selectAllUnitsOfCategory(unitTypeTab === 'todos' ? 'all' : unitTypeTab)}
                          className="px-2.5 py-1 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md font-bold uppercase"
                        >
                          Selecionar Todos da Aba
                        </button>
                        <button
                          type="button"
                          onClick={() => clearUnitsOfCategory(unitTypeTab === 'todos' ? 'all' : unitTypeTab)}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-md font-bold uppercase"
                        >
                          Desmarcar da Aba
                        </button>
                      </div>
                    </div>

                    {/* Busca de Unidade */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={unitSearch}
                        onChange={e => setUnitSearch(e.target.value)}
                        placeholder="Filtrar por nome de obra, conselho, conferência, cidade ou CNPJ..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* Resumo de Seleção Atual */}
                    {unitStats.selectedTotal > 0 && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                          <span className="text-slate-400 uppercase text-[10px]">Resumo do Acesso:</span>
                          {unitStats.selectedObras > 0 && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {unitStats.selectedObras} Obra(s)
                            </span>
                          )}
                          {unitStats.selectedConselhos > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {unitStats.selectedConselhos} Conselho(s)
                            </span>
                          )}
                          {unitStats.selectedConferencias > 0 && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              {unitStats.selectedConferencias} Conferência(s)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => clearUnitsOfCategory('all')}
                          className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-800"
                        >
                          Limpar Todas as Unidades
                        </button>
                      </div>
                    )}

                    {/* Grid de Checkboxes de Unidades */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                      {filteredUnits.length === 0 ? (
                        <div className="col-span-full p-8 text-center text-slate-400 text-xs font-bold uppercase bg-white rounded-2xl border border-dashed border-slate-200">
                          Nenhuma unidade encontrada nesta categoria com os filtros aplicados.
                        </div>
                      ) : (
                        filteredUnits.map(unit => {
                          const unitId = unit.id || unit.cnpj || '';
                          const isChecked = formState.selectedUnitIds.includes(unitId) ||
                            (unit.id ? formState.selectedUnitIds.includes(unit.id) : false) ||
                            (unit.cnpj ? formState.selectedUnitIds.includes(unit.cnpj) : false);

                          const isConf = unit.type === 'conferencia';
                          const isCP = unit.type === 'conselho_particular';
                          const isCC = unit.type === 'conselho_central' || unit.cnpj === '54.927.132/0001-92';

                          return (
                            <div
                              key={unitId}
                              onClick={() => toggleUnitSelection(unitId)}
                              className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between gap-3 transition-all ${
                                isChecked
                                  ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-xs ring-1 ring-blue-400'
                                  : 'bg-white border-slate-200 hover:bg-slate-100/70 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {isChecked ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" />
                                ) : (
                                  <Square className="w-5 h-5 text-slate-300 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs font-bold block truncate uppercase text-slate-900">
                                    {unit.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                                    <strong className={
                                      isConf ? 'text-blue-700' :
                                      isCP ? 'text-amber-700' :
                                      isCC ? 'text-purple-700' : 'text-emerald-700'
                                    }>
                                      {isCC ? 'Conselho Central' : 
                                       isCP ? 'Conselho Particular' : 
                                       isConf ? 'Conferência Vicentina' : 'Obra Unida / Lar'}
                                    </strong>
                                    {unit.city && ` • ${unit.city}/${unit.state || 'SP'}`}
                                    {(unit as any).parentName && ` • Vínculo: ${(unit as any).parentName}`}
                                  </span>
                                </div>
                              </div>
                              {isChecked && (
                                <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase bg-blue-200 text-blue-900 shrink-0 shadow-xs">
                                  Autorizado
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SEÇÃO 4: OBSERVAÇÕES */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Observações Administrativas
                </label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={e => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Anotações internas sobre as atribuições deste usuário, portaria de nomeação ou restrições..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Botões de Ação Final */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSubTab('list')}
                  className="w-full sm:w-auto px-6 py-3 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Salvando Permissões...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingUserId ? 'Salvar Alterações de Acesso' : 'Cadastrar Usuário'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modal para Alteração de Senha */}
      <ChangePasswordModal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        userId={resetPasswordUser?.id}
        targetName={resetPasswordUser?.name}
        institutionId={institutionId}
      />
    </div>
  );
};

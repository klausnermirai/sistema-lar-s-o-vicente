
import React, { useState } from 'react';
import { 
  Building2, 
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
  LogOut,
  Shield,
  Settings,
  Image as ImageIcon,
  Camera,
  CalendarCheck,
  FileText
} from 'lucide-react';
import { User } from '../types';
import { fetchUsers, saveUser, deleteUser, fetchSettings, saveSettings } from '../lib/api';
import { ChangePasswordModal } from './ChangePasswordModal';

interface SettingsModuleProps {
  institutionId: string;
  onLogout: () => void;
  onSettingsChange?: (settings: any) => void;
  accessLevel?: string;
  currentUserId?: string;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ institutionId, onLogout, onSettingsChange, accessLevel, currentUserId }) => {
  const isAdmin = accessLevel === 'administrador' || accessLevel === 'gerencial';
  const [activeTab, setActiveTab] = React.useState<'instituicao' | 'acesso' | 'perfil' | 'relatorios'>(
    isAdmin ? 'instituicao' : 'perfil'
  );
  const [institution, setInstitution] = React.useState<any>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [resetPasswordUser, setResetPasswordUser] = React.useState<{id: string, name: string} | null>(null);
  const [editUserId, setEditUserId] = React.useState<string | null>(null);
  const [newRole, setNewRole] = React.useState('');

  React.useEffect(() => {
    if (institutionId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [institutionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, settingsData] = await Promise.all([
        fetchUsers(institutionId),
        fetchSettings(institutionId)
      ]);
      setUsers(usersData || []);
      
      // Normalização: Garantir que temos entityType mesmo que no banco esteja como 'type'
      const normalizedSettings = settingsData || {};
      if (normalizedSettings && !normalizedSettings.entityType && normalizedSettings.type) {
        normalizedSettings.entityType = normalizedSettings.type;
      }
      
      setInstitution({
        ...normalizedSettings,
        roles: normalizedSettings.roles || []
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showMessage('Erro ao carregar configurações. Verifique sua conexão.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Form de novo usuário
  const [newUser, setNewUser] = React.useState<Partial<User>>({
    username: '',
    fullName: '',
    role: '',
    accessLevel: 'administrador',
    password: '',
    funcionarioId: ''
  });

  const [employees, setEmployees] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (activeTab === 'acesso') {
      fetch('/api/employees', { headers: { 'Authorization': `Bearer ${currentUserId}` } })
        .then(res => res.json())
        .then(data => setEmployees(data))
        .catch(console.error);
    }
  }, [activeTab, currentUserId]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInstitution((prev: any) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddRole = () => {
    if (!newRole.trim()) return;
    const currentRoles = institution.roles || [];
    if (currentRoles.includes(newRole.trim())) {
      showMessage('Esta função já está cadastrada.', 'error');
      return;
    }
    setInstitution({ ...institution, roles: [...currentRoles, newRole.trim()] });
    setNewRole('');
  };

  const handleRemoveRole = (roleToRemove: string) => {
    const currentRoles = institution.roles || [];
    setInstitution({ ...institution, roles: currentRoles.filter((r: string) => r !== roleToRemove) });
  };

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution.name || !institution.cnpj) {
      showMessage('Nome e CNPJ são obrigatórios.', 'error');
      return;
    }
    
    try {
       const saved = await saveSettings(institutionId, institution);
       setInstitution(saved); // Atualiza com os dados (e possivelmente IDs normalizados) do servidor
       if (onSettingsChange) onSettingsChange(saved);
       showMessage('Configurações da instituição salvas com sucesso!', 'success');
    } catch (error) {
       showMessage('Erro ao salvar configurações.', 'error');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || (!editUserId && !newUser.password)) {
      showMessage('E-mail e senha são obrigatórios.', 'error');
      return;
    }

    if (!editUserId && users.find(u => u.username === newUser.username)) {
      showMessage('Este nome de usuário já existe.', 'error');
      return;
    }

    try {
      const userToAdd = {
        ...(editUserId ? { id: editUserId } : {}),
        username: newUser.username!.trim().toLowerCase(),
        fullName: newUser.fullName || '',
        role: newUser.role || '',
        professionalRegistration: newUser.professionalRegistration || '',
        accessLevel: newUser.accessLevel || 'gerencial',
        ...(newUser.password ? { password: newUser.password } : {}),
        funcionarioId: newUser.funcionarioId || undefined,
        institutionId: institutionId,
        createdAt: editUserId ? undefined : new Date().toISOString()
      };

      const saved = await saveUser(userToAdd);
      
      if (editUserId) {
        setUsers(prev => prev.map(u => u.id === editUserId ? { ...u, ...saved } : u));
        showMessage('Usuário atualizado com sucesso!', 'success');
      } else {
        setUsers(prev => [...prev, saved]);
        showMessage('Usuário cadastrado com sucesso!', 'success');
      }

      setNewUser({ username: '', fullName: '', role: '', professionalRegistration: '', accessLevel: 'administrador', password: '', funcionarioId: '' });
      setEditUserId(null);
      setShowPassword(false);
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      showMessage(error.message || 'Erro ao salvar usuário.', 'error');
    }
  };

  const handleEditUser = (user: User) => {
    setEditUserId(user.id);
    setNewUser({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      professionalRegistration: user.professionalRegistration,
      accessLevel: user.accessLevel,
      password: '', // Don't show password
      funcionarioId: user.funcionarioId || ''
    });
  };

  const handleCancelEdit = () => {
    setEditUserId(null);
    setNewUser({ username: '', fullName: '', role: '', professionalRegistration: '', accessLevel: 'administrador', password: '', funcionarioId: '' });
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja arquivar este acesso?')) return;
    
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showMessage('Usuário removido.', 'success');
    } catch (error) {
      showMessage('Erro ao remover usuário.', 'error');
    }
  };

  const handleResetPassword = (id: string, name: string) => {
    setResetPasswordUser({ id, name });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm no-print">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
             <Settings size={24} />
           </div>
           <div>
             <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Configurações do Sistema</h1>
             <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">Gestão de dados institucionais e permissões de acesso</p>
           </div>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
        >
          <LogOut size={16} /> Sair do Sistema
        </button>
      </div>

      {/* Message feedback */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-xs font-black uppercase tracking-widest">{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('instituicao')}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                activeTab === 'instituicao' ? 'bg-[#004c99] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-gray-50 border'
              }`}
            >
              <Building2 size={16} /> Instituição
            </button>
            <button
              onClick={() => setActiveTab('acesso')}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                activeTab === 'acesso' ? 'bg-[#004c99] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-gray-50 border'
              }`}
            >
              <ShieldCheck size={16} /> Controle de Acesso
            </button>
            <button
              onClick={() => setActiveTab('relatorios')}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                activeTab === 'relatorios' ? 'bg-[#004c99] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-gray-50 border'
              }`}
            >
              <FileText size={16} /> Configuração de Relatórios
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('perfil')}
          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
            activeTab === 'perfil' ? 'bg-[#004c99] text-white shadow-lg' : 'bg-white text-gray-400 hover:bg-gray-50 border'
          }`}
        >
          <UserCircle size={16} /> Meu Perfil
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {loading && (
          <div className="bg-white p-20 rounded-3xl border shadow-sm flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-[#004c99] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Configurações...</p>
          </div>
        )}

        {activeTab === 'perfil' && !loading && (
          <div className="bg-white rounded-3xl border shadow-sm p-10 animate-in slide-in-from-right duration-300">
            <div className="flex flex-col md:flex-row gap-10">
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center text-[#004c99] border-4 border-white shadow-xl">
                  <UserCircle size={64} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                    {users.find(u => u.id === currentUserId)?.fullName || 'Usuário'}
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    @{users.find(u => u.id === currentUserId)?.username || 'user'}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nível de Acesso</label>
                    <p className="text-sm font-black text-[#004c99] uppercase tracking-tight mt-1">
                      {accessLevel === 'administrador' ? 'Administrador' : 
                       accessLevel === 'enfermeira' ? 'Enfermeira' : 
                       accessLevel === 'visitante' ? 'Visitante' : 
                       accessLevel === 'assistente_social' ? 'Assistente Social' :
                       accessLevel === 'psicologia' ? 'Psicologia' : 
                       accessLevel === 'terapeuta_ocupacional' ? 'Terapeuta Ocupacional' : 
                       accessLevel === 'nutricionista' ? 'Nutricionista' : 
                       accessLevel === 'medico' ? 'Médico' :
                       accessLevel === 'cuidados' ? 'Cuidados (Cuidadores)' :
                       accessLevel === 'fisioterapeuta' ? 'Fisioterapeuta' : accessLevel}
                    </p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargo/Função</label>
                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight mt-1">
                      {users.find(u => u.id === currentUserId)?.role || 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-dashed">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Segurança</h4>
                  <button 
                    onClick={() => {
                      const user = users.find(u => u.id === currentUserId);
                      if (user) handleResetPassword(user.id, user.fullName || user.username);
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all"
                  >
                    <Key size={18} /> Alterar Minha Senha
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !institution && activeTab === 'instituicao' && isAdmin && (
          <div className="bg-white p-20 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center">
            <AlertCircle size={48} className="text-red-300 mb-4" />
            <h3 className="text-sm font-black text-gray-800 uppercase">Configurações não encontradas</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">ID: {institutionId || 'N/A'}</p>
          </div>
        )}

        {!loading && activeTab === 'instituicao' && institution && isAdmin && (
          <form onSubmit={handleSaveInstitution} className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in slide-in-from-left duration-300">
            <div className="p-8 border-b bg-gray-50/50">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Dados da Unidade</h3>
            </div>
            <div className="p-8 space-y-6">
              {/* Logo Section */}
              <div className="flex flex-col md:flex-row items-center gap-8 pb-8 border-b border-dashed border-gray-100">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 overflow-hidden relative transition-colors group-hover:bg-gray-100">
                    {institution.logoUrl ? (
                      <img src={institution.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <>
                        <ImageIcon size={32} strokeWidth={1.5} />
                        <span className="text-[9px] font-black uppercase mt-1">Logo</span>
                      </>
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-3xl cursor-pointer transition-opacity">
                    <Camera size={24} />
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                  {institution.logoUrl && (
                    <button 
                      type="button"
                      onClick={() => setInstitution((prev: any) => ({ ...prev, logoUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                      title="Remover Logo"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left">
                   <h4 className="text-sm font-black text-gray-800 uppercase">Logo da Instituição</h4>
                   <p className="text-[10px] font-medium text-gray-400 uppercase mt-1 leading-relaxed">
                     Esta imagem será exibida na barra lateral e na tela de login. <br />
                     Formatos sugeridos: PNG ou SVG com fundo transparente.
                   </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Entidade</label>
                  <select
                    value={institution.entityType}
                    onChange={e => setInstitution({ ...institution, entityType: e.target.value as any })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    <option value="obra_unida">Obra Unida (ILPI)</option>
                    <option value="conferencia">Conferência</option>
                    <option value="particular">Conselho Particular</option>
                    <option value="central">Conselho Central</option>
                    <option value="metropolitano">Conselho Metropolitano</option>
                    <option value="nacional">Conselho Nacional</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Nome *</label>
                  <input
                    type="text"
                    value={institution.name}
                    onChange={e => setInstitution({ ...institution, name: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">CNPJ *</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={institution.cnpj}
                    onChange={e => setInstitution({ ...institution, cnpj: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {institution.entityType === 'obra_unida' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Cidade</label>
                    <input
                      type="text"
                      value={institution.city}
                      onChange={e => setInstitution({ ...institution, city: e.target.value })}
                      className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">E-mail Centralizado para Agenda Institucional</label>
                  <input
                    type="email"
                    placeholder="agenda@instituicao.org.br"
                    value={institution.agendaCentralEmail || ''}
                    onChange={e => setInstitution({ ...institution, agendaCentralEmail: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Este e-mail será utilizado para listar a agenda institucional.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">WhatsApp do Mural</label>
                  <input
                    type="text"
                    placeholder="Ex: 5511999999999"
                    value={institution.muralPhone || ''}
                    onChange={e => setInstitution({ ...institution, muralPhone: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold text-blue-600">Este número será usado para enviar as notificações e exportações do mural.</p>
                </div>

                <div className="md:col-span-2 space-y-4 pt-4 border-t border-dashed">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Linhagem Hierárquica SSVP (IDs)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Conselho Nacional (ID) - Opcional</label>
                      <input
                        type="text"
                        value={institution.nacionalId || ''}
                        onChange={e => setInstitution({ ...institution, nacionalId: e.target.value })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="ID NACIONAL (SE HOUVER)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Conselho Metropolitano (ID) - Opcional</label>
                      <input
                        type="text"
                        value={institution.metropolitanoId || ''}
                        onChange={e => setInstitution({ ...institution, metropolitanoId: e.target.value })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="ID METROPOLITANO (SE HOUVER)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Conselho Central (ID) - Opcional</label>
                      <input
                        type="text"
                        value={institution.centralId || ''}
                        onChange={e => setInstitution({ ...institution, centralId: e.target.value })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="ID CENTRAL (SE HOUVER)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Conselho Particular (ID) - Opcional</label>
                      <input
                        type="text"
                        value={institution.particularId || ''}
                        onChange={e => setInstitution({ ...institution, particularId: e.target.value })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="ID PARTICULAR (SE HOUVER)"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4 pt-4 border-t border-dashed">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capacidade de Acolhimento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Capacidade Masculina</label>
                      <input
                        type="number"
                        value={institution.capacityMale || ''}
                        onChange={e => setInstitution({ ...institution, capacityMale: parseInt(e.target.value) || 0 })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Ex: 20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Capacidade Feminina</label>
                      <input
                        type="number"
                        value={institution.capacityFemale || ''}
                        onChange={e => setInstitution({ ...institution, capacityFemale: parseInt(e.target.value) || 0 })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Ex: 20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Capacidade Geral (Mista)</label>
                      <input
                        type="number"
                        value={institution.capacityGeneral || ''}
                        onChange={e => setInstitution({ ...institution, capacityGeneral: parseInt(e.target.value) || 0 })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Ex: 40"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Quartos Masculinos Disponíveis</label>
                      <input
                        type="number"
                        value={institution.roomsMale || ''}
                        onChange={e => setInstitution({ ...institution, roomsMale: parseInt(e.target.value) || 0 })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Quartos Femininos Disponíveis</label>
                      <input
                        type="number"
                        value={institution.roomsFemale || ''}
                        onChange={e => setInstitution({ ...institution, roomsFemale: parseInt(e.target.value) || 0 })}
                        className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="Ex: 5"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase italic">
                    * O sistema utilizará estas capacidades para calcular as vagas disponíveis no módulo de triagem.
                  </p>
                </div>

                <div className="md:col-span-2 space-y-4 pt-4 border-t border-dashed">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargos e Funções na Instituição</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      placeholder="Nova função (ex: Coordenador)"
                      className="flex-1 p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddRole}
                      className="px-6 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                    >
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(institution.roles || []).map((role: string) => (
                      <div key={role} className="flex items-center gap-2 bg-blue-50 text-[#004c99] px-3 py-2 rounded-lg border border-blue-100 text-[10px] font-black uppercase">
                        {role}
                        <button
                          type="button"
                          onClick={() => handleRemoveRole(role)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {(!institution.roles || institution.roles.length === 0) && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase italic">Nenhuma função cadastrada.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="px-10 py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 flex items-center gap-2 transition-all">
                  <Save size={18} /> Salvar Configurações
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'relatorios' && isAdmin && institution && (
          <form onSubmit={handleSaveInstitution} className="bg-white rounded-3xl border shadow-sm animate-in slide-in-from-right duration-300 overflow-hidden">
            <div className="p-8 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Cabeçalho de Relatórios</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Configure os dados que aparecerão no topo dos PDFs gerados pelo sistema.</p>
              </div>
            </div>

            <div className="p-8 space-y-10">
              {/* Logo do Cabeçalho */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Logotipo para Relatórios</label>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                    {institution.reportConfig?.logoUrl || institution.logoUrl ? (
                      <>
                        <img src={institution.reportConfig?.logoUrl || institution.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <ImageIcon className="text-white" size={24} />
                        </div>
                      </>
                    ) : (
                      <ImageIcon className="text-gray-300" size={32} />
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                           const reader = new FileReader();
                           reader.onloadend = () => {
                             setInstitution((prev: any) => ({
                               ...prev,
                               reportConfig: {
                                 ...prev.reportConfig,
                                 logoUrl: reader.result as string
                               }
                             }));
                           };
                           reader.readAsDataURL(file);
                         }
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-gray-500">Faça upload da logo da sua instituição para os documentos impressos.</p>
                    <p className="text-[10px] text-gray-400">Recomendado: Imagem retangular ou quadrada, fundo transparente (PNG).</p>
                    <button 
                      type="button"
                      onClick={() => {
                        setInstitution((prev: any) => ({
                          ...prev,
                          reportConfig: {
                            ...prev.reportConfig,
                            logoUrl: '' // limpa
                          }
                        }));
                      }}
                      className="text-[10px] font-black text-red-500 uppercase underline"
                    >
                      Remover logo do relatório
                    </button>
                  </div>
                </div>
              </div>

              {/* Informações do Cabeçalho */}
              <div className="space-y-6">
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Informações da Instituição</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nome para o Relatório</label>
                    <input 
                      type="text" 
                      value={institution.reportConfig?.institutionName || ''}
                      onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, institutionName: e.target.value}})}
                      placeholder="Ex: Obra Unida Lar São Vicente de Paulo"
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">Se vazio, usará o nome global da instituição.</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">CNPJ</label>
                    <input 
                      type="text" 
                      value={institution.reportConfig?.cnpj || ''}
                      onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, cnpj: e.target.value}})}
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Endereço Completo</label>
                    <input 
                      type="text" 
                      value={institution.reportConfig?.address || ''}
                      onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, address: e.target.value}})}
                      placeholder="Ex: Rua São Vicente, 100 - Centro"
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Cidade / UF</label>
                    <input 
                      type="text" 
                      value={institution.reportConfig?.cityState || ''}
                      onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, cityState: e.target.value}})}
                      placeholder="Ex: São Paulo - SP"
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Telefone</label>
                    <input 
                      type="text" 
                      value={institution.reportConfig?.phone || ''}
                      onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, phone: e.target.value}})}
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">E-mail</label>
                    <input 
                      type="email" 
                      value={institution.reportConfig?.email || ''}
                      onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, email: e.target.value}})}
                      className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Texto Complementar</label>
                  <input 
                    type="text" 
                    value={institution.reportConfig?.additionalText || ''}
                    onChange={e => setInstitution({...institution, reportConfig: {...institution.reportConfig, additionalText: e.target.value}})}
                    placeholder="Ex: Reconhecida de Utilidade Pública pelo Decreto No. 1234"
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#004c99]/20"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Este texto aparecerá abaixo dos dados principais no cabeçalho do PDF.</p>
                </div>
              </div>

              <div className="pt-8 border-t flex justify-end">
                <button type="submit" className="px-10 py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 flex items-center gap-2 transition-all">
                  <Save size={18} /> Salvar Cabeçalho
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'acesso' && isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right duration-300">
            {/* Lista de Usuários */}
            <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Usuários do Sistema</h3>
                <span className="px-3 py-1 bg-white border rounded-full text-[10px] font-black uppercase text-gray-400">{users.length} usuários</span>
              </div>
              <div className="divide-y divide-gray-50">
                {users.length === 0 && (
                  <div className="p-20 text-center text-gray-400">
                    <Shield size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Nenhum usuário cadastrado além do administrador mestre.</p>
                  </div>
                )}
                {users.map(user => (
                  <div key={user.id} className="p-6 flex items-center justify-between group hover:bg-blue-50/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-[#004c99] group-hover:text-white transition-all">
                        <UserCircle size={24} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-900 uppercase tracking-tight">{user.fullName || user.username}</div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          @{user.username} • {user.role || 'Sem cargo'} • <span className="text-[#004c99]">
                            {user.accessLevel === 'administrador' ? 'Administrador' : 
                             user.accessLevel === 'enfermeira' ? 'Enfermeira' : 
                             user.accessLevel === 'visitante' ? 'Visitante' : 
                             user.accessLevel === 'assistente_social' ? 'Assistente Social' :
                             user.accessLevel === 'psicologia' ? 'Psicologia' : 
                             user.accessLevel === 'terapeuta_ocupacional' ? 'Terapeuta Ocupacional' : 
                             user.accessLevel === 'nutricionista' ? 'Nutricionista' : 
                             user.accessLevel === 'medico' ? 'Médico' :
                             user.accessLevel === 'cuidados' ? 'Cuidados' :
                             user.accessLevel === 'fisioterapeuta' ? 'Fisioterapeuta' : user.accessLevel}
                          </span>
                        </div>
                        {user.funcionarioId && employees.find(e => e.id === user.funcionarioId) && (() => {
                          const emp = employees.find(e => e.id === user.funcionarioId);
                          return (
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-md border border-blue-100">
                              <span className="font-bold">Vínculo RH:</span> 
                              {emp.nomeCompleto} ({emp.funcao})
                              {emp.conselhoProfissional && ` - ${emp.conselhoProfissional} ${emp.numeroRegistro}`}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" 
                        title="Editar"
                      >
                        <Settings size={16} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(user.id, user.fullName || user.username)}
                        className="p-2.5 text-[#004c99] hover:bg-blue-100 rounded-xl transition-colors" 
                        title="Alterar Senha"
                      >
                        <Key size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2.5 text-red-400 hover:bg-red-100 rounded-xl transition-colors" 
                        title="Arquivar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cadastro de Novo */}
            <form onSubmit={handleAddUser} className="bg-white rounded-3xl border shadow-sm flex flex-col h-fit pb-10">
              <div className="p-8 border-b bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#004c99] rounded-lg flex items-center justify-center text-white">
                      {editUserId ? <Settings size={16} /> : <UserPlus size={16} />}
                    </div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">
                      {editUserId ? 'Editar Acesso' : 'Novo Acesso'}
                    </h3>
                  </div>
                  {editUserId && (
                    <button 
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
              <div className="p-8 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">E-mail de Acesso *</label>
                  <input
                    type="email"
                    required
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="exemplo@email.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Nome Completo</label>
                  <input
                    type="text"
                    value={newUser.fullName}
                    onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Função / Cargo</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    <option value="">Selecione uma função...</option>
                    {(institution?.roles || []).map((role: string) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Registro Profissional (CRM/CRESS/Etc)</label>
                  <input
                    type="text"
                    value={newUser.professionalRegistration || ''}
                    onChange={e => setNewUser({ ...newUser, professionalRegistration: e.target.value })}
                    placeholder="Ex: CRM 12345, CRESS 54321..."
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Nível de Acesso *</label>
                  <select
                    value={newUser.accessLevel}
                    onChange={e => setNewUser({ ...newUser, accessLevel: e.target.value as any })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white max-h-48"
                  >
                    <option value="administrador">Administrador (Total)</option>
                    <option value="enfermeira">Enfermeira</option>
                    <option value="visitante">Visitante</option>
                    <option value="assistente_social">Assistente Social</option>
                    <option value="psicologia">Psicologia</option>
                    <option value="terapeuta_ocupacional">Terapeuta Ocupacional</option>
                    <option value="fisioterapeuta">Fisioterapeuta</option>
                    <option value="nutricionista">Nutricionista</option>
                    <option value="medico">Médico</option>
                    <option value="cuidados">Cuidados (Cuidadores)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Vincular Funcionário (RH)</label>
                  <select
                    value={newUser.funcionarioId || ''}
                    onChange={e => setNewUser({ ...newUser, funcionarioId: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    <option value="">(Nenhum vínculo)</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nomeCompleto} - {emp.funcao}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">
                    {editUserId ? 'Senha (deixe em branco para não alterar)' : 'Senha *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editUserId}
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                 <div className="pt-2">
                    <button type="submit" className="w-full py-4 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-black flex items-center justify-center gap-2 transition-all">
                      <Save size={18} /> {editUserId ? 'Salvar Alterações' : 'Cadastrar Acesso'}
                    </button>
                 </div>
                <p className="text-[9px] text-gray-400 font-bold uppercase text-center leading-relaxed">
                  Atenção: Senhas são armazenadas localmente para fins de protótipo.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>

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

export default SettingsModule;

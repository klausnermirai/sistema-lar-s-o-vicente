
import React from 'react';
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
  Camera
} from 'lucide-react';
import { User } from '../types';
import { fetchUsers, saveUser, deleteUser, fetchSettings, saveSettings } from '../lib/api';

interface SettingsModuleProps {
  institutionId: string;
  onLogout: () => void;
  onSettingsChange?: (settings: any) => void;
}

const SettingsModule: React.FC<SettingsModuleProps> = ({ institutionId, onLogout, onSettingsChange }) => {
  const [activeTab, setActiveTab] = React.useState<'instituicao' | 'acesso'>('instituicao');
  const [institution, setInstitution] = React.useState<any>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

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
      if (settingsData && !settingsData.entityType && settingsData.type) {
        settingsData.entityType = settingsData.type;
      }
      
      setInstitution(settingsData);
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
    password: ''
  });

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
    if (!newUser.username || !newUser.password) {
      showMessage('Username e senha são obrigatórios.', 'error');
      return;
    }

    if (users.find(u => u.username === newUser.username)) {
      showMessage('Este nome de usuário já existe.', 'error');
      return;
    }

    try {
      const userToAdd = {
        username: newUser.username!.trim().toLowerCase(),
        fullName: newUser.fullName || '',
        role: newUser.role || '',
        accessLevel: newUser.accessLevel || 'gerencial',
        password: newUser.password,
        institutionId: institutionId,
        createdAt: new Date().toISOString()
      };

      console.log('Tentando salvar usuário:', userToAdd);
      const saved = await saveUser(userToAdd);
      setUsers(prev => [...prev, saved]);
      setNewUser({ username: '', fullName: '', role: '', accessLevel: 'administrador', password: '' });
      setShowPassword(false);
      showMessage('Usuário cadastrado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      showMessage(error.message || 'Erro ao cadastrar usuário.', 'error');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este acesso?')) return;
    
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      showMessage('Usuário removido.', 'success');
    } catch (error) {
      showMessage('Erro ao remover usuário.', 'error');
    }
  };

  const handleResetPassword = async (id: string) => {
    const newPass = prompt('Informe a nova senha:');
    if (newPass) {
      try {
        const user = users.find(u => u.id === id);
        if (user) {
          await saveUser({ ...user, password: newPass });
          setUsers(prev => prev.map(u => u.id === id ? { ...u, password: newPass } : u));
          showMessage('Senha alterada com sucesso!', 'success');
        }
      } catch (error) {
        showMessage('Erro ao alterar senha.', 'error');
      }
    }
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
      </div>

      <div className="grid grid-cols-1 gap-8">
        {loading && (
          <div className="bg-white p-20 rounded-3xl border shadow-sm flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-[#004c99] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Configurações...</p>
          </div>
        )}

        {!loading && !institution && activeTab === 'instituicao' && (
          <div className="bg-white p-20 rounded-3xl border shadow-sm flex flex-col items-center justify-center text-center">
            <AlertCircle size={48} className="text-red-300 mb-4" />
            <h3 className="text-sm font-black text-gray-800 uppercase">Configurações não encontradas</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">ID: {institutionId || 'N/A'}</p>
          </div>
        )}

        {!loading && activeTab === 'instituicao' && institution && (
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
              </div>
              <div className="pt-4">
                <button type="submit" className="px-10 py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 flex items-center gap-2 transition-all">
                  <Save size={18} /> Salvar Configurações
                </button>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'acesso' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right duration-300">
            {/* Lista de Usuários */}
            <div className="lg:col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Usuários do Sistema</h3>
                <span className="px-3 py-1 bg-white border rounded-full text-[10px] font-black uppercase text-gray-400">{users.length} usuários</span>
              </div>
              <div className="divide-y divide-gray-50 overflow-y-auto max-h-[600px] no-scrollbar">
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
                          @{user.username} • {user.role || 'Sem cargo'} • <span className="text-[#004c99]">{user.accessLevel}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleResetPassword(user.id)}
                        className="p-2.5 text-[#004c99] hover:bg-blue-100 rounded-xl transition-colors" 
                        title="Alterar Senha"
                      >
                        <Key size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2.5 text-red-400 hover:bg-red-100 rounded-xl transition-colors" 
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cadastro de Novo */}
            <form onSubmit={handleAddUser} className="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="p-8 border-b bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#004c99] rounded-lg flex items-center justify-center text-white"><UserPlus size={16} /></div>
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Novo Acesso</h3>
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
                  <input
                    type="text"
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Nível de Acesso *</label>
                  <select
                    value={newUser.accessLevel}
                    onChange={e => setNewUser({ ...newUser, accessLevel: e.target.value as any })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    <option value="administrador">Administrador (Total)</option>
                    <option value="gerencial">Gerencial</option>
                    <option value="operacional">Operacional</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Senha *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
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
                     <Save size={18} /> Cadastrar Acesso
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
    </div>
  );
};

export default SettingsModule;

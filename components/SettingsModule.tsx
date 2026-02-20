
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
  EyeOff
} from 'lucide-react';
import { InstitutionSettings, loadInstitutionSettings, saveInstitutionSettings } from '../lib/settingsStore';
import { User, loadUsers, saveUsers } from '../lib/usersStore';

const SettingsModule: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'instituicao' | 'acesso'>('instituicao');
  const [institution, setInstitution] = React.useState<InstitutionSettings>(loadInstitutionSettings());
  const [users, setUsers] = React.useState<User[]>(loadUsers());
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  // Form de novo usuário
  const [newUser, setNewUser] = React.useState<Partial<User>>({
    username: '',
    fullName: '',
    role: '',
    accessLevel: 'gerencial',
    password: ''
  });

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveInstitution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution.name || !institution.cnpj) {
      showMessage('Nome e CNPJ são obrigatórios.', 'error');
      return;
    }
    saveInstitutionSettings(institution);
    showMessage('Configurações da instituição salvas com sucesso!', 'success');
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      showMessage('Username e senha são obrigatórios.', 'error');
      return;
    }

    if (users.find(u => u.username === newUser.username)) {
      showMessage('Este nome de usuário já existe.', 'error');
      return;
    }

    const userToAdd: User = {
      id: Date.now().toString(),
      username: newUser.username!,
      fullName: newUser.fullName || '',
      role: newUser.role || '',
      accessLevel: 'gerencial',
      password: newUser.password
    };

    const updatedUsers = [...users, userToAdd];
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    setNewUser({ username: '', fullName: '', role: '', accessLevel: 'gerencial', password: '' });
    setShowPassword(false);
    showMessage('Usuário cadastrado com sucesso!', 'success');
  };

  const handleDeleteUser = (id: string) => {
    if (id === 'admin') {
      showMessage('O usuário admin padrão não pode ser excluído.', 'error');
      return;
    }
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    showMessage('Usuário removido.', 'success');
  };

  const handleResetPassword = (id: string) => {
    const newPass = prompt('Informe a nova senha:');
    if (newPass) {
      const updatedUsers = users.map(u => u.id === id ? { ...u, password: newPass } : u);
      setUsers(updatedUsers);
      saveUsers(updatedUsers);
      showMessage('Senha alterada com sucesso!', 'success');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Configurações do Sistema</h1>
          <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">Gestão de dados institucionais e permissões de acesso</p>
        </div>
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
        {activeTab === 'instituicao' && (
          <form onSubmit={handleSaveInstitution} className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in slide-in-from-left duration-300">
            <div className="p-8 border-b bg-gray-50/50">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Dados da Unidade</h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Entidade</label>
                  <select
                    value={institution.entityType}
                    onChange={e => setInstitution({ ...institution, entityType: e.target.value as any })}
                    className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                  >
                    <option value="obra_unida">Obra Unida (ILPI)</option>
                    <option value="conselho">Conselho</option>
                  </select>
                </div>
                {institution.entityType === 'conselho' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Tipo do Conselho</label>
                    <select
                      value={institution.councilType}
                      onChange={e => setInstitution({ ...institution, councilType: e.target.value as any })}
                      className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                    >
                      <option value="nacional">Conselho Nacional</option>
                      <option value="metropolitano">Conselho Metropolitano</option>
                      <option value="central">Conselho Central</option>
                    </select>
                  </div>
                )}
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
                {institution.entityType === 'obra_unida' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Conselho Central Vinculado</label>
                      <input
                        type="text"
                        value={institution.centralCouncil}
                        onChange={e => setInstitution({ ...institution, centralCouncil: e.target.value })}
                        className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase">Conselho Metropolitano Vinculado</label>
                      <input
                        type="text"
                        value={institution.metropolitanCouncil}
                        onChange={e => setInstitution({ ...institution, metropolitanCouncil: e.target.value })}
                        className="w-full p-4 border rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </>
                )}
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
                {users.map(user => (
                  <div key={user.id} className="p-6 flex items-center justify-between group hover:bg-blue-50/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-[#004c99] group-hover:text-white transition-all">
                        <UserCircle size={24} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-gray-900 uppercase tracking-tight">{user.fullName || user.username}</div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          @{user.username} • {user.role || 'Sem cargo'}
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
                  <label className="text-[10px] font-black text-gray-400 uppercase">Login / Username *</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    className="w-full p-4 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
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

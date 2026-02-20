
import React from 'react';
import { 
  Lock, 
  User as UserIcon, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Building2, 
  AlertCircle 
} from 'lucide-react';
import { loadUsers } from '../lib/usersStore';
import { loadInstitutionSettings } from '../lib/settingsStore';

interface LoginScreenProps {
  onLoginSuccess: (session: { cnpj: string; username: string; accessLevel: string }) => void;
  onDevSetup?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onDevSetup }) => {
  const [cnpj, setCnpj] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Dev Modal State
  const [isDevModalOpen, setIsDevModalOpen] = React.useState(false);
  const [devUsername, setDevUsername] = React.useState('');
  const [devPassword, setDevPassword] = React.useState('');
  const [showDevPassword, setShowDevPassword] = React.useState(false);
  const [devError, setDevError] = React.useState<string | null>(null);

  // TODO: Mover credenciais para variáveis de ambiente (import.meta.env) futuramente
  const DEV_CREDENTIALS = {
    username: 'Klausner',
    password: '21Ihsoyk'
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Informe usuário e senha.');
      return;
    }

    const users = loadUsers();
    const settings = loadInstitutionSettings();
    
    // Validação de CNPJ (Exceção para admin com campo em branco)
    const isSpecialAdmin = username === 'admin' && cnpj === '';
    const cnpjMatches = cnpj === settings.cnpj;

    if (!isSpecialAdmin && !cnpjMatches) {
      setError('CNPJ da instituição incorreto.');
      return;
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      const session = { 
        cnpj: cnpj || 'ADMIN_BYPASS', 
        username: user.username, 
        accessLevel: user.accessLevel 
      };
      localStorage.setItem('ssvp_session', JSON.stringify(session));
      onLoginSuccess(session);
    } else {
      setError('Usuário ou senha inválidos.');
    }
  };

  const handleDevAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setDevError(null);

    if (devUsername === DEV_CREDENTIALS.username && devPassword === DEV_CREDENTIALS.password) {
      setIsDevModalOpen(false);
      if (onDevSetup) onDevSetup();
    } else {
      setDevError('Credenciais de desenvolvedor incorretas.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#004c99] flex items-center justify-center p-6 z-[100]">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-600 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-500">
        <div className="p-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-[#004c99] rounded-[24px] flex items-center justify-center text-white mb-6 shadow-xl transform -rotate-3">
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" fill="#004c99" />
              <path d="M25 50C25 50 40 30 50 30C60 30 75 50 75 50C75 50 60 70 50 70C40 70 25 50 25 50Z" stroke="white" strokeWidth="5" />
              <circle cx="35" cy="50" r="3" fill="#e31b23" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-tight">Acesso ao Sistema</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Lar São Vicente de Paulo • SSVP</p>
        </div>

        <form onSubmit={handleLogin} className="px-10 pb-12 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-shake">
              <AlertCircle size={18} className="shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">CNPJ da Instituição</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input 
                type="text"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Usuário</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input 
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="NOME DE USUÁRIO"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <button 
              type="submit" 
              className="w-full py-5 bg-[#004c99] text-white rounded-[24px] text-[12px] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3 transform active:scale-95"
            >
              <ShieldCheck size={20} /> Entrar no Sistema
            </button>

            <button 
              type="button"
              onClick={() => setIsDevModalOpen(true)}
              className="w-full py-3 text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-[#004c99] transition-colors"
            >
              Dev Setup
            </button>
          </div>

          <div className="text-center">
            <p className="text-[9px] font-bold text-gray-300 uppercase leading-relaxed px-10">
              Uso restrito para funcionários autorizados do Lar São Vicente de Paulo.
            </p>
          </div>
        </form>
      </div>

      {/* Dev Authentication Modal */}
      {isDevModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in duration-300">
            <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Acesso Desenvolvedor</h3>
              <button onClick={() => setIsDevModalOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <AlertCircle size={20} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleDevAuth} className="p-8 space-y-4">
              {devError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[9px] font-black uppercase tracking-widest">
                  {devError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Usuário Dev</label>
                <input 
                  type="text"
                  required
                  value={devUsername}
                  onChange={e => setDevUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Senha Dev</label>
                <div className="relative">
                  <input 
                    type={showDevPassword ? "text" : "password"}
                    required
                    value={devPassword}
                    onChange={e => setDevPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowDevPassword(!showDevPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    {showDevPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg"
              >
                Validar e Acessar Setup
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;

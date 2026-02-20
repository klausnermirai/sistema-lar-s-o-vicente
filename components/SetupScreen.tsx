
import React from 'react';
import { 
  Building2, 
  UserPlus, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Globe
} from 'lucide-react';
import { InstitutionSettings, saveInstitutionSettings } from '../lib/settingsStore';
import { User, saveUsers } from '../lib/usersStore';

interface SetupScreenProps {
  onSetupComplete: (session: { cnpj: string; username: string; accessLevel: string }) => void;
  onBackToLogin?: () => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onSetupComplete, onBackToLogin }) => {
  const [step, setStep] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Estado do formulário
  const [institution, setInstitution] = React.useState<InstitutionSettings>({
    entityType: 'obra_unida',
    name: '',
    cnpj: '',
    city: '',
    centralCouncil: '',
    metropolitanCouncil: ''
  });

  const [admin, setAdmin] = React.useState({
    username: 'admin',
    fullName: '',
    role: 'Gestor(a)',
    password: '',
    confirmPassword: ''
  });

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution.name || !institution.cnpj) {
      setError('Nome e CNPJ são obrigatórios.');
      return;
    }
    if (institution.entityType === 'obra_unida' && !institution.city) {
      setError('Cidade é obrigatória para Obras Unidas.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleFinalize = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!admin.username || !admin.password) {
      setError('Usuário e senha são obrigatórios.');
      return;
    }

    if (admin.password !== admin.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    // 1. Salvar Instituição
    saveInstitutionSettings(institution);

    // 2. Criar e Salvar Usuário Admin
    const userToAdd: User = {
      id: 'admin',
      username: admin.username.toLowerCase(),
      fullName: admin.fullName,
      role: admin.role,
      accessLevel: 'gerencial',
      password: admin.password
    };
    saveUsers([userToAdd]);

    // 3. Criar Sessão e Finalizar
    const session = { 
      cnpj: institution.cnpj, 
      username: userToAdd.username, 
      accessLevel: 'gerencial' 
    };
    localStorage.setItem('ssvp_session', JSON.stringify(session));
    onSetupComplete(session);
  };

  return (
    <div className="fixed inset-0 bg-[#004c99] flex items-center justify-center p-6 z-[200]">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-white rounded-full blur-3xl"></div>
        <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-red-600 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col md:flex-row h-full">
          {/* Sidebar de Progresso */}
          <div className="bg-gray-50 md:w-64 p-10 flex flex-col justify-between border-r border-gray-100">
            <div className="space-y-8">
              <div className="w-12 h-12 bg-[#004c99] rounded-2xl flex items-center justify-center text-white shadow-lg">
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="45" fill="#004c99" />
                  <path d="M25 50C25 50 40 30 50 30C60 30 75 50 75 50C75 50 60 70 50 70C40 70 25 50 25 50Z" stroke="white" strokeWidth="5" />
                </svg>
              </div>
              
              <div className="space-y-6">
                <div className={`flex items-center gap-3 ${step === 1 ? 'text-[#004c99]' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${step === 1 ? 'border-[#004c99] bg-[#004c99] text-white' : 'border-gray-200'}`}>1</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Instituição</span>
                </div>
                <div className={`flex items-center gap-3 ${step === 2 ? 'text-[#004c99]' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${step === 2 ? 'border-[#004c99] bg-[#004c99] text-white' : 'border-gray-200'}`}>2</div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Administrador</span>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              {onBackToLogin && (
                <button 
                  onClick={onBackToLogin}
                  className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-[#004c99] transition-colors mb-6"
                >
                  <ArrowLeft size={14} /> Voltar para Login
                </button>
              )}
              <p className="text-[9px] font-bold text-gray-300 uppercase leading-relaxed">
                Bem-vindo ao SSVP GESTÃO. Vamos configurar seu ambiente de trabalho.
              </p>
            </div>
          </div>

          {/* Área do Formulário */}
          <div className="flex-1 p-10 md:p-14">
            {step === 1 ? (
              <form onSubmit={handleNextStep} className="space-y-8 animate-in slide-in-from-right duration-300">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Primeiro Acesso</h2>
                  <p className="text-[11px] font-bold text-gray-400 uppercase mt-2 tracking-widest">Configuração da Unidade</p>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                  </div>
                )}

                <div className="space-y-5">
                  <div className="flex p-1 bg-gray-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setInstitution({ ...institution, entityType: 'obra_unida' })}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        institution.entityType === 'obra_unida' ? 'bg-white text-[#004c99] shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      Obra Unida (ILPI)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstitution({ ...institution, entityType: 'conselho' })}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        institution.entityType === 'conselho' ? 'bg-white text-[#004c99] shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      Conselho
                    </button>
                  </div>

                  {institution.entityType === 'conselho' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tipo do Conselho *</label>
                      <select
                        value={institution.councilType}
                        onChange={e => setInstitution({ ...institution, councilType: e.target.value as any })}
                        className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        <option value="nacional">Conselho Nacional</option>
                        <option value="metropolitano">Conselho Metropolitano</option>
                        <option value="central">Conselho Central</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                      {institution.entityType === 'obra_unida' ? 'Nome da Instituição *' : 'Nome do Conselho *'}
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input 
                        type="text"
                        required
                        value={institution.name}
                        onChange={e => setInstitution({ ...institution, name: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        placeholder="EX: LAR SÃO VICENTE DE PAULO"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">CNPJ *</label>
                      <input 
                        type="text"
                        required
                        placeholder="00.000.000/0000-00"
                        value={institution.cnpj}
                        onChange={e => setInstitution({ ...institution, cnpj: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    {institution.entityType === 'obra_unida' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Cidade *</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                          <input 
                            type="text"
                            required
                            value={institution.city}
                            onChange={e => setInstitution({ ...institution, city: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder="CIDADE"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {institution.entityType === 'obra_unida' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Conselho Central</label>
                        <input 
                          type="text"
                          value={institution.centralCouncil}
                          onChange={e => setInstitution({ ...institution, centralCouncil: e.target.value })}
                          className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Conselho Metrop.</label>
                        <input 
                          type="text"
                          value={institution.metropolitanCouncil}
                          onChange={e => setInstitution({ ...institution, metropolitanCouncil: e.target.value })}
                          className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-[#004c99] text-white rounded-[24px] text-[12px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3"
                >
                  Próxima Etapa <ChevronRight size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleFinalize} className="space-y-8 animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setStep(1)} className="p-2 text-gray-300 hover:text-gray-900 transition-colors">
                    <ArrowLeft size={24} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-tight">Criar Administrador</h2>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mt-1 tracking-widest">Responsável pela Gestão</p>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Usuário (Login) *</label>
                      <input 
                        type="text"
                        required
                        value={admin.username}
                        onChange={e => setAdmin({ ...admin, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                        className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Função</label>
                      <input 
                        type="text"
                        value={admin.role}
                        onChange={e => setAdmin({ ...admin, role: e.target.value })}
                        className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome Completo</label>
                    <input 
                      type="text"
                      value={admin.fullName}
                      onChange={e => setAdmin({ ...admin, fullName: e.target.value })}
                      className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Senha Mestra *</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        value={admin.password}
                        onChange={e => setAdmin({ ...admin, password: e.target.value })}
                        className="w-full px-5 py-4 pr-12 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
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

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Confirmar Senha *</label>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={admin.confirmPassword}
                        onChange={e => setAdmin({ ...admin, confirmPassword: e.target.value })}
                        className="w-full px-5 py-4 pr-12 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-gray-900 text-white rounded-[24px] text-[12px] font-black uppercase tracking-widest shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={18} /> Finalizar e Entrar
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;

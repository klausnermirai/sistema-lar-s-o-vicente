import React from 'react';
import { 
  Lock, 
  User as UserIcon, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Building2, 
  AlertCircle,
  Check,
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Landmark,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import { login, forgotPassword, verifyResetToken, resetPassword } from '../lib/api';
import { sanitizeCanonicalUnits } from '../lib/canonical_units';

export interface AuthorizedUnit {
  id: string;
  name: string;
  cnpj: string;
  type: string;
  city?: string;
  state?: string;
}

interface LoginScreenProps {
  onLoginSuccess: (session: { 
    cnpj: string; 
    username: string; 
    accessLevel: string; 
    institutionId?: string; 
    availableUnits?: AuthorizedUnit[];
    [key: string]: any;
  }) => void;
  onDevSetup?: () => void;
  logoUrl?: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onDevSetup, logoUrl }) => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Multi-unit selection state
  const [availableUnits, setAvailableUnits] = React.useState<AuthorizedUnit[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = React.useState<any>(null);
  const [showUnitSelector, setShowUnitSelector] = React.useState(false);

  // Modal State: Esqueci minha senha
  const [isForgotModalOpen, setIsForgotModalOpen] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [forgotMessage, setForgotMessage] = React.useState<string | null>(null);
  const [forgotError, setForgotError] = React.useState<string | null>(null);
  const [generatedResetLink, setGeneratedResetLink] = React.useState<string | null>(null);

  // Modal State: Redefinir Senha
  const [resetToken, setResetToken] = React.useState<string | null>(null);
  const [resetUserEmail, setResetUserEmail] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const [resetSuccess, setResetSuccess] = React.useState<string | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);

  // Dev Modal State
  const [isDevModalOpen, setIsDevModalOpen] = React.useState(false);
  const [devUsername, setDevUsername] = React.useState('');
  const [devPassword, setDevPassword] = React.useState('');
  const [showDevPassword, setShowDevPassword] = React.useState(false);
  const [devError, setDevError] = React.useState<string | null>(null);

  const DEV_CREDENTIALS = {
    username: 'Klausner',
    password: '21Ihsoyk'
  };

  React.useEffect(() => {
    // A tela de login sempre inicia visualmente limpa.
    setUsername('');
    setPassword('');
    setShowPassword(false);

    // Checar se há aviso de sessão expirada/renovação necessária
    const notice = sessionStorage.getItem('ssvp_auth_notice');
    if (notice) {
      setError(notice);
      sessionStorage.removeItem('ssvp_auth_notice');
    }

    // Checar se há token de redefinição na URL
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('resetToken') || params.get('token');
    if (tokenParam) {
      setResetToken(tokenParam);
      setResetLoading(true);
      verifyResetToken(tokenParam)
        .then((res) => {
          if (res.valid) {
            setResetUserEmail(res.email);
          }
        })
        .catch((err) => {
          setResetError(err.message || 'Token de redefinição inválido ou expirado.');
        })
        .finally(() => {
          setResetLoading(false);
        });
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent, selectedUnitId?: string) => {
    if (e) e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Informe seu e-mail e senha para acessar.');
      return;
    }

    try {
      setLoading(true);
      const data = await login({ 
        username: username.trim(), 
        password: password.trim(),
        institutionId: selectedUnitId 
      });

      if (data.success) {
        // Se requer seleção de unidade e ainda não foi escolhida
        if (data.requireUnitSelection && Array.isArray(data.availableUnits)) {
          const sanitized = sanitizeCanonicalUnits(data.availableUnits);
          if (sanitized.length > 1) {
            setAvailableUnits(sanitized);
            setAuthenticatedUser(data.user);
            setShowUnitSelector(true);
            return;
          }
        }

        // Login direto ou após escolher a unidade
        const session = { 
          id: data.user.id,
          token: data.token,
          cnpj: data.cnpj, 
          username: data.user.username, 
          fullName: data.user.fullName,
          role: data.user.role,
          professionalRegistration: data.user.professionalRegistration,
          accessLevel: data.user.accessLevel,
          mustChangePassword: data.user.mustChangePassword ?? false,
          isFirstLogin: data.user.isFirstLogin ?? false,
          membroId: data.user.membroId,
          conferenciaId: data.conferenciaId || data.user.conferenciaId,
          conferenciaNome: data.conferenciaNome,
          particularId: data.particularId || data.user.particularId,
          particularNome: data.particularNome,
          boardRoleInfo: data.boardRoleInfo || null,
          institutionId: data.institutionId,
          hierarchy: data.hierarchy,
          signature: data.user.signature,
          availableUnits: data.availableUnits ? sanitizeCanonicalUnits(data.availableUnits) : availableUnits
        };
        localStorage.setItem('ssvp_session', JSON.stringify(session));
        onLoginSuccess(session);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUnit = (unit: AuthorizedUnit) => {
    handleLogin(undefined, unit.id || unit.cnpj);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMessage(null);
    setGeneratedResetLink(null);

    if (!forgotEmail) {
      setForgotError('Informe o seu e-mail cadastrado.');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await forgotPassword({ email: forgotEmail });
      setForgotMessage(res.message);
      if (res.resetLink) {
        setGeneratedResetLink(res.resetLink);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Erro ao solicitar redefinição.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setResetError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('A confirmação da senha não coincide com a nova senha.');
      return;
    }

    try {
      setResetLoading(true);
      const res = await resetPassword({ token: resetToken!, newPassword });
      setResetSuccess(res.message || 'Senha redefinida com sucesso!');
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        setResetToken(null);
        setNewPassword('');
        setConfirmPassword('');
        setUsername('');
        setPassword('');
        setShowPassword(false);
        setIsForgotModalOpen(false);
      }, 2000);
    } catch (err: any) {
      setResetError(err.message || 'Erro ao redefinir a senha.');
    } finally {
      setResetLoading(false);
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
    <div className="fixed inset-0 bg-[#004c99] z-[100] overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        {/* Background Decor */}
        <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-600 rounded-full blur-3xl"></div>
        </div>

        {/* TELA DE SELEÇÃO DE UNIDADE PARA MULTIACESSO */}
        {showUnitSelector ? (
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-300 my-auto shrink-0 border border-gray-100">
            <div className="p-8 sm:p-10 text-center border-b border-gray-50 bg-gradient-to-b from-blue-50/50 to-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100/70 text-[#004c99] rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                <Sparkles size={13} />
                <span>Multiacesso Autorizado</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Selecione a Unidade</h1>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Olá, <span className="font-bold text-gray-800">{authenticatedUser?.fullName || authenticatedUser?.username}</span>. Escolha em qual entidade deseja operar agora:
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-4 max-h-[60vh] overflow-y-auto">
              {availableUnits.map((unit) => {
                const isCentral = unit.type === 'conselho_central' || unit.cnpj === '54.927.132/0001-92';
                const isCP = unit.type === 'conselho_particular';
                const isConf = unit.type === 'conferencia';

                return (
                  <button
                    key={unit.id || unit.cnpj}
                    type="button"
                    onClick={() => handleSelectUnit(unit)}
                    disabled={loading}
                    className="w-full text-left p-5 rounded-3xl border-2 border-gray-100 hover:border-[#004c99] hover:bg-blue-50/40 hover:shadow-xl transition-all group flex items-center justify-between gap-4 cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                        isCentral 
                          ? 'bg-gradient-to-br from-purple-700 to-indigo-900 text-white' 
                          : isCP
                          ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                          : isConf
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-800 text-white'
                          : 'bg-gradient-to-br from-emerald-600 to-teal-800 text-white'
                      }`}>
                        {isCentral ? <Landmark size={26} /> : isCP ? <Landmark size={24} /> : isConf ? <Users size={24} /> : <Building2 size={26} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md ${
                            isCentral 
                              ? 'bg-purple-100 text-purple-800' 
                              : isCP
                              ? 'bg-amber-100 text-amber-800'
                              : isConf
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isCentral ? 'Conselho Central' : isCP ? 'Conselho Particular' : isConf ? 'Conferência' : 'Obra Unida / Lar'}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-gray-900 mt-1 group-hover:text-[#004c99] transition-colors leading-snug truncate">
                          {unit.name}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
                          {unit.cnpj && <span>CNPJ: {unit.cnpj}</span>}
                          {unit.city && <span>• {unit.city}/{unit.state || 'SP'}</span>}
                          {(unit as any).parentName && <span>• {(unit as any).parentName}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gray-50 group-hover:bg-[#004c99] group-hover:text-white text-gray-400 flex items-center justify-center transition-all shrink-0">
                      <ChevronRight size={20} />
                    </div>
                  </button>
                );
              })}

              <div className="pt-4 flex items-center justify-between border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowUnitSelector(false)}
                  className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-gray-700 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} /> Trocar de Conta
                </button>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">SSVP • Gestão Integrada</span>
              </div>
            </div>
          </div>
        ) : (
          /* TELA DE LOGIN PRINCIPAL (USUÁRIO E SENHA) */
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-500 my-auto shrink-0">
            <div className="p-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white border-4 border-gray-50 rounded-[24px] flex items-center justify-center text-white mb-6 shadow-xl transform -rotate-3 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <div className="bg-[#004c99] w-full h-full flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="50" cy="50" r="45" fill="#004c99" />
                      <path d="M25 50C25 50 40 30 50 30C60 30 75 50 75 50C75 50 60 70 50 70C40 70 25 50 25 50Z" stroke="white" strokeWidth="5" />
                      <circle cx="35" cy="50" r="3" fill="#e31b23" />
                    </svg>
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-tight">Acesso ao Sistema</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Sociedade de São Vicente de Paulo • SSVP</p>
              <p className="text-[10px] font-semibold text-gray-400 mt-2">Sistema de Gestão da SSVP - Caridade Organizada</p>
            </div>

            <form onSubmit={e => handleLogin(e)} autoComplete="off" className="px-10 pb-12 space-y-5">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-shake">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">E-mail ou Usuário</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="seu@email.com"
                    name="ssvp-login-user"
                    autoComplete="off"
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
                    name="ssvp-login-password"
                    autoComplete="new-password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button 
                    type="button"
                    onClick={() => {
                      setForgotEmail(username);
                      setForgotError(null);
                      setForgotMessage(null);
                      setGeneratedResetLink(null);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[10px] font-black text-[#004c99] hover:underline uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-5 bg-[#004c99] text-white rounded-[24px] text-[12px] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-800 transition-all flex items-center justify-center gap-3 transform active:scale-95 disabled:opacity-70 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={20} /> Entrar no Sistema
                    </>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => setIsDevModalOpen(true)}
                  className="w-full py-3 text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-[#004c99] transition-colors cursor-pointer"
                >
                  Dev Setup
                </button>
              </div>

              <div className="text-center">
                <p className="text-[9px] font-bold text-gray-300 uppercase leading-relaxed px-6">
                  Acesso integrado para Lar São Vicente de Paulo de Monte Alto e Conselho Central de Jaboticabal.
                </p>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modal: Esqueci Minha Senha */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in duration-300">
            <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-[#004c99] rounded-2xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Recuperação de Senha</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Solicitação de Link Temporário</p>
                </div>
              </div>
              <button 
                onClick={() => setIsForgotModalOpen(false)} 
                className="text-gray-400 hover:text-gray-900 transition-colors p-2 cursor-pointer"
              >
                <AlertCircle size={20} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="p-8 space-y-4">
              {forgotError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-black uppercase tracking-widest">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotMessage && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl space-y-2 text-green-700">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle2 size={18} className="shrink-0 text-green-600" />
                    <span>Link Solicitado com Sucesso</span>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed">{forgotMessage}</p>
                </div>
              )}

              {generatedResetLink && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-3 text-blue-900">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Acesso Direto ao Link de Redefinição:</p>
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(generatedResetLink.split('?')[1]);
                      const tok = params.get('resetToken');
                      if (tok) {
                        setResetToken(tok);
                        verifyResetToken(tok).then(res => {
                          if (res.valid) setResetUserEmail(res.email);
                        });
                        setIsForgotModalOpen(false);
                      }
                    }}
                    className="w-full py-3 bg-[#004c99] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <KeyRound size={16} /> Redefinir Senha Agora
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">E-mail Cadastrado</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value.toLowerCase())}
                    className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {forgotLoading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Mail size={18} /> Gerar Link de Redefinição
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redefinição Direta de Senha via Link */}
      {resetToken && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[250] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in duration-300">
            <div className="p-8 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-50 text-green-600 rounded-2xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Nova Senha de Acesso</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{resetUserEmail || 'Definição de Nova Credencial'}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-8 space-y-4">
              {resetError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-black uppercase tracking-widest">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700 text-[10px] font-black uppercase tracking-widest">
                  <CheckCircle2 size={18} className="shrink-0 text-green-600" />
                  <span>{resetSuccess} Redirecionando...</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Confirme a Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Repita a nova senha"
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

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {resetLoading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Check size={18} /> Salvar Nova Senha
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dev Setup Modal */}
      {isDevModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative animate-in zoom-in duration-300">
            <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-[#004c99] rounded-2xl">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Acesso Restrito</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Configurações Avançadas</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDevModalOpen(false)} 
                className="text-gray-400 hover:text-gray-900 transition-colors p-2"
              >
                <AlertCircle size={20} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleDevAuth} className="p-8 space-y-4">
              {devError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-black uppercase tracking-widest">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{devError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Usuário Master</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type="text"
                    required
                    value={devUsername}
                    onChange={e => setDevUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Usuário Desenvolvedor"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Chave de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input 
                    type={showDevPassword ? "text" : "password"}
                    required
                    value={devPassword}
                    onChange={e => setDevPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowDevPassword(!showDevPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    {showDevPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-4 bg-[#004c99] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <ShieldCheck size={18} /> Autenticar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;

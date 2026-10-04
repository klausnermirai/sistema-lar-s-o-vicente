import React, { useState } from 'react';
import { Key, Save, AlertCircle, X, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { saveUser, fetchUsers } from '../lib/api';
import { User } from '../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  institutionId?: string;
  targetName?: string;
  isForced?: boolean;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ 
  isOpen, 
  onClose, 
  userId, 
  institutionId, 
  targetName,
  isForced = false,
  onSuccess
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (isForced && newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsSaving(true);
    try {
      if (!userId) {
        throw new Error('Sessão inválida para alteração de senha.');
      }
      
      const users: User[] = await fetchUsers(institutionId, true);
      const user = users.find(u => u.id === userId);
      
      if (!user) {
         throw new Error('Usuário não encontrado no sistema.');
      }

      await saveUser({ 
        ...user, 
        password: newPassword,
        mustChangePassword: false,
        isFirstLogin: false
      });

      // Atualiza a sessão local caso seja o próprio usuário logado
      try {
        const saved = localStorage.getItem('ssvp_session');
        if (saved) {
          const session = JSON.parse(saved);
          if (session.id === userId) {
            session.mustChangePassword = false;
            session.isFirstLogin = false;
            localStorage.setItem('ssvp_session', JSON.stringify(session));
          }
        }
      } catch {}

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
        {!isForced && (
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="p-8 text-center border-b bg-gray-50/50">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-[#004c99] mx-auto mb-4 transform -rotate-3 shadow-inner">
            <Key size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
            {isForced ? 'Primeiro Acesso: Nova Senha' : 'Alterar Senha'}
          </h2>
          <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">
            {isForced 
              ? 'Por segurança, defina sua senha pessoal definitiva para continuar' 
              : (targetName ? `Redefinindo senha de: ${targetName}` : 'Mantenha seu acesso seguro')}
          </p>
        </div>

        <div className="p-8">
          {success ? (
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle2 size={48} className="text-green-500 mb-4 animate-bounce" />
              <p className="text-sm font-black text-gray-800 uppercase tracking-widest text-center">Senha atualizada<br/>com sucesso!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nova Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3.5 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 pr-12 transition-all"
                    placeholder="Mínimo 6 dígitos"
                    autoFocus
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#004c99] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {isForced && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Confirmar Nova Senha</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3.5 border border-gray-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    placeholder="Digite novamente a nova senha"
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full py-4 bg-[#004c99] hover:bg-[#003d7a] text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-blue-200 mt-2"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <><Save size={18} /> Salvar e Acessar</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

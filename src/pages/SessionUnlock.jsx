import React, { useState } from 'react';
import { Lock, Loader2, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { deriveWrappingKey, unwrapPrivateKey } from '../crypto/keys';
import { base64ToArrayBuffer } from '../crypto/utils';

export default function SessionUnlock() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, setPrivateKey, logout } = useAuthStore();

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const saltBuffer = new Uint8Array(base64ToArrayBuffer(user.pbkdf2_salt));
      const wrappingKey = await deriveWrappingKey(password, saltBuffer);
      const privateKey = await unwrapPrivateKey(user.wrapped_private_key, wrappingKey);
      
      setPrivateKey(privateKey);
    } catch (err) {
      console.error('Unlock failed', err);
      setError('Incorrect password. Failed to unwrap private key.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full rounded-3xl p-8 relative overflow-hidden animate-fade-in text-center">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center shadow-inner border border-white/10 relative">
             <KeyRound size={32} className="text-amber-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Session Locked</h1>
        <p className="text-[var(--color-dark-muted)] mb-8 text-sm">
          Welcome back, <span className="text-white font-medium">{user?.display_name || user?.username}</span>.<br/>
          Please enter your password to unlock your encryption keys.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative text-left">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              required
              className="glass-input w-full pl-11"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          <button 
            type="submit" 
            className="btn-primary w-full mt-2"
            disabled={isLoading || !password}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : null}
            Unlock Keys
          </button>
        </form>

        <button 
          onClick={logout}
          className="mt-6 text-sm text-[var(--color-dark-muted)] hover:text-white transition-colors underline-offset-4 hover:underline"
        >
          Sign out and clear session
        </button>
      </div>
    </div>
  );
}

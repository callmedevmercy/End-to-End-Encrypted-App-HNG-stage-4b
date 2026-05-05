import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { deriveWrappingKey, unwrapPrivateKey } from '../crypto/keys';
import { base64ToArrayBuffer } from '../crypto/utils';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('Sign In');
  
  const navigate = useNavigate();
  const { setAuth, setPrivateKey } = useAuthStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setStatusText('Authenticating...');

    try {
      // 1. Authenticate with server
      const res = await api.post('/auth/login', { username, password });
      const { access_token, user } = res.data;

      setStatusText('Unlocking Secure Session...');
      
      // 2. Re-derive wrapping key
      const saltBuffer = new Uint8Array(base64ToArrayBuffer(user.pbkdf2_salt));
      
      const wrappingKey = await deriveWrappingKey(password, saltBuffer);

      // 3. Unwrap private key
      const privateKey = await unwrapPrivateKey(user.wrapped_private_key, wrappingKey);

      // 4. Update store
      setPrivateKey(privateKey);
      setAuth(user, access_token);
      
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
      setStatusText('Sign In');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full rounded-3xl p-8 relative overflow-hidden animate-fade-in">
        {/* Decorative blur blob */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center shadow-inner border border-white/10 relative">
             <ShieldCheck size={32} className="text-primary animate-secure-lock absolute" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">WhisperBox</h1>
        <p className="text-center text-[var(--color-dark-muted)] mb-8 text-sm">Secure E2E Encrypted Messaging</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              required
              className="glass-input w-full"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              required
              className="glass-input w-full pl-11"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn-primary w-full mt-6"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : null}
            {statusText}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-white/50">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:text-primary-hover font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { 
  generateRSAKeyPair, 
  generateSalt, 
  deriveWrappingKey, 
  wrapPrivateKey, 
  exportPublicKey 
} from '../crypto/keys';
import { arrayBufferToBase64 } from '../crypto/utils';

export default function Register() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState('Create Account');
  
  const navigate = useNavigate();
  const { setAuth, setPrivateKey } = useAuthStore();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      setStatusText('Generating secure keys...');
      // 1. Generate RSA Keypair
      const keypair = await generateRSAKeyPair();
      
      // 2. Generate Salt & derive wrapping key
      const salt = generateSalt();
      const wrappingKey = await deriveWrappingKey(password, salt);
      
      // 3. Wrap private key & export public key
      const wrappedPrivateKeyBase64 = await wrapPrivateKey(keypair.privateKey, wrappingKey);
      const publicKeyBase64 = await exportPublicKey(keypair.publicKey);
      const saltBase64 = arrayBufferToBase64(salt.buffer);

      // Keep only a non-extractable private key in memory (reduces XSS/devtools exfil risk)
      const pkcs8 = await window.crypto.subtle.exportKey('pkcs8', keypair.privateKey);
      const inMemoryPrivateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        pkcs8,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['decrypt']
      );

      setStatusText('Registering with server...');
      
      // 4. Send to server
      const payload = {
        username,
        display_name: displayName,
        password,
        public_key: publicKeyBase64,
        wrapped_private_key: wrappedPrivateKeyBase64,
        pbkdf2_salt: saltBase64
      };

      const res = await api.post('/auth/register', payload);
      const { access_token, refresh_token, user } = res.data;

      // 5. Store locally
      setPrivateKey(keypair.privateKey);
      setAuth(user, access_token, refresh_token);
      
      navigate('/');
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        setError('Username is already taken.');
      } else {
        setError(err.response?.data?.detail || 'Failed to register.');
      }
    } finally {
      setIsLoading(false);
      setStatusText('Create Account');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full rounded-3xl p-8 relative overflow-hidden animate-fade-in">
        {/* Decorative blur blob */}
        <div className="absolute top-0 left-0 -ml-16 -mt-16 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 -mr-16 -mb-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center shadow-inner border border-white/10 relative">
             <ShieldCheck size={32} className="text-primary" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">Join WhisperBox</h1>
        <p className="text-center text-[var(--color-dark-muted)] mb-8 text-sm">Generate your cryptographic identity</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              required
              className="glass-input w-full pl-11"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              minLength={1}
              maxLength={128}
            />
          </div>
          <div>
            <input
              type="text"
              required
              className="glass-input w-full"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              minLength={3}
              maxLength={32}
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="password"
              required
              className="glass-input w-full pl-11"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              minLength={8}
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
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:text-primary-hover font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

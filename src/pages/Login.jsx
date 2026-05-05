import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Lock, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { deriveWrappingKey, unwrapPrivateKey } from '../crypto/keys';
import { base64ToArrayBuffer } from '../crypto/utils';

export default function Login() {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [statusText, setStatusText]   = useState('Sign In');

  const navigate = useNavigate();
  const { setAuth, setPrivateKey } = useAuthStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setStatusText('Authenticating…');

    try {
      const res = await api.post('/auth/login', { username, password });
      const { access_token, refresh_token, user } = res.data;

      setStatusText('Unlocking secure session…');
      const saltBuffer  = new Uint8Array(base64ToArrayBuffer(user.pbkdf2_salt));
      const wrappingKey = await deriveWrappingKey(password, saltBuffer);
      const privateKey  = await unwrapPrivateKey(user.wrapped_private_key, wrappingKey);

      setPrivateKey(privateKey);
      setAuth(user, access_token, refresh_token);
      navigate('/');
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 422 && Array.isArray(detail)) {
        setError(detail.map(d => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' · '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      setIsLoading(false);
      setStatusText('Sign In');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 68px', background: 'var(--color-bg)' }}>
      <Header />
      <Footer />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '24px', padding: '40px 36px', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--color-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <ShieldCheck size={32} color="#1a1203" />
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>WhisperBox</h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>End-to-End Encrypted Messaging</p>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* Username */}
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="login-username" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Username</label>
            <input
              id="login-username"
              name="username"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isLoading}
              placeholder="your_username"
              style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 16px', color: 'var(--color-text)', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'var(--color-tertiary)'; e.target.style.boxShadow = '0 0 0 2px rgba(189,170,116,0.2)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Password with peek toggle */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                id="login-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="••••••••"
                style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 44px 12px 42px', color: 'var(--color-text)', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = 'var(--color-tertiary)'; e.target.style.boxShadow = '0 0 0 2px rgba(189,170,116,0.2)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#787679', padding: '4px', display: 'flex', alignItems: 'center' }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            {isLoading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
            {statusText}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border)', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#bdaa74', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
            onMouseLeave={e => e.target.style.textDecoration = 'none'}>
            Create one
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

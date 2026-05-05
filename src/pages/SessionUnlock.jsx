import React, { useState } from 'react';
import { Lock, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuthStore } from '../store/authStore';
import { deriveWrappingKey, unwrapPrivateKey } from '../crypto/keys';
import { base64ToArrayBuffer } from '../crypto/utils';

export default function SessionUnlock() {
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, setPrivateKey, logout } = useAuthStore();

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const saltBuffer  = new Uint8Array(base64ToArrayBuffer(user.pbkdf2_salt));
      const wrappingKey = await deriveWrappingKey(password, saltBuffer);
      const privateKey  = await unwrapPrivateKey(user.wrapped_private_key, wrappingKey);
      setPrivateKey(privateKey);
    } catch {
      setError('Incorrect password — could not unlock your encryption keys.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 68px', background: 'linear-gradient(135deg, #0a0b18 0%, #12142b 55%, #0a0b18 100%)' }}>
      <Header />
      <Footer />

      <div style={{ position: 'fixed', top: '-80px', right: '-80px', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(40,43,164,0.25) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', background: 'rgba(18,20,43,0.9)', backdropFilter: 'blur(20px)', border: '1px solid #2a2e5a', borderRadius: '24px', padding: '40px 36px', textAlign: 'center', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>

        <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #5d6291, #bdaa74)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(93,98,145,0.35)' }}>
          <KeyRound size={30} color="white" />
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#e8e9f5' }}>Session Locked</h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#787679', lineHeight: '1.6' }}>
          Welcome back,{' '}
          <span style={{ color: '#bdaa74', fontWeight: 600 }}>{user?.display_name || user?.username}</span>.
          <br />Enter your password to restore your encryption keys.
        </p>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="unlock-password" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#787679', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#787679', pointerEvents: 'none' }} />
              <input
                id="unlock-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                required autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                placeholder="••••••••"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2e5a', borderRadius: '12px', padding: '12px 44px 12px 42px', color: '#e8e9f5', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = '#282ba4'; e.target.style.boxShadow = '0 0 0 3px rgba(40,43,164,0.2)'; }}
                onBlur={e => { e.target.style.borderColor = '#2a2e5a'; e.target.style.boxShadow = 'none'; }}
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
            disabled={isLoading || !password}
            style={{ width: '100%', background: '#282ba4', color: 'white', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: (isLoading || !password) ? 'not-allowed' : 'pointer', opacity: (isLoading || !password) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(40,43,164,0.4)', transition: 'background 0.2s, transform 0.1s' }}
            onMouseEnter={e => { if (!isLoading && password) e.currentTarget.style.background = '#1f2183'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#282ba4'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {isLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={17} />}
            {isLoading ? 'Unlocking…' : 'Unlock Keys'}
          </button>
        </form>

        <button
          onClick={logout}
          style={{ marginTop: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#787679', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          onMouseEnter={e => e.target.style.color = '#e8e9f5'}
          onMouseLeave={e => e.target.style.color = '#787679'}
        >
          Sign out and clear session
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

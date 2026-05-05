import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Lock, Loader2, ShieldCheck, User, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { generateRSAKeyPair, generateSalt, deriveWrappingKey, wrapPrivateKey, exportPublicKey } from '../crypto/keys';
import { arrayBufferToBase64 } from '../crypto/utils';

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid #2a2e5a',
  borderRadius: '12px',
  padding: '12px 16px',
  color: '#e8e9f5',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
};

export default function Register() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [statusText, setStatusText]   = useState('Create Account');

  const navigate = useNavigate();
  const { setAuth, setPrivateKey } = useAuthStore();

  const focusStyle = (e) => { e.target.style.borderColor = '#282ba4'; e.target.style.boxShadow = '0 0 0 3px rgba(40,43,164,0.2)'; };
  const blurStyle  = (e) => { e.target.style.borderColor = '#2a2e5a'; e.target.style.boxShadow = 'none'; };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError('');
    setIsLoading(true);

    try {
      setStatusText('Generating cryptographic keys…');
      const keypair      = await generateRSAKeyPair();
      const salt         = generateSalt();
      const wrappingKey  = await deriveWrappingKey(password, salt);
      const wrappedKey   = await wrapPrivateKey(keypair.privateKey, wrappingKey);
      const publicKeyB64 = await exportPublicKey(keypair.publicKey);
      const saltB64      = arrayBufferToBase64(salt.buffer);

      setStatusText('Registering with server…');
      const res = await api.post('/auth/register', {
        username,
        display_name:        displayName,
        password,
        public_key:          publicKeyB64,
        wrapped_private_key: wrappedKey,
        pbkdf2_salt:         saltB64,
      });

      const { access_token, refresh_token, user } = res.data;
      setPrivateKey(keypair.privateKey);
      setAuth(user, access_token, refresh_token);
      navigate('/');
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setError('Username is already taken.');
      } else if (err.response?.status === 422 && Array.isArray(detail)) {
        // FastAPI returns an array of validation error objects — extract human-readable messages
        setError(detail.map(d => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' · '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Registration failed. Please check your inputs and try again.');
      }
    } finally {
      setIsLoading(false);
      setStatusText('Create Account');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 68px', background: 'var(--color-bg)' }}>
      <Header />
      <Footer />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '24px', padding: '40px 36px', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #282ba4, #bdaa74)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 8px 24px rgba(40,43,164,0.35)' }}>
            <ShieldCheck size={32} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>Join WhisperBox</h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>Generate your cryptographic identity</p>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          {/* Display Name */}
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="reg-displayname" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Display Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                id="reg-displayname" name="displayname"
                type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                disabled={isLoading} placeholder="Your Name" minLength={1} maxLength={128}
                style={{ ...inputStyle, paddingLeft: '42px' }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>
          </div>

          {/* Username */}
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="reg-username" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Username</label>
            <input
              id="reg-username"
              name="username"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isLoading}
              placeholder="choose_username"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>

          {/* Password with peek */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="reg-password" style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                id="reg-password" name="password"
                type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                disabled={isLoading} placeholder="Min 8 characters" minLength={8}
                style={{ ...inputStyle, paddingLeft: '42px', paddingRight: '44px' }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
              <button
                type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Password strength hint */}
            {password.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: password.length >= (i + 1) * 3 ? (password.length < 8 ? '#bdaa74' : '#10b981') : 'var(--color-border)', transition: 'background 0.3s' }} />
                ))}
                <span style={{ fontSize: '11px', color: password.length < 8 ? '#bdaa74' : '#10b981', whiteSpace: 'nowrap', lineHeight: '1' }}>
                  {password.length < 8 ? `${8 - password.length} more chars` : 'Strong'}
                </span>
              </div>
            )}
          </div>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '13px', color: '#bdaa74' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              {statusText}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            {!isLoading && <><ShieldCheck size={17} /> {statusText}</>}
            {isLoading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border)', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#bdaa74', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
            onMouseLeave={e => e.target.style.textDecoration = 'none'}>
            Sign in
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

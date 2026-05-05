import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function Header() {
  const location = useLocation();
  const isLogin    = location.pathname === '/login';
  const isRegister = location.pathname === '/register';

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between h-16 px-4 md:px-8"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'var(--color-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={20} color="#1a1203" />
        </div>
        <span className="text-base md:text-[17px] font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
          WhisperBox
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex items-center gap-2 md:gap-3">
        {/* Encrypted badge - Hidden on very small screens to save space */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mr-1 md:mr-2" style={{
          background: 'rgba(189,170,116,0.1)',
          border: '1px solid rgba(189,170,116,0.3)',
          color: 'var(--color-tertiary)'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', boxShadow: '0 0 6px var(--color-success)' }} />
          E2E Encrypted
        </div>

        {isRegister && (
          <Link to="/login" className="text-sm font-medium px-3 md:px-4 py-2 rounded-xl transition-all" style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
            Sign In
          </Link>
        )}
        {isLogin && (
          <Link to="/register" className="text-sm font-semibold px-3 md:px-4 py-2 rounded-xl transition-all" style={{
            color: '#1a1203',
            background: 'var(--color-tertiary)',
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
            Create Account
          </Link>
        )}
      </nav>
    </header>
  );
}

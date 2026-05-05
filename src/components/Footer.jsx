import React from 'react';
import { ShieldCheck, Lock, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer 
      className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 px-4 md:px-8 py-3 sm:py-0 sm:h-14"
      style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* Left — brand + copyright */}
      <div className="flex items-center justify-center sm:justify-start gap-2">
        <ShieldCheck size={14} style={{ color: 'var(--color-secondary)' }} />
        <span className="text-[11px] sm:text-xs text-center sm:text-left" style={{ color: 'var(--color-text-muted)' }}>
          © {new Date().getFullYear()} WhisperBox — End-to-end encrypted
        </span>
      </div>

      {/* Centre — security badges - hidden on very small mobile screens */}
      <div className="hidden md:flex items-center justify-center gap-4">
        {[
          { label: 'AES-256-GCM' },
          { label: 'RSA-OAEP' },
          { label: 'PBKDF2' },
        ].map(({ label }) => (
          <span key={label} className="flex items-center gap-1 text-[10px] md:text-[11px] tracking-wider font-mono" style={{
            color: 'var(--color-secondary)',
          }}>
            <Lock size={10} /> {label}
          </span>
        ))}
      </div>

      {/* Right — GitHub link */}
      <div className="flex justify-center sm:justify-end">
        <a
          href="https://github.com/callmedevmercy/End-to-End-Encrypted-App-HNG-stage-4b"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] sm:text-xs no-underline transition-colors"
          style={{
            color: 'var(--color-text-muted)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-tertiary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
        >
          <ExternalLink size={14} /> Source Code
        </a>
      </div>
    </footer>
  );
}

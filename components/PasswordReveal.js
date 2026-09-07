'use client';

import { useState } from 'react';
import { Copy, Check, Eye, EyeOff, ShieldAlert } from 'lucide-react';

export default function PasswordReveal({ password, username, studentId, warning }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      const text = `Username: ${username}\nPassword: ${password}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="password-reveal">
      <div className="password-warning">
        <ShieldAlert size={16} />
        <span>{warning || 'Ce mot de passe ne sera affiché qu\'une seule fois. Copiez-le maintenant.'}</span>
      </div>
      
      <div className="password-fields">
        {studentId && (
          <div className="password-field">
            <label>ID Étudiant</label>
            <div className="password-value">{studentId}</div>
          </div>
        )}
        <div className="password-field">
          <label>Nom d'utilisateur</label>
          <div className="password-value mono">{username}</div>
        </div>
        <div className="password-field">
          <label>Mot de passe temporaire</label>
          <div className="password-input-group">
            <div className={`password-value mono ${visible ? 'visible' : 'blurred'}`}>
              {visible ? password : '•'.repeat(password.length)}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-icon"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Masquer' : 'Afficher'}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="password-hint">L'utilisateur devra changer ce mot de passe à la première connexion.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={copyAll}>
          {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
          {copied ? 'Copié !' : 'Copier identifiants'}
        </button>
      </div>
    </div>
  );
}

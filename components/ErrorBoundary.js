'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
    // Here you could log to Sentry or audit log
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="error-boundary">
          <div className="card" style={{ padding: '32px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '16px', 
              background: 'var(--danger-50)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              border: '1px solid var(--danger-100)'
            }}>
              <AlertTriangle size={32} color="var(--danger-500)" />
            </div>
            <h2 style={{ marginBottom: '8px' }}>{this.props.title || 'Une erreur est survenue'}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
              {this.props.message || 'Quelque chose s\'est mal passé. Veuillez réessayer.'}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ 
                textAlign: 'left', background: 'var(--bg-hover)', 
                padding: '12px', borderRadius: '8px', marginBottom: '20px',
                fontSize: '0.8rem', fontFamily: 'monospace'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Détails techniques</summary>
                <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={this.handleReset}>
                <RefreshCw size={18} /> Réessayer
              </button>
              <button className="btn btn-outline" onClick={() => window.location.href = '/'}>
                <Home size={18} /> Accueil
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorFallback({ error, reset }) {
  return (
    <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
      <AlertTriangle size={32} color="var(--danger-500)" style={{ margin: '0 auto 12px' }} />
      <h3 style={{ marginBottom: '8px' }}>Erreur de chargement</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
        {error?.message || 'Impossible de charger les données'}
      </p>
      <button className="btn btn-outline btn-sm" onClick={reset}>
        <RefreshCw size={16} /> Réessayer
      </button>
    </div>
  );
}

export default ErrorBoundary;

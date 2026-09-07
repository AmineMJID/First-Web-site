'use client';

import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
    if (!open) return null;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px 8px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: danger ? 'var(--danger-100)' : 'var(--warning-100)' }}>
                        <AlertTriangle size={26} color={danger ? 'var(--danger-600)' : 'var(--warning-600)'} />
                    </div>
                    <h3 style={{ marginBottom: '6px' }}>{title}</h3>
                    {message && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{message}</p>}
                </div>
                <div className="modal-footer" style={{ justifyContent: 'center' }}>
                    <button className="btn btn-outline" onClick={onCancel}>{cancelLabel}</button>
                    <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

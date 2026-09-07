'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

    const push = useCallback((type, message, duration = 3500) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, type, message }]);
        if (duration) setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    const api = {
        success: (m) => push('success', m),
        error: (m) => push('error', m, 5000),
        info: (m) => push('info', m),
    };

    const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="toast-container" role="status" aria-live="polite">
                {toasts.map((t) => {
                    const Icon = icons[t.type] || Info;
                    return (
                        <div key={t.id} className={`toast toast-${t.type}`}>
                            <Icon size={18} />
                            <span style={{ flex: 1 }}>{t.message}</span>
                            <button onClick={() => dismiss(t.id)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                                <X size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

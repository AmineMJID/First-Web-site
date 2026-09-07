'use client';

import { useState } from 'react';
import { KeyRound, User, ShieldCheck, ShieldOff, Palette, Languages, Moon, Sun } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useUser, useTheme } from '../layout';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/client';

export default function SettingsPage() {
    const { t, language, changeLanguage } = useLanguage();
    const { user, refreshUser } = useUser();
    const { theme, toggleTheme } = useTheme();
    const toast = useToast();
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setErr('');
        if (form.newPassword.length < 8) return setErr(t.settings_page.passwordTooShort);
        if (form.newPassword !== form.confirmPassword) return setErr(t.settings_page.passwordMismatch);
        setSaving(true);
        try {
            await api('/api/auth/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
            toast.success(t.settings_page.passwordChanged);
            setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            refreshUser();
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    };

    const roleColor = user?.role === 'admin' ? '#ef4444' : user?.role === 'teacher' ? '#3b82f6' : '#22c55e';
    const info = [
        [t.login.username, user?.username],
        ['Email', user?.email || '—'],
        [user?.role === 'student' ? 'ID' : user?.role === 'teacher' ? 'ID' : null, user?.student_id || user?.teacher_id],
        [user?.role === 'student' ? t.dashboard.class : user?.role === 'teacher' ? t.dashboard.subject : null, user?.class_name || user?.subject],
    ].filter(([k, v]) => k && v);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>{t.settings_page.title}</h1>
                    <p>{t.settings_page.subtitle}</p>
                </div>
            </div>

            {user?.mustChangePassword && (
                <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', background: 'var(--warning-50)', border: '1px solid var(--warning-400)', color: 'var(--warning-600)', fontWeight: 600, display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <KeyRound size={18} /> {t.settings_page.mustChangeBanner}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Profile */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}><User size={20} color={roleColor} /> {t.settings_page.profile}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: roleColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
                            {(user?.fullName || 'U')[0]}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{user?.fullName}</div>
                            <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {info.map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: '8px', fontSize: '0.9rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{v}</strong>
                            </div>
                        ))}
                    </div>
                    {user?.role !== 'student' && (
                        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: user?.has2fa ? '#16a34a' : 'var(--text-muted)' }}>
                            {user?.has2fa ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                            {user?.has2fa ? t.settings_page.twoFactorOn : t.settings_page.twoFactorOff}
                        </div>
                    )}
                </div>

                {/* Password */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}><KeyRound size={20} color="#f59e0b" /> {t.settings_page.changePassword}</h3>
                    <form onSubmit={submit}>
                        {err && <div style={{ background: 'var(--danger-50)', color: 'var(--danger-600)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>{err}</div>}
                        <div className="form-group">
                            <label>{t.settings_page.currentPassword}</label>
                            <input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>{t.settings_page.newPassword}</label>
                            <input type="password" autoComplete="new-password" required minLength={8} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>{t.settings_page.confirmPassword}</label>
                            <input type="password" autoComplete="new-password" required minLength={8} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
                        </div>
                        <button className="btn btn-primary w-full" disabled={saving}>{saving ? '...' : t.common_extra.save}</button>
                    </form>
                </div>

                {/* Preferences */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}><Palette size={20} color="#8b5cf6" /> {t.settings_page.preferences}</h3>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Languages size={16} /> {t.settings_page.language}</label>
                        <div className="tabs">
                            {[['fr', 'Français'], ['en', 'English'], ['ar', 'العربية']].map(([code, label]) => (
                                <button key={code} className={`tab ${language === code ? 'active' : ''}`} onClick={() => changeLanguage(code)} style={{ flex: 1 }}>{label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>{t.settings_page.theme}</label>
                        <div className="tabs">
                            <button className={`tab ${theme === 'light' ? 'active' : ''}`} onClick={() => theme !== 'light' && toggleTheme()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Sun size={16} /> {t.settings_page.light}</button>
                            <button className={`tab ${theme === 'dark' ? 'active' : ''}`} onClick={() => theme !== 'dark' && toggleTheme()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Moon size={16} /> {t.settings_page.dark}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

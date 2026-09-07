'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, User, BookOpen, Shield, Eye, EyeOff, LogIn, Loader2, ArrowLeft, Languages, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="loading-page"><div className="spinner" /></div>}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t, language, changeLanguage, dir } = useLanguage();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState('admin');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    // 2FA States
    const [step, setStep] = useState('login'); // 'login', '2fa-setup', '2fa-verify'
    const [tempToken, setTempToken] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [setupSecret, setSetupSecret] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');

    const roles = [
        { key: 'admin', label: 'Admin', icon: Shield, color: '#ef4444', demo: { user: 'admin', pass: 'admin123' } },
        { key: 'teacher', label: t.common.teachers, icon: BookOpen, color: '#3b82f6', demo: { user: 'teacher1', pass: 'teacher123' } },
        { key: 'student', label: t.common.students, icon: User, color: '#22c55e', demo: { user: 'alice', pass: 'student123' } },
    ];

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', localStorage.getItem('portal-theme') || 'light');
    }, []);

    const fillDemo = (role) => {
        const r = roles.find(r => r.key === role);
        if (r) {
            setUsername(r.demo.user);
            setPassword(r.demo.pass);
            setSelectedRole(role);
            setError('');
        }
    };

    const goToDashboard = (role) => {
        const next = searchParams.get('next');
        const safeNext = next && next.startsWith('/dashboard') ? next : `/dashboard/${role}`;
        router.push(safeNext);
        router.refresh();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(res.status === 429 ? t.login_extra.tooMany : res.status === 401 ? t.login.error : (data.error || t.login.error));
                setLoading(false);
                return;
            }
            if (data.requires2FASetup) {
                setTempToken(data.tempToken);
                const qrRes = await fetch(`/api/auth/setup-2fa?tempToken=${encodeURIComponent(data.tempToken)}`);
                const qrData = await qrRes.json();
                if (qrData.success) {
                    setQrCode(qrData.qrCodeUrl);
                    setSetupSecret(qrData.secret);
                    setStep('2fa-setup');
                } else {
                    setError(qrData.error || t.common_extra.errorGeneric);
                }
                setLoading(false);
            } else if (data.requires2FA) {
                setTempToken(data.tempToken);
                setStep('2fa-verify');
                setLoading(false);
            } else {
                goToDashboard(data.user.role);
            }
        } catch {
            setError(t.login_extra.networkError);
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tempToken,
                    code: twoFactorCode,
                    setupSecret: step === '2fa-setup' ? setupSecret : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || t.common_extra.errorGeneric);
                setLoading(false);
                if (res.status === 401 && /temporary/i.test(data.error || '')) backToLogin();
                return;
            }
            goToDashboard(data.user.role);
        } catch {
            setError(t.login_extra.networkError);
            setLoading(false);
        }
    };

    const backToLogin = () => {
        setStep('login');
        setTwoFactorCode('');
        setTempToken('');
        setQrCode('');
        setSetupSecret('');
        setError('');
        setLoading(false);
    };

    const copySecret = async () => {
        try {
            await navigator.clipboard.writeText(setupSecret);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };

    const codeInput = (
        <div className="form-group">
            <label htmlFor="code">{t.login_extra.code}</label>
            <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold', direction: 'ltr' }}
                required
            />
        </div>
    );

    const submitBtn = (label, loadingLabel, Icon) => (
        <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1, marginTop: '20px' }}>
            {loading ? <Loader2 size={20} style={{ animation: 'spin 0.6s linear infinite' }} /> : <Icon size={20} />}
            {loading ? loadingLabel : label}
        </button>
    );

    return (
        <div style={{ ...styles.container, direction: dir }}>
            <div style={styles.bgShapes}>
                <div style={{ ...styles.shape, ...styles.shape1 }} />
                <div style={{ ...styles.shape, ...styles.shape2 }} />
                <div style={{ ...styles.shape, ...styles.shape3 }} />
                <div style={{ ...styles.shape, ...styles.shape4 }} />
                <div style={{ ...styles.shape, ...styles.shape5 }} />
                <div style={{ ...styles.shape, ...styles.shape6 }} />
            </div>

            <div style={styles.floatingIcons} aria-hidden="true">
                <span style={{ ...styles.floatIcon, top: '10%', left: '5%', animationDelay: '0s' }}>📚</span>
                <span style={{ ...styles.floatIcon, top: '20%', right: '8%', animationDelay: '1s' }}>🎓</span>
                <span style={{ ...styles.floatIcon, bottom: '15%', left: '10%', animationDelay: '2s' }}>✏️</span>
                <span style={{ ...styles.floatIcon, top: '60%', right: '5%', animationDelay: '0.5s' }}>🔬</span>
                <span style={{ ...styles.floatIcon, top: '40%', left: '3%', animationDelay: '1.5s' }}>📐</span>
                <span style={{ ...styles.floatIcon, bottom: '30%', right: '12%', animationDelay: '2.5s' }}>🌍</span>
            </div>

            {/* Language switch */}
            <div style={styles.langBar}>
                <Languages size={16} color="#64748b" />
                {['fr', 'en', 'ar'].map(code => (
                    <button key={code} onClick={() => changeLanguage(code)} style={{ ...styles.langBtn, ...(language === code ? styles.langBtnActive : {}) }}>
                        {code.toUpperCase()}
                    </button>
                ))}
            </div>

            <div style={styles.loginCard}>
                <div style={styles.cardHeader}>
                    <div style={styles.logoContainer}>
                        <div style={styles.logoCircle}>
                            <GraduationCap size={32} color="white" />
                        </div>
                    </div>
                    <h1 style={styles.title}>{t.login.title}</h1>
                    <p style={styles.subtitle}>
                        {step === '2fa-setup' ? t.login_extra.setup2faTitle :
                            step === '2fa-verify' ? t.login_extra.verify2faTitle :
                                t.login.subtitle}
                    </p>
                </div>

                {step === 'login' && (
                    <>
                        <div style={styles.roleTabs}>
                            {roles.map(role => {
                                const Icon = role.icon;
                                const isActive = selectedRole === role.key;
                                return (
                                    <button
                                        key={role.key}
                                        type="button"
                                        onClick={() => fillDemo(role.key)}
                                        style={{
                                            ...styles.roleTab,
                                            ...(isActive ? {
                                                background: `linear-gradient(135deg, ${role.color}22, ${role.color}11)`,
                                                borderColor: role.color,
                                                color: role.color,
                                            } : {}),
                                        }}
                                    >
                                        <Icon size={16} />
                                        <span>{role.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p style={styles.demoHint}>{t.login_extra.demoHint}</p>

                        <form onSubmit={handleSubmit} style={styles.form}>
                            {error && <div style={styles.errorBox} role="alert"><span>⚠️</span> {error}</div>}

                            <div className="form-group">
                                <label htmlFor="username">{t.login.username}</label>
                                <div style={styles.inputWrapper}>
                                    <User size={18} style={styles.inputIcon} />
                                    <input
                                        id="username"
                                        type="text"
                                        autoComplete="username"
                                        placeholder={t.login.username}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        style={styles.inputWithIcon}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">{t.login.password}</label>
                                <div style={styles.inputWrapper}>
                                    <Shield size={18} style={styles.inputIcon} />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        placeholder={t.login.password}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={styles.inputWithIcon}
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeBtn} aria-label="Toggle password">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {submitBtn(t.login.signIn, t.login.signingIn, LogIn)}
                        </form>
                    </>
                )}

                {step === '2fa-setup' && (
                    <form onSubmit={handleVerify2FA} style={styles.form}>
                        <p style={styles.hint}>{t.login_extra.setup2faHint}</p>
                        {qrCode && (
                            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
                                <img src={qrCode} alt="QR Code" style={{ width: '180px', height: '180px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', padding: '6px' }} />
                            </div>
                        )}
                        <p style={{ ...styles.hint, marginBottom: '6px' }}>{t.login_extra.manualKey}</p>
                        <div style={styles.secretBox}>
                            <code style={{ flex: 1, wordBreak: 'break-all', fontSize: '0.8rem', direction: 'ltr' }}>{setupSecret}</code>
                            <button type="button" onClick={copySecret} style={styles.copyBtn} aria-label={t.common_extra.copy}>
                                {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
                            </button>
                        </div>
                        {error && <div style={styles.errorBox} role="alert"><span>⚠️</span> {error}</div>}
                        {codeInput}
                        {submitBtn(t.login_extra.verify, t.login_extra.verifying, Shield)}
                        <button type="button" onClick={backToLogin} style={styles.backBtn}><ArrowLeft size={16} /> {t.login_extra.back}</button>
                    </form>
                )}

                {step === '2fa-verify' && (
                    <form onSubmit={handleVerify2FA} style={styles.form}>
                        <p style={styles.hint}>{t.login_extra.verify2faHint}</p>
                        {error && <div style={styles.errorBox} role="alert"><span>⚠️</span> {error}</div>}
                        {codeInput}
                        {submitBtn(t.login_extra.verify, t.login_extra.verifying, Shield)}
                        <button type="button" onClick={backToLogin} style={styles.backBtn}><ArrowLeft size={16} /> {t.login_extra.back}</button>
                    </form>
                )}
            </div>

            <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes morphBg {
          0%, 100% { border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%; }
          25% { border-radius: 50% 50% 30% 70% / 50% 60% 40% 50%; }
          50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          75% { border-radius: 60% 40% 50% 50% / 40% 50% 60% 50%; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}

const styles = {
    langBar: {
        position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '4px',
        background: 'rgba(255,255,255,0.85)', padding: '6px 10px', borderRadius: '999px', zIndex: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
    langBtn: {
        border: 'none', background: 'transparent', padding: '4px 8px', borderRadius: '999px',
        fontSize: '0.75rem', fontWeight: 700, color: '#64748b', cursor: 'pointer',
    },
    langBtnActive: { background: '#1e40af', color: 'white' },
    demoHint: { textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '-8px', marginBottom: '12px' },
    hint: { textAlign: 'center', fontSize: '0.85rem', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 },
    secretBox: {
        display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', borderRadius: '10px',
        padding: '10px 12px', marginBottom: '16px', border: '1px solid #e2e8f0',
    },
    copyBtn: { border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px' },
    backBtn: {
        width: '100%', marginTop: '10px', border: 'none', background: 'transparent', color: '#64748b',
        fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px',
    },
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 40%, #1e40af 60%, #3b82f6 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px',
    },
    bgShapes: {
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
    },
    shape: {
        position: 'absolute',
        animation: 'morphBg 15s ease-in-out infinite',
        opacity: 0.08,
    },
    shape1: { width: '500px', height: '500px', background: '#60a5fa', top: '-10%', left: '-10%', animationDuration: '18s' },
    shape2: { width: '400px', height: '400px', background: '#a78bfa', bottom: '-5%', right: '-5%', animationDuration: '22s', animationDelay: '2s' },
    shape3: { width: '300px', height: '300px', background: '#34d399', top: '40%', left: '60%', animationDuration: '20s', animationDelay: '4s' },
    shape4: { width: '200px', height: '200px', background: '#fbbf24', top: '10%', right: '20%', animationDuration: '16s', animationDelay: '1s' },
    shape5: { width: '250px', height: '250px', background: '#f472b6', bottom: '20%', left: '20%', animationDuration: '24s', animationDelay: '3s' },
    shape6: { width: '350px', height: '350px', background: '#818cf8', top: '60%', right: '40%', animationDuration: '19s', animationDelay: '5s' },
    floatingIcons: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
    },
    floatIcon: {
        position: 'absolute',
        fontSize: '2rem',
        animation: 'float 6s ease-in-out infinite',
        opacity: 0.3,
    },
    loginCard: {
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
        position: 'relative',
        zIndex: 10,
        animation: 'fadeIn 0.6s ease-out',
        overflow: 'hidden',
    },
    cardHeader: {
        textAlign: 'center',
        padding: '32px 32px 0',
    },
    logoContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
    },
    logoCircle: {
        width: '64px',
        height: '64px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)',
    },
    title: {
        fontSize: '1.6rem',
        fontWeight: 800,
        color: '#0f172a',
        marginBottom: '4px',
    },
    subtitle: {
        fontSize: '0.9rem',
        color: '#64748b',
    },
    roleTabs: {
        display: 'flex',
        gap: '8px',
        padding: '20px 32px 0',
    },
    roleTab: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '10px',
        borderRadius: '10px',
        border: '1.5px solid #e2e8f0',
        background: 'transparent',
        color: '#64748b',
        fontSize: '0.825rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
    },
    form: {
        padding: '20px 32px',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: '12px',
        color: '#94a3b8',
        pointerEvents: 'none',
    },
    inputWithIcon: {
        paddingLeft: '40px',
    },
    eyeBtn: {
        position: 'absolute',
        right: '12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#94a3b8',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
    },
    errorBox: {
        padding: '10px 14px',
        borderRadius: '10px',
        background: '#fef2f2',
        color: '#dc2626',
        fontSize: '0.85rem',
        fontWeight: 500,
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    submitBtn: {
        width: '100%',
        padding: '12px',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        color: 'white',
        fontSize: '0.95rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.3)',
        fontFamily: 'inherit',
        marginTop: '8px',
    },
    demoBox: {
        margin: '0 32px 24px',
        padding: '16px',
        borderRadius: '12px',
        background: '#f0f4ff',
        border: '1px solid #dbeafe',
    },
    demoTitle: {
        fontSize: '0.8rem',
        fontWeight: 700,
        color: '#1e40af',
        marginBottom: '10px',
        textAlign: 'center',
    },
    demoGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    demoItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'white',
        border: '1px solid #e2e8f0',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
        fontSize: '0.825rem',
    },
};

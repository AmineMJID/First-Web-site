'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, ClipboardCheck,
    MessageSquare, BarChart3, Settings, LogOut, Moon, Sun, Menu, X,
    Shield, Languages, KeyRound
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SkeletonStats } from '@/components/Skeleton';

// Theme context for dark mode
const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

// User context – value is { user, refreshUser }
const UserContext = createContext({ user: null, refreshUser: () => {} });
export const useUser = () => useContext(UserContext);

export default function DashboardLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const { language, changeLanguage, t, dir } = useLanguage();

    const [user, setUser] = useState(null);
    const [theme, setTheme] = useState('light');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileSidebar, setMobileSidebar] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showLangMenu, setShowLangMenu] = useState(false);

    // Navigation configs
    const navItems = {
        admin: [
            { label: t.common.dashboard, href: '/dashboard/admin', icon: LayoutDashboard },
            { label: t.common.students, href: '/dashboard/admin/students', icon: Users },
            { label: t.common.teachers, href: '/dashboard/admin/teachers', icon: GraduationCap },
            { label: t.common.schedule, href: '/dashboard/admin/schedule', icon: Calendar },
            { label: t.common.messages, href: '/dashboard/admin/messages', icon: MessageSquare, badge: true },
            { label: t.common.reports, href: '/dashboard/admin/reports', icon: BarChart3 },
        ],
        teacher: [
            { label: t.common.dashboard, href: '/dashboard/teacher', icon: LayoutDashboard },
            { label: t.common.grades, href: '/dashboard/teacher/grades', icon: BookOpen },
            { label: t.common.attendance, href: '/dashboard/teacher/attendance', icon: ClipboardCheck },
            { label: t.common.schedule, href: '/dashboard/teacher/schedule', icon: Calendar },
            { label: t.common.messages, href: '/dashboard/teacher/messages', icon: MessageSquare, badge: true },
        ],
        student: [
            { label: t.common.dashboard, href: '/dashboard/student', icon: LayoutDashboard },
            { label: t.common.schedule, href: '/dashboard/student/schedule', icon: Calendar },
            { label: t.common.grades, href: '/dashboard/student/grades', icon: BookOpen },
            { label: t.common.attendance, href: '/dashboard/student/attendance', icon: ClipboardCheck },
            { label: t.common.messages, href: '/dashboard/student/messages', icon: MessageSquare, badge: true },
        ],
    };

    // The role comes from the authenticated user, not from the URL
    const role = user?.role || pathname.split('/')[2] || 'admin';
    const currentNav = [...(navItems[role] || navItems.admin), { label: t.common_extra.settings, href: '/dashboard/settings', icon: Settings }];

    const refreshUser = () => fetch('/api/auth/me')
        .then(r => { if (!r.ok) throw new Error('Unauthorized'); return r.json(); })
        .then(data => { setUser(data); setLoading(false); })
        .catch(() => { router.push('/login'); });

    useEffect(() => {
        const savedTheme = localStorage.getItem('portal-theme') || 'light';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        refreshUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refresh unread counter when navigating + close mobile menu
    useEffect(() => {
        setMobileSidebar(false);
        setShowLangMenu(false);
        if (user) refreshUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    // Close the sidebar on Escape
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && setMobileSidebar(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('portal-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    if (loading) {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)' }}>{t.common.loading}</p>
                <div style={{ marginTop: '20px', width: '80%', maxWidth: '800px' }}>
                    <SkeletonStats />
                </div>
            </div>
        );
    }

    const roleColor = role === 'admin' ? '#ef4444' : role === 'teacher' ? '#3b82f6' : '#22c55e';
    const roleLabel = role === 'admin' ? t.common.adminPanel : role === 'teacher' ? t.common.teacherPanel : t.common.studentPanel;

    const expanded = sidebarOpen || mobileSidebar;
    const sidebarStyle = {
        ...styles.sidebar,
        width: expanded ? '260px' : '72px',
        left: dir === 'ltr' ? 0 : 'auto',
        right: dir === 'rtl' ? 0 : 'auto',
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            <UserContext.Provider value={{ user, refreshUser }}>
              <ToastProvider>
                <div style={{ ...styles.wrapper, direction: dir }}>
                    {mobileSidebar && (
                        <div style={styles.overlay} onClick={() => setMobileSidebar(false)} />
                    )}

                    <aside
                        className={`portal-sidebar ${mobileSidebar ? 'is-open' : ''}`}
                        style={sidebarStyle}
                        onMouseEnter={() => setSidebarOpen(true)}
                        onMouseLeave={() => setSidebarOpen(false)}
                    >
                        <div style={styles.sidebarHeader}>
                            <div style={{ ...styles.sidebarLogo, justifyContent: expanded ? 'flex-start' : 'center', width: '100%' }}>
                                <div style={styles.logoMark}>
                                    <GraduationCap size={22} color="white" />
                                </div>
                                {expanded && (
                                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        <div style={styles.logoText}>Student Portal</div>
                                        <div style={styles.logoSubtext}>{t.common.academicSystem}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {expanded && (
                            <div style={{ ...styles.roleBadge, background: `${roleColor}22`, borderColor: `${roleColor}44` }}>
                                <Shield size={14} style={{ color: roleColor }} />
                                <span style={{ color: roleColor, fontWeight: 600, fontSize: '0.75rem' }}>{roleLabel}</span>
                            </div>
                        )}

                        <nav style={styles.nav}>
                            {currentNav.map(item => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                const count = item.badge ? (user?.unreadMessages || 0) : 0;
                                return (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        title={item.label}
                                        onClick={(e) => { e.preventDefault(); router.push(item.href); setMobileSidebar(false); }}
                                        style={{
                                            ...styles.navItem,
                                            ...(isActive ? styles.navItemActive : {}),
                                            justifyContent: expanded ? 'flex-start' : 'center',
                                            padding: expanded ? '10px 16px' : '10px',
                                        }}
                                    >
                                        <span style={{ position: 'relative', display: 'flex' }}>
                                            <Icon size={20} />
                                            {count > 0 && !expanded && <span style={styles.dot} />}
                                        </span>
                                        {expanded && <span style={{ flex: 1 }}>{item.label}</span>}
                                        {expanded && count > 0 && <span style={styles.countBadge}>{count}</span>}
                                        {isActive && <div style={{ ...styles.activeIndicator, [dir === 'ltr' ? 'right' : 'left']: '-8px' }} />}
                                    </a>
                                );
                            })}
                        </nav>

                        <div style={styles.sidebarFooter}>
                            <button onClick={handleLogout} title={t.common.signOut} style={{
                                ...styles.navItem,
                                width: '100%',
                                justifyContent: expanded ? 'flex-start' : 'center',
                                padding: expanded ? '10px 16px' : '10px',
                                color: 'rgba(255,255,255,0.6)',
                            }}>
                                <LogOut size={20} />
                                {expanded && <span>{t.common.signOut}</span>}
                            </button>
                        </div>
                    </aside>

                    <div className="portal-main" style={{
                        ...styles.main,
                        marginLeft: dir === 'ltr' ? (sidebarOpen ? '260px' : '72px') : 0,
                        marginRight: dir === 'rtl' ? (sidebarOpen ? '260px' : '72px') : 0,
                    }}>
                        <header style={styles.header}>
                            <div style={styles.headerLeft}>
                                <button className="show-mobile" style={styles.menuBtn} onClick={() => setMobileSidebar(v => !v)} aria-label={t.common_extra.menu}>
                                    {mobileSidebar ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <div>
                                    <h2 style={styles.pageTitle}>
                                        {currentNav.find(n => n.href === pathname)?.label || t.common.dashboard}
                                    </h2>
                                    <p style={styles.pageSubtitle}>
                                        {t.common.welcomeBack} {user?.fullName || user?.full_name || 'User'}
                                    </p>
                                </div>
                            </div>
                            <div style={styles.headerRight}>
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowLangMenu(!showLangMenu)}
                                        style={styles.langBtnLarge}
                                        title={t.common.language}
                                    >
                                        <Languages size={18} />
                                        <span>{language.toUpperCase()}</span>
                                    </button>

                                    {showLangMenu && (
                                        <div style={{ ...styles.langDropdown, [dir === 'ltr' ? 'right' : 'left']: 0 }}>
                                            {[
                                                { code: 'fr', label: 'Français' },
                                                { code: 'en', label: 'English' },
                                                { code: 'ar', label: 'العربية' }
                                            ].map(lang => (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
                                                    style={{
                                                        ...styles.langOption,
                                                        background: language === lang.code ? 'var(--bg-hover)' : 'transparent',
                                                        fontWeight: language === lang.code ? 700 : 400,
                                                        textAlign: dir === 'rtl' ? 'right' : 'left'
                                                    }}
                                                >
                                                    {lang.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button onClick={toggleTheme} style={styles.headerIconBtn} title={t.common.theme} aria-label={t.common.theme}>
                                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                </button>
                                <div style={{ ...styles.userChip, cursor: 'pointer' }} onClick={() => router.push('/dashboard/settings')} title={t.common_extra.settings}>
                                    <div style={{ ...styles.userAvatar, background: roleColor }}>
                                        {(user?.fullName || user?.full_name || 'U')[0]}
                                    </div>
                                    <div style={styles.userInfo} className="hide-mobile">
                                        <span style={styles.userName}>{user?.fullName || user?.full_name}</span>
                                        <span style={styles.userRole}>{roleLabel}</span>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <main style={styles.content} className="animate-fade-in">
                            {user?.mustChangePassword && pathname !== '/dashboard/settings' && (
                                <div className="card" style={styles.warnBanner} onClick={() => router.push('/dashboard/settings')}>
                                    <KeyRound size={18} /> <span>{t.settings_page.mustChangeBanner}</span>
                                </div>
                            )}
                            <ErrorBoundary>
                                {children}
                            </ErrorBoundary>
                        </main>
                    </div>
                </div>
              </ToastProvider>
            </UserContext.Provider>
        </ThemeContext.Provider>
    );
}

const styles = {
    wrapper: {
        minHeight: '100vh',
        display: 'flex',
    },
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 99,
    },
    sidebar: {
        position: 'fixed',
        top: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 60%, #1e40af 100%)',
        color: 'white',
        transition: 'all 0.3s ease',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    dot: {
        position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px',
        borderRadius: '50%', background: '#f87171', border: '2px solid #0f172a',
    },
    countBadge: {
        minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px',
        background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    warnBanner: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '20px',
        background: 'var(--warning-50)', border: '1px solid var(--warning-400)', color: 'var(--warning-600)',
        fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
    },
    sidebarHeader: {
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    sidebarLogo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logoMark: {
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    logoText: {
        fontSize: '1rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
    },
    logoSubtext: {
        fontSize: '0.7rem',
        opacity: 0.6,
        whiteSpace: 'nowrap',
    },
    collapseBtn: {
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        borderRadius: '8px',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s ease',
    },
    roleBadge: {
        margin: '12px 16px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    nav: {
        flex: 1,
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    navItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderRadius: '10px',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textDecoration: 'none',
        border: 'none',
        background: 'none',
        fontFamily: 'inherit',
        position: 'relative',
        whiteSpace: 'nowrap',
    },
    navItemActive: {
        background: 'rgba(255,255,255,0.15)',
        color: 'white',
        fontWeight: 600,
    },
    activeIndicator: {
        position: 'absolute',
        width: '3px',
        height: '60%',
        borderRadius: '999px',
        background: '#60a5fa',
    },
    sidebarFooter: {
        padding: '8px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
    },
    main: {
        flex: 1,
        transition: 'all 0.3s ease',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        height: '64px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    menuBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
    },
    pageTitle: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
    },
    pageSubtitle: {
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    headerIconBtn: {
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        transition: 'all 0.2s ease',
    },
    langBtnLarge: {
        height: '38px',
        padding: '0 12px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        minWidth: '70px',
    },
    langDropdown: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        zIndex: 100,
        minWidth: '130px',
    },
    langOption: {
        padding: '8px 12px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '0.825rem',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
    },
    userChip: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 12px 6px 6px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
    },
    userAvatar: {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '0.85rem',
        fontWeight: 700,
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    userName: {
        fontSize: '0.825rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        lineHeight: 1.2,
    },
    userRole: {
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
    },
    content: {
        flex: 1,
        padding: '24px',
    },
};

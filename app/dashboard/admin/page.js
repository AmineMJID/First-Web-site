'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, GraduationCap, ClipboardCheck, TrendingUp, BookOpen, Calendar, UserPlus, BarChart3, AlertTriangle, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { api, gradeColor, subjectColor } from '@/lib/client';

export default function AdminDashboard() {
    const { t } = useLanguage();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/api/reports').then(setStats).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const cards = [
        { label: t.dashboard.totalStudents, value: stats?.totalStudents || 0, pct: Math.min(100, (stats?.totalStudents || 0) * 2), icon: Users, color: '#3b82f6', bg: 'linear-gradient(135deg, #dbeafe, #eff6ff)', href: '/dashboard/admin/students' },
        { label: t.dashboard.totalTeachers, value: stats?.totalTeachers || 0, pct: Math.min(100, (stats?.totalTeachers || 0) * 10), icon: GraduationCap, color: '#8b5cf6', bg: 'linear-gradient(135deg, #ede9fe, #f5f3ff)', href: '/dashboard/admin/teachers' },
        { label: t.dashboard.attendanceRate, value: `${stats?.attendanceRate || 0}%`, pct: stats?.attendanceRate || 0, icon: ClipboardCheck, color: '#22c55e', bg: 'linear-gradient(135deg, #dcfce7, #f0fdf4)', href: '/dashboard/admin/reports' },
        { label: t.dashboard.averageGrade, value: stats?.avgGrade || 0, pct: stats?.avgGrade || 0, icon: TrendingUp, color: '#f59e0b', bg: 'linear-gradient(135deg, #fef3c7, #fffbeb)', href: '/dashboard/admin/reports' },
    ];

    return (
        <div>
            {/* Stats Cards */}
            <div style={styles.statsGrid} className="stagger">
                {cards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <Link key={i} href={card.href} className="card animate-fade-in" style={{ ...styles.statCard, textDecoration: 'none', display: 'block' }}>
                            <div style={styles.statTop}>
                                <div>
                                    <p style={styles.statLabel}>{card.label}</p>
                                    <h2 style={{ ...styles.statValue, color: card.color }}>{card.value}</h2>
                                </div>
                                <div style={{ ...styles.statIcon, background: card.bg }}>
                                    <Icon size={24} color={card.color} />
                                </div>
                            </div>
                            <div style={styles.statBar}>
                                <div style={{ ...styles.statBarFill, width: `${card.pct}%`, background: card.color }} />
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Content Grid */}
            <div style={styles.contentGrid}>
                {/* Recent Students */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>
                            <UserPlus size={20} color="#3b82f6" /> {t.dashboard.recentStudents}
                        </h3>
                    </div>
                    <div className="table-container" style={{ marginTop: '16px' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>{t.dashboard.name}</th>
                                    <th>{t.dashboard.id}</th>
                                    <th>{t.dashboard.class}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(stats?.recentStudents || []).map((s, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name}</td>
                                        <td><span className="badge badge-primary">{s.student_id}</span></td>
                                        <td>{s.class_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Grades by Subject */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={styles.sectionHeader}>
                        <h3 style={styles.sectionTitle}>
                            <BarChart3 size={20} color="#8b5cf6" /> {t.dashboard.gradesBySubject}
                        </h3>
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(stats?.gradesBySubject || []).map((g, i) => {
                            const color = subjectColor(g.subject);
                            return (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{g.subject}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.dashboard.avg}: {Math.round(g.avg)}</span>
                                    </div>
                                    <div style={styles.progressBg}>
                                        <div style={{ ...styles.progressFill, width: `${g.avg}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ ...styles.contentGrid, marginTop: '24px' }}>
                {/* At-risk students */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={styles.sectionTitle}><AlertTriangle size={20} color="#ef4444" /> {t.reports_extra.atRisk}</h3>
                    <div style={{ marginTop: '12px' }}>
                        {!stats?.atRiskStudents?.length && <p style={{ color: 'var(--text-muted)' }}>{t.reports_extra.noRisk}</p>}
                        {(stats?.atRiskStudents || []).map((x) => (
                            <div key={x.student_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{x.full_name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{x.student_id} · {x.class_name}</div></div>
                                <span className="badge" style={{ background: `${gradeColor(x.avg)}20`, color: gradeColor(x.avg) }}>{x.avg}</span>
                                {x.attendance_rate != null && <span className="badge" style={{ background: `${gradeColor(x.attendance_rate)}20`, color: gradeColor(x.attendance_rate) }}>{x.attendance_rate}%</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={styles.sectionTitle}><Calendar size={20} color="#22c55e" /> {t.dashboard.quickActions}</h3>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <Link href="/dashboard/admin/students" className="btn btn-primary"><UserPlus size={18} /> {t.dashboard.addStudent}</Link>
                        <Link href="/dashboard/admin/teachers" className="btn btn-outline" style={{ color: '#8b5cf6', borderColor: '#8b5cf6' }}><GraduationCap size={18} /> {t.dashboard.manageTeachers}</Link>
                        <Link href="/dashboard/admin/schedule" className="btn btn-outline" style={{ color: '#22c55e', borderColor: '#22c55e' }}><Calendar size={18} /> {t.common.schedule}</Link>
                        <Link href="/dashboard/admin/messages" className="btn btn-outline" style={{ color: '#3b82f6', borderColor: '#3b82f6' }}><MessageSquare size={18} /> {t.dashboard.sendAnnouncement}</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '24px',
    },
    statCard: {
        padding: '20px',
    },
    statTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    statLabel: {
        fontSize: '0.825rem',
        color: 'var(--text-muted)',
        fontWeight: 500,
        marginBottom: '4px',
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: 800,
        lineHeight: 1.1,
    },
    statIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statBar: {
        height: '4px',
        borderRadius: '999px',
        background: 'var(--bg-hover)',
        marginTop: '16px',
        overflow: 'hidden',
    },
    statBarFill: {
        height: '100%',
        borderRadius: '999px',
        transition: 'width 1s ease',
    },
    contentGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
        gap: '24px',
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '1rem',
        fontWeight: 700,
    },
    progressBg: {
        height: '8px',
        borderRadius: '999px',
        background: 'var(--bg-hover)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: '999px',
        transition: 'width 1s ease',
    },
};

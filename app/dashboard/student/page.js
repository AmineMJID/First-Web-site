'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Calendar, ClipboardCheck, MessageSquare, GraduationCap, Clock } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { api, gradeColor, gradeBadge } from '@/lib/client';

export default function StudentDashboard() {
    const { t } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [grades, setGrades] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([api('/api/auth/me'), api('/api/grades'), api('/api/schedule'), api('/api/messages?box=inbox')])
            .then(([p, g, s, m]) => { setProfile(p); setGrades(g); setSchedule(s); setMessages(m); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const todayIndex = new Date().getDay();
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = daysEn[todayIndex];
    const todaySchedule = schedule.filter(s => s.day_of_week === today);
    const latestTerm = [...new Set(grades.map(g => g.term))].sort().pop();
    const termGrades = grades.filter(g => g.term === latestTerm);
    const avgGrade = termGrades.length > 0 ? Math.round(termGrades.reduce((sum, g) => sum + (g.grade * 100) / g.max_grade, 0) / termGrades.length) : 0;
    const unreadMessages = messages.filter(m => !m.is_read).length;
    const recentGrades = [...grades].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

    return (
        <div className="animate-fade-in">
            {/* Welcome Card */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ position: 'absolute', bottom: '-20px', right: '80px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
                            {(profile?.fullName || profile?.full_name || 'S')[0]}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>{t.student_dashboard.welcome}, {profile?.fullName || profile?.full_name}! 👋</h2>
                            <p style={{ opacity: 0.8, fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' }}>
                                {profile?.student_id} • {profile?.class_name}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }} className="stagger">
                {[
                    { label: t.student_dashboard.averageGrade, value: avgGrade, icon: BookOpen, color: gradeColor(avgGrade), suffix: '/100', href: '/dashboard/student/grades' },
                    { label: t.student_dashboard.todaysClasses, value: todaySchedule.length, icon: Calendar, color: '#22c55e', suffix: '', href: '/dashboard/student/schedule' },
                    { label: t.student_dashboard.unreadMessages, value: unreadMessages, icon: MessageSquare, color: '#f59e0b', suffix: '', href: '/dashboard/student/messages' },
                    { label: t.student_dashboard.totalSubjects, value: [...new Set(grades.map(g => g.subject))].length, icon: GraduationCap, color: '#8b5cf6', suffix: '', href: '/dashboard/student/grades' },
                ].map((c, i) => {
                    const Icon = c.icon;
                    return (
                        <Link key={i} href={c.href} className="card animate-fade-in" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${c.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={22} color={c.color} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.label}</p>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color }}>{c.value}<span style={{ fontSize: '0.8rem', fontWeight: 400 }}>{c.suffix}</span></h3>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '24px' }}>
                {/* Today's Schedule */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '1rem', fontWeight: 700 }}>
                        <Clock size={20} color="#22c55e" /> {t.student_dashboard.todaysSchedule}
                    </h3>
                    {todaySchedule.length > 0 ? todaySchedule.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg-hover)', marginBottom: '8px' }}>
                            <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', fontSize: '0.78rem', fontWeight: 700 }}>
                                {s.start_time}
                            </div>
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.subject}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.room} • {s.teacher_name}</p>
                            </div>
                        </div>
                    )) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>{t.student_dashboard.noClassesToday}</p>}
                </div>

                {/* Recent Grades */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '1rem', fontWeight: 700 }}>
                        <BookOpen size={20} color="#3b82f6" /> {t.student_dashboard.recentGrades}
                    </h3>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>{t.student_grades.subject}</th><th>{t.student_grades.grade}</th><th>{t.student_grades.status}</th></tr></thead>
                            <tbody>
                                {recentGrades.map((g, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 500 }}>{g.subject} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g.term}</span></td>
                                        <td style={{ fontWeight: 700, color: gradeColor(g.grade) }}>{g.grade}/{g.max_grade}</td>
                                        <td><span className={`badge ${gradeBadge(g.grade)}`}>
                                            {g.grade >= 80 ? t.student_dashboard.excellent : g.grade >= 60 ? t.student_dashboard.good : t.student_dashboard.needsWork}
                                        </span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

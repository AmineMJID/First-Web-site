'use client';

import { useState, useEffect } from 'react';
import { Users, BookOpen, ClipboardCheck, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { api } from '@/lib/client';

export default function TeacherDashboard() {
    const { t } = useLanguage();
    const [students, setStudents] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([api('/api/students'), api('/api/schedule')])
            .then(([s, sc]) => { setStudents(s); setSchedule(sc); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const todayIndex = new Date().getDay();
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = daysEn[todayIndex];
    const todaySchedule = schedule.filter(s => s.day_of_week === today);

    // Dynamic cards
    const cards = [
        { label: t.teacher_dashboard.myStudents, value: students.length, icon: Users, color: '#3b82f6', href: '/dashboard/teacher/grades' },
        { label: t.teacher_dashboard.todaysClasses, value: todaySchedule.length, icon: Calendar, color: '#22c55e', href: '/dashboard/teacher/schedule' },
        { label: t.teacher_dashboard.totalSubjects, value: [...new Set(schedule.map(s => s.subject))].length, icon: BookOpen, color: '#8b5cf6', href: '/dashboard/teacher/grades' },
        { label: t.common.attendance, value: new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' }), icon: ClipboardCheck, color: '#f59e0b', href: '/dashboard/teacher/attendance' },
    ];

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }} className="stagger">
                {cards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <Link key={i} href={card.href} className="card animate-fade-in" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={24} color={card.color} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>{card.label}</p>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: card.color }}>{card.value}</h2>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '24px' }}>
                {/* Today's Schedule */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>
                        <Calendar size={20} color="#22c55e" /> {t.teacher_dashboard.todaysSchedule}
                    </h3>
                    {todaySchedule.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {todaySchedule.map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '10px', background: 'var(--bg-hover)' }}>
                                    <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', color: 'white', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {s.start_time}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{s.subject}</p>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.class_name} • {s.room}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>{t.teacher_dashboard.noClassesToday}</p>
                    )}
                </div>

                {/* Student List */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>
                        <Users size={20} color="#3b82f6" /> {t.teacher_dashboard.myStudents}
                    </h3>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>{t.teacher_dashboard.className}</th><th>{t.teacher_dashboard.classID}</th><th>{t.teacher_dashboard.classGroup}</th></tr></thead>
                            <tbody>
                                {students.slice(0, 10).map(s => (
                                    <tr key={s.student_id}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name}</td>
                                        <td><span className="badge badge-primary">{s.student_id}</span></td>
                                        <td>{s.class_name}</td>
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

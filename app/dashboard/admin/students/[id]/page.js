'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ClipboardCheck, User, Phone, MapPin, Users } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { api, gradeColor, gradeBadge, subjectColor } from '@/lib/client';

export default function StudentProfile() {
    const { id } = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => { api(`/api/students/${id}`).then(setData).catch((e) => setError(e.message)); }, [id]);

    if (error) return <div className="card" style={{ padding: '24px', color: 'var(--danger-600)' }}>{error}</div>;
    if (!data) return <div className="loading-page"><div className="spinner" /></div>;

    const totalAtt = data.attendance.reduce((s, a) => s + a.count, 0);
    const present = data.attendance.find((a) => a.status === 'present')?.count || 0;
    const rate = totalAtt ? Math.round((present / totalAtt) * 100) : null;
    const avg = data.grades.length ? Math.round(data.grades.reduce((s, g) => s + (g.grade * 100) / g.max_grade, 0) / data.grades.length) : null;
    const terms = [...new Set(data.grades.map((g) => g.term))];

    return (
        <div className="animate-fade-in">
            <button className="btn btn-outline btn-sm" onClick={() => router.back()} style={{ marginBottom: '16px' }}><ArrowLeft size={16} /> {t.login_extra.back}</button>

            <div className="card" style={{ padding: '24px', marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 800 }}>{data.full_name[0]}</div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.4rem' }}>{data.full_name}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{data.student_id} · {data.class_name} · @{data.username}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Stat label={t.common_extra.average} value={avg != null ? avg : '—'} color={avg != null ? gradeColor(avg) : 'var(--text-muted)'} icon={BookOpen} />
                    <Stat label={t.common_extra.attendanceRate} value={rate != null ? `${rate}%` : '—'} color={rate != null ? gradeColor(rate) : 'var(--text-muted)'} icon={ClipboardCheck} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}><User size={18} color="#3b82f6" /> {t.settings_page.profile}</h3>
                    <Row icon={User} label="Email" value={data.email} />
                    <Row icon={User} label="Gender" value={data.gender} />
                    <Row icon={User} label="Birth" value={data.date_of_birth} />
                    <Row icon={Phone} label="Phone" value={data.phone} />
                    <Row icon={MapPin} label="Address" value={data.address} />
                    <Row icon={Users} label="Parent" value={data.parent_name ? `${data.parent_name}${data.parent_phone ? ' · ' + data.parent_phone : ''}` : null} />
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}><ClipboardCheck size={18} color="#22c55e" /> {t.common.attendance}</h3>
                    {['present', 'late', 'excused', 'absent'].map((s) => {
                        const c = data.attendance.find((a) => a.status === s)?.count || 0;
                        const colors = { present: '#22c55e', late: '#f59e0b', excused: '#3b82f6', absent: '#ef4444' };
                        return (
                            <div key={s} style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600 }}>{t.reports_extra[s]}</span><span>{c}</span>
                                </div>
                                <div className="mini-bar"><div style={{ width: totalAtt ? `${(c / totalAtt) * 100}%` : 0, background: colors[s] }} /></div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
                <h3 style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}><BookOpen size={18} color="#8b5cf6" /> {t.common.grades}</h3>
                <div className="table-container">
                    <table>
                        <thead><tr><th>{t.dashboard.subject}</th>{terms.map((term) => <th key={term}>{term}</th>)}</tr></thead>
                        <tbody>
                            {[...new Set(data.grades.map((g) => g.subject))].map((subj) => (
                                <tr key={subj}>
                                    <td style={{ fontWeight: 600 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: subjectColor(subj), marginInlineEnd: 8 }} />{subj}</td>
                                    {terms.map((term) => {
                                        const g = data.grades.find((x) => x.subject === subj && x.term === term);
                                        return <td key={term}>{g ? <span className={`badge ${gradeBadge(g.grade)}`}>{g.grade}/{g.max_grade}</span> : '—'}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, color, icon: Icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '12px', background: 'var(--bg-hover)' }}>
            <Icon size={20} color={color} />
            <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div><div style={{ fontWeight: 800, color, fontSize: '1.1rem' }}>{value}</div></div>
        </div>
    );
}

function Row({ icon: Icon, label, value }) {
    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
            <Icon size={16} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)', width: '80px' }}>{label}</span>
            <span style={{ fontWeight: 500 }}>{value || '—'}</span>
        </div>
    );
}

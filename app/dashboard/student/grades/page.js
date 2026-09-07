'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, TrendingUp, Download } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { api, downloadCsv, gradeColor, gradeBadge, subjectColor } from '@/lib/client';

export default function StudentGrades() {
    const { t } = useLanguage();
    const [grades, setGrades] = useState(null);
    const [selectedTerm, setTerm] = useState('');

    useEffect(() => { api('/api/grades').then(setGrades).catch(() => setGrades([])); }, []);

    const terms = useMemo(() => [...new Set((grades || []).map((g) => g.term))].sort(), [grades]);
    const term = selectedTerm || terms[terms.length - 1] || '';

    if (!grades) return <div className="loading-page"><div className="spinner" /></div>;

    const current = grades.filter((g) => g.term === term);
    const pct = (g) => Math.round((g.grade * 100) / g.max_grade);
    const avg = current.length ? Math.round(current.reduce((s, g) => s + pct(g), 0) / current.length) : 0;
    const subjects = [...new Set(grades.map((g) => g.subject))];
    const best = current.length ? current.reduce((a, b) => (pct(a) >= pct(b) ? a : b)) : null;

    const trend = (subj) => {
        const idx = terms.indexOf(term);
        if (idx <= 0) return null;
        const prev = grades.find((g) => g.subject === subj && g.term === terms[idx - 1]);
        const cur = grades.find((g) => g.subject === subj && g.term === term);
        if (!prev || !cur) return null;
        return pct(cur) - pct(prev);
    };

    return (
        <div className="animate-fade-in">
            <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={20} color="#3b82f6" /> {t.student_grades.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: `${gradeColor(avg)}15` }}>
                        <TrendingUp size={18} color={gradeColor(avg)} />
                        <span style={{ fontWeight: 700, color: gradeColor(avg) }}>{t.common_extra.average}: {avg}/100</span>
                    </div>
                    <div className="tabs">
                        {terms.map((x) => <button key={x} className={`tab ${term === x ? 'active' : ''}`} onClick={() => setTerm(x)}>{x}</button>)}
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => downloadCsv('my-grades.csv', grades, [{ key: 'term', label: 'Term' }, { key: 'subject', label: t.dashboard.subject }, { key: 'grade', label: t.student_grades.grade }, { key: 'max_grade', label: 'Max' }, { key: 'remarks', label: t.student_grades.remarks }, { key: 'teacher_name', label: t.student_schedule.teacher }])}><Download size={14} /></button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }} className="stagger">
                {subjects.map((subj) => {
                    const g = current.find((x) => x.subject === subj);
                    const p = g ? pct(g) : null;
                    const color = subjectColor(subj);
                    const d = trend(subj);
                    return (
                        <div key={subj} className="card animate-fade-in" style={{ padding: '18px', borderTop: `3px solid ${color}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{subj}</h4>
                                {p != null && <span className={`badge ${gradeBadge(p)}`}>{p >= 80 ? t.student_dashboard.excellent : p >= 60 ? t.student_dashboard.good : t.student_dashboard.needsWork}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '2rem', fontWeight: 800, color: p != null ? color : 'var(--text-muted)' }}>{g ? g.grade : '—'}</span>
                                {g && <span style={{ color: 'var(--text-muted)' }}>/{g.max_grade}</span>}
                                {d != null && d !== 0 && <span style={{ marginInlineStart: 'auto', fontSize: '0.8rem', fontWeight: 700, color: d > 0 ? '#22c55e' : '#ef4444' }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>}
                            </div>
                            <div className="mini-bar"><div style={{ width: `${p || 0}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} /></div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>{g?.remarks || (g?.teacher_name ? g.teacher_name : '—')}</p>
                        </div>
                    );
                })}
            </div>

            {best && (
                <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', background: 'var(--success-50)', border: '1px solid var(--success-200)', color: 'var(--success-600)', fontSize: '0.9rem' }}>
                    🏆 {best.subject}: {best.grade}/{best.max_grade}
                </div>
            )}

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead><tr><th>{t.student_grades.subject}</th>{terms.map((x) => <th key={x}>{x}</th>)}<th>{t.student_schedule.teacher}</th></tr></thead>
                        <tbody>
                            {subjects.map((subj) => (
                                <tr key={subj}>
                                    <td style={{ fontWeight: 600 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: subjectColor(subj), marginInlineEnd: 8 }} />{subj}</td>
                                    {terms.map((x) => { const g = grades.find((y) => y.subject === subj && y.term === x); return <td key={x} style={{ fontWeight: 700, color: g ? gradeColor(pct(g)) : 'var(--text-muted)' }}>{g ? `${g.grade}/${g.max_grade}` : '—'}</td>; })}
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{grades.find((y) => y.subject === subj)?.teacher_name || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

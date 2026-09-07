'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Users, GraduationCap, ClipboardCheck, TrendingUp, Download, AlertTriangle, Trophy, Layers } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { api, downloadCsv, gradeColor, subjectColor } from '@/lib/client';

const ATT_COLORS = { present: '#22c55e', late: '#f59e0b', excused: '#3b82f6', absent: '#ef4444' };
const BAND_COLORS = { A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444' };

export default function AdminReports() {
    const { t } = useLanguage();
    const [s, setS] = useState(null);
    useEffect(() => { api('/api/reports').then(setS).catch(() => setS({})); }, []);
    if (!s) return <div className="loading-page"><div className="spinner" /></div>;

    const classAtt = {};
    (s.attendanceByClass || []).forEach((r) => { classAtt[r.class_name] = classAtt[r.class_name] || {}; classAtt[r.class_name][r.status] = r.count; });
    const maxTrend = 100;

    const exportAll = () => {
        downloadCsv('report-grades-by-subject.csv', s.gradesBySubject, [{ key: 'subject', label: t.dashboard.subject }, { key: 'avg', label: t.common_extra.average }, { key: 'min', label: 'Min' }, { key: 'max', label: 'Max' }, { key: 'count', label: 'N' }]);
    };

    const cards = [
        { label: t.dashboard.totalStudents, value: s.totalStudents, icon: Users, color: '#3b82f6' },
        { label: t.dashboard.totalTeachers, value: s.totalTeachers, icon: GraduationCap, color: '#8b5cf6' },
        { label: t.reports_extra.classes, value: s.totalClasses, icon: Layers, color: '#ec4899' },
        { label: t.dashboard.attendanceRate, value: `${s.attendanceRate}%`, icon: ClipboardCheck, color: '#22c55e' },
        { label: t.dashboard.averageGrade, value: s.avgGrade, icon: TrendingUp, color: '#f59e0b' },
    ];

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={22} color="#3b82f6" /> {t.reports_page.title}</h1>
                    <p>{t.reports_page.subtitle}</p>
                </div>
                <button className="btn btn-outline" onClick={exportAll}><Download size={18} /> {t.common_extra.export}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }} className="stagger">
                {cards.map((c, i) => { const Icon = c.icon; return (
                    <div key={i} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${c.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={c.color} /></div>
                        <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.label}</div><div style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color }}>{c.value}</div></div>
                    </div>
                ); })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {/* Attendance trend */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{t.reports_extra.attendanceTrend}</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
                        {(s.attendanceTrend || []).map((d) => (
                            <div key={d.date} title={`${d.date}: ${d.rate}%`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{d.rate}</span>
                                <div style={{ width: '100%', height: `${(d.rate / maxTrend) * 130}px`, background: gradeColor(d.rate), borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{d.date.slice(5)}</span>
                            </div>
                        ))}
                        {!s.attendanceTrend?.length && <p style={{ color: 'var(--text-muted)' }}>{t.common_extra.noData}</p>}
                    </div>
                </div>

                {/* Grade distribution */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{t.reports_extra.gradeDistribution}</h3>
                    {(() => {
                        const total = (s.gradeDistribution || []).reduce((a, b) => a + b.count, 0) || 1;
                        return (
                            <>
                                <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                                    {['A', 'B', 'C', 'D', 'F'].map((b) => { const c = s.gradeDistribution.find((x) => x.band === b)?.count || 0; return c ? <div key={b} title={`${b}: ${c}`} style={{ width: `${(c / total) * 100}%`, background: BAND_COLORS[b] }} /> : null; })}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                                    {['A', 'B', 'C', 'D', 'F'].map((b) => { const c = s.gradeDistribution.find((x) => x.band === b)?.count || 0; return (
                                        <div key={b} style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: `${BAND_COLORS[b]}15` }}>
                                            <div style={{ fontWeight: 800, color: BAND_COLORS[b], fontSize: '1.1rem' }}>{b}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c} · {Math.round((c / total) * 100)}%</div>
                                        </div>
                                    ); })}
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Grades by subject */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{t.dashboard.gradesBySubject}</h3>
                    {(s.gradesBySubject || []).map((g) => (
                        <div key={g.subject} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600 }}>{g.subject}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{g.avg} <span style={{ fontSize: '0.7rem' }}>({g.min}–{g.max})</span></span>
                            </div>
                            <div className="mini-bar"><div style={{ width: `${g.avg}%`, background: subjectColor(g.subject) }} /></div>
                        </div>
                    ))}
                </div>

                {/* By class */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '14px' }}>{t.reports_extra.byClass}</h3>
                    {(s.gradesByClass || []).map((c) => {
                        const att = classAtt[c.class_name] || {};
                        const tot = Object.values(att).reduce((a, b) => a + b, 0) || 1;
                        return (
                            <div key={c.class_name} style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-hover)', marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <strong>{c.class_name}</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.students} {t.common.students.toLowerCase()} · {t.common_extra.average} <strong style={{ color: gradeColor(c.avg) }}>{c.avg}</strong></span>
                                </div>
                                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                                    {Object.keys(ATT_COLORS).map((st) => att[st] ? <div key={st} title={`${t.reports_extra[st]}: ${att[st]}`} style={{ width: `${(att[st] / tot) * 100}%`, background: ATT_COLORS[st] }} /> : null)}
                                </div>
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                        {Object.entries(ATT_COLORS).map(([st, c]) => <span key={st} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{t.reports_extra[st]}</span>)}
                    </div>
                </div>

                {/* Top students */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} color="#f59e0b" /> {t.reports_extra.topStudents}</h3>
                    {(s.topStudents || []).map((x, i) => (
                        <div key={x.student_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span style={{ width: 26, height: 26, borderRadius: 8, background: i === 0 ? '#fef3c7' : 'var(--bg-hover)', color: i === 0 ? '#d97706' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>{i + 1}</span>
                            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{x.full_name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{x.student_id} · {x.class_name}</div></div>
                            <strong style={{ color: gradeColor(x.avg) }}>{x.avg}</strong>
                        </div>
                    ))}
                </div>

                {/* At risk */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} color="#ef4444" /> {t.reports_extra.atRisk}</h3>
                    {!s.atRiskStudents?.length && <p style={{ color: 'var(--text-muted)' }}>{t.reports_extra.noRisk}</p>}
                    {(s.atRiskStudents || []).map((x) => (
                        <div key={x.student_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{x.full_name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{x.student_id} · {x.class_name}</div></div>
                            <span className="badge" style={{ background: `${gradeColor(x.avg)}20`, color: gradeColor(x.avg) }}>{t.common_extra.average} {x.avg}</span>
                            {x.attendance_rate != null && <span className="badge" style={{ background: `${gradeColor(x.attendance_rate)}20`, color: gradeColor(x.attendance_rate) }}>{x.attendance_rate}%</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

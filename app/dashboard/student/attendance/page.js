'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { api } from '@/lib/client';

const CFG = {
    present: { icon: CheckCircle2, color: '#22c55e' },
    absent: { icon: XCircle, color: '#ef4444' },
    late: { icon: Clock, color: '#f59e0b' },
    excused: { icon: AlertCircle, color: '#3b82f6' },
};

export default function StudentAttendance() {
    const { t, language, dir } = useLanguage();
    const [attendance, setAttendance] = useState(null);
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

    useEffect(() => { api('/api/attendance').then(setAttendance).catch(() => setAttendance([])); }, []);
    const byDate = useMemo(() => Object.fromEntries((attendance || []).map((a) => [a.date, a])), [attendance]);

    if (!attendance) return <div className="loading-page"><div className="spinner" /></div>;

    const totals = Object.keys(CFG).reduce((acc, s) => ({ ...acc, [s]: attendance.filter((a) => a.status === s).length }), {});
    const total = attendance.length;
    const rate = total ? Math.round((totals.present / total) * 100) : 0;

    // calendar grid
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // Monday first
    const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    const locale = language === 'ar' ? 'ar' : language === 'fr' ? 'fr-FR' : 'en-GB';
    const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => t.days[d].slice(0, 3));
    const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
    const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;

    return (
        <div className="animate-fade-in">
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardCheck size={20} color="#22c55e" /> {t.student_attendance.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.student_attendance.subtitle}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }} className="stagger">
                <div className="card animate-fade-in" style={{ padding: '18px', textAlign: 'center' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: `conic-gradient(${rate >= 80 ? '#22c55e' : rate >= 60 ? '#f59e0b' : '#ef4444'} ${rate * 3.6}deg, var(--bg-hover) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{rate}%</div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.common_extra.attendanceRate}</p>
                </div>
                {Object.entries(CFG).map(([s, c]) => {
                    const Icon = c.icon;
                    return (
                        <div key={s} className="card animate-fade-in" style={{ padding: '18px', textAlign: 'center' }}>
                            <Icon size={28} color={c.color} style={{ margin: '0 auto 6px' }} />
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{totals[s]}</div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.teacher_attendance[s]}</p>
                        </div>
                    );
                })}
            </div>

            <div className="two-col" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setMonth(new Date(y, m - 1, 1))}><Prev size={16} /></button>
                        <h4 style={{ textTransform: 'capitalize' }}>{monthLabel}</h4>
                        <button className="btn btn-outline btn-sm" onClick={() => setMonth(new Date(y, m + 1, 1))}><Next size={16} /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                        {dayNames.map((d) => <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>{d}</div>)}
                        {cells.map((d, i) => {
                            if (!d) return <div key={`e${i}`} />;
                            const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            const a = byDate[key];
                            const c = a ? CFG[a.status] : null;
                            return (
                                <div key={key} title={a ? `${key}: ${t.teacher_attendance[a.status]}` : key} style={{ aspectRatio: '1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, background: c ? `${c.color}22` : 'var(--bg-hover)', color: c ? c.color : 'var(--text-muted)', border: c ? `1px solid ${c.color}55` : '1px solid transparent' }}>{d}</div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        {Object.entries(CFG).map(([s, c]) => <span key={s} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />{t.teacher_attendance[s]}</span>)}
                    </div>
                </div>

                <div className="card">
                    <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                        <table>
                            <thead><tr><th>{t.common.date}</th><th>{t.common.status}</th><th>Notes</th></tr></thead>
                            <tbody>
                                {attendance.slice(0, 60).map((a) => {
                                    const c = CFG[a.status]; const Icon = c.icon;
                                    return (
                                        <tr key={a.id}>
                                            <td style={{ fontWeight: 500 }}>{new Date(a.date + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                                            <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.color, fontWeight: 600, fontSize: '0.85rem' }}><Icon size={15} /> {t.teacher_attendance[a.status]}</span></td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{a.notes || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

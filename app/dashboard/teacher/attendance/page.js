'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Save, Check, Download } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/components/Toast';
import { api, downloadCsv, today } from '@/lib/client';

const STATUSES = ['present', 'late', 'excused', 'absent'];
const COLORS = { present: '#22c55e', late: '#f59e0b', excused: '#3b82f6', absent: '#ef4444' };

export default function TeacherAttendance() {
    const { t } = useLanguage();
    const toast = useToast();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [date, setDate] = useState(today());
    const [cls, setCls] = useState('');
    const [attendance, setAttendance] = useState({});
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        Promise.all([api('/api/students'), api('/api/classes')]).then(([s, meta]) => { setStudents(s); setClasses(meta.classes); setLoading(false); }).catch((e) => toast.error(e.message));
    }, [toast]);

    const loadDay = useCallback(() => {
        api(`/api/attendance?date=${date}`).then((data) => {
            const att = {};
            data.forEach((a) => { att[a.student_id] = a.status; });
            setAttendance(att);
            setDirty(false);
        }).catch((e) => toast.error(e.message));
    }, [date, toast]);
    useEffect(() => { loadDay(); }, [loadDay]);

    // Last 7 days summary for the sidebar chart
    useEffect(() => {
        const from = new Date(); from.setDate(from.getDate() - 13);
        api(`/api/attendance?from=${from.toISOString().slice(0, 10)}&to=${today()}${cls ? `&class=${encodeURIComponent(cls)}` : ''}`).then(setHistory).catch(() => {});
    }, [cls, dirty]);

    const visible = useMemo(() => students.filter((s) => !cls || s.class_name === cls), [students, cls]);
    const set = (id, status) => { setAttendance((p) => ({ ...p, [id]: status })); setDirty(true); };
    const markAll = (status) => { const a = { ...attendance }; visible.forEach((s) => { a[s.id] = status; }); setAttendance(a); setDirty(true); };

    const save = async () => {
        const records = visible.filter((s) => attendance[s.id]).map((s) => ({ studentId: s.id, date, status: attendance[s.id] }));
        if (!records.length) return;
        setSaving(true);
        try {
            await api('/api/attendance', { method: 'POST', body: { records } });
            toast.success(t.common_extra.saved);
            setDirty(false);
        } catch (e) { toast.error(e.message); } finally { setSaving(false); }
    };

    const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: visible.filter((x) => attendance[x.id] === s).length }), {});
    const byDay = useMemo(() => {
        const m = {};
        history.forEach((a) => { m[a.date] = m[a.date] || { total: 0, present: 0 }; m[a.date].total++; if (a.status === 'present') m[a.date].present++; });
        return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).slice(-10);
    }, [history]);

    const exportCsv = () => downloadCsv(`attendance-${date}.csv`, visible.map((s) => ({ ...s, status: attendance[s.id] || '' })), [
        { key: 'student_id', label: 'ID' }, { key: 'full_name', label: t.dashboard.name }, { key: 'class_name', label: t.dashboard.class }, { key: 'status', label: date },
    ]);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardCheck size={20} color="#22c55e" /> {t.teacher_attendance.recordAttendance}</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: '160px' }} />
                    <select value={cls} onChange={(e) => setCls(e.target.value)} style={{ maxWidth: '150px' }}>
                        <option value="">{t.students_page.allClasses}</option>
                        {classes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <button className="btn btn-outline" onClick={() => markAll('present')}><Check size={16} /> {t.teacher_attendance.markAllPresent}</button>
                    <button className="btn btn-outline" onClick={exportCsv}><Download size={16} /></button>
                    <button className={`btn ${dirty ? 'btn-success' : 'btn-primary'}`} onClick={save} disabled={saving || !dirty}><Save size={16} /> {saving ? '...' : t.teacher_grades.saveChanges}</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {STATUSES.map((s) => (
                    <div key={s} className="card" style={{ padding: '12px 16px', borderTop: `3px solid ${COLORS[s]}` }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.teacher_attendance[s]}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: COLORS[s] }}>{counts[s]}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', gap: '20px' }} className="two-col">
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead><tr><th>{t.teacher_grades.student}</th><th>{t.dashboard.class}</th><th>{t.common.status}</th></tr></thead>
                            <tbody>
                                {visible.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name}<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{s.student_id}</div></td>
                                        <td>{s.class_name}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {STATUSES.map((st) => {
                                                    const active = attendance[s.id] === st;
                                                    return (
                                                        <button key={st} onClick={() => set(s.id, st)} className="chip" style={active ? { background: `${COLORS[st]}20`, color: COLORS[st], borderColor: COLORS[st] } : undefined}>
                                                            {t.teacher_attendance[st]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {visible.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t.common_extra.noData}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: '18px', alignSelf: 'start' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>{t.reports_extra.attendanceTrend}</h4>
                    {byDay.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.common_extra.noData}</p>}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
                        {byDay.map(([d, v]) => {
                            const pct = Math.round((v.present / v.total) * 100);
                            return (
                                <div key={d} title={`${d}: ${pct}%`} onClick={() => setDate(d)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                    <div style={{ width: '100%', height: `${pct}%`, minHeight: 4, background: d === date ? 'var(--primary-600)' : pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{d.slice(8)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

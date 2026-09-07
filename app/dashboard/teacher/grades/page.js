'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Save, Download, Pencil, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/components/Toast';
import { api, downloadCsv, gradeColor, gradeBadge } from '@/lib/client';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

export default function TeacherGrades() {
    const { t } = useLanguage();
    const toast = useToast();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [grades, setGrades] = useState([]);
    const [subject, setSubject] = useState('');
    const [term, setTerm] = useState('Term 1');
    const [cls, setCls] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [edits, setEdits] = useState({}); // studentId -> { grade, remarks }
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([api('/api/students'), api('/api/classes'), api('/api/auth/me')]).then(([s, meta, me]) => {
            setStudents(s);
            setClasses(meta.classes);
            setSubjects(meta.subjects);
            setSubject(meta.subjects.includes(me.subject) ? me.subject : meta.subjects[0] || '');
            setLoading(false);
        }).catch((e) => toast.error(e.message));
    }, [toast]);

    const loadGrades = useCallback(() => {
        if (!subject) return;
        api(`/api/grades?term=${encodeURIComponent(term)}&subject=${encodeURIComponent(subject)}`).then(setGrades).catch((e) => toast.error(e.message));
    }, [term, subject, toast]);
    useEffect(() => { loadGrades(); setEditMode(false); }, [loadGrades]);

    const visible = useMemo(() => students.filter((s) => !cls || s.class_name === cls), [students, cls]);
    const gradeOf = (sid) => grades.find((g) => g.student_id === sid);

    const startEdit = () => {
        const e = {};
        visible.forEach((s) => { const g = gradeOf(s.id); e[s.id] = { grade: g ? g.grade : '', remarks: g?.remarks || '' }; });
        setEdits(e);
        setEditMode(true);
    };

    const save = async () => {
        const payload = Object.entries(edits)
            .filter(([, v]) => v.grade !== '' && v.grade !== null)
            .map(([studentId, v]) => ({ studentId: Number(studentId), subject, term, grade: Number(v.grade), maxGrade: 100, remarks: v.remarks }));
        if (!payload.length) return setEditMode(false);
        if (payload.some((p) => p.grade < 0 || p.grade > 100 || Number.isNaN(p.grade))) return toast.error('0 – 100');
        setSaving(true);
        try {
            await api('/api/grades', { method: 'POST', body: { grades: payload } });
            toast.success(t.common_extra.saved);
            setEditMode(false);
            loadGrades();
        } catch (e) { toast.error(e.message); } finally { setSaving(false); }
    };

    const exportCsv = () => downloadCsv(`grades-${subject}-${term}.csv`, visible.map((s) => ({ ...s, grade: gradeOf(s.id)?.grade ?? '', remarks: gradeOf(s.id)?.remarks ?? '' })), [
        { key: 'student_id', label: 'ID' }, { key: 'full_name', label: t.dashboard.name }, { key: 'class_name', label: t.dashboard.class },
        { key: 'grade', label: `${subject} (${term})` }, { key: 'remarks', label: t.student_grades.remarks },
    ]);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    const graded = visible.map((s) => gradeOf(s.id)?.grade).filter((g) => g != null);
    const avg = graded.length ? Math.round(graded.reduce((a, b) => a + b, 0) / graded.length) : null;

    return (
        <div className="animate-fade-in">
            <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={20} color="#8b5cf6" /> {t.teacher_grades.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{graded.length}/{visible.length} · {t.common_extra.average}: <strong style={{ color: avg != null ? gradeColor(avg) : undefined }}>{avg ?? '—'}</strong></p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <select value={cls} onChange={(e) => setCls(e.target.value)} style={{ maxWidth: '150px' }} disabled={editMode}>
                        <option value="">{t.students_page.allClasses}</option>
                        {classes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ maxWidth: '160px' }} disabled={editMode}>
                        {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={term} onChange={(e) => setTerm(e.target.value)} style={{ maxWidth: '120px' }} disabled={editMode}>
                        {TERMS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                    {editMode ? (
                        <>
                            <button className="btn btn-outline" onClick={() => setEditMode(false)}><X size={16} /> {t.common_extra.cancel}</button>
                            <button className="btn btn-success" onClick={save} disabled={saving}><Save size={16} /> {saving ? '...' : t.teacher_grades.saveChanges}</button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-outline" onClick={exportCsv}><Download size={16} /> {t.common_extra.export}</button>
                            <button className="btn btn-primary" onClick={startEdit}><Pencil size={16} /> {t.common_extra.edit}</button>
                        </>
                    )}
                </div>
            </div>

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>{t.teacher_grades.student}</th>
                                <th>ID</th>
                                <th>{t.teacher_dashboard.classGroup}</th>
                                <th>{subject} — {t.teacher_grades.grade}</th>
                                <th>{t.student_grades.remarks}</th>
                                <th>{t.student_grades.status}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((s) => {
                                const g = gradeOf(s.id);
                                const val = editMode ? edits[s.id]?.grade : g?.grade;
                                const num = val === '' || val == null ? null : Number(val);
                                return (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name}</td>
                                        <td><span className="badge badge-primary">{s.student_id}</span></td>
                                        <td>{s.class_name}</td>
                                        <td>
                                            {editMode ? (
                                                <input type="number" min="0" max="100" step="0.5" value={edits[s.id]?.grade ?? ''} onChange={(e) => setEdits({ ...edits, [s.id]: { ...edits[s.id], grade: e.target.value } })} style={{ maxWidth: '90px', padding: '6px 10px' }} />
                                            ) : (
                                                <span style={{ fontWeight: 700, fontSize: '1rem', color: num != null ? gradeColor(num) : 'var(--text-muted)' }}>{num ?? '—'}</span>
                                            )}
                                        </td>
                                        <td>
                                            {editMode ? (
                                                <input value={edits[s.id]?.remarks ?? ''} maxLength={300} onChange={(e) => setEdits({ ...edits, [s.id]: { ...edits[s.id], remarks: e.target.value } })} style={{ padding: '6px 10px', minWidth: '160px' }} />
                                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{g?.remarks || '—'}</span>}
                                        </td>
                                        <td>{num != null && <span className={`badge ${gradeBadge(num)}`}>{num >= 80 ? t.student_dashboard.excellent : num >= 60 ? t.student_dashboard.good : t.student_dashboard.needsWork}</span>}</td>
                                    </tr>
                                );
                            })}
                            {visible.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t.common_extra.noData}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

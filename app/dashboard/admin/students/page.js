'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Edit3, Trash2, UserPlus, Download, KeyRound, Copy, Check, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api, downloadCsv, gradeColor } from '@/lib/client';

const EMPTY = { fullName: '', email: '', dateOfBirth: '', gender: '', phone: '', address: '', className: 'Class A', parentName: '', parentPhone: '' };

export default function AdminStudents() {
    const { t } = useLanguage();
    const toast = useToast();
    const router = useRouter();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editStudent, setEditStudent] = useState(null);
    const [newCreds, setNewCreds] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [customClass, setCustomClass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState(null); // { type: 'delete'|'reset', student }
    const [copied, setCopied] = useState(false);

    const fetchStudents = useCallback(() => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (classFilter) params.set('class', classFilter);
        api(`/api/students?${params}`).then(setStudents).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
    }, [search, classFilter, toast]);

    const fetchClasses = useCallback(() => api('/api/classes').then((d) => setClasses(d.classes)).catch(() => {}), []);

    useEffect(() => { const id = setTimeout(fetchStudents, search ? 250 : 0); return () => clearTimeout(id); }, [fetchStudents, search]);
    useEffect(() => { fetchClasses(); }, [fetchClasses]);

    const openAdd = () => {
        setEditStudent(null);
        setForm({ ...EMPTY, className: classes[0]?.name || 'Class A' });
        setNewCreds(null);
        setCustomClass(false);
        setShowModal(true);
    };

    const openEdit = (s) => {
        setEditStudent(s);
        setForm({
            fullName: s.full_name, email: s.email || '', dateOfBirth: s.date_of_birth || '',
            gender: s.gender || '', phone: s.phone || '', address: s.address || '',
            className: s.class_name || 'Class A', parentName: s.parent_name || '', parentPhone: s.parent_phone || '',
        });
        setNewCreds(null);
        setCustomClass(false);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editStudent) {
                await api(`/api/students/${editStudent.id}`, { method: 'PUT', body: form });
                toast.success(t.common_extra.saved);
                setShowModal(false);
            } else {
                const data = await api('/api/students', { method: 'POST', body: form });
                setNewCreds(data.student);
            }
            fetchStudents();
            fetchClasses();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const runConfirm = async () => {
        const { type, student } = confirm;
        setConfirm(null);
        try {
            if (type === 'delete') {
                await api(`/api/students/${student.id}`, { method: 'DELETE' });
                toast.success(t.common_extra.saved);
                fetchStudents();
            } else {
                const data = await api(`/api/students/${student.id}`, { method: 'POST', body: { action: 'reset-password' } });
                setEditStudent(null);
                setNewCreds({ fullName: student.full_name, studentId: student.student_id, username: student.username, password: data.password });
                setShowModal(true);
            }
        } catch (err) {
            toast.error(err.message);
        }
    };

    const copyCreds = async () => {
        try {
            await navigator.clipboard.writeText(`${t.login.username}: ${newCreds.username}\n${t.login.password}: ${newCreds.password}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };

    const exportCsv = () => downloadCsv('students.csv', students, [
        { key: 'student_id', label: 'ID' }, { key: 'full_name', label: t.dashboard.name }, { key: 'username', label: t.login.username },
        { key: 'email', label: 'Email' }, { key: 'class_name', label: t.dashboard.class }, { key: 'gender', label: 'Gender' },
        { key: 'date_of_birth', label: 'Birth date' }, { key: 'phone', label: 'Phone' }, { key: 'parent_name', label: 'Parent' },
        { key: 'parent_phone', label: 'Parent phone' }, { key: 'average', label: t.common_extra.average }, { key: 'attendance_rate', label: t.common_extra.attendanceRate + ' %' },
    ]);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>{t.students_page.title}</h1>
                    <p>{t.students_page.subtitle} · {students.length}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={exportCsv} disabled={!students.length}><Download size={18} /> {t.common_extra.export}</button>
                    <button className="btn btn-primary" onClick={openAdd}><UserPlus size={18} /> {t.students_page.addStudent}</button>
                </div>
            </div>

            <div className="card" style={styles.filtersCard}>
                <div style={styles.searchBox}>
                    <Search size={18} color="var(--text-muted)" />
                    <input type="text" placeholder={t.common.search} style={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select style={{ maxWidth: '200px' }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="">{t.students_page.allClasses}</option>
                    {classes.map(c => <option key={c.name} value={c.name}>{c.name} ({c.students})</option>)}
                </select>
            </div>

            <div className="card table-container">
                <table>
                    <thead>
                        <tr>
                            <th>{t.students_page.tableStudent}</th>
                            <th>{t.dashboard.id}</th>
                            <th>{t.students_page.tableClass}</th>
                            <th>{t.common_extra.average}</th>
                            <th>{t.common_extra.attendanceRate}</th>
                            <th style={{ textAlign: 'end' }}>{t.common.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student) => (
                            <tr key={student.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={styles.avatar}>{(student.full_name || 'U')[0].toUpperCase()}</div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.full_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.email || student.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><span className="badge badge-primary">{student.student_id}</span></td>
                                <td>{student.class_name || '—'}</td>
                                <td style={{ fontWeight: 700, color: student.average != null ? gradeColor(student.average) : 'var(--text-muted)' }}>{student.average ?? '—'}</td>
                                <td>
                                    {student.attendance_rate != null ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px' }}>
                                            <div className="mini-bar" style={{ flex: 1 }}><div style={{ width: `${student.attendance_rate}%`, background: gradeColor(student.attendance_rate) }} /></div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{student.attendance_rate}%</span>
                                        </div>
                                    ) : '—'}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                        <button style={styles.iconBtn} onClick={() => router.push(`/dashboard/admin/students/${student.id}`)} title={t.students_page.viewProfile}><Eye size={16} /></button>
                                        <button style={styles.iconBtn} onClick={() => openEdit(student)} title={t.students_page.edit}><Edit3 size={16} /></button>
                                        <button style={styles.iconBtn} onClick={() => setConfirm({ type: 'reset', student })} title={t.common_extra.resetPassword}><KeyRound size={16} /></button>
                                        <button style={{ ...styles.iconBtn, color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => setConfirm({ type: 'delete', student })} title={t.common_extra.delete}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {students.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t.common_extra.noData}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal open={showModal} onClose={() => setShowModal(false)} title={newCreds ? (editStudent ? t.students_page.edit : t.students_page.addStudent) : editStudent ? t.students_page.edit : t.students_page.addStudent}>
                {newCreds ? (
                    <div className="modal-body" style={{ textAlign: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <KeyRound size={28} color="white" />
                        </div>
                        <h3 style={{ marginBottom: '4px' }}>{newCreds.fullName}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>{t.common_extra.newPassword}</p>
                        <div style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '16px', textAlign: 'start', display: 'grid', gap: '10px' }}>
                            {newCreds.studentId && <div><span style={styles.credLabel}>ID</span><br /><strong>{newCreds.studentId}</strong></div>}
                            <div><span style={styles.credLabel}>{t.login.username}</span><br /><strong style={{ fontFamily: 'monospace' }}>{newCreds.username}</strong></div>
                            <div><span style={styles.credLabel}>{t.login.password}</span><br /><strong style={{ fontFamily: 'monospace', color: '#ef4444', fontSize: '1.1rem' }}>{newCreds.password}</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={copyCreds}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t.common_extra.copied : t.common_extra.copy}</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>{t.common_extra.close}</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>{t.dashboard.name} *</label>
                                <input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth</label>
                                    <input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Gender</label>
                                    <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                        <option value="">—</option>
                                        <option>Male</option>
                                        <option>Female</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t.dashboard.class}</label>
                                    {customClass ? (
                                        <input autoFocus placeholder="Class C" value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
                                    ) : (
                                        <select value={form.className} onChange={e => { if (e.target.value === '__new') { setCustomClass(true); setForm({ ...form, className: '' }); } else setForm({ ...form, className: e.target.value }); }}>
                                            {!classes.some(c => c.name === form.className) && form.className && <option>{form.className}</option>}
                                            {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                            <option value="__new">+ {t.schedule_admin.newClass}</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Parent</label>
                                    <input value={form.parentName} onChange={e => setForm({ ...form, parentName: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Parent phone</label>
                                    <input value={form.parentPhone} onChange={e => setForm({ ...form, parentPhone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Address</label>
                                    <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{t.common_extra.cancel}</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : t.common_extra.save}</button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmDialog
                open={!!confirm}
                danger={confirm?.type === 'delete'}
                title={confirm?.type === 'delete' ? t.common_extra.deleteConfirmTitle : t.common_extra.resetPassword}
                message={confirm ? `${confirm.student.full_name} — ${confirm.type === 'delete' ? t.common_extra.deleteConfirmMsg : ''}` : ''}
                confirmLabel={t.common_extra.confirm}
                cancelLabel={t.common_extra.cancel}
                onConfirm={runConfirm}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

const styles = {
    filtersCard: { padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', alignItems: 'center' },
    searchBox: { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: '10px', flex: '1 1 260px', border: '1px solid var(--border-color)' },
    searchInput: { border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-primary)', fontSize: '0.9rem', padding: 0, boxShadow: 'none' },
    avatar: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
    iconBtn: { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' },
    credLabel: { fontSize: '0.75rem', color: 'var(--text-muted)' },
};

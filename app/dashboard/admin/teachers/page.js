'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Edit3, Trash2, UserPlus, Download, KeyRound, ShieldOff, ShieldCheck, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api, downloadCsv } from '@/lib/client';

const EMPTY = { fullName: '', email: '', subject: '', department: 'General', phone: '' };

export default function AdminTeachers() {
    const { t } = useLanguage();
    const toast = useToast();
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dept, setDept] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editTeacher, setEditTeacher] = useState(null);
    const [newCreds, setNewCreds] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [copied, setCopied] = useState(false);

    const fetchTeachers = useCallback(() => {
        api('/api/teachers').then((res) => {
            const data = res.data ? res.data : res;
            setTeachers(Array.isArray(data) ? data : []);
        }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
    }, [toast]);
    useEffect(() => { fetchTeachers(); api('/api/classes').then((d) => setSubjects(d.subjects)).catch(() => {}); }, [fetchTeachers]);

    const openAdd = () => { setEditTeacher(null); setForm(EMPTY); setNewCreds(null); setShowModal(true); };
    const openEdit = (x) => { setEditTeacher(x); setForm({ fullName: x.full_name, email: x.email || '', subject: x.subject || '', department: x.department || 'General', phone: x.phone || '' }); setNewCreds(null); setShowModal(true); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editTeacher) {
                await api(`/api/teachers/${editTeacher.id}`, { method: 'PUT', body: form });
                toast.success(t.common_extra.saved);
                setShowModal(false);
            } else {
                const data = await api('/api/teachers', { method: 'POST', body: form });
                setNewCreds(data.teacher);
            }
            fetchTeachers();
        } catch (err) { toast.error(err.message); } finally { setSaving(false); }
    };

    const runConfirm = async () => {
        const { type, teacher } = confirm;
        setConfirm(null);
        try {
            if (type === 'delete') {
                await api(`/api/teachers/${teacher.id}`, { method: 'DELETE' });
                toast.success(t.common_extra.saved);
            } else if (type === 'reset') {
                const data = await api(`/api/teachers/${teacher.id}`, { method: 'POST', body: { action: 'reset-password' } });
                setEditTeacher(null);
                setNewCreds({ fullName: teacher.full_name, teacherId: teacher.teacher_id, username: teacher.username, password: data.password });
                setShowModal(true);
            } else if (type === 'reset2fa') {
                await api(`/api/teachers/${teacher.id}`, { method: 'POST', body: { action: 'reset-2fa' } });
                toast.success(t.common_extra.saved);
            }
            fetchTeachers();
        } catch (err) { toast.error(err.message); }
    };

    const copyCreds = async () => {
        try {
            await navigator.clipboard.writeText(`${t.login.username}: ${newCreds.username}\n${t.login.password}: ${newCreds.password}`);
            setCopied(true); setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
    };

    const departments = [...new Set(teachers.map((x) => x.department).filter(Boolean))];
    const filtered = teachers.filter((x) =>
        (!dept || x.department === dept) &&
        (!search || `${x.full_name} ${x.subject} ${x.email} ${x.teacher_id} ${x.username}`.toLowerCase().includes(search.toLowerCase()))
    );

    const exportCsv = () => downloadCsv('teachers.csv', filtered, [
        { key: 'teacher_id', label: 'ID' }, { key: 'full_name', label: t.dashboard.name }, { key: 'username', label: t.login.username },
        { key: 'email', label: 'Email' }, { key: 'subject', label: t.dashboard.subject }, { key: 'department', label: t.teachers_page.tableDepartment },
        { key: 'phone', label: 'Phone' }, { key: 'class_count', label: t.teachers_page.tableClasses },
    ]);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>{t.teachers_page.title}</h1>
                    <p>{t.teachers_page.subtitle} · {teachers.length}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={exportCsv} disabled={!filtered.length}><Download size={18} /> {t.common_extra.export}</button>
                    <button className="btn btn-primary" onClick={openAdd}><UserPlus size={18} /> {t.teachers_page.addTeacher}</button>
                </div>
            </div>

            <div className="card" style={styles.filtersCard}>
                <div style={styles.searchBox}>
                    <Search size={18} color="var(--text-muted)" />
                    <input type="text" placeholder={t.common.search} style={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select style={{ maxWidth: '200px' }} value={dept} onChange={(e) => setDept(e.target.value)}>
                    <option value="">{t.teachers_page.allDepartments}</option>
                    {departments.map((d) => <option key={d}>{d}</option>)}
                </select>
            </div>

            <div className="card table-container">
                <table>
                    <thead>
                        <tr>
                            <th>{t.teachers_page.tableTeacher}</th>
                            <th>{t.dashboard.id}</th>
                            <th>{t.dashboard.subject}</th>
                            <th>{t.teachers_page.tableDepartment}</th>
                            <th>{t.teachers_page.tableClasses}</th>
                            <th>2FA</th>
                            <th style={{ textAlign: 'end' }}>{t.common.actions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((x) => (
                            <tr key={x.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={styles.avatar}>{(x.full_name || 'T')[0].toUpperCase()}</div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{x.full_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{x.email || x.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><span className="badge badge-purple">{x.teacher_id}</span></td>
                                <td>{x.subject}</td>
                                <td>{x.department}</td>
                                <td>{x.class_count}</td>
                                <td>{x.has_2fa ? <ShieldCheck size={18} color="#22c55e" /> : <ShieldOff size={18} color="var(--text-muted)" />}</td>
                                <td>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                        <button style={styles.iconBtn} onClick={() => openEdit(x)} title={t.common_extra.edit}><Edit3 size={16} /></button>
                                        <button style={styles.iconBtn} onClick={() => setConfirm({ type: 'reset', teacher: x })} title={t.common_extra.resetPassword}><KeyRound size={16} /></button>
                                        {x.has_2fa ? <button style={styles.iconBtn} onClick={() => setConfirm({ type: 'reset2fa', teacher: x })} title={t.common_extra.reset2fa}><ShieldOff size={16} /></button> : null}
                                        <button style={{ ...styles.iconBtn, color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => setConfirm({ type: 'delete', teacher: x })} title={t.common_extra.delete}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t.common_extra.noData}</td></tr>}
                    </tbody>
                </table>
            </div>

            <Modal open={showModal} onClose={() => setShowModal(false)} title={editTeacher ? t.common_extra.edit : t.teachers_page.addTeacher}>
                {newCreds ? (
                    <div className="modal-body" style={{ textAlign: 'center' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <KeyRound size={28} color="white" />
                        </div>
                        <h3 style={{ marginBottom: '4px' }}>{newCreds.fullName}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>{t.common_extra.newPassword}</p>
                        <div style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '16px', textAlign: 'start', display: 'grid', gap: '10px' }}>
                            {newCreds.teacherId && <div><span style={styles.credLabel}>ID</span><br /><strong>{newCreds.teacherId}</strong></div>}
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
                                <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t.dashboard.subject} *</label>
                                    <input required list="subjects" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                                    <datalist id="subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
                                </div>
                                <div className="form-group">
                                    <label>{t.teachers_page.tableDepartment}</label>
                                    <input list="departments" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                                    <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                title={confirm?.type === 'delete' ? t.common_extra.deleteConfirmTitle : confirm?.type === 'reset2fa' ? t.common_extra.reset2fa : t.common_extra.resetPassword}
                message={confirm ? `${confirm.teacher.full_name}${confirm.type === 'delete' ? ' — ' + t.common_extra.deleteConfirmMsg : ''}` : ''}
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
    avatar: { width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
    iconBtn: { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' },
    credLabel: { fontSize: '0.75rem', color: 'var(--text-muted)' },
};

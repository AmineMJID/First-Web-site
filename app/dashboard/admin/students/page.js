'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Edit3, Trash2, UserPlus, Download, KeyRound, Eye, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api, downloadCsv, gradeColor } from '@/lib/client';
import { SkeletonTable } from '@/components/Skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Pagination from '@/components/Pagination';
import PasswordReveal from '@/components/PasswordReveal';

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
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editStudent, setEditStudent] = useState(null);
    const [newCreds, setNewCreds] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [customClass, setCustomClass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState(null);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (classFilter) params.set('class', classFilter);
            params.set('page', String(page));
            params.set('limit', '20');
            const res = await api(`/api/students?${params}`);
            // Handle both paginated and old array response
            if (res.data && res.pagination) {
                setStudents(res.data);
                setPagination(res.pagination);
            } else if (Array.isArray(res)) {
                setStudents(res);
                setPagination(null);
            } else {
                setStudents(res.data || []);
                setPagination(res.pagination || null);
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, [search, classFilter, page, toast]);

    const fetchClasses = useCallback(() => api('/api/classes').then((d) => setClasses(d.classes)).catch(() => {}), []);

    useEffect(() => { const id = setTimeout(() => { setPage(1); fetchStudents(); }, search ? 300 : 0); return () => clearTimeout(id); }, [search, classFilter]);
    useEffect(() => { fetchStudents(); }, [page]);
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
                toast.success('Étudiant archivé (soft-delete)');
                fetchStudents();
            } else {
                const data = await api(`/api/students/${student.id}`, { method: 'POST', body: { action: 'reset-password' } });
                setEditStudent(null);
                setNewCreds({ fullName: student.full_name, studentId: student.student_id, username: student.username, password: data.password, warning: data._warning });
                setShowModal(true);
            }
        } catch (err) {
            toast.error(err.message);
        }
    };

    const exportCsv = () => downloadCsv('students.csv', students, [
        { key: 'student_id', label: 'ID' }, { key: 'full_name', label: t.dashboard.name }, { key: 'username', label: t.login.username },
        { key: 'email', label: 'Email' }, { key: 'class_name', label: t.dashboard.class }, { key: 'gender', label: 'Gender' },
        { key: 'date_of_birth', label: 'Birth date' }, { key: 'phone', label: 'Phone' }, { key: 'parent_name', label: 'Parent' },
        { key: 'parent_phone', label: 'Parent phone' }, { key: 'average', label: t.common_extra.average }, { key: 'attendance_rate', label: t.common_extra.attendanceRate + ' %' },
    ]);

    return (
        <ErrorBoundary>
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1>{t.students_page.title}</h1>
                    <p>{t.students_page.subtitle} {pagination ? `· ${pagination.total} total` : `· ${students.length}`}</p>
                    <div className="security-badge" style={{ marginTop: '6px' }}><ShieldCheck size={12} /> Soft-delete + Audit Log + Pagination</div>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-outline" onClick={exportCsv} disabled={!students.length}><Download size={18} /> {t.common_extra.export}</button>
                    <button className="btn btn-primary" onClick={openAdd}><UserPlus size={18} /> {t.students_page.addStudent}</button>
                </div>
            </div>

            <div className="card filters-card">
                <div className="search-box">
                    <Search size={18} color="var(--text-muted)" />
                    <input type="text" placeholder={t.common.search} className="search-input" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select style={{ maxWidth: '200px' }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="">{t.students_page.allClasses}</option>
                    {classes.map(c => <option key={c.name} value={c.name}>{c.name} ({c.students})</option>)}
                </select>
            </div>

            {loading ? <SkeletonTable rows={8} cols={6} /> : (
            <>
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
                                    <div className="flex items-center gap-3">
                                        <div className="avatar">{(student.full_name || 'U')[0].toUpperCase()}</div>
                                        <div>
                                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{student.full_name}</div>
                                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{student.email || student.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><span className="badge badge-primary">{student.student_id}</span></td>
                                <td>{student.class_name || '—'}</td>
                                <td style={{ fontWeight: 700, color: student.average != null ? gradeColor(student.average) : 'var(--text-muted)' }}>{student.average ?? '—'}</td>
                                <td>
                                    {student.attendance_rate != null ? (
                                        <div className="flex items-center gap-2" style={{ minWidth: '110px' }}>
                                            <div className="mini-bar" style={{ flex: 1 }}><div style={{ width: `${student.attendance_rate}%`, background: gradeColor(student.attendance_rate) }} /></div>
                                            <span className="text-xs font-semibold">{student.attendance_rate}%</span>
                                        </div>
                                    ) : '—'}
                                </td>
                                <td>
                                    <div className="table-actions">
                                        <button className="icon-btn" onClick={() => router.push(`/dashboard/admin/students/${student.id}`)} title={t.students_page.viewProfile}><Eye size={16} /></button>
                                        <button className="icon-btn" onClick={() => openEdit(student)} title={t.students_page.edit}><Edit3 size={16} /></button>
                                        <button className="icon-btn" onClick={() => setConfirm({ type: 'reset', student })} title={t.common_extra.resetPassword}><KeyRound size={16} /></button>
                                        <button className="icon-btn icon-btn-danger" onClick={() => setConfirm({ type: 'delete', student })} title={t.common_extra.delete}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {students.length === 0 && (
                            <tr><td colSpan={6} className="table-empty">{t.common_extra.noData}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
            </>
            )}

            <Modal open={showModal} onClose={() => setShowModal(false)} title={newCreds ? 'Identifiants sécurisés' : editStudent ? t.students_page.edit : t.students_page.addStudent}>
                {newCreds ? (
                    <div className="modal-body">
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <KeyRound size={28} color="white" />
                        </div>
                        <h3 style={{ textAlign: 'center', marginBottom: '4px' }}>{newCreds.fullName}</h3>
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Mot de passe à usage unique</p>
                        <PasswordReveal 
                            username={newCreds.username} 
                            password={newCreds.password} 
                            studentId={newCreds.studentId}
                            warning={newCreds._warning}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Fermer</button>
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
                title={confirm?.type === 'delete' ? 'Archiver (soft-delete)' : t.common_extra.resetPassword}
                message={confirm ? `${confirm.student.full_name} — ${confirm.type === 'delete' ? 'L\'étudiant sera archivé, pas supprimé définitivement. Il pourra être restauré via audit log.' : 'Un nouveau mot de passe temporaire sera généré (affiché une seule fois).'}` : ''}
                confirmLabel={t.common_extra.confirm}
                cancelLabel={t.common_extra.cancel}
                onConfirm={runConfirm}
                onCancel={() => setConfirm(null)}
            />
        </div>
        </ErrorBoundary>
    );
}

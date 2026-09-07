'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import Timetable from '@/components/Timetable';
import { api } from '@/lib/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY = { className: '', subject: '', teacherId: '', dayOfWeek: 'Monday', startTime: '08:00', endTime: '09:30', room: '' };

export default function AdminSchedule() {
    const { t } = useLanguage();
    const toast = useToast();
    const [slots, setSlots] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [cls, setCls] = useState('');
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | { slot? }
    const [form, setForm] = useState(EMPTY);
    const [customClass, setCustomClass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState(null);

    const load = useCallback(async () => {
        try {
            const [sc, meta, te] = await Promise.all([api('/api/schedule'), api('/api/classes'), api('/api/teachers')]);
            setSlots(sc);
            setClasses(meta.classes);
            setSubjects(meta.subjects);
            setTeachers(te);
            setCls((c) => c || meta.classes[0]?.name || '');
        } catch (e) { toast.error(e.message); } finally { setLoading(false); }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const openAdd = () => { setForm({ ...EMPTY, className: cls }); setCustomClass(false); setModal({}); };
    const openEdit = (s) => {
        setForm({ className: s.class_name, subject: s.subject, teacherId: s.teacher_id || '', dayOfWeek: s.day_of_week, startTime: s.start_time, endTime: s.end_time, room: s.room || '' });
        setCustomClass(false);
        setModal({ slot: s });
    };

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal.slot) await api(`/api/schedule/${modal.slot.id}`, { method: 'PUT', body: form });
            else await api('/api/schedule', { method: 'POST', body: form });
            toast.success(t.common_extra.saved);
            setModal(null);
            if (form.className && form.className !== cls) setCls(form.className);
            load();
        } catch (err) { toast.error(err.message); } finally { setSaving(false); }
    };

    const remove = async () => {
        const s = toDelete; setToDelete(null);
        try { await api(`/api/schedule/${s.id}`, { method: 'DELETE' }); toast.success(t.common_extra.saved); load(); }
        catch (err) { toast.error(err.message); }
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;
    const visible = slots.filter((s) => s.class_name === cls);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>{t.schedule_admin.title}</h1>
                    <p>{t.schedule_admin.subtitle}</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t.schedule_admin.addSlot}</button>
            </div>

            <div className="card" style={{ padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Calendar size={18} color="var(--text-muted)" />
                {classes.map((c) => (
                    <button key={c.name} className={`chip ${cls === c.name ? 'active' : ''}`} onClick={() => setCls(c.name)}>{c.name} <span style={{ opacity: 0.6 }}>({slots.filter((s) => s.class_name === c.name).length})</span></button>
                ))}
            </div>

            <div className="card" style={{ padding: '16px' }}>
                <Timetable slots={visible} onEdit={openEdit} onDelete={setToDelete} />
            </div>

            <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.slot ? t.schedule_admin.editSlot : t.schedule_admin.addSlot}>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t.schedule_admin.class} *</label>
                                {customClass ? (
                                    <input autoFocus required value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
                                ) : (
                                    <select required value={form.className} onChange={(e) => { if (e.target.value === '__new') { setCustomClass(true); setForm({ ...form, className: '' }); } else setForm({ ...form, className: e.target.value }); }}>
                                        {classes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        <option value="__new">+ {t.schedule_admin.newClass}</option>
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label>{t.schedule_admin.subject} *</label>
                                <input required list="subj" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                                <datalist id="subj">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t.schedule_admin.teacher}</label>
                                <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                                    <option value="">{t.schedule_admin.noTeacher}</option>
                                    {teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name} ({x.subject})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t.schedule_admin.day}</label>
                                <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
                                    {DAYS.map((d) => <option key={d} value={d}>{t.days[d]}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t.schedule_admin.start}</label>
                                <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>{t.schedule_admin.end}</label>
                                <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t.schedule_admin.room}</label>
                            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>{t.common_extra.cancel}</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : t.common_extra.save}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog open={!!toDelete} danger title={t.common_extra.deleteConfirmTitle} message={toDelete ? `${toDelete.subject} · ${t.days[toDelete.day_of_week]} ${toDelete.start_time}` : ''} confirmLabel={t.common_extra.delete} cancelLabel={t.common_extra.cancel} onConfirm={remove} onCancel={() => setToDelete(null)} />
        </div>
    );
}

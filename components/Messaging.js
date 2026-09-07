'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, MessageSquare, Mail, MailOpen, Megaphone, Trash2, Users, GraduationCap, Layers, Search, Reply } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';
import { useUser } from '@/app/dashboard/layout';
import { api } from '@/lib/client';

function formatDate(s, lang) {
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
    return d.toLocaleString(lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

// role: 'admin' | 'teacher' | 'student'
export default function Messaging({ role }) {
    const { t, language } = useLanguage();
    const toast = useToast();
    const { refreshUser } = useUser();
    const canSend = role !== 'student';

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [box, setBox] = useState('inbox');
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [toDelete, setToDelete] = useState(null);

    // compose
    const [compose, setCompose] = useState(false);
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [target, setTarget] = useState('all_students');
    const [selStudents, setSelStudents] = useState([]);
    const [selTeachers, setSelTeachers] = useState([]);
    const [selClasses, setSelClasses] = useState([]);
    const [form, setForm] = useState({ subject: '', messageBody: '' });
    const [picker, setPicker] = useState(null); // 'students' | 'teachers' | 'classes'
    const [pickerSearch, setPickerSearch] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(() => api('/api/messages').then((m) => { setMessages(m); setLoading(false); }).catch((e) => toast.error(e.message)), [toast]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!canSend) return;
        api('/api/students').then(setStudents).catch(() => {});
        api('/api/classes').then((d) => setClasses(d.classes)).catch(() => {});
        if (role === 'admin') api('/api/teachers').then(setTeachers).catch(() => {});
    }, [canSend, role]);

    const inbox = useMemo(() => messages.filter((m) => !m.is_sent), [messages]);
    const sent = useMemo(() => messages.filter((m) => m.is_sent), [messages]);
    const list = (box === 'inbox' ? inbox : sent).filter((m) => !search || `${m.subject} ${m.body} ${m.sender_name}`.toLowerCase().includes(search.toLowerCase()));
    const unread = inbox.filter((m) => !m.is_read).length;

    const open = async (m) => {
        setSelected(m);
        if (!m.is_sent && !m.is_read) {
            try {
                await api(`/api/messages/${m.id}`, { method: 'PUT' });
                setMessages((prev) => prev.map((x) => (x.id === m.id && !x.is_sent ? { ...x, is_read: 1 } : x)));
                refreshUser();
            } catch { /* ignore */ }
        }
    };

    const remove = async () => {
        const m = toDelete; setToDelete(null);
        try {
            await api(`/api/messages/${m.id}`, { method: 'DELETE' });
            if (selected?.id === m.id) setSelected(null);
            toast.success(t.common_extra.saved);
            load();
        } catch (e) { toast.error(e.message); }
    };

    const resetCompose = () => { setForm({ subject: '', messageBody: '' }); setSelStudents([]); setSelTeachers([]); setSelClasses([]); setTarget(role === 'admin' ? 'all_students' : 'all_students'); };

    const startReply = (m) => {
        resetCompose();
        setTarget('custom');
        if (m.sender_role === 'student') setSelStudents([m.sender_id]);
        else setSelTeachers([m.sender_id]);
        setForm({ subject: `Re: ${m.subject}`, messageBody: '' });
        setCompose(true);
    };

    const send = async (e) => {
        e.preventDefault();
        const payload = { subject: form.subject, messageBody: form.messageBody };
        if (target === 'all_students') { payload.isAnnouncement = true; payload.recipientRole = 'student'; }
        else if (target === 'all_teachers') { payload.isAnnouncement = true; payload.recipientRole = 'teacher'; }
        else {
            payload.isAnnouncement = false;
            payload.recipientIds = [...selStudents, ...selTeachers];
            payload.recipientClasses = selClasses;
            if (!payload.recipientIds.length && !payload.recipientClasses.length) return toast.error(t.messages_extra.selectAtLeastOne);
        }
        setSending(true);
        try {
            const r = await api('/api/messages', { method: 'POST', body: payload });
            toast.success(`${t.messages_extra.sentSuccess} (${r.count})`);
            setCompose(false);
            resetCompose();
            setBox('sent');
            load();
        } catch (err) { toast.error(err.message); } finally { setSending(false); }
    };

    const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    const recipientSummary = () => {
        const parts = [];
        if (selClasses.length) parts.push(`${selClasses.length} ${t.messages_extra.classes.toLowerCase()}`);
        if (selStudents.length) parts.push(`${selStudents.length} ${t.common.students.toLowerCase()}`);
        if (selTeachers.length) parts.push(`${selTeachers.length} ${t.common.teachers.toLowerCase()}`);
        return parts.join(' · ') || t.messages_page.selectRecipients;
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="animate-fade-in">
            <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={20} color="#3b82f6" /> {t.messages_page.title}
                    {unread > 0 && <span className="badge badge-danger">{unread} {t.common_extra.unread}</span>}
                </h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="tabs">
                        <button className={`tab ${box === 'inbox' ? 'active' : ''}`} onClick={() => { setBox('inbox'); setSelected(null); }}>{t.messages_extra.inbox} ({inbox.length})</button>
                        <button className={`tab ${box === 'sent' ? 'active' : ''}`} onClick={() => { setBox('sent'); setSelected(null); }}>{t.messages_extra.sent} ({sent.length})</button>
                    </div>
                    {canSend && <button className="btn btn-primary" onClick={() => { resetCompose(); setCompose(true); }}><Send size={16} /> {t.messages_page.newMessage}</button>}
                </div>
            </div>

            <div className="two-col" style={{ gridTemplateColumns: selected ? undefined : '1fr' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input placeholder={t.common.search} value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
                    </div>
                    {list.length === 0 && <div className="card empty-state" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>{t.messages_extra.noMessages}</div>}
                    {list.map((m) => {
                        const isSel = selected?.id === m.id && selected?.is_sent === m.is_sent;
                        return (
                            <div key={`${m.is_sent}-${m.id}`} className="card" onClick={() => open(m)} style={{ padding: '14px 18px', cursor: 'pointer', borderInlineStart: `3px solid ${m.is_sent ? 'transparent' : m.is_read ? 'transparent' : '#3b82f6'}`, background: isSel ? 'var(--primary-50)' : 'var(--bg-card)', opacity: !m.is_sent && m.is_read && !isSel ? 0.75 : 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    {m.is_announcement ? <Megaphone size={15} color="#f59e0b" /> : m.is_read || m.is_sent ? <MailOpen size={15} color="var(--text-muted)" /> : <Mail size={15} color="#3b82f6" />}
                                    <span style={{ fontWeight: m.is_read || m.is_sent ? 500 : 700, fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(m.created_at, language)}</span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <span>{m.is_sent ? `${t.messages_extra.to}: ${m.is_announcement ? (m.recipient_role === 'student' ? t.messages_extra.allStudents : t.messages_extra.allTeachers) : `${m.recipient_count} ${t.messages_extra.recipients}`}` : `${t.messages_extra.from}: ${m.sender_name}`}</span>
                                    {m.is_sent && !m.is_announcement && <span>{m.read_count}/{m.recipient_count} {t.messages_extra.read}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {selected && (
                    <div className="card" style={{ padding: '24px', alignSelf: 'start', position: 'sticky', top: '80px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: '14px' }}>
                            <div>
                                <h3 style={{ marginBottom: 4 }}>{selected.subject}</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {selected.is_sent ? `${t.messages_extra.to}: ${selected.is_announcement ? (selected.recipient_role === 'student' ? t.messages_extra.allStudents : t.messages_extra.allTeachers) : selected.recipients.slice(0, 5).join(', ') + (selected.recipients.length > 5 ? ` +${selected.recipients.length - 5}` : '')}` : `${t.messages_extra.from}: ${selected.sender_name} (${selected.sender_role})`}
                                    {' · '}{formatDate(selected.created_at, language)}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {canSend && !selected.is_sent && !selected.is_announcement && <button className="btn btn-outline btn-sm" onClick={() => startReply(selected)} title={t.messages_extra.reply}><Reply size={14} /></button>}
                                {(role === 'admin' || selected.is_sent || !selected.is_announcement) && <button className="btn btn-outline btn-sm" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => setToDelete(selected)} title={t.messages_extra.delete}><Trash2 size={14} /></button>}
                            </div>
                        </div>
                        {selected.is_announcement === 1 && <span className="badge badge-warning" style={{ marginBottom: 12 }}>{t.messages_extra.announcement}</span>}
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{selected.body}</p>
                    </div>
                )}
            </div>

            {/* Compose */}
            <Modal open={compose} onClose={() => setCompose(false)} title={t.messages_page.newMessage} width="640px">
                <form onSubmit={send}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>{t.messages_page.to}</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" className={`chip ${target === 'all_students' ? 'active' : ''}`} onClick={() => setTarget('all_students')}><Users size={14} /> {t.messages_extra.allStudents}</button>
                                {role === 'admin' && <button type="button" className={`chip ${target === 'all_teachers' ? 'active' : ''}`} onClick={() => setTarget('all_teachers')}><GraduationCap size={14} /> {t.messages_extra.allTeachers}</button>}
                                <button type="button" className={`chip ${target === 'custom' ? 'active' : ''}`} onClick={() => setTarget('custom')}><Layers size={14} /> {t.messages_extra.custom}</button>
                            </div>
                        </div>
                        {target === 'custom' && (
                            <div className="form-group">
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setPicker('classes'); setPickerSearch(''); }}><Layers size={14} /> {t.messages_extra.classes} ({selClasses.length})</button>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setPicker('students'); setPickerSearch(''); }}><Users size={14} /> {t.common.students} ({selStudents.length})</button>
                                    {role === 'admin' && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setPicker('teachers'); setPickerSearch(''); }}><GraduationCap size={14} /> {t.common.teachers} ({selTeachers.length})</button>}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{recipientSummary()}</div>
                            </div>
                        )}
                        <div className="form-group">
                            <label>{t.messages_page.subject}</label>
                            <input required maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>{t.messages_page.message}</label>
                            <textarea required rows={6} maxLength={5000} value={form.messageBody} onChange={(e) => setForm({ ...form, messageBody: e.target.value })} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setCompose(false)}>{t.messages_page.cancel}</button>
                        <button type="submit" className="btn btn-primary" disabled={sending}><Send size={16} /> {sending ? '...' : t.messages_page.send}</button>
                    </div>
                </form>
            </Modal>

            {/* Recipient picker */}
            <Modal open={!!picker} onClose={() => setPicker(null)} title={picker === 'classes' ? t.messages_extra.classes : picker === 'students' ? t.common.students : t.common.teachers}
                footer={<button className="btn btn-primary" onClick={() => setPicker(null)}>{t.common_extra.close}</button>}>
                <div className="modal-body">
                    {picker !== 'classes' && <input placeholder={t.common.search} value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} style={{ marginBottom: 10 }} />}
                    <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'grid', gap: 6 }}>
                        {picker === 'classes' && classes.map((c) => (
                            <label key={c.name} style={styles.pickRow}><input type="checkbox" checked={selClasses.includes(c.name)} onChange={() => toggle(selClasses, setSelClasses, c.name)} /> {c.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({c.students})</span></label>
                        ))}
                        {picker === 'students' && students.filter((s) => !pickerSearch || `${s.full_name} ${s.class_name} ${s.student_id}`.toLowerCase().includes(pickerSearch.toLowerCase())).map((s) => (
                            <label key={s.userId} style={styles.pickRow}><input type="checkbox" checked={selStudents.includes(s.userId)} onChange={() => toggle(selStudents, setSelStudents, s.userId)} /> {s.full_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {s.class_name}</span></label>
                        ))}
                        {picker === 'teachers' && teachers.filter((x) => !pickerSearch || `${x.full_name} ${x.subject}`.toLowerCase().includes(pickerSearch.toLowerCase())).map((x) => (
                            <label key={x.userId} style={styles.pickRow}><input type="checkbox" checked={selTeachers.includes(x.userId)} onChange={() => toggle(selTeachers, setSelTeachers, x.userId)} /> {x.full_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {x.subject}</span></label>
                        ))}
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={!!toDelete} danger title={t.common_extra.deleteConfirmTitle} message={toDelete?.subject} confirmLabel={t.common_extra.delete} cancelLabel={t.common_extra.cancel} onConfirm={remove} onCancel={() => setToDelete(null)} />
        </div>
    );
}

const styles = {
    pickRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-hover)', cursor: 'pointer', fontSize: '0.9rem' },
};

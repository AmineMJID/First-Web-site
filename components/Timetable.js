'use client';

import { Edit3, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { subjectColor } from '@/lib/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const todayName = () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

// Weekly grid of lesson slots. Pass onEdit/onDelete to enable admin actions.
export default function Timetable({ slots, showClass = false, showTeacher = true, onEdit, onDelete }) {
    const { t } = useLanguage();
    const today = todayName();
    const days = [...DAYS, ...(slots.some((s) => s.day_of_week === 'Saturday') ? ['Saturday'] : [])];

    return (
        <div className="timetable" style={days.length === 6 ? { gridTemplateColumns: 'repeat(6, minmax(150px, 1fr))' } : undefined}>
            {days.map((day) => {
                const items = slots.filter((s) => s.day_of_week === day);
                return (
                    <div key={day} className="timetable-day" style={day === today ? { outline: '2px solid var(--primary-300)' } : undefined}>
                        <h4>{t.days[day]}{day === today && <span className="badge badge-primary" style={{ marginInlineStart: 6, fontSize: '0.6rem' }}>•</span>}</h4>
                        {items.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.student_schedule.noClasses}</p>}
                        {items.map((s) => (
                            <div key={s.id} className={`slot ${day === today ? 'today' : ''}`} style={{ borderColor: subjectColor(s.subject) }}>
                                <div className="slot-time">{s.start_time} – {s.end_time}</div>
                                <div className="slot-subject">{s.subject}</div>
                                <div className="slot-meta">
                                    {showClass && <span>{s.class_name}</span>}
                                    {showClass && (s.room || (showTeacher && s.teacher_name)) && ' · '}
                                    {s.room}
                                    {showTeacher && s.teacher_name && ` · ${s.teacher_name}`}
                                </div>
                                {(onEdit || onDelete) && (
                                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                                        {onEdit && <button className="btn btn-outline btn-sm" style={{ padding: '3px 6px' }} onClick={() => onEdit(s)} aria-label="Edit"><Edit3 size={13} /></button>}
                                        {onDelete && <button className="btn btn-outline btn-sm" style={{ padding: '3px 6px', color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => onDelete(s)} aria-label="Delete"><Trash2 size={13} /></button>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import Timetable from '@/components/Timetable';
import { api } from '@/lib/client';

export default function StudentSchedule() {
    const { t } = useLanguage();
    const [slots, setSlots] = useState(null);
    useEffect(() => { api('/api/schedule').then(setSlots).catch(() => setSlots([])); }, []);
    if (!slots) return <div className="loading-page"><div className="spinner" /></div>;
    return (
        <div className="animate-fade-in">
            <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={20} color="#22c55e" /> {t.student_schedule.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.student_schedule.subtitle}</p>
            </div>
            <div className="card" style={{ padding: '16px' }}>
                <Timetable slots={slots} />
            </div>
        </div>
    );
}

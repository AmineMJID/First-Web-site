import { z } from 'zod';
import { scheduleCreateSchema } from './validators.js';
import { sanitizeText } from './sanitize.js';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function validateSlot(body) {
    const result = scheduleCreateSchema.safeParse(body);
    if (!result.success) {
        const first = result.error.issues[0];
        return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input' };
    }
    const data = result.data;
    return {
        value: {
            className: sanitizeText(data.className, 50),
            subject: sanitizeText(data.subject, 60),
            day: data.dayOfWeek,
            start: data.startTime,
            end: data.endTime,
            room: sanitizeText(data.room, 40) || null,
            teacherId: data.teacherId ? Number(data.teacherId) : null,
        },
    };
}

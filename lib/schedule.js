import { isValidTime, clampStr } from './api.js';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function validateSlot(body) {
    const className = clampStr(body?.className, 50);
    const subject = clampStr(body?.subject, 60);
    const day = body?.dayOfWeek;
    const start = body?.startTime;
    const end = body?.endTime;
    if (!className || !subject) return { error: 'Class and subject are required' };
    if (!DAYS.includes(day)) return { error: 'Invalid day of week' };
    if (!isValidTime(start) || !isValidTime(end) || start >= end) return { error: 'Invalid time range' };
    return {
        value: {
            className, subject, day, start, end,
            room: clampStr(body.room, 40) || null,
            teacherId: body.teacherId ? Number(body.teacherId) : null,
        },
    };
}

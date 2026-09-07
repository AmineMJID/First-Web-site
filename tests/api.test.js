// End-to-end API tests. Requires a running server: BASE_URL=http://localhost:3000 npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from 'otplib';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

class Client {
    constructor() { this.cookie = ''; }
    async req(path, { method = 'GET', body } = {}) {
        const res = await fetch(BASE + path, {
            method, redirect: 'manual',
            headers: { 'content-type': 'application/json', cookie: this.cookie },
            body: body ? JSON.stringify(body) : undefined,
        });
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) this.cookie = setCookie.split(';')[0];
        let data = null;
        try { data = await res.json(); } catch { /* no body */ }
        return { status: res.status, data, headers: res.headers };
    }
}

async function loginWith2FA(username, password) {
    const c = new Client();
    const login = await c.req('/api/auth/login', { method: 'POST', body: { username, password } });
    assert.equal(login.status, 200);
    let secret;
    if (login.data.requires2FASetup) {
        const setup = await c.req(`/api/auth/setup-2fa?tempToken=${login.data.tempToken}`);
        assert.equal(setup.status, 200);
        secret = setup.data.secret;
    } else {
        secret = process.env.ADMIN_2FA_SECRET;
        assert.ok(secret, '2FA already configured: set ADMIN_2FA_SECRET or reseed');
    }
    const code = await generate({ secret });
    const verify = await c.req('/api/auth/verify-2fa', { method: 'POST', body: { tempToken: login.data.tempToken, code, setupSecret: secret } });
    assert.equal(verify.status, 200, JSON.stringify(verify.data));
    return c;
}

let admin, student, teacher;

before(async () => {
    const h = await fetch(BASE + '/api/health').then((r) => r.json());
    assert.equal(h.status, 'ok');
});

test('unauthenticated access is rejected', async () => {
    const c = new Client();
    assert.equal((await c.req('/api/students')).status, 401);
    const page = await fetch(BASE + '/dashboard/admin', { redirect: 'manual' });
    assert.equal(page.status, 307);
    assert.match(page.headers.get('location'), /\/login/);
});

test('student login without 2FA', async () => {
    student = new Client();
    const r = await student.req('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'student123' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, 'student');
    assert.ok(student.cookie.startsWith('auth-token='));
    const me = await student.req('/api/auth/me');
    assert.equal(me.data.username, 'alice');
    assert.equal(me.data.class_name, 'Class A');
});

test('wrong password is rejected', async () => {
    const c = new Client();
    const r = await c.req('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'nope' } });
    assert.equal(r.status, 401);
});

test('student cannot access admin resources', async () => {
    assert.equal((await student.req('/api/students')).status, 403);
    assert.equal((await student.req('/api/reports')).status, 403);
    assert.equal((await student.req('/api/messages', { method: 'POST', body: { subject: 'x', messageBody: 'y' } })).status, 403);
    const page = await fetch(BASE + '/dashboard/admin', { redirect: 'manual', headers: { cookie: student.cookie } });
    assert.equal(page.status, 307);
    assert.match(page.headers.get('location'), /\/dashboard\/student/);
});

test('student sees only own grades / attendance / schedule', async () => {
    const grades = (await student.req('/api/grades')).data;
    assert.ok(grades.length > 0);
    assert.ok(grades.every((g) => g.student_name === 'Alice Johnson'));
    const att = (await student.req('/api/attendance')).data;
    assert.ok(att.every((a) => a.student_name === 'Alice Johnson'));
    const sched = (await student.req('/api/schedule')).data;
    assert.ok(sched.every((s) => s.class_name === 'Class A'));
});

test('admin login requires 2FA and succeeds with TOTP', async () => {
    admin = await loginWith2FA('admin', 'admin123');
    const me = await admin.req('/api/auth/me');
    assert.equal(me.data.role, 'admin');
    assert.equal(me.data.has2fa, true);
});

test('temporary 2FA token cannot be used as a session', async () => {
    const c = new Client();
    const login = await c.req('/api/auth/login', { method: 'POST', body: { username: 'teacher2', password: 'teacher123' } });
    c.cookie = `auth-token=${login.data.tempToken}`;
    assert.equal((await c.req('/api/auth/me')).status, 401);
});

test('admin: create, update, reset password, delete student', async () => {
    const created = await admin.req('/api/students', { method: 'POST', body: { fullName: 'Zoé Test-Élève', className: 'Class Z', email: 'zoe@test.io' } });
    assert.equal(created.status, 201);
    const { username, password, studentId } = created.data.student;
    assert.match(username, /^zoetesteleve\d*$/);
    assert.match(studentId, /^STU-\d{3}$/);

    // New student can log in and must change password
    const z = new Client();
    const login = await z.req('/api/auth/login', { method: 'POST', body: { username, password } });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.mustChangePassword, true);
    const weak = await z.req('/api/auth/change-password', { method: 'POST', body: { currentPassword: password, newPassword: 'short' } });
    assert.equal(weak.status, 400);
    const ok = await z.req('/api/auth/change-password', { method: 'POST', body: { currentPassword: password, newPassword: 'newpassword123' } });
    assert.equal(ok.status, 200);
    assert.equal((await z.req('/api/auth/me')).data.mustChangePassword, false);

    const list = (await admin.req('/api/students?search=Zo')).data;
    const s = list.find((x) => x.username === username);
    assert.ok(s);
    assert.equal(s.class_name, 'Class Z');

    assert.equal((await admin.req(`/api/students/${s.id}`, { method: 'PUT', body: { className: 'Class A', phone: '0600' } })).status, 200);
    const detail = (await admin.req(`/api/students/${s.id}`)).data;
    assert.equal(detail.class_name, 'Class A');
    assert.equal(detail.phone, '0600');

    const reset = await admin.req(`/api/students/${s.id}`, { method: 'POST', body: { action: 'reset-password' } });
    assert.equal(reset.status, 200);
    assert.ok(reset.data.password.length >= 8);

    assert.equal((await admin.req(`/api/students/${s.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin.req(`/api/students/${s.id}`)).status, 404);
});

test('teacher: login, upsert grades, record attendance', async () => {
    teacher = await loginWith2FA('teacher1', 'teacher123');
    const students = (await teacher.req('/api/students')).data;
    const target = students[0];

    const bad = await teacher.req('/api/grades', { method: 'POST', body: { grades: [{ studentId: target.id, subject: 'Mathematics', term: 'Term 1', grade: 150 }] } });
    assert.equal(bad.status, 400);

    const up = await teacher.req('/api/grades', { method: 'POST', body: { grades: [{ studentId: target.id, subject: 'Mathematics', term: 'Term 1', grade: 77, remarks: 'test' }] } });
    assert.equal(up.status, 200);
    const again = await teacher.req('/api/grades', { method: 'POST', body: { grades: [{ studentId: target.id, subject: 'Mathematics', term: 'Term 1', grade: 88 }] } });
    assert.equal(again.status, 200);
    const grades = (await teacher.req(`/api/grades?studentId=${target.id}&subject=Mathematics&term=Term%201`)).data;
    assert.equal(grades.length, 1, 'upsert must not duplicate');
    assert.equal(grades[0].grade, 88);
    assert.equal(grades[0].remarks, 'test', 'empty remarks keep the previous value');

    const att = await teacher.req('/api/attendance', { method: 'POST', body: { records: [{ studentId: target.id, date: '2030-01-01', status: 'late' }] } });
    assert.equal(att.status, 200);
    const invalid = await teacher.req('/api/attendance', { method: 'POST', body: { records: [{ studentId: target.id, date: '2030-01-01', status: 'sleeping' }] } });
    assert.equal(invalid.status, 400);
    const day = (await teacher.req('/api/attendance?date=2030-01-01')).data;
    assert.equal(day.length, 1);
    assert.equal(day[0].status, 'late');
});

test('messaging: announcement, direct message, read receipts, delete', async () => {
    const ann = await admin.req('/api/messages', { method: 'POST', body: { isAnnouncement: true, recipientRole: 'student', subject: 'Test annonce', messageBody: 'Bonjour' } });
    assert.equal(ann.status, 201);

    const before = (await student.req('/api/auth/me')).data.unreadMessages;
    const inbox = (await student.req('/api/messages?box=inbox')).data;
    const msg = inbox.find((m) => m.subject === 'Test annonce');
    assert.ok(msg);
    assert.equal(msg.is_read, 0);
    assert.equal((await student.req(`/api/messages/${msg.id}`, { method: 'PUT' })).status, 200);
    const after = (await student.req('/api/auth/me')).data.unreadMessages;
    assert.equal(after, before - 1);

    // Teacher may not broadcast to teachers
    const forbidden = await teacher.req('/api/messages', { method: 'POST', body: { isAnnouncement: true, recipientRole: 'teacher', subject: 'x', messageBody: 'y' } });
    assert.equal(forbidden.status, 403);

    // Direct message to a class
    const direct = await teacher.req('/api/messages', { method: 'POST', body: { recipientClasses: ['Class A'], subject: 'Class A only', messageBody: 'Hi' } });
    assert.equal(direct.status, 201);
    assert.ok(direct.data.count >= 1);
    const sent = (await teacher.req('/api/messages?box=sent')).data;
    const grouped = sent.filter((m) => m.subject === 'Class A only');
    assert.equal(grouped.length, 1, 'bulk sends are grouped');
    assert.equal(grouped[0].recipient_count, direct.data.count);

    // Student cannot delete an announcement, admin can
    assert.equal((await student.req(`/api/messages/${msg.id}`, { method: 'DELETE' })).status, 403);
    assert.equal((await admin.req(`/api/messages/${msg.id}`, { method: 'DELETE' })).status, 200);
});

test('schedule: create, conflict detection, update, delete', async () => {
    const slot = { className: 'Class A', subject: 'Art', dayOfWeek: 'Friday', startTime: '14:00', endTime: '15:00', room: 'R1' };
    const created = await admin.req('/api/schedule', { method: 'POST', body: slot });
    assert.equal(created.status, 201);
    const conflict = await admin.req('/api/schedule', { method: 'POST', body: { ...slot, startTime: '14:30', endTime: '15:30' } });
    assert.equal(conflict.status, 409);
    const badTime = await admin.req('/api/schedule', { method: 'POST', body: { ...slot, startTime: '16:00', endTime: '15:00' } });
    assert.equal(badTime.status, 400);
    assert.equal((await admin.req(`/api/schedule/${created.data.id}`, { method: 'PUT', body: { ...slot, room: 'R2' } })).status, 200);
    assert.equal((await teacher.req('/api/schedule', { method: 'POST', body: slot })).status, 403);
    assert.equal((await admin.req(`/api/schedule/${created.data.id}`, { method: 'DELETE' })).status, 200);
});

test('reports and classes endpoints', async () => {
    const r = (await admin.req('/api/reports')).data;
    assert.ok(r.totalStudents > 0);
    assert.ok(Array.isArray(r.gradesBySubject));
    assert.ok(Array.isArray(r.attendanceTrend));
    const c = (await student.req('/api/classes')).data;
    assert.ok(c.classes.some((x) => x.name === 'Class A'));
    assert.ok(c.subjects.includes('Mathematics'));
});

test('logout clears the session', async () => {
    const c = new Client();
    await c.req('/api/auth/login', { method: 'POST', body: { username: 'bob', password: 'student123' } });
    assert.equal((await c.req('/api/auth/me')).status, 200);
    await c.req('/api/auth/logout', { method: 'POST' });
    assert.equal((await c.req('/api/auth/me')).status, 401);
});

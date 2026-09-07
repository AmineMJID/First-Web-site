// Seed the database with demo data.
//   npm run seed            -> only seeds when the DB is empty
//   npm run seed -- --force -> wipes and re-seeds
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, isDbEmpty } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function seed({ force = false, log = console.log } = {}) {
    const db = getDb();

    if (!isDbEmpty() && !force) {
        log('Database already contains data – skipping seed (use --force to reset).');
        return false;
    }

    db.exec(`
    DELETE FROM message_reads;
    DELETE FROM schedules;
    DELETE FROM messages;
    DELETE FROM attendance;
    DELETE FROM grades;
    DELETE FROM teachers;
    DELETE FROM students;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);

    db.exec('BEGIN');
    // === Create Admin ===
    const adminPassword = hashPassword('admin123');
    db.prepare(`INSERT INTO users (username, password, role, full_name, email) VALUES (?, ?, ?, ?, ?)`)
        .run('admin', adminPassword, 'admin', 'Dr. Sarah Mitchell', 'admin@school.edu');

    // === Create Teachers ===
    const teacherData = [
        { username: 'teacher1', name: 'Prof. James Wilson', email: 'james@school.edu', subject: 'Mathematics', dept: 'Science' },
        { username: 'teacher2', name: 'Ms. Emily Brown', email: 'emily@school.edu', subject: 'English', dept: 'Arts' },
        { username: 'teacher3', name: 'Mr. Robert Davis', email: 'robert@school.edu', subject: 'Physics', dept: 'Science' },
    ];

    const teacherPass = hashPassword('teacher123');
    const insertUser = db.prepare(`INSERT INTO users (username, password, role, full_name, email) VALUES (?, ?, ?, ?, ?)`);
    const insertTeacher = db.prepare(`INSERT INTO teachers (user_id, teacher_id, subject, department) VALUES (?, ?, ?, ?)`);

    const teacherIds = [];
    teacherData.forEach((t, i) => {
        const result = insertUser.run(t.username, teacherPass, 'teacher', t.name, t.email);
        insertTeacher.run(result.lastInsertRowid, `TCH-${String(i + 1).padStart(3, '0')}`, t.subject, t.dept);
        teacherIds.push({ userId: result.lastInsertRowid, teacherId: i + 1 });
    });

    // === Create Students ===
    const studentData = [
        { name: 'Alice Johnson', email: 'alice@school.edu', gender: 'Female', class: 'Class A', parent: 'Mr. Johnson' },
        { name: 'Bob Smith', email: 'bob@school.edu', gender: 'Male', class: 'Class A', parent: 'Mrs. Smith' },
        { name: 'Carol Williams', email: 'carol@school.edu', gender: 'Female', class: 'Class A', parent: 'Mr. Williams' },
        { name: 'David Brown', email: 'david@school.edu', gender: 'Male', class: 'Class B', parent: 'Mrs. Brown' },
        { name: 'Eva Martinez', email: 'eva@school.edu', gender: 'Female', class: 'Class B', parent: 'Mr. Martinez' },
        { name: 'Frank Lee', email: 'frank@school.edu', gender: 'Male', class: 'Class A', parent: 'Mrs. Lee' },
        { name: 'Grace Kim', email: 'grace@school.edu', gender: 'Female', class: 'Class B', parent: 'Mr. Kim' },
        { name: 'Henry Taylor', email: 'henry@school.edu', gender: 'Male', class: 'Class A', parent: 'Mrs. Taylor' },
        { name: 'Iris Anderson', email: 'iris@school.edu', gender: 'Female', class: 'Class B', parent: 'Mr. Anderson' },
        { name: 'Jack Thomas', email: 'jack@school.edu', gender: 'Male', class: 'Class A', parent: 'Mrs. Thomas' },
        { name: 'Karen White', email: 'karen@school.edu', gender: 'Female', class: 'Class B', parent: 'Mr. White' },
        { name: 'Leo Harris', email: 'leo@school.edu', gender: 'Male', class: 'Class A', parent: 'Mrs. Harris' },
        { name: 'Mia Clark', email: 'mia@school.edu', gender: 'Female', class: 'Class B', parent: 'Mr. Clark' },
        { name: 'Noah Lewis', email: 'noah@school.edu', gender: 'Male', class: 'Class A', parent: 'Mrs. Lewis' },
        { name: 'Olivia Walker', email: 'olivia@school.edu', gender: 'Female', class: 'Class B', parent: 'Mr. Walker' },
    ];

    const studentPass = hashPassword('student123');
    const insertStudent = db.prepare(
        `INSERT INTO students (user_id, student_id, date_of_birth, gender, class_name, parent_name) VALUES (?, ?, ?, ?, ?, ?)`
    );

    const studentIds = [];
    studentData.forEach((s, i) => {
        const username = s.name.split(' ')[0].toLowerCase();
        const result = insertUser.run(username, studentPass, 'student', s.name, s.email);
        const dob = `200${7 + (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
        insertStudent.run(result.lastInsertRowid, `STU-${String(i + 1).padStart(3, '0')}`, dob, s.gender, s.class, s.parent);
        studentIds.push(i + 1);
    });

    // === Create Grades ===
    const subjects = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'History'];
    const terms = ['Term 1', 'Term 2'];
    const insertGrade = db.prepare(
        `INSERT INTO grades (student_id, teacher_id, subject, grade, max_grade, term, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const remarks = ['Excellent work', 'Good progress', 'Needs improvement', 'Very good', 'Satisfactory', 'Outstanding'];
    studentIds.forEach(sid => {
        subjects.forEach((subj, si) => {
            terms.forEach(term => {
                const grade = Math.floor(Math.random() * 40) + 60; // 60-100
                const teacherId = (si % 3) + 1;
                insertGrade.run(sid, teacherId, subj, grade, 100, term, remarks[si]);
            });
        });
    });

    // === Create Attendance ===
    const insertAttendance = db.prepare(
        `INSERT INTO attendance (student_id, date, status, recorded_by) VALUES (?, ?, ?, ?)`
    );

    const statuses = ['present', 'present', 'present', 'present', 'absent', 'late', 'present', 'present', 'present', 'excused'];
    // Last 30 school days
    for (let d = 0; d < 30; d++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
        const dateStr = date.toISOString().split('T')[0];
        studentIds.forEach(sid => {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const teacherId = ((sid - 1) % 3) + 1;
            insertAttendance.run(sid, dateStr, status, teacherId);
        });
    }

    // === Create Messages ===
    const insertMessage = db.prepare(
        `INSERT INTO messages (sender_id, recipient_id, recipient_role, subject, body, is_announcement, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    // Admin announcements
    insertMessage.run(1, null, 'student', 'Welcome to the New Semester!',
        'Dear Students,\n\nWelcome back to school! We are excited to start this new semester with you. Please make sure to check your timetables and be prepared for classes starting Monday.\n\nBest regards,\nAdministration', 1, 0);
    insertMessage.run(1, null, 'student', 'Upcoming Parent-Teacher Conference',
        'Dear Students,\n\nPlease inform your parents about the upcoming Parent-Teacher Conference scheduled for next Friday. Attendance is mandatory.\n\nThank you,\nAdministration', 1, 0);
    insertMessage.run(1, null, 'teacher', 'Staff Meeting Notice',
        'Dear Teachers,\n\nThere will be a mandatory staff meeting this Wednesday at 3:00 PM in the conference room. Please prepare your mid-term reports.\n\nRegards,\nDr. Sarah Mitchell', 1, 0);

    // Teacher messages to specific students
    insertMessage.run(2, 5, null, 'Math Assignment Feedback',
        'Hi Alice,\n\nGreat job on your recent math assignment! Your problem-solving skills have improved significantly. Keep up the excellent work!\n\nProf. Wilson', 0, 0);
    insertMessage.run(3, 6, null, 'English Essay Review',
        'Hi Bob,\n\nI have reviewed your essay and left some comments. Please revise the conclusion paragraph and resubmit by Friday.\n\nMs. Brown', 0, 1);

    // === Create Schedule ===
    const insertSchedule = db.prepare(
        `INSERT INTO schedules (class_name, subject, teacher_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const scheduleData = [
        // Class A - Monday
        { cls: 'Class A', subj: 'Mathematics', tid: 1, day: 'Monday', start: '08:00', end: '09:30', room: 'Room 101' },
        { cls: 'Class A', subj: 'English', tid: 2, day: 'Monday', start: '09:45', end: '11:15', room: 'Room 102' },
        { cls: 'Class A', subj: 'Physics', tid: 3, day: 'Monday', start: '11:30', end: '13:00', room: 'Lab 1' },
        // Class A - Tuesday
        { cls: 'Class A', subj: 'Chemistry', tid: 1, day: 'Tuesday', start: '08:00', end: '09:30', room: 'Lab 2' },
        { cls: 'Class A', subj: 'Biology', tid: 2, day: 'Tuesday', start: '09:45', end: '11:15', room: 'Lab 3' },
        { cls: 'Class A', subj: 'History', tid: 3, day: 'Tuesday', start: '11:30', end: '13:00', room: 'Room 103' },
        // Class A - Wednesday
        { cls: 'Class A', subj: 'Mathematics', tid: 1, day: 'Wednesday', start: '08:00', end: '09:30', room: 'Room 101' },
        { cls: 'Class A', subj: 'Physics', tid: 3, day: 'Wednesday', start: '09:45', end: '11:15', room: 'Lab 1' },
        { cls: 'Class A', subj: 'English', tid: 2, day: 'Wednesday', start: '11:30', end: '13:00', room: 'Room 102' },
        // Class A - Thursday
        { cls: 'Class A', subj: 'Biology', tid: 2, day: 'Thursday', start: '08:00', end: '09:30', room: 'Lab 3' },
        { cls: 'Class A', subj: 'Chemistry', tid: 1, day: 'Thursday', start: '09:45', end: '11:15', room: 'Lab 2' },
        { cls: 'Class A', subj: 'Mathematics', tid: 1, day: 'Thursday', start: '11:30', end: '13:00', room: 'Room 101' },
        // Class A - Friday
        { cls: 'Class A', subj: 'History', tid: 3, day: 'Friday', start: '08:00', end: '09:30', room: 'Room 103' },
        { cls: 'Class A', subj: 'English', tid: 2, day: 'Friday', start: '09:45', end: '11:15', room: 'Room 102' },
        { cls: 'Class A', subj: 'Physics', tid: 3, day: 'Friday', start: '11:30', end: '13:00', room: 'Lab 1' },
        // Class B - Monday
        { cls: 'Class B', subj: 'English', tid: 2, day: 'Monday', start: '08:00', end: '09:30', room: 'Room 201' },
        { cls: 'Class B', subj: 'Mathematics', tid: 1, day: 'Monday', start: '09:45', end: '11:15', room: 'Room 202' },
        { cls: 'Class B', subj: 'History', tid: 3, day: 'Monday', start: '11:30', end: '13:00', room: 'Room 203' },
        // Class B - Tuesday
        { cls: 'Class B', subj: 'Physics', tid: 3, day: 'Tuesday', start: '08:00', end: '09:30', room: 'Lab 1' },
        { cls: 'Class B', subj: 'Mathematics', tid: 1, day: 'Tuesday', start: '09:45', end: '11:15', room: 'Room 202' },
        { cls: 'Class B', subj: 'Biology', tid: 2, day: 'Tuesday', start: '11:30', end: '13:00', room: 'Lab 3' },
        // Class B - Wednesday
        { cls: 'Class B', subj: 'Chemistry', tid: 1, day: 'Wednesday', start: '08:00', end: '09:30', room: 'Lab 2' },
        { cls: 'Class B', subj: 'English', tid: 2, day: 'Wednesday', start: '09:45', end: '11:15', room: 'Room 201' },
        { cls: 'Class B', subj: 'Physics', tid: 3, day: 'Wednesday', start: '11:30', end: '13:00', room: 'Lab 1' },
        // Class B - Thursday
        { cls: 'Class B', subj: 'History', tid: 3, day: 'Thursday', start: '08:00', end: '09:30', room: 'Room 203' },
        { cls: 'Class B', subj: 'Mathematics', tid: 1, day: 'Thursday', start: '09:45', end: '11:15', room: 'Room 202' },
        { cls: 'Class B', subj: 'English', tid: 2, day: 'Thursday', start: '11:30', end: '13:00', room: 'Room 201' },
        // Class B - Friday
        { cls: 'Class B', subj: 'Biology', tid: 2, day: 'Friday', start: '08:00', end: '09:30', room: 'Lab 3' },
        { cls: 'Class B', subj: 'Chemistry', tid: 1, day: 'Friday', start: '09:45', end: '11:15', room: 'Lab 2' },
        { cls: 'Class B', subj: 'History', tid: 3, day: 'Friday', start: '11:30', end: '13:00', room: 'Room 203' },
    ];

    scheduleData.forEach(s => {
        insertSchedule.run(s.cls, s.subj, s.tid, s.day, s.start, s.end, s.room);
    });

    db.exec('COMMIT');
    log('✅ Database seeded successfully!');
    log('');
    log('Demo Credentials:');
    log('─────────────────────────────────');
    log('Admin:   admin / admin123');
    log('Teacher: teacher1 / teacher123');
    log('Student: alice / student123');
    log('─────────────────────────────────');
    return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.chdir(path.join(__dirname, '..'));
    seed({ force: process.argv.includes('--force') });
}

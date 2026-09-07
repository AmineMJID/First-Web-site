// Database layer built on Node's built-in `node:sqlite` module (Node >= 22.5).
// No native compilation, no external dependency. The wrapper exposes a small
// better-sqlite3-like API (prepare().run/get/all, exec, transaction) so route
// handlers stay simple.
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

let db;

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, 'portal.db');

// node:sqlite refuses `undefined` bindings – normalise them to NULL.
const clean = (params) => params.map((p) => (p === undefined ? null : p));

function wrap(raw) {
    return {
        raw,
        exec: (sql) => raw.exec(sql),
        prepare(sql) {
            const stmt = raw.prepare(sql);
            return {
                run: (...params) => stmt.run(...clean(params)),
                get: (...params) => stmt.get(...clean(params)) ?? undefined,
                all: (...params) => stmt.all(...clean(params)),
            };
        },
        transaction(fn) {
            return (...args) => {
                raw.exec('BEGIN');
                try {
                    const result = fn(...args);
                    raw.exec('COMMIT');
                    return result;
                } catch (e) {
                    raw.exec('ROLLBACK');
                    throw e;
                }
            };
        },
    };
}

export function getDb() {
    if (!db) {
        if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        const raw = new DatabaseSync(DB_PATH);
        raw.exec('PRAGMA journal_mode = WAL');
        raw.exec('PRAGMA foreign_keys = ON');
        db = wrap(raw);
        initializeSchema(db);
    }
    return db;
}

function hasColumn(database, table, column) {
    return database.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function initializeSchema(database) {
    database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      full_name TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      two_factor_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      student_id TEXT UNIQUE NOT NULL,
      date_of_birth TEXT,
      gender TEXT,
      phone TEXT,
      address TEXT,
      class_name TEXT DEFAULT 'Class A',
      enrollment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      parent_name TEXT,
      parent_phone TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      teacher_id TEXT UNIQUE NOT NULL,
      subject TEXT,
      phone TEXT,
      department TEXT DEFAULT 'General',
      hire_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      teacher_id INTEGER,
      subject TEXT NOT NULL,
      grade REAL NOT NULL,
      max_grade REAL DEFAULT 100,
      term TEXT DEFAULT 'Term 1',
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      UNIQUE(student_id, subject, term)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN('present', 'absent', 'late', 'excused')),
      recorded_by INTEGER,
      notes TEXT,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(recorded_by) REFERENCES teachers(id) ON DELETE SET NULL,
      UNIQUE(student_id, date)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER,
      recipient_role TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      is_announcement INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      teacher_id INTEGER,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    -- Read receipts for announcements (one row per user who read it)
    CREATE TABLE IF NOT EXISTS message_reads (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id),
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_class ON schedules(class_name);
  `);

    // Lightweight migrations for databases created by older versions
    if (!hasColumn(database, 'users', 'two_factor_secret')) {
        database.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
    }
    if (!hasColumn(database, 'users', 'must_change_password')) {
        database.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
    }
}

// True when the database has no users yet (fresh install)
export function isDbEmpty() {
    return getDb().prepare('SELECT COUNT(*) AS c FROM users').get().c === 0;
}

// Seed demo data automatically on a fresh database (disable with AUTO_SEED=false)
let seedPromise;
export async function ensureSeeded() {
    if (process.env.AUTO_SEED === 'false') return;
    if (!isDbEmpty()) return;
    if (!seedPromise) {
        seedPromise = import('../scripts/seed.js').then(({ seed }) => seed());
    }
    await seedPromise;
}

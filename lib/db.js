// Database layer built on Node's built-in `node:sqlite` module (Node >= 22.5).
// Improved version: versioned migrations, soft-delete, audit logs, rate limits, triggers, abstraction ready for Postgres
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
        raw.exec('PRAGMA busy_timeout = 5000'); // Handle concurrency better
        db = wrap(raw);
        initializeSchema(db);
        runMigrations(db);
    }
    return db;
}

function hasColumn(database, table, column) {
    try {
        return database.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    } catch {
        return false;
    }
}

function hasTable(database, table) {
    const row = database.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    return !!row;
}

function initializeSchema(database) {
    // Base schema
    database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      full_name TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      two_factor_secret TEXT,
      must_change_password INTEGER DEFAULT 0,
      deleted_at DATETIME,
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
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id),
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- NEW: Audit logs (who did what)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- NEW: Persistent rate limiting
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON rate_limits(key, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_students_deleted ON students(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_teachers_deleted ON teachers(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
    CREATE INDEX IF NOT EXISTS idx_grades_deleted ON grades(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_deleted ON attendance(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_schedules_class ON schedules(class_name);
    CREATE INDEX IF NOT EXISTS idx_schedules_deleted ON schedules(deleted_at);
  `);

    // Lightweight migrations for databases created by older versions
    if (!hasColumn(database, 'users', 'two_factor_secret')) {
        database.exec('ALTER TABLE users ADD COLUMN two_factor_secret TEXT');
    }
    if (!hasColumn(database, 'users', 'must_change_password')) {
        database.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
    }
    if (!hasColumn(database, 'users', 'deleted_at')) {
        database.exec('ALTER TABLE users ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'students', 'deleted_at')) {
        database.exec('ALTER TABLE students ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'students', 'created_at')) {
        database.exec('ALTER TABLE students ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'students', 'updated_at')) {
        database.exec('ALTER TABLE students ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'teachers', 'deleted_at')) {
        database.exec('ALTER TABLE teachers ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'teachers', 'created_at')) {
        database.exec('ALTER TABLE teachers ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'teachers', 'updated_at')) {
        database.exec('ALTER TABLE teachers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'grades', 'deleted_at')) {
        database.exec('ALTER TABLE grades ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'grades', 'updated_at')) {
        database.exec('ALTER TABLE grades ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'attendance', 'deleted_at')) {
        database.exec('ALTER TABLE attendance ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'attendance', 'created_at')) {
        database.exec('ALTER TABLE attendance ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'attendance', 'updated_at')) {
        database.exec('ALTER TABLE attendance ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'messages', 'deleted_at')) {
        database.exec('ALTER TABLE messages ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'messages', 'updated_at')) {
        database.exec('ALTER TABLE messages ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'schedules', 'deleted_at')) {
        database.exec('ALTER TABLE schedules ADD COLUMN deleted_at DATETIME');
    }
    if (!hasColumn(database, 'schedules', 'created_at')) {
        database.exec('ALTER TABLE schedules ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    if (!hasColumn(database, 'schedules', 'updated_at')) {
        database.exec('ALTER TABLE schedules ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
}

// Versioned migrations system
function runMigrations(database) {
    const migrations = [
        {
            version: 1,
            sql: `
                -- Create triggers for updated_at
                CREATE TRIGGER IF NOT EXISTS trg_users_updated_at 
                AFTER UPDATE ON users FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;

                CREATE TRIGGER IF NOT EXISTS trg_students_updated_at 
                AFTER UPDATE ON students FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE students SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;

                CREATE TRIGGER IF NOT EXISTS trg_teachers_updated_at 
                AFTER UPDATE ON teachers FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE teachers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;

                CREATE TRIGGER IF NOT EXISTS trg_grades_updated_at 
                AFTER UPDATE ON grades FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE grades SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;

                CREATE TRIGGER IF NOT EXISTS trg_attendance_updated_at 
                AFTER UPDATE ON attendance FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE attendance SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;

                CREATE TRIGGER IF NOT EXISTS trg_messages_updated_at 
                AFTER UPDATE ON messages FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;

                CREATE TRIGGER IF NOT EXISTS trg_schedules_updated_at 
                AFTER UPDATE ON schedules FOR EACH ROW 
                WHEN NEW.updated_at = OLD.updated_at
                BEGIN 
                    UPDATE schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
                END;
            `
        },
        {
            version: 2,
            sql: `
                -- Clean up old rate limit data periodically via index
                CREATE INDEX IF NOT EXISTS idx_rate_limits_created ON rate_limits(created_at);
            `
        }
    ];

    for (const mig of migrations) {
        const exists = database.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(mig.version);
        if (!exists) {
            try {
                database.exec(mig.sql);
                database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(mig.version);
                console.log(`[db] Applied migration v${mig.version}`);
            } catch (e) {
                console.error(`[db] Migration v${mig.version} failed:`, e.message);
            }
        }
    }
}

// Helper to build WHERE clause for soft-delete filtering
export function notDeleted(tableAlias = '') {
    const prefix = tableAlias ? `${tableAlias}.` : '';
    return `${prefix}deleted_at IS NULL`;
}

// True when the database has no users yet (fresh install)
export function isDbEmpty() {
    try {
        return getDb().prepare(`SELECT COUNT(*) AS c FROM users WHERE ${notDeleted()} `).get().c === 0;
    } catch {
        return true;
    }
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

// For future Postgres abstraction: expose a query builder interface
export const dbProvider = {
    type: process.env.DB_TYPE || 'sqlite', // sqlite | postgres (future)
    isSqlite: () => (process.env.DB_TYPE || 'sqlite') === 'sqlite',
};

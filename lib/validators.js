// Zod validation schemas - replaces clampStr maison
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional().default(''),
  class: z.string().max(50).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const studentCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other', '']).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  className: z.string().trim().min(1).max(50).default('Class A'),
  parentName: z.string().trim().max(100).optional().default(''),
  parentPhone: z.string().trim().max(30).optional().default(''),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export const teacherCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  subject: z.string().trim().min(1).max(60),
  department: z.string().trim().max(60).optional().default('General'),
  phone: z.string().trim().max(30).optional().default(''),
});

export const teacherUpdateSchema = teacherCreateSchema.partial();

export const gradeSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  subject: z.string().trim().min(1).max(60),
  grade: z.coerce.number().min(0).max(100),
  maxGrade: z.coerce.number().min(1).max(1000).default(100),
  term: z.string().trim().max(30).default('Term 1'),
  remarks: z.string().trim().max(500).optional().default(''),
  teacherId: z.coerce.number().int().optional(),
});

export const gradesBulkSchema = z.object({
  grades: z.array(gradeSchema).min(1).max(100),
});

export const attendanceRecordSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  notes: z.string().trim().max(500).optional().default(''),
});

export const attendanceBulkSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1).max(200),
});

export const messageCreateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  messageBody: z.string().trim().min(1).max(5000),
  recipientIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
  recipientClasses: z.array(z.string().trim().max(50)).max(20).optional(),
  recipientRole: z.enum(['student', 'teacher', 'admin']).optional(),
  isAnnouncement: z.boolean().optional().default(false),
});

export const scheduleCreateSchema = z.object({
  className: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(60),
  teacherId: z.coerce.number().int().positive().nullable().optional(),
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  room: z.string().trim().max(50).optional().default(''),
}).refine((data) => data.startTime < data.endTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100).toLowerCase(),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(128),
});

// Helper to validate and return { data, error }
export function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input', data: null };
  }
  return { data: result.data, error: null };
}

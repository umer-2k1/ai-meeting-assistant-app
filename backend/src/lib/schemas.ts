import { z } from 'zod';

// ========================================
// User Schemas
// ========================================

export const userSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  timezone: z.string().default('UTC'),
  language: z.string().default('en'),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});

export type UserSchema = z.infer<typeof userSchema>;

// ========================================
// Meeting Schemas
// ========================================

export const meetingStatusSchema = z.enum([
  'SCHEDULED',
  'LIVE',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
]);

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime().or(z.date()),
  platform: z.string().max(50).optional(),
  platformUrl: z.string().url().optional(),
  platformMeetingId: z.string().optional(),
});

export const updateMeetingSchema = createMeetingSchema.partial();

export const meetingSchema = z.object({
  id: z.string().cuid(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  duration: z.number().nullable(),
  status: meetingStatusSchema,
  audioUrl: z.string().url().nullable(),
  audioDuration: z.number().nullable(),
  aiSummary: z.string().nullable(),
  summaryHtml: z.string().nullable(),
  keyDecisions: z.array(z.string()),
  risks: z.array(z.string()),
  highlights: z.array(z.string()),
  userId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MeetingSchema = z.infer<typeof meetingSchema>;

// ========================================
// Transcript Schemas
// ========================================

export const transcriptLineSchema = z.object({
  id: z.string().cuid(),
  meetingId: z.string().cuid(),
  speaker: z.string().min(1, 'Speaker is required'),
  text: z.string().min(1, 'Text is required'),
  timestamp: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Invalid timestamp format'),
  timestampSeconds: z.number().int().min(0),
  confidence: z.number().min(0).max(1).optional(),
  highlighted: z.boolean().default(false),
  createdAt: z.date(),
});

export const createTranscriptLineSchema = z.object({
  meetingId: z.string().cuid(),
  speaker: z.string().min(1),
  text: z.string().min(1),
  timestamp: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  timestampSeconds: z.number().int().min(0),
  confidence: z.number().min(0).max(1).optional(),
  highlighted: z.boolean().default(false),
});

export type TranscriptLineSchema = z.infer<typeof transcriptLineSchema>;

// ========================================
// Action Item Schemas
// ========================================

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const actionStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const actionItemSchema = z.object({
  id: z.string().cuid(),
  meetingId: z.string().cuid(),
  task: z.string().min(1, 'Task is required'),
  assignee: z.string().nullable(),
  dueDate: z.date().nullable(),
  priority: prioritySchema,
  status: actionStatusSchema,
  timestamp: z.string().nullable(),
  context: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

export const createActionItemSchema = z.object({
  meetingId: z.string().cuid(),
  task: z.string().min(1),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().or(z.date()).optional(),
  priority: prioritySchema.default('MEDIUM'),
  status: actionStatusSchema.default('PENDING'),
  timestamp: z.string().optional(),
  context: z.string().optional(),
});

export type ActionItemSchema = z.infer<typeof actionItemSchema>;

// ========================================
// AI Chat Schemas
// ========================================

export const askQuestionSchema = z.object({
  meetingId: z.string().cuid().optional(),
  question: z.string().min(1, 'Question is required').max(1000),
  stream: z.boolean().default(false),
});

export const chatMessageSchema = z.object({
  id: z.string().cuid(),
  meetingId: z.string().cuid().nullable(),
  userId: z.string().cuid(),
  question: z.string(),
  answer: z.string(),
  contextType: z.string().nullable(),
  contextSnippet: z.string().nullable(),
  model: z.string().nullable(),
  tokensUsed: z.number().nullable(),
  responseTime: z.number().nullable(),
  createdAt: z.date(),
});

export type ChatMessageSchema = z.infer<typeof chatMessageSchema>;

// ========================================
// Attendee Schemas
// ========================================

export const attendeeSchema = z.object({
  id: z.string().cuid(),
  meetingId: z.string().cuid(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().nullable(),
  role: z.string().nullable(),
  linkedinUrl: z.string().url().nullable(),
  company: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createAttendeeSchema = z.object({
  meetingId: z.string().cuid(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
});

export type AttendeeSchema = z.infer<typeof attendeeSchema>;

// ========================================
// API Response Schemas
// ========================================

export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
});

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const meetingListResponseSchema = z.object({
  meetings: z.array(meetingSchema),
  total: z.number().int().optional(),
  hasMore: z.boolean().optional(),
});

// ========================================
// Helper Functions
// ========================================

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

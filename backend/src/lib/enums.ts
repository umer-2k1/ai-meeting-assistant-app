/**
 * Enum union types.
 *
 * SQLite/Prisma has no native enums, so the schema stores these as `String`
 * columns and `@prisma/client` no longer exports enum types. These unions are
 * derived from the zod schemas in `lib/schemas.ts` (the single source of truth)
 * and are used wherever the Postgres schema previously imported a Prisma enum.
 */
import type { z } from 'zod';
import {
  meetingStatusSchema,
  prioritySchema,
  actionStatusSchema,
  integrationProviderSchema,
  integrationTypeSchema,
} from './schemas.js';

export type MeetingStatus = z.infer<typeof meetingStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type ActionStatus = z.infer<typeof actionStatusSchema>;
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type IntegrationType = z.infer<typeof integrationTypeSchema>;

// Runtime value lists (handy for validation/iteration).
export const MEETING_STATUSES = meetingStatusSchema.options;
export const PRIORITIES = prioritySchema.options;
export const ACTION_STATUSES = actionStatusSchema.options;
export const INTEGRATION_PROVIDERS = integrationProviderSchema.options;
export const INTEGRATION_TYPES = integrationTypeSchema.options;

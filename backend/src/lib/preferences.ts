import { z } from 'zod';

/**
 * User preferences persisted as a JSON string on `User.preferences`. Every field
 * has a `.catch(default)` so a partial/legacy blob still parses into a complete,
 * valid object.
 */
export const preferencesSchema = z.object({
  timeFormat: z.enum(['12h', '24h']).catch('12h'),
  language: z.string().catch('en'),
  summaryLength: z.enum(['brief', 'balanced', 'detailed']).catch('balanced'),
  actionSensitivity: z.enum(['conservative', 'balanced', 'aggressive']).catch('balanced'),
  responseStyle: z.enum(['concise', 'explanatory', 'structured']).catch('concise'),
  includeTimestamps: z.boolean().catch(true),
  highlightDecisions: z.boolean().catch(true),
  suggestFollowups: z.boolean().catch(true),
});

export type UserPreferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: UserPreferences = preferencesSchema.parse({});

/** Parse the stored JSON string into a complete preferences object. */
export function parsePreferences(raw: string | null | undefined): UserPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return preferencesSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Merge a partial update over defaults and serialize back to a JSON string. */
export function serializePreferences(prefs: Partial<UserPreferences>): string {
  return JSON.stringify(preferencesSchema.parse({ ...DEFAULT_PREFERENCES, ...prefs }));
}

/**
 * JSON-encoded string-list helpers.
 *
 * SQLite/Prisma cannot store scalar lists (`String[]`), so fields like
 * `Meeting.keyDecisions`, `Meeting.risks`, `Meeting.highlights` and
 * `Integration.scopes` are stored as JSON-encoded `String` columns
 * (default `"[]"`). Always read them with `parseStringList` and write them
 * with `serializeStringList`.
 */

/** Parse a JSON-encoded string list column into `string[]`. */
export function parseStringList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v));
  } catch {
    return [];
  }
}

/** Serialize a `string[]` into a JSON string for a list column. */
export function serializeStringList(value: string[] | null | undefined): string {
  return JSON.stringify(Array.isArray(value) ? value.map((v) => String(v)) : []);
}

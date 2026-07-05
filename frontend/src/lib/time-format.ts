/**
 * Module-level time-format preference, kept in sync by the preferences context.
 * Date formatters read `hour12()` so the whole app honors the user's 12h/24h
 * choice without threading the preference through every call site.
 */
let timeFormat: '12h' | '24h' = '12h';

export function setTimeFormatPreference(value: '12h' | '24h') {
  timeFormat = value;
}

/** `true` for 12-hour clock, `false` for 24-hour — for Intl `hour12`. */
export function hour12(): boolean {
  return timeFormat === '12h';
}

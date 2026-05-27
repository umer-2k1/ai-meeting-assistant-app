import { format, formatDistance, formatDistanceToNow, parseISO, isValid, differenceInMinutes, differenceInSeconds, addDays, subDays, startOfDay, endOfDay, isToday, isTomorrow, isYesterday, isPast, isFuture } from 'date-fns';

/**
 * Format date to readable string
 * @example "May 27, 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return format(d, 'MMM d, yyyy');
}

/**
 * Format date with time
 * @example "May 27, 2026 at 10:30 AM"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return format(d, 'MMM d, yyyy \'at\' h:mm a');
}

/**
 * Format time only
 * @example "10:30 AM"
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid time';
  return format(d, 'h:mm a');
}

/**
 * Format relative time
 * @example "2 hours ago", "in 3 days"
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format duration between two dates
 * @example "2 hours 30 minutes"
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  
  if (!isValid(s) || !isValid(e)) return 'Invalid duration';
  
  return formatDistance(s, e);
}

/**
 * Format seconds to HH:MM:SS
 * @example "01:23:45"
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parse timestamp to seconds
 * @example "01:23:45" => 5025
 */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Format meeting duration
 * @example "1h 30m"
 */
export function formatMeetingDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Get display date (smart formatting)
 * @example "Today", "Yesterday", "May 27"
 */
export function getDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Invalid date';

  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';

  const diff = differenceInMinutes(d, new Date());
  if (Math.abs(diff) < 7 * 24 * 60) {
    return formatRelative(d);
  }

  return formatDate(d);
}

/**
 * Check if date is in past
 */
export function isDatePast(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) && isPast(d);
}

/**
 * Check if date is in future
 */
export function isDateFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) && isFuture(d);
}

/**
 * Calculate meeting status based on dates
 */
export function getMeetingStatus(startTime: Date | string, endTime?: Date | string | null): 'upcoming' | 'live' | 'ended' {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const now = new Date();

  if (isPast(start)) {
    if (endTime) {
      const end = typeof endTime === 'string' ? parseISO(endTime) : endTime;
      return isPast(end) ? 'ended' : 'live';
    }
    // If no end time but started over 4 hours ago, assume ended
    const diffHours = differenceInSeconds(now, start) / 3600;
    return diffHours > 4 ? 'ended' : 'live';
  }

  return 'upcoming';
}

/**
 * Get date range for filters
 */
export function getDateRange(range: 'today' | 'yesterday' | 'week' | 'month'): { start: Date; end: Date } {
  const now = new Date();

  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'week':
      return { start: subDays(now, 7), end: now };
    case 'month':
      return { start: subDays(now, 30), end: now };
    default:
      return { start: now, end: now };
  }
}

/**
 * Add business days
 */
export function addBusinessDays(date: Date, days: number): Date {
  let result = new Date(date);
  let addedDays = 0;

  while (addedDays < days) {
    result = addDays(result, 1);
    const dayOfWeek = result.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Format date for API (ISO string)
 */
export function toISOString(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.toISOString();
}

/**
 * Parse ISO string safely
 */
export function safeParseISO(dateString: string): Date | null {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

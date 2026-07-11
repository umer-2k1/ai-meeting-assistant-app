/**
 * Tiny scoped console logger for tracing the meeting lifecycle in the terminal.
 *
 * Produces compact, timestamped, tagged lines so each step of a recording →
 * transcription → complete → processing → audio flow is visible, and failures
 * (FAIL/WARN) stand out. Console-based on purpose (no external deps): output
 * lands in the same terminal as `pnpm dev`. Prisma query logging is disabled in
 * lib/prisma.ts so these lines aren't buried under SQL.
 *
 * Usage:
 *   const log = createLogger('audio');
 *   log.step('received upload for meeting abc123', { bytes: 12345 });
 *   log.ok('stored recording', { url });
 *   log.error('cloudinary upload failed', err);
 */

type Level = 'info' | 'step' | 'ok' | 'warn' | 'error';

const TAG: Record<Level, string> = {
  info: 'INFO',
  step: 'STEP',
  ok: ' OK ',
  warn: 'WARN',
  error: 'FAIL',
};

function stamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function emit(level: Level, scope: string, message: string, extra?: unknown): void {
  const head = `[${stamp()}] ${TAG[level]} [${scope}] ${message}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra === undefined) fn(head);
  else fn(head, extra);
}

export interface Logger {
  info: (message: string, extra?: unknown) => void;
  step: (message: string, extra?: unknown) => void;
  ok: (message: string, extra?: unknown) => void;
  warn: (message: string, extra?: unknown) => void;
  error: (message: string, extra?: unknown) => void;
}

/** Create a scoped logger. `scope` is shown in brackets on every line. */
export function createLogger(scope: string): Logger {
  return {
    info: (m, e) => emit('info', scope, m, e),
    step: (m, e) => emit('step', scope, m, e),
    ok: (m, e) => emit('ok', scope, m, e),
    warn: (m, e) => emit('warn', scope, m, e),
    error: (m, e) => emit('error', scope, m, e),
  };
}

/** Format a byte count for logs, e.g. "1.83 MB". */
export function humanBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Short id for logs so lines stay readable (meetings use long cuids). */
export function shortId(id?: string | null): string {
  if (!id) return '—';
  return id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-2)}`;
}

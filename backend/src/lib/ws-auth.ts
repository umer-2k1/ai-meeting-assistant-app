/**
 * WebSocket upgrade authentication + authorization for the live transcription
 * stream at `/api/live/:meetingId/stream`.
 *
 * The JWT is passed via the `Sec-WebSocket-Protocol` header (preferred, keeps it
 * out of URLs/logs) or a `?token=` query param as a fallback. We verify the
 * token AND that the meeting belongs to the authenticated user.
 */
import type { IncomingMessage } from 'node:http';
import prisma from './prisma.js';
import { verifyToken } from './jwt.js';

const STREAM_PATH = /^\/api\/live\/([^/]+)\/stream$/;

/** Subprotocol tag the client also sends so the server can echo one back. */
export const WS_SUBPROTOCOL = 'meeting-stream';

export interface WsAuthResult {
  userId: string;
  meetingId: string;
}

function extractToken(request: IncomingMessage): string | null {
  // Preferred: Sec-WebSocket-Protocol: "meeting-stream, <jwt>"
  const proto = request.headers['sec-websocket-protocol'];
  if (proto) {
    const parts = (Array.isArray(proto) ? proto.join(',') : proto)
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const token = parts.find((p) => p !== WS_SUBPROTOCOL);
    if (token) return token;
  }

  // Fallback: ?token=
  try {
    const url = new URL(request.url ?? '', 'http://localhost');
    const q = url.searchParams.get('token');
    if (q) return q;
  } catch {
    // ignore malformed URL
  }
  return null;
}

/** Parse the meetingId out of the upgrade request path, or null if it doesn't match. */
export function parseStreamMeetingId(request: IncomingMessage): string | null {
  try {
    const url = new URL(request.url ?? '', 'http://localhost');
    const match = STREAM_PATH.exec(url.pathname);
    return match ? decodeURIComponent(match[1]!) : null;
  } catch {
    return null;
  }
}

/**
 * Validate a live-stream upgrade request. Returns the authenticated context or
 * null (caller should reject the upgrade).
 */
export async function authorizeStreamUpgrade(
  request: IncomingMessage
): Promise<WsAuthResult | null> {
  const meetingId = parseStreamMeetingId(request);
  if (!meetingId) return null;

  const token = extractToken(request);
  if (!token) return null;

  let userId: string;
  try {
    const payload = verifyToken(token);
    userId = payload.sub;
  } catch {
    return null;
  }

  // Ownership check: the meeting must belong to the authenticated user.
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId },
    select: { id: true },
  });
  if (!meeting) return null;

  return { userId, meetingId };
}

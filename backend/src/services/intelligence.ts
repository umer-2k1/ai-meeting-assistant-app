/**
 * Pre-meeting intelligence: aggregate prior context for an upcoming meeting.
 *
 * Combines past meetings with the same attendees, their open action items, an
 * LLM-generated briefing, and (optionally) enriched attendee profiles.
 */
import prisma from '../lib/prisma.js';
import { generatePreMeetingBrief } from './ai.js';
import { enrichPerson, isEnrichmentConfigured } from './enrichment.js';

export interface PreMeetingInput {
  title: string;
  description?: string;
  attendees: Array<{ name: string; email?: string | null }>;
}

/**
 * Briefs are expensive — one LLM call plus a live enrichment lookup per
 * attendee — and the prep screen refetches on every mount, so leaving and
 * returning used to pay the full cost again for an identical result.
 *
 * Cached in-process: it survives navigation, which is the case that hurts, but
 * not a restart, and it is per-instance rather than shared. A DB-backed cache
 * would fix both; this needs no migration.
 */
const BRIEF_CACHE_TTL_MS = Number(process.env.PRE_MEETING_CACHE_TTL_MINUTES ?? 30) * 60 * 1000;
const BRIEF_CACHE_MAX_ENTRIES = 200;

type CachedBrief = { value: Awaited<ReturnType<typeof computePreMeetingBrief>>; expiresAt: number };
const briefCache = new Map<string, CachedBrief>();

function briefCacheKey(userId: string, input: PreMeetingInput): string {
  // Same meeting + same people = same brief. Attendees are order-insensitive.
  const people = input.attendees
    .map((a) => `${a.name.trim().toLowerCase()}<${(a.email ?? '').trim().toLowerCase()}>`)
    .sort()
    .join(',');
  return [userId, input.title.trim().toLowerCase(), (input.description ?? '').trim(), people].join('|');
}

function readBriefCache(key: string): CachedBrief['value'] | null {
  const hit = briefCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    briefCache.delete(key);
    return null;
  }
  // Refresh insertion order so the eviction below stays roughly LRU.
  briefCache.delete(key);
  briefCache.set(key, hit);
  return hit.value;
}

function writeBriefCache(key: string, value: CachedBrief['value']): void {
  briefCache.set(key, { value, expiresAt: Date.now() + BRIEF_CACHE_TTL_MS });
  while (briefCache.size > BRIEF_CACHE_MAX_ENTRIES) {
    const oldest = briefCache.keys().next();
    if (oldest.done) break;
    briefCache.delete(oldest.value);
  }
}

/** Drop any cached brief for a user — call when their underlying data changes. */
export function invalidatePreMeetingBriefs(userId: string): void {
  for (const key of briefCache.keys()) {
    if (key.startsWith(`${userId}|`)) briefCache.delete(key);
  }
}

export async function buildPreMeetingBrief(
  userId: string,
  input: PreMeetingInput,
  options: { refresh?: boolean } = {}
) {
  const key = briefCacheKey(userId, input);

  if (!options.refresh) {
    const cached = readBriefCache(key);
    if (cached) {
      console.log('[pre-meeting] cache hit', { title: input.title });
      return cached;
    }
  }

  console.log('[pre-meeting] building brief', {
    title: input.title,
    reason: options.refresh ? 'refresh requested' : 'cache miss',
  });
  const result = await computePreMeetingBrief(userId, input);
  writeBriefCache(key, result);
  return result;
}

async function computePreMeetingBrief(userId: string, input: PreMeetingInput) {
  const emails = input.attendees
    .map((a) => a.email)
    .filter((e): e is string => Boolean(e));

  // Past completed meetings that shared any of these attendees.
  const pastMeetings = emails.length
    ? await prisma.meeting.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          attendees: { some: { email: { in: emails } } },
        },
        orderBy: { startTime: 'desc' },
        take: 5,
      })
    : [];

  const meetingIds = pastMeetings.map((m) => m.id);

  // Open action items / pending follow-ups from those meetings.
  const openActionItems = meetingIds.length
    ? await prisma.actionItem.findMany({
        where: { meetingId: { in: meetingIds }, status: { not: 'COMPLETED' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  const previousContext = pastMeetings
    .map((m) => `- ${m.title} (${m.startTime.toDateString()}): ${m.aiSummary ?? 'No summary'}`)
    .join('\n');

  const brief = await generatePreMeetingBrief({
    title: input.title,
    description: input.description,
    attendees: input.attendees.map((a) => ({ name: a.name })),
    previousMeetings: previousContext || undefined,
  });

  // Best-effort live enrichment (only when SERPER_API_KEY is set).
  const enrichmentEnabled = isEnrichmentConfigured();
  const attendees = await Promise.all(
    input.attendees.map(async (a) => {
      if (!enrichmentEnabled) return { name: a.name, email: a.email ?? null };
      const domain = a.email?.split('@')[1] ?? null;
      const e = await enrichPerson(a.name, domain);
      return {
        name: a.name,
        email: a.email ?? null,
        linkedinUrl: e?.linkedinUrl ?? null,
        bio: e?.bio ?? null,
      };
    })
  );

  return {
    brief,
    enrichmentEnabled,
    attendees,
    pastMeetings: pastMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime,
      summary: m.aiSummary,
    })),
    openActionItems: openActionItems.map((i) => ({
      id: i.id,
      task: i.task,
      assignee: i.assignee,
      dueDate: i.dueDate,
      meetingId: i.meetingId,
    })),
  };
}

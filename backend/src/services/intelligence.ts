/**
 * Pre-meeting intelligence: aggregate prior context for an upcoming meeting.
 *
 * Combines past meetings with the same attendees, their open action items, an
 * LLM-generated briefing, and (optionally) enriched attendee profiles.
 */
import prisma from '../lib/prisma.js';
import { generatePreMeetingBrief } from './ai.js';
import { enrichPerson, isEnrichmentConfigured } from './enrichment.js';
import { generateEmbedding } from './embeddings.js';
import { searchSimilarMeetings } from './vector-store.js';
import { parseStringList } from '../lib/json-list.js';

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

/** How many past meetings end up in the brief. */
const BRIEF_MEETING_LIMIT = 5;
/** Candidate pool to rank. Wider than the limit so ranking has something to do. */
const BRIEF_CANDIDATE_LIMIT = 25;

/**
 * Rank this person's past meetings by relevance to the upcoming one.
 *
 * Recency alone is a poor proxy: for someone you meet weekly it is usually
 * right, but for a contact you meet across several unrelated projects the last
 * five meetings can be entirely off-topic. The meeting-level embeddings needed
 * to do better already exist — they just were not being used here.
 *
 * The most recent meeting is always kept regardless of score: "what did we say
 * last time" is context you want even when it is off-topic. Falls back to pure
 * recency when there is nothing to embed or the embedding call fails.
 */
async function rankPastMeetingsByRelevance<T extends { id: string; startTime: Date }>(
  candidates: T[],
  userId: string,
  queryText: string
): Promise<T[]> {
  const byRecency = [...candidates].sort(
    (a, b) => b.startTime.getTime() - a.startTime.getTime()
  );

  if (candidates.length <= BRIEF_MEETING_LIMIT || !queryText.trim()) {
    return byRecency.slice(0, BRIEF_MEETING_LIMIT);
  }

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const hits = await searchSimilarMeetings(queryEmbedding, userId, BRIEF_CANDIDATE_LIMIT * 2);

    const scoreByMeeting = new Map<string, number>();
    for (const hit of hits) {
      const meetingId = (hit.payload as { meetingId?: unknown })?.meetingId;
      if (typeof meetingId === 'string') {
        scoreByMeeting.set(meetingId, Math.max(scoreByMeeting.get(meetingId) ?? 0, hit.score));
      }
    }

    // Nothing indexed yet (older meetings predate embedding) — recency it is.
    if (scoreByMeeting.size === 0) return byRecency.slice(0, BRIEF_MEETING_LIMIT);

    const mostRecent = byRecency[0];
    const ranked = [...candidates].sort((a, b) => {
      const diff = (scoreByMeeting.get(b.id) ?? 0) - (scoreByMeeting.get(a.id) ?? 0);
      return diff !== 0 ? diff : b.startTime.getTime() - a.startTime.getTime();
    });

    const picked = ranked.slice(0, BRIEF_MEETING_LIMIT);
    if (mostRecent && !picked.some((m) => m.id === mostRecent.id)) {
      picked.splice(BRIEF_MEETING_LIMIT - 1, 1, mostRecent);
    }
    return picked;
  } catch (error) {
    console.warn(
      '[pre-meeting] relevance ranking failed, falling back to recency:',
      error instanceof Error ? error.message : error
    );
    return byRecency.slice(0, BRIEF_MEETING_LIMIT);
  }
}

async function computePreMeetingBrief(userId: string, input: PreMeetingInput) {
  const emails = input.attendees
    .map((a) => a.email)
    .filter((e): e is string => Boolean(e));

  // Past completed meetings that shared any of these attendees. Pull a wide
  // candidate set, then rank it — see rankPastMeetingsByRelevance.
  const candidates = emails.length
    ? await prisma.meeting.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          attendees: { some: { email: { in: emails } } },
        },
        orderBy: { startTime: 'desc' },
        take: BRIEF_CANDIDATE_LIMIT,
      })
    : [];

  const pastMeetings = await rankPastMeetingsByRelevance(
    candidates,
    userId,
    [input.title, input.description].filter(Boolean).join('\n')
  );

  const meetingIds = pastMeetings.map((m) => m.id);

  // Open action items / pending follow-ups from those meetings.
  const openActionItems = meetingIds.length
    ? await prisma.actionItem.findMany({
        where: { meetingId: { in: meetingIds }, status: { not: 'COMPLETED' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  // Decisions are the highest-value thing to recall walking into a follow-up
  // ("what did we already settle?"), and they were being dropped entirely — the
  // context string carried only title + summary.
  const previousContext = pastMeetings
    .map((m) => {
      const decisions = parseStringList(m.keyDecisions);
      const lines = [
        `- ${m.title} (${m.startTime.toDateString()}): ${m.aiSummary ?? 'No summary'}`,
      ];
      if (decisions.length > 0) {
        lines.push(`  Decisions made: ${decisions.join('; ')}`);
      }
      return lines.join('\n');
    })
    .join('\n');

  // The model was previously never shown the open action items, so its
  // "reminders" were inferred from summaries rather than grounded in real
  // outstanding commitments — a genuinely overdue item could go unmentioned.
  const openCommitments = openActionItems
    .map((i) => {
      const owner = i.assignee ? ` — ${i.assignee}` : '';
      const due = i.dueDate ? ` (due ${i.dueDate.toDateString()})` : '';
      return `- ${i.task}${owner}${due}`;
    })
    .join('\n');

  const brief = await generatePreMeetingBrief({
    title: input.title,
    description: input.description,
    attendees: input.attendees.map((a) => ({ name: a.name })),
    previousMeetings: previousContext || undefined,
    openActionItems: openCommitments || undefined,
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

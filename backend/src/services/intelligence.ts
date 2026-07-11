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

export async function buildPreMeetingBrief(userId: string, input: PreMeetingInput) {
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

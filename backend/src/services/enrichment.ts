/**
 * Attendee enrichment via public web search (Serper API).
 *
 * Optional — gated behind SERPER_API_KEY. When absent, enrichment is skipped and
 * the UI shows attendees without bios (no fabrication).
 */
import prisma from '../lib/prisma.js';

export function isEnrichmentConfigured(): boolean {
  return Boolean(process.env.SERPER_API_KEY);
}

export interface EnrichmentResult {
  linkedinUrl?: string;
  company?: string;
  title?: string;
  bio?: string;
}

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

/** Look up a person's public profile via a Serper web search. Best-effort. */
export async function enrichPerson(
  name: string,
  hintDomain?: string | null
): Promise<EnrichmentResult | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key || !name.trim()) return null;

  const query = hintDomain ? `${name} ${hintDomain} LinkedIn` : `${name} LinkedIn`;
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { organic?: SerperOrganic[] };
    const organic = data.organic ?? [];

    const linkedin = organic.find((o) => o.link?.includes('linkedin.com/in'));
    const primary = linkedin ?? organic[0];
    if (!primary) return null;

    return {
      linkedinUrl: linkedin?.link,
      bio: primary.snippet,
      // Title/company are hard to parse reliably from search; leave to the snippet.
    };
  } catch (error) {
    console.warn('[enrichment] lookup failed:', error);
    return null;
  }
}

/**
 * Enrich a meeting's attendees in place (persists results). No-op if the API key
 * is missing or the attendee was already enriched.
 */
export async function enrichMeetingAttendees(meetingId: string): Promise<void> {
  if (!isEnrichmentConfigured()) return;

  const attendees = await prisma.meetingAttendee.findMany({
    where: { meetingId, enrichedAt: null },
  });

  for (const attendee of attendees) {
    const domain = attendee.email?.split('@')[1] ?? null;
    const result = await enrichPerson(attendee.name, domain);
    await prisma.meetingAttendee.update({
      where: { id: attendee.id },
      data: {
        linkedinUrl: result?.linkedinUrl ?? attendee.linkedinUrl,
        bio: result?.bio ?? attendee.bio,
        company: result?.company ?? attendee.company,
        title: result?.title ?? attendee.title,
        enrichedAt: new Date(),
      },
    });
  }
}

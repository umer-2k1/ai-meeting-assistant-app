/**
 * Guest research orchestrator.
 *
 * Turns a meeting attendee's EMAIL (the identity anchor — a bare name is
 * ambiguous) into an enriched, confidence-scored profile by fusing:
 *   - the always-free base signals (domain→company, Gravatar, GitHub), and
 *   - an optional LinkedIn-layer provider (Serper / People Data Labs).
 *
 * An LLM verifies/extracts a consolidated profile from that evidence (grounded,
 * no fabrication). Results are cached per-email in the Contact table so repeat
 * lookups — and the same person across meetings — are instant and free.
 */

import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { createLLM } from './llm-provider.js';
import { invokeJson } from '../lib/llm-json.js';
import {
  fetchDomainCompany,
  fetchGravatar,
  fetchGithubProfile,
  isFreeEmailDomain,
  parseEmailDomain,
  type DomainCompany,
  type GravatarProfile,
  type GithubProfile,
} from './free-signals.js';
import {
  createIdentityProvider,
  isIdentityProviderConfigured,
  getIdentityProviderName,
  type PersonProfile,
} from './identity-provider.js';

const CACHE_TTL_DAYS = Number(process.env.ENRICHMENT_CACHE_TTL_DAYS ?? 30);
const MAX_CONCURRENCY = 3;

export type Confidence = 'high' | 'medium' | 'low';
export type MatchStatus = 'verified' | 'possible_matches' | 'unknown';

export interface GuestProfile {
  email: string;
  name: string | null;
  domain: string | null;
  isFreeEmail: boolean;
  fullName: string | null;
  title: string | null;
  company: string | null;
  companyDomain: string | null;
  website: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  socialProfiles: Record<string, string>;
  confidence: Confidence;
  matchStatus: MatchStatus;
  sources: Array<{ type: string; url?: string }>;
  enrichedAt: string | null;
}

/**
 * Guest research is ALWAYS available — the free base needs no configuration.
 * `hasLinkedinLayer` reports whether the optional provider is wired so the UI
 * can hint that adding a key yields richer results.
 */
export function isGuestResearchConfigured(): boolean {
  return true;
}

export function hasLinkedinLayer(): boolean {
  return isIdentityProviderConfigured();
}

/**
 * Keep only attendees worth researching: those with a real email, excluding the
 * organizer themselves and same-(corporate-)domain colleagues.
 */
export function filterExternalGuests(
  attendees: Array<{ name?: string | null; email?: string | null }>,
  organizerEmail: string
): Array<{ name: string | null; email: string }> {
  const organizer = organizerEmail.trim().toLowerCase();
  const organizerDomain = parseEmailDomain(organizer);
  const internalDomain =
    organizerDomain && !isFreeEmailDomain(organizerDomain) ? organizerDomain : null;

  const seen = new Set<string>();
  const out: Array<{ name: string | null; email: string }> = [];
  for (const a of attendees) {
    const email = a.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    if (email === organizer) continue;
    if (internalDomain && parseEmailDomain(email) === internalDomain) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ name: a.name?.trim() || null, email });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Identity resolution
// ---------------------------------------------------------------------------

function nameTokens(name: string | null): string[] {
  if (!name) return [];
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Fraction of name tokens that appear somewhere in the evidence text (0..1). */
function nameTokenScore(name: string | null, evidenceText: string): number {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return 0;
  const hay = evidenceText.toLowerCase();
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return hits / tokens.length;
}

const guestProfileSchema = z.object({
  fullName: z.string().nullish(),
  title: z.string().nullish(),
  company: z.string().nullish(),
  linkedinUrl: z.string().nullish(),
  website: z.string().nullish(),
  bio: z.string().nullish(),
  matchConfidence: z.number().min(0).max(1).catch(0.3),
});

interface ResolveInputs {
  domainCompany: DomainCompany | null;
  gravatar: GravatarProfile | null;
  github: GithubProfile | null;
  provider: PersonProfile | null;
}

/** LLM verification/extraction — consolidates evidence, grounded, no invention. */
async function llmVerify(
  email: string,
  name: string | null,
  inputs: ResolveInputs
): Promise<z.infer<typeof guestProfileSchema> | null> {
  const evidence = {
    email,
    providedName: name,
    domainCompany: inputs.domainCompany,
    gravatar: inputs.gravatar,
    github: inputs.github,
    providerProfile: inputs.provider,
  };

  const prompt = `You are verifying the identity of a meeting guest from public evidence.
The ONLY reliable anchor is the email address. Consolidate the evidence below into a single profile.

STRICT RULES:
- Use ONLY the provided evidence. If a field is not supported by the evidence, return null.
- NEVER invent or guess a LinkedIn URL, website, or company. Only copy URLs that appear in the evidence.
- "matchConfidence" (0..1) = how sure you are ALL asserted fields belong to the same person who owns the email. If the evidence is thin or conflicting, use a low value.

Evidence (JSON):
${JSON.stringify(evidence, null, 2)}

Respond ONLY with a JSON object of this exact shape:
{"fullName": string|null, "title": string|null, "company": string|null, "linkedinUrl": string|null, "website": string|null, "bio": string|null, "matchConfidence": number}`;

  try {
    const llm = createLLM({ temperature: 0.2, json: true });
    return await invokeJson(
      async () => {
        const r = await llm.invoke(prompt);
        return typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
      },
      guestProfileSchema,
      'guest identity'
    );
  } catch (error) {
    console.warn('[guest-research] LLM verify failed:', error);
    return null;
  }
}

function toConfidence(score: number): { confidence: Confidence; matchStatus: MatchStatus } {
  if (score >= 0.7) return { confidence: 'high', matchStatus: 'verified' };
  if (score >= 0.4) return { confidence: 'medium', matchStatus: 'possible_matches' };
  return { confidence: 'low', matchStatus: 'unknown' };
}

/**
 * Resolve a guest's identity from all available signals. Pure computation +
 * network fetches; does not touch the DB (that's researchGuest's job).
 */
export async function resolveGuestIdentity(
  email: string,
  name?: string | null
): Promise<GuestProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = parseEmailDomain(normalizedEmail);
  const isFree = isFreeEmailDomain(domain);
  const providedName = name?.trim() || null;

  // Run the free base signals and the optional provider in parallel.
  const provider = createIdentityProvider();
  const [domainCompany, gravatar, providerProfile] = await Promise.all([
    domain && !isFree ? fetchDomainCompany(domain) : Promise.resolve(null),
    fetchGravatar(normalizedEmail),
    provider
      ? provider.enrichByEmail(
          normalizedEmail,
          providedName,
          domain && !isFree ? domain : null
        )
      : Promise.resolve(null),
  ]);

  // GitHub search benefits from a resolved company; run it after.
  const companyHint =
    providerProfile?.company ?? domainCompany?.company ?? null;
  const github = providedName ? await fetchGithubProfile(providedName, companyHint) : null;

  const inputs: ResolveInputs = { domainCompany, gravatar, github, provider: providerProfile };

  // Merge social profiles from every source.
  const socialProfiles: Record<string, string> = {
    ...(gravatar?.socialProfiles ?? {}),
    ...(providerProfile?.socialProfiles ?? {}),
  };
  if (github?.htmlUrl) socialProfiles.github = github.htmlUrl;

  const sources: Array<{ type: string; url?: string }> = [];
  if (domainCompany) sources.push({ type: 'domain', url: domainCompany.website });
  if (gravatar) sources.push({ type: 'gravatar' });
  if (github) sources.push({ type: 'github', url: github.htmlUrl });
  if (providerProfile) sources.push({ type: getIdentityProviderName() });

  // Heuristic score from the raw signals (0..1).
  const evidenceText = [
    providerProfile?.title,
    providerProfile?.company,
    providerProfile?.bio,
    ...(providerProfile?.evidence?.map((e) => `${e.title ?? ''} ${e.snippet ?? ''}`) ?? []),
    github?.name,
    github?.bio,
    gravatar?.fullName,
    gravatar?.bio,
  ]
    .filter(Boolean)
    .join(' ');

  const hasLinkedin = Boolean(
    providerProfile?.linkedinUrl ||
      providerProfile?.evidence?.some((e) => e.url?.includes('linkedin.com/in'))
  );
  const heuristic =
    0.3 * nameTokenScore(providedName, evidenceText) +
    0.25 * (domainCompany || providerProfile?.company ? 1 : 0) +
    0.25 * (gravatar ? 1 : 0) +
    0.15 * (hasLinkedin ? 1 : 0) +
    0.05 * (hasLinkedin && (gravatar || providerProfile?.matchedOnEmail) ? 1 : 0);

  // LLM consolidation only when there's real evidence to reason about.
  const hasRichEvidence = Boolean(providerProfile || gravatar || github);
  const llm = hasRichEvidence ? await llmVerify(normalizedEmail, providedName, inputs) : null;

  const finalScore = llm
    ? 0.6 * heuristic + 0.4 * llm.matchConfidence
    : // No LLM pass → cap at the heuristic, and never assert "verified".
      Math.min(heuristic, 0.6);
  const { confidence, matchStatus } = toConfidence(finalScore);

  // Prefer LLM-consolidated fields, fall back to the strongest raw signal.
  const linkedinUrl =
    llm?.linkedinUrl ??
    providerProfile?.linkedinUrl ??
    providerProfile?.evidence?.find((e) => e.url?.includes('linkedin.com/in'))?.url ??
    null;

  return {
    email: normalizedEmail,
    name: providedName,
    domain,
    isFreeEmail: isFree,
    fullName:
      llm?.fullName ?? providerProfile?.fullName ?? gravatar?.fullName ?? github?.name ?? providedName,
    title: llm?.title ?? providerProfile?.title ?? null,
    company: llm?.company ?? providerProfile?.company ?? domainCompany?.company ?? null,
    companyDomain: providerProfile?.companyDomain ?? (domainCompany ? domain : null),
    website: llm?.website ?? providerProfile?.website ?? domainCompany?.website ?? github?.blog ?? null,
    linkedinUrl,
    avatarUrl: gravatar?.avatarUrl ?? null,
    bio: llm?.bio ?? providerProfile?.bio ?? gravatar?.bio ?? github?.bio ?? domainCompany?.description ?? null,
    location: providerProfile?.location ?? gravatar?.location ?? github?.location ?? null,
    socialProfiles,
    confidence,
    matchStatus,
    sources,
    enrichedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Caching + persistence
// ---------------------------------------------------------------------------

function contactToProfile(c: {
  email: string;
  domain: string | null;
  isFreeEmail: boolean;
  fullName: string | null;
  title: string | null;
  company: string | null;
  companyDomain: string | null;
  website: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  socialProfiles: unknown;
  confidence: string;
  matchStatus: string;
  sources: unknown;
  enrichedAt: Date | null;
}): GuestProfile {
  return {
    email: c.email,
    name: c.fullName,
    domain: c.domain,
    isFreeEmail: c.isFreeEmail,
    fullName: c.fullName,
    title: c.title,
    company: c.company,
    companyDomain: c.companyDomain,
    website: c.website,
    linkedinUrl: c.linkedinUrl,
    avatarUrl: c.avatarUrl,
    bio: c.bio,
    location: c.location,
    socialProfiles: (c.socialProfiles as Record<string, string>) ?? {},
    confidence: (c.confidence as Confidence) ?? 'low',
    matchStatus: (c.matchStatus as MatchStatus) ?? 'unknown',
    sources: (c.sources as Array<{ type: string; url?: string }>) ?? [],
    enrichedAt: c.enrichedAt?.toISOString() ?? null,
  };
}

function isFresh(enrichedAt: Date | null): boolean {
  if (!enrichedAt) return false;
  const ageMs = Date.now() - enrichedAt.getTime();
  return ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/** Research one guest, using (and refreshing) the Contact cache. Never throws. */
export async function researchGuest(email: string, name?: string | null): Promise<GuestProfile> {
  const normalizedEmail = email.trim().toLowerCase();

  const cached = await prisma.contact.findUnique({ where: { email: normalizedEmail } });
  if (cached && isFresh(cached.enrichedAt)) {
    return contactToProfile(cached);
  }

  let profile: GuestProfile;
  try {
    profile = await resolveGuestIdentity(normalizedEmail, name);
  } catch (error) {
    console.warn(`[guest-research] resolve failed for ${normalizedEmail}:`, error);
    // Return a minimal, honest profile rather than failing the batch.
    const domain = parseEmailDomain(normalizedEmail);
    return {
      email: normalizedEmail,
      name: name?.trim() || null,
      domain,
      isFreeEmail: isFreeEmailDomain(domain),
      fullName: name?.trim() || null,
      title: null, company: null, companyDomain: null, website: null,
      linkedinUrl: null, avatarUrl: null, bio: null, location: null,
      socialProfiles: {}, confidence: 'low', matchStatus: 'unknown',
      sources: [], enrichedAt: null,
    };
  }

  const data = {
    domain: profile.domain,
    isFreeEmail: profile.isFreeEmail,
    fullName: profile.fullName,
    title: profile.title,
    company: profile.company,
    companyDomain: profile.companyDomain,
    website: profile.website,
    linkedinUrl: profile.linkedinUrl,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    location: profile.location,
    socialProfiles: profile.socialProfiles,
    confidence: profile.confidence,
    matchStatus: profile.matchStatus,
    sources: profile.sources,
    provider: getIdentityProviderName(),
    enrichedAt: new Date(),
  };

  try {
    await prisma.contact.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, ...data },
      update: data,
    });
  } catch (error) {
    console.warn(`[guest-research] cache upsert failed for ${normalizedEmail}:`, error);
  }

  return profile;
}

/** Research a set of attendees (external only) with bounded concurrency. */
export async function researchGuests(
  organizerEmail: string,
  attendees: Array<{ name?: string | null; email?: string | null }>
): Promise<GuestProfile[]> {
  const guests = filterExternalGuests(attendees, organizerEmail);

  const results: GuestProfile[] = [];
  for (let i = 0; i < guests.length; i += MAX_CONCURRENCY) {
    const batch = guests.slice(i, i + MAX_CONCURRENCY);
    const settled = await Promise.all(
      batch.map((g) => researchGuest(g.email, g.name))
    );
    results.push(...settled);
  }
  return results;
}

/**
 * Enrich a persisted meeting's attendees in place: research each by email and
 * link the shared Contact + copy a snapshot onto MeetingAttendee. This is the
 * revived, wired version of the previously-dead enrichment path and is the seam
 * for future background auto-enrichment.
 */
export async function enrichMeetingAttendees(meetingId: string): Promise<void> {
  const attendees = await prisma.meetingAttendee.findMany({
    where: { meetingId, email: { not: null }, enrichedAt: null },
  });

  for (const attendee of attendees) {
    if (!attendee.email) continue;
    const profile = await researchGuest(attendee.email, attendee.name);
    const contact = await prisma.contact.findUnique({
      where: { email: attendee.email.toLowerCase() },
    });
    await prisma.meetingAttendee.update({
      where: { id: attendee.id },
      data: {
        contactId: contact?.id ?? null,
        linkedinUrl: profile.linkedinUrl ?? attendee.linkedinUrl,
        company: profile.company ?? attendee.company,
        title: profile.title ?? attendee.title,
        bio: profile.bio ?? attendee.bio,
        enrichedAt: new Date(),
      },
    });
  }
}

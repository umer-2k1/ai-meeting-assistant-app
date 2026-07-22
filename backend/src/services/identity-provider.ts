/**
 * Optional "LinkedIn layer" for guest research — a pluggable provider that turns
 * an email (+ name/company hints) into a structured professional profile.
 *
 * Mirrors the llm-provider.ts factory pattern. Selected via `ENRICHMENT_PROVIDER`:
 *   - `none`   (default) — no provider; guest research runs on the free base only.
 *   - `serper`           — anchored Google search (free credits) → LinkedIn URL + bio.
 *   - `pdl`              — People Data Labs Person Enrichment (free ~100/mo) → structured
 *                          title/company/LinkedIn/socials keyed on the exact email.
 *
 * NOTE: Proxycurl is intentionally unsupported — it scraped LinkedIn, was sued, and
 * shut down. Use the API-based providers above.
 *
 * Every provider is best-effort and returns null on miss; it never throws.
 */

export interface PersonProfile {
  fullName: string | null;
  title: string | null;
  company: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  website: string | null;
  bio: string | null;
  location: string | null;
  socialProfiles: Record<string, string>;
  /** True when the provider matched on the exact email (highest-trust signal). */
  matchedOnEmail: boolean;
  /** Evidence for the LLM verification step (search snippets, etc.). */
  evidence?: Array<{ title?: string; url?: string; snippet?: string }>;
  raw: unknown;
}

export interface IdentityProvider {
  readonly name: string;
  enrichByEmail(email: string, name?: string | null, companyHint?: string | null): Promise<PersonProfile | null>;
}

export type IdentityProviderName = 'none' | 'serper' | 'pdl';

export function getIdentityProviderName(): IdentityProviderName {
  const v = process.env.ENRICHMENT_PROVIDER;
  if (v === 'serper' || v === 'pdl') return v;
  return 'none';
}

/** True when the LinkedIn layer is available (a provider is selected AND keyed). */
export function isIdentityProviderConfigured(): boolean {
  switch (getIdentityProviderName()) {
    case 'serper':
      return Boolean(process.env.SERPER_API_KEY);
    case 'pdl':
      return Boolean(process.env.PDL_API_KEY);
    default:
      return false;
  }
}

const emptyProfile = (raw: unknown): PersonProfile => ({
  fullName: null,
  title: null,
  company: null,
  companyDomain: null,
  linkedinUrl: null,
  website: null,
  bio: null,
  location: null,
  socialProfiles: {},
  matchedOnEmail: false,
  raw,
});

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

/** Serper: anchored web search → first linkedin.com/in candidate + snippet evidence. */
class SerperProvider implements IdentityProvider {
  readonly name = 'serper';
  constructor(private readonly apiKey: string) {}

  async enrichByEmail(
    email: string,
    name?: string | null,
    companyHint?: string | null
  ): Promise<PersonProfile | null> {
    const who = name?.trim() || email.split('@')[0];
    const anchor = companyHint?.trim() || email.split('@')[1] || '';
    const query = anchor ? `"${who}" "${anchor}" LinkedIn` : `"${who}" LinkedIn`;

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 6 }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { organic?: SerperOrganic[] };
      const organic = data.organic ?? [];
      const linkedin = organic.find((o) => o.link?.includes('linkedin.com/in'));
      const primary = linkedin ?? organic[0];
      if (!primary) return null;

      return {
        ...emptyProfile(data),
        fullName: name?.trim() || null,
        linkedinUrl: linkedin?.link ?? null,
        bio: primary.snippet ?? null,
        company: companyHint ?? null,
        evidence: organic.slice(0, 5).map((o) => ({
          title: o.title,
          url: o.link,
          snippet: o.snippet,
        })),
      };
    } catch (error) {
      console.warn('[identity:serper] lookup failed:', error);
      return null;
    }
  }
}

interface PdlPerson {
  full_name?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  job_company_website?: string | null;
  linkedin_url?: string | null;
  location_name?: string | null;
  summary?: string | null;
  profiles?: Array<{ network?: string; url?: string }>;
}

/** People Data Labs: structured person enrichment keyed on the exact email. */
class PdlProvider implements IdentityProvider {
  readonly name = 'pdl';
  constructor(private readonly apiKey: string) {}

  async enrichByEmail(email: string, name?: string | null): Promise<PersonProfile | null> {
    const params = new URLSearchParams({ email, min_likelihood: '6' });
    if (name?.trim()) params.set('name', name.trim());

    try {
      const res = await fetch(
        `https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}`,
        {
          headers: { 'X-Api-Key': this.apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        }
      );
      // 404 = no confident match; treat as a miss, not an error.
      if (res.status === 404) return null;
      if (!res.ok) return null;

      const body = (await res.json()) as { status?: number; data?: PdlPerson };
      const p = body.data;
      if (!p) return null;

      const socialProfiles: Record<string, string> = {};
      for (const prof of p.profiles ?? []) {
        if (prof.network && prof.url) socialProfiles[prof.network] = prof.url;
      }
      const companyWebsite = p.job_company_website ?? null;

      return {
        fullName: p.full_name ?? null,
        title: p.job_title ?? null,
        company: p.job_company_name ?? null,
        companyDomain: companyWebsite,
        linkedinUrl: p.linkedin_url ? normalizeUrl(p.linkedin_url) : null,
        website: companyWebsite ? normalizeUrl(companyWebsite) : null,
        bio: p.summary ?? null,
        location: p.location_name ?? null,
        socialProfiles,
        matchedOnEmail: true, // PDL matched on the email we passed
        raw: body,
      };
    } catch (error) {
      console.warn('[identity:pdl] lookup failed:', error);
      return null;
    }
  }
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Build the selected provider, or null when the LinkedIn layer is unconfigured. */
export function createIdentityProvider(): IdentityProvider | null {
  switch (getIdentityProviderName()) {
    case 'serper':
      return process.env.SERPER_API_KEY ? new SerperProvider(process.env.SERPER_API_KEY) : null;
    case 'pdl':
      return process.env.PDL_API_KEY ? new PdlProvider(process.env.PDL_API_KEY) : null;
    default:
      return null;
  }
}

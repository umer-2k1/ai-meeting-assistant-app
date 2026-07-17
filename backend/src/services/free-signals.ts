/**
 * Free, no-key enrichment signals — the always-on base of guest research.
 *
 * None of these require an API key or paid plan:
 *  - fetchDomainCompany: company name/site/description from a corporate email domain
 *    (OpenGraph/meta scrape) + a free logo URL.
 *  - fetchGravatar: email-keyed public profile (name, avatar, bio, verified socials).
 *  - fetchGithubProfile: public GitHub profile for developer guests.
 *
 * Every function is best-effort: short timeout, swallow errors, return null on miss.
 * They never throw — the orchestrator runs them in parallel and fuses what comes back.
 */

import { createHash } from 'node:crypto';

const FETCH_TIMEOUT_MS = 8_000;
const UA = 'ai-meeting-assistant/1.0 (guest-research)';

/** Common free/personal email providers — no company can be inferred from these. */
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'yahoo.co.uk',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'gmx.net', 'zoho.com', 'mail.com', 'yandex.com', 'yandex.ru',
  'fastmail.com', 'hey.com', 'qq.com', '163.com', '126.com', 'aol.co.uk',
]);

export function parseEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function isFreeEmailDomain(domain: string | null): boolean {
  return domain ? FREE_EMAIL_DOMAINS.has(domain) : false;
}

/** Fetch with a hard timeout; returns null instead of throwing. */
async function safeFetch(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': UA, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) {
      const value = m[1].trim();
      if (value) return decodeHtmlEntities(value);
    }
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Title-case a bare domain label as a last-resort company name (`acme-corp` → `Acme Corp`). */
function companyNameFromDomain(domain: string): string {
  const label = domain.split('.')[0] ?? domain;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface DomainCompany {
  company: string;
  website: string;
  domain: string;
  description: string | null;
  logoUrl: string;
}

/**
 * Resolve company info from a corporate email domain. Fetches the homepage and
 * reads OpenGraph/meta tags; falls back to a domain-derived name. Free logo via
 * Clearbit's public logo endpoint (no key required).
 */
export async function fetchDomainCompany(domain: string): Promise<DomainCompany | null> {
  if (!domain) return null;

  const website = `https://${domain}`;
  const logoUrl = `https://logo.clearbit.com/${domain}`;
  let company = companyNameFromDomain(domain);
  let description: string | null = null;

  const res = await safeFetch(website);
  if (res) {
    // Cap the body we parse — we only need the <head>.
    const html = (await res.text()).slice(0, 200_000);
    const siteName = metaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]);
    const ogTitle = metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    description = metaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    ]);
    company = siteName || ogTitle || company;
    // Trim boilerplate like "Home | Acme" → "Acme".
    company = company.split(/\s[|–—-]\s/)[0].trim() || company;
  }

  return { company, website, domain, description, logoUrl };
}

export interface GravatarProfile {
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  socialProfiles: Record<string, string>;
}

/**
 * Look up a Gravatar profile by email hash. Because Gravatar is keyed on a
 * verified email, a hit is a high-trust identity signal. Returns null on miss.
 */
export async function fetchGravatar(email: string): Promise<GravatarProfile | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const hash = createHash('sha256').update(normalized).digest('hex');

  const res = await safeFetch(`https://gravatar.com/${hash}.json`, {
    headers: { Accept: 'application/json' },
  });
  if (!res) return null;

  try {
    const data = (await res.json()) as {
      entry?: Array<{
        displayName?: string;
        name?: { formatted?: string };
        thumbnailUrl?: string;
        aboutMe?: string;
        currentLocation?: string;
        accounts?: Array<{ shortname?: string; url?: string }>;
      }>;
    };
    const entry = data.entry?.[0];
    if (!entry) return null;

    const socialProfiles: Record<string, string> = {};
    for (const acct of entry.accounts ?? []) {
      if (acct.shortname && acct.url) socialProfiles[acct.shortname] = acct.url;
    }

    return {
      fullName: entry.name?.formatted || entry.displayName || null,
      avatarUrl: entry.thumbnailUrl || null,
      bio: entry.aboutMe || null,
      location: entry.currentLocation || null,
      socialProfiles,
    };
  } catch {
    return null;
  }
}

export interface GithubProfile {
  login: string;
  htmlUrl: string;
  name: string | null;
  company: string | null;
  bio: string | null;
  blog: string | null;
  location: string | null;
}

/**
 * Best-effort public GitHub profile for developer guests. Uses the free search
 * API (name + optional company); optionally authenticated via GITHUB_TOKEN for
 * higher rate limits (still free). Returns null when there's no confident match.
 */
export async function fetchGithubProfile(
  name: string,
  company?: string | null
): Promise<GithubProfile | null> {
  const q = [name.trim(), company?.trim() ? `"${company.trim()}"` : '']
    .filter(Boolean)
    .join(' ');
  if (!q) return null;

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const search = await safeFetch(
    `https://api.github.com/search/users?q=${encodeURIComponent(`${q} in:name`)}&per_page=1`,
    { headers }
  );
  if (!search) return null;

  try {
    const list = (await search.json()) as { items?: Array<{ url?: string }> };
    const userUrl = list.items?.[0]?.url;
    if (!userUrl) return null;

    const detail = await safeFetch(userUrl, { headers });
    if (!detail) return null;
    const u = (await detail.json()) as {
      login?: string;
      html_url?: string;
      name?: string;
      company?: string;
      bio?: string;
      blog?: string;
      location?: string;
    };
    if (!u.login || !u.html_url) return null;

    return {
      login: u.login,
      htmlUrl: u.html_url,
      name: u.name || null,
      company: u.company || null,
      bio: u.bio || null,
      blog: u.blog || null,
      location: u.location || null,
    };
  } catch {
    return null;
  }
}

/** Pastel tag chips (Spellar-style) keyed by tag slug */
const TAG_PALETTE: Record<string, string> = {
  roadmap: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200',
  design: 'border-violet-500/30 bg-violet-500/15 text-violet-800 dark:text-violet-200',
  q3: 'border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200',
  client: 'border-blue-500/30 bg-blue-500/15 text-blue-800 dark:text-blue-200',
  discovery: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-800 dark:text-indigo-200',
  standup: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  engineering: 'border-slate-500/30 bg-slate-500/15 text-slate-800 dark:text-slate-200',
  'ai-notes': 'border-teal-500/30 bg-teal-500/15 text-teal-800 dark:text-teal-200',
  onboarding: 'border-orange-500/30 bg-orange-500/15 text-orange-900 dark:text-orange-200'
};

const FALLBACK_PALETTE = [
  'border-pink-500/30 bg-pink-500/15 text-pink-800 dark:text-pink-200',
  'border-lime-500/30 bg-lime-500/15 text-lime-900 dark:text-lime-200',
  'border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200'
];

export function getTagClassName(tag: string): string {
  const key = tag.toLowerCase().replace(/\s+/g, '-');
  if (TAG_PALETTE[key]) return TAG_PALETTE[key];
  const index = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length] ?? FALLBACK_PALETTE[0];
}

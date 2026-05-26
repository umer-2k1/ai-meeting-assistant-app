/** Shared Tailwind class strings — respond to light/dark via design tokens */
export const COPILOT_SURFACE =
  'rounded-2xl border border-border bg-card text-card-foreground shadow-sm backdrop-blur-sm dark:bg-[linear-gradient(140deg,rgba(30,41,59,0.92),rgba(15,23,42,0.9))] dark:shadow-[0_14px_40px_rgba(2,6,23,0.45)]';

export const COPILOT_INPUT =
  'border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary';

export const COPILOT_BTN_OUTLINE =
  'border-border bg-background text-foreground hover:bg-muted';

export const COPILOT_INNER_PANEL = 'rounded-lg border border-border/70 bg-muted/50';

export const COPILOT_HIGHLIGHT_PANEL =
  'rounded-lg border border-cyan-500/50 bg-[var(--copilot-highlight-bg)] dark:border-[#06B6D4]/60';

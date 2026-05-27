# Meeting Details Screen

Reference layout inspired by Spellar-style meeting review: header metadata, audio playback, share/export actions, and tabbed content (Summary, My Notes, Transcript, Actions, AI Chat).

## Location

| Area | Path |
|------|------|
| Screen | `frontend/src/features/meeting-copilot/meeting-detail/meeting-detail-screen.tsx` |
| Audio player | `frontend/src/features/meeting-copilot/meeting-detail/meeting-audio-player.tsx` |
| Export bar | `frontend/src/features/meeting-copilot/meeting-detail/meeting-export-bar.tsx` |
| Tag styling | `frontend/src/features/meeting-copilot/meeting-detail/tag-styles.ts` |
| Rich text editor | `frontend/src/components/editor/` |
| Types | `frontend/src/features/meeting-copilot/types.ts` |
| Mock data | `frontend/src/features/meeting-copilot/mock-data.ts` |

## UI sections

### 1. Header

- Meeting title (large)
- Date · duration · participant count
- Toolbar: Report, Favorite (star), Delete, More (⋯)
- Back link to Dashboard

### 2. Tags

- Colorful `#tag` chips (pastel, per-tag palette)
- **Add tag** button (UI only — backend pending)

### 3. Audio player

- Play / pause, scrubber, elapsed / total time
- Playback speed cycle: 0.75× → 1× → 1.25× → 1.5× → 2×
- Skip back / forward 15 seconds
- Uses `meeting.audioUrl` when set; otherwise demo mode with `audioDurationSeconds`

### 4. Primary actions

| Button | Status |
|--------|--------|
| Share | Toast placeholder |
| Email | UI only |
| Web Link | Copies `/meetings/{id}` to clipboard |
| Copy | Same as Web Link (clipboard) |

### 5. Export destinations

Notion+, Docs+, Craft+, Obsidian+, Drive+, Confluence+, **Export** — each shows an info toast until integrations are wired.

### 6. Tabs

| Tab | Content | Editor |
|-----|---------|--------|
| **Summary** | AI-generated rich HTML | Read-only Tiptap (`variant="document"`) |
| **My Notes** | User notes | Editable Tiptap with full toolbar |
| **Transcript** | Speaker lines + timestamps | Plain list; highlighted lines styled |
| **Actions (N)** | Checklist action items | Local checkbox state |
| **AI Chat** | Ask questions about the meeting | Existing `onAskAi` flow |

## Data model (`Meeting`)

```ts
type Meeting = {
  id: string;
  title: string;
  status: 'live' | 'completed' | 'archived';
  displayDate?: string;           // Header date, e.g. "May 27, 2026"
  startedAt: string;
  duration: string;
  audioDurationSeconds?: number;  // Player fallback duration
  audioUrl?: string;              // Real recording URL
  participantCount: number;
  summarySnippet: string;
  summaryHtml?: string;           // Rich Summary tab content (HTML)
  tags: string[];
  decisions: string[];
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
  notes: string;                  // HTML or plain text for My Notes
  aiSummary: string;              // Plain fallback if summaryHtml missing
  isFavorite?: boolean;
};
```

### Summary HTML conventions

Use Tiptap-compatible HTML. Supported custom blocks in `editor.css`:

| Class | Purpose |
|-------|---------|
| `.editor-callout` | Sparkle callout box at top of summary |
| `.editor-callout-icon` | Icon column inside callout |
| `.editor-tip-list` | Bulleted tips with 💡 prefix |
| `<mark data-color="#…">` | Multicolor highlight |
| `<blockquote>`, `<h2>`, `<h3>`, lists | Standard rich text |

Example (see `meeting-1` in mock data):

```html
<div class="editor-callout">
  <span class="editor-callout-icon">✨</span>
  <p><em>AI-generated summary…</em></p>
</div>
<h2>Section heading</h2>
<blockquote><p><em>Quoted insight</em></p></blockquote>
<p>Text with <mark data-color="#DBEAFE" style="background-color: #DBEAFE">highlight</mark>.</p>
<ul class="editor-tip-list"><li>Tip one</li></ul>
```

## Rich text editor integration

Centralized in `frontend/src/components/editor/`:

- **`RichTextEditor`** — default bordered editor with toolbar
- **`variant="document"`** — borderless doc surface (Summary / My Notes tabs)
- **`showToolbar={false}`** — read-only summary without formatting bar
- **`useRichTextEditor`** — hook for custom layouts

See also: `frontend/src/components/editor/README.md`

## Implemented vs pending

### ✅ Implemented (UI)

- Spellar-like layout and tab order
- Rich Summary tab (HTML + callouts, highlights, blockquotes)
- My Notes with full Tiptap editor
- Audio player UI (real audio when `audioUrl` provided)
- Tag chips with color mapping
- Favorite toggle (local state)
- Action item checkboxes (local state)
- Export destination buttons with toasts
- Copy link / share toasts
- Light + dark theme support

### ⏳ Pending (backend / integrations)

| Feature | Notes |
|---------|--------|
| Persist My Notes | Save `onChange` HTML to API |
| Persist favorites / tags | User preferences API |
| Delete meeting | Confirm + API |
| Email summary | SMTP or provider integration |
| Share permissions | Team / link access control |
| Export to Notion, Docs, etc. | OAuth + export pipelines |
| Real audio files | Upload/storage + `audioUrl` from backend |
| Transcript sync | Click timestamp → seek audio |
| AI Chat persistence | Thread per meeting |
| Action item sync | Checkbox state → task system |

## Adding a new meeting with rich summary

1. Add a `Meeting` object in `mock-data.ts`
2. Set `summaryHtml` with the HTML conventions above
3. Optionally set `displayDate`, `audioDurationSeconds`, `audioUrl`
4. Open Dashboard → click meeting → Detail view

## Testing manually

1. `cd frontend && nvm use 22 && pnpm desktop:dev`
2. Dashboard → open **Product Sync Meeting**
3. Verify: tags, audio bar, tabs, Summary formatting, My Notes editor, Actions count in tab label

## Related docs

- `docs/README.md` — docs index
- `frontend/src/components/editor/README.md` — Tiptap usage
- `INSTALL_COLORS.md` — text/highlight color packages (already in `package.json`)

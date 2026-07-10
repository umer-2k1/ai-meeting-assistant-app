/**
 * Meetings API client + adapters.
 *
 * The backend Prisma model and the UI `Meeting` shape differ (status casing,
 * duration units, note structure, etc.). These adapters map API responses to
 * the frontend `Meeting` type so the existing polished UI stays unchanged.
 */
import { apiRequest } from '@/lib/api-client';
import { hour12 } from '@/lib/time-format';
import { BACKEND_URL, TOKEN_KEY } from '@/lib/config';
import type {
  ActionItem,
  ApiMeetingStatus,
  Meeting,
  MeetingNote,
  MeetingStatus,
  TranscriptLine,
} from './types';

// ----- API response shapes (partial, only fields we use) -----

interface ApiAttendee {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}

interface ApiTranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  highlighted?: boolean;
}

interface ApiActionItem {
  id: string;
  task: string;
  assignee?: string | null;
  dueDate?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  timestamp?: string | null;
}

interface ApiNote {
  id: string;
  content: string;
  contentHtml?: string | null;
  updatedAt?: string;
}

export interface ApiMeeting {
  id: string;
  title: string;
  description?: string | null;
  status: ApiMeetingStatus;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  audioUrl?: string | null;
  audioDuration?: number | null;
  platform?: string | null;
  platformUrl?: string | null;
  aiSummary?: string | null;
  summaryHtml?: string | null;
  keyDecisions?: string[];
  risks?: string[];
  highlights?: string[];
  processingError?: string | null;
  attendees?: ApiAttendee[];
  transcript?: ApiTranscriptLine[];
  actionItems?: ApiActionItem[];
  notes?: ApiNote[];
  tags?: { id: string; name: string }[];
  _count?: { transcript?: number; actionItems?: number };
  /** Distinct diarized speakers — participant fallback when no attendees exist. */
  speakerCount?: number;
}

// ----- Formatting helpers -----

const STATUS_MAP: Record<ApiMeetingStatus, MeetingStatus> = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  CANCELLED: 'archived',
  FAILED: 'failed',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: hour12(),
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Human-readable duration from seconds, e.g. "1h 24m" or "12m 44s". */
export function humanizeDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function mapActionItem(a: ApiActionItem): ActionItem {
  const priority = (a.priority ?? 'MEDIUM').toLowerCase();
  return {
    id: a.id,
    assignee: a.assignee ?? 'Unassigned',
    task: a.task,
    due: a.dueDate ? formatDate(a.dueDate) : '—',
    timestamp: a.timestamp ?? '',
    priority: priority === 'high' || priority === 'urgent'
      ? 'high'
      : priority === 'low'
        ? 'low'
        : 'medium',
  };
}

function mapTranscriptLine(l: ApiTranscriptLine): TranscriptLine {
  return {
    id: l.id,
    timestamp: l.timestamp,
    speaker: l.speaker,
    text: l.text,
    highlighted: l.highlighted,
  };
}

function mapNotes(notes?: ApiNote[]): MeetingNote[] {
  return (notes ?? []).map((n) => ({
    id: n.id,
    content: n.content,
    contentHtml: n.contentHtml ?? null,
    updatedAt: n.updatedAt,
  }));
}

/** Map a full API meeting (detail or list row) to the UI `Meeting`. */
export function mapApiMeeting(api: ApiMeeting): Meeting {
  const decisions = api.keyDecisions ?? [];
  const summary = api.aiSummary ?? '';
  const notes = mapNotes(api.notes);
  // Manual/live recordings never populate attendees — fall back to how many
  // distinct speakers Deepgram diarized so the count isn't misleadingly 0.
  const attendeeCount = api.attendees?.length || api.speakerCount || 0;

  return {
    id: api.id,
    title: api.title,
    status: STATUS_MAP[api.status] ?? 'completed',
    displayDate: formatDate(api.startTime),
    startedAt: formatDateTime(api.startTime),
    startTimeIso: api.startTime,
    duration: humanizeDuration(api.duration),
    audioDurationSeconds: api.audioDuration ?? undefined,
    audioUrl: api.audioUrl ?? undefined,
    participantCount: attendeeCount,
    attendees: api.attendees,
    platform: api.platform,
    platformUrl: api.platformUrl,
    summarySnippet: summary ? summary.slice(0, 180) : 'No summary generated yet.',
    summaryHtml: api.summaryHtml ?? undefined,
    tags: (api.tags ?? []).map((t) => t.name),
    decisions,
    transcript: (api.transcript ?? []).map(mapTranscriptLine),
    actionItems: (api.actionItems ?? []).map(mapActionItem),
    meetingNotes: notes,
    notes: notes[0]?.content ?? '',
    aiSummary: summary,
    processingError: api.processingError ?? null,
    actionItemCount: api._count?.actionItems ?? api.actionItems?.length ?? 0,
    isFavorite: false,
  };
}

// ----- API calls -----

export async function fetchMeetings(): Promise<Meeting[]> {
  const res = await apiRequest<{ meetings: ApiMeeting[] }>('/api/meetings');
  return res.meetings.map(mapApiMeeting);
}

export async function searchMeetingsApi(query: string): Promise<Meeting[]> {
  const res = await apiRequest<{ meetings: ApiMeeting[] }>(
    `/api/meetings/search?q=${encodeURIComponent(query)}`
  );
  return res.meetings.map(mapApiMeeting);
}

export async function fetchMeetingDetail(id: string): Promise<Meeting> {
  const res = await apiRequest<{ meeting: ApiMeeting }>(`/api/meetings/${id}`);
  return mapApiMeeting(res.meeting);
}

export async function deleteMeetingApi(id: string): Promise<void> {
  await apiRequest(`/api/meetings/${id}`, { method: 'DELETE' });
}

export async function reprocessMeetingApi(id: string): Promise<void> {
  await apiRequest(`/api/meetings/${id}/reprocess`, { method: 'POST' });
}

export async function createNoteApi(
  meetingId: string,
  content: string,
  contentHtml?: string
): Promise<MeetingNote> {
  const res = await apiRequest<{ note: ApiNote }>(`/api/meetings/${meetingId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content, contentHtml }),
  });
  return { id: res.note.id, content: res.note.content, contentHtml: res.note.contentHtml };
}

export async function updateNoteApi(
  noteId: string,
  content: string,
  contentHtml?: string
): Promise<MeetingNote> {
  const res = await apiRequest<{ note: ApiNote }>(`/api/meetings/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content, contentHtml }),
  });
  return { id: res.note.id, content: res.note.content, contentHtml: res.note.contentHtml };
}

export async function createLiveMeetingApi(title: string): Promise<ApiMeeting> {
  const res = await apiRequest<{ meeting: ApiMeeting }>('/api/live/meetings', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return res.meeting;
}

export async function deleteNoteApi(noteId: string): Promise<void> {
  await apiRequest(`/api/meetings/notes/${noteId}`, { method: 'DELETE' });
}

/** Rename a meeting (used by the live-recording title field). */
export async function updateMeetingTitleApi(id: string, title: string): Promise<void> {
  await apiRequest(`/api/meetings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function completeMeetingApi(id: string): Promise<void> {
  await apiRequest(`/api/meetings/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface AudioUploadResult {
  /** Cloudinary URL when stored, else null. */
  audioUrl: string | null;
  /** False when the server accepted the request but did not persist audio
   *  (e.g. Cloudinary not configured). */
  stored: boolean;
}

/** Upload a recorded audio blob for a meeting. Returns whether it was stored.
 *  Throws with the server's error detail on failure so callers can log it. */
export async function uploadMeetingAudioApi(id: string, blob: Blob): Promise<AudioUploadResult> {
  const token = localStorage.getItem(TOKEN_KEY);
  const form = new FormData();
  const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', blob, `recording.${ext}`);
  const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
  console.info(`[audio] POST /meetings/${id}/audio — ${blob.type || 'unknown type'}, ${sizeMb} MB`);
  const response = await fetch(`${BACKEND_URL}/api/meetings/${id}/audio`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    // Include the server body (the backend logs the real Cloudinary error too)
    // so the failure reason is visible instead of a bare status code.
    const detail = await response.text().catch(() => '');
    throw new Error(`Audio upload failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const data = (await response.json().catch(() => ({}))) as Partial<AudioUploadResult>;
  console.info(`[audio] server response for meeting ${id}:`, data);
  return { audioUrl: data.audioUrl ?? null, stored: Boolean(data.stored) };
}

/** Import an audio file as a new meeting (upload + transcribe + process). Returns the meeting id. */
export async function importAudioApi(file: File): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const form = new FormData();
  form.append('audio', file, file.name);
  const response = await fetch(`${BACKEND_URL}/api/meetings/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) throw new Error(`Import failed (HTTP ${response.status})`);
  const data = (await response.json()) as { meeting: ApiMeeting };
  return data.meeting.id;
}

// ----- Pre-meeting intelligence -----

export interface PreMeetingInput {
  title: string;
  description?: string;
  attendees: Array<{ name: string; email?: string | null }>;
}

export interface PreMeetingBrief {
  brief: { briefing: string; suggestedTopics: string[]; reminders: string[] };
  enrichmentEnabled: boolean;
  attendees: Array<{
    name: string;
    email: string | null;
    linkedinUrl?: string | null;
    bio?: string | null;
  }>;
  pastMeetings: Array<{ id: string; title: string; startTime: string; summary: string | null }>;
  openActionItems: Array<{
    id: string;
    task: string;
    assignee: string | null;
    dueDate: string | null;
    meetingId: string;
  }>;
}

export async function fetchPreMeetingBrief(input: PreMeetingInput): Promise<PreMeetingBrief> {
  return apiRequest<PreMeetingBrief>('/api/intelligence/pre-meeting', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Download a meeting export (markdown or pdf) with auth, triggering a browser save. */
export async function downloadMeetingExport(
  meetingId: string,
  format: 'md' | 'pdf',
  filename: string
): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${BACKEND_URL}/api/meetings/${meetingId}/export.${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Export failed (HTTP ${response.status})`);

  const blob = await response.blob();
  triggerBlobDownload(blob, `${filename}.${format}`);
}

/**
 * Save a Blob to the user's device via a synthetic `<a download>` click.
 *
 * The object URL is revoked on a delay rather than synchronously: while a
 * browser/OS "Save as…" dialog is open the blob hasn't been read yet, and
 * revoking immediately can cancel the pending download (the file never lands on
 * disk). A one-minute delay comfortably outlives the save without leaking.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Share a meeting report by email (via the user's connected Gmail). */
export async function shareMeetingEmailApi(meetingId: string, recipients: string[]): Promise<void> {
  await apiRequest(`/api/meetings/${meetingId}/share/email`, {
    method: 'POST',
    body: JSON.stringify({ recipients }),
  });
}

/** Post a meeting report to a Slack channel. */
export async function shareMeetingSlackApi(meetingId: string, channel: string): Promise<void> {
  await apiRequest(`/api/meetings/${meetingId}/share/slack`, {
    method: 'POST',
    body: JSON.stringify({ channel }),
  });
}

/** List Slack channels available for sharing (throws if Slack unconfigured). */
export async function getSlackChannelsApi(): Promise<{ id: string; name: string }[]> {
  const res = await apiRequest<{ channels: { id: string; name: string }[] }>(
    '/api/integrations/slack/channels'
  );
  return res.channels;
}

/**
 * Stream a RAG-grounded answer about a meeting via SSE
 * (`/api/live/meetings/:id/ask`). Tokens arrive incrementally; resolves with the
 * full answer + optional timestamp. Throws on transport/LLM error.
 */
export async function streamMeetingAnswer(
  meetingId: string,
  question: string,
  handlers: { onToken: (token: string) => void }
): Promise<{ answer: string; timestamp?: string }> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${BACKEND_URL}/api/live/meetings/${meetingId}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ask failed (HTTP ${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let timestamp: string | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let payload: { token?: string; done?: boolean; error?: string; timestamp?: string };
      try {
        payload = JSON.parse(line.slice(6)) as typeof payload;
      } catch {
        continue;
      }
      if (payload.error) throw new Error(payload.error);
      if (payload.token) {
        answer += payload.token;
        handlers.onToken(payload.token);
      }
      if (payload.done) timestamp = payload.timestamp;
    }
  }

  return { answer, timestamp };
}

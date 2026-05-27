import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User } from '../contexts/auth-context';

// ========================================
// Auth Store
// ========================================

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        isLoading: true,
        setAuth: (token, user) => set({ token, user, isLoading: false }),
        clearAuth: () => set({ token: null, user: null, isLoading: false }),
        setLoading: (loading) => set({ isLoading: loading }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ token: state.token, user: state.user }),
      }
    )
  )
);

// ========================================
// Meeting Store
// ========================================

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  status: 'SCHEDULED' | 'LIVE' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  audioUrl?: string;
  aiSummary?: string;
  transcript?: TranscriptLine[];
  actionItems?: ActionItem[];
  attendees?: Attendee[];
  tags?: Tag[];
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  timestampSeconds: number;
  confidence?: number;
  highlighted: boolean;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface Attendee {
  id: string;
  name: string;
  email?: string;
  role?: string;
  company?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface MeetingState {
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setMeetings: (meetings: Meeting[]) => void;
  setCurrentMeeting: (meeting: Meeting | null) => void;
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMeetingStore = create<MeetingState>()(
  devtools((set) => ({
    meetings: [],
    currentMeeting: null,
    isLoading: false,
    error: null,

    setMeetings: (meetings) => set({ meetings, isLoading: false }),
    setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
    addMeeting: (meeting) => set((state) => ({ meetings: [meeting, ...state.meetings] })),
    updateMeeting: (id, updates) =>
      set((state) => ({
        meetings: state.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        currentMeeting:
          state.currentMeeting?.id === id
            ? { ...state.currentMeeting, ...updates }
            : state.currentMeeting,
      })),
    deleteMeeting: (id) =>
      set((state) => ({
        meetings: state.meetings.filter((m) => m.id !== id),
        currentMeeting: state.currentMeeting?.id === id ? null : state.currentMeeting,
      })),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
  }))
);

// ========================================
// Live Recording Store
// ========================================

interface LiveRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  currentMeetingId: string | null;
  liveTranscript: TranscriptLine[];
  
  // Actions
  startRecording: (meetingId: string) => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  addTranscriptLine: (line: TranscriptLine) => void;
  setElapsedSeconds: (seconds: number) => void;
  reset: () => void;
}

export const useLiveRecordingStore = create<LiveRecordingState>()(
  devtools((set) => ({
    isRecording: false,
    isPaused: false,
    elapsedSeconds: 0,
    currentMeetingId: null,
    liveTranscript: [],

    startRecording: (meetingId) =>
      set({
        isRecording: true,
        isPaused: false,
        currentMeetingId: meetingId,
        liveTranscript: [],
        elapsedSeconds: 0,
      }),
    stopRecording: () =>
      set({
        isRecording: false,
        isPaused: false,
        elapsedSeconds: 0,
      }),
    pauseRecording: () => set({ isPaused: true }),
    resumeRecording: () => set({ isPaused: false }),
    addTranscriptLine: (line) =>
      set((state) => ({
        liveTranscript: [...state.liveTranscript, line],
      })),
    setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),
    reset: () =>
      set({
        isRecording: false,
        isPaused: false,
        elapsedSeconds: 0,
        currentMeetingId: null,
        liveTranscript: [],
      }),
  }))
);

// ========================================
// AI Chat Store
// ========================================

export interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: string;
}

interface AIChatState {
  messages: ChatMessage[];
  isAsking: boolean;
  streamingMessageId: string | null;
  currentAnswer: string;
  
  // Actions
  addMessage: (message: ChatMessage) => void;
  startStreaming: (messageId: string, question: string) => void;
  appendToStream: (token: string) => void;
  completeStream: () => void;
  setError: (messageId: string, error: string) => void;
  clearMessages: () => void;
}

export const useAIChatStore = create<AIChatState>()(
  devtools((set) => ({
    messages: [],
    isAsking: false,
    streamingMessageId: null,
    currentAnswer: '',

    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),
    startStreaming: (messageId, question) =>
      set({
        isAsking: true,
        streamingMessageId: messageId,
        currentAnswer: '',
        messages: [
          ...useAIChatStore.getState().messages,
          {
            id: messageId,
            question,
            answer: '',
            timestamp: new Date(),
            isStreaming: true,
          },
        ],
      }),
    appendToStream: (token) =>
      set((state) => ({
        currentAnswer: state.currentAnswer + token,
        messages: state.messages.map((msg) =>
          msg.id === state.streamingMessageId
            ? { ...msg, answer: state.currentAnswer + token }
            : msg
        ),
      })),
    completeStream: () =>
      set((state) => ({
        isAsking: false,
        streamingMessageId: null,
        currentAnswer: '',
        messages: state.messages.map((msg) =>
          msg.id === state.streamingMessageId ? { ...msg, isStreaming: false } : msg
        ),
      })),
    setError: (messageId, error) =>
      set((state) => ({
        isAsking: false,
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, error, isStreaming: false } : msg
        ),
      })),
    clearMessages: () => set({ messages: [], isAsking: false, streamingMessageId: null }),
  }))
);

// ========================================
// UI Store (Loading States)
// ========================================

interface UIState {
  loadingStates: Record<string, boolean>;
  errors: Record<string, string>;
  
  // Actions
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;
  clearError: (key: string) => void;
  clearAllErrors: () => void;
}

export const useUIStore = create<UIState>()(
  devtools((set) => ({
    loadingStates: {},
    errors: {},

    setLoading: (key, loading) =>
      set((state) => ({
        loadingStates: { ...state.loadingStates, [key]: loading },
      })),
    setError: (key, error) =>
      set((state) => ({
        errors: error ? { ...state.errors, [key]: error } : state.errors,
      })),
    clearError: (key) =>
      set((state) => {
        const { [key]: _, ...rest } = state.errors;
        return { errors: rest };
      }),
    clearAllErrors: () => set({ errors: {} }),
  }))
);

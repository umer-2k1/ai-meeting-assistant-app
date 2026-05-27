type DesktopRecordingState = {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  blockedReason?: 'microphone';
  permissionStatus?: string;
};

type DesktopTranscriptLine = {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  highlighted?: boolean;
};

type DesktopAppInfo = {
  platform: string;
  versions: Record<string, string>;
};

type WidgetSize = {
  width: number;
  height: number;
};

type WidgetSizeLimits = WidgetSize & {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
};

type ThemePreference = 'dark' | 'light' | 'system';

type DesktopApi = {
  app: {
    getInfo: () => Promise<DesktopAppInfo>;
  };
  theme: {
    broadcast: (preference: ThemePreference) => Promise<{ ok: boolean }>;
    onChange: (callback: (preference: ThemePreference) => void) => () => void;
  };
  permissions: {
    getAll: () => Promise<{
      platform: string;
      microphone: { status: string; granted: boolean; canRequest?: boolean };
      accessibility: { status: string; granted: boolean; canRequest?: boolean };
      notifications: { status: string; granted: boolean; canRequest?: boolean };
    }>;
    requestMicrophone: () => Promise<{ status: string; granted: boolean }>;
    requestAccessibility: () => Promise<{ status: string; granted: boolean }>;
    openSettings: (target: 'microphone' | 'accessibility' | 'notifications') => Promise<{ ok: boolean }>;
  };
  recording: {
    start: () => Promise<DesktopRecordingState>;
    pauseResume: () => Promise<DesktopRecordingState>;
    stop: () => Promise<DesktopRecordingState>;
    getStatus: () => Promise<DesktopRecordingState>;
    onStateChange: (callback: (state: DesktopRecordingState) => void) => () => void;
    onTranscript: (callback: (line: DesktopTranscriptLine) => void) => () => void;
  };
  widget: {
    setExpanded: (expanded: boolean) => Promise<{
      expanded: boolean;
      size: WidgetSize;
      limits: WidgetSizeLimits | null;
    }>;
    openMain: () => Promise<{ ok: boolean }>;
    dragStart: () => Promise<{ ok: boolean }>;
    dragMove: () => Promise<{ ok: boolean }>;
    dragEnd: () => Promise<{ ok: boolean }>;
    resizeStart: (edge: 'corner' | 'right' | 'bottom') => Promise<{ ok: boolean; limits?: WidgetSizeLimits }>;
    resizeMove: () => Promise<{ ok: boolean; size?: WidgetSize; limits?: WidgetSizeLimits }>;
    resizeEnd: () => Promise<{ ok: boolean }>;
  };
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export {};

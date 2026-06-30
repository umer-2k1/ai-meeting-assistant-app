type DesktopRecordingState = {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  blockedReason?: 'microphone' | 'systemAudio';
  permissionStatus?: string;
};

type DesktopTranscriptLine = {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  highlighted?: boolean;
};

export type DesktopAppInfo = {
  platform: string;
  versions: Record<string, string>;
  name?: string;
  execPath?: string;
  isPackaged?: boolean;
  /** Name shown in System Settings → System Audio Recording (often "Electron" during dev). */
  settingsAppName?: string;
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

type DesktopCaptureSource = {
  id: string;
  name: string;
  displayId?: string;
};

type DesktopPermissionTarget = 'accessibility' | 'microphone' | 'systemAudio' | 'notifications';

type DesktopPermissionItem = {
  id: DesktopPermissionTarget;
  title: string;
  description: string;
  requestKind: 'systemPrompt' | 'settingsOnly';
  icon: 'accessibility' | 'microphone' | 'systemAudio' | 'notifications';
  snapshot: { status: string; granted: boolean; canRequest?: boolean };
  action: 'grantAccess' | 'openSettings';
  helpText: string | null;
};

type DesktopApi = {
  app: {
    getInfo: () => Promise<DesktopAppInfo>;
  };
  auth: {
    openExternal: (url: string) => Promise<{ ok: boolean }>;
    onCallback: (callback: (payload: { url: string }) => void) => () => void;
    consumePendingCallback: () => Promise<{ url: string } | null>;
  };
  theme: {
    broadcast: (preference: ThemePreference) => Promise<{ ok: boolean }>;
    onChange: (callback: (preference: ThemePreference) => void) => () => void;
  };
  permissions: {
    getAll: () => Promise<{
      platform: string;
      items: DesktopPermissionItem[];
    }>;
    getSettings: () => Promise<{
      platform: string;
      items: DesktopPermissionItem[];
    }>;
    requestMicrophone: () => Promise<{ status: string; granted: boolean }>;
    requestAccessibility: () => Promise<{ status: string; granted: boolean }>;
    requestNotifications: () => Promise<{ status: string; granted: boolean }>;
    openSettings: (target: DesktopPermissionTarget) => Promise<{ ok: boolean }>;
  };
  deviceCheck: {
    listCaptureSources: () => Promise<{
      sources: DesktopCaptureSource[];
      screenPermission?: string;
      error?: string;
    }>;
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
    resizeStart: (
      edge: 'corner' | 'right' | 'bottom'
    ) => Promise<{ ok: boolean; limits?: WidgetSizeLimits }>;
    resizeMove: () => Promise<{ ok: boolean; size?: WidgetSize; limits?: WidgetSizeLimits }>;
    resizeEnd: () => Promise<{ ok: boolean }>;
  };
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

type DesktopRecordingState = {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
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

type DesktopApi = {
  app: {
    getInfo: () => Promise<DesktopAppInfo>;
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

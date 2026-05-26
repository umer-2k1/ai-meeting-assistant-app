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
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export {};

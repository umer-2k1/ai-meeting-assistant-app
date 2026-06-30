/**
 * Audio Recording Service - DEPRECATED
 *
 * This service was designed to run in the Electron main process, but it uses
 * renderer-only APIs (navigator, MediaRecorder, AudioContext, Blob) which are
 * not available in the main process.
 *
 * ISSUES:
 * 1. desktopCapturer.getSources({ types: ['audio'] }) - 'audio' type doesn't exist,
 *    only 'screen' and 'window' are valid
 * 2. navigator.mediaDevices.getUserMedia() - `navigator` doesn't exist in main process
 * 3. MediaRecorder - doesn't exist in main process
 * 4. AudioContext - doesn't exist in main process
 * 5. Blob - doesn't exist in main process
 *
 * CORRECT ARCHITECTURE:
 * - Main process: Handle permissions, manage state, emit events
 * - Renderer process: Call getDisplayMedia(), use MediaRecorder/AudioContext,
 *   send audio to Deepgram, optionally send chunks to main via IPC for saving
 *
 * For a working example of system audio capture, see:
 * frontend/src/features/meeting-copilot/use-system-audio-test.ts
 *
 * That file correctly:
 * 1. Runs in the RENDERER process
 * 2. Uses getDisplayMedia() to get system audio
 * 3. Uses MediaRecorder to record
 * 4. Uses AudioContext to analyze audio levels
 *
 * TODO: Create a proper renderer-side recording service for live meetings
 */

class AudioRecordingService {
  constructor() {
    this.isRecording = false;
    console.warn(
      '[AudioRecordingService] This service is deprecated and non-functional. ' +
        'Audio recording must be moved to the renderer process to use MediaRecorder and AudioContext APIs.'
    );
  }

  async startRecording() {
    throw new Error(
      'AudioRecordingService cannot run in the main process. ' +
        'Audio recording must use renderer APIs (navigator, MediaRecorder, AudioContext). ' +
        'See frontend/src/features/meeting-copilot/use-system-audio-test.ts for a working example.'
    );
  }

  pauseRecording() {
    // No-op
  }

  resumeRecording() {
    // No-op
  }

  async stopRecording() {
    return { recordingPath: null };
  }

  getStatus() {
    return {
      isRecording: false,
      meetingId: null,
      hasDeepgram: false
    };
  }
}

module.exports = AudioRecordingService;

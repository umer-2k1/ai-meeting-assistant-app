/**
 * Audio Recording Service for Electron
 * Captures system audio and microphone, streams to Deepgram for transcription
 */

const { desktopCapturer } = require('electron');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const SAMPLE_RATE = 16000; // Deepgram recommended

class AudioRecordingService {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.deepgramClient = null;
    this.deepgramConnection = null;
    this.transcriptCallback = null;
    this.errorCallback = null;
    this.currentMeetingId = null;
    this.recordingFilePath = null;
  }

  /**
   * Initialize Deepgram client
   */
  initializeDeepgram() {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    this.deepgramClient = createClient(DEEPGRAM_API_KEY);
  }

  /**
   * Start recording and transcription
   */
  async startRecording(meetingId, callbacks = {}) {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.currentMeetingId = meetingId;
    this.transcriptCallback = callbacks.onTranscript || (() => {});
    this.errorCallback = callbacks.onError || console.error;

    try {
      // Initialize Deepgram
      this.initializeDeepgram();

      // Get audio sources
      const sources = await desktopCapturer.getSources({
        types: ['audio'],
        fetchWindowIcons: false,
      });

      // Create audio constraints
      const audioConstraints = {
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sources[0]?.id,
          },
        },
      };

      // Get user media stream
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

      // Set up MediaRecorder for saving audio file
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveRecording();
      };

      // Start MediaRecorder
      this.mediaRecorder.start(1000); // Collect data every second

      // Set up Deepgram live transcription
      await this.startDeepgramTranscription(stream);

      this.isRecording = true;

      return { success: true };
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.errorCallback(error);
      throw error;
    }
  }

  /**
   * Start Deepgram live transcription
   */
  async startDeepgramTranscription(stream) {
    try {
      // Create Deepgram connection
      this.deepgramConnection = this.deepgramClient.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: true,
        interim_results: false,
        utterance_end_ms: 1500,
        sample_rate: SAMPLE_RATE,
        channels: 1,
        encoding: 'linear16',
      });

      // Handle Deepgram events
      this.deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('[Deepgram] Connection opened');

        // Get audio context
        const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)({
          sampleRate: SAMPLE_RATE,
        });

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Process audio and send to Deepgram
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array for Deepgram
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
          }

          // Send to Deepgram
          if (this.deepgramConnection && this.isRecording) {
            this.deepgramConnection.send(int16Data.buffer);
          }
        };

        this.audioProcessor = processor;
        this.audioContext = audioContext;
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0];
        if (transcript && transcript.transcript) {
          this.handleTranscript(transcript);
        }
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('[Deepgram] Error:', error);
        this.errorCallback(error);
      });

      this.deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('[Deepgram] Connection closed');
      });

    } catch (error) {
      console.error('[Deepgram] Failed to start transcription:', error);
      throw error;
    }
  }

  /**
   * Handle incoming transcript from Deepgram
   */
  handleTranscript(transcript) {
    // Extract speaker and text
    const words = transcript.words || [];
    const speaker = words[0]?.speaker !== undefined ? `Speaker ${words[0].speaker}` : 'Speaker 1';
    const text = transcript.transcript;
    const confidence = transcript.confidence || 0.9;

    // Send to callback (which will emit to renderer)
    this.transcriptCallback({
      id: `transcript-${Date.now()}-${Math.random()}`,
      speaker,
      text,
      timestamp: this.formatTimestamp(Date.now()),
      confidence,
      highlighted: false,
    });
  }

  /**
   * Format timestamp from milliseconds
   */
  formatTimestamp(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
    // Deepgram will continue listening but we won't send audio
    this.isRecording = false;
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
    this.isRecording = true;
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    this.isRecording = false;

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Close Deepgram connection
    if (this.deepgramConnection) {
      this.deepgramConnection.finish();
      this.deepgramConnection = null;
    }

    // Stop audio processor
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    return { recordingPath: this.recordingFilePath };
  }

  /**
   * Save recording to file
   */
  saveRecording() {
    if (this.audioChunks.length === 0) {
      console.warn('No audio chunks to save');
      return;
    }

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const userDataPath = app.getPath('userData');
      const recordingsDir = path.join(userDataPath, 'recordings');

      // Create recordings directory if it doesn't exist
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const fileName = `recording-${this.currentMeetingId || Date.now()}.webm`;
      this.recordingFilePath = path.join(recordingsDir, fileName);

      // Convert blob to buffer and save
      audioBlob.arrayBuffer().then((buffer) => {
        fs.writeFileSync(this.recordingFilePath, Buffer.from(buffer));
        console.log(`Recording saved to: ${this.recordingFilePath}`);
      });
    } catch (error) {
      console.error('Failed to save recording:', error);
      this.errorCallback(error);
    }
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      meetingId: this.currentMeetingId,
      hasDeepgram: !!this.deepgramConnection,
    };
  }
}

module.exports = AudioRecordingService;

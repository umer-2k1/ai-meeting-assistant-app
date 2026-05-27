import { useState, useEffect, useCallback } from 'react';
import { useAIChatStore } from './stores';
import { apiRequest } from './api-client';

type SsePayload = {
  token?: string;
  done?: boolean;
  error?: string;
  timestamp?: string;
};

interface UseStreamingChatOptions {
  meetingId?: string;
  onComplete?: (answer: string) => void;
  onError?: (error: Error) => void;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const { startStreaming, appendToStream, completeStream, setError: setStoreError } = useAIChatStore();
  const [isConnected, setIsConnected] = useState(false);

  const askQuestion = useCallback(
    async (question: string) => {
      if (!question.trim()) return;

      const messageId = crypto.randomUUID();
      startStreaming(messageId, question);

      try {
        const backendUrl = import.meta.env['VITE_BACKEND_URL'] || 'http://localhost:3001';
        const endpoint = options.meetingId
          ? `/api/live/meetings/${options.meetingId}/ask`
          : '/api/ask';

        const token = localStorage.getItem('ai_meeting_token');
        const url = `${backendUrl}${endpoint}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            question,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        setIsConnected(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullAnswer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setIsConnected(false);
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as SsePayload;

                if (data.token) {
                  fullAnswer += data.token;
                  appendToStream(data.token);
                } else if (data.done) {
                  completeStream();
                  options.onComplete?.(fullAnswer);
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        setStoreError(messageId, (error as Error).message);
        options.onError?.(error as Error);
        setIsConnected(false);
      }
    },
    [options.meetingId, startStreaming, appendToStream, completeStream, setStoreError, options]
  );

  return {
    askQuestion,
    isConnected,
  };
}

/**
 * Hook for fetching meetings with loading state
 */
export function useMeetings() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{ meetings: any[] }>('/api/meetings');
      setMeetings(response.meetings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return {
    meetings,
    isLoading,
    error,
    refetch: fetchMeetings,
  };
}

/**
 * Hook for real-time transcript saving
 */
export function useLiveTranscript(meetingId: string) {
  const saveTranscriptLine = useCallback(
    async (line: {
      speaker: string;
      text: string;
      timestamp: string;
      timestampSeconds: number;
      confidence?: number;
    }) => {
      try {
        await apiRequest(`/api/live/meetings/${meetingId}/transcript`, {
          method: 'POST',
          body: JSON.stringify(line),
        });
      } catch (error) {
        console.error('Failed to save transcript line:', error);
        // Don't throw - we don't want to break the recording flow
      }
    },
    [meetingId]
  );

  return { saveTranscriptLine };
}

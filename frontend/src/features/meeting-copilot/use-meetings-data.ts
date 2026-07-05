import { useCallback, useEffect, useState } from 'react';

import { fetchMeetingDetail, fetchMeetings } from './meetings-api';
import type { Meeting } from './types';

interface ListState {
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Fetch the authenticated user's meetings with loading/error state. */
export function useMeetingList(): ListState {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMeetings(await fetchMeetings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { meetings, isLoading, error, refetch };
}

interface DetailState {
  meeting: Meeting | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setMeeting: (updater: (prev: Meeting | null) => Meeting | null) => void;
}

/** Fetch a single meeting's full detail. Pass `null` id to stay idle. */
export function useMeetingDetail(id: string | null): DetailState {
  const [meeting, setMeetingState] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setMeetingState(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setMeetingState(await fetchMeetingDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setMeeting = useCallback(
    (updater: (prev: Meeting | null) => Meeting | null) => {
      setMeetingState((prev) => updater(prev));
    },
    []
  );

  return { meeting, isLoading, error, refetch, setMeeting };
}

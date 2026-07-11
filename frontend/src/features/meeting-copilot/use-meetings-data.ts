import { useCallback, useEffect, useRef, useState } from 'react';

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
  // Once we've loaded successfully, later refetches are background refreshes
  // (the dashboard polls every few seconds while a recording finalizes). Those
  // must update the list in place — flipping `isLoading`/`error` on every poll
  // is what made the dashboard flash to skeletons (and briefly to the error
  // card) every few seconds.
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    const initial = !hasLoadedRef.current;
    if (initial) setIsLoading(true);
    try {
      const next = await fetchMeetings();
      setMeetings(next);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      // Only surface a load error before the first successful load. A failed
      // background refresh keeps the last good list rather than replacing the
      // dashboard with an error state and flickering back on the next poll.
      if (initial) setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      if (initial) setIsLoading(false);
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
  // The id of the meeting we've already loaded. Refetching the *same* id is a
  // background refresh (e.g. polling a still-processing meeting) and must not
  // flash the loader or clobber the meeting on a transient failure; switching
  // to a *different* id is a navigation and still shows the loader.
  const loadedIdRef = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setMeetingState(null);
      loadedIdRef.current = null;
      return;
    }
    const isNewMeeting = loadedIdRef.current !== id;
    if (isNewMeeting) setIsLoading(true);
    try {
      setMeetingState(await fetchMeetingDetail(id));
      setError(null);
      loadedIdRef.current = id;
    } catch (err) {
      if (isNewMeeting) setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      if (isNewMeeting) setIsLoading(false);
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

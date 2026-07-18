import { useCallback, useEffect, useState } from 'react';

import { getIntegrationStatus, type IntegrationStatus } from '@/lib/integrations-api';

export type IntegrationId = 'gmail' | 'slack' | 'calendar';

export const INTEGRATION_LABELS: Record<IntegrationId, string> = {
  gmail: 'Gmail',
  slack: 'Slack',
  calendar: 'Google Calendar'
};

export type IntegrationHealth = {
  status: IntegrationStatus | null;
  /** Providers whose stored grant was revoked/expired — only re-consent fixes these. */
  revoked: IntegrationId[];
  /** The status call itself failed, so every flag below is unknown, not false. */
  statusError: string | null;
  loading: boolean;
  refetch: (options?: { showLoading?: boolean }) => Promise<void>;
};

/**
 * Shared read of `/api/integrations/status`.
 *
 * A revoked Google grant can only be fixed by re-consenting, so it has to be
 * surfaced wherever the user is — not just on the Settings screen they have no
 * reason to open. Consumers distinguish three states, and conflating any two of
 * them is what made a dead Gmail grant invisible:
 *   - connected
 *   - never connected  (offer "Connect")
 *   - revoked/expired  (offer "Reconnect" and say why)
 */
export function useIntegrationHealth(options: { pollMs?: number } = {}): IntegrationHealth {
  const { pollMs } = options;
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (opts: { showLoading?: boolean } = {}) => {
    try {
      if (opts.showLoading) setLoading(true);
      const next = await getIntegrationStatus();
      setStatus(next);
      setStatusError(null);
    } catch (error) {
      // Don't leave stale flags reading as truth, and don't let the failure look
      // like "nothing is connected" — that is the ambiguity this hook exists to kill.
      setStatus(null);
      setStatusError(
        error instanceof Error ? error.message : 'Could not load integration status'
      );
    } finally {
      if (opts.showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch({ showLoading: true });
  }, [refetch]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = globalThis.setInterval(() => void refetch(), pollMs);
    return () => globalThis.clearInterval(timer);
  }, [pollMs, refetch]);

  const revoked = (['gmail', 'calendar', 'slack'] as const).filter((id) =>
    Boolean(status?.[id]?.needsReconnect)
  );

  return { status, revoked, statusError, loading, refetch };
}

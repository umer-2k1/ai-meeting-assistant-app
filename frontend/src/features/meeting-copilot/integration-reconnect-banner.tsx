import { useState } from 'react';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';

import { INTEGRATION_LABELS, type IntegrationId } from './use-integration-health';

/**
 * App-wide notice that a Google grant died. Without this the only surface that
 * ever said so was Settings → Integrations, so a revoked Gmail token stayed
 * invisible until a send failed.
 */
export default function IntegrationReconnectBanner({
  revoked,
  onManageIntegrations
}: {
  revoked: IntegrationId[];
  onManageIntegrations: () => void;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = revoked.join(',');

  if (revoked.length === 0 || dismissed === key) return null;

  const names = revoked.map((id) => INTEGRATION_LABELS[id]);
  const listed =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  return (
    <div
      role='status'
      className='mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3'
    >
      <IconAlertTriangle className='size-4 shrink-0 text-destructive' stroke={1.75} />
      <p className='min-w-0 flex-1 text-sm text-foreground'>
        <span className='font-medium'>{listed}</span> lost access — the connection expired or
        was revoked. Reconnect to restore {names.length === 1 ? 'it' : 'them'}.
      </p>
      <Button
        size='sm'
        className='shrink-0 rounded-full px-4'
        onClick={onManageIntegrations}
      >
        Reconnect
      </Button>
      <Button
        size='sm'
        variant='ghost'
        aria-label='Dismiss'
        className='size-8 shrink-0 rounded-full p-0'
        onClick={() => setDismissed(key)}
      >
        <IconX className='size-4' />
      </Button>
    </div>
  );
}

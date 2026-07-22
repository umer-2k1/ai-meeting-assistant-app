import { useState, useEffect, useCallback } from 'react';

import {
  IconBrandGoogle,
  IconBrandSlack,
  IconCalendarEvent,
  IconDownload,
  IconHeadphones,
  IconMail,
  IconMicrophone,
  IconShieldLock,
  IconSparkles,
  IconTrash
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GoogleIntegrationProvider } from '@/lib/integrations-api';
import { cn } from '@/lib/utils';

import SettingsPermissionsPanel from './settings-permissions-panel';
import { SettingsRow, SettingsSection, SettingsSwitch } from './settings-ui';
import { useAuth } from '@/contexts/auth-context';
import { usePreferences } from '@/contexts/preferences-context';
import { useTheme } from '@/components/providers/theme';
import { BrandLoader } from '@/components/brand/brand-loader';

const AUDIO_DEVICES = [
  { value: 'default', label: 'System default' },
  { value: 'macbook', label: 'MacBook Microphone' },
  { value: 'usb', label: 'USB Audio Interface' }
] as const;

type IntegrationId = 'gmail' | 'slack' | 'calendar';

type IntegrationConfig = {
  id: IntegrationId;
  name: string;
  description: string;
  icon: typeof IconMail;
  iconClassName: string;
  features: Array<{ key: string; label: string; description: string }>;
};

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send follow-ups and share summaries from your inbox.',
    icon: IconMail,
    iconClassName: 'bg-[#EA4335]',
    features: [
      {
        key: 'autoFollowUp',
        label: 'Auto-generate follow-up emails',
        description: 'Draft a recap email when a meeting ends.'
      },
      {
        key: 'attachTranscript',
        label: 'Include transcript attachment',
        description: 'Attach the full transcript as a PDF.'
      },
      {
        key: 'smartRecipients',
        label: 'Smart recipient detection',
        description: 'Suggest attendees from the calendar invite.'
      }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post highlights and action items to your team channels.',
    icon: IconBrandSlack,
    iconClassName: 'bg-[#4A154B]',
    // Slack's settings are a real channel picker rendered by SlackChannelSettings,
    // not generic on/off switches.
    features: []
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Surface upcoming meetings and recording reminders.',
    icon: IconCalendarEvent,
    iconClassName: 'bg-[#4285F4]',
    features: [
      {
        key: 'showUpcoming',
        label: 'Show upcoming meetings',
        description: 'Display the next events on your dashboard.'
      },
      {
        key: 'preMeetingReminder',
        label: 'Pre-meeting reminder (5 min)',
        description: 'Notify you before a scheduled call starts.'
      },
      {
        key: 'syncFrequent',
        label: 'Sync every 15 minutes',
        description: 'Keep calendar data fresh while the app is open.'
      }
    ]
  }
];

function SettingsSelect({
  value,
  onValueChange,
  options,
  'aria-label': ariaLabel,
  className
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  'aria-label': string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={cn('min-w-[180px]', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AudioSettingsTab() {
  const [inputDevice, setInputDevice] = useState('macbook');
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGain, setAutoGain] = useState(true);
  const [monitorWhileRecording, setMonitorWhileRecording] = useState(false);

  return (
    <div className='space-y-4'>
      <SettingsSection
        title='Capture'
        description='Choose how meeting audio is picked up and cleaned before transcription.'
      >
        <SettingsRow
          label='Input device'
          description='Used for live sessions and the floating recorder widget.'
        >
          <SettingsSelect
            aria-label='Input device'
            value={inputDevice}
            onValueChange={setInputDevice}
            options={AUDIO_DEVICES.map((d) => ({ value: d.value, label: d.label }))}
          />
        </SettingsRow>
        <SettingsRow
          label='Noise suppression'
          description='Reduces keyboard clicks and background hum.'
        >
          <SettingsSwitch
            aria-label='Noise suppression'
            checked={noiseSuppression}
            onCheckedChange={setNoiseSuppression}
          />
        </SettingsRow>
        <SettingsRow
          label='Echo cancellation'
          description='Prevents feedback when speakers are in use.'
        >
          <SettingsSwitch
            aria-label='Echo cancellation'
            checked={echoCancellation}
            onCheckedChange={setEchoCancellation}
          />
        </SettingsRow>
        <SettingsRow label='Automatic gain control' description='Normalizes quiet speakers.'>
          <SettingsSwitch
            aria-label='Automatic gain control'
            checked={autoGain}
            onCheckedChange={setAutoGain}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title='Monitoring'>
        <SettingsRow
          label='Hear yourself while recording'
          description='Play back a low-latency monitor of your microphone.'
        >
          <SettingsSwitch
            aria-label='Hear yourself while recording'
            checked={monitorWhileRecording}
            onCheckedChange={setMonitorWhileRecording}
          />
        </SettingsRow>
      </SettingsSection>

      <div className='flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 px-5 py-4'>
        <IconHeadphones className='mt-0.5 size-4 shrink-0 text-primary' />
        <p className='text-sm leading-relaxed text-muted-foreground'>
          Microphone permission is managed under General → Permissions. If transcription fails,
          confirm access is enabled for this app in macOS System Settings.
        </p>
      </div>
    </div>
  );
}

function AiPreferencesTab() {
  const { preferences, updatePreferences } = usePreferences();
  const {
    summaryLength,
    actionSensitivity,
    responseStyle,
    includeTimestamps,
    highlightDecisions,
    suggestFollowups,
  } = preferences;

  return (
    <div className='space-y-4'>
      <SettingsSection
        title='Summaries'
        description='Control how meetings are condensed into notes and highlights.'
      >
        <SettingsRow label='Summary length' description='How much detail to keep in recap notes.'>
          <SettingsSelect
            aria-label='Summary length'
            value={summaryLength}
            onValueChange={(v) =>
              updatePreferences({ summaryLength: v as 'brief' | 'balanced' | 'detailed' })
            }
            options={[
              { value: 'brief', label: 'Brief' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'detailed', label: 'Detailed' }
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label='Action item sensitivity'
          description='How aggressively to detect tasks and owners.'
        >
          <SettingsSelect
            aria-label='Action item sensitivity'
            value={actionSensitivity}
            onValueChange={(v) =>
              updatePreferences({
                actionSensitivity: v as 'conservative' | 'balanced' | 'aggressive',
              })
            }
            options={[
              { value: 'conservative', label: 'Conservative' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'aggressive', label: 'Aggressive' }
            ]}
          />
        </SettingsRow>
        <SettingsRow label='Include timestamps' description='Link highlights to transcript times.'>
          <SettingsSwitch
            aria-label='Include timestamps'
            checked={includeTimestamps}
            onCheckedChange={(v) => updatePreferences({ includeTimestamps: v })}
          />
        </SettingsRow>
        <SettingsRow
          label='Highlight decisions'
          description='Call out agreements and open questions separately.'
        >
          <SettingsSwitch
            aria-label='Highlight decisions'
            checked={highlightDecisions}
            onCheckedChange={(v) => updatePreferences({ highlightDecisions: v })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title='Copilot chat' description='Tune answers when you ask questions live.'>
        <SettingsRow label='Response style' description='Tone and depth of AI replies.'>
          <SettingsSelect
            aria-label='Response style'
            value={responseStyle}
            onValueChange={(v) =>
              updatePreferences({
                responseStyle: v as 'concise' | 'explanatory' | 'structured',
              })
            }
            options={[
              { value: 'concise', label: 'Concise' },
              { value: 'explanatory', label: 'Explanatory' },
              { value: 'structured', label: 'Structured bullets' }
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label='Suggest follow-up questions'
          description='Offer quick prompts after each answer.'
        >
          <SettingsSwitch
            aria-label='Suggest follow-up questions'
            checked={suggestFollowups}
            onCheckedChange={(v) => updatePreferences({ suggestFollowups: v })}
          />
        </SettingsRow>
      </SettingsSection>

      <div className='flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-primary/5 px-5 py-4 dark:border-cyan-500/40'>
        <IconSparkles className='mt-0.5 size-4 shrink-0 text-primary' />
        <p className='text-sm leading-relaxed text-muted-foreground'>
          These preferences are saved to your account and applied to future meeting
          summaries, action-item extraction, and Copilot chat.
        </p>
      </div>
    </div>
  );
}

/**
 * Slack's real settings: which channel meeting summaries go to, and whether to
 * post automatically when a meeting finishes. Both persist server-side on the
 * Slack integration, so disconnecting clears them with the connection.
 */
function SlackChannelSettings({ connected }: { connected: boolean }) {
  const [channels, setChannels] = useState<Array<{ id: string; name: string }> | null>(null);
  const [prefs, setPrefs] = useState<{
    defaultChannelId: string | null;
    defaultChannelName: string | null;
    autoPost: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!connected) {
      setChannels(null);
      setPrefs(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const api = await import('@/lib/integrations-api');
        const [channelList, saved] = await Promise.all([
          api.getSlackChannels(),
          api.getSlackPreferences()
        ]);
        if (cancelled) return;
        setChannels(channelList);
        setPrefs(saved);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load Slack channels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected]);

  const persist = async (update: {
    defaultChannelId?: string | null;
    defaultChannelName?: string | null;
    autoPost?: boolean;
  }) => {
    setSaving(true);
    setError(null);
    try {
      const { saveSlackPreferences } = await import('@/lib/integrations-api');
      setPrefs(await saveSlackPreferences(update));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Slack settings');
    } finally {
      setSaving(false);
    }
  };

  if (!connected) return null;

  return (
    <div className='px-5 py-1'>
      <SettingsRow
        label='Default channel'
        description='Where meeting summaries are posted.'
      >
        {loading ? (
          <span className='text-xs text-muted-foreground'>Loading…</span>
        ) : (
          <Select
            value={prefs?.defaultChannelId ?? ''}
            disabled={saving || !channels?.length}
            onValueChange={(value) => {
              const picked = channels?.find((c) => c.id === value);
              void persist({
                defaultChannelId: value,
                defaultChannelName: picked?.name ?? null
              });
            }}
          >
            <SelectTrigger className='w-56'>
              <SelectValue placeholder='Select a channel' />
            </SelectTrigger>
            <SelectContent>
              {(channels ?? []).map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  #{channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SettingsRow>

      <SettingsRow
        label='Post automatically after each meeting'
        description={
          prefs?.defaultChannelId
            ? `Summaries post to #${prefs.defaultChannelName ?? 'the selected channel'} when processing finishes.`
            : 'Pick a default channel first.'
        }
      >
        <SettingsSwitch
          aria-label='Post automatically after each meeting'
          checked={prefs?.autoPost ?? false}
          disabled={saving || !prefs?.defaultChannelId}
          onCheckedChange={(enabled) => void persist({ autoPost: enabled })}
        />
      </SettingsRow>

      {error && <p className='pb-3 text-xs text-destructive'>{error}</p>}
      {!loading && channels?.length === 0 && (
        <p className='pb-3 text-xs text-muted-foreground'>
          No public channels found in this workspace. Create one in Slack, then reopen Settings.
        </p>
      )}
    </div>
  );
}

function IntegrationCard({
  config,
  connected,
  connecting,
  connectedEmail,
  needsReconnect,
  featureToggles,
  onConnectToggle,
  onFeatureToggle
}: {
  config: IntegrationConfig;
  connected: boolean;
  connecting?: boolean;
  connectedEmail?: string;
  needsReconnect?: boolean;
  featureToggles: Record<string, boolean>;
  onConnectToggle: () => void;
  onFeatureToggle: (key: string, enabled: boolean) => void;
}) {
  const Icon = config.icon;

  return (
    <article className='overflow-hidden rounded-2xl border border-border/70 bg-card/80'>
      <header className='flex flex-wrap items-start gap-4 border-b border-border/60 px-5 py-4'>
        <div
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white',
            config.iconClassName
          )}
        >
          <Icon className='size-5' stroke={1.75} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-sm font-semibold text-foreground'>{config.name}</h3>
            <Badge
              variant='outline'
              className={cn(
                'rounded-full border-0 px-2 py-0 text-[11px] font-medium',
                connected
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : needsReconnect
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {connecting
                ? 'Connecting…'
                : connected
                  ? 'Connected'
                  : needsReconnect
                    ? 'Reconnect required'
                    : 'Not connected'}
            </Badge>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {config.description}
            {connectedEmail && (
              <span className='block mt-1 text-xs'>
                {connectedEmail}
              </span>
            )}
            {!connected && needsReconnect && (
              <span className='mt-1 block text-xs text-destructive'>
                Access expired or was revoked — reconnect to restore this integration.
              </span>
            )}
          </p>
        </div>
        <Button
          size='sm'
          variant={connected ? 'outline' : 'default'}
          className='shrink-0 rounded-full px-4'
          onClick={onConnectToggle}
          disabled={connecting}
        >
          {connecting
            ? 'Connecting…'
            : connected
              ? 'Disconnect'
              : needsReconnect
                ? 'Reconnect'
                : 'Connect'}
        </Button>
      </header>
      {config.id === 'slack' && <SlackChannelSettings connected={connected} />}
      <div className={cn('px-5 py-1', !connected && 'pointer-events-none opacity-50')}>
        {config.features.map((feature) => (
          <SettingsRow key={feature.key} label={feature.label} description={feature.description}>
            <SettingsSwitch
              aria-label={feature.label}
              checked={featureToggles[feature.key] ?? false}
              disabled={!connected}
              onCheckedChange={(enabled) => {
                onFeatureToggle(feature.key, enabled);
              }}
            />
          </SettingsRow>
        ))}
      </div>
    </article>
  );
}

function IntegrationsTab() {
  const [connected, setConnected] = useState<Record<IntegrationId, boolean>>({
    gmail: false,
    slack: false,
    calendar: false
  });
  const [emails, setEmails] = useState<Record<IntegrationId, string | undefined>>({
    gmail: undefined,
    slack: undefined,
    calendar: undefined
  });
  /** Grant revoked/expired — only re-consent fixes it, so prompt instead of failing quietly. */
  const [needsReconnect, setNeedsReconnect] = useState<Record<IntegrationId, boolean>>({
    gmail: false,
    slack: false,
    calendar: false
  });
  const [loading, setLoading] = useState(true);
  /** Status fetch failed — the cards below show stale/empty state, so warn. */
  const [statusError, setStatusError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<Record<IntegrationId, boolean>>({
    gmail: false,
    slack: false,
    calendar: false
  });
  const [features, setFeatures] = useState<Record<IntegrationId, Record<string, boolean>>>({
    gmail: { autoFollowUp: true, attachTranscript: false, smartRecipients: true },
    slack: { defaultChannel: true, eodDigest: true, threadSummaries: true },
    calendar: { showUpcoming: true, preMeetingReminder: true, syncFrequent: true }
  });

  const refetchStatus = useCallback(async (options: { showLoading?: boolean } = {}) => {
    try {
      if (options.showLoading) setLoading(true);
      const { getIntegrationStatus } = await import('@/lib/integrations-api');
      const status = await getIntegrationStatus();

      setConnected({
        gmail: status.gmail.connected,
        slack: status.slack.connected,
        calendar: status.calendar.connected
      });

      setNeedsReconnect({
        gmail: Boolean(status.gmail.needsReconnect),
        slack: Boolean(status.slack.needsReconnect),
        calendar: Boolean(status.calendar.needsReconnect)
      });

      setEmails({
        gmail: status.gmail.email,
        // Slack identifies by workspace, not by an address.
        slack: status.slack.workspace ?? status.slack.email,
        calendar: status.calendar.email
      });
      setStatusError(null);
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
      // Every flag stays false when this call fails, which renders identically
      // to "nothing is connected". Say so explicitly instead of lying by omission.
      setStatusError(
        error instanceof Error ? error.message : 'Could not load integration status'
      );
    } finally {
      if (options.showLoading) setLoading(false);
    }
  }, []);

  // Fetch integration status on mount
  useEffect(() => {
    void refetchStatus({ showLoading: true });
  }, [refetchStatus]);

  const googleProviderFor = (integrationId: IntegrationId): GoogleIntegrationProvider | null => {
    if (integrationId === 'gmail') return 'GMAIL';
    if (integrationId === 'calendar') return 'GOOGLE_CALENDAR';
    return null;
  };

  const handleConnect = async (integrationId: IntegrationId) => {
    const provider = googleProviderFor(integrationId);

    if (provider) {
      try {
        setConnecting((prev) => ({ ...prev, [integrationId]: true }));
        const { connectGoogleIntegration } = await import('@/lib/integrations-api');
        // Handles both web (popup) and desktop (system browser + deep link)
        // flows, resolving once the OAuth attempt has finished so we can
        // refresh this integration's status.
        await connectGoogleIntegration(provider);
        await refetchStatus({ showLoading: false });
      } catch (error) {
        console.error('Failed to initiate OAuth:', error);
        if (error instanceof Error && error.message === 'popup-blocked') {
          alert('Please allow popups for this site to connect Google integrations.');
        } else {
          alert('Failed to connect. Please try again.');
        }
      } finally {
        setConnecting((prev) => ({ ...prev, [integrationId]: false }));
      }
    } else {
      // Slack: OAuth v2 install, same popup/deep-link handling as Google.
      try {
        setConnecting((prev) => ({ ...prev, slack: true }));
        const { connectSlackIntegration } = await import('@/lib/integrations-api');
        await connectSlackIntegration();
        await refetchStatus({ showLoading: false });
      } catch (error) {
        console.error('Failed to install Slack app:', error);
        if (error instanceof Error && error.message === 'popup-blocked') {
          alert('Please allow popups for this site to connect Slack.');
        } else {
          alert(error instanceof Error ? error.message : 'Failed to connect Slack.');
        }
      } finally {
        setConnecting((prev) => ({ ...prev, slack: false }));
      }
    }
  };

  const handleDisconnect = async (integrationId: IntegrationId) => {
    const provider = googleProviderFor(integrationId);

    if (integrationId === 'slack') {
      if (!confirm('Are you sure you want to disconnect Slack?')) return;
      try {
        const { disconnectSlack } = await import('@/lib/integrations-api');
        await disconnectSlack();
        setConnected((prev) => ({ ...prev, slack: false }));
        setEmails((prev) => ({ ...prev, slack: undefined }));
      } catch (error) {
        console.error('Failed to disconnect Slack:', error);
        alert('Failed to disconnect. Please try again.');
      }
      return;
    }

    if (provider) {
      const label = integrationId === 'gmail' ? 'Gmail' : 'Google Calendar';
      if (!confirm(`Are you sure you want to disconnect ${label}?`)) {
        return;
      }

      try {
        const { disconnectGoogle } = await import('@/lib/integrations-api');
        await disconnectGoogle(provider);

        setConnected((prev) => ({ ...prev, [integrationId]: false }));
        setEmails((prev) => ({ ...prev, [integrationId]: undefined }));
      } catch (error) {
        console.error('Failed to disconnect:', error);
        alert('Failed to disconnect. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className='py-12'>
        <BrandLoader label='Loading settings…' size={48} />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {statusError && (
        <div
          role='alert'
          className='flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4'
        >
          <p className='min-w-0 flex-1 text-sm text-foreground'>
            Couldn&apos;t load integration status, so the states below may be wrong.{' '}
            <span className='text-muted-foreground'>{statusError}</span>
          </p>
          <Button
            size='sm'
            variant='outline'
            className='shrink-0 rounded-full px-4'
            onClick={() => void refetchStatus({ showLoading: true })}
          >
            Retry
          </Button>
        </div>
      )}
      {INTEGRATIONS.map((integration) => (
        <IntegrationCard
          key={integration.id}
          config={integration}
          connected={connected[integration.id]}
          connecting={connecting[integration.id]}
          connectedEmail={emails[integration.id]}
          needsReconnect={needsReconnect[integration.id]}
          featureToggles={features[integration.id]}
          onConnectToggle={() => {
            if (connected[integration.id]) {
              handleDisconnect(integration.id);
            } else {
              handleConnect(integration.id);
            }
          }}
          onFeatureToggle={(key, enabled) => {
            setFeatures((prev) => ({
              ...prev,
              [integration.id]: { ...prev[integration.id], [key]: enabled }
            }));
          }}
        />
      ))}

      <div className='flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 px-5 py-4'>
        <IconBrandGoogle className='mt-0.5 size-4 shrink-0 text-primary' />
        <p className='text-sm leading-relaxed text-muted-foreground'>
          Connecting Gmail or Calendar opens a Google authorization window. You'll be redirected back after granting permissions.
        </p>
      </div>
    </div>
  );
}

function PrivacyTab() {
  const [retentionDays, setRetentionDays] = useState('90');
  const [autoDelete, setAutoDelete] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [trainOnData, setTrainOnData] = useState(false);
  const [redactPii, setRedactPii] = useState(true);

  return (
    <div className='space-y-4'>
      <SettingsSection
        title='Data retention'
        description='Control how long meeting transcripts and summaries are kept.'
      >
        <SettingsRow label='Keep meetings for' description='Older data is removed automatically.'>
          <SettingsSelect
            aria-label='Data retention period'
            value={retentionDays}
            onValueChange={setRetentionDays}
            options={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: '180', label: '180 days' },
              { value: '365', label: '1 year' }
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label='Auto-delete expired meetings'
          description='Permanently remove meetings past the retention window.'
        >
          <SettingsSwitch
            aria-label='Auto-delete expired meetings'
            checked={autoDelete}
            onCheckedChange={setAutoDelete}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title='Privacy controls'
        description='Choose what is collected and how it is used.'
      >
        <SettingsRow
          label='Usage analytics'
          description='Anonymous crash and performance data to improve the app.'
        >
          <SettingsSwitch
            aria-label='Usage analytics'
            checked={analytics}
            onCheckedChange={setAnalytics}
          />
        </SettingsRow>
        <SettingsRow
          label='Improve models with my data'
          description='Allow anonymized snippets to tune summarization quality.'
        >
          <SettingsSwitch
            aria-label='Improve models with my data'
            checked={trainOnData}
            onCheckedChange={setTrainOnData}
          />
        </SettingsRow>
        <SettingsRow
          label='Redact emails and phone numbers'
          description='Mask common PII in exports and shared summaries.'
        >
          <SettingsSwitch
            aria-label='Redact emails and phone numbers'
            checked={redactPii}
            onCheckedChange={setRedactPii}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title='Your data'>
        <SettingsRow
          label='Export all meetings'
          description='Download JSON and transcript bundles for your account.'
        >
          <Button size='sm' variant='outline' className='rounded-full gap-1.5'>
            <IconDownload className='size-3.5' />
            Export
          </Button>
        </SettingsRow>
        <SettingsRow
          label='Delete all local data'
          description='Remove cached meetings from this device. Cannot be undone.'
        >
          <Button
            size='sm'
            variant='outline'
            className='rounded-full gap-1.5 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive'
          >
            <IconTrash className='size-3.5' />
            Delete
          </Button>
        </SettingsRow>
      </SettingsSection>

      <div className='flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 px-5 py-4'>
        <IconShieldLock className='mt-0.5 size-4 shrink-0 text-primary' />
        <p className='text-sm leading-relaxed text-muted-foreground'>
          Recordings are processed for transcription and summarization. We do not sell your meeting
          data. See the privacy policy for full details on subprocessors and regional storage.
        </p>
      </div>
    </div>
  );
}

function GeneralTab({ isDesktop }: { isDesktop: boolean }) {
  const { preferences, updatePreferences } = usePreferences();
  const { theme, setTheme } = useTheme();

  return (
    <div className='space-y-4'>
      <SettingsPermissionsPanel isDesktop={isDesktop} />

      <SettingsSection title='Regional' description='Language and time display preferences.'>
        <SettingsRow label='Language'>
          <SettingsSelect
            aria-label='Language'
            value={preferences.language}
            onValueChange={(v) => updatePreferences({ language: v })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' }
            ]}
          />
        </SettingsRow>
        <SettingsRow label='Time format'>
          <SettingsSelect
            aria-label='Time format'
            value={preferences.timeFormat}
            onValueChange={(v) => updatePreferences({ timeFormat: v as '12h' | '24h' })}
            options={[
              { value: '12h', label: '12-hour' },
              { value: '24h', label: '24-hour' }
            ]}
          />
        </SettingsRow>
        <SettingsRow label='Appearance' description='Theme for the app.'>
          <SettingsSelect
            aria-label='Appearance'
            value={theme}
            onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' }
            ]}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

function AccountTab() {
  const { user, logout } = useAuth();

  return (
    <div className='space-y-4'>
      <SettingsSection title='Account' description='Your signed-in profile and session controls.'>
        <div className='space-y-1.5 border-b border-border/60 py-4'>
          <label htmlFor='account-name' className='text-sm font-semibold text-foreground'>
            Name
          </label>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            Shown in the sidebar and profile menu.
          </p>
          <Input
            id='account-name'
            value={user?.name ?? ''}
            readOnly
            title={user?.name ?? ''}
            className='mt-1 h-9 w-full'
          />
        </div>
        <div className='space-y-1.5 border-b border-border/60 py-4'>
          <label htmlFor='account-email' className='text-sm font-semibold text-foreground'>
            Email
          </label>
          <p className='text-sm leading-relaxed text-muted-foreground'>Email cannot be changed.</p>
          <Input
            id='account-email'
            type='email'
            value={user?.email ?? ''}
            readOnly
            title={user?.email ?? ''}
            className='mt-1 h-9 w-full'
          />
        </div>
        <SettingsRow label='Session' description='Sign out of this device.'>
          <Button
            size='sm'
            variant='outline'
            className='rounded-full gap-1.5 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive'
            onClick={logout}
          >
            Logout
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

export default function SettingsScreen({ isDesktop }: { isDesktop: boolean }) {
  return (
    <section className='space-y-4'>
      <Tabs defaultValue='general' className='gap-4'>
        <TabsList className='h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/70 p-1'>
          <TabsTrigger value='account' className='rounded-lg px-3'>
            Account
          </TabsTrigger>
          <TabsTrigger value='general' className='rounded-lg px-3'>
            General
          </TabsTrigger>
          <TabsTrigger value='audio' className='rounded-lg px-3'>
            <IconMicrophone className='mr-1.5 inline size-3.5' />
            Audio
          </TabsTrigger>
          <TabsTrigger value='ai' className='rounded-lg px-3'>
            <IconSparkles className='mr-1.5 inline size-3.5' />
            AI Preferences
          </TabsTrigger>
          <TabsTrigger value='integrations' className='rounded-lg px-3'>
            Integrations
          </TabsTrigger>
          <TabsTrigger value='privacy' className='rounded-lg px-3'>
            <IconShieldLock className='mr-1.5 inline size-3.5' />
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='mt-0 space-y-4'>
          <GeneralTab isDesktop={isDesktop} />
        </TabsContent>
        <TabsContent value='account' className='mt-0 space-y-4'>
          <AccountTab />
        </TabsContent>
        <TabsContent value='audio' className='mt-0'>
          <AudioSettingsTab />
        </TabsContent>
        <TabsContent value='ai' className='mt-0'>
          <AiPreferencesTab />
        </TabsContent>
        <TabsContent value='integrations' className='mt-0'>
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value='privacy' className='mt-0'>
          <PrivacyTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}

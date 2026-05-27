import { useState } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import SettingsPermissionsPanel from './settings-permissions-panel';
import { SettingsRow, SettingsSection, SettingsSwitch } from './settings-ui';

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
    features: [
      {
        key: 'defaultChannel',
        label: 'Post to #product-team',
        description: 'Default channel for meeting summaries.'
      },
      {
        key: 'eodDigest',
        label: 'End-of-day digest (6:00 PM)',
        description: 'Roll up open action items each evening.'
      },
      {
        key: 'threadSummaries',
        label: 'Thread summaries by meeting',
        description: 'Keep each meeting in its own Slack thread.'
      }
    ]
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
  const [summaryLength, setSummaryLength] = useState('detailed');
  const [actionSensitivity, setActionSensitivity] = useState('balanced');
  const [responseStyle, setResponseStyle] = useState('explanatory');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [highlightDecisions, setHighlightDecisions] = useState(true);
  const [suggestFollowUps, setSuggestFollowUps] = useState(true);

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
            onValueChange={setSummaryLength}
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
            onValueChange={setActionSensitivity}
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
            onCheckedChange={setIncludeTimestamps}
          />
        </SettingsRow>
        <SettingsRow
          label='Highlight decisions'
          description='Call out agreements and open questions separately.'
        >
          <SettingsSwitch
            aria-label='Highlight decisions'
            checked={highlightDecisions}
            onCheckedChange={setHighlightDecisions}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title='Copilot chat' description='Tune answers when you ask questions live.'>
        <SettingsRow label='Response style' description='Tone and depth of AI replies.'>
          <SettingsSelect
            aria-label='Response style'
            value={responseStyle}
            onValueChange={setResponseStyle}
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
            checked={suggestFollowUps}
            onCheckedChange={setSuggestFollowUps}
          />
        </SettingsRow>
      </SettingsSection>

      <div className='flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-primary/5 px-5 py-4 dark:border-cyan-500/40'>
        <IconSparkles className='mt-0.5 size-4 shrink-0 text-primary' />
        <p className='text-sm leading-relaxed text-muted-foreground'>
          API keys and model selection will appear here when backend configuration is wired up.
          Current preferences are stored locally for this session.
        </p>
      </div>
    </div>
  );
}

function IntegrationCard({
  config,
  connected,
  featureToggles,
  onConnectToggle,
  onFeatureToggle
}: {
  config: IntegrationConfig;
  connected: boolean;
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
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {connected ? 'Connected' : 'Not connected'}
            </Badge>
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>{config.description}</p>
        </div>
        <Button
          size='sm'
          variant={connected ? 'outline' : 'default'}
          className='shrink-0 rounded-full px-4'
          onClick={onConnectToggle}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </Button>
      </header>
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
    gmail: true,
    slack: true,
    calendar: true
  });
  const [features, setFeatures] = useState<Record<IntegrationId, Record<string, boolean>>>({
    gmail: { autoFollowUp: true, attachTranscript: false, smartRecipients: true },
    slack: { defaultChannel: true, eodDigest: true, threadSummaries: true },
    calendar: { showUpcoming: true, preMeetingReminder: true, syncFrequent: true }
  });

  return (
    <div className='space-y-4'>
      {INTEGRATIONS.map((integration) => (
        <IntegrationCard
          key={integration.id}
          config={integration}
          connected={connected[integration.id]}
          featureToggles={features[integration.id]}
          onConnectToggle={() => {
            setConnected((prev) => ({
              ...prev,
              [integration.id]: !prev[integration.id]
            }));
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
          OAuth sign-in is simulated in this build. Connecting opens your browser to authorize
          read-only calendar and send permissions.
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
  const [language, setLanguage] = useState('en');
  const [timeFormat, setTimeFormat] = useState('12h');

  return (
    <div className='space-y-4'>
      <SettingsPermissionsPanel isDesktop={isDesktop} />

      <SettingsSection title='Regional' description='Language and time display preferences.'>
        <SettingsRow label='Language'>
          <SettingsSelect
            aria-label='Language'
            value={language}
            onValueChange={setLanguage}
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
            value={timeFormat}
            onValueChange={setTimeFormat}
            options={[
              { value: '12h', label: '12-hour' },
              { value: '24h', label: '24-hour' }
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label='Appearance'
          description='Use the sun/moon toggle in the top-right of the app header.'
        >
          <span className='text-sm text-muted-foreground'>System / Light / Dark</span>
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

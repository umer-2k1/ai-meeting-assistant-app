import { useEffect, useState } from 'react';
import {
  IconArrowLeft,
  IconBrandGithub,
  IconBrandLinkedin,
  IconBulb,
  IconChecklist,
  IconHistory,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLoader } from '@/components/brand/brand-loader';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE, COPILOT_SURFACE } from './copilot-styles';
import {
  fetchGuestResearch,
  fetchPreMeetingBrief,
  type GuestProfile,
  type PreMeetingBrief,
  type PreMeetingInput,
} from './meetings-api';

const CONFIDENCE_BADGE: Record<GuestProfile['confidence'], string> = {
  high: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-border text-muted-foreground',
};

const SURFACE = COPILOT_SURFACE;

export interface PreMeetingContext extends PreMeetingInput {}

export default function PreMeetingScreen({
  context,
  onBack,
}: {
  context: PreMeetingContext;
  onBack: () => void;
}) {
  const [data, setData] = useState<PreMeetingBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guest research (on-demand internet enrichment).
  const [guests, setGuests] = useState<Map<string, GuestProfile> | null>(null);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);

  const researchGuests = async () => {
    setGuestsLoading(true);
    setGuestsError(null);
    try {
      const res = await fetchGuestResearch(context.attendees);
      setProviderConfigured(res.providerConfigured);
      setGuests(new Map(res.guests.map((g) => [g.email.toLowerCase(), g])));
    } catch {
      setGuestsError('Could not research guests. Please retry.');
    } finally {
      setGuestsLoading(false);
    }
  };

  // Reset research when the meeting context changes.
  useEffect(() => {
    setGuests(null);
    setGuestsError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.title, JSON.stringify(context.attendees)]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchPreMeetingBrief(context)
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setError('Could not build the pre-meeting brief. Please retry.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.title, context.description, JSON.stringify(context.attendees)]);

  /** The brief above is served from cache; this is the way to force a rebuild. */
  const regenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      setData(await fetchPreMeetingBrief(context, { refresh: true }));
    } catch {
      setError('Could not rebuild the pre-meeting brief. Please retry.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <section className='mx-auto flex max-w-4xl flex-col gap-5'>
      <div className='flex items-center gap-3'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
          onClick={onBack}
        >
          <IconArrowLeft className='mr-1.5 size-3.5' />
          Back
        </Button>
        <div className='min-w-0 flex-1'>
          <h1 className='text-xl font-semibold text-foreground'>{context.title}</h1>
          <p className='text-xs text-muted-foreground'>AI pre-meeting brief</p>
        </div>
        {!isLoading && !error && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            className={cn('shrink-0 rounded-full', COPILOT_BTN_OUTLINE)}
            disabled={isRegenerating}
            onClick={() => void regenerate()}
          >
            <IconRefresh className='mr-1.5 size-3.5' />
            {isRegenerating ? 'Rebuilding…' : 'Regenerate'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className={SURFACE}>
          <CardContent className='py-16'>
            <BrandLoader label='Preparing your brief…' size={52} />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className={SURFACE}>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <p className='text-sm text-muted-foreground'>{error}</p>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <Card className={SURFACE}>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <IconSparkles className='size-4 text-primary' />
                Briefing
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4 text-sm text-foreground/90'>
              <p>{data.brief.briefing}</p>
              {data.brief.suggestedTopics.length > 0 && (
                <div>
                  <p className='mb-1 flex items-center gap-1.5 font-medium text-foreground'>
                    <IconBulb className='size-4 text-amber-500' /> Suggested talking points
                  </p>
                  <ul className='list-disc space-y-1 pl-5'>
                    {data.brief.suggestedTopics.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.brief.reminders.length > 0 && (
                <div>
                  <p className='mb-1 font-medium text-foreground'>Reminders</p>
                  <ul className='list-disc space-y-1 pl-5'>
                    {data.brief.reminders.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={SURFACE}>
            <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <IconUsers className='size-4 text-primary' />
                Attendees
              </CardTitle>
              <Button
                type='button'
                size='sm'
                variant='outline'
                className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
                onClick={researchGuests}
                disabled={guestsLoading}
              >
                <IconSearch className='mr-1.5 size-3.5' />
                {guestsLoading ? 'Researching…' : guests ? 'Refresh research' : 'Research guests'}
              </Button>
            </CardHeader>
            <CardContent className='space-y-3'>
              {data.attendees.map((a, i) => {
                const g = a.email ? guests?.get(a.email.toLowerCase()) : undefined;
                const displayName = g?.fullName || a.name;
                const website = g?.website ?? undefined;
                const linkedinUrl = g?.linkedinUrl ?? a.linkedinUrl ?? undefined;
                const github = g?.socialProfiles?.['github'];
                const bio = g?.bio ?? a.bio ?? undefined;
                return (
                  <div key={i} className='rounded-lg border border-border/60 p-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <p className='text-sm font-medium text-foreground'>{displayName}</p>
                          {g && (
                            <Badge
                              variant='outline'
                              className={cn('text-[10px]', CONFIDENCE_BADGE[g.confidence])}
                            >
                              {g.matchStatus === 'possible_matches'
                                ? 'Possible match'
                                : `${g.confidence} confidence`}
                            </Badge>
                          )}
                        </div>
                        {(g?.title || g?.company) && (
                          <p className='truncate text-xs text-foreground/80'>
                            {[g?.title, g?.company].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {a.email && <p className='truncate text-xs text-muted-foreground'>{a.email}</p>}
                        {g?.location && (
                          <p className='text-xs text-muted-foreground'>{g.location}</p>
                        )}
                      </div>
                      <div className='flex shrink-0 items-center gap-2 text-muted-foreground'>
                        {website && (
                          <a href={website} target='_blank' rel='noreferrer' title='Website' className='hover:text-primary'>
                            <IconWorld className='size-4' />
                          </a>
                        )}
                        {github && (
                          <a href={github} target='_blank' rel='noreferrer' title='GitHub' className='hover:text-primary'>
                            <IconBrandGithub className='size-4' />
                          </a>
                        )}
                        {linkedinUrl && (
                          <a href={linkedinUrl} target='_blank' rel='noreferrer' title='LinkedIn' className='text-primary'>
                            <IconBrandLinkedin className='size-4' />
                          </a>
                        )}
                      </div>
                    </div>
                    {bio && <p className='mt-2 text-xs text-muted-foreground'>{bio}</p>}
                  </div>
                );
              })}
              {guestsError && <p className='text-xs text-destructive'>{guestsError}</p>}
              {guests && !providerConfigured && (
                <p className='text-xs text-muted-foreground'>
                  Showing free results (company, Gravatar, GitHub). Set{' '}
                  <code>ENRICHMENT_PROVIDER=serper</code> (+ <code>SERPER_API_KEY</code>) or{' '}
                  <code>pdl</code> to add LinkedIn profiles.
                </p>
              )}
            </CardContent>
          </Card>

          {data.pastMeetings.length > 0 && (
            <Card className={SURFACE}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <IconHistory className='size-4 text-primary' />
                  Past meetings with these attendees
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {data.pastMeetings.map((m) => (
                  <div key={m.id} className='rounded-lg border border-border/60 p-3'>
                    <p className='text-sm font-medium text-foreground'>{m.title}</p>
                    <p className='text-xs text-muted-foreground'>
                      {new Date(m.startTime).toLocaleDateString()}
                    </p>
                    {m.summary && <p className='mt-1 text-xs text-foreground/80'>{m.summary}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.openActionItems.length > 0 && (
            <Card className={SURFACE}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <IconChecklist className='size-4 text-primary' />
                  Open action items ({data.openActionItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {data.openActionItems.map((item) => (
                  <div key={item.id} className='flex items-center justify-between gap-2 text-sm'>
                    <span className='text-foreground/90'>{item.task}</span>
                    {item.assignee && (
                      <Badge variant='outline' className='border-border text-muted-foreground'>
                        {item.assignee}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </section>
  );
}

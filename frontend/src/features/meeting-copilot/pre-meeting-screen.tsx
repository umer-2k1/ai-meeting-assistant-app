import { useEffect, useState } from 'react';
import {
  IconArrowLeft,
  IconBrandLinkedin,
  IconBulb,
  IconChecklist,
  IconHistory,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandLoader } from '@/components/brand/brand-loader';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE, COPILOT_SURFACE } from './copilot-styles';
import { fetchPreMeetingBrief, type PreMeetingBrief, type PreMeetingInput } from './meetings-api';

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
  const [error, setError] = useState<string | null>(null);

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
        <div>
          <h1 className='text-xl font-semibold text-foreground'>{context.title}</h1>
          <p className='text-xs text-muted-foreground'>AI pre-meeting brief</p>
        </div>
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
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <IconUsers className='size-4 text-primary' />
                Attendees
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {data.attendees.map((a, i) => (
                <div key={i} className='rounded-lg border border-border/60 p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <div>
                      <p className='text-sm font-medium text-foreground'>{a.name}</p>
                      {a.email && <p className='text-xs text-muted-foreground'>{a.email}</p>}
                    </div>
                    {a.linkedinUrl && (
                      <a href={a.linkedinUrl} target='_blank' rel='noreferrer' className='text-primary'>
                        <IconBrandLinkedin className='size-4' />
                      </a>
                    )}
                  </div>
                  {a.bio && <p className='mt-2 text-xs text-muted-foreground'>{a.bio}</p>}
                </div>
              ))}
              {!data.enrichmentEnabled && (
                <p className='text-xs text-muted-foreground'>
                  Add SERPER_API_KEY to enable attendee web enrichment (LinkedIn, bio).
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

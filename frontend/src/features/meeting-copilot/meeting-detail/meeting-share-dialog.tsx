import { useEffect, useState } from 'react';
import { IconBrandSlack, IconMail, IconShare2 } from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getIntegrationStatus } from '@/lib/integrations-api';
import { cn } from '@/lib/utils';

import { COPILOT_BTN_OUTLINE } from '../copilot-styles';
import {
  getSlackChannelsApi,
  shareMeetingEmailApi,
  shareMeetingSlackApi,
} from '../meetings-api';

type MeetingShareDialogProps = {
  meetingId: string;
  attendeeEmails: string[];
};

export default function MeetingShareDialog({
  meetingId,
  attendeeEmails,
}: MeetingShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(attendeeEmails.join(', '));
  const [sendingEmail, setSendingEmail] = useState(false);

  const [channels, setChannels] = useState<{ id: string; name: string }[] | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [postingSlack, setPostingSlack] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  /**
   * 'unknown' = still loading or the status call failed — never block sending on
   * it. 'revoked' is deliberately distinct from 'disconnected': telling someone
   * to "connect Gmail" when they already did, and it silently expired, sends
   * them looking for a setup step that isn't the problem.
   */
  const [gmailState, setGmailState] = useState<
    'unknown' | 'connected' | 'disconnected' | 'revoked'
  >('unknown');

  // Check integration availability up front so the user learns Gmail is unusable
  // when the dialog opens, not after a failed send.
  useEffect(() => {
    if (!open) return;
    void getIntegrationStatus()
      .then((status) => {
        if (status.gmail?.connected) setGmailState('connected');
        else if (status.gmail?.needsReconnect) setGmailState('revoked');
        else setGmailState('disconnected');
      })
      .catch(() => setGmailState('unknown'));
  }, [open]);

  const gmailUnusable = gmailState === 'disconnected' || gmailState === 'revoked';

  const loadChannels = async () => {
    if (channels || loadingChannels) return;
    setLoadingChannels(true);
    setSlackError(null);
    try {
      const list = await getSlackChannelsApi();
      setChannels(list);
      setSelectedChannel(list[0]?.id ?? '');
    } catch {
      setSlackError('Slack is not connected. Connect it in Settings → Integrations to post reports.');
    } finally {
      setLoadingChannels(false);
    }
  };

  const sendEmail = async () => {
    const list = recipients
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.error('Enter at least one recipient');
      return;
    }
    setSendingEmail(true);
    try {
      await shareMeetingEmailApi(meetingId, list);
      toast.success('Meeting report emailed');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const postSlack = async () => {
    if (!selectedChannel) return;
    setPostingSlack(true);
    try {
      await shareMeetingSlackApi(meetingId, selectedChannel);
      toast.success('Posted to Slack');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post to Slack');
    } finally {
      setPostingSlack(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className={cn('rounded-full', COPILOT_BTN_OUTLINE)}
        >
          <IconShare2 className='mr-1.5 size-3.5' />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share meeting report</DialogTitle>
          <DialogDescription>Send the summary, decisions, and action items.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue='email' onValueChange={(v) => v === 'slack' && void loadChannels()}>
          <TabsList className='w-full'>
            <TabsTrigger value='email' className='flex-1'>
              <IconMail className='mr-1.5 size-3.5' /> Email
            </TabsTrigger>
            <TabsTrigger value='slack' className='flex-1'>
              <IconBrandSlack className='mr-1.5 size-3.5' /> Slack
            </TabsTrigger>
          </TabsList>

          <TabsContent value='email' className='space-y-3 pt-3'>
            <label className='text-xs font-medium text-muted-foreground'>
              Recipients (comma-separated)
            </label>
            <Input
              value={recipients}
              onChange={(e) => setRecipients(e.currentTarget.value)}
              placeholder='alice@example.com, bob@example.com'
            />
            {gmailState === 'revoked' ? (
              <p className='text-xs text-destructive'>
                Gmail access expired or was revoked. Reconnect it in Settings → Integrations to
                email reports.
              </p>
            ) : gmailState === 'disconnected' ? (
              <p className='text-xs text-destructive'>
                Gmail is not connected. Connect it in Settings → Integrations to email reports.
              </p>
            ) : (
              <p className='text-xs text-muted-foreground'>
                Sent from your connected Gmail account.
              </p>
            )}
            <Button
              type='button'
              className='w-full bg-primary text-primary-foreground'
              disabled={sendingEmail || gmailUnusable}
              onClick={() => void sendEmail()}
            >
              {sendingEmail ? 'Sending…' : 'Send email'}
            </Button>
          </TabsContent>

          <TabsContent value='slack' className='space-y-3 pt-3'>
            {slackError ? (
              <p className='text-sm text-muted-foreground'>{slackError}</p>
            ) : loadingChannels ? (
              <p className='text-sm text-muted-foreground'>Loading channels…</p>
            ) : (
              <>
                <label className='text-xs font-medium text-muted-foreground'>Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.currentTarget.value)}
                  className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm'
                >
                  {(channels ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </select>
                <Button
                  type='button'
                  className='w-full bg-primary text-primary-foreground'
                  disabled={postingSlack || !selectedChannel}
                  onClick={() => void postSlack()}
                >
                  {postingSlack ? 'Posting…' : 'Post to Slack'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

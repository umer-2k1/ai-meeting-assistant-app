import { IconHeadphones, IconMicrophone } from '@tabler/icons-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import MicTestScreen from './mic-test-screen';
import SystemAudioTestScreen from './system-audio-test-screen';

export type DeviceCheckTab = 'microphone' | 'system-audio';

export default function DeviceCheckScreen({
  isDesktop,
  activeTab,
  onTabChange,
}: {
  isDesktop: boolean;
  activeTab: DeviceCheckTab;
  onTabChange: (tab: DeviceCheckTab) => void;
}) {
  return (
    <div className='mx-auto max-w-3xl space-y-6'>
      <div className='rounded-2xl border border-border/70 bg-card/80 p-5'>
        <h2 className='text-base font-semibold text-foreground'>Before your meeting</h2>
        <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
          Validate microphone input and system audio capture in one place. Run both tests before
          joining so recordings and transcripts work as expected.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          onTabChange(value as DeviceCheckTab);
        }}
        className='gap-6'
      >
        <TabsList className='h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/50 p-1'>
          <TabsTrigger
            value='microphone'
            className={cn(
              'gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm'
            )}
          >
            <IconMicrophone className='size-4' />
            Microphone Test
          </TabsTrigger>
          <TabsTrigger
            value='system-audio'
            className={cn(
              'gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm'
            )}
          >
            <IconHeadphones className='size-4' />
            System Audio Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value='microphone' className='mt-0 outline-none'>
          <MicTestScreen isDesktop={isDesktop} embedded />
        </TabsContent>

        <TabsContent value='system-audio' className='mt-0 outline-none'>
          <SystemAudioTestScreen isDesktop={isDesktop} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { Skeleton } from '../components/ui/skeleton';

export function MeetingCardSkeleton() {
  return (
    <div className='overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-5'>
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-6 w-3/4' />
          <Skeleton className='h-4 w-1/2' />
        </div>
        <Skeleton className='size-8 rounded-full' />
      </div>
      
      <div className='space-y-2'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
      </div>

      <div className='mt-4 flex flex-wrap gap-2'>
        <Skeleton className='h-6 w-16 rounded-full' />
        <Skeleton className='h-6 w-20 rounded-full' />
        <Skeleton className='h-6 w-16 rounded-full' />
      </div>

      <div className='mt-4 flex items-center justify-between'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-4 w-32' />
      </div>
    </div>
  );
}

export function MeetingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: count }).map((_, i) => (
        <MeetingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TranscriptLineSkeleton() {
  return (
    <article className='border-b border-border/50 py-4'>
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-4 w-24' />
      </div>
      <Skeleton className='mt-2 h-4 w-full' />
      <Skeleton className='mt-1 h-4 w-5/6' />
    </article>
  );
}

export function TranscriptSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className='space-y-0'>
      {Array.from({ length: count }).map((_, i) => (
        <TranscriptLineSkeleton key={i} />
      ))}
    </div>
  );
}

export function ActionItemSkeleton() {
  return (
    <div className='flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3'>
      <Skeleton className='mt-0.5 size-5 rounded' />
      <div className='min-w-0 flex-1 space-y-2'>
        <div className='flex flex-wrap gap-2'>
          <Skeleton className='h-5 w-16 rounded' />
          <Skeleton className='h-5 w-20 rounded' />
        </div>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4' />
      </div>
    </div>
  );
}

export function ActionItemsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='space-y-2'>
      {Array.from({ length: count }).map((_, i) => (
        <ActionItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className='rounded-lg border border-border/70 bg-muted/40 p-3'>
      <Skeleton className='mb-2 h-3 w-1/3' />
      <Skeleton className='h-4 w-full' />
      <Skeleton className='mt-1 h-4 w-5/6' />
      <Skeleton className='mt-1 h-4 w-4/6' />
      <Skeleton className='mt-2 h-3 w-20' />
    </div>
  );
}

export function AIThinkingIndicator() {
  return (
    <div className='flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-3'>
      <div className='flex gap-1'>
        <div className='size-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.3s]' />
        <div className='size-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.15s]' />
        <div className='size-2 animate-bounce rounded-full bg-cyan-500' />
      </div>
      <span className='text-sm text-cyan-600 dark:text-cyan-400'>AI is thinking...</span>
    </div>
  );
}

export function RecordingIndicator({ isLive }: { isLive: boolean }) {
  if (!isLive) return null;

  return (
    <div className='flex items-center gap-2'>
      <div className='relative flex size-3'>
        <span className='absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75' />
        <span className='relative inline-flex size-3 rounded-full bg-red-600' />
      </div>
      <span className='text-sm font-medium text-red-600 dark:text-red-400'>Recording</span>
    </div>
  );
}

export function ProcessingIndicator({ status }: { status: string }) {
  return (
    <div className='flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2'>
      <div className='size-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
      <span className='text-sm text-muted-foreground'>{status}</span>
    </div>
  );
}

export function StreamingTextIndicator() {
  return (
    <span className='inline-block size-1 animate-pulse rounded-full bg-primary' />
  );
}

export function PageLoader() {
  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <div className='mb-4 inline-block size-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
        <p className='text-sm text-muted-foreground'>Loading...</p>
      </div>
    </div>
  );
}

export function ContentLoader({ message = 'Loading content...' }: { message?: string }) {
  return (
    <div className='flex flex-col items-center justify-center py-12'>
      <div className='mb-3 inline-block size-8 animate-spin rounded-full border-3 border-primary border-t-transparent' />
      <p className='text-sm text-muted-foreground'>{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='flex flex-col items-center justify-center py-12 text-center'>
      {icon && <div className='mb-4 text-muted-foreground'>{icon}</div>}
      <h3 className='mb-2 text-lg font-semibold text-foreground'>{title}</h3>
      {description && <p className='mb-4 text-sm text-muted-foreground'>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

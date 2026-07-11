import { cn } from '@/lib/utils';
import './brand.css';

/**
 * The app's logo mark: an audio-equalizer pulse inside a gradient tile.
 * Set `animated` to make the bars dance (loading / recording states).
 */
export function BrandMark({
  size = 36,
  animated = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('brand-mark', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className='brand-mark__bars'>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('brand-mark__bar', animated && 'brand-mark__bar--animated')}
            style={{ animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Logo mark + wordmark, used in the sidebar and login. */
export function BrandLogo({
  size = 36,
  animated = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <BrandMark size={size} animated={animated} />
      <span className='leading-tight'>
        <span className='block text-sm font-semibold text-foreground'>Meeting Copilot</span>
        <span className='block text-[11px] text-muted-foreground'>AI meeting intelligence</span>
      </span>
    </span>
  );
}

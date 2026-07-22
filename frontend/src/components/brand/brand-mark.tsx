import { cn } from '@/lib/utils';
import './brand.css';

/**
 * The app's logo mark: a "constellation" — spoken moments linked into a small
 * knowledge graph — inside a gradient tile. Set `animated` to make the nodes
 * twinkle (loading / recording states).
 */
const BRAND_NODES = [
  { cx: 52, cy: 50, r: 8.5, delay: 0 },
  { cx: 30, cy: 36, r: 6, delay: 0.13 },
  { cx: 66, cy: 28, r: 5, delay: 0.26 },
  { cx: 72, cy: 63, r: 6, delay: 0.39 },
  { cx: 39, cy: 71, r: 5, delay: 0.52 },
] as const;

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
      <svg className='brand-mark__glyph' viewBox='0 0 100 100' fill='none'>
        <g stroke='#fff' strokeWidth={3} strokeLinecap='round' opacity={0.9}>
          <line x1='30' y1='36' x2='52' y2='50' />
          <line x1='66' y1='28' x2='52' y2='50' />
          <line x1='72' y1='63' x2='52' y2='50' />
          <line x1='39' y1='71' x2='52' y2='50' />
        </g>
        <g fill='#fff'>
          {BRAND_NODES.map((n) => (
            <circle
              key={`${n.cx}-${n.cy}`}
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              className={cn('brand-mark__node', animated && 'brand-mark__node--animated')}
              style={{ animationDelay: `${n.delay}s` }}
            />
          ))}
        </g>
      </svg>
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

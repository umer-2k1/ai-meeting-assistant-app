import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';
import './brand.css';

/**
 * Branded loading indicator: the animated logo mark with pulsing rings and a
 * shimmering label. Use `fullScreen` for route-level loads, or inline elsewhere.
 */
export function BrandLoader({
  label = 'Loading…',
  fullScreen = false,
  size = 56,
  className,
}: {
  label?: string;
  fullScreen?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('brand-loader', fullScreen && 'brand-loader--full', className)}>
      <span className='brand-loader__mark'>
        <span className='brand-loader__ring' />
        <span className='brand-loader__ring brand-loader__ring--delay' />
        <BrandMark size={size} animated />
      </span>
      {label && <p className='brand-loader__label'>{label}</p>}
    </div>
  );
}

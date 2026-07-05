import { Component, type ReactNode } from 'react';

/**
 * A render error in the floating widget must never leave a blank, unresponsive
 * transparent window on screen. This boundary catches any crash and shows a
 * minimal pill with a way back to the main app so the user is never stranded.
 */
export class WidgetErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    // Surface to the devtools console; the widget has no other logging channel.
    console.error('[widget] render error:', error);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className='widget-drag-handle flex h-full w-full items-center justify-center p-1'>
        <div className='widget-shell-pill flex w-full max-w-[288px] items-center justify-between gap-2 rounded-full border border-border px-3 py-2'>
          <span className='text-xs font-medium text-foreground'>Recording…</span>
          <button
            type='button'
            className='widget-no-drag rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground hover:border-primary/50'
            onClick={() => void globalThis.window.desktop?.widget.openMain()}
          >
            Open app
          </button>
        </div>
      </div>
    );
  }
}

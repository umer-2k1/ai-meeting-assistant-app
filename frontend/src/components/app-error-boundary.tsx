import { Component, type ReactNode } from 'react';

/**
 * Top-level safety net for the main app window.
 *
 * A render error anywhere in the tree used to unmount everything and leave a
 * blank, unrecoverable white screen (the app has no other error UI). This
 * boundary catches the crash and shows a recoverable panel with a Reload button
 * so the user is never forced to quit and relaunch. It intentionally mirrors the
 * widget's `WidgetErrorBoundary`.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  override state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }

  override componentDidCatch(error: unknown) {
    // Surface to the devtools console; useful when debugging a packaged build.
    console.error('[app] render error:', error);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: '' });
    globalThis.window.location.reload();
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className='flex h-dvh w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground'>
        <div className='max-w-md space-y-3'>
          <h1 className='text-lg font-semibold'>The app hit an unexpected error</h1>
          <p className='text-sm text-muted-foreground'>
            Your meetings and recordings are safe. Reload to get back to work.
          </p>
          {this.state.message && (
            <p className='rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs break-words text-muted-foreground'>
              {this.state.message}
            </p>
          )}
          <button
            type='button'
            onClick={this.handleReload}
            className='mx-auto inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90'
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Lightweight HTML page served to the OAuth popup window opened from
 * Settings -> Integrations. The main app window polls `popup.closed` to know
 * when to refresh connection status, so this page just needs to give the
 * user clear feedback and close itself.
 */

const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE_CALENDAR: 'Google Calendar',
  GMAIL: 'Gmail',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c');
}

function renderPage(options: {
  title: string;
  heading: string;
  message: string;
  autoClose: boolean;
}): string {
  const { title, heading, message, autoClose } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #020617;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .card { max-width: 420px; width: 100%; text-align: center; }
    .icon {
      width: 56px; height: 56px; margin: 0 auto 24px; border-radius: 16px;
      display: flex; align-items: center; justify-content: center; font-size: 28px;
    }
    .icon.success { background: linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(59, 130, 246, 0.2)); }
    .icon.error { background: linear-gradient(135deg, rgba(248, 113, 113, 0.2), rgba(239, 68, 68, 0.2)); }
    h1 { font-size: 1.75rem; font-weight: 600; color: #f8fafc; margin-bottom: 8px; }
    p { font-size: 1rem; color: #94a3b8; line-height: 1.5; }
    .hint { margin-top: 24px; font-size: 0.875rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${autoClose ? 'success' : 'error'}" aria-hidden="true">${autoClose ? '✓' : '!'}</div>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    <p class="hint">This window will close automatically. You can also close it manually.</p>
  </div>
  <script>
    setTimeout(function () {
      window.close();
    }, ${autoClose ? '1200' : '2500'});
  </script>
</body>
</html>`;
}

export function buildIntegrationConnectedPage(providers: string[]): string {
  const labels = providers.map((provider) => PROVIDER_LABELS[provider] || provider);
  const message =
    labels.length > 0
      ? `${labels.join(' and ')} ${labels.length > 1 ? 'are' : 'is'} now connected.`
      : 'Your integration is now connected.';

  return renderPage({
    title: 'Connected',
    heading: 'All set!',
    message,
    autoClose: true,
  });
}

export function buildIntegrationErrorPage(reason?: string): string {
  return renderPage({
    title: 'Connection failed',
    heading: 'Something went wrong',
    message: reason || 'We could not complete the connection. Please try again from Settings.',
    autoClose: false,
  });
}

/**
 * Desktop variant: this callback runs in the *system browser* (not an
 * Electron popup), because Google blocks OAuth inside embedded webviews.
 * There is no window handle for the app to poll, so instead we redirect to
 * a custom-protocol deep link that the Electron app's `open-url` handler
 * picks up, which then notifies the renderer to refresh integration status.
 */
export function buildDesktopIntegrationRedirectPage(deepLink: string, success: boolean): string {
  const safeDeepLink = escapeHtml(deepLink);
  const jsDeepLink = escapeJsString(deepLink);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${success ? 'Connected' : 'Connection failed'} · AI Meeting Copilot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #020617;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .card { max-width: 420px; width: 100%; text-align: center; }
    .icon {
      width: 56px; height: 56px; margin: 0 auto 24px; border-radius: 16px;
      display: flex; align-items: center; justify-content: center; font-size: 28px;
    }
    .icon.success { background: linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(59, 130, 246, 0.2)); }
    .icon.error { background: linear-gradient(135deg, rgba(248, 113, 113, 0.2), rgba(239, 68, 68, 0.2)); }
    h1 { font-size: 1.75rem; font-weight: 600; color: #f8fafc; margin-bottom: 8px; }
    p { font-size: 1rem; color: #94a3b8; line-height: 1.5; }
    .hint { margin-top: 24px; font-size: 0.875rem; color: #64748b; }
    a { color: #22d3ee; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${success ? 'success' : 'error'}" aria-hidden="true">${success ? '✓' : '!'}</div>
    <h1>${success ? 'All set!' : 'Something went wrong'}</h1>
    <p>${success ? 'Feel free to return to AI Meeting Copilot.' : 'We could not complete the connection. Please try again from the app.'}</p>
    <p class="hint">
      If the app did not open automatically,
      <a id="open-app" href="${safeDeepLink}">click here</a>.
      You can close this tab.
    </p>
  </div>
  <script>
    (function () {
      var deepLink = '${jsDeepLink}';
      function openApp() { window.location.href = deepLink; }
      openApp();
      document.getElementById('open-app').addEventListener('click', function (e) {
        e.preventDefault();
        openApp();
      });
    })();
  </script>
</body>
</html>`;
}

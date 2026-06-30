const APP_NAME = process.env.DESKTOP_APP_NAME || 'AI Meeting Copilot';

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

export function buildDesktopAuthSuccessPage(deepLink: string): string {
  const safeDeepLink = escapeHtml(deepLink);
  const jsDeepLink = escapeJsString(deepLink);
  const safeAppName = escapeHtml(APP_NAME);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signed in · ${safeAppName}</title>
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
      background: linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(59, 130, 246, 0.2));
      display: flex; align-items: center; justify-content: center; font-size: 28px;
    }
    h1 { font-size: 1.75rem; font-weight: 600; color: #f8fafc; margin-bottom: 8px; }
    p { font-size: 1rem; color: #94a3b8; line-height: 1.5; }
    .hint { margin-top: 24px; font-size: 0.875rem; color: #64748b; }
    a { color: #22d3ee; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon" aria-hidden="true">✓</div>
    <h1>All set!</h1>
    <p>Feel free to return to ${safeAppName}.</p>
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

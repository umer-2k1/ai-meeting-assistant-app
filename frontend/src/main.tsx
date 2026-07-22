import '@/styles/global.scss';
import '@/styles/global.css';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';

import { UNAUTHORIZED_EVENT } from '@/lib/api-client';

import App from './app';

// Routing on 401 lives here, in the main app entry only. The widget window
// (src/widget/main.tsx) deliberately does not subscribe — it must never
// navigate away from widget.html.
globalThis.addEventListener(UNAUTHORIZED_EVENT, () => {
  if (globalThis.location.pathname !== '/login') {
    globalThis.location.href = '/login';
  }
});

const container = document.querySelector('#root');
const root = createRoot(container as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

import '@/styles/global.css';
import '@/styles/global.scss';
import './widget.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import FloatingSystemWidget from './floating-system-widget';

const container = document.querySelector('#root');
const root = createRoot(container as HTMLElement);

root.render(
  <StrictMode>
    <FloatingSystemWidget />
  </StrictMode>
);

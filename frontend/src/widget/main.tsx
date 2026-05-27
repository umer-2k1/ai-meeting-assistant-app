import '@/styles/global.css';
import '@/styles/global.scss';
import './widget.css';
import './widget-theme.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { syncDocumentThemeFromStorage } from '@/lib/theme/document-theme';

import FloatingSystemWidget from './floating-system-widget';

syncDocumentThemeFromStorage();

const container = document.querySelector('#root');
const root = createRoot(container as HTMLElement);

root.render(
  <StrictMode>
    <FloatingSystemWidget />
  </StrictMode>
);

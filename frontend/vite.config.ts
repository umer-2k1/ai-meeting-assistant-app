/* eslint-disable unicorn/prefer-string-replace-all */

import path from 'node:path';

import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vite';
import config from './_config';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "."),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    {
      name: 'dynamic-html',
      transformIndexHtml(html: string) {
        return html
          .replace(/%TITLE%/g, config.metadata.title)
          .replace(/%DESCRIPTION%/g, config.metadata.description)
          .replace(/%KEYWORDS%/g, config.metadata.keywords);
      }
    }
  ],
  server: {
    host: config.server.host,
    port: config.server.port,
    // Fail loudly instead of drifting to the next free port. Electron loads the
    // widget from a hardcoded VITE_DEV_SERVER_URL, so a silent port change meant
    // it attached to whatever stale server already held this one.
    strictPort: true
  },
  // Relative asset URLs. Electron loads the built HTML with loadFile() over
  // file://, where the default absolute base ('/') resolves /assets/* against
  // the FILESYSTEM ROOT — so every script and stylesheet 404s and the app (and
  // the widget overlay) renders as an empty opaque window. Relative paths work
  // under both file:// and the dev server.
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        widget: path.resolve(__dirname, 'widget.html')
      }
    }
  }
});

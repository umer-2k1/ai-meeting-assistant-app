import path from 'node:path';

import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Desktop IPC bridge', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Electron runs in Chromium project only.');

  test('renderer can call start/pause/stop over preload bridge', async () => {
    const appEntry = path.resolve(process.cwd(), 'electron', 'main.cjs');
    const electronApp = await electron.launch({
      args: [appEntry],
      env: {
        ...process.env,
        ELECTRON_TEST_MODE: '1'
      }
    });

    try {
      const page = await electronApp.firstWindow();

      const hasDesktopBridge = await page.evaluate(() => typeof globalThis.window.desktop !== 'undefined');
      expect(hasDesktopBridge).toBe(true);

      const started = await page.evaluate(() => globalThis.window.desktop?.recording.start());
      expect(started?.isRecording).toBe(true);
      expect(started?.isPaused).toBe(false);

      await page.waitForTimeout(1200);
      const statusAfterTick = await page.evaluate(() => globalThis.window.desktop?.recording.getStatus());
      expect(statusAfterTick?.elapsedSeconds).toBeGreaterThan(0);

      const paused = await page.evaluate(() => globalThis.window.desktop?.recording.pauseResume());
      expect(paused?.isRecording).toBe(true);
      expect(paused?.isPaused).toBe(true);

      const resumed = await page.evaluate(() => globalThis.window.desktop?.recording.pauseResume());
      expect(resumed?.isRecording).toBe(true);
      expect(resumed?.isPaused).toBe(false);

      const stopped = await page.evaluate(() => globalThis.window.desktop?.recording.stop());
      expect(stopped?.isRecording).toBe(false);
      expect(stopped?.isPaused).toBe(false);
      expect(stopped?.elapsedSeconds).toBe(0);
    } finally {
      await electronApp.close();
    }
  });
});

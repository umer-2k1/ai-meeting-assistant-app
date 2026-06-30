import path from 'node:path';

import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

function deriveAction(snapshot: { granted: boolean; status?: string; canRequest?: boolean }) {
  return snapshot.granted ? 'openSettings' : 'grantAccess';
}

async function launchDesktopApp() {
  const appEntry = path.resolve(process.cwd(), 'electron', 'main.cjs');
  return electron.launch({
    args: [appEntry],
    env: {
      ...process.env,
      ELECTRON_TEST_MODE: '1'
    }
  });
}

test.describe('Desktop IPC bridge', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Electron runs in Chromium project only.'
  );

  test('renderer can call start/pause/stop over preload bridge', async () => {
    const electronApp = await launchDesktopApp();

    try {
      const page = await electronApp.firstWindow();

      const hasDesktopBridge = await page.evaluate(() => globalThis.window.desktop !== undefined);
      expect(hasDesktopBridge).toBe(true);

      const started = await page.evaluate(() => globalThis.window.desktop?.recording.start());
      expect(started?.isRecording).toBe(true);
      expect(started?.isPaused).toBe(false);

      await page.waitForTimeout(1200);
      const statusAfterTick = await page.evaluate(() =>
        globalThis.window.desktop?.recording.getStatus()
      );
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

  test('permissions IPC exposes settings catalog and open-settings', async () => {
    const electronApp = await launchDesktopApp();

    try {
      const page = await electronApp.firstWindow();

      const settingsCatalog = await page.evaluate(async () => {
        return globalThis.window.desktop?.permissions.getSettings();
      });

      expect(settingsCatalog?.items.length).toBeGreaterThan(0);

      const microphone = settingsCatalog?.items.find((item) => item.id === 'microphone');
      expect(microphone).toBeTruthy();
      expect(['grantAccess', 'openSettings']).toContain(microphone?.action);

      if (process.platform === 'darwin') {
        const accessibility = settingsCatalog?.items.find((item) => item.id === 'accessibility');
        expect(accessibility).toBeTruthy();
      }

      const openSettingsResult = await page.evaluate(async () => {
        return globalThis.window.desktop?.permissions.openSettings('microphone');
      });
      expect(openSettingsResult?.ok).toBe(true);

      const micRequest = await page.evaluate(async () => {
        return globalThis.window.desktop?.permissions.requestMicrophone();
      });
      expect(micRequest).toBeTruthy();
      expect(typeof micRequest?.granted).toBe('boolean');

      if (process.platform === 'darwin') {
        const accessibilityRequest = await page.evaluate(async () => {
          return globalThis.window.desktop?.permissions.requestAccessibility();
        });
        expect(accessibilityRequest).toBeTruthy();
        expect(typeof accessibilityRequest?.granted).toBe('boolean');
      }
    } finally {
      await electronApp.close();
    }
  });
});

test.describe('Permission action derivation', () => {
  test('returns openSettings when permission is granted', () => {
    expect(deriveAction({ status: 'granted', granted: true })).toBe('openSettings');
  });

  test('returns grantAccess when permission is not granted', () => {
    expect(deriveAction({ status: 'not-determined', granted: false, canRequest: true })).toBe(
      'grantAccess'
    );
    expect(deriveAction({ status: 'denied', granted: false, canRequest: true })).toBe(
      'grantAccess'
    );
  });
});

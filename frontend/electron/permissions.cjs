const { shell, systemPreferences, Notification } = require('electron');

const APP_DISPLAY_NAME = 'AI Meeting Copilot';

/**
 * @typedef {'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown' | 'unsupported'} PermissionStatus
 * @typedef {'systemPrompt' | 'settingsOnly'} PermissionRequestKind
 * @typedef {'grantAccess' | 'openSettings'} PermissionAction
 */

function normalizeMediaStatus(status) {
  if (status === 'granted' || status === 'denied' || status === 'restricted') {
    return status;
  }
  if (status === 'not-determined') {
    return 'not-determined';
  }
  return 'unknown';
}

function readMediaAccessStatus(type) {
  if (
    !systemPreferences ||
    typeof systemPreferences.getMediaAccessStatus !== 'function'
  ) {
    return 'unknown';
  }

  try {
    return normalizeMediaStatus(systemPreferences.getMediaAccessStatus(type));
  } catch {
    return 'unknown';
  }
}

function buildSnapshot(status, { canRequestWhenDenied = true } = {}) {
  return {
    status,
    granted: status === 'granted',
    canRequest: status === 'not-determined' || (canRequestWhenDenied && status === 'denied'),
  };
}

function deriveAction(snapshot) {
  if (snapshot.granted) {
    return 'openSettings';
  }

  return 'grantAccess';
}

function getHelpText(id, platform, snapshot) {
  if (snapshot.granted) {
    return null;
  }

  const guides = {
    accessibility: {
      darwin:
        'Allow this app under System Settings → Privacy & Security → Accessibility so it can interact with other apps.',
    },
    microphone: {
      darwin:
        'Allow this app under System Settings → Privacy & Security → Microphone. If you previously denied access, macOS will not show the in-app prompt again.',
      win32: 'Allow this app under Settings → Privacy & security → Microphone.',
    },
    systemAudio: {
      darwin:
        'In dev, enable the toggle for "Electron" under System Settings → Privacy & Security → System Audio Recording Only (not "AI Meeting Copilot"). Run the system audio test once so the app appears in the list.',
      win32:
        'If system audio is blocked, allow desktop apps under Settings → Privacy & security. Windows may not show a separate in-app prompt.',
    },
    notifications: {
      darwin:
        'Allow notifications under System Settings → Notifications for this app if reminders are blocked.',
      win32: 'Allow notifications under Settings → System → Notifications for this app.',
    },
  };

  return guides[id]?.[platform] ?? null;
}

/**
 * macOS TCC flow (main process only): read status, then call askForMediaAccess
 * only when status is `not-determined`.
 *
 * @param {'microphone' | 'camera'} mediaType
 */
async function checkAndRequestMediaAccess(mediaType) {
  const status = readMediaAccessStatus(mediaType);

  if (status === 'granted') {
    return { ...buildSnapshot('granted'), promptShown: false, askResult: true };
  }

  if (status === 'not-determined') {
    let askResult = false;
    try {
      askResult = await systemPreferences.askForMediaAccess(mediaType);
    } catch (error) {
      console.error(`[permissions] askForMediaAccess(${mediaType}) failed`, error);
    }

    const after = readMediaAccessStatus(mediaType);
    return {
      ...buildSnapshot(after),
      promptShown: true,
      askResult,
    };
  }

  return { ...buildSnapshot(status), promptShown: false, askResult: false };
}

function getMicrophonePermission() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    const status = readMediaAccessStatus('microphone');
    return buildSnapshot(status);
  }

  return { status: 'unsupported', granted: false, canRequest: true };
}

async function requestMicrophonePermission() {
  if (process.platform === 'darwin') {
    return checkAndRequestMediaAccess('microphone');
  }

  if (process.platform === 'win32') {
    const status = readMediaAccessStatus('microphone');
    if (status === 'granted') {
      return buildSnapshot('granted');
    }
    return buildSnapshot(status);
  }

  return { status: 'unsupported', granted: false, canRequest: true };
}

function getAccessibilityPermission() {
  if (process.platform !== 'darwin') {
    return { status: 'unsupported', granted: false, canRequest: false };
  }

  if (
    !systemPreferences ||
    typeof systemPreferences.isTrustedAccessibilityClient !== 'function'
  ) {
    return { status: 'unknown', granted: false, canRequest: true };
  }

  try {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    return buildSnapshot(trusted ? 'granted' : 'denied', { canRequestWhenDenied: true });
  } catch {
    return { status: 'unknown', granted: false, canRequest: true };
  }
}

function requestAccessibilityPermission() {
  if (process.platform !== 'darwin') {
    return getAccessibilityPermission();
  }

  if (
    !systemPreferences ||
    typeof systemPreferences.isTrustedAccessibilityClient !== 'function'
  ) {
    return { status: 'unknown', granted: false, canRequest: true };
  }

  try {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    return buildSnapshot(trusted ? 'granted' : 'denied', { canRequestWhenDenied: true });
  } catch (error) {
    console.error('[permissions] requestAccessibilityPermission failed', error);
    return getAccessibilityPermission();
  }
}

function getSystemAudioPermission() {
  if (process.platform === 'darwin') {
    // CoreAudio Tap API doesn't have a reliable TCC status check before first use.
    // We return 'not-determined' until the user runs the system audio test.
    // Once they grant access via getDisplayMedia, the OS remembers it.
    return buildSnapshot('not-determined');
  }

  if (process.platform === 'win32') {
    return { status: 'unsupported', granted: true, canRequest: false };
  }

  return { status: 'unsupported', granted: false, canRequest: false };
}

function requestSystemAudioPermission() {
  return getSystemAudioPermission();
}

function getNotificationPermission() {
  if (
    process.platform === 'darwin' &&
    systemPreferences &&
    systemPreferences.getNotificationSettings
  ) {
    const settings = systemPreferences.getNotificationSettings();
    const status =
      settings.status === 'authorized'
        ? 'granted'
        : settings.status === 'not-determined'
          ? 'not-determined'
          : 'denied';

    return {
      status,
      granted: status === 'granted',
      canRequest: status !== 'granted',
    };
  }

  return { status: 'not-determined', granted: false, canRequest: true };
}

async function requestNotificationPermission() {
  const before = getNotificationPermission();
  if (before.granted || before.status === 'denied') {
    return before;
  }

  if (Notification.isSupported()) {
    try {
      new Notification({
        title: APP_DISPLAY_NAME,
        body: 'Enable notifications to receive meeting reminders.',
        silent: true,
      });
    } catch (error) {
      console.error('[permissions] notification permission request failed', error);
    }
  }

  return getNotificationPermission();
}

function buildSettingsPermissionItems(platform) {
  const accessibility = getAccessibilityPermission();
  const microphone = getMicrophonePermission();
  const systemAudio = getSystemAudioPermission();

  /** @type {Array<{ id: string; title: string; description: string; requestKind: PermissionRequestKind; icon: string; snapshot: ReturnType<typeof buildSnapshot>; action: PermissionAction; helpText: string | null }>} */
  const items = [];

  if (platform === 'darwin') {
    items.push({
      id: 'accessibility',
      title: 'Accessibility',
      description: 'Allows the app to insert text and interact with other applications.',
      requestKind: 'settingsOnly',
      icon: 'accessibility',
      snapshot: accessibility,
      action: deriveAction(accessibility),
      helpText: getHelpText('accessibility', platform, accessibility),
    });
  }

  items.push({
    id: 'microphone',
    title: 'Microphone',
    description: 'Allows the app to record your voice during meetings for live transcription.',
    requestKind: 'systemPrompt',
    icon: 'microphone',
    snapshot: microphone,
    action: deriveAction(microphone),
    helpText: getHelpText('microphone', platform, microphone),
  });

  if (platform === 'darwin' || platform === 'win32') {
    items.push({
      id: 'systemAudio',
      title: 'System Audio Recording',
      description:
        platform === 'darwin'
          ? 'Allows the app to capture system audio from meeting apps and other participants.'
          : 'Allows the app to capture audio from other meeting apps and participants.',
      requestKind: 'settingsOnly',
      icon: 'systemAudio',
      snapshot: systemAudio,
      action: deriveAction(systemAudio),
      helpText: getHelpText('systemAudio', platform, systemAudio),
    });
  }

  return items;
}

function buildPermissionItems(platform) {
  const items = buildSettingsPermissionItems(platform);
  const notifications = getNotificationPermission();

  items.push({
    id: 'notifications',
    title: 'Meeting reminders',
    description: 'Get notified before meetings start and when summaries are ready.',
    requestKind: 'systemPrompt',
    icon: 'notifications',
    snapshot: notifications,
    action: deriveAction(notifications),
    helpText: getHelpText('notifications', platform, notifications),
  });

  return items;
}

function getAllPermissions() {
  const platform = process.platform;
  return {
    platform,
    items: buildPermissionItems(platform),
  };
}

function getSettingsPermissions() {
  const platform = process.platform;
  return {
    platform,
    items: buildSettingsPermissionItems(platform),
  };
}

function resolveSettingsTarget(target) {
  if (target === 'systemAudio') {
    // Note: macOS 26 may have a separate System Audio Recording pane.
    // For now, Privacy_ScreenCapture still works as it includes system audio.
    return 'screenCapture';
  }
  return target;
}

function openPermissionSettings(target) {
  const resolvedTarget = resolveSettingsTarget(target);

  if (process.platform === 'darwin') {
    const urls = {
      accessibility:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
      microphone:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      screenCapture:
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      notifications: 'x-apple.systempreferences:com.apple.preference.notifications',
    };

    const url = urls[resolvedTarget];
    if (!url) return { ok: false };

    void shell.openExternal(url);
    return { ok: true };
  }

  if (process.platform === 'win32') {
    const urls = {
      accessibility: 'ms-settings:easeofaccess',
      microphone: 'ms-settings:privacy-microphone',
      screenCapture: 'ms-settings:privacy',
      notifications: 'ms-settings:notifications',
    };

    const url = urls[resolvedTarget];
    if (!url) return { ok: false };

    void shell.openExternal(url);
    return { ok: true };
  }

  return { ok: false };
}

/**
 * Returns whether recording can start, and which permission blocked it.
 */
async function ensureRecordingPermissions() {
  let mic = getMicrophonePermission();
  if (!mic.granted) {
    mic = await requestMicrophonePermission();
  }
  if (!mic.granted) {
    return { ok: false, blockedReason: 'microphone', permissionStatus: mic.status };
  }

  if (process.platform === 'darwin') {
    const systemAudio = getSystemAudioPermission();
    if (!systemAudio.granted) {
      return {
        ok: false,
        blockedReason: 'systemAudio',
        permissionStatus: systemAudio.status,
      };
    }
  }

  return { ok: true };
}

module.exports = {
  deriveAction,
  getAllPermissions,
  getSettingsPermissions,
  getAccessibilityPermission,
  requestAccessibilityPermission,
  getMicrophonePermission,
  requestMicrophonePermission,
  checkAndRequestMediaAccess,
  getSystemAudioPermission,
  requestSystemAudioPermission,
  getNotificationPermission,
  requestNotificationPermission,
  openPermissionSettings,
  ensureRecordingPermissions,
};

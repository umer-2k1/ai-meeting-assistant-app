const { shell, systemPreferences, Notification } = require('electron');

const APP_DISPLAY_NAME = 'AI Meeting Copilot';

/**
 * @typedef {'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown' | 'unsupported'} PermissionStatus
 * @typedef {'systemPrompt' | 'settingsOnly'} PermissionRequestKind
 * @typedef {'enable' | 'openSettings' | 'none'} PermissionAction
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
  if (typeof systemPreferences.getMediaAccessStatus !== 'function') {
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

function deriveAction(requestKind, snapshot) {
  if (snapshot.granted) {
    return 'none';
  }

  if (requestKind === 'settingsOnly') {
    return 'openSettings';
  }

  if (snapshot.status === 'denied' || snapshot.status === 'restricted') {
    return 'openSettings';
  }

  if (requestKind === 'systemPrompt') {
    return 'enable';
  }

  return 'openSettings';
}

function getHelpText(id, platform, snapshot) {
  if (snapshot.granted) {
    return null;
  }

  const guides = {
    microphone: {
      darwin:
        'Allow this app under System Settings → Privacy & Security → Microphone. If you previously denied access, macOS will not show the in-app prompt again.',
      win32: 'Allow this app under Settings → Privacy & security → Microphone.',
    },
    systemAudio: {
      darwin:
        'Open System Settings → Privacy & Security → Screen Recording and enable this app. macOS does not provide an in-app prompt for system audio.',
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

function getSystemAudioPermission() {
  if (process.platform === 'darwin') {
    return buildSnapshot(readMediaAccessStatus('screen'));
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
  if (process.platform === 'darwin' && systemPreferences.getNotificationSettings) {
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

function buildPermissionItems(platform) {
  const microphone = getMicrophonePermission();
  const systemAudio = getSystemAudioPermission();
  const notifications = getNotificationPermission();

  /** @type {Array<{ id: string; title: string; description: string; requestKind: PermissionRequestKind; icon: string; snapshot: ReturnType<typeof buildSnapshot>; action: PermissionAction; helpText: string | null }>} */
  const items = [
    {
      id: 'microphone',
      title: 'Microphone access',
      description: 'Capture your voice during meetings for live transcription.',
      requestKind: 'systemPrompt',
      icon: 'microphone',
      snapshot: microphone,
      action: deriveAction('systemPrompt', microphone),
      helpText: getHelpText('microphone', platform, microphone),
    },
  ];

  if (platform === 'darwin' || platform === 'win32') {
    items.push({
      id: 'systemAudio',
      title: 'System audio recording',
      description:
        platform === 'darwin'
          ? 'Capture audio from meeting apps and other participants.'
          : 'Capture audio from other meeting apps and participants.',
      requestKind: 'settingsOnly',
      icon: 'systemAudio',
      snapshot: systemAudio,
      action: deriveAction('settingsOnly', systemAudio),
      helpText: getHelpText('systemAudio', platform, systemAudio),
    });
  }

  items.push({
    id: 'notifications',
    title: 'Meeting reminders',
    description: 'Get notified before meetings start and when summaries are ready.',
    requestKind: 'systemPrompt',
    icon: 'notifications',
    snapshot: notifications,
    action: deriveAction('systemPrompt', notifications),
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

function resolveSettingsTarget(target) {
  if (target === 'systemAudio') {
    return 'screenCapture';
  }
  return target;
}

function openPermissionSettings(target) {
  const resolvedTarget = resolveSettingsTarget(target);

  if (process.platform === 'darwin') {
    const urls = {
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
  getAllPermissions,
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

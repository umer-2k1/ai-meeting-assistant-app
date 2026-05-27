const { shell, systemPreferences } = require('electron');

/**
 * @typedef {'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown' | 'unsupported'} PermissionStatus
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

function getMicrophonePermission() {
  if (process.platform !== 'darwin') {
    return { status: 'unsupported', granted: true, canRequest: false };
  }

  const status = normalizeMediaStatus(systemPreferences.getMediaAccessStatus('microphone'));
  return {
    status,
    granted: status === 'granted',
    canRequest: status === 'not-determined' || status === 'denied'
  };
}

async function requestMicrophonePermission() {
  if (process.platform !== 'darwin') {
    return { status: 'unsupported', granted: true };
  }

  const before = normalizeMediaStatus(systemPreferences.getMediaAccessStatus('microphone'));
  if (before === 'granted') {
    return { status: 'granted', granted: true };
  }

  if (before === 'not-determined') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    const status = normalizeMediaStatus(systemPreferences.getMediaAccessStatus('microphone'));
    return { status, granted: granted && status === 'granted' };
  }

  return { status: before, granted: false };
}

function getAccessibilityPermission() {
  if (process.platform !== 'darwin') {
    return { status: 'unsupported', granted: true, canRequest: false };
  }

  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  return {
    status: trusted ? 'granted' : 'denied',
    granted: trusted,
    canRequest: !trusted
  };
}

function requestAccessibilityPermission() {
  if (process.platform !== 'darwin') {
    return { status: 'unsupported', granted: true };
  }

  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  return {
    status: trusted ? 'granted' : 'denied',
    granted: trusted
  };
}

function getNotificationPermission() {
  if (process.platform !== 'darwin' || !systemPreferences.getNotificationSettings) {
    return { status: 'unsupported', granted: true, canRequest: false };
  }

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
    canRequest: status !== 'granted'
  };
}

function getAllPermissions() {
  return {
    platform: process.platform,
    microphone: getMicrophonePermission(),
    accessibility: getAccessibilityPermission(),
    notifications: getNotificationPermission()
  };
}

function openPermissionSettings(target) {
  if (process.platform !== 'darwin') {
    return { ok: false };
  }

  const urls = {
    microphone:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    accessibility:
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    notifications: 'x-apple.systempreferences:com.apple.preference.notifications'
  };

  const url = urls[target];
  if (!url) {
    return { ok: false };
  }

  void shell.openExternal(url);
  return { ok: true };
}

module.exports = {
  getAllPermissions,
  getMicrophonePermission,
  requestMicrophonePermission,
  getAccessibilityPermission,
  requestAccessibilityPermission,
  getNotificationPermission,
  openPermissionSettings
};

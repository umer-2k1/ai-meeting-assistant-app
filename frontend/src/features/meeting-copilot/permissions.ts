import type {
  PermissionAction,
  PermissionCatalog,
  PermissionIconKey,
  PermissionItem,
  PermissionRequestKind,
  PermissionSnapshot,
  PermissionStatus,
  PermissionTarget
} from './permissions.types';

import { deriveAction } from './permission-actions';



function toPermissionStatus(status: string): PermissionStatus {
  const allowed: PermissionStatus[] = [
    'granted',
    'denied',
    'not-determined',
    'restricted',
    'unknown',
    'unsupported'
  ];
  return allowed.includes(status as PermissionStatus) ? (status as PermissionStatus) : 'unknown';
}

function toPermissionSnapshot(snapshot: {
  status: string;
  granted: boolean;
  canRequest?: boolean;
}): PermissionSnapshot {
  return {
    status: toPermissionStatus(snapshot.status),
    granted: snapshot.granted,
    ...(snapshot.canRequest === undefined ? {} : { canRequest: snapshot.canRequest })
  };
}

function buildSystemAudioItem(
  platform: string,
  snapshot: PermissionSnapshot = {
    status: platform === 'darwin' ? 'not-determined' : 'unsupported',
    granted: platform === 'win32',
    canRequest: platform === 'darwin'
  }
): PermissionItem {
  const visibleOnDesktop = platform === 'darwin' || platform === 'win32';

  return {
    id: 'systemAudio',
    title: 'System Audio Recording',
    description:
      platform === 'darwin'
        ? 'Allows the app to capture system audio from meeting apps and other participants.'
        : platform === 'win32'
          ? 'Allows the app to capture audio from other meeting apps and participants.'
          : 'Allows the app to capture audio from meeting apps and other participants.',
    requestKind: 'settingsOnly',
    icon: 'systemAudio',
    snapshot: visibleOnDesktop
      ? snapshot
      : { status: 'unsupported', granted: false, canRequest: false },
    action: visibleOnDesktop ? deriveAction(snapshot) : 'openSettings',
    helpText: visibleOnDesktop
      ? null
      : 'System audio recording is available in the desktop app only.'
  };
}

function buildSettingsPermissionItems(platform: string): PermissionItem[] {
  const microphone: PermissionSnapshot = {
    status: 'not-determined',
    granted: false,
    canRequest: true
  };
  const systemAudio: PermissionSnapshot = {
    status: platform === 'darwin' ? 'not-determined' : 'unsupported',
    granted: platform === 'win32',
    canRequest: platform === 'darwin'
  };

  const items: PermissionItem[] = [];

  if (platform === 'darwin') {
    const accessibility: PermissionSnapshot = {
      status: 'denied',
      granted: false,
      canRequest: true
    };

    items.push({
      id: 'accessibility',
      title: 'Accessibility',
      description: 'Allows the app to insert text and interact with other applications.',
      requestKind: 'settingsOnly',
      icon: 'accessibility',
      snapshot: accessibility,
      action: deriveAction(accessibility),
      helpText: null
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
    helpText: null
  });

  if (platform === 'darwin' || platform === 'win32') {
    items.push(buildSystemAudioItem(platform, systemAudio));
  }

  return items;
}

function buildWebPermissionItems(): PermissionItem[] {
  return [
    {
      id: 'microphone',
      title: 'Microphone',
      description: 'Allows the app to record your voice during meetings for live transcription.',
      requestKind: 'systemPrompt',
      icon: 'microphone',
      snapshot: { status: 'not-determined', granted: false, canRequest: true },
      action: 'grantAccess',
      helpText: null
    },
    buildSystemAudioItem('web')
  ];
}

export function getDefaultPermissionCatalog(platform = 'web'): PermissionCatalog {
  if (platform === 'darwin' || platform === 'win32') {
    return {
      platform,
      items: buildSettingsPermissionItems(platform)
    };
  }

  return { platform: 'web', items: buildWebPermissionItems() };
}

type LegacyDesktopPermissionResponse = {
  platform: string;
  microphone: { status: string; granted: boolean; canRequest?: boolean };
  screenCapture?: { status: string; granted: boolean; canRequest?: boolean };
  systemAudio?: { status: string; granted: boolean; canRequest?: boolean };
  notifications: { status: string; granted: boolean; canRequest?: boolean };
};

function buildLegacyDesktopCatalog(raw: LegacyDesktopPermissionResponse): PermissionCatalog {
  const microphone = toPermissionSnapshot(raw.microphone);
  const systemAudio = toPermissionSnapshot(
    raw.systemAudio ??
      raw.screenCapture ??
      (raw.platform === 'darwin'
        ? { status: 'not-determined', granted: false, canRequest: true }
        : { status: 'unsupported', granted: true, canRequest: false })
  );

  return {
    platform: raw.platform,
    items: [
      {
        id: 'microphone',
        title: 'Microphone',
        description: 'Allows the app to record your voice during meetings for live transcription.',
        requestKind: 'systemPrompt',
        icon: 'microphone',
        snapshot: microphone,
        action: deriveAction(microphone),
        helpText: null
      },
      ...(raw.platform === 'darwin' || raw.platform === 'win32'
        ? [
            {
              ...buildSystemAudioItem(raw.platform, systemAudio),
              action: deriveAction(systemAudio)
            }
          ]
        : [])
    ]
  };
}

function toPermissionItem(raw: {
  id: string;
  title: string;
  description: string;
  requestKind: PermissionRequestKind;
  icon: PermissionIconKey;
  snapshot: { status: string; granted: boolean; canRequest?: boolean };
  action: PermissionAction;
  helpText: string | null;
}): PermissionItem {
  const snapshot = toPermissionSnapshot(raw.snapshot);
  return {
    id: raw.id as PermissionTarget,
    title: raw.title,
    description: raw.description,
    requestKind: raw.requestKind,
    icon: raw.icon,
    snapshot,
    action: raw.action ?? deriveAction(snapshot),
    helpText: raw.helpText
  };
}

function normalizeDesktopPermissionResponse(raw: {
  platform?: string;
  items?: Array<{
    id: string;
    title: string;
    description: string;
    requestKind: PermissionRequestKind;
    icon: PermissionIconKey;
    snapshot: { status: string; granted: boolean; canRequest?: boolean };
    action: PermissionAction;
    helpText: string | null;
  }>;
  microphone?: { status: string; granted: boolean; canRequest?: boolean };
}): PermissionCatalog {
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    return {
      platform: raw.platform ?? 'unknown',
      items: raw.items.map((item) => toPermissionItem(item))
    };
  }

  if (raw.microphone) {
    return buildLegacyDesktopCatalog(raw as LegacyDesktopPermissionResponse);
  }

  return getDefaultPermissionCatalog(raw.platform ?? 'darwin');
}

async function loadDesktopPermissionCatalog(mode: 'all' | 'settings'): Promise<PermissionCatalog> {
  const api = globalThis.window.desktop?.permissions;
  if (!api) {
    return getDefaultPermissionCatalog('darwin');
  }

  const raw = mode === 'settings' && api.getSettings ? await api.getSettings() : await api.getAll();

  return normalizeDesktopPermissionResponse(raw);
}

export async function fetchPermissionCatalog(isDesktopHint: boolean): Promise<PermissionCatalog> {
  const hasDesktopApi = Boolean(globalThis.window.desktop?.permissions);
  const isDesktop = isDesktopHint || hasDesktopApi;

  if (isDesktop && hasDesktopApi) {
    try {
      let catalog = await loadDesktopPermissionCatalog('all');

      if (catalog.platform === 'win32' || catalog.platform === 'linux') {
        const notificationSnapshot = await getWebNotificationPermission();
        catalog = {
          ...catalog,
          items: catalog.items.map((item) =>
            item.id === 'notifications'
              ? {
                  ...item,
                  snapshot: notificationSnapshot,
                  action: deriveAction(notificationSnapshot),
                  helpText: notificationSnapshot.granted
                    ? null
                    : 'Allow notifications in your browser or system settings if reminders are blocked.'
                }
              : item
          )
        };
      }

      return catalog.items.length > 0
        ? catalog
        : getDefaultPermissionCatalog(catalog.platform || 'darwin');
    } catch (error) {
      console.error('[permissions] failed to load desktop permission catalog', error);
      return getDefaultPermissionCatalog('darwin');
    }
  }

  const [microphone] = await Promise.all([queryWebMicrophone()]);

  return {
    platform: 'web',
    items: buildWebPermissionItems().map((item) => {
      if (item.id === 'microphone') {
        return {
          ...item,
          snapshot: microphone,
          action: deriveAction(microphone),
          helpText: microphone.granted
            ? null
            : microphone.status === 'denied'
              ? 'Microphone access was denied. Enable it in your browser site settings.'
              : null
        };
      }

      return item;
    })
  };
}

export async function fetchSettingsPermissionCatalog(
  isDesktopHint: boolean
): Promise<PermissionCatalog> {
  const hasDesktopApi = Boolean(globalThis.window.desktop?.permissions);
  const isDesktop = isDesktopHint || hasDesktopApi;

  if (isDesktop && hasDesktopApi) {
    try {
      const catalog = await loadDesktopPermissionCatalog('settings');
      return catalog.items.length > 0
        ? catalog
        : getDefaultPermissionCatalog(catalog.platform || 'darwin');
    } catch (error) {
      console.error('[permissions] failed to load settings permission catalog', error);
      return getDefaultPermissionCatalog('darwin');
    }
  }

  const microphone = await queryWebMicrophone();

  return {
    platform: 'web',
    items: buildWebPermissionItems().map((item) => {
      if (item.id === 'microphone') {
        return {
          ...item,
          snapshot: microphone,
          action: deriveAction(microphone),
          helpText: microphone.granted
            ? null
            : microphone.status === 'denied'
              ? 'Microphone access was denied. Enable it in your browser site settings.'
              : null
        };
      }

      return item;
    })
  };
}

export async function requestPermissionItem(
  id: PermissionTarget,
  catalog: PermissionCatalog
): Promise<void> {
  const item = catalog.items.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  const isDesktop = Boolean(globalThis.window.desktop?.permissions);
  const { platform } = catalog;

  if (item.action === 'openSettings' || item.snapshot.granted) {
    if (isDesktop) {
      await openDesktopPermissionSettings(id);
    }
    return;
  }

  if (id === 'accessibility') {
    if (isDesktop) {
      await requestDesktopAccessibility();
      const refreshed = await fetchSettingsPermissionCatalog(true);
      const accessibility = refreshed.items.find((entry) => entry.id === 'accessibility');
      if (accessibility && !accessibility.snapshot.granted) {
        await openDesktopPermissionSettings('accessibility');
      }
    }
    return;
  }

  if (id === 'microphone') {
    if (isDesktop) {
      if (platform === 'win32') {
        await requestWebMicrophone();
      }
      const result = await requestDesktopMicrophone();
      if (result && !result.granted) {
        await openDesktopPermissionSettings('microphone');
      }
      return;
    }
    await requestWebMicrophone();
    return;
  }

  if (id === 'systemAudio') {
    if (isDesktop) {
      // Try to register the app with macOS System Audio Recording
      // This makes the app appear in System Settings → System Audio Recording Only
      try {
        // First, try to trigger system audio capture to register the app
        if (typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
          try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true
            });
            // Stop the stream immediately - we just wanted to register
            for (const track of stream.getTracks()) {
              track.stop();
            }
            // Check if we now have permission
            const refreshed = await fetchSettingsPermissionCatalog(true);
            const systemAudio = refreshed.items.find((entry) => entry.id === 'systemAudio');
            if (systemAudio?.snapshot.granted) {
              return; // Successfully granted
            }
          } catch {
            // User cancelled or denied - continue to open settings
          }
        }
      } catch (error) {
        console.error('[permissions] Failed to register system audio recording:', error);
      }

      // Open System Settings for manual permission grant
      await openDesktopPermissionSettings('systemAudio');
    }
    return;
  }

  if (id === 'notifications') {
    if (isDesktop) {
      await (platform === 'darwin' ? requestDesktopNotifications() : requestWebNotificationPermission());
      return;
    }
    await requestWebNotificationPermission();
  }
}

export async function requestDesktopMicrophone(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api) {return null;}
  return toPermissionSnapshot(await api.requestMicrophone());
}

export async function requestDesktopAccessibility(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api?.requestAccessibility) {return null;}
  return toPermissionSnapshot(await api.requestAccessibility());
}

export async function requestDesktopNotifications(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api?.requestNotifications) {return null;}
  return toPermissionSnapshot(await api.requestNotifications());
}

export async function openDesktopPermissionSettings(target: PermissionTarget) {
  const api = globalThis.window.desktop?.permissions;
  if (!api) {return { ok: false };}
  return api.openSettings(target);
}

export async function queryWebMicrophone(): Promise<PermissionSnapshot> {
  if (!navigator.permissions?.query) {
    return { status: 'unknown', granted: false, canRequest: true };
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    if (result.state === 'granted') {
      return { status: 'granted', granted: true };
    }
    if (result.state === 'denied') {
      return { status: 'denied', granted: false };
    }
    return { status: 'not-determined', granted: false, canRequest: true };
  } catch {
    return { status: 'unknown', granted: false, canRequest: true };
  }
}

export async function requestWebMicrophone(): Promise<PermissionSnapshot> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { status: 'unsupported', granted: false };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return { status: 'granted', granted: true };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { status: 'denied', granted: false };
    }
    return { status: 'unknown', granted: false };
  }
}

export async function getWebNotificationPermission(): Promise<PermissionSnapshot> {
  if (!('Notification' in globalThis)) {
    return { status: 'unsupported', granted: false };
  }

  const status = Notification.permission;
  if (status === 'granted') {
    return { status: 'granted', granted: true };
  }
  if (status === 'denied') {
    return { status: 'denied', granted: false };
  }
  return { status: 'not-determined', granted: false, canRequest: true };
}

export async function requestWebNotificationPermission(): Promise<PermissionSnapshot> {
  if (!('Notification' in globalThis)) {
    return { status: 'unsupported', granted: false };
  }

  const result = await Notification.requestPermission();
  if (result === 'granted') {
    return { status: 'granted', granted: true };
  }
  if (result === 'denied') {
    return { status: 'denied', granted: false };
  }
  return { status: 'not-determined', granted: false };
}

/** Live OS / browser microphone permission (not capture test). */
export async function fetchMicrophonePermissionStatus(): Promise<PermissionSnapshot> {
  const isDesktop = Boolean(globalThis.window.desktop?.permissions);

  if (isDesktop) {
    try {
      const catalog = await fetchPermissionCatalog(true);
      const mic = catalog.items.find((item) => item.id === 'microphone');
      if (mic) {
        return mic.snapshot;
      }
    } catch {
      // fall through to web query
    }
  }

  return queryWebMicrophone();
}

export async function fetchSystemAudioPermissionStatus(
  isDesktop: boolean
): Promise<PermissionSnapshot> {
  if (isDesktop) {
    try {
      const catalog = await fetchPermissionCatalog(true);
      const systemAudio = catalog.items.find((item) => item.id === 'systemAudio');
      if (systemAudio) {
        return systemAudio.snapshot;
      }
    } catch {
      // fall through
    }
  }

  return { status: 'unsupported', granted: false, canRequest: false };
}

export async function requestMicrophoneAccess(): Promise<PermissionSnapshot> {
  const isDesktop = Boolean(globalThis.window.desktop?.permissions);

  if (isDesktop) {
    const platform =
      (await globalThis.window.desktop?.app.getInfo().catch(() => null))?.platform ?? 'darwin';

    if (platform === 'win32') {
      await requestWebMicrophone();
    }
    const desktop = await requestDesktopMicrophone();
    if (desktop) {
      return desktop;
    }
  }

  return requestWebMicrophone();
}

export {
  type PermissionAction,
  type PermissionIconKey,
  type PermissionCatalog,
  type PermissionRequestKind,
  type PermissionItem, type PermissionSnapshot, type PermissionTarget, type PermissionStatus
} from './permissions.types';
export { deriveAction } from './permission-actions';

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'restricted'
  | 'unknown'
  | 'unsupported';

export type PermissionSnapshot = {
  status: PermissionStatus;
  granted: boolean;
  canRequest?: boolean;
};

export type PermissionRequestKind = 'systemPrompt' | 'settingsOnly';
export type PermissionAction = 'enable' | 'openSettings' | 'none';
export type PermissionTarget = 'microphone' | 'systemAudio' | 'notifications';
export type PermissionIconKey = 'microphone' | 'systemAudio' | 'notifications';

export type PermissionItem = {
  id: PermissionTarget;
  title: string;
  description: string;
  requestKind: PermissionRequestKind;
  icon: PermissionIconKey;
  snapshot: PermissionSnapshot;
  action: PermissionAction;
  helpText: string | null;
};

export type PermissionCatalog = {
  platform: string;
  items: PermissionItem[];
};

function toPermissionStatus(status: string): PermissionStatus {
  const allowed: PermissionStatus[] = [
    'granted',
    'denied',
    'not-determined',
    'restricted',
    'unknown',
    'unsupported',
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
    ...(snapshot.canRequest !== undefined ? { canRequest: snapshot.canRequest } : {}),
  };
}

function deriveAction(requestKind: PermissionRequestKind, snapshot: PermissionSnapshot): PermissionAction {
  if (snapshot.granted) {
    return 'none';
  }

  if (requestKind === 'settingsOnly') {
    return 'openSettings';
  }

  if (snapshot.status === 'denied' || snapshot.status === 'restricted') {
    return 'openSettings';
  }

  return 'enable';
}

function buildSystemAudioItem(
  platform: string,
  snapshot: PermissionSnapshot = {
    status: platform === 'darwin' ? 'not-determined' : 'unsupported',
    granted: platform === 'win32',
    canRequest: platform === 'darwin',
  }
): PermissionItem {
  const visibleOnDesktop = platform === 'darwin' || platform === 'win32';

  return {
    id: 'systemAudio',
    title: 'System audio recording',
    description:
      platform === 'darwin'
        ? 'Capture audio from meeting apps and other participants.'
        : platform === 'win32'
          ? 'Capture audio from other meeting apps and participants.'
          : 'Capture audio from meeting apps and other participants.',
    requestKind: 'settingsOnly',
    icon: 'systemAudio',
    snapshot: visibleOnDesktop
      ? snapshot
      : { status: 'unsupported', granted: false, canRequest: false },
    action: visibleOnDesktop ? deriveAction('settingsOnly', snapshot) : 'none',
    helpText: visibleOnDesktop
      ? null
      : 'System audio recording is available in the desktop app only.',
  };
}

function buildWebPermissionItems(): PermissionItem[] {
  return [
    {
      id: 'microphone',
      title: 'Microphone access',
      description: 'Capture your voice during meetings for live transcription.',
      requestKind: 'systemPrompt',
      icon: 'microphone',
      snapshot: { status: 'not-determined', granted: false, canRequest: true },
      action: 'enable',
      helpText: null,
    },
    buildSystemAudioItem('web'),
    {
      id: 'notifications',
      title: 'Meeting reminders',
      description: 'Get notified before meetings start and when summaries are ready.',
      requestKind: 'systemPrompt',
      icon: 'notifications',
      snapshot: { status: 'not-determined', granted: false, canRequest: true },
      action: 'enable',
      helpText: null,
    },
  ];
}

export function getDefaultPermissionCatalog(platform = 'web'): PermissionCatalog {
  if (platform === 'darwin' || platform === 'win32') {
    const microphone: PermissionSnapshot = {
      status: 'not-determined',
      granted: false,
      canRequest: true,
    };
    const notifications: PermissionSnapshot = {
      status: 'not-determined',
      granted: false,
      canRequest: true,
    };
    const systemAudio: PermissionSnapshot = {
      status: platform === 'darwin' ? 'not-determined' : 'unsupported',
      granted: platform === 'win32',
      canRequest: platform === 'darwin',
    };

    return {
      platform,
      items: [
        {
          id: 'microphone',
          title: 'Microphone access',
          description: 'Capture your voice during meetings for live transcription.',
          requestKind: 'systemPrompt',
          icon: 'microphone',
          snapshot: microphone,
          action: 'enable',
          helpText: null,
        },
        buildSystemAudioItem(platform, systemAudio),
        {
          id: 'notifications',
          title: 'Meeting reminders',
          description: 'Get notified before meetings start and when summaries are ready.',
          requestKind: 'systemPrompt',
          icon: 'notifications',
          snapshot: notifications,
          action: 'enable',
          helpText: null,
        },
      ],
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
  const notifications = toPermissionSnapshot(raw.notifications);
  const systemAudio = toPermissionSnapshot(
    raw.systemAudio ??
      raw.screenCapture ??
      (raw.platform === 'darwin'
        ? { status: 'not-determined', granted: false, canRequest: true }
        : { status: 'unsupported', granted: true, canRequest: false })
  );

  const items: PermissionItem[] = [
    {
      id: 'microphone',
      title: 'Microphone access',
      description: 'Capture your voice during meetings for live transcription.',
      requestKind: 'systemPrompt',
      icon: 'microphone',
      snapshot: microphone,
      action: deriveAction('systemPrompt', microphone),
      helpText: null,
    },
  ];

  if (raw.platform === 'darwin' || raw.platform === 'win32') {
    items.push({
      ...buildSystemAudioItem(raw.platform, systemAudio),
      action: deriveAction('settingsOnly', systemAudio),
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
    helpText: null,
  });

  return { platform: raw.platform, items };
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
      items: raw.items.map((item) => toPermissionItem(item)),
    };
  }

  if (raw.microphone) {
    return buildLegacyDesktopCatalog(raw as LegacyDesktopPermissionResponse);
  }

  return getDefaultPermissionCatalog(raw.platform ?? 'darwin');
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
    action: raw.action ?? deriveAction(raw.requestKind, snapshot),
    helpText: raw.helpText,
  };
}

export async function fetchPermissionCatalog(isDesktopHint: boolean): Promise<PermissionCatalog> {
  const hasDesktopApi = Boolean(globalThis.window.desktop?.permissions);
  const isDesktop = isDesktopHint || hasDesktopApi;

  if (isDesktop && hasDesktopApi) {
    try {
      const raw = await globalThis.window.desktop!.permissions.getAll();
      let catalog = normalizeDesktopPermissionResponse(raw);

      if (catalog.platform === 'win32' || catalog.platform === 'linux') {
        const notificationSnapshot = await getWebNotificationPermission();
        catalog = {
          ...catalog,
          items: catalog.items.map((item) =>
            item.id === 'notifications'
              ? {
                  ...item,
                  snapshot: notificationSnapshot,
                  action: deriveAction(item.requestKind, notificationSnapshot),
                  helpText: notificationSnapshot.granted
                    ? null
                    : 'Allow notifications in your browser or system settings if reminders are blocked.',
                }
              : item
          ),
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

  const [microphone, notifications] = await Promise.all([
    queryWebMicrophone(),
    getWebNotificationPermission(),
  ]);

  return {
    platform: 'web',
    items: buildWebPermissionItems().map((item) => {
      if (item.id === 'microphone') {
        return {
          ...item,
          snapshot: microphone,
          action: deriveAction(item.requestKind, microphone),
          helpText: microphone.granted
            ? null
            : microphone.status === 'denied'
              ? 'Microphone access was denied. Enable it in your browser site settings.'
              : null,
        };
      }

      if (item.id === 'notifications') {
        return {
          ...item,
          snapshot: notifications,
          action: deriveAction(item.requestKind, notifications),
          helpText: notifications.granted
            ? null
            : notifications.status === 'denied'
              ? 'Notifications were blocked. Enable them in your browser site settings.'
              : null,
        };
      }

      return item;
    }),
  };
}

export async function requestPermissionItem(
  id: PermissionTarget,
  catalog: PermissionCatalog
): Promise<void> {
  const item = catalog.items.find((entry) => entry.id === id);
  if (!item || item.action === 'none') {
    return;
  }

  const isDesktop = Boolean(globalThis.window.desktop?.permissions);
  const { platform } = catalog;

  if (item.action === 'openSettings') {
    if (isDesktop) {
      await openDesktopPermissionSettings(id);
    }
    return;
  }

  if (id === 'microphone') {
    if (isDesktop) {
      if (platform === 'win32' && !item.snapshot.granted) {
        await requestWebMicrophone();
      }
      await requestDesktopMicrophone();
      return;
    }
    await requestWebMicrophone();
    return;
  }

  if (id === 'notifications') {
    if (isDesktop) {
      if (platform === 'darwin') {
        await requestDesktopNotifications();
      } else {
        await requestWebNotificationPermission();
      }
      return;
    }
    await requestWebNotificationPermission();
  }
}

export async function requestDesktopMicrophone(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api) return null;
  return toPermissionSnapshot(await api.requestMicrophone());
}

export async function requestDesktopNotifications(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api?.requestNotifications) return null;
  return toPermissionSnapshot(await api.requestNotifications());
}

export async function openDesktopPermissionSettings(target: PermissionTarget) {
  const api = globalThis.window.desktop?.permissions;
  if (!api) return { ok: false };
  return api.openSettings(target);
}

export async function queryWebMicrophone(): Promise<PermissionSnapshot> {
  if (!navigator.permissions?.query) {
    return { status: 'unknown', granted: false, canRequest: true };
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
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

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

export type DesktopPermissionsState = {
  platform: string;
  microphone: PermissionSnapshot;
  accessibility: PermissionSnapshot;
  notifications: PermissionSnapshot;
};

export type PermissionTarget = 'microphone' | 'accessibility' | 'notifications';

export async function fetchDesktopPermissions(): Promise<DesktopPermissionsState | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api) return null;
  return api.getAll();
}

export async function requestDesktopMicrophone(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api) return null;
  return api.requestMicrophone();
}

export async function requestDesktopAccessibility(): Promise<PermissionSnapshot | null> {
  const api = globalThis.window.desktop?.permissions;
  if (!api) return null;
  return api.requestAccessibility();
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

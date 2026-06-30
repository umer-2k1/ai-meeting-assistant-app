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
export type PermissionAction = 'grantAccess' | 'openSettings';
export type PermissionTarget = 'accessibility' | 'microphone' | 'systemAudio' | 'notifications';
export type PermissionIconKey = 'accessibility' | 'microphone' | 'systemAudio' | 'notifications';

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

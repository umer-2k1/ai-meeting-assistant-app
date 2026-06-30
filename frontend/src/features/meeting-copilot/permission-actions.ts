import type { PermissionSnapshot } from './permissions.types';

export function deriveAction(snapshot: PermissionSnapshot): 'grantAccess' | 'openSettings' {
  if (snapshot.granted) {
    return 'openSettings';
  }

  return 'grantAccess';
}

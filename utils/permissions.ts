import { useAuthStore } from '@/store/authStore';

export type PermissionUser = { role: 'owner' | 'staff'; permissions?: string[] } | null | undefined;

/**
 * Owners implicitly hold every permission (the backend auto-grants ALL_PERMISSIONS
 * to owner accounts), so the frontend must mirror that bypass rather than relying
 * on the staff-only permissions array for owner checks.
 */
export const hasPermission = (user: PermissionUser, permission: string): boolean => {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return !!user.permissions?.includes(permission);
};

export const usePermission = (permission: string): boolean => {
  const user = useAuthStore((s) => s.user);
  return hasPermission(user, permission);
};

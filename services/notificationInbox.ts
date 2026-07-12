import api from './api';

// The in-app inbox — persisted server-side by every push the backend sends
// (see utils/push.js on the backend), independent of whether the device
// ever had push permission granted. Distinct from services/notifications.ts,
// which is about device-level permission/registration, not inbox content.

export interface AppNotification {
  _id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  type: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  success: boolean;
  data: AppNotification[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export async function getNotifications(params?: { page?: number; limit?: number; unread?: boolean }): Promise<NotificationsPage> {
  const res = await api.get('/notifications', { params });
  return res.data;
}

export async function getUnreadCount(): Promise<{ success: boolean; data: { count: number } }> {
  const res = await api.get('/notifications/unread-count');
  return res.data;
}

export async function markNotificationRead(id: string): Promise<{ success: boolean; data: AppNotification }> {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; message: string }> {
  const res = await api.patch('/notifications/read-all');
  return res.data;
}

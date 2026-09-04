import Ionicons from '@expo/vector-icons/Ionicons';

/** Icon per notification `type`, shared by the inbox list and the detail sheet. */
export const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  depletion_alert: 'cube-outline',
  negative_stock_alert: 'alert-circle-outline',
  daily_sales_anomaly: 'trending-up-outline',
  daily_summary: 'bar-chart-outline',
  subscription_reminder: 'shield-checkmark-outline',
  shift_closed: 'time-outline',
  campaign: 'megaphone-outline',
  general: 'notifications-outline',
};

/**
 * Human-readable name for a notification `type`. Only shown in the detail
 * sheet — the list rows are already dense enough without a category line.
 */
export const TYPE_LABEL: Record<string, string> = {
  depletion_alert: 'Stock alert',
  negative_stock_alert: 'Negative stock',
  daily_sales_anomaly: 'Sales alert',
  daily_summary: 'Daily summary',
  subscription_reminder: 'Subscription',
  shift_closed: 'Shift',
  campaign: 'Announcement',
  general: 'Notification',
};

export const iconForType = (type: string) => TYPE_ICON[type] ?? TYPE_ICON.general;
export const labelForType = (type: string) => TYPE_LABEL[type] ?? TYPE_LABEL.general;

import { useMemo } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { OwnerDashboardData } from '@/services/dashboard';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useShift } from '@/hooks/useShift';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  severity: AttentionSeverity;
  /** Destination when tapped; omitted for purely informational items. */
  route?: string;
}

const SEVERITY_ORDER: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Everything on the dashboard that genuinely needs the owner's hand today,
 * ranked by urgency. Deliberately exhaustive-but-small: if this list is empty
 * the Needs Attention section unmounts and the dashboard stays calm.
 */
export const useOwnerAttention = (data: OwnerDashboardData | undefined): AttentionItem[] => {
  const { pendingCount, isSyncing } = useOfflineQueue();
  const { enabled: shiftsEnabled } = useShift();

  return useMemo(() => {
    const items: AttentionItem[] = [];

    const lowStock = data?.lowStockItems ?? [];
    if (lowStock.length > 0) {
      const critical = lowStock.filter((i) => i.quantity <= 2);
      const worst = lowStock[0];
      items.push({
        id: 'low-stock',
        icon: 'cube-outline',
        title:
          lowStock.length === 1
            ? `${worst.name} is running low`
            : `${lowStock.length} products running low`,
        subtitle:
          critical.length > 0
            ? `${critical.length} nearly out — restock to avoid lost sales`
            : 'Restock soon to stay ahead',
        severity: critical.length > 0 ? 'critical' : 'warning',
        // A single flagged product goes straight to that product; with
        // several, land on the inventory list instead of picking one.
        route:
          lowStock.length === 1
            ? `/(owner)/inventory/${worst._id}/edit`
            : '/(owner)/inventory',
      });
    }

    if (pendingCount > 0) {
      items.push({
        id: 'pending-sync',
        icon: isSyncing ? 'sync-outline' : 'cloud-upload-outline',
        title: `${pendingCount} sale${pendingCount === 1 ? '' : 's'} waiting to sync`,
        subtitle: isSyncing ? 'Syncing now…' : 'Will sync automatically when online',
        severity: 'info',
      });
    }

    const openShifts = data?.openShiftsCount ?? 0;
    if (shiftsEnabled && openShifts > 0) {
      items.push({
        id: 'open-shift',
        icon: 'time-outline',
        title: `${openShifts} shift${openShifts === 1 ? '' : 's'} still open`,
        subtitle: 'Close shifts to reconcile the cash drawer',
        severity: 'warning',
        route: '/(owner)/shifts',
      });
    }

    return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [data?.lowStockItems, data?.openShiftsCount, pendingCount, isSyncing, shiftsEnabled]);
};

/** Staff see only what they can act on themselves: their unsynced work. */
export const useStaffAttention = (): AttentionItem[] => {
  const { pendingCount, isSyncing } = useOfflineQueue();

  return useMemo(() => {
    if (pendingCount === 0) return [];
    return [
      {
        id: 'pending-sync',
        icon: isSyncing ? ('sync-outline' as const) : ('cloud-upload-outline' as const),
        title: `${pendingCount} sale${pendingCount === 1 ? '' : 's'} waiting to sync`,
        subtitle: isSyncing ? 'Syncing now…' : 'Will sync automatically when online',
        severity: 'info' as const,
      },
    ];
  }, [pendingCount, isSyncing]);
};

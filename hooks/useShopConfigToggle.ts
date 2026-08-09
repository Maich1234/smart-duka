import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAlert } from '@/context/AlertContext';
import { updateShopConfig, type ShopConfigResponse, type UpdateShopConfigData } from '@/services/shop';

type BooleanShopConfigField = Extract<
  keyof UpdateShopConfigData,
  'shiftManagementEnabled' | 'showStaffCommission' | 'purchasingEnabled' | 'aiEnabled' | 'barcodeScanningEnabled'
>;

/**
 * Optimistically flips a single boolean flag on the shop config: updates the
 * ['shopConfig'] cache immediately, persists via PUT /shop, and rolls the
 * cache back with an error toast if the write fails. Every owner-only
 * feature toggle in Settings (shift management, purchasing, barcode
 * scanning, staff commission visibility, AI) did this exact 15-line dance
 * inline before — extracted so the rollback behavior can't drift between them.
 */
export function useShopConfigToggle(
  field: BooleanShopConfigField,
  messages: { on: string; off: string },
  extraInvalidateKeys: string[][] = [],
) {
  const queryClient = useQueryClient();
  const { toast } = useAlert();
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    const previous = queryClient.getQueryData<ShopConfigResponse>(['shopConfig']);
    queryClient.setQueryData<ShopConfigResponse>(['shopConfig'], (old) =>
      old ? { ...old, data: { ...old.data, [field]: enabled } } : old
    );
    setToggling(true);
    try {
      await updateShopConfig({ [field]: enabled } as UpdateShopConfigData);
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      extraInvalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ type: 'success', message: enabled ? messages.on : messages.off });
    } catch (error: any) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: error.response?.data?.message || 'Could not update the setting' });
    } finally {
      setToggling(false);
    }
  };

  return { toggling, handleToggle };
}

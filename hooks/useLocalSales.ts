import { useSyncExternalStore } from 'react';
import { getLocalSalesSnapshot, onLocalSalesChange, type LocalSale } from '@/utils/localSales';

const EMPTY: LocalSale[] = [];

/** Reactive view of this device's not-yet-server-confirmed sales for a shop. */
export const useLocalSales = (shopId: string): LocalSale[] =>
  useSyncExternalStore(
    onLocalSalesChange,
    () => (shopId ? getLocalSalesSnapshot(shopId) : EMPTY),
    () => EMPTY,
  );

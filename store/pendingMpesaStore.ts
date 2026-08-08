import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateSaleData } from '@/services/sales';

/**
 * An STK push that was sent but hadn't reached a terminal state (success/
 * failed/cancelled/timeout) the last time this device saw it — held locally
 * so the till can pick up where it left off after a background/relaunch
 * instead of losing all trace of a payment the customer may have completed.
 *
 * `saleItems` is a snapshot taken at the moment the STK push went out, not a
 * live reference to the cart — recovery after a real app kill needs its own
 * copy of what was being sold, since the cart itself may have been cleared,
 * changed, or (being a separate persisted store) simply not loaded yet.
 */
export interface PendingMpesaPayment {
  transactionId: string;
  shopId: string;
  phoneNumber: string;
  amount: number;
  saleItems: CreateSaleData['items'];
  createdAt: string;
}

interface PendingMpesaState {
  payment: PendingMpesaPayment | null;
  set: (payment: PendingMpesaPayment) => void;
  clear: () => void;
}

export const usePendingMpesaStore = create<PendingMpesaState>()(
  persist(
    (set) => ({
      payment: null,
      set: (payment) => set({ payment }),
      clear: () => set({ payment: null }),
    }),
    {
      name: 'pending-mpesa-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

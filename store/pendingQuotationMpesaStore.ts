import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * An STK push sent while converting a quotation to a sale, held locally so
 * that screen can pick up where it left off after a background/relaunch
 * instead of losing all trace of a payment the customer may have completed —
 * same purpose as pendingMpesaStore.ts's till version, but its own separate
 * store rather than a shared slot: a pending till sale and a pending
 * quotation conversion in flight on the same device at once must never
 * overwrite each other or have one screen misread the other's record (the
 * till's recovery logic assumes every persisted record is a till sale with
 * `saleItems` — feeding it a quotation-conversion record instead would be a
 * real bug, not just a wrong screen).
 *
 * No saleItems snapshot needed here (unlike the till's version): a
 * quotation's items are already fixed server-side by quotationId, so
 * recovery only needs enough to reopen the modal and re-submit the convert
 * call once the payment resolves.
 */
export interface PendingQuotationMpesaPayment {
  quotationId: string;
  transactionId: string;
  shopId: string;
  phoneNumber: string;
  amount: number;
  createdAt: string;
}

interface PendingQuotationMpesaState {
  payment: PendingQuotationMpesaPayment | null;
  set: (payment: PendingQuotationMpesaPayment) => void;
  clear: () => void;
}

export const usePendingQuotationMpesaStore = create<PendingQuotationMpesaState>()(
  persist(
    (set) => ({
      payment: null,
      set: (payment) => set({ payment }),
      clear: () => set({ payment: null }),
    }),
    {
      name: 'pending-quotation-mpesa-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

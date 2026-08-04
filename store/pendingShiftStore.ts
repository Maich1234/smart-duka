import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shift } from '@/services/shifts';

/**
 * A shift the cashier opened while offline, held locally until the queued
 * `POST /shifts/start` reaches the server.
 *
 * Shift start is the one gate standing between a cashier and the till, and it
 * was the only thing in the app that could not be done offline: the request
 * went to the outbox like everything else, but the sheet read the resulting
 * "saved offline" rejection as an error and no shift ever opened. With shift
 * management on, that made the whole offline mode useless — the network going
 * down at 7am meant no selling until it came back, which is the exact moment
 * offline support is supposed to earn its keep.
 *
 * Nothing here needs the server's blessing: the opening float is cash the
 * cashier counted in their own hand. So the shift opens locally and the
 * server is told when it can be reached.
 *
 * Persisted because the queue is: an app restart (or a battery swap mid-
 * outage) must not reinstate the lock on a till whose drawer is already
 * counted and open.
 */
export interface PendingShift {
  /** Sentinel id. Never sent to the server — shift close posts to `current`. */
  _id: string;
  startedAt: string;
  openingFloat: number;
  openingNote?: string;
  /** The account that opened it; a different cashier must not inherit it. */
  userId: string;
}

/** Distinguishes a local shift from a server one at the call site. */
export const PENDING_SHIFT_ID = 'pending-local-shift';

interface PendingShiftState {
  shift: PendingShift | null;
  /**
   * Account whose shift close is sitting in the outbox.
   *
   * The symmetric half of `shift`: closing offline queues the request, and
   * without this the shift the server still believes is open would keep the
   * banner up and the till unlocked, so the cashier clocks out and the app
   * carries on as if they hadn't.
   */
  closePendingFor: string | null;
  open: (input: { openingFloat: number; openingNote?: string; userId: string }) => void;
  clear: () => void;
  markClosePending: (userId: string) => void;
  clearClosePending: () => void;
}

export const usePendingShiftStore = create<PendingShiftState>()(
  persist(
    (set) => ({
      shift: null,
      closePendingFor: null,

      open: ({ openingFloat, openingNote, userId }) =>
        set({
          shift: {
            _id: PENDING_SHIFT_ID,
            startedAt: new Date().toISOString(),
            openingFloat,
            openingNote,
            userId,
          },
          // Opening a shift ends any stale close intent for this device.
          closePendingFor: null,
        }),

      clear: () => set({ shift: null }),

      markClosePending: (userId) => set({ shift: null, closePendingFor: userId }),

      clearClosePending: () => set({ closePendingFor: null }),
    }),
    {
      name: 'pending-shift-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Shapes the local shift like a server one so the banner, the gate, and the
 * close sheet can render it without special-casing. `shop` and `staff` are
 * blank because no screen reads them for the caller's own active shift.
 */
export const asShift = (pending: PendingShift): Shift => ({
  _id: pending._id,
  shop: '',
  staff: '',
  status: 'active',
  startedAt: pending.startedAt,
  openingFloat: pending.openingFloat,
  openingNote: pending.openingNote,
});

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Scan sound/vibration preference is deliberately device-local, same
 * reasoning as the chosen Bluetooth printer (see printerStore.ts): it's
 * "does THIS phone beep/buzz," not shop policy — a second till or the
 * owner's own phone must be free to have it on or off independently.
 */
export interface ScanFeedbackState {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  setVibrationEnabled: (v: boolean) => void;
}

export const useScanFeedbackStore = create<ScanFeedbackState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      vibrationEnabled: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      setVibrationEnabled: (v) => set({ vibrationEnabled: v }),
    }),
    {
      name: 'scan-feedback-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

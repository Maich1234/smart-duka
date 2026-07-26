import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaperWidth } from '@/utils/escpos';
import type { DiscoveredPrinter, SavedPrinter } from '@/utils/printerTypes';

/**
 * The chosen Bluetooth printer is deliberately device-local rather than part of
 * the shop config on the server: the printer belongs to the counter it sits on,
 * so a second till or the owner's own phone must be free to have a different
 * one (or none, and keep using the system print sheet).
 */
export interface PrinterState {
  printer: SavedPrinter | null;
  savePrinter: (printer: DiscoveredPrinter, paperWidth: PaperWidth) => void;
  setPaperWidth: (paperWidth: PaperWidth) => void;
  forgetPrinter: () => void;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      printer: null,
      savePrinter: (printer, paperWidth) => set({ printer: { ...printer, paperWidth } }),
      setPaperWidth: (paperWidth) =>
        set((state) => (state.printer ? { printer: { ...state.printer, paperWidth } } : state)),
      forgetPrinter: () => set({ printer: null }),
    }),
    {
      name: 'printer-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

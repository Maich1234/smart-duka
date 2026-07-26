import type { PaperWidth } from '@/utils/escpos';

/**
 * How the phone talks to the printer.
 *
 * - `classic` — Bluetooth RFCOMM/SPP. Android only, and what the budget 58mm
 *   printers sold locally almost always use.
 * - `ble`     — Bluetooth Low Energy. Works on Android and iOS, used by newer
 *   printer models (and the only option iOS has at all).
 */
export type PrinterTransport = 'classic' | 'ble';

export interface DiscoveredPrinter {
  /** MAC address on Android Classic/BLE, an opaque UUID on iOS. */
  id: string;
  name: string;
  transport: PrinterTransport;
  /** Classic only — already bonded in Android's Bluetooth settings. */
  paired?: boolean;
}

export interface SavedPrinter extends DiscoveredPrinter {
  paperWidth: PaperWidth;
}

/** Machine-readable failure reasons the UI maps to advice for the shopkeeper. */
export type PrinterErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'bluetooth_off'
  | 'not_found'
  | 'connect_failed'
  | 'write_failed';

export class PrinterError extends Error {
  constructor(
    readonly code: PrinterErrorCode,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PrinterError';
  }
}

export const printerErrorMessage = (error: unknown): string =>
  error instanceof PrinterError ? error.message : 'Could not print to the Bluetooth printer.';

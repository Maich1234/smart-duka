// Base file — TypeScript resolves types from here.
// Metro replaces this with bluetoothPrinter.native.ts on iOS/Android and
// bluetoothPrinter.web.ts on web, mirroring the printReceipt.* split.
import { PrinterError, type DiscoveredPrinter, type PrinterTransport, type SavedPrinter } from '@/utils/printerTypes';

export const availableTransports = (): PrinterTransport[] => [];

export const isBluetoothPrintingAvailable = (): boolean => false;

export const isBluetoothOn = async (): Promise<boolean> => false;

export const ensurePrinterPermissions = async (): Promise<boolean> => false;

export const listPairedPrinters = async (): Promise<DiscoveredPrinter[]> => [];

export const scanForPrinters = async (
  _onFound: (printer: DiscoveredPrinter) => void,
  _onFinished?: () => void
): Promise<() => void> => () => {};

export const printBytes = async (_printer: SavedPrinter, _bytes: Uint8Array): Promise<void> => {
  throw new PrinterError('unsupported', 'Bluetooth printing is not available on this device.');
};

export const disconnectPrinter = async (): Promise<void> => {};

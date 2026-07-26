// Web has no Bluetooth transport: Web Bluetooth cannot reach Classic SPP at
// all, and the ESC/POS write path needs a native socket. Everything reports
// "unsupported" so the UI hides Bluetooth setup and printing stays on the
// browser print dialog.
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
  throw new PrinterError('unsupported', 'Bluetooth printing is not available in the browser.');
};

export const disconnectPrinter = async (): Promise<void> => {};

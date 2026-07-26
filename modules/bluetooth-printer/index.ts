import {
  NativeModule,
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo-modules-core';

export interface ClassicBluetoothDevice {
  /** MAC address — the stable identifier we persist as the saved printer. */
  address: string;
  /** Friendly name, falling back to the address when the device withholds one. */
  name: string;
  paired: boolean;
}

type BluetoothPrinterEvents = {
  onDeviceFound: (device: ClassicBluetoothDevice) => void;
  onScanFinished: () => void;
};

declare class BluetoothPrinterNativeModule extends NativeModule<BluetoothPrinterEvents> {
  isSupported(): boolean;
  isEnabled(): boolean;
  getConnectedAddress(): string | null;
  getPairedDevices(): Promise<ClassicBluetoothDevice[]>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(address: string): Promise<void>;
  /** Raw ESC/POS payload, base64-encoded for the JS↔native boundary. */
  write(base64: string): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Null on iOS, web and Expo Go — Classic Bluetooth SPP is Android-only (see the
 * note in BluetoothPrinterModule.kt). Every caller must handle the null case;
 * `utils/bluetoothPrinter` is the facade that does so.
 */
const BluetoothPrinter = requireOptionalNativeModule<BluetoothPrinterNativeModule>('BluetoothPrinter');

export const isClassicSupported = (): boolean => {
  try {
    return BluetoothPrinter?.isSupported() ?? false;
  } catch {
    return false;
  }
};

export const addDeviceFoundListener = (
  listener: (device: ClassicBluetoothDevice) => void
): EventSubscription | null => BluetoothPrinter?.addListener('onDeviceFound', listener) ?? null;

export const addScanFinishedListener = (
  listener: () => void
): EventSubscription | null => BluetoothPrinter?.addListener('onScanFinished', listener) ?? null;

export default BluetoothPrinter;

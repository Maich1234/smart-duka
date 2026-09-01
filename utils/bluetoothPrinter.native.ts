import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Characteristic, type Device } from 'react-native-ble-plx';
import BluetoothPrinter, {
  addDeviceFoundListener,
  addScanFinishedListener,
  isClassicSupported,
  type ClassicBluetoothDevice,
} from '@/modules/bluetooth-printer';
import { bytesToBase64 } from '@/utils/escpos';
import {
  PrinterError,
  type DiscoveredPrinter,
  type PrinterTransport,
  type SavedPrinter,
} from '@/utils/printerTypes';

/**
 * One façade over the two Bluetooth transports a thermal printer might speak.
 *
 * Classic SPP (Android only, our local native module) covers the budget 58mm
 * printers dukas actually buy; BLE (react-native-ble-plx) covers newer models
 * and is iOS's only option. Callers pick a printer once in setup and then just
 * hand bytes to `printBytes` — which transport is in play stops mattering.
 */

// ---------------------------------------------------------------------- BLE

let bleManager: BleManager | null = null;
let bleUnavailable = false;

/**
 * Constructed lazily and never at import time: instantiating BleManager powers
 * up the Bluetooth stack and, where the native module failed to link (Expo Go,
 * a stale dev build), throws — which at import time would take the whole bundle
 * down with it instead of just disabling BLE printing.
 */
const getBleManager = (): BleManager | null => {
  if (bleManager || bleUnavailable) return bleManager;
  try {
    bleManager = new BleManager();
  } catch {
    bleUnavailable = true;
    bleManager = null;
  }
  return bleManager;
};

/** Cached per device so a reprint doesn't re-walk the GATT table every time. */
const bleWriteTargets = new Map<string, { serviceUUID: string; characteristicUUID: string; withoutResponse: boolean }>();

/**
 * BLE has no standard "printer" profile — vendors expose their own service, so
 * the only reliable approach is to take the first writable characteristic
 * found. Write-without-response is preferred: printers rarely acknowledge and
 * the with-response path is several times slower over a long receipt.
 */
const resolveBleWriteTarget = async (device: Device) => {
  const cached = bleWriteTargets.get(device.id);
  if (cached) return cached;

  const services = await device.services();
  for (const service of services) {
    let characteristics: Characteristic[];
    try {
      characteristics = await service.characteristics();
    } catch {
      continue;
    }
    const writable =
      characteristics.find((c) => c.isWritableWithoutResponse) ??
      characteristics.find((c) => c.isWritableWithResponse);
    if (writable) {
      const target = {
        serviceUUID: service.uuid,
        characteristicUUID: writable.uuid,
        withoutResponse: writable.isWritableWithoutResponse,
      };
      bleWriteTargets.set(device.id, target);
      return target;
    }
  }

  throw new PrinterError(
    'connect_failed',
    'This Bluetooth device does not accept print data. Make sure you picked the printer and not a phone or speaker.'
  );
};

/**
 * BLE caps each write at the negotiated MTU. 180 bytes fits the 185-byte
 * default many printers negotiate down to; larger receipts are simply split.
 */
const BLE_CHUNK_SIZE = 180;

const printViaBle = async (printer: SavedPrinter, bytes: Uint8Array): Promise<void> => {
  const manager = getBleManager();
  if (!manager) {
    throw new PrinterError('unsupported', 'Bluetooth is not available on this device.');
  }

  let device: Device;
  try {
    // Reuse the live connection when there is one — connectToDevice rejects on
    // an already-connected peripheral, which would break every reprint.
    const existing = (await manager.isDeviceConnected(printer.id))
      ? (await manager.devices([printer.id]))[0]
      : undefined;
    device = existing ?? (await manager.connectToDevice(printer.id, { timeout: 15000 }));
    await device.discoverAllServicesAndCharacteristics();
  } catch (error) {
    bleWriteTargets.delete(printer.id);
    throw new PrinterError(
      'connect_failed',
      `Could not reach ${printer.name}. Check that it is switched on and within range.`,
      error
    );
  }

  const { serviceUUID, characteristicUUID, withoutResponse } = await resolveBleWriteTarget(device);

  try {
    for (let offset = 0; offset < bytes.length; offset += BLE_CHUNK_SIZE) {
      const chunk = bytesToBase64(bytes.slice(offset, offset + BLE_CHUNK_SIZE));
      if (withoutResponse) {
        await manager.writeCharacteristicWithoutResponseForDevice(printer.id, serviceUUID, characteristicUUID, chunk);
        // Unacknowledged writes can outrun the print head's buffer.
        await new Promise((resolve) => setTimeout(resolve, 20));
      } else {
        await manager.writeCharacteristicWithResponseForDevice(printer.id, serviceUUID, characteristicUUID, chunk);
      }
    }
  } catch (error) {
    bleWriteTargets.delete(printer.id);
    throw new PrinterError('write_failed', `Lost connection to ${printer.name} while printing.`, error);
  }
};

// ------------------------------------------------------------------ Classic

/** The MAC address doubles as the printer id — it is what `connect` takes. */
const toClassicPrinter = (device: ClassicBluetoothDevice): DiscoveredPrinter => ({
  id: device.address,
  name: device.name,
  paired: device.paired,
  transport: 'classic',
});

const printViaClassic = async (printer: SavedPrinter, bytes: Uint8Array): Promise<void> => {
  if (!BluetoothPrinter) {
    throw new PrinterError('unsupported', 'Bluetooth printing is not available on this device.');
  }

  try {
    await BluetoothPrinter.connect(printer.id);
  } catch (error) {
    throw new PrinterError(
      'connect_failed',
      `Could not connect to ${printer.name}. Check that it is switched on, paired, and within range.`,
      error
    );
  }

  try {
    await BluetoothPrinter.write(bytesToBase64(bytes));
  } catch (error) {
    throw new PrinterError('write_failed', `Lost connection to ${printer.name} while printing.`, error);
  }
};

// ------------------------------------------------------------------- public

export const availableTransports = (): PrinterTransport[] => {
  const transports: PrinterTransport[] = [];
  if (Platform.OS === 'android' && isClassicSupported()) transports.push('classic');
  if (getBleManager()) transports.push('ble');
  return transports;
};

export const isBluetoothPrintingAvailable = (): boolean => availableTransports().length > 0;

export const isBluetoothOn = async (): Promise<boolean> => {
  if (BluetoothPrinter?.isSupported()) return BluetoothPrinter.isEnabled();
  const manager = getBleManager();
  if (!manager) return false;
  try {
    return (await manager.state()) === 'PoweredOn';
  } catch {
    return false;
  }
};

/**
 * Android 12+ gates scanning and connecting behind runtime Bluetooth
 * permissions; older versions gate discovery behind location instead. iOS
 * prompts on first use, handled by the system.
 */
export const ensurePrinterPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const required =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  try {
    const results = await PermissionsAndroid.requestMultiple(required);
    return required.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
};

/**
 * Devices already bonded in Android's Bluetooth settings. Most shopkeepers pair
 * the printer there once when they buy it, so this list — not a fresh scan — is
 * usually where they find it.
 */
export const listPairedPrinters = async (): Promise<DiscoveredPrinter[]> => {
  if (!BluetoothPrinter?.isSupported()) return [];
  try {
    const devices = await BluetoothPrinter.getPairedDevices();
    return devices.map((device) => toClassicPrinter(device));
  } catch (error) {
    throw toPrinterError(error, 'Could not read your paired Bluetooth devices.');
  }
};

/**
 * Scans both transports at once and streams results in. Returns a stop function;
 * callers must invoke it on unmount — an abandoned scan drains the battery and
 * blocks the next connect attempt.
 */
export const scanForPrinters = async (
  onFound: (printer: DiscoveredPrinter) => void,
  onFinished?: () => void
): Promise<() => void> => {
  const cleanups: (() => void)[] = [];
  const seen = new Set<string>();

  const report = (printer: DiscoveredPrinter) => {
    if (seen.has(printer.id)) return;
    seen.add(printer.id);
    onFound(printer);
  };

  let pending = 0;
  const finishOne = () => {
    pending -= 1;
    if (pending <= 0) onFinished?.();
  };

  if (BluetoothPrinter?.isSupported()) {
    pending += 1;
    const foundSub = addDeviceFoundListener((device) => report(toClassicPrinter(device)));
    const finishedSub = addScanFinishedListener(finishOne);
    cleanups.push(() => {
      foundSub?.remove();
      finishedSub?.remove();
      BluetoothPrinter?.stopScan().catch(() => {});
    });
    try {
      await BluetoothPrinter.startScan();
    } catch (error) {
      cleanups.forEach((fn) => fn());
      throw toPrinterError(error, 'Could not start scanning for printers.');
    }
  }

  const manager = getBleManager();
  if (manager) {
    pending += 1;
    // BLE printers always advertise a name; unnamed peripherals are watches,
    // beacons and earbuds, and listing them only makes the picker confusing.
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error || !device?.name) return;
      report({ id: device.id, name: device.name, transport: 'ble' });
    });
    // BLE scanning runs until stopped, so it never reports "finished" on its own.
    const bleTimeout = setTimeout(() => {
      manager.stopDeviceScan();
      finishOne();
    }, 15000);
    cleanups.push(() => {
      clearTimeout(bleTimeout);
      manager.stopDeviceScan();
    });
  }

  if (pending === 0) onFinished?.();

  return () => cleanups.forEach((fn) => fn());
};

export const printBytes = async (printer: SavedPrinter, bytes: Uint8Array): Promise<void> => {
  if (!(await isBluetoothOn())) {
    throw new PrinterError('bluetooth_off', 'Bluetooth is switched off. Turn it on and try again.');
  }
  if (!(await ensurePrinterPermissions())) {
    throw new PrinterError('permission_denied', 'DuQana needs Bluetooth permission to reach the printer.');
  }
  return printer.transport === 'ble' ? printViaBle(printer, bytes) : printViaClassic(printer, bytes);
};

export const disconnectPrinter = async (): Promise<void> => {
  try {
    await BluetoothPrinter?.disconnect();
  } catch {
    // Already disconnected.
  }
};

const toPrinterError = (error: unknown, fallback: string): PrinterError => {
  if (error instanceof PrinterError) return error;
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'ERR_BT_DISABLED':
      return new PrinterError('bluetooth_off', 'Bluetooth is switched off. Turn it on and try again.', error);
    case 'ERR_BT_PERMISSION':
      return new PrinterError('permission_denied', 'DuQana needs Bluetooth permission to find printers.', error);
    case 'ERR_BT_UNSUPPORTED':
      return new PrinterError('unsupported', 'This phone has no Bluetooth radio.', error);
    default:
      return new PrinterError('connect_failed', fallback, error);
  }
};

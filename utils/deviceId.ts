// Stable per-install device identity, used by the backend to enforce
// one-active-session-per-staff-account (owners are exempt). Generated once
// and cached in SecureStore — never derived from hardware IDs, since
// expo-device/expo-application aren't installed and this ID only needs to be
// stable for the lifetime of this app install, not globally unique across
// reinstalls.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secureStorage } from './secureStorage';
import { randomUUID } from './uuid';

const DEVICE_ID_KEY = 'device-id';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await secureStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const id = randomUUID();
  await secureStorage.setItem(DEVICE_ID_KEY, id);
  cachedDeviceId = id;
  return id;
}

export type DeviceInfo = {
  deviceId: string;
  deviceName?: string;
  platform: 'ios' | 'android' | 'web';
};

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = await getDeviceId();
  return {
    deviceId,
    deviceName: Constants.deviceName ?? undefined,
    platform: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
  };
}

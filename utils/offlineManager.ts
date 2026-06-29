import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { processQueue } from './offlineQueue';

export const setupOfflineListener = () => {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener(state => {
      const connected = !!state.isConnected;
      setOnline(connected);
      if (connected) {
        processQueue();
      }
    });
  });
};

export const isOnline = async (): Promise<boolean> => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected ?? false;
};
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

export const setupOfflineListener = () => {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener(state => {
      setOnline(!!state.isConnected);
    });
  });
};

export const isOnline = async (): Promise<boolean> => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected ?? false;
};
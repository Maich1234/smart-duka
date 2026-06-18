import { useEffect } from 'react';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnline } from '@/utils/offlineManager';
import api from '@/services/api';

const QUEUE_KEY = 'offline_mutations';

export function useSyncQueue() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const sync = async () => {
      const online = await isOnline();
      if (!online) return;
      
      // Get queued mutations from storage
      const queueData = await AsyncStorage.getItem(QUEUE_KEY);
      if (queueData) {
        const mutations = JSON.parse(queueData);
        for (const mutation of mutations) {
          try {
            await api.request(mutation);
            // Invalidate relevant queries after successful sync
            queryClient.invalidateQueries();
          } catch (e) {
            console.error('Sync failed for mutation', mutation, e);
          }
        }
        await AsyncStorage.removeItem(QUEUE_KEY);
      }
    };

    // Initial sync on mount
    sync();

    // Subscribe to online status changes
    const unsubscribe = onlineManager.subscribe(() => {
      sync();
    });
    
    return unsubscribe;
  }, [queryClient]);
}
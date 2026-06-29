import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { onQueueCountChange, onSyncStateChange, getPendingCount } from '@/utils/offlineQueue';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Use NetInfo listener instead of polling
    const unsubscribeNet = NetInfo.addEventListener(state => {
      setOnline(!!state.isConnected);
    });
    const unsubscribeCount = onQueueCountChange(setPendingCount);
    const unsubscribeSync = onSyncStateChange(setSyncing);

    // Seed initial values
    NetInfo.fetch().then(s => setOnline(!!s.isConnected));
    setPendingCount(getPendingCount());

    return () => {
      unsubscribeNet();
      unsubscribeCount();
      unsubscribeSync();
    };
  }, []);

  if (online && !syncing) return null;

  const isSyncBanner = online && syncing;
  const label = isSyncBanner
    ? `Syncing${pendingCount > 0 ? ` ${pendingCount} operation${pendingCount > 1 ? 's' : ''}` : ''}…`
    : pendingCount > 0
      ? `Offline · ${pendingCount} pending`
      : 'Offline';

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.sm },
        isSyncBanner && styles.syncing,
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.warning,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  syncing: {
    backgroundColor: Colors.primary,
  },
  text: {
    color: Colors.white,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'center',
  },
});

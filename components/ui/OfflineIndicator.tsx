import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isOnline } from '@/utils/offlineManager';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const check = async () => setOnline(await isOnline());
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  if (online) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <Text style={styles.text}>You are offline. Changes will sync when online.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.warning, paddingBottom: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center' },
  text: {
    color: Colors.white,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'center',
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isOnline } from '@/utils/offlineManager';
import { Colors } from '@/constants/Colors';

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const check = async () => setOnline(await isOnline());
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  if (online) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>You are offline. Changes will sync when online.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.warning, padding: 8, alignItems: 'center' },
  text: { color: Colors.white, fontSize: 12 },
});

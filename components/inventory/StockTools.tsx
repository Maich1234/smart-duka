import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

/** Visible destinations plus optional figures, keeping products close to the top. */
export function StockTools({ purchasingEnabled, children }: { purchasingEnabled: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View>
    <View style={styles.links}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open price checks" onPress={() => router.push('/(owner)/price-alerts')} style={styles.link}>
        <Ionicons name="pricetag-outline" size={18} color={Colors.primary} /><Text style={styles.label}>Price checks</Text>
      </Pressable>
      {purchasingEnabled && <Pressable accessibilityRole="button" accessibilityLabel="Open purchases" onPress={() => router.push('/(owner)/purchases')} style={styles.link}>
        <Ionicons name="cart-outline" size={18} color={Colors.primary} /><Text style={styles.label}>Purchases</Text>
      </Pressable>}
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.overview}>
      <Text style={styles.label}>Stock figures</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
    </Pressable>
    {expanded && children}
  </View>;
}
const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginTop: 12 },
  link: { flexGrow: 1, flexBasis: 120, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: Colors.primarySubtle },
  label: { flexShrink: 1, fontFamily: Typography.fontFamilySemiBold, fontSize: 14, color: Colors.primary },
  overview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48, paddingHorizontal: 16 },
});

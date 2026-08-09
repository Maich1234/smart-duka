import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useScanFeedbackStore } from '@/store/scanFeedbackStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * Scan sound/vibration is device-local (see scanFeedbackStore.ts) — same
 * reasoning as PrinterSection just above it on this screen: it's "does THIS
 * phone beep/buzz while I'm scanning," not shop policy, so whoever's holding
 * the till needs to be able to flip it themselves rather than asking the
 * owner to do it from Settings → Scanning.
 */
export const ScanFeedbackSection: React.FC = () => {
  const soundEnabled = useScanFeedbackStore((s) => s.soundEnabled);
  const vibrationEnabled = useScanFeedbackStore((s) => s.vibrationEnabled);
  const setSoundEnabled = useScanFeedbackStore((s) => s.setSoundEnabled);
  const setVibrationEnabled = useScanFeedbackStore((s) => s.setVibrationEnabled);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="volume-high-outline" size={17} color={Colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Scan Sound</Text>
          <Text style={styles.sub}>Beep when a barcode is recognized</Text>
        </View>
        <Switch
          value={soundEnabled}
          onValueChange={setSoundEnabled}
          trackColor={{ false: Colors.border, true: Colors.primaryLight }}
          thumbColor={soundEnabled ? Colors.primary : Colors.textTertiary}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait-outline" size={17} color={Colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Vibration</Text>
          <Text style={styles.sub}>Haptic feedback when a barcode is recognized</Text>
        </View>
        <Switch
          value={vibrationEnabled}
          onValueChange={setVibrationEnabled}
          trackColor={{ false: Colors.border, true: Colors.primaryLight }}
          thumbColor={vibrationEnabled ? Colors.primary : Colors.textTertiary}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    padding: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

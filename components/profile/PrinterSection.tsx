import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { usePrinterStore } from '@/store/printerStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * Entry point to Bluetooth printer setup from the staff Profile tab.
 *
 * Staff get this as well as owners because the printer is a property of the
 * till, not the account — whoever is standing at that counter is the one who
 * needs to re-pair it when it drops off.
 */
export const PrinterSection: React.FC<{ href: '/(staff)/printer' | '/(owner)/printer' }> = ({ href }) => {
  const printer = usePrinterStore((s) => s.printer);

  return (
    <View style={styles.card}>
      <AnimatedPressable
        style={styles.row}
        onPress={() => router.push(href)}
        accessibilityRole="button"
        accessibilityLabel="Set up a Bluetooth receipt printer"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="print-outline" size={17} color={Colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Receipt Printer</Text>
          <Text style={styles.sub}>
            {printer
              ? `${printer.name} · ${printer.paperWidth}mm`
              : 'Print straight to a Bluetooth thermal printer'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </AnimatedPressable>
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 56,
  },
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

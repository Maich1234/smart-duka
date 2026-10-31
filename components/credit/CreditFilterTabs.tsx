import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import type { CustomerFilter } from '@/services/customers';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

const FILTERS: { value: CustomerFilter; label: string }[] = [
  { value: 'all', label: 'All customers' },
  { value: 'outstanding', label: 'With balances' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid up' },
];
interface CreditFilterTabsProps { value: CustomerFilter; onChange: (value: CustomerFilter) => void }

/** All filters remain visible, with enough room for readable labels. */
export const CreditFilterTabs: React.FC<CreditFilterTabsProps> = ({ value, onChange }) => {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 600 || fontScale > 1.3;
  return <View style={styles.track}>
    {FILTERS.map(filter => <AnimatedPressable key={filter.value} onPress={() => onChange(filter.value)}
      accessibilityRole="button" accessibilityState={{ selected: value === filter.value }} accessibilityLabel={filter.label}
      style={[styles.option, { flexBasis: compact ? '45%' : '22%' }, value === filter.value && styles.active]}>
      <Text style={[styles.label, value === filter.value && styles.activeLabel]}>{filter.label}</Text>
    </AnimatedPressable>)}
  </View>;
};
const styles = StyleSheet.create({
  track: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface },
  active: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { fontFamily: Typography.fontFamilySemiBold, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  activeLabel: { color: Colors.white },
});

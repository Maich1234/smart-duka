import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date | undefined) => void;
}

const toInputValue = (d: Date) => d.toISOString().split('T')[0];

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => (
  <View style={styles.wrapper}>
    {React.createElement('input', {
      type: 'date',
      value: toInputValue(value),
      onChange: (e: any) => {
        const val = e.target.value;
        onChange(val ? new Date(val + 'T00:00:00') : undefined);
      },
      style: webStyles,
    })}
  </View>
);

const webStyles = {
  padding: `${Spacing.sm}px ${Spacing.md}px`,
  borderRadius: 8,
  border: `1px solid ${Colors.border}`,
  fontSize: 14,
  color: Colors.textPrimary,
  backgroundColor: Colors.surface,
  width: '100%',
  boxSizing: 'border-box' as const,
  outline: 'none',
  fontFamily: 'Inter_400Regular, sans-serif',
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});

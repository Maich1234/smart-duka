import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { BorderRadius } from '@/constants/BorderRadius';
import { Spacing } from '@/constants/Spacing';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  autoFocus = true,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const digits = Array.from({ length }, (_, i) => value[i] || '');
  // The "active" box is the next empty one (or the last if all filled)
  const activeIndex = Math.min(value.length, length - 1);

  const handleChangeText = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.wrapper}>
      {/* Hidden single TextInput captures all keyboard input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        autoFocus={autoFocus}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        caretHidden
        textContentType="oneTimeCode"
        accessibilityLabel={`Enter ${length}-digit verification code. ${value.length} of ${length} digits entered.`}
      />

      {/* Visual digit boxes */}
      <View style={styles.row}>
        {digits.map((digit, i) => {
          const isActive = isFocused && i === activeIndex;
          const isFilled = digit !== '';
          const hasError = !!error;

          return (
            <View
              key={i}
              style={[
                styles.cell,
                isFilled && styles.cellFilled,
                isActive && styles.cellActive,
                hasError && styles.cellError,
              ]}
            >
              <Text style={[styles.digit, !digit && styles.digitPlaceholder]}>
                {digit || (isActive ? '' : '·')}
              </Text>
              {isActive && <View style={styles.cursor} />}
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </Pressable>
  );
};

const CELL_WIDTH = 48;
const CELL_HEIGHT = 58;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: 0,
    left: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  cellActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primarySubtle,
  },
  cellError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerSubtle,
  },
  digit: {
    fontSize: 24,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  digitPlaceholder: {
    color: Colors.border,
    fontSize: 18,
  },
  cursor: {
    position: 'absolute',
    bottom: 12,
    width: 2,
    height: 20,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
  },
});

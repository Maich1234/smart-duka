import React, { useRef, useState } from 'react';
import { AnimatedPressable } from './AnimatedPressable';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  Animated,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import Ionicons from '@expo/vector-icons/Ionicons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  style,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const isSecure = secureTextEntry && !isPasswordVisible;

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? Colors.danger : Colors.border, error ? Colors.danger : Colors.primary],
  });

  const borderWidth = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.5, 2],
  });

  return (
    <View style={[styles.container, style as any]}>
      {label ? (
        <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
      ) : null}

      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor: error ? Colors.danger : borderColor,
            borderWidth: error ? 1.5 : borderWidth,
            backgroundColor: error ? Colors.dangerSubtle : Colors.surface,
          },
        ]}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={isFocused ? Colors.primary : Colors.textSecondary}
            style={styles.leftIcon}
          />
        ) : null}

        <TextInput
          style={[styles.input, { color: Colors.textPrimary }]}
          placeholderTextColor={Colors.textTertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isSecure}
          accessibilityLabel={accessibilityLabel ?? label}
          {...props}
        />

        {secureTextEntry ? (
          <AnimatedPressable
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textSecondary}
            />
          </AnimatedPressable>
        ) : rightIcon ? (
          onRightIconPress ? (
            <AnimatedPressable onPress={onRightIconPress} style={styles.iconButton}>
              <Ionicons name={rightIcon} size={20} color={Colors.textSecondary} />
            </AnimatedPressable>
          ) : (
            <View style={styles.iconButton}>
              <Ionicons name={rightIcon} size={20} color={Colors.textSecondary} />
            </View>
          )
        ) : null}
      </Animated.View>

      {error ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  labelError: {
    color: Colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.body,
    paddingVertical: 14,
    fontFamily: Typography.fontFamily,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  iconButton: {
    marginLeft: Spacing.sm,
    padding: 2,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  errorText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
    flex: 1,
  },
  hintText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 5,
  },
});

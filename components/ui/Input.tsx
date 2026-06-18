import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => setIsPasswordVisible(!isPasswordVisible);
  const isSecure = secureTextEntry && !isPasswordVisible;

  const getBorderColor = () => {
    if (error) return Colors.danger;
    if (isFocused) return Colors.primary;
    return Colors.border;
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: Colors.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor(), backgroundColor: Colors.surface },
        ]}
      >
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color={Colors.textSecondary} style={styles.leftIcon} />
        )}
        <TextInput
          style={[styles.input, { color: Colors.textPrimary }]}
          placeholderTextColor={Colors.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={togglePasswordVisibility} style={styles.rightIcon}>
            <Ionicons
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && onRightIconPress && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons name={rightIcon} size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.error, { color: Colors.danger }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: { fontSize: Typography.size.small, marginBottom: Spacing.xs, fontFamily: Typography.fontFamilySemiBold },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.body,
    paddingVertical: Spacing.md,
    fontFamily: Typography.fontFamily,
  },
  leftIcon: { marginRight: Spacing.sm },
  rightIcon: { marginLeft: Spacing.sm },
  error: { fontSize: Typography.size.caption, marginTop: Spacing.xs, fontFamily: Typography.fontFamily },
});
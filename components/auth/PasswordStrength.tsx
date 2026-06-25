import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

interface StrengthInfo {
  level: StrengthLevel;
  label: string;
  color: string;
}

function getStrength(password: string): StrengthInfo {
  if (!password) return { level: 0, label: '', color: Colors.border };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const map: Record<number, StrengthInfo> = {
    1: { level: 1, label: 'Weak', color: Colors.danger },
    2: { level: 2, label: 'Fair', color: Colors.warning },
    3: { level: 3, label: 'Good', color: Colors.accentLight },
    4: { level: 4, label: 'Strong', color: Colors.success },
  };
  return map[score] ?? { level: 1, label: 'Weak', color: Colors.danger };
}

const SEGMENTS = 4;

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const { level, label, color } = getStrength(password);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: level / SEGMENTS,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [level]);

  if (!password) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  label: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    minWidth: 42,
    textAlign: 'right',
  },
});

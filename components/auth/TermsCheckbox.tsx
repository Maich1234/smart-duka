import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { openLegal } from '@/utils/openLegal';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface TermsCheckboxProps {
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}

/**
 * Explicit consent to the Terms of Service and Privacy Policy, shown
 * immediately above the action it consents to.
 *
 * The app had no reference to either document anywhere before this — which is
 * both a Play Store problem (the policy must be reachable in-app) and a
 * consent-evidence problem under Kenya's Data Protection Act, 2019: an
 * affirmative, recorded act is far more defensible than a line of fine print
 * nobody had to interact with.
 *
 * The value is sent to the server, which refuses to create an account without
 * it and stores which version was accepted and when. A checkbox whose result
 * is never recorded proves nothing.
 *
 * Uses `button` role rather than `checkbox`, deliberately: RNGH pressables
 * with radio/checkbox roles never fire on web, so the state is carried in
 * accessibilityState instead. See the pressto/role gotcha noted elsewhere in
 * this codebase.
 */
export const TermsCheckbox: React.FC<TermsCheckboxProps> = ({ value, onChange, error }) => (
  <View style={styles.wrap}>
    <AnimatedPressable
      onPress={() => {
        haptics.light();
        onChange(!value);
      }}
      style={styles.row}
      accessibilityRole="button"
      accessibilityState={{ checked: value, selected: value }}
      accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
      accessibilityHint={value ? 'Tap to withdraw agreement' : 'Tap to agree'}
    >
      <View style={[styles.box, value && styles.boxChecked, !!error && !value && styles.boxError]}>
        {value && <Ionicons name="checkmark" size={15} color={Colors.white} />}
      </View>

      <Text style={styles.text}>
        I agree to the{' '}
        <Text style={styles.link} onPress={() => openLegal('terms')} accessibilityRole="link">
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={() => openLegal('privacy')} accessibilityRole="link">
          Privacy Policy
        </Text>
        .
      </Text>
    </AnimatedPressable>

    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    // Comfortable target for a thumb on a cheap phone.
    paddingVertical: 6,
    minHeight: 44,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  boxError: {
    borderColor: Colors.danger,
  },
  text: {
    flex: 1,
    fontSize: Typography.size.small,
    lineHeight: 20,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  link: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
    textDecorationLine: 'underline',
  },
  error: {
    marginTop: 4,
    marginLeft: 30,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
  },
});

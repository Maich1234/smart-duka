import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSubscription } from '@/hooks/useSubscription';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/**
 * Staff-dashboard subscription notice — the cashier's equivalent of the
 * owner's TrialBanner. Read-only and non-navigating: staff can't pay or
 * manage billing (there is no staff subscription screen), so unlike the
 * owner banner this never links anywhere. It only explains, before a sale
 * fails, why things might be about to stop working — staff previously had
 * no visibility into subscription state at all.
 */
export const StaffLockBanner: React.FC = () => {
  const { access, isLoading } = useSubscription();
  if (isLoading || !access) return null;

  let text: string;
  if (access.state === 'grace') {
    text = `This shop's subscription has ended. Ask the owner to renew — ${access.graceDaysLeft} day${access.graceDaysLeft === 1 ? '' : 's'} left before sales stop.`;
  } else if (access.state === 'locked') {
    text = 'This shop’s subscription has ended. Ask the owner to renew to keep selling.';
  } else {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
      <Text style={styles.text} numberOfLines={2}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.dangerSubtle,
  },
  text: {
    flex: 1,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
  },
});

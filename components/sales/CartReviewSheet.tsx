import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheet, SheetScrollBody, SheetFooter } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

/**
 * The line items, one tap from the till.
 *
 * They used to sit in the checkout panel itself, which meant every sale paid
 * for them in permanent screen height — and they are only ever read to fix
 * something: a wrong quantity, a double tap, the customer changing their
 * mind. Keeping them here leaves the panel with the three things that belong
 * on screen for every sale (total, payment, complete) and puts correction one
 * tap away on the total.
 */

interface CartReviewSheetProps {
  visible: boolean;
  onClose: () => void;
  itemCount: number;
  total: string;
  children: React.ReactNode;
}

export const CartReviewSheet: React.FC<CartReviewSheetProps> = ({
  visible,
  onClose,
  itemCount,
  total,
  children,
}) => (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    maxHeightPercent={80}
    footer={(
      <SheetFooter>
        <Button title="Done" onPress={onClose} size="lg" />
      </SheetFooter>
    )}
  >
    <View style={s.header}>
      <Text style={s.title} accessibilityRole="header">This sale</Text>
      <Text style={s.count}>{itemCount} item{itemCount === 1 ? '' : 's'} · {total}</Text>
    </View>

    <SheetScrollBody>
      {itemCount === 0 ? <EmptyState title="Nothing in this sale yet" /> : children}
    </SheetScrollBody>
  </BottomSheet>
);

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  count: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
});

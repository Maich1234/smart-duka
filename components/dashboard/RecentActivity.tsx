import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { formatCurrency, formatRelativeTime } from '@/utils/formatters';

const MAX_ITEMS = 4;

interface ActivityTransaction {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  staff?: { name: string };
}

interface RecentActivityProps {
  transactions: ActivityTransaction[];
  /** Where "View All" and row taps lead (the sales history screen). */
  viewAllRoute: string;
  showStaff?: boolean;
}

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash: { label: 'Cash', color: '#15803D', bg: '#DCFCE7', icon: 'cash-outline' },
  mpesa: { label: 'M-Pesa', color: '#1D4ED8', bg: '#DBEAFE', icon: 'phone-portrait-outline' },
  card: { label: 'Card', color: '#6D28D9', bg: '#EDE9FE', icon: 'card-outline' },
};

const getPaymentConfig = (method: string) =>
  PAYMENT_CONFIG[method.toLowerCase()] ?? {
    label: method,
    color: Colors.textSecondary,
    bg: Colors.divider,
    icon: 'wallet-outline' as keyof typeof Ionicons.glyphMap,
  };

/**
 * A four-row pulse check, not a ledger. Amount + payment method + how long
 * ago — the three things an owner glances for. Full history lives one tap
 * away behind View All; invoice numbers and details live there too.
 */
export const RecentActivity: React.FC<RecentActivityProps> = React.memo(
  ({ transactions, viewAllRoute, showStaff = false }) => {
    const visible = transactions.slice(0, MAX_ITEMS);

    const openHistory = () => {
      haptics.light();
      router.push(viewAllRoute as never);
    };

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          {transactions.length > 0 && (
            <AnimatedPressable
              onPress={openHistory}
              style={styles.viewAll}
              accessibilityRole="button"
              accessibilityLabel="View all sales"
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
            </AnimatedPressable>
          )}
        </View>

        {visible.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState title="No sales yet today" subtitle="Your first sale will show up here." />
          </View>
        ) : (
          <View style={styles.card}>
            {visible.map((item, index) => {
              const payment = getPaymentConfig(item.paymentMethod);
              return (
                <AnimatedPressable
                  key={item._id}
                  onPress={openHistory}
                  style={[styles.row, index < visible.length - 1 && styles.rowBorder]}
                  accessibilityRole="button"
                  accessibilityLabel={`${payment.label} sale of ${formatCurrency(item.totalAmount)}, ${formatRelativeTime(item.createdAt)}`}
                >
                  <View style={[styles.methodChip, { backgroundColor: payment.bg }]}>
                    <Ionicons name={payment.icon} size={16} color={payment.color} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {formatRelativeTime(item.createdAt)}
                      {showStaff && item.staff?.name ? `  ·  ${item.staff.name}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.paymentBadge, { backgroundColor: payment.bg }]}>
                    <Text style={[styles.paymentLabel, { color: payment.color }]}>{payment.label}</Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </View>
    );
  },
);

RecentActivity.displayName = 'RecentActivity';

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 12,
    minHeight: 32,
  },
  viewAllText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    minHeight: 60,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  methodChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  amount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  paymentLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.2,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '../ui/AnimatedPressable';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency } from '@/utils/formatters';

interface SaleCardProps {
  sale: {
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    paymentMethod: 'cash' | 'mpesa' | 'card';
    createdAt: string;
    staff?: { name: string };
    status?: 'completed' | 'voided' | 'refund_pending' | 'refunded';
  };
  currency?: string;
  showStaff?: boolean;
  onPress?: () => void;
}

const AVATAR_COLORS = [
  ['#0F766E', '#CCFBF1'],
  ['#9C6F1E', '#FEF3C7'],
  ['#7C3AED', '#EDE9FE'],
  ['#BE185D', '#FCE7F3'],
  ['#1D4ED8', '#DBEAFE'],
  ['#065F46', '#D1FAE5'],
];

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  mpesa:  { label: 'M-PESA', color: '#0F766E', bg: '#CCFBF1' },
  cash:   { label: 'CASH',   color: '#92400E', bg: '#FEF3C7' },
  card:   { label: 'CARD',   color: '#7C3AED', bg: '#EDE9FE' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function getAvatarColors(name: string): [string, string] {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return [AVATAR_COLORS[idx][0], AVATAR_COLORS[idx][1]];
}

function formatSaleTime(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-KE', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year} • ${time}`;
}

export const SaleCard: React.FC<SaleCardProps> = ({ sale, currency = 'KES', onPress }) => {
  const staffName = sale.staff?.name ?? 'Unknown';
  const initials = getInitials(staffName);
  const [avatarText, avatarBg] = getAvatarColors(staffName);
  const isVoided = sale.status === 'voided';
  const isRefunded = sale.status === 'refunded';
  const isRefundPending = sale.status === 'refund_pending';
  const payment = isVoided
    ? { label: 'VOIDED', color: '#B91C1C', bg: '#FEE2E2' }
    : isRefunded
    ? { label: 'REFUNDED', color: '#BE185D', bg: '#FCE7F3' }
    : isRefundPending
    ? { label: 'REFUNDING…', color: '#B45309', bg: '#FEF3C7' }
    : PAYMENT_CONFIG[sale.paymentMethod] ?? PAYMENT_CONFIG.cash;

  return (
    <AnimatedPressable onPress={onPress} style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={[styles.avatarText, { color: avatarText }]}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.invoice} numberOfLines={1}>{sale.invoiceNumber}</Text>
        <Text style={styles.name} numberOfLines={1}>{staffName}</Text>
        <View style={styles.timeRow}>
          <Ionicons name="calendar-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.time}>{formatSaleTime(sale.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={[styles.badge, { backgroundColor: payment.bg }]}>
          <Text style={[styles.badgeText, { color: payment.color }]}>{payment.label}</Text>
        </View>
        <Text style={[styles.amount, (isVoided || isRefunded) && styles.amountVoided]}>
          {formatCurrency(sale.totalAmount, currency)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} style={styles.chevron} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  invoice: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  name: {
    fontSize: Typography.size.caption,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  time: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.4,
  },
  amount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  amountVoided: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  chevron: {
    flexShrink: 0,
  },
});

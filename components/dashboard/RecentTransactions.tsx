import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState } from '../ui/EmptyState';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

interface Transaction {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  staff?: { name: string };
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  showStaff?: boolean;
}

const AVATAR_COLORS = [
  ['#0F766E', '#14B8A6'],
  ['#9C6F1E', '#C8932A'],
  ['#2563EB', '#60A5FA'],
  ['#7C3AED', '#A78BFA'],
  ['#059669', '#34D399'],
  ['#DC2626', '#F87171'],
];

const getAvatarColors = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash: { label: 'Cash', color: '#15803D', bg: '#DCFCE7', icon: 'cash-outline' },
  mpesa: { label: 'M-Pesa', color: '#1D4ED8', bg: '#DBEAFE', icon: 'phone-portrait-outline' },
  card: { label: 'Card', color: '#6D28D9', bg: '#EDE9FE', icon: 'card-outline' },
};

const getPaymentConfig = (method: string) =>
  PAYMENT_CONFIG[method.toLowerCase()] ?? {
    label: method,
    color: '#64748B',
    bg: '#F1F5F9',
    icon: 'wallet-outline' as keyof typeof Ionicons.glyphMap,
  };

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  showStaff = false,
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{transactions.length}</Text>
        </View>
      </View>

      {transactions.length === 0 ? (
        <EmptyState title="No transactions today" />
      ) : (
        <View style={styles.list}>
          {transactions.map((item, index) => {
            const staffName = item.staff?.name ?? 'Unknown';
            const [bg1, bg2] = getAvatarColors(staffName);
            const initials = getInitials(staffName);
            const payment = getPaymentConfig(item.paymentMethod);

            return (
              <Animated.View
                key={item._id}
                entering={FadeInUp.duration(320).delay(500 + index * 60)}
              >
                <View style={[styles.card, index < transactions.length - 1 && styles.cardBorder]}>
                  {/* Avatar */}
                  <View style={[styles.avatar, { backgroundColor: bg1 }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>

                  {/* Main info */}
                  <View style={styles.info}>
                    <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{formatDateTime(item.createdAt)}</Text>
                      {showStaff && item.staff ? (
                        <>
                          <Text style={styles.metaDot}>·</Text>
                          <Text style={styles.metaText}>{item.staff.name}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>

                  {/* Right side */}
                  <View style={styles.right}>
                    <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
                    <View style={[styles.paymentBadge, { backgroundColor: payment.bg }]}>
                      <Ionicons name={payment.icon} size={10} color={payment.color} />
                      <Text style={[styles.paymentLabel, { color: payment.color }]}>
                        {payment.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#94A3B8',
    letterSpacing: 1.1,
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  countText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#64748B',
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  cardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  invoiceNumber: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Typography.fontFamily,
  },
  metaDot: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#0F172A',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  paymentLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.2,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface AccountInfoProps {
  name: string;
  email: string;
  role: string;
}

// ─── Info row ─────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  iconColor: string;
  iconBg: string;
  isLast?: boolean;
  badge?: React.ReactNode;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, iconColor, iconBg, isLast, badge }) => (
  <View style={[rw.row, isLast && rw.rowLast]}>
    <View style={[rw.iconWrap, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={15} color={iconColor} />
    </View>
    <View style={rw.textWrap}>
      <Text style={rw.label}>{label}</Text>
      <Text style={rw.value} numberOfLines={1}>{value}</Text>
    </View>
    {badge}
  </View>
);

const rw = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginBottom: 2,
  },
  value: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export const AccountInfo: React.FC<AccountInfoProps> = ({ name, email, role }) => {
  const isOwner = role === 'owner';

  const roleBadge = (
    <View style={[styles.badge, { backgroundColor: isOwner ? Colors.accentSubtle : Colors.primarySubtle }]}>
      <Text style={[styles.badgeText, { color: isOwner ? Colors.accentDark : Colors.primaryDark }]}>
        {isOwner ? 'Owner' : 'Staff'}
      </Text>
    </View>
  );

  const statusBadge = (
    <View style={styles.statusBadge}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText}>Active</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <InfoRow
        icon="person-outline"
        label="Full Name"
        value={name || '—'}
        iconColor={Colors.primary}
        iconBg={Colors.primarySubtle}
        badge={statusBadge}
      />
      <InfoRow
        icon="mail-outline"
        label="Email Address"
        value={email || '—'}
        iconColor={Colors.info}
        iconBg="#EFF6FF"
      />
      <InfoRow
        icon={isOwner ? 'shield-checkmark-outline' : 'person-circle-outline'}
        label="Account Role"
        value={isOwner ? 'Shop Owner' : 'Staff Member'}
        iconColor={isOwner ? Colors.accent : Colors.textSecondary}
        iconBg={isOwner ? Colors.accentSubtle : Colors.divider}
        isLast
        badge={roleBadge}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: 11,
    color: Colors.success,
    fontFamily: Typography.fontFamilySemiBold,
  },
});

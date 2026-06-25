import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const AVATAR_PALETTE = [
  { bg: Colors.primarySubtle, text: Colors.primary },
  { bg: Colors.accentSubtle, text: Colors.accentDark },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FCE7F3', text: '#9D174D' },
];

function avatarColors(name: string) {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function deriveRole(permissions: string[]): string {
  if (permissions.includes('manage_staff') || permissions.includes('edit_shop_settings')) return 'Manager';
  if (permissions.includes('edit_inventory')) return 'Inventory';
  if (permissions.includes('manage_expenses')) return 'Sales';
  if (permissions.includes('record_sale')) return 'Cashier';
  return 'Staff';
}

interface StaffCardProps {
  staff: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    permissions: string[];
  };
  onPress: () => void;
  isLast?: boolean;
}

export const StaffCard: React.FC<StaffCardProps> = ({ staff, onPress }) => {
  const colors = avatarColors(staff.name);
  const role = deriveRole(staff.permissions);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: colors.bg }]}>
        <Text style={[styles.avatarText, { color: colors.text }]}>{initials(staff.name)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{staff.name}</Text>
        <Text style={styles.email} numberOfLines={1}>{staff.email}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, staff.isActive ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, staff.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {staff.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <View style={styles.badgeRole}>
            <Text style={styles.badgeRoleText}>{role}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  email: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeActive: {
    backgroundColor: Colors.successSubtle,
  },
  badgeInactive: {
    backgroundColor: Colors.dangerSubtle,
  },
  badgeText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
  },
  badgeTextActive: {
    color: Colors.success,
  },
  badgeTextInactive: {
    color: Colors.danger,
  },
  badgeRole: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.divider,
  },
  badgeRoleText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
});

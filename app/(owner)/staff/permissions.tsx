import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAllPermissions, type Permission } from '@/services/staff';
import { Button } from '@/components/ui/Button';
import { HelpLink } from '@/components/help/HelpLink';
import { useStaffDraftStore } from '@/store/staffDraftStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function StaffPermissionsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { data, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: getAllPermissions,
  });
  const { permissions: selected, setPermissions } = useStaffDraftStore();

  const allPermissions: Permission[] = data?.data || [];
  const grouped = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const toggle = (value: string) => {
    setPermissions(
      selected.includes(value) ? selected.filter((p) => p !== value) : [...selected, value]
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {selected.length} of {allPermissions.length} permissions selected
        </Text>
        <HelpLink slug="staff-permissions" label="What do these permissions control?" style={styles.helpLink} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {Object.entries(grouped).map(([category, perms]) => (
          <View key={category} style={styles.category}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {perms.map((perm) => {
              const isSelected = selected.includes(perm.value);
              return (
                <TouchableOpacity
                  key={perm.value}
                  style={styles.permissionRow}
                  onPress={() => toggle(perm.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={styles.permissionLabel}>{perm.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, Platform.OS === 'ios' && { paddingBottom: tabBarHeight + Spacing.sm }]}>
        <Button title="Done" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summary: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryText: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center' },
  helpLink: { alignSelf: 'center' },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  category: { marginBottom: Spacing.lg },
  categoryTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  permissionLabel: { fontSize: Typography.size.body, color: Colors.textPrimary, flex: 1 },
  footer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
});

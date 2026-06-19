import React, { useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getStaff } from '@/services/staff';
import { StaffCard } from '@/components/staff/StaffCard';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function OwnerStaffList() {
  const tabBarHeight = useBottomTabBarHeight();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['staff', search],
    queryFn: () => getStaff({ search }),
  });

  const staffList = data?.data || [];

  if (isLoading && staffList.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Staff</Text>
        <Button title="Add Staff" onPress={() => router.push('/(owner)/staff/new')} size="sm" />
      </View>
      <SearchBar value={search} onChangeText={setSearch} />
      <FlatList
        showsVerticalScrollIndicator={false}
        data={staffList}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <StaffCard staff={item} onPress={() => router.push(`/(owner)/staff/${item._id}`)} />
        )}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No staff found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  empty: { textAlign: 'center', marginTop: Spacing.xl, color: Colors.textSecondary },
});

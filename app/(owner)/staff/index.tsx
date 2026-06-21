import React, { useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
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
    return <LoadingState />;
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
        ListEmptyComponent={<EmptyState title="No staff found" subtitle="Add a team member to get started." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
});

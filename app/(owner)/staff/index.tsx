import React, { useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
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
import { Motion } from '@/constants/Motion';

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
    <Animated.View entering={FadeIn.duration(Motion.duration.slow)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Staff</Text>
        <Button title="Add Staff" onPress={() => router.push('/(owner)/staff/new')} size="sm" />
      </View>
      <SearchBar value={search} onChangeText={setSearch} />
      <FlatList
        showsVerticalScrollIndicator={false}
        data={staffList}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <StaffCard
            staff={item}
            isLast={index === staffList.length - 1}
            onPress={() => router.push(`/(owner)/staff/${item._id}`)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={<EmptyState title="No staff found" subtitle="Add a team member to get started." />}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
});

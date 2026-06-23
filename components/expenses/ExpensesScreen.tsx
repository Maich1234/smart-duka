import React, { useState } from 'react';
import { View, FlatList, RefreshControl, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { Button } from '@/components/ui/Button';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  type Expense,
  type ExpenseCategory,
  type CreateExpenseData,
} from '@/services/expenses';
import { ExpenseFormSheet } from '@/components/expenses/ExpenseFormSheet';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { usePermission } from '@/utils/permissions';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Motion } from '@/constants/Motion';
import { formatCurrency, formatDate } from '@/utils/formatters';

const CATEGORY_ICONS: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  rent: 'home-outline',
  utilities: 'flash-outline',
  supplies: 'cube-outline',
  transport: 'car-outline',
  salaries: 'people-outline',
  marketing: 'megaphone-outline',
  other: 'ellipsis-horizontal-outline',
};

/** Shared expense list/form screen mounted from both (owner) and (staff) route
 * groups — owners implicitly have `manage_expenses`, staff need it granted. */
export const ExpensesScreen: React.FC = () => {
  const tabBarHeight = useBottomTabBarHeight();
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const canManageExpenses = usePermission('manage_expenses');
  const [formVisible, setFormVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => getExpenses({ limit: 50 }),
    enabled: canManageExpenses,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expenseSummary'],
    queryFn: () => getExpenseSummary(),
    enabled: canManageExpenses,
  });

  const saveMutation = useMutation({
    mutationFn: (data: CreateExpenseData) =>
      editingExpense ? updateExpense(editingExpense._id, data) : createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
      setFormVisible(false);
      setEditingExpense(null);
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Could not save expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenseSummary'] });
    },
    onError: (error: any) => Alert.alert('Error', error.response?.data?.message || 'Deletion failed'),
  });

  const handleDelete = (expense: Expense) => {
    Alert.alert('Confirm', 'Delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(expense._id) },
    ]);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormVisible(true);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setFormVisible(true);
  };

  if (!canManageExpenses) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>You do not have permission to manage expenses.</Text>
      </View>
    );
  }

  if (isLoading) {
    return <LoadingState />;
  }

  const expenses = data?.data || [];
  const summary = summaryData?.data;

  return (
    <Animated.View entering={FadeIn.duration(Motion.duration.slow)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Button title="Add Expense" onPress={openAdd} size="sm" />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total Recorded</Text>
        <Text style={styles.summaryValue}>{formatCurrency(summary?.total || 0, currency)}</Text>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={expenses}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <ListRow
            title={item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            subtitle={`${item.description ? `${item.description} · ` : ''}${formatDate(item.date)}`}
            icon={CATEGORY_ICONS[item.category]}
            isLast={index === expenses.length - 1}
            onPress={() => openEdit(item)}
            trailing={
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>{formatCurrency(item.amount, currency)}</Text>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            }
          />
        )}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: tabBarHeight + Spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState title="No expenses recorded" subtitle="Add your first expense to start tracking spending." />
        }
      />

      <ExpenseFormSheet
        visible={formVisible}
        onClose={() => { setFormVisible(false); setEditingExpense(null); }}
        onSave={(data) => saveMutation.mutate(data)}
        expense={editingExpense}
        loading={saveMutation.isPending}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  empty: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },

  summary: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  summaryLabel: { fontSize: Typography.size.small, color: Colors.textSecondary },
  summaryValue: { fontSize: Typography.size.display, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginTop: 2 },

  expenseRight: { alignItems: 'flex-end', gap: Spacing.xs },
  expenseAmount: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
});

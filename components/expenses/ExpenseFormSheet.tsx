import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { DatePicker } from '../ui/DatePicker';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatDate } from '@/utils/formatters';
import type { CreateExpenseData, Expense, ExpenseCategory } from '@/services/expenses';

interface ExpenseFormSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateExpenseData) => void;
  expense?: Expense | null;
  loading?: boolean;
}

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'rent', label: 'Rent', icon: 'home-outline' },
  { value: 'utilities', label: 'Utilities', icon: 'flash-outline' },
  { value: 'supplies', label: 'Supplies', icon: 'cube-outline' },
  { value: 'transport', label: 'Transport', icon: 'car-outline' },
  { value: 'salaries', label: 'Salaries', icon: 'people-outline' },
  { value: 'marketing', label: 'Marketing', icon: 'megaphone-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export const ExpenseFormSheet: React.FC<ExpenseFormSheetProps> = ({
  visible,
  onClose,
  onSave,
  expense,
  loading = false,
}) => {
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCategory(expense?.category || 'other');
    setAmount(expense ? String(expense.amount) : '');
    setDescription(expense?.description || '');
    setDate(expense ? new Date(expense.date) : new Date());
  }, [visible, expense]);

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    onSave({ category, amount: parsedAmount, description: description.trim() || undefined, date: date.toISOString() });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>{expense ? 'Edit Expense' : 'Add Expense'}</Text>

      <Text style={styles.sectionLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORY_OPTIONS.map((opt) => {
          const active = category === opt.value;
          return (
            <AnimatedPressable
              key={opt.value}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setCategory(opt.value)}
            >
              <Ionicons name={opt.icon} size={16} color={active ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{opt.label}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" />
      <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="What was this for?" />

      <Text style={styles.sectionLabel}>Date</Text>
      <AnimatedPressable style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
        <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.dateText}>{formatDate(date)}</Text>
      </AnimatedPressable>
      {showDatePicker && (
        <DatePicker
          value={date}
          onChange={(d) => { setShowDatePicker(false); if (d) setDate(d); }}
        />
      )}

      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title={expense ? 'Save Changes' : 'Add Expense'} onPress={handleSave} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, color: Colors.textPrimary, textAlign: 'center' },
  sectionLabel: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary, marginBottom: Spacing.xs },

  categoryRow: { marginBottom: Spacing.md },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
  categoryChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  categoryChipText: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateText: { fontSize: Typography.size.body, color: Colors.textPrimary },

  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});

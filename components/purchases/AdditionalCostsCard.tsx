import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, { FadeIn, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, interpolate } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAlert } from '@/context/AlertContext';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { formatCurrency } from '@/utils/formatters';
import type { PurchaseCostDraft } from '@/store/purchaseCartStore';
import type { PurchaseCostCategory } from '@/services/purchases';

const CATEGORY_OPTIONS: { value: PurchaseCostCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'transport', label: 'Transport', icon: 'car-outline' },
  { value: 'delivery', label: 'Delivery', icon: 'bicycle-outline' },
  { value: 'fuel', label: 'Fuel', icon: 'flame-outline' },
  { value: 'loading', label: 'Loading', icon: 'arrow-up-circle-outline' },
  { value: 'offloading', label: 'Offloading', icon: 'arrow-down-circle-outline' },
  { value: 'packaging', label: 'Packaging', icon: 'cube-outline' },
  { value: 'market_fee', label: 'Market Fee', icon: 'storefront-outline' },
  { value: 'brokerage', label: 'Brokerage', icon: 'briefcase-outline' },
  { value: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const categoryMeta = (value: string) => CATEGORY_OPTIONS.find((c) => c.value === value) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];

interface AdditionalCostsCardProps {
  costs: PurchaseCostDraft[];
  onAdd: (cost: { category: PurchaseCostCategory; description?: string; amount: number; notes?: string }) => void;
  onUpdate: (key: string, cost: { category: PurchaseCostCategory; description?: string; amount: number; notes?: string }) => void;
  onRemove: (key: string) => void;
}

/**
 * "Additional Purchase Costs" — optional, expandable, and the add/edit form
 * lives inline in the same card (no new screen, no stacked modal), per the
 * feature's own "avoid modal overload" requirement.
 */
export const AdditionalCostsCard: React.FC<AdditionalCostsCardProps> = ({ costs, onAdd, onUpdate, onRemove }) => {
  const { alert } = useAlert();
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [category, setCategory] = useState<PurchaseCostCategory>('transport');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const rotation = useSharedValue(0);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    rotation.value = withSpring(next ? 1 : 0, { damping: 16, stiffness: 220 });
    if (!next) setFormOpen(false);
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 90])}deg` }],
  }));

  const resetForm = () => {
    setCategory('transport');
    setDescription('');
    setAmount('');
    setNotes('');
    setEditingKey(null);
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
    if (!expanded) toggleExpanded();
  };

  const openEditForm = (cost: PurchaseCostDraft) => {
    setCategory(cost.category as PurchaseCostCategory);
    setDescription(cost.description ?? '');
    setAmount(String(cost.amount));
    setNotes(cost.notes ?? '');
    setEditingKey(cost.key);
    setFormOpen(true);
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    const payload = {
      category,
      description: description.trim() || undefined,
      amount: parsedAmount,
      notes: notes.trim() || undefined,
    };
    if (editingKey) onUpdate(editingKey, payload);
    else onAdd(payload);
    resetForm();
    setFormOpen(false);
  };

  const handleDelete = (cost: PurchaseCostDraft) => {
    alert({
      type: 'confirm',
      title: 'Remove this cost?',
      message: `${categoryMeta(cost.category).label} · ${formatCurrency(cost.amount)} will be removed from this purchase.`,
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Remove', variant: 'danger', onPress: () => onRemove(cost.key) },
      ],
    });
  };

  const total = costs.reduce((sum, c) => sum + c.amount, 0);

  return (
    <View style={styles.wrapper}>
      <AnimatedPressable style={styles.header} onPress={toggleExpanded}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Additional Purchase Costs</Text>
          <Text style={styles.headerSub}>
            {costs.length > 0 ? `${costs.length} cost${costs.length === 1 ? '' : 's'} · ${formatCurrency(total)}` : 'Transport, packaging, loading — optional'}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </Animated.View>
      </AnimatedPressable>

      {expanded && (
        <View style={styles.content}>
          {costs.map((cost, index) => {
            const meta = categoryMeta(cost.category);
            return (
              <Animated.View
                key={cost.key}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.duration(220)}
                style={[styles.costRow, index < costs.length - 1 && styles.costRowBorder]}
              >
                <View style={styles.costIconWrap}>
                  <Ionicons name={meta.icon} size={15} color={Colors.primary} />
                </View>
                <View style={styles.costInfo}>
                  <Text style={styles.costLabel}>{meta.label}</Text>
                  {!!cost.description && <Text style={styles.costDescription} numberOfLines={1}>{cost.description}</Text>}
                </View>
                <Text style={styles.costAmount}>{formatCurrency(cost.amount)}</Text>
                <AnimatedPressable onPress={() => openEditForm(cost)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.costActionBtn}>
                  <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
                </AnimatedPressable>
                <AnimatedPressable onPress={() => handleDelete(cost)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.costActionBtn}>
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                </AnimatedPressable>
              </Animated.View>
            );
          })}

          {!formOpen ? (
            <AnimatedPressable style={styles.addRow} onPress={openAddForm}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add Cost</Text>
            </AnimatedPressable>
          ) : (
            <Animated.View entering={FadeIn.duration(180)} style={styles.form}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {CATEGORY_OPTIONS.map((opt) => {
                  const active = category === opt.value;
                  return (
                    <AnimatedPressable
                      key={opt.value}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => setCategory(opt.value)}
                    >
                      <Ionicons name={opt.icon} size={14} color={active ? Colors.white : Colors.textSecondary} />
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{opt.label}</Text>
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>

              <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
              <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="e.g. Nairobi to shop" />
              <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything else worth remembering" />

              <View style={styles.formButtonRow}>
                <Button title="Cancel" variant="outline" size="sm" onPress={() => { resetForm(); setFormOpen(false); }} style={styles.flexBtn} />
                <Button title={editingKey ? 'Save' : 'Add'} size="sm" onPress={handleSave} style={styles.flexBtn} />
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  headerIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },

  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },

  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  costRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  costIconWrap: { width: 28, height: 28, borderRadius: 9, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  costInfo: { flex: 1 },
  costLabel: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  costDescription: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },
  costAmount: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  costActionBtn: { padding: 4 },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  addRowText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },

  form: { marginTop: Spacing.sm, gap: 0 },
  categoryRow: { marginBottom: Spacing.sm },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.xs },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white },
  formButtonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  flexBtn: { flex: 1 },
});

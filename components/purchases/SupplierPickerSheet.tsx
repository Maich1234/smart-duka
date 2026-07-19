import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useAlert } from '@/context/AlertContext';
import { useSearch } from '@/hooks/useSearch';
import { getSuppliers, createSupplier } from '@/services/suppliers';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import type { SupplierSelection } from '@/store/purchaseCartStore';

interface SupplierPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** null = "Continue without Supplier" */
  onSelect: (selection: SupplierSelection | null) => void;
}

/**
 * Step 1 of the New Purchase flow — search/choose an existing supplier,
 * create one inline, go walk-in, or skip entirely. Everything happens in
 * this one sheet (a "create" sub-mode swaps the content in place) rather
 * than stacking a second modal on top.
 */
export const SupplierPickerSheet: React.FC<SupplierPickerSheetProps> = ({ visible, onClose, onSelect }) => {
  const { toast } = useAlert();
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const { value: search, query: searchQuery, onChange: setSearch } = useSearch('purchase_suppliers');

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', searchQuery],
    queryFn: () => getSuppliers({ search: searchQuery, limit: 20 }),
    enabled: visible,
  });
  const suppliers = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: (res) => {
      handleClose();
      onSelect({ supplierId: res.data._id, supplierName: res.data.name });
    },
    onError: (error: any) => {
      toast({ type: 'error', message: error.response?.data?.message || 'Could not create supplier' });
    },
  });

  const resetCreateForm = () => {
    setNewName('');
    setNewPhone('');
    setNewLocation('');
  };

  const handleClose = () => {
    setMode('search');
    resetCreateForm();
    onClose();
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      toast({ type: 'error', message: 'Enter a supplier name' });
      return;
    }
    createMutation.mutate({
      name,
      phone: newPhone.trim() || undefined,
      location: newLocation.trim() || undefined,
    });
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      {mode === 'search' ? (
        <>
          <Text style={styles.title}>Select Supplier</Text>

          <Input
            leftIcon="search-outline"
            placeholder="Search suppliers…"
            value={search}
            onChangeText={setSearch}
          />

          <AnimatedPressable style={styles.actionRow} onPress={() => setMode('create')}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="add" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.actionText}>Create New Supplier</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.actionRow}
            onPress={() => { handleClose(); onSelect({ supplierName: 'Walk-in Supplier' }); }}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="walk-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.actionText}>Walk-in Supplier</Text>
          </AnimatedPressable>

          {isLoading ? (
            <ActivityIndicator style={styles.loading} color={Colors.primary} />
          ) : suppliers.length > 0 ? (
            <View style={styles.list}>
              {suppliers.map((s, index) => (
                <AnimatedPressable
                  key={s._id}
                  style={[styles.supplierRow, index < suppliers.length - 1 && styles.supplierRowBorder]}
                  onPress={() => { handleClose(); onSelect({ supplierId: s._id, supplierName: s.name }); }}
                >
                  <View style={styles.supplierAvatar}>
                    <Text style={styles.supplierAvatarText}>{s.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.supplierInfo}>
                    <Text style={styles.supplierName} numberOfLines={1}>{s.name}</Text>
                    {!!s.location && <Text style={styles.supplierMeta} numberOfLines={1}>{s.location}</Text>}
                  </View>
                </AnimatedPressable>
              ))}
            </View>
          ) : searchQuery ? (
            <Text style={styles.emptyText}>No suppliers match &quot;{searchQuery}&quot;</Text>
          ) : null}

          <Button
            title="Continue without Supplier"
            variant="ghost"
            onPress={() => { handleClose(); onSelect(null); }}
            style={styles.skipBtn}
          />
        </>
      ) : (
        <>
          <Text style={styles.title}>Create Supplier</Text>
          <Input label="Name" value={newName} onChangeText={setNewName} placeholder="e.g. Wholesale Mart" />
          <Input label="Phone (optional)" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" placeholder="0700 000 000" />
          <Input label="Location (optional)" value={newLocation} onChangeText={setNewLocation} placeholder="e.g. Nairobi" />
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={() => { setMode('search'); resetCreateForm(); }} style={styles.flexBtn} />
            <Button title="Save & Use" onPress={handleCreate} loading={createMutation.isPending} style={styles.flexBtn} />
          </View>
        </>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.md, textAlign: 'center', color: Colors.textPrimary },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  actionIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },

  loading: { marginVertical: Spacing.md },

  list: { marginTop: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  supplierRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  supplierRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  supplierAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  supplierAvatarText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilyBold, color: Colors.primary },
  supplierInfo: { flex: 1 },
  supplierName: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  supplierMeta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },

  emptyText: { fontSize: Typography.size.small, color: Colors.textSecondary, textAlign: 'center', marginVertical: Spacing.md },

  skipBtn: { marginTop: Spacing.sm },

  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  flexBtn: { flex: 1 },
});

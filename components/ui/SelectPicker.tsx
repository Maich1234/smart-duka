import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  leftEmoji?: string;
  rightText?: string;
}

interface SelectPickerProps {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

export const SelectPicker: React.FC<SelectPickerProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchable = false,
  leftIcon,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.sublabel?.toLowerCase().includes(q) ||
        o.rightText?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger row — mimics the Input component appearance */}
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={[styles.trigger, disabled && styles.triggerDisabled]}
          onPress={() => !disabled && setOpen(true)}
          activeOpacity={0.75}
        >
          {leftIcon && (
            <View style={styles.leftIconWrap}>
              <Ionicons name={leftIcon} size={16} color={Colors.textTertiary} />
            </View>
          )}
          <View style={styles.triggerContent}>
            {selected ? (
              <View style={styles.selectedRow}>
                {selected.leftEmoji ? (
                  <Text style={styles.emoji}>{selected.leftEmoji}</Text>
                ) : null}
                <Text style={styles.selectedLabel} numberOfLines={1}>
                  {selected.label}
                </Text>
                {selected.rightText ? (
                  <Text style={styles.selectedRight}>{selected.rightText}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.placeholder}>{placeholder}</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={15} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Full-screen modal picker */}
      <Modal visible={open} animationType="slide" transparent presentationStyle="overFullScreen" accessibilityViewIsModal>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => { setOpen(false); setQuery(''); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            {searchable && (
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={Colors.textTertiary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search…"
                  placeholderTextColor={Colors.textTertiary}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus={Platform.OS !== 'android'}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    {item.leftEmoji ? (
                      <Text style={styles.optionEmoji}>{item.leftEmoji}</Text>
                    ) : null}
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {item.label}
                      </Text>
                      {item.sublabel ? (
                        <Text style={styles.optionSublabel}>{item.sublabel}</Text>
                      ) : null}
                    </View>
                    {item.rightText ? (
                      <Text style={[styles.optionRight, active && styles.optionRightActive]}>
                        {item.rightText}
                      </Text>
                    ) : null}
                    {active && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No results</Text>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.sm },
  label: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    gap: 8,
    minHeight: 46,
  },
  triggerDisabled: { opacity: 0.5 },
  leftIconWrap: { marginRight: 2 },
  triggerContent: { flex: 1 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji: { fontSize: 16 },
  selectedLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    flex: 1,
  },
  selectedRight: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  placeholder: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetTitle: {
    fontSize: Typography.size.base,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },

  // Search bar
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.background,
    gap: 6,
  },
  searchIcon: { marginLeft: 2 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },

  // Option rows
  listContent: { paddingBottom: Spacing.xl },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  optionActive: { backgroundColor: Colors.primarySubtle },
  optionEmoji: { fontSize: 18, width: 26 },
  optionText: { flex: 1 },
  optionLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  optionLabelActive: {
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  optionSublabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  optionRight: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  optionRightActive: { color: Colors.primary },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: Typography.size.small, color: Colors.textTertiary, fontFamily: Typography.fontFamily },
});

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from './AnimatedPressable';
import { haptics } from '@/utils/haptics';
import { Motion } from '@/constants/Motion';
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
  error?: string;
  /**
   * Appends a trailing option (`customLabel`, default "Other") that swaps the
   * list for an inline text field instead of selecting a value directly —
   * for fields like Category where the useful set is "whatever this shop has
   * used before, plus the ability to add one that isn't in that list yet."
   */
  allowCustom?: boolean;
  customLabel?: string;
  customPlaceholder?: string;
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
  error,
  allowCustom = false,
  customLabel = 'Other',
  customPlaceholder = 'Type a new value',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  // Falls back to the raw value when it isn't one of `options` — the current
  // value may be a custom one entered (here or elsewhere) before this shop's
  // option list caught up with it. Without this the trigger would show the
  // placeholder despite a real value being set.
  const selected = options.find((o) => o.value === value) ?? (value ? { value, label: value } : undefined);

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

  const closeModal = () => {
    setOpen(false);
    setQuery('');
    setCustomMode(false);
    setCustomText('');
  };

  const handleSelect = (val: string) => {
    haptics.selection();
    onChange(val);
    closeModal();
  };

  const submitCustom = () => {
    const val = customText.trim();
    if (!val) return;
    haptics.selection();
    onChange(val);
    closeModal();
  };

  return (
    <>
      {/* Trigger row — mimics the Input component appearance */}
      <View style={styles.wrapper}>
        <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
        <AnimatedPressable
          style={[styles.trigger, error && styles.triggerError, disabled && styles.triggerDisabled]}
          onPress={() => !disabled && setOpen(true)}
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
        </AnimatedPressable>
        {error ? (
          <View style={styles.feedbackRow}>
            <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {/* Full-screen modal picker */}
      <Modal
        visible={open}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={closeModal}
        accessibilityViewIsModal
      >
        {/* RNGH pressables inside a RN Modal need their own gesture root on Android */}
        <GestureHandlerRootView style={styles.gestureRoot}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              {customMode ? (
                <AnimatedPressable
                  onPress={() => setCustomMode(false)}
                  pressScale={0.9}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.backRow}
                  accessibilityRole="button"
                  accessibilityLabel="Back to list"
                >
                  <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                  <Text style={styles.sheetTitle}>{label}</Text>
                </AnimatedPressable>
              ) : (
                <Text style={styles.sheetTitle}>{label}</Text>
              )}
              <AnimatedPressable
                onPress={closeModal}
                pressScale={0.9}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </AnimatedPressable>
            </View>

            {customMode ? (
              /* Custom entry — reveals a plain text field instead of the list,
                 so a value the shop has never used before still ends up in
                 the exact same field the picker was maintaining. Crossfaded
                 rather than swapped instantly, so replacing the whole list
                 with a text field doesn't read as a flash/glitch. */
              <Animated.View
                entering={FadeIn.duration(Motion.duration.base)}
                exiting={FadeOut.duration(Motion.duration.base)}
                style={styles.customWrap}
              >
                <TextInput
                  style={styles.customInput}
                  placeholder={customPlaceholder}
                  placeholderTextColor={Colors.textTertiary}
                  value={customText}
                  onChangeText={setCustomText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={submitCustom}
                />
                <AnimatedPressable
                  style={[styles.customSubmit, !customText.trim() && styles.customSubmitDisabled]}
                  onPress={submitCustom}
                  disabled={!customText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${customText.trim() || 'value'}`}
                >
                  <Text style={styles.customSubmitText}>Add</Text>
                </AnimatedPressable>
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeIn.duration(Motion.duration.base)}
                exiting={FadeOut.duration(Motion.duration.base)}
              >
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
                      <AnimatedPressable onPress={() => setQuery('')} pressScale={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                      </AnimatedPressable>
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
                      <AnimatedPressable
                        style={[styles.option, active && styles.optionActive]}
                        onPress={() => handleSelect(item.value)}
                        pressScale={Motion.press.scaleCard}
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
                      </AnimatedPressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Text style={styles.emptyText}>No results</Text>
                    </View>
                  }
                  ListFooterComponent={
                    allowCustom ? (
                      <AnimatedPressable
                        style={styles.option}
                        onPress={() => setCustomMode(true)}
                        pressScale={Motion.press.scaleCard}
                        accessibilityRole="button"
                        accessibilityLabel={customLabel}
                      >
                        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                        <View style={styles.optionText}>
                          <Text style={[styles.optionLabel, styles.customOptionLabel]}>{customLabel}</Text>
                        </View>
                      </AnimatedPressable>
                    ) : null
                  }
                />
              </Animated.View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Matches Input's wrapper/box dimensions (minHeight 56, marginBottom 16) —
  // this and Input sit side by side in a few forms (e.g. Category next to
  // SKU), and mismatched box heights there read as a layout bug.
  wrapper: { marginBottom: Spacing.md },
  label: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  labelError: { color: Colors.danger },
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
    minHeight: 56,
  },
  triggerError: { borderColor: Colors.danger, backgroundColor: Colors.dangerSubtle },
  triggerDisabled: { opacity: 0.5 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  errorText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
    flex: 1,
  },
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
  gestureRoot: {
    flex: 1,
  },
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
    fontSize: Typography.size.body,
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

  // Header back (custom-entry mode)
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Custom entry
  customWrap: { padding: Spacing.lg, gap: Spacing.md },
  customInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  customSubmit: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  customSubmitDisabled: { opacity: 0.5 },
  customSubmitText: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
  },
  customOptionLabel: { color: Colors.primary, fontFamily: Typography.fontFamilySemiBold },

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

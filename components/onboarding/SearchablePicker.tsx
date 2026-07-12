import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

export interface PickerOption {
  id: string;
  name: string;
}

interface SearchablePickerProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect: (option: PickerOption) => void;
  onClose: () => void;
}

/** Search-and-select bottom sheet — used for county/sub-county pickers where a
 *  plain inline card list (fine for the 4-item currency step) wouldn't scale. */
export const SearchablePicker: React.FC<SearchablePickerProps> = ({
  visible,
  title,
  options,
  loading = false,
  selectedId,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeightPercent={75}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
          accessibilityLabel={`Search ${title}`}
        />
      </View>
      {loading ? (
        <Text style={styles.emptyText}>Loading…</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
          renderItem={({ item }) => (
            <AnimatedPressable
              style={styles.row}
              onPress={() => {
                haptics.light();
                onSelect(item);
                handleClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              <Text style={styles.rowText}>{item.name}</Text>
              {selectedId === item.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
            </AnimatedPressable>
          )}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  list: { maxHeight: 360 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowText: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    paddingVertical: Spacing.lg,
  },
});

import React from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useSearch } from '@/hooks/useSearch';
import { getProducts, type Product } from '@/services/products';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

interface ServicePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  currency?: string;
}

/**
 * Picks a service from the catalog for a quotation line item — the same
 * search-first shape as CustomerPickerSheet, filtered server-side to
 * productType 'service' via includeTypes. No "create" affordance here: a
 * missing service is what the "Add custom line" free-text form is for.
 */
export const ServicePickerSheet: React.FC<ServicePickerSheetProps> = ({
  visible,
  onClose,
  onSelect,
  currency,
}) => {
  const { value: search, query: debouncedSearch, onChange: setSearch, clear: clearSearch } = useSearch('quotation_services');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', 'services', debouncedSearch],
    queryFn: () => getProducts({ search: debouncedSearch || undefined, includeTypes: 'service', limit: 30 }),
    enabled: visible,
    // Keeps the previous matches on screen while the next query lands, so the
    // list doesn't blink to a spinner on every keystroke.
    placeholderData: keepPreviousData,
  });

  const services = data?.data ?? [];

  const handleClose = () => {
    clearSearch();
    onClose();
  };

  const handleSelect = (product: Product) => {
    clearSearch();
    onSelect(product);
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeightPercent={85}>
      <View style={styles.body}>
        <Text style={styles.heading}>Add a service</Text>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search services"
            placeholderTextColor={Colors.textTertiary}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search services"
          />
          {search.length > 0 && (
            <AnimatedPressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={17} color={Colors.textTertiary} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Couldn&rsquo;t load services</Text>
          <Text style={styles.emptyText}>Check your connection and try again.</Text>
          <Button title="Retry" variant="outline" size="sm" onPress={() => refetch()} />
        </View>
      ) : services.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>
            {search ? `No service matching “${search}”` : 'No services yet'}
          </Text>
          <Text style={styles.emptyText}>
            {search
              ? 'Check the spelling, or add a custom line instead.'
              : 'Add a service product in Inventory, or use a custom line instead.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item, index }) => (
            <AnimatedPressable
              onPress={() => handleSelect(item)}
              style={[styles.row, index < services.length - 1 && styles.divider]}
              pressScale={Motion.press.scaleCard}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatCurrency(item.sellingPrice, currency)}`}
            >
              <View style={styles.flex1}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>{item.description}</Text>
                ) : null}
              </View>
              <Text style={styles.rowPrice}>{formatCurrency(item.sellingPrice, currency)}</Text>
            </AnimatedPressable>
          )}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  heading: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.body,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily,
    paddingVertical: 0,
  },
  list: { maxHeight: 340 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  rowMeta: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 1 },
  rowPrice: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  centered: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  emptyTitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  flex1: { flex: 1 },
});

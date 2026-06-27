import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ContextualSearchBar } from '@/components/ui/ContextualSearchBar';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface InventoryHeaderProps {
  onAddPress: () => void;
  searchValue: string;
  onSearchChange: (text: string) => void;
  onSearchSubmit?: () => void;
  recentSearches?: string[];
  onSelectRecent?: (term: string) => void;
  onClearRecent?: () => void;
  title?: string;
  showAddButton?: boolean;
  productCount?: number;
  alertCount?: number;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  onAddPress,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  recentSearches,
  onSelectRecent,
  onClearRecent,
  title = 'Inventory',
  showAddButton = true,
  productCount,
  alertCount = 0,
}) => {
  const insets = useSafeAreaInsets();

  return (
    // zIndex: 100 so the ContextualSearchBar dropdown floats above the filter
    // chips and FlatList rendered below this component in the parent screen.
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {productCount !== undefined && (
            <Text style={styles.subtitle}>
              {productCount} product{productCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.titleActions}>
          {alertCount > 0 && (
            <View style={styles.notifButton}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {alertCount > 9 ? '9+' : String(alertCount)}
                </Text>
              </View>
            </View>
          )}

          {showAddButton && (
            <TouchableOpacity
              onPress={onAddPress}
              style={styles.addButton}
              activeOpacity={0.82}
              accessibilityLabel="Add product"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ContextualSearchBar
        value={searchValue}
        onChangeText={onSearchChange}
        onSubmit={onSearchSubmit}
        recentSearches={recentSearches}
        onSelectRecent={onSelectRecent}
        onClearRecent={onClearRecent}
        placeholder="Search products, SKU, category…"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    // Must sit above filter bar (elevation 0) so the search dropdown overlays it
    zIndex: 100,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  titleBlock: {
    gap: 2,
  },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  notifBadgeText: {
    fontSize: 8,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.white,
    letterSpacing: 0.2,
  },
});

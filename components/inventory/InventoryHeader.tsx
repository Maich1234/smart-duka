import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface InventoryHeaderProps {
  onAddPress: () => void;
  searchValue: string;
  onSearchChange: (text: string) => void;
  title?: string;
  showAddButton?: boolean;
  productCount?: number;
  alertCount?: number;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  onAddPress,
  searchValue,
  onSearchChange,
  title = 'Inventory',
  showAddButton = true,
  productCount,
  alertCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 180 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 180 });
  };

  const searchContainerAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusAnim.value, [0, 1], [Colors.border, Colors.primary]),
  }));

  const searchIconAnim = useAnimatedStyle(() => ({
    opacity: 0.5 + focusAnim.value * 0.5,
  }));

  return (
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

      {/* Search bar */}
      <Animated.View style={[styles.searchContainer, searchContainerAnim]}>
        <Animated.View style={searchIconAnim}>
          <Ionicons
            name="search-outline"
            size={18}
            color={isFocused ? Colors.primary : Colors.textTertiary}
          />
        </Animated.View>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder="Search products, SKU, category…"
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="search"
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchValue.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchChange('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </Animated.View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    padding: 0,
    margin: 0,
  },
});

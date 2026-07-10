import React, { useRef, useState, useCallback } from 'react';
import { AnimatedPressable } from './AnimatedPressable';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  interpolateColor,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Motion } from '@/constants/Motion';

export interface ContextualSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  recentSearches?: string[];
  onSelectRecent?: (term: string) => void;
  onClearRecent?: () => void;
  /** Custom style for the outer wrapper (e.g. margins) */
  style?: object;
  autoFocus?: boolean;
}

/**
 * Non-navigating search bar.
 *
 * - Border animates teal on focus
 * - Clear (×) button appears while text is entered
 * - When focused with empty input + recent searches exist: renders a
 *   floating recent-searches panel below the bar using absolute positioning
 *   so the underlying page structure is never replaced or obscured
 * - Dropdown closes as soon as the user starts typing; list filters in-place
 */
export const ContextualSearchBar: React.FC<ContextualSearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search...',
  recentSearches = [],
  onSelectRecent,
  onClearRecent,
  style,
  autoFocus = false,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [barHeight, setBarHeight] = useState(48);
  const focusAnim = useSharedValue(0);

  const showDropdown = isFocused && value.length === 0 && recentSearches.length > 0;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: Motion.duration.fast });
  }, [focusAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: Motion.duration.fast });
    if (value.trim() && onSubmit) onSubmit();
  }, [focusAnim, value, onSubmit]);

  const containerAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusAnim.value, [0, 1], [Colors.border, Colors.primary]),
    shadowOpacity: focusAnim.value * 0.1,
  }));

  const iconColor = isFocused ? Colors.primary : Colors.textTertiary;

  return (
    /* zIndex + elevation so the absolute dropdown floats above adjacent siblings */
    <View style={[styles.wrapper, style]}>
      <Animated.View
        style={[styles.bar, containerAnim]}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      >
        <Ionicons name="search-outline" size={18} color={iconColor} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="search"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmit}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        {value.length > 0 && (
          <AnimatedPressable
            onPress={() => onChangeText('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </AnimatedPressable>
        )}
      </Animated.View>

      {showDropdown && (
        <Animated.View
          entering={FadeIn.duration(Motion.duration.fast)}
          exiting={FadeOut.duration(Motion.duration.fast)}
          style={[styles.dropdown, { top: barHeight + 4 }]}
        >
          <View style={styles.dropdownHeader}>
            <View style={styles.dropdownTitleRow}>
              <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.dropdownTitle}>Recent</Text>
            </View>
            <AnimatedPressable
              onPress={onClearRecent}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearText}>Clear all</Text>
            </AnimatedPressable>
          </View>

          {recentSearches.map((term) => (
            <AnimatedPressable
              key={term}
              style={styles.dropdownItem}
              onPress={() => {
                onSelectRecent?.(term);
                inputRef.current?.blur();
              }}
            >
              <Ionicons name="search-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.dropdownItemText} numberOfLines={1}>
                {term}
              </Text>
              <Ionicons
                name="arrow-up-outline"
                size={13}
                color={Colors.textTertiary}
                style={styles.fillArrow}
              />
            </AnimatedPressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const DROPDOWN_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  android: { elevation: 8 },
  default: {},
});

const styles = StyleSheet.create({
  wrapper: {
    // overflow must remain 'visible' (RN default) so the dropdown bleeds
    // below this View's bounds and floats above adjacent siblings.
    // zIndex makes the whole component (bar + dropdown) sit above siblings.
    zIndex: 999,
    ...Platform.select({ android: { elevation: 4 } }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
    padding: 0,
    margin: 0,
  },

  // ── Dropdown ─────────────────────────────────────────────────────────────────
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    zIndex: 1000,
    ...DROPDOWN_SHADOW,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dropdownTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  clearText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  fillArrow: {
    transform: [{ rotate: '45deg' }],
  },
});

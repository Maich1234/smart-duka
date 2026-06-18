import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/Spacing';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = 'Search...' }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="search" size={20} color={colors.textSecondary} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
      />
      {value !== '' && (
        <Ionicons name="close-circle" size={18} color={colors.textSecondary} onPress={() => onChangeText('')} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
  },
});
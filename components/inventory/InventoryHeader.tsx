import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { SearchBar } from '../ui/SearchBar';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface InventoryHeaderProps {
  onAddPress: () => void;
  searchValue: string;
  onSearchChange: (text: string) => void;
  title?: string;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  onAddPress,
  searchValue,
  onSearchChange,
  title = 'Inventory',
}) => {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Button title="Add Product" onPress={onAddPress} size="sm" />
      </View>
      <SearchBar value={searchValue} onChangeText={onSearchChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
});
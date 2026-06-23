import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Section } from '../ui/Section';
import { ListRow } from '../ui/ListRow';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface LowStockItem {
  _id: string;
  name: string;
  quantity: number;
}

interface LowStockListProps {
  items: LowStockItem[];
  onPressItem?: (item: LowStockItem) => void;
}

export const LowStockList: React.FC<LowStockListProps> = ({ items, onPressItem }) => {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Section title="Low Stock Alert">
        {items.map((item, i) => (
          <ListRow
            key={item._id}
            title={item.name}
            trailing={<Text style={styles.quantity}>Stock: {item.quantity}</Text>}
            isLast={i === items.length - 1}
            onPress={onPressItem ? () => onPressItem(item) : undefined}
          />
        ))}
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  quantity: { fontSize: Typography.size.small, color: Colors.danger, fontFamily: Typography.fontFamilySemiBold },
});

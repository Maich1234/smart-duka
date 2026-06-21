import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
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
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="alert-circle" size={18} color={Colors.danger} />
        <Text style={styles.title}>Low Stock Alert</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.quantity}>Stock: {item.quantity}</Text>
          </View>
        )}
        scrollEnabled={false}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginVertical: Spacing.sm, padding: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.danger },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  name: { fontSize: Typography.size.body, color: Colors.textPrimary },
  quantity: { fontSize: Typography.size.small, color: Colors.danger },
});
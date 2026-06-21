import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface Transaction {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  staff?: { name: string };
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  showStaff?: boolean;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions, showStaff = false }) => {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Recent Sales</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View>
              <Text style={styles.invoice}>{item.invoiceNumber}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              {showStaff && item.staff && <Text style={styles.staff}>by {item.staff.name}</Text>}
            </View>
            <View>
              <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.method}>{item.paymentMethod.toUpperCase()}</Text>
            </View>
          </View>
        )}
        scrollEnabled={false}
        ListEmptyComponent={<EmptyState title="No sales yet" />}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.md, marginVertical: Spacing.sm, padding: Spacing.lg, marginBottom: Spacing.xl },
  title: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  invoice: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  date: { fontSize: Typography.size.caption, color: Colors.textSecondary },
  staff: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
  amount: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.success, textAlign: 'right' },
  method: { fontSize: Typography.size.caption, color: Colors.textSecondary, textAlign: 'right' },
});
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Section } from '../ui/Section';
import { ListRow } from '../ui/ListRow';
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
    <View style={styles.container}>
      <Section title="Recent Sales">
        {transactions.length === 0 ? (
          <EmptyState title="No sales yet" />
        ) : (
          transactions.map((item, i) => (
            <ListRow
              key={item._id}
              title={item.invoiceNumber}
              subtitle={`${formatDate(item.createdAt)}${showStaff && item.staff ? ` · by ${item.staff.name}` : ''}`}
              isLast={i === transactions.length - 1}
              trailing={
                <View style={styles.amountWrap}>
                  <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
                  <Text style={styles.method}>{item.paymentMethod.toUpperCase()}</Text>
                </View>
              }
            />
          ))
        )}
      </Section>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  amountWrap: { alignItems: 'flex-end' },
  amount: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  method: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginTop: 2 },
});

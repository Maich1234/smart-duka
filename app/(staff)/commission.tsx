import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { getMyCommission } from '@/services/sales';
import { getShopConfig } from '@/services/shop';
import { CommissionCard, getCommissionPeriodRange, type CommissionPeriod } from '@/components/sales/CommissionCard';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function StaffCommission() {
  const [period, setPeriod] = useState<CommissionPeriod>('today');
  const { startDate, endDate } = getCommissionPeriodRange(period);

  const { data: shopData } = useQuery({ queryKey: ['shop'], queryFn: getShopConfig });
  const currency = shopData?.data?.currency ?? 'KES';

  const { data, isLoading, error } = useQuery({
    queryKey: ['myCommission', period],
    queryFn: () => getMyCommission({ startDate, endDate }),
  });

  const forbidden = (error as any)?.response?.status === 403;

  return (
    <Screen>
      <Text style={styles.title}>My Commission</Text>
      <CommissionCard
        data={data?.data}
        isLoading={isLoading}
        forbidden={forbidden}
        period={period}
        onPeriodChange={setPeriod}
        currency={currency}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
});

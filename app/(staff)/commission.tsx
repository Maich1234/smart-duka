import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMyCommission } from '@/services/sales';
import { getShopConfig } from '@/services/shop';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { CommissionCard, getCommissionPeriodRange, type CommissionPeriod } from '@/components/sales/CommissionCard';

export default function StaffCommission() {
  const [period, setPeriod] = useState<CommissionPeriod>('today');
  const { startDate, endDate } = getCommissionPeriodRange(period);
  const user = useAuthStore((s: AuthState) => s.user);

  const { data: shopData } = useQuery({ queryKey: ['shop'], queryFn: getShopConfig });
  const currency = shopData?.data?.currency ?? 'KES';

  // The dashboard tile is hidden for anyone not on commission, so reaching
  // this screen means a deep link or a stale navigation state. Nothing is
  // fetched in that case — the endpoint would 403 or return a permanent zero.
  const eligible = user?.commissionEligible === true;

  const { data, isLoading, error } = useQuery({
    queryKey: ['myCommission', period],
    queryFn: () => getMyCommission({ startDate, endDate }),
    enabled: eligible,
    // Keep showing the current period's figures while the next one loads,
    // instead of the card dropping to a skeleton on every period tap.
    placeholderData: keepPreviousData,
  });

  const forbidden = (error as any)?.response?.status === 403;

  return (
    // The header above carries the title and the tab bar floats over the
    // bottom, so this screen owns neither inset.
    <Screen edges={['left', 'right']} tabBarSpacing>
      {eligible ? (
        <CommissionCard
          data={data?.data}
          isLoading={isLoading}
          forbidden={forbidden}
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
        />
      ) : (
        <EmptyState
          title="Not available"
          subtitle="Commission isn't part of your role at this shop."
        />
      )}
    </Screen>
  );
}

import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { QueryError } from '@/components/ui/QueryError';
import { CollapsibleTabs } from '@/components/business/CollapsibleTabs';
import type { TabDescriptor } from '@/components/business/CollapsibleTabs.types';
import { BusinessHeader } from '@/components/business/BusinessHeader';
import { CapitalBreakdownSheet } from '@/components/business/CapitalBreakdownSheet';
import { OverviewTab } from '@/components/business/OverviewTab';
import { SalesTab } from '@/components/business/SalesTab';
import { ProductsTab } from '@/components/business/ProductsTab';
import { StaffTab } from '@/components/business/StaffTab';
import { AssetsTab } from '@/components/business/AssetsTab';
import { getBusinessOverview, type PeriodParams } from '@/services/business';
import { Colors } from '@/constants/Colors';

/**
 * My Business — the owner's view of what the shop owns, what is selling, who
 * is selling it, and where the money is going.
 *
 * Only the header and the Overview tab load on open. The other four fetch on
 * first visit and keep their data afterwards, so a shop with a year of sales
 * doesn't pay for the product aggregation to look at its assets.
 *
 * Owner-only, and enforced server-side: every endpoint behind this screen is
 * `ownerOnly` and scopes to the shop on the auth token. Cost, margin, capital
 * and per-employee sales are exactly the figures a staff role must never see,
 * so nothing here relies on the client hiding a route.
 */
/**
 * The query family each tab owns, so a pull-to-refresh reloads what the owner
 * is actually looking at. Invalidating all of them would refetch four tabs
 * they cannot see — every one of those observers is live, because tabs stay
 * mounted to keep their scroll position.
 */
const TAB_QUERY_KEYS: Record<string, string | null> = {
  overview: null, // fed by the header query, which always refetches
  sales: 'businessSales',
  products: 'businessProducts',
  staff: 'businessStaff',
  assets: 'assets',
};

export default function OwnerBusiness() {
  const user = useAuthStore((s: AuthState) => s.user);
  const currency = user?.shop?.currency;
  const bottomInset = useTabBarHeight();

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  // One period for the whole screen — see BusinessTabProps for why it doesn't
  // live inside each tab.
  const [period, setPeriod] = useState<PeriodParams>({ period: 'month' });
  const [capitalSheetOpen, setCapitalSheetOpen] = useState(false);

  const { data, isError, refetch, isRefetching, dataUpdatedAt } = useQuery({
    queryKey: ['businessOverview'],
    queryFn: getBusinessOverview,
  });
  const overview = data?.data;

  const openCapital = () => setCapitalSheetOpen(true);

  // The header's figures come from the overview query, so it always reloads;
  // the visible tab reloads alongside it.
  const handleRefresh = useCallback(() => {
    const tabKey = TAB_QUERY_KEYS[activeTab];
    return Promise.all([
      refetch(),
      tabKey ? queryClient.invalidateQueries({ queryKey: [tabKey] }) : Promise.resolve(),
    ]);
  }, [activeTab, queryClient, refetch]);

  const tabs = useMemo<TabDescriptor[]>(
    () => [
      {
        key: 'overview',
        label: 'Overview',
        icon: 'analytics-outline',
        render: () => <OverviewTab overview={overview} currency={currency} onCapitalPress={openCapital} />,
      },
      {
        key: 'sales',
        label: 'Sales',
        icon: 'cash-outline',
        render: () => <SalesTab currency={currency} period={period} onPeriodChange={setPeriod} />,
      },
      {
        key: 'products',
        label: 'Products',
        icon: 'cube-outline',
        render: () => <ProductsTab currency={currency} period={period} onPeriodChange={setPeriod} />,
      },
      {
        key: 'staff',
        label: 'Staff',
        icon: 'people-outline',
        render: () => <StaffTab currency={currency} period={period} onPeriodChange={setPeriod} />,
      },
      {
        key: 'assets',
        label: 'Assets',
        icon: 'business-outline',
        render: () => <AssetsTab capital={overview?.capital} currency={currency} />,
      },
    ],
    [overview, currency, period],
  );

  // Only when there is nothing at all to show. With a persisted cache (an
  // offline relaunch, a flaky connection) the last synced position renders and
  // the header says how old it is — never block an owner from their own
  // numbers over connectivity.
  if (isError && !overview) {
    return (
      <View style={s.errorWrap}>
        <StatusBar style="dark" />
        <QueryError onRetry={refetch} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <CollapsibleTabs
        tabs={tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
        bottomInset={bottomInset}
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        header={
          <BusinessHeader
            overview={overview}
            currency={currency}
            updatedAt={dataUpdatedAt}
            onCapitalPress={openCapital}
          />
        }
      />

      <CapitalBreakdownSheet
        visible={capitalSheetOpen}
        onClose={() => setCapitalSheetOpen(false)}
        capital={overview?.capital}
        currency={currency}
      />
    </>
  );
}

const s = StyleSheet.create({
  errorWrap: { flex: 1, backgroundColor: Colors.background },
});

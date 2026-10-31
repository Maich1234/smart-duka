import { usePriceHealth } from '@/hooks/usePriceHealth';
import type { AttentionItem } from '@/hooks/useAttention';
import type { PriceHealth } from '@/services/priceHealth';

/** Keep financial warnings in the same attention list as stock and sync issues. */
export function priceAttention(data: PriceHealth | undefined, isError: boolean): AttentionItem[] {
  const issues = data && (data.summary.affectedPriceRows || data.realised.belowCostSaleLines || data.realised.unknownCostLines);
  if (!issues && !isError) return [];
  const stale = isError && data ? 'Last check only. ' : '';
  const money = (value: number) => `${data!.currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const detail = !data || !issues
    ? 'Open price checks to try again. Current prices have not been verified.'
    : data.summary.potentialLoss > 0
      ? `Potential stock shortfall: ${money(data.summary.potentialLoss)}. Not a loss already made.`
      : data.realised.recordedLoss > 0
        ? `Recorded gross shortfall: ${money(data.realised.recordedLoss)} over ${data.window.days} days.`
        : 'Review missing prices, purchase costs and past sales.';
  return [{
    id: 'price-review', icon: isError ? 'cloud-offline-outline' : 'pricetag-outline',
    title: issues
      ? data.summary.affectedProducts > 0
        ? `${data.summary.affectedProducts} product${data.summary.affectedProducts === 1 ? '' : 's'} need${data.summary.affectedProducts === 1 ? 's' : ''} a price review`
        : 'Review costs on past sales'
      : 'Price check unavailable',
    subtitle: stale + detail,
    severity: issues ? 'warning' : 'info',
    route: '/(owner)/price-alerts',
  }];
}

export function usePriceAttention(): AttentionItem[] {
  const { data, isError } = usePriceHealth();
  return priceAttention(data, isError);
}

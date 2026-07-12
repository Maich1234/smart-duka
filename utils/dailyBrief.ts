import type Ionicons from '@expo/vector-icons/Ionicons';
import type { OwnerDashboardData } from '@/services/dashboard';
import { formatCurrency } from '@/utils/formatters';

export type BriefTone = 'positive' | 'neutral' | 'warning';

export interface BriefBullet {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone: BriefTone;
}

const MAX_BULLETS = 4;

/**
 * Daily Smart Brief — a rule-based summary generated on-device from the same
 * dashboard payload the screen already has. Runs instantly, costs nothing,
 * and works offline because the dashboard query is persisted; there is no
 * network call to fail. Bullets are ordered by decision value: how the day is
 * going → what's making money → what it costs → what needs restocking.
 */
export const buildDailyBrief = (data: OwnerDashboardData | undefined): BriefBullet[] => {
  if (!data) {
    return [
      {
        id: 'offline',
        icon: 'cloud-offline-outline',
        text: 'Showing your last synced figures — new sales are saved and will sync when you reconnect.',
        tone: 'neutral',
      },
    ];
  }

  const bullets: BriefBullet[] = [];
  const {
    todaySalesTotal,
    transactionsToday,
    yesterdaySalesTotal,
    todayProfit,
    todayExpensesTotal,
    topProduct,
    lowStockItems,
  } = data;

  // 1. How is the day going?
  if (todaySalesTotal > 0 && yesterdaySalesTotal != null && yesterdaySalesTotal > 0) {
    const pct = Math.round(((todaySalesTotal - yesterdaySalesTotal) / yesterdaySalesTotal) * 100);
    if (pct >= 5) {
      bullets.push({ id: 'trend', icon: 'trending-up', tone: 'positive', text: `Sales are up ${pct}% on yesterday.` });
    } else if (pct <= -5) {
      bullets.push({ id: 'trend', icon: 'trending-down', tone: 'warning', text: `Sales are ${Math.abs(pct)}% below yesterday so far.` });
    } else {
      bullets.push({ id: 'trend', icon: 'remove-outline', tone: 'neutral', text: 'Sales are level with yesterday.' });
    }
  } else if (transactionsToday > 0) {
    bullets.push({
      id: 'trend',
      icon: 'receipt-outline',
      tone: 'positive',
      text: `${transactionsToday} sale${transactionsToday === 1 ? '' : 's'} recorded so far today.`,
    });
  } else {
    bullets.push({
      id: 'trend',
      icon: 'sunny-outline',
      tone: 'neutral',
      text: 'No sales yet today — your counter is ready.',
    });
  }

  // 2. What's selling?
  if (topProduct && topProduct.quantity > 0) {
    bullets.push({
      id: 'top-product',
      icon: 'star-outline',
      tone: 'positive',
      text: `${topProduct.name} is today's best seller (${topProduct.quantity} sold).`,
    });
  }

  // 3. What is it costing? Only worth a line once there are sales to compare against.
  if (todayExpensesTotal != null && todayExpensesTotal > 0) {
    const heavy = todaySalesTotal > 0 && todayExpensesTotal > todaySalesTotal * 0.5;
    bullets.push({
      id: 'expenses',
      icon: 'wallet-outline',
      tone: heavy ? 'warning' : 'neutral',
      text: heavy
        ? `Expenses (${formatCurrency(todayExpensesTotal)}) are over half of today's sales.`
        : `Expenses remain low — ${formatCurrency(todayExpensesTotal)} today.`,
    });
  } else if (todayProfit != null && todayProfit > 0) {
    bullets.push({
      id: 'profit',
      icon: 'trending-up',
      tone: 'positive',
      text: `About ${formatCurrency(todayProfit)} gross profit so far.`,
    });
  }

  // 4. What needs attention on the shelf?
  const lowCount = lowStockItems?.length ?? 0;
  if (lowCount > 0) {
    const worst = lowStockItems[0];
    bullets.push({
      id: 'restock',
      icon: 'cube-outline',
      tone: 'warning',
      text:
        lowCount === 1
          ? `${worst.name} needs restocking (${worst.quantity} left).`
          : `${lowCount} products need restocking — ${worst.name} is lowest.`,
    });
  } else {
    bullets.push({
      id: 'stock-ok',
      icon: 'checkmark-circle-outline',
      tone: 'positive',
      text: 'Stock levels look healthy.',
    });
  }

  return bullets.slice(0, MAX_BULLETS);
};

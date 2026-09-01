import type { SubscriptionAccess, SubscriptionPlan } from '@/services/subscription';
import { formatDate } from './formatters';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionTone = 'neutral' | 'info' | 'good' | 'warn' | 'urgent';

export interface SubscriptionStatusView {
  /** Compact pill label for tight spots — e.g. "Free plan · 23 days left". */
  pill: string;
  /** One-line summary for a settings row. */
  detail: string;
  tone: SubscriptionTone;
  /** Whatever is counting down right now (trial, paid period, or grace); 0 when nothing is. */
  daysLeft: number;
  /** Zero-price plan — the shop is on the free tier, so copy says "free plan", not "free trial". */
  isFree: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Days until an ISO date, counted from the device clock rather than from the
 * server's `daysLeft`. The subscription query is persisted, so a phone that
 * has been offline for a week would otherwise keep showing the day-count it
 * cached — the countdown has to keep moving without the network.
 */
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));

/**
 * Turns the server's access state into the words and colour the UI shows.
 * Shared so the profile hero, the settings row, and the subscription screen
 * can never disagree about how many days a shop has left.
 *
 * `plan` is optional: while the query is loading, or when the plan reference
 * came back unpopulated, the free-tier wording simply falls back to "trial".
 */
export function describeSubscription(
  access: SubscriptionAccess | undefined,
  plan: SubscriptionPlan | null,
): SubscriptionStatusView | null {
  if (!access) return null;

  const isFree = plan?.monthlyPrice === 0;
  const kind = isFree ? 'Free plan' : 'Free trial';

  switch (access.state) {
    case 'trialing': {
      // A stale cache can outlive the trial end; clamping at 0 shows "ends
      // today" rather than an impossible negative until the refetch lands.
      const daysLeft = access.expiresAt ? daysUntil(access.expiresAt) : access.daysLeft;
      const ends = access.expiresAt ? ` · ends ${formatDate(access.expiresAt)}` : '';
      return {
        // Kept short: the hero pill shares its row with the shop name.
        pill: daysLeft === 0 ? `${kind} · last day` : `${kind} · ${plural(daysLeft, 'day')}`,
        detail:
          daysLeft === 0
            ? `${kind} ends today${access.cancelled ? '' : ' — subscribe to keep everything running'}`
            : `${kind} · ${plural(daysLeft, 'day')} left${ends}`,
        tone: daysLeft <= 3 ? 'urgent' : daysLeft <= 7 ? 'warn' : 'info',
        daysLeft,
        isFree,
      };
    }

    case 'active': {
      const daysLeft = access.expiresAt ? daysUntil(access.expiresAt) : access.daysLeft;
      return {
        pill: 'Active',
        detail: access.cancelled
          ? `Cancelled · access until ${access.expiresAt ? formatDate(access.expiresAt) : 'the end of this period'}`
          : access.expiresAt
            ? `Active · renews ${formatDate(access.expiresAt)}`
            : 'Active',
        tone: daysLeft <= 3 ? 'warn' : 'good',
        daysLeft,
        isFree,
      };
    }

    case 'grace':
      return {
        pill: `Payment due · ${plural(access.graceDaysLeft, 'day')}`,
        detail: `Subscription ended · ${plural(access.graceDaysLeft, 'day')} before this shop pauses`,
        tone: 'urgent',
        daysLeft: access.graceDaysLeft,
        isFree,
      };

    case 'locked':
      return {
        pill: 'Paused',
        detail: 'Subscription ended · this shop is paused, and your data is safe',
        tone: 'urgent',
        daysLeft: 0,
        isFree,
      };

    default:
      return {
        pill: 'No plan',
        detail: 'Your free trial is waiting — activate DuQana',
        tone: 'neutral',
        daysLeft: 0,
        isFree,
      };
  }
}

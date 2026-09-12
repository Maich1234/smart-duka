import type React from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { PeriodParams } from '@/services/business';

/**
 * The contract both implementations of the tab shell must satisfy — the
 * native one (react-native-collapsible-tabs-native) and the web fallback.
 *
 * Declared here rather than in either file so the two cannot drift: each
 * annotates its export with `React.FC<CollapsibleTabsProps>`, so a prop added
 * to one and forgotten in the other is a compile error rather than a runtime
 * surprise on whichever platform TypeScript wasn't looking at.
 */

export interface TabDescriptor {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * The tab's content. The shell supplies the scroll view, the header
   * clearance and the bottom inset — this returns the body only, and is
   * called once per route (elements are cheap; mounting is what's deferred).
   */
  render: () => React.ReactNode;
}

export interface CollapsibleTabsProps {
  /** The collapsing header. Rendered above the tab bar, scrolls away with it. */
  header: React.ReactNode;
  tabs: TabDescriptor[];
  activeKey: string;
  onChange: (key: string) => void;
  /** Room for the app's floating bottom tab bar. */
  bottomInset: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * What every period-scoped tab receives.
 *
 * The period lives on the screen, not inside each tab: an owner who sets
 * "Last month" on Sales and swipes to Products is still asking about last
 * month. Three tabs each remembering their own window turns one question into
 * three, and makes the figures on adjacent tabs quietly incomparable.
 */
export interface BusinessTabProps {
  currency?: string;
  period: PeriodParams;
  onPeriodChange: (period: PeriodParams) => void;
}

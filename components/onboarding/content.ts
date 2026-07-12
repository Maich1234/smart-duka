import type { BusinessType, ProductRange } from '@/store/onboardingStore';

/** Quiz options shared between the personalization screen (rendering) and the
 *  outcome/preparing screen (echoing the answers back as tailored setup). */

export const BUSINESS_TYPES: { value: BusinessType; label: string; emoji: string }[] = [
  { value: 'retail', label: 'Retail Shop', emoji: '🏪' },
  { value: 'water', label: 'Water Business', emoji: '💧' },
  { value: 'agrovet', label: 'Agrovet', emoji: '🌾' },
  { value: 'electronics', label: 'Electronics', emoji: '🔌' },
  { value: 'boutique', label: 'Boutique', emoji: '👗' },
  { value: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
  { value: 'hardware', label: 'Hardware', emoji: '🔨' },
  { value: 'supermarket', label: 'Supermarket', emoji: '🛒' },
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { value: 'other', label: 'Something else', emoji: '✨' },
];

export const PRODUCT_RANGES: { value: ProductRange; label: string; subtitle: string }[] = [
  { value: 'under50', label: 'Under 50', subtitle: 'A focused catalogue' },
  { value: '50to200', label: '50 – 200', subtitle: 'A growing range' },
  { value: '200to1000', label: '200 – 1,000', subtitle: 'A serious operation' },
  { value: 'over1000', label: 'More than 1,000', subtitle: 'A full warehouse' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', emoji: '💵' },
  { value: 'mpesa', label: 'M-PESA', emoji: '📱' },
  { value: 'card', label: 'Card', emoji: '💳' },
  { value: 'bank', label: 'Bank transfer', emoji: '🏦' },
  { value: 'credit', label: 'Credit (deni)', emoji: '📒' },
];

export const STRUGGLES = [
  { value: 'stock-loss', label: 'Stock disappears', emoji: '🕳️' },
  { value: 'untracked-sales', label: 'Sales not tracked', emoji: '📝' },
  { value: 'employees', label: 'Managing employees', emoji: '🧑‍🤝‍🧑' },
  { value: 'reports', label: 'Getting clear reports', emoji: '📊' },
  { value: 'inventory', label: 'Counting inventory', emoji: '📦' },
  { value: 'mpesa-reconciliation', label: 'M-PESA reconciliation', emoji: '🔁' },
  { value: 'debts', label: 'Tracking customer debts', emoji: '💸' },
  { value: 'pricing', label: 'Setting the right prices', emoji: '🏷️' },
];

export const businessLabel = (value: BusinessType | null): string =>
  BUSINESS_TYPES.find((t) => t.value === value)?.label ?? 'business';

export const productRangeLabel = (value: ProductRange | null): string =>
  PRODUCT_RANGES.find((r) => r.value === value)?.label ?? 'your products';

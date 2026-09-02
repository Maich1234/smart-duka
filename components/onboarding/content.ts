import type { Ionicons } from '@expo/vector-icons';
import type { BusinessType, ProductRange } from '@/store/onboardingStore';

type IconName = keyof typeof Ionicons.glyphMap;

/** The till's starter catalogue — shared between the welcome screen's ambient
 *  preview (HeroDashboard) and the interactive first-sale demo, so the app
 *  is visibly ringing up the same shop before and after you touch it. */
export const DEMO_PRODUCTS: { id: string; icon: IconName; name: string; price: number }[] = [
  { id: 'milk', icon: 'water-outline', name: 'Milk 500ml', price: 65 },
  { id: 'bread', icon: 'fast-food-outline', name: 'Bread', price: 60 },
  { id: 'sugar', icon: 'cube-outline', name: 'Sugar 1kg', price: 210 },
  { id: 'soap', icon: 'sparkles-outline', name: 'Soap', price: 120 },
];

/** Quiz options shared between the personalization screen (rendering) and the
 *  outcome/preparing screen (echoing the answers back as tailored setup). */

export const BUSINESS_TYPES: { value: BusinessType; label: string; icon: IconName }[] = [
  { value: 'retail', label: 'Retail Shop', icon: 'storefront-outline' },
  { value: 'water', label: 'Water Business', icon: 'water-outline' },
  { value: 'agrovet', label: 'Agrovet', icon: 'leaf-outline' },
  { value: 'electronics', label: 'Electronics', icon: 'flash-outline' },
  { value: 'boutique', label: 'Boutique', icon: 'shirt-outline' },
  { value: 'pharmacy', label: 'Pharmacy', icon: 'medkit-outline' },
  { value: 'hardware', label: 'Hardware', icon: 'hammer-outline' },
  { value: 'supermarket', label: 'Supermarket', icon: 'cart-outline' },
  { value: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline' },
  { value: 'other', label: 'Something else', icon: 'ellipsis-horizontal-outline' },
];

export const PRODUCT_RANGES: { value: ProductRange; label: string; subtitle: string }[] = [
  { value: 'under50', label: 'Under 50', subtitle: 'A focused catalogue' },
  { value: '50to200', label: '50 – 200', subtitle: 'A growing range' },
  { value: '200to1000', label: '200 – 1,000', subtitle: 'A serious operation' },
  { value: 'over1000', label: 'More than 1,000', subtitle: 'A full warehouse' },
];

export const PAYMENT_METHODS: { value: string; label: string; icon: IconName }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'mpesa', label: 'M-PESA', icon: 'phone-portrait-outline' },
  { value: 'card', label: 'Card', icon: 'card-outline' },
  { value: 'bank', label: 'Bank transfer', icon: 'business-outline' },
  { value: 'credit', label: 'Credit (deni)', icon: 'book-outline' },
];

export const STRUGGLES: { value: string; label: string; icon: IconName }[] = [
  { value: 'stock-loss', label: 'Stock disappears', icon: 'trending-down-outline' },
  { value: 'untracked-sales', label: 'Sales not tracked', icon: 'clipboard-outline' },
  { value: 'employees', label: 'Managing employees', icon: 'people-outline' },
  { value: 'reports', label: 'Getting clear reports', icon: 'bar-chart-outline' },
  { value: 'inventory', label: 'Counting inventory', icon: 'cube-outline' },
  { value: 'mpesa-reconciliation', label: 'M-PESA reconciliation', icon: 'sync-outline' },
  { value: 'debts', label: 'Tracking customer debts', icon: 'wallet-outline' },
  { value: 'pricing', label: 'Setting the right prices', icon: 'pricetag-outline' },
];

export const businessLabel = (value: BusinessType | null): string =>
  BUSINESS_TYPES.find((t) => t.value === value)?.label ?? 'business';

export const productRangeLabel = (value: ProductRange | null): string =>
  PRODUCT_RANGES.find((r) => r.value === value)?.label ?? 'your products';

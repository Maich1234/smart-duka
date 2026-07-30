import type Ionicons from '@expo/vector-icons/Ionicons';
import type { PurchaseCostCategory } from '@/services/purchases';

export interface PurchaseCostCategoryMeta {
  value: PurchaseCostCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * The landed-cost categories a purchase can carry, in the order they're
 * offered. Shared by the New Purchase form, the purchase detail breakdown and
 * the procurement report so a cost reads identically wherever it appears.
 */
export const PURCHASE_COST_CATEGORIES: PurchaseCostCategoryMeta[] = [
  { value: 'transport', label: 'Transport', icon: 'car-outline' },
  { value: 'delivery', label: 'Delivery', icon: 'bicycle-outline' },
  { value: 'fuel', label: 'Fuel', icon: 'flame-outline' },
  { value: 'loading', label: 'Loading', icon: 'arrow-up-circle-outline' },
  { value: 'offloading', label: 'Offloading', icon: 'arrow-down-circle-outline' },
  { value: 'packaging', label: 'Packaging', icon: 'cube-outline' },
  { value: 'market_fee', label: 'Market Fee', icon: 'storefront-outline' },
  { value: 'brokerage', label: 'Brokerage', icon: 'briefcase-outline' },
  { value: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

/** Falls back to 'Other' so a category added server-side never renders blank. */
export const purchaseCostCategoryMeta = (value: string): PurchaseCostCategoryMeta =>
  PURCHASE_COST_CATEGORIES.find((c) => c.value === value) ??
  PURCHASE_COST_CATEGORIES[PURCHASE_COST_CATEGORIES.length - 1];

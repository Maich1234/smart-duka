/**
 * How money left the business — recorded on expenses and purchases.
 *
 * Mirrors MONEY_OUT_METHODS in the backend (src/constants/paymentMethods.js).
 * Deliberately not the same list as a sale's payment method ('cash' | 'mpesa' |
 * 'card'), which describes money coming in.
 */
export type MoneyOutMethod = 'cash' | 'mpesa' | 'bank' | 'credit';

export const MONEY_OUT_METHODS: MoneyOutMethod[] = ['cash', 'mpesa', 'bank', 'credit'];

export const MONEY_OUT_METHOD_LABELS: Record<MoneyOutMethod, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  bank: 'Bank',
  credit: 'On credit',
};

/** Methods where money actually moved — the ones a Cashbook may include. */
export const isCashMoving = (method?: MoneyOutMethod) => method !== 'credit';

/* ── Money in: the till's buttons ─────────────────────────────────────────
 *
 * Shop-defined, not a fixed list. Mirrors the backend's
 * src/constants/salePaymentMethods.js — see that file for why money-in is
 * configurable when money-out isn't.
 *
 * Only 'mpesa' behaves differently: with M-Pesa Business credentials it can
 * push an STK prompt, and without them it records and prints like any other
 * button. A shop taking M-Pesa on a Pochi or a personal number has no STK
 * available from Safaricom at all, so gating the button on credentials only
 * ever blocked real sales.
 */

export const CASH_METHOD_KEY = 'cash';
export const MPESA_METHOD_KEY = 'mpesa';

export type MethodIcon = 'cash' | 'phone' | 'bank' | 'card' | 'clock' | 'tag' | 'wallet';

export interface ShopPaymentMethod {
  key: string;
  label: string;
  icon?: MethodIcon;
  enabled?: boolean;
  order?: number;
}

/** What a shop starts with, and the fallback for shops predating this setting. */
export const DEFAULT_SALE_METHODS: ShopPaymentMethod[] = [
  { key: 'cash', label: 'Cash', icon: 'cash', enabled: true },
  { key: 'mpesa', label: 'M-PESA', icon: 'phone', enabled: true },
];

/** Ready-made buttons offered in the manager, so nobody has to invent a key. */
export const SUGGESTED_SALE_METHODS: ShopPaymentMethod[] = [
  { key: 'airtel_money', label: 'Airtel Money', icon: 'phone' },
  { key: 'bank', label: 'Bank Transfer', icon: 'bank' },
  { key: 'card', label: 'Card', icon: 'card' },
  { key: 'cheque', label: 'Cheque', icon: 'bank' },
  { key: 'credit', label: 'Credit (Deni)', icon: 'clock' },
  { key: 'voucher', label: 'Voucher', icon: 'tag' },
];

export const METHOD_ICON_NAMES: Record<MethodIcon, string> = {
  cash: 'cash-outline',
  phone: 'phone-portrait-outline',
  bank: 'business-outline',
  card: 'card-outline',
  clock: 'time-outline',
  tag: 'pricetag-outline',
  wallet: 'wallet-outline',
};

/** Ionicons name for a method, tolerant of unknown/missing icons. */
export const methodIcon = (method?: ShopPaymentMethod): string =>
  METHOD_ICON_NAMES[(method?.icon ?? 'wallet') as MethodIcon] ?? METHOD_ICON_NAMES.wallet;

/**
 * The buttons to render, given a shop. Falls back to Cash + M-PESA whenever the
 * shop has no list — old shops, and any response that predates this field.
 */
export const resolveSaleMethods = (
  methods?: ShopPaymentMethod[] | null
): ShopPaymentMethod[] => {
  const list = methods?.length ? methods : DEFAULT_SALE_METHODS;
  return list
    .filter((m) => m.enabled !== false)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

/** Turn a typed label into a valid key: "Airtel Money" → "airtel_money". */
export const slugifyMethodKey = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

/** Display label for a sale, preferring the label snapshotted at sale time. */
export const saleMethodLabel = (
  sale: { paymentMethod: string; paymentMethodLabel?: string },
  methods?: ShopPaymentMethod[] | null
): string =>
  sale.paymentMethodLabel
  || methods?.find((m) => m.key === sale.paymentMethod)?.label
  || sale.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

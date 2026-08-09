/**
 * Format currency. Defaults to KES until the shop owner sets their own
 * currency code in Shop Settings (services/shop.ts Shop.currency).
 */
export const formatCurrency = (amount: number, currency: string = 'KES'): string => {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format a stock quantity for display: whole units stay whole ("4", not "4.000"),
 * weighed goods keep up to three decimals with the trailing zeros dropped.
 */
export const formatQuantity = (quantity: number): string =>
  `${Number(quantity.toFixed(3))}`;

/**
 * Format date to local string (e.g., "15 Jan 2025")
 */
export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format datetime with time (e.g., "15 Jan 2025, 14:30")
 */
export const formatDateTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Compact relative timestamp for activity feeds. Recent events read as time
 * elapsed ("Just now", "12 min ago", "2 hrs ago"); older same-day events show
 * the clock time; anything before today shows the short date.
 */
export const formatRelativeTime = (dateString: string | Date, now: Date = new Date()): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 4) return `${diffHrs} hr${diffHrs === 1 ? '' : 's'} ago`;
    return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
};

/**
 * Format a Kenyan phone number for display in E.164 style with spaces.
 * Handles +254XXXXXXXXX, 254XXXXXXXXX and 07XXXXXXXX inputs.
 * Falls back to the raw value if the number doesn't match.
 * Used by M-Pesa payment flows to show the customer's number clearly.
 */
export const formatKenyanPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
};

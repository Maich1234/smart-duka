/** Parse the whole input; never silently truncate malformed quantities or prices. */
export function parseSaleNumber(value: string, wholeUnits = false): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) return null;
  if (wholeUnits && !Number.isSafeInteger(number)) return null;
  return number;
}

/** Accept pasted local, international, or nine-digit Kenyan phone numbers. */
export function normalizeKenyanPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  return digits ? `+254${digits}` : '';
}

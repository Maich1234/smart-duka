const SYSTEM_EMAIL_ROOT = 'smartduka.app';
const SLUG_LENGTH_THRESHOLD = 15;

function wordsOf(name: string): string[] {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Shop-name -> domain-safe slug for system-generated staff emails. Mirrors
 * smart-duka-backend/src/utils/staffEmailSlug.js exactly — keep in sync.
 * Single word -> itself, truncated (nothing to abbreviate to initials).
 * Multiple words -> concatenated; falls back to initials past the
 * threshold so a long shop name doesn't produce an unwieldy domain.
 */
export function slugifyShopName(shopName: string): string {
  const words = wordsOf(shopName);
  if (words.length === 0) return 'shop';
  if (words.length === 1) return words[0].slice(0, SLUG_LENGTH_THRESHOLD);
  const joined = words.join('');
  return joined.length <= SLUG_LENGTH_THRESHOLD ? joined : words.map((w) => w[0]).join('');
}

export function buildSystemEmailDomain(shopName: string): string {
  return `${slugifyShopName(shopName)}.${SYSTEM_EMAIL_ROOT}`;
}

/** True when `email` belongs to this shop's own system-generated domain. */
export function isSystemGeneratedEmail(email: string, shopName: string): boolean {
  const domain = buildSystemEmailDomain(shopName);
  return (email || '').toLowerCase().trim().endsWith(`@${domain}`);
}

/** Suggested local-part from a staff member's name, e.g. "Jane Otieno" -> "jane.otieno". */
export function slugifyLocalPart(name: string): string {
  return wordsOf(name).join('.');
}

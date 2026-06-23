/** Shared motion tokens — subtle, fast, functional. Mirrors the rest of the
 * token system (Colors/Spacing/Typography) so every interaction uses the
 * same handful of timings instead of ad-hoc durations per screen. */
export const Motion = {
  duration: {
    /** Press feedback, focus rings — anything that should feel instantaneous. */
    fast: 120,
    /** Default for fades, content swaps. */
    base: 180,
    /** List item enter/exit, screen content settling in after load. */
    slow: 240,
  },
  press: {
    /** Scale applied on press-in for buttons/rows — a small, Apple-style dip. */
    scale: 0.97,
  },
} as const;

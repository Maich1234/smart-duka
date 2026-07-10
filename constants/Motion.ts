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
    /** Deeper dip for large surfaces (cards, list rows) where 0.97 reads flat. */
    scaleCard: 0.98,
  },
  spring: {
    /** Press feedback — stiff and quick, settles without visible wobble. */
    press: { mass: 0.6, damping: 32, stiffness: 380 },
    /** Content entrances — soft landing for toasts, modals, cards. */
    enter: { mass: 0.8, damping: 22, stiffness: 260 },
  },
} as const;

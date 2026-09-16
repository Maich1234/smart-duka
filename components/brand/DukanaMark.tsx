import React from 'react';
import { Text } from 'react-native';
import { Typography } from '@/constants/Typography';

/**
 * DuQana brand colors, and the "DuQana" wordmark as styled text.
 *
 * The graphic mark itself (the storefront/phone glyph) is no longer a
 * hand-vectored SVG here — since the "Swap in the official Dukana app icon
 * set" rebrand it lives as the shipped PNG artwork in assets/images/
 * (icon.png, the android-icon-* set, and the white silhouette
 * brand-mark-white.png used on dark surfaces like app/splash.tsx). A
 * DukanaMark() SVG export used to live in this file tracing the old
 * gold shopping-bag+"D" logo; it was retired here rather than left importable,
 * since a stale export of the previous brand mark is a trap for the next
 * screen that reaches for "the logo component" and silently gets the wrong one.
 *
 * The wordmark stays text (not traced artwork) for the same reason it always
 * has: it can't drift from the current brand name or the current Gegola
 * display font the way a traced PNG/SVG could.
 */
export const BRAND = {
  green: '#004B39',
  goldFrom: '#F2C762',
  goldTo: '#D6A246',
  gold: '#E0A653',
} as const;

/** The "DuQana" wordmark on its own. */
export function DukanaWordmark({
  color = BRAND.gold,
  width,
  height,
}: {
  color?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Text
      style={{
        width,
        height,
        lineHeight: height,
        fontFamily: Typography.fontFamilyLogo,
        fontSize: height,
        color,
        letterSpacing: -0.5,
      }}
      numberOfLines={1}
    >
      DuQana
    </Text>
  );
}

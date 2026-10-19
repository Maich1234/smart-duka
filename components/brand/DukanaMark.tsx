import React from 'react';
import { Text } from 'react-native';
import { Typography } from '@/constants/Typography';

// The editable symbol is assets/brand/symbol.svg. Generated PNGs share one
// silhouette across launchers, splash screens and the welcome header.
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

// Single canonical numeric scale — `size` and `fontSize` below are two named
// views onto the same values so screens can use whichever reads better
// without the two scales drifting out of sync.
const scale = {
  xxs: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
} as const;

export const Typography = {
  fontFamily: 'Inter_400Regular',
  fontFamilyBold: 'Inter_700Bold',
  fontFamilySemiBold: 'Inter_600SemiBold',
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  size: {
    display: scale.display,
    h1: scale.xxxl,
    h2: scale.xxl,
    h3: scale.xl,
    body: scale.md,
    small: scale.sm,
    caption: scale.xs,
  },
  lineHeight: {
    display: 44,
    h1: 38,
    h2: 32,
    h3: 28,
    body: 24,
    small: 20,
    caption: 16,
  },
  letterSpacing: {
    tight: -0.3,
    normal: 0,
    wide: 0.2,
  },
  fontSize: scale,
} as const;
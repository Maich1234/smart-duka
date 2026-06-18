import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { Shadows } from '@/constants/Shadows';

export type Theme = {
  colors: typeof Colors;
  spacing: typeof Spacing;
  typography: typeof Typography;
  shadows: typeof Shadows;
  isDark: boolean;
};

export const useTheme = (): Theme => ({
  colors: Colors,
  spacing: Spacing,
  typography: Typography,
  shadows: Shadows,
  isDark: false,
});

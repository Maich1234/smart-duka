import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BottomSheet, SheetFooter } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { StatRow, Divider, InfoNote, money } from './BusinessPrimitives';
import type { CapitalPosition } from '@/services/business';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface Props {
  visible: boolean;
  onClose: () => void;
  capital?: CapitalPosition;
  currency?: string;
}

/**
 * How the headline figure was worked out, line by line.
 *
 * The two lines DuQana cannot fill in show "Not recorded" with the reason,
 * rather than a zero. A zero next to "Liabilities" is a claim that the shop
 * owes nothing — which for a duka buying stock on credit is usually false,
 * and is the single most misleading thing this screen could say.
 */
export const CapitalBreakdownSheet: React.FC<Props> = ({ visible, onClose, capital, currency }) => (
  <BottomSheet
    visible={visible}
    onClose={onClose}
    maxHeightPercent={80}
    footer={(
      <SheetFooter>
        <Button title="Close" variant="outline" onPress={onClose} />
      </SheetFooter>
    )}
  >
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <Text style={s.title} accessibilityRole="header">Estimated Capital</Text>
      <Text style={s.subtitle}>What the business owns, from what you have recorded.</Text>

      <View>
        {capital?.components.map((c, i) => (
          <View key={c.key}>
            {i > 0 && <Divider />}
            <StatRow
              label={c.label}
              sublabel={c.recorded ? undefined : c.reason}
              value={c.recorded ? money(c.amount ?? 0, currency) : null}
            />
          </View>
        ))}

        <View style={s.totalDivider} />
        <StatRow
          label="Estimated position"
          value={money(capital?.estimatedPosition ?? 0, currency)}
          emphasis
        />
      </View>

      {(capital?.assets.unvaluedCount ?? 0) > 0 && (
        <View style={s.note}>
          <InfoNote>
            {`${capital!.assets.unvaluedCount} asset${capital!.assets.unvaluedCount === 1 ? ' is' : 's are'} counted at what you paid, because no current value has been entered.`}
          </InfoNote>
        </View>
      )}

      <View style={s.note}>
        <InfoNote>
          {capital?.disclaimer ?? 'An operational estimate from what you have recorded in DuQana — not a formal accounting valuation.'}
        </InfoNote>
      </View>

    </ScrollView>
  </BottomSheet>
);

const s = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { paddingBottom: Spacing.md },
  title: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.borderStrong,
    marginTop: Spacing.sm,
  },
  note: { marginTop: Spacing.md },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { startShift } from '@/services/shifts';
import { useInvalidateShift } from '@/hooks/useShift';
import { useAlert } from '@/context/AlertContext';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

interface StartShiftSheetProps {
  visible: boolean;
  onClose: () => void;
  onStarted?: () => void;
}

/** Clock-in sheet: capture the opening cash float and open the session. */
export const StartShiftSheet: React.FC<StartShiftSheetProps> = ({
  visible,
  onClose,
  onStarted,
}) => {
  const [openingFloat, setOpeningFloat] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useAlert();
  const invalidateShift = useInvalidateShift();

  const parsedFloat = Number(openingFloat.replace(/[^0-9.]/g, '')) || 0;

  const handleStart = async () => {
    setLoading(true);
    try {
      await startShift({ openingFloat: parsedFloat, openingNote: note.trim() || undefined });
      haptics.success();
      invalidateShift();
      toast({ type: 'success', message: 'Shift started — the till is yours!' });
      setOpeningFloat('');
      setNote('');
      onClose();
      onStarted?.();
    } catch (error: any) {
      // 409 = a shift is already open (e.g. started on another device) — the
      // gate clears once the refreshed state lands.
      if (error.response?.status === 409) {
        invalidateShift();
        onClose();
        return;
      }
      haptics.error();
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Could not start the shift. Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={loading ? () => {} : onClose}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="play" size={24} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Start your shift</Text>
        <Text style={styles.subtitle}>
          Count the cash in the drawer before you begin — it&apos;s your opening float and the
          baseline for reconciliation when you clock out.
        </Text>

        <Input
          label="Opening cash float"
          placeholder="0"
          value={openingFloat}
          onChangeText={setOpeningFloat}
          keyboardType="numeric"
          leftIcon="cash-outline"
          autoFocus
        />
        <Input
          label="Note (optional)"
          placeholder="e.g. Till 1, morning shift"
          value={note}
          onChangeText={setNote}
          maxLength={300}
        />

        <Button
          title={parsedFloat > 0 ? `Start Shift with KSh ${parsedFloat.toLocaleString()}` : 'Start Shift'}
          onPress={handleStart}
          loading={loading}
          size="lg"
          style={styles.startBtn}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  startBtn: { marginTop: Spacing.sm, borderRadius: BorderRadius.lg },
});

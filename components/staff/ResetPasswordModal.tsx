import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ResetPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (newPassword: string) => void;
  staffName: string;
  loading?: boolean;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  visible,
  onClose,
  onConfirm,
  staffName,
  loading = false,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { toast } = useAlert();

  const handleConfirm = () => {
    if (!password || !confirm) {
      toast({ type: 'error', message: 'Please fill both fields' });
      return;
    }
    if (password !== confirm) {
      toast({ type: 'error', message: 'Passwords do not match' });
      return;
    }
    onConfirm(password);
    setPassword('');
    setConfirm('');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.staffName}>For: {staffName}</Text>
      <Input label="New Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Input label="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <View style={styles.buttonRow}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flexBtn} />
        <Button title="Reset" onPress={handleConfirm} loading={loading} style={styles.flexBtn} />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  staffName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.md, color: Colors.textSecondary },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
});
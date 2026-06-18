import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
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

  const handleConfirm = () => {
    if (!password || !confirm) {
      alert('Please fill both fields');
      return;
    }
    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }
    onConfirm(password);
    setPassword('');
    setConfirm('');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.staffName}>For: {staffName}</Text>
          <Input label="New Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Input label="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} />
            <Button title="Reset" onPress={handleConfirm} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.lg, width: '90%' },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, marginBottom: Spacing.sm, textAlign: 'center', color: Colors.textPrimary },
  staffName: { fontSize: Typography.size.body, textAlign: 'center', marginBottom: Spacing.md, color: Colors.textSecondary },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
});
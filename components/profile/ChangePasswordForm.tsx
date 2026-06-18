import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ChangePasswordFormProps {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  loading?: boolean;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  onChangePassword,
  loading = false,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    onChangePassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change Password</Text>
      <Input label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
      <Input label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <Input label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <Button title="Update Password" onPress={handleSubmit} loading={loading} style={styles.button} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  title: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilySemiBold, marginBottom: Spacing.md, color: Colors.textPrimary },
  button: { marginTop: Spacing.md },
});
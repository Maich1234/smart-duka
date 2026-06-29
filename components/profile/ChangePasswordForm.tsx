import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface ChangePasswordFormProps {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  loading?: boolean;
}

// ─── Password strength ────────────────────────────────────────────────────────

interface StrengthResult {
  score: number;
  label: string;
  color: string;
}

const getPasswordStrength = (password: string): StrengthResult => {
  if (!password) return { score: 0, label: '', color: Colors.border };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: Colors.danger };
  if (score === 2) return { score, label: 'Fair', color: Colors.warning };
  if (score === 3) return { score, label: 'Good', color: Colors.primary };
  return { score: 4, label: 'Strong', color: Colors.success };
};

const StrengthBar: React.FC<{ password: string }> = ({ password }) => {
  const { score, label, color } = getPasswordStrength(password);
  if (!password) return null;

  return (
    <View style={sb.wrap}>
      <View style={sb.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[sb.bar, { backgroundColor: i <= score ? color : Colors.border }]}
          />
        ))}
      </View>
      <Text style={[sb.label, { color }]}>{label}</Text>
    </View>
  );
};

const sb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -6,
    marginBottom: 14,
  },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  label: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    width: 44,
    textAlign: 'right',
  },
});

// ─── Security tip ─────────────────────────────────────────────────────────────

const SecurityTip: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <View style={tip.wrap}>
      <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
      <Text style={tip.text}>
        Use 8+ characters with uppercase letters, numbers, and symbols for a strong password.
      </Text>
    </View>
  );
};

const tip = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 16,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  onChangePassword,
  loading = false,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { toast } = useAlert();

  const strength = getPasswordStrength(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = !loading && currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0 && !mismatch;

  const handleSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ type: 'error', message: 'Please fill all fields' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    onChangePassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <View style={styles.card}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="lock-closed-outline" size={17} color={Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Change Password</Text>
          <Text style={styles.headerSub}>Keep your account secure with a strong password</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Fields */}
      <View style={styles.fields}>
        <Input
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          leftIcon="key-outline"
        />
        <Input
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          leftIcon="lock-open-outline"
        />
        <StrengthBar password={newPassword} />
        <Input
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          leftIcon="checkmark-circle-outline"
          error={mismatch ? 'Passwords do not match' : undefined}
        />

        <SecurityTip visible={strength.score > 0 && strength.score < 4} />

        <Button
          title="Update Password"
          onPress={handleSubmit}
          loading={loading}
          disabled={!canSubmit}
          leftIcon="shield-checkmark-outline"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  fields: {
    padding: Spacing.md,
  },
});

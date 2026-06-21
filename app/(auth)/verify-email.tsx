import React, { useState } from 'react';
import { Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { verifyEmail, resendVerificationEmail } from '@/services/auth';

const codeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type CodeForm = z.infer<typeof codeSchema>;

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = async (data: CodeForm) => {
    setLoading(true);
    try {
      await verifyEmail(email, data.code);
      router.replace({ pathname: '/(auth)/login', params: { email, verified: '1' } });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail(email);
      Alert.alert('Sent', 'A new verification code has been sent to your email');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen backgroundColor={colors.background} padded={false} contentContainerStyle={styles.container}>
        <AuthHeader />
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>Verify Your Email</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the 6-digit code sent to {email}
          </Text>

          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Verification Code"
                placeholder="123456"
                value={value}
                onChangeText={onChange}
                error={errors.code?.message}
                keyboardType="number-pad"
                maxLength={6}
              />
            )}
          />

          <Button
            title="Verify Email"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            style={styles.button}
          />

          <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendLink}>
            <Text style={[styles.link, { color: colors.primary }]}>
              {resending ? 'Sending...' : "Didn't get a code? Resend"}
            </Text>
          </TouchableOpacity>
        </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  button: {
    marginTop: Spacing.md,
  },
  resendLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  link: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import api from '@/services/api';
import * as Haptics from 'expo-haptics';

// Step types
type Step = 'request' | 'verify' | 'reset';

// Validation schemas
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const resetSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type EmailForm = z.infer<typeof emailSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Email form
  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  // OTP form
  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  // Reset form
  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const handleRequestOtp = async (data: EmailForm) => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setEmail(data.email);
      setStep('verify');
      Alert.alert('Success', 'OTP sent to your email');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpForm) => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post('/auth/verify-otp', { email, otp: data.otp });
      setStep('reset');
      Alert.alert('Success', 'OTP verified. Set your new password.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetForm) => {
    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await api.post('/auth/reset-password', { email, newPassword: data.newPassword });
      Alert.alert('Success', 'Password changed. Please login with your new password.');
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <AuthHeader />
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {step === 'request' && 'Enter your email to receive a OTP'}
            {step === 'verify' && 'Enter the 6‑digit code sent to your email'}
            {step === 'reset' && 'Choose a new password for your account'}
          </Text>

          {step === 'request' && (
            <>
              <Controller
                control={emailForm.control}
                name="email"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Input
                    label="Email Address"
                    placeholder="you@example.com"
                    value={value}
                    onChangeText={onChange}
                    error={error?.message}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                )}
              />
              <Button
                title="Send OTP"
                onPress={emailForm.handleSubmit(handleRequestOtp)}
                loading={loading}
                style={styles.button}
              />
            </>
          )}

          {step === 'verify' && (
            <>
              <Controller
                control={otpForm.control}
                name="otp"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Input
                    label="OTP Code"
                    placeholder="123456"
                    value={value}
                    onChangeText={onChange}
                    error={error?.message}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                )}
              />
              <Button
                title="Verify OTP"
                onPress={otpForm.handleSubmit(handleVerifyOtp)}
                loading={loading}
                style={styles.button}
              />
              <TouchableOpacity onPress={() => setStep('request')}>
                <Text style={[styles.link, { color: colors.primary }]}>Back to email</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'reset' && (
            <>
              <Controller
                control={resetForm.control}
                name="newPassword"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Input
                    label="New Password"
                    placeholder="••••••"
                    value={value}
                    onChangeText={onChange}
                    error={error?.message}
                    secureTextEntry
                  />
                )}
              />
              <Controller
                control={resetForm.control}
                name="confirmPassword"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Input
                    label="Confirm Password"
                    placeholder="••••••"
                    value={value}
                    onChangeText={onChange}
                    error={error?.message}
                    secureTextEntry
                  />
                )}
              />
              <Button
                title="Reset Password"
                onPress={resetForm.handleSubmit(handleResetPassword)}
                loading={loading}
                style={styles.button}
              />
            </>
          )}

          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back to Login</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  link: {
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  backLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  backText: {
    fontSize: Typography.fontSize.sm,
  },
});
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { OtpCodeField } from '@/components/ui/OtpCodeField';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import api from '@/services/api';
import { haptics } from '@/utils/haptics';

type Step = 'request' | 'verify' | 'reset' | 'success';

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const resetSchema = z
  .object({
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type EmailForm = z.infer<typeof emailSchema>;
type ResetForm = z.infer<typeof resetSchema>;

function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.inlineError}>
      <Ionicons name="alert-circle-outline" size={15} color={Colors.danger} />
      <Text style={styles.inlineErrorText}>{message}</Text>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  const [verifyCooldown, setVerifyCooldown] = useState(0);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => setVerifyCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown]);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const newPassword = resetForm.watch('newPassword') || '';

  const headlineMap: Record<Step, { headline: string; description: string }> = {
    request: {
      headline: 'Forgot Password',
      description: "Enter your account email and we'll send a reset code.",
    },
    verify: {
      headline: 'Check Your Email',
      description: `We sent a 6-digit code to ${email}. Enter it below.`,
    },
    reset: {
      headline: 'New Password',
      description: 'Choose a strong password for your account.',
    },
    success: {
      headline: 'Password Updated',
      description: 'Your password has been changed successfully.',
    },
  };

  const handleRequestOtp = async (data: EmailForm) => {
    setLoading(true);
    setFormError('');
    haptics.light();
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setEmail(data.email);
      setStep('verify');
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Could not send reset code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      setOtpError('Please enter the full 6-digit code');
      return;
    }
    setLoading(true);
    setOtpError('');
    haptics.light();
    try {
      await api.post('/auth/verify-otp', { email, otp });
      setStep('reset');
    } catch (error: any) {
      const attempts = verifyAttempts + 1;
      setVerifyAttempts(attempts);
      if (attempts >= 5) setVerifyCooldown(30);
      else if (attempts >= 3) setVerifyCooldown(10);
      setOtpError(error.response?.data?.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetForm) => {
    setLoading(true);
    setFormError('');
    haptics.success();
    try {
      await api.post('/auth/reset-password', { email, newPassword: data.newPassword });
      setStep('success');
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Could not reset password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const { headline, description } = headlineMap[step];

  return (
    <Screen
      backgroundColor={Colors.surface}
      padded={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.inner}>
        {step !== 'success' ? (
          <AnimatedPressable
            onPress={() => (step === 'request' ? router.back() : setStep('request'))}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </AnimatedPressable>
        ) : null}

        <AuthHeader headline={headline} description={description} />

        {/* ── Step 1: Request OTP ── */}
        {step === 'request' && (
          <>
            <Controller
              control={emailForm.control}
              name="email"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  label="Email address"
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  error={error?.message}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  leftIcon="mail-outline"
                  returnKeyType="done"
                  onSubmitEditing={emailForm.handleSubmit(handleRequestOtp)}
                />
              )}
            />
            {formError ? <InlineError message={formError} /> : null}
            <Button
              title="Send Reset Code"
              onPress={emailForm.handleSubmit(handleRequestOtp)}
              loading={loading}
              style={styles.button}
              size="lg"
            />
          </>
        )}

        {/* ── Step 2: Verify OTP ── */}
        {step === 'verify' && (
          <>
            <OtpCodeField
              value={otp}
              onChange={(v) => {
                setOtp(v);
                if (otpError) setOtpError('');
              }}
              error={otpError}
              style={{ marginBottom: Spacing.md }}
            />
            {formError ? <InlineError message={formError} /> : null}
            {verifyCooldown > 0 && (
              <Text style={styles.cooldownText}>
                Too many attempts — try again in {verifyCooldown}s
              </Text>
            )}
            <Button
              title="Verify Code"
              onPress={handleVerifyOtp}
              loading={loading}
              style={styles.button}
              size="lg"
              disabled={otp.length < 6 || verifyCooldown > 0}
            />
            <AnimatedPressable
              onPress={() => {
                setOtp('');
                setOtpError('');
                setStep('request');
              }}
              style={styles.secondaryLink}
            >
              <Text style={styles.secondaryLinkText}>Wrong email? Go back</Text>
            </AnimatedPressable>
          </>
        )}

        {/* ── Step 3: Reset Password ── */}
        {step === 'reset' && (
          <>
            <Controller
              control={resetForm.control}
              name="newPassword"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  label="New password"
                  placeholder="At least 8 characters with a number"
                  value={value}
                  onChangeText={onChange}
                  error={error?.message}
                  secureTextEntry
                  returnKeyType="next"
                />
              )}
            />
            <PasswordStrength password={newPassword} />
            <Controller
              control={resetForm.control}
              name="confirmPassword"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input
                  label="Confirm new password"
                  placeholder="Repeat your password"
                  value={value}
                  onChangeText={onChange}
                  error={error?.message}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={resetForm.handleSubmit(handleResetPassword)}
                />
              )}
            />
            {formError ? <InlineError message={formError} /> : null}
            <Button
              title="Update Password"
              onPress={resetForm.handleSubmit(handleResetPassword)}
              loading={loading}
              style={styles.button}
              size="lg"
            />
          </>
        )}

        {/* ── Step 4: Success ── */}
        {step === 'success' && (
          <View style={styles.successContainer}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={36} color={Colors.success} />
            </View>
            <Text style={styles.successNote}>
              You can now sign in with your new password.
            </Text>
            <Button
              title="Sign In"
              onPress={() => router.replace('/(auth)/login')}
              style={styles.button}
              size="lg"
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  button: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dangerSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  inlineErrorText: {
    flex: 1,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
  },
  secondaryLink: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    paddingVertical: 4,
  },
  secondaryLinkText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  cooldownText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successNote: {
    fontSize: Typography.size.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
});

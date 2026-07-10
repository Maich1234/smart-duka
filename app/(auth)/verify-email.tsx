import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { OtpCodeField } from '@/components/ui/OtpCodeField';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { verifyEmail, resendVerificationEmail } from '@/services/auth';
import { haptics } from '@/utils/haptics';

const RESEND_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  const [verifyCooldown, setVerifyCooldown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => setVerifyCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown]);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_SECONDS);
  }, []);

  const onSubmit = async () => {
    if (code.length < 6) {
      setCodeError('Please enter the full 6-digit code');
      return;
    }
    setLoading(true);
    setCodeError('');
    setFormError('');
    try {
      await verifyEmail(email, code);
      haptics.success();
      router.replace({ pathname: '/(auth)/login', params: { email, verified: '1' } });
    } catch (error: any) {
      haptics.error();
      const attempts = verifyAttempts + 1;
      setVerifyAttempts(attempts);
      if (attempts >= 5) setVerifyCooldown(30);
      else if (attempts >= 3) setVerifyCooldown(10);
      setCodeError(error.response?.data?.message || 'Invalid or expired code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setFormError('');
    try {
      await resendVerificationEmail(email);
      startCountdown();
      setCode('');
      setCodeError('');
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Could not resend code. Try again.');
    } finally {
      setResending(false);
    }
  };

  const maskEmail = (e: string) => {
    const [local, domain] = e.split('@');
    if (!domain) return e;
    const masked = local.slice(0, 2) + '***';
    return `${masked}@${domain}`;
  };

  const canResend = countdown <= 0;

  return (
    <Screen
      backgroundColor={Colors.surface}
      padded={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.inner}>
        <AuthHeader
          headline="Verify Your Email"
          description={`We sent a 6-digit code to ${maskEmail(email || '')}. Check your inbox.`}
        />

        {/* Email chip */}
        <View style={styles.emailChip}>
          <Ionicons name="mail-outline" size={15} color={Colors.primary} />
          <Text style={styles.emailChipText} numberOfLines={1}>
            {email}
          </Text>
        </View>

        <OtpCodeField
          value={code}
          onChange={(v) => {
            setCode(v);
            if (codeError) setCodeError('');
          }}
          error={codeError}
          style={{ marginBottom: Spacing.md }}
        />

        {formError ? (
          <View style={styles.inlineError}>
            <Ionicons name="alert-circle-outline" size={15} color={Colors.danger} />
            <Text style={styles.inlineErrorText}>{formError}</Text>
          </View>
        ) : null}

        {verifyCooldown > 0 && (
          <Text style={styles.cooldownText}>
            Too many attempts — try again in {verifyCooldown}s
          </Text>
        )}
        <Button
          title="Verify Email"
          onPress={onSubmit}
          loading={loading}
          style={styles.button}
          size="lg"
          disabled={code.length < 6 || verifyCooldown > 0}
        />

        {/* Resend row */}
        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>Didn't get the code?</Text>
          {canResend ? (
            <AnimatedPressable
              onPress={handleResend}
              disabled={resending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.resendLink}>
                {resending ? 'Sending…' : 'Resend code'}
              </Text>
            </AnimatedPressable>
          ) : (
            <Text style={styles.resendCountdown}>
              Resend in {countdown}s
            </Text>
          )}
        </View>

        {/* Hint */}
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.hintText}>
            Check your spam folder if you don't see the email.
          </Text>
        </View>
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
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    marginBottom: Spacing.lg,
  },
  emailChipText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    maxWidth: 220,
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
  button: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  resendPrompt: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  resendLink: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
  },
  resendCountdown: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  hintText: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    lineHeight: 18,
  },
  cooldownText: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
});

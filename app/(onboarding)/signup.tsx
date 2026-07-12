import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { register as registerApi } from '@/services/auth';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useAlert } from '@/context/AlertContext';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';

const signupSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function OnboardingSignup() {
  const [loading, setLoading] = useState(false);
  const { toast } = useAlert();
  const { draft } = useOnboardingStore();
  const user = useAuthStore((s) => s.user);

  // Replay/preview by a signed-in owner — there's no account to create, so
  // jump straight to the celebration.
  useEffect(() => {
    if (user) router.replace('/(onboarding)/celebrate');
  }, [user]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: draft.ownerName, email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password') || '';

  const onSubmit = async (data: SignupForm) => {
    setLoading(true);
    try {
      const res = await registerApi({
        name: data.name,
        email: data.email,
        password: data.password,
        shopName: draft.shopName || 'My Smart Shop',
        phone: draft.phone || undefined,
      });
      if (res.success) {
        haptics.success();
        router.replace({ pathname: '/(auth)/verify-email', params: { email: data.email } });
      } else {
        toast({ type: 'error', message: res.message || 'Registration failed. Please try again.' });
      }
    } catch (error: any) {
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen backgroundColor={Colors.surface} padded={false} contentContainerStyle={styles.scroll}>
      <StatusBar style="dark" />
      <View style={styles.inner}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </AnimatedPressable>

        <Animated.Text entering={FadeInDown.duration(450)} style={styles.title}>
          Your shop is built.{'\n'}Now make it yours.
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(450).delay(90)} style={styles.subtitle}>
          A free account keeps your sales, stock and reports safe on any device.
        </Animated.Text>

        {/* Everything they already told us, ready to go */}
        <Animated.View entering={FadeInDown.duration(450).delay(160)} style={styles.shopCard}>
          <View style={styles.shopIcon}>
            <Ionicons name="storefront" size={20} color={Colors.primary} />
          </View>
          <View style={styles.shopText}>
            <Text style={styles.shopName}>{draft.shopName || 'My Smart Shop'}</Text>
            <Text style={styles.shopMeta}>
              {[draft.county, draft.currency].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <AnimatedPressable onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.shopEdit}>Edit</Text>
          </AnimatedPressable>
        </Animated.View>

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              label="Your name"
              placeholder="Jane Wanjiku"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.name?.message}
              autoCapitalize="words"
              returnKeyType="next"
              autoComplete="name"
              textContentType="name"
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              label="Email address"
              placeholder="you@example.com"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.email?.message}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon="mail-outline"
              returnKeyType="next"
              autoComplete="email"
              textContentType="username"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              label="Password"
              placeholder="At least 8 characters with a number"
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              error={errors.password?.message}
              returnKeyType="next"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
        <PasswordStrength password={password} />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <Input
              label="Confirm password"
              placeholder="Repeat your password"
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              error={errors.confirmPassword?.message}
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />

        <Button
          title="Create My Shop"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          style={styles.button}
          size="lg"
        />

        <AnimatedPressable
          onPress={() =>
            router.push({ pathname: '/(onboarding)/demo', params: { mode: 'guest' } })
          }
          style={styles.guestRow}
          accessibilityRole="button"
        >
          <Ionicons name="compass-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.guestText}>Not ready? Keep exploring the demo</Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => {
            // Explicitly claiming an existing account means this device is not
            // new — stop replaying the welcome journey on future cold starts.
            useOnboardingStore.getState().markCompleted();
            router.replace('/(auth)/login');
          }}
          style={styles.loginRow}
          accessibilityRole="button"
        >
          <Text style={styles.loginText}>Already have an account?</Text>
          <Text style={styles.loginLink}> Sign in</Text>
        </AnimatedPressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: Spacing.xl },
  inner: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  shopIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopText: { flex: 1 },
  shopName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
  },
  shopMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  shopEdit: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  button: { marginTop: Spacing.sm, borderRadius: BorderRadius.lg },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: Spacing.xs,
  },
  guestText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  loginRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6 },
  loginText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
  },
  loginLink: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAlert } from '@/context/AlertContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { register as registerApi } from '@/services/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(8),
    shopName: z.string().min(2, 'Shop name is required'),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function SectionLabel({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={14} color={Colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function RegisterScreen() {
  const [loading, setLoading] = useState(false);
  const { toast } = useAlert();
  // Anything already told to the onboarding journey shouldn't be asked twice.
  const draft = useOnboardingStore((s) => s.draft);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    // Every field needs a string default — a missing one surfaces Zod's raw
    // "Required" error and flips the input uncontrolled→controlled.
    defaultValues: {
      name: draft.ownerName || '',
      email: '',
      password: '',
      confirmPassword: '',
      shopName: draft.shopName || '',
      phone: draft.phone || '',
    },
  });

  const password = watch('password') || '';

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const res = await registerApi({
        name: data.name,
        email: data.email,
        password: data.password,
        shopName: data.shopName,
        phone: data.phone,
      });
      if (res.success) {
        router.replace({ pathname: '/(auth)/verify-email', params: { email: data.email } });
      } else {
        toast({ type: 'error', message: res.message || 'Registration failed. Please try again.' });
      }
    } catch (error: any) {
      if (__DEV__) console.error('[register] raw error:', error);
      toast({
        type: 'error',
        message:
          error.response?.data?.message || error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      backgroundColor={Colors.surface}
      contentContainerStyle={styles.scrollContent}
    >
      <AuthHeader
        headline="Create Your Shop"
        description="Start selling and managing your business in minutes."
      />

      {/* Section: Your Details */}
      <SectionLabel title="Your Details" icon="person-outline" />

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label="Full name"
            placeholder="Jane Doe"
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
            returnKeyType="next"
            autoComplete="email"
            textContentType="username"
          />
        )}
      />

      <View style={styles.sectionDivider} />

      {/* Section: Security */}
      <SectionLabel title="Security" icon="lock-closed-outline" />

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
            returnKeyType="next"
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />

      <View style={styles.sectionDivider} />

      {/* Section: Your Shop */}
      <SectionLabel title="Your Shop" icon="storefront-outline" />

      <Controller
        control={control}
        name="shopName"
        render={({ field }) => (
          <Input
            label="Shop name"
            placeholder="My Smart Shop"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.shopName?.message}
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <Input
            label="Phone number (optional)"
            placeholder="+254 700 000 000"
            value={field.value}
            onChangeText={field.onChange}
            error={errors.phone?.message}
            keyboardType="phone-pad"
            returnKeyType="done"
            hint="Used for M-Pesa payment notifications"
          />
        )}
      />

      <Button
        title="Create Account"
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        style={styles.button}
        size="lg"
      />

      <Pressable onPress={() => router.back()} style={styles.loginRow}>
        <Text style={styles.loginText}>Already have an account?</Text>
        <Text style={styles.loginLink}> Sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: Spacing.sm,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.lg,
  },
  button: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
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

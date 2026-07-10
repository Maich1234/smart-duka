import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const { email: prefillEmail, verified } = useLocalSearchParams<{
    email?: string;
    verified?: string;
  }>();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefillEmail || '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    const result = await login(data.email, data.password);
    setLoading(false);
    if (result.success) {
      if (verified === '1' && result.role === 'owner') {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace(
          result.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard'
        );
      }
      return;
    }
    if (result.needsVerification) {
      router.push({ pathname: '/(auth)/verify-email', params: { email: data.email } });
      return;
    }
    setError('password', { message: result.message || 'Incorrect email or password' });
  };

  return (
    <Screen
      backgroundColor={Colors.surface}
      padded={false}
      contentContainerStyle={styles.scrollContent}
    >
      <StatusBar style="dark" />
      <View style={styles.inner}>
        <AuthHeader
          headline="Welcome Back"
          description="Manage your business with confidence."
        />

        {verified === '1' ? (
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.verifiedText}>
              Email verified — sign in to continue
            </Text>
          </View>
        ) : null}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email address"
              placeholder="you@example.com"
              value={value}
              onChangeText={onChange}
              error={errors.email?.message}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon="mail-outline"
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Password"
              placeholder="Enter your password"
              value={value}
              onChangeText={onChange}
              secureTextEntry
              error={errors.password?.message}
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />

        <AnimatedPressable
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotLink}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </AnimatedPressable>

        <Button
          title="Sign In"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          style={styles.button}
          size="lg"
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/register')}
          style={styles.createRow}
        >
          <Text style={styles.createText}>New to Smart Duka?</Text>
          <Text style={styles.createLink}> Create your shop</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.primary} style={styles.createArrow} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.successSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
  },
  verifiedText: {
    color: Colors.success,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    flex: 1,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    marginTop: -Spacing.xs,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  button: {
    borderRadius: BorderRadius.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontSize: Typography.size.small,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    paddingHorizontal: 4,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
  },
  createLink: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  createArrow: {
    marginLeft: 2,
  },
});

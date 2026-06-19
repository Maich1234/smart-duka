import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const { email: prefillEmail, verified } = useLocalSearchParams<{ email?: string; verified?: string }>();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefillEmail || '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    const result = await login(data.email, data.password);
    setLoading(false);
    if (result.success) {
      if (verified === '1') {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace(result.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard');
      }
      return;
    }
    if (result.needsVerification) {
      router.push({ pathname: '/(auth)/verify-email', params: { email: data.email } });
      return;
    }
    setError('password', { message: result.message || 'Login failed' });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <View style={styles.inner}>
        <AuthHeader />
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {verified === '1' && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>Email verified! Please sign in to continue.</Text>
          </View>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              value={value}
              onChangeText={onChange}
              error={errors.email?.message}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Password"
              placeholder="••••••"
              value={value}
              onChangeText={onChange}
              secureTextEntry
              error={errors.password?.message}
            />
          )}
        />

        <Button title="Sign In" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.button} />

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.link}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Do not have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>Create Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: Typography.size.body, color: Colors.textSecondary, marginBottom: Spacing.xl },
  successBanner: {
    backgroundColor: '#E6F4EA',
    borderRadius: 10,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: -Spacing.md,
  },
  successBannerText: {
    color: Colors.success,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'center',
  },
  button: { marginTop: Spacing.md },
  link: { marginTop: Spacing.md, alignSelf: 'center' },
  linkText: { color: Colors.primary, fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  registerText: { color: Colors.textSecondary, fontSize: Typography.size.small },
  registerLink: { color: Colors.primary, fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold },
});

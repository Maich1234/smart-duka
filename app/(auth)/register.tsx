import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { register as registerApi } from '@/services/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const registerSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6),
  shopName: z.string().min(2, 'Shop name required'),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

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
        Alert.alert('Error', res.message || 'Registration failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AuthHeader />
        <Text style={styles.title}>Create Your Shop</Text>
        <Text style={styles.subtitle}>Start selling in minutes</Text>

        <Controller control={control} name="name" render={({ field }) => (
          <Input label="Full Name" placeholder="John Doe" value={field.value} onChangeText={field.onChange} error={errors.name?.message} />
        )} />
        <Controller control={control} name="email" render={({ field }) => (
          <Input label="Email" placeholder="you@example.com" value={field.value} onChangeText={field.onChange} error={errors.email?.message} autoCapitalize="none" keyboardType="email-address" />
        )} />
        <Controller control={control} name="password" render={({ field }) => (
          <Input label="Password" placeholder="••••••" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.password?.message} />
        )} />
        <Controller control={control} name="confirmPassword" render={({ field }) => (
          <Input label="Confirm Password" placeholder="••••••" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.confirmPassword?.message} />
        )} />
        <Controller control={control} name="shopName" render={({ field }) => (
          <Input label="Shop Name" placeholder="My Smart Shop" value={field.value} onChangeText={field.onChange} error={errors.shopName?.message} />
        )} />
        <Controller control={control} name="phone" render={({ field }) => (
          <Input label="Phone (optional)" placeholder="+254..." value={field.value} onChangeText={field.onChange} error={errors.phone?.message} keyboardType="phone-pad" />
        )} />

        <Button title="Register Shop" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.button} />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: Typography.size.body, color: Colors.textSecondary, marginBottom: Spacing.xl },
  button: { marginTop: Spacing.md },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  loginText: { color: Colors.textSecondary },
  loginLink: { color: Colors.primary, fontFamily: Typography.fontFamilySemiBold },
});

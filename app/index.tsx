import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore, type AuthState } from '@/store/authStore';

export default function Index() {
  const user = useAuthStore((s: AuthState) => s.user);
  const isLoading = useAuthStore((s: AuthState) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(user.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard');
    } else {
      router.replace('/splash');
    }
  }, [isLoading, user]);

  return null;
}

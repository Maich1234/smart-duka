import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore, type AuthState } from '@/store/authStore';

export default function Index() {
  const isLoading = useAuthStore((s: AuthState) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    // Always show the splash animation — splash.tsx handles auth-based routing.
    router.replace('/splash');
  }, [isLoading]);

  return null;
}

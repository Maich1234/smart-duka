import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { HELP_CENTER_URL } from '@/constants/config';

// Native fallback for app/help/[slug].web.tsx — see index.tsx for why this
// file exists; nothing should normally navigate here on native.
export default function HelpTopicNativeFallback() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  useEffect(() => {
    Linking.openURL(`${HELP_CENTER_URL}/help/${slug}`);
    router.back();
  }, [slug]);

  return null;
}

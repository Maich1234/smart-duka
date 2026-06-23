import { Stack } from 'expo-router';

// Native fallback for app/help/_layout.web.tsx — the Help Center only has
// real content on web; native screens here just redirect out (see index.tsx
// and [slug].tsx), so this layout never needs a header.
export default function HelpLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

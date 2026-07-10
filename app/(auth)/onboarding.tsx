import React, { useRef, useState, useEffect } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/authStore';
import { getProducts } from '@/services/products';

const { width } = Dimensions.get('window');

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'storefront-outline',
    title: 'Welcome to Smart Duka',
    subtitle: 'Run your shop smarter — manage stock, sales and staff all in one place.',
  },
  {
    icon: 'cube-outline',
    title: 'Track Your Inventory',
    subtitle: 'Get real-time stock counts and low-stock alerts so you never run out.',
  },
  {
    icon: 'cash-outline',
    title: 'Sell in Seconds',
    subtitle: 'Record sales with Cash or M-Pesa and keep your books up to date automatically.',
  },
  {
    icon: 'people-outline',
    title: 'Manage Your Team',
    subtitle: 'Add staff accounts and control what each team member can access.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    getProducts({ page: 1, limit: 1 })
      .then((res) => {
        if ((res.pagination?.total ?? 0) > 0) {
          router.replace('/(owner)/dashboard');
        }
      })
      .catch(() => {});
  }, []);

  const finish = () => {
    router.replace(user?.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard');
  };

  const handleNext = () => {
    if (index === SLIDES.length - 1) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  // Without a fixed-width layout, scrollToIndex has to estimate slide
  // position and can land on the wrong slide (or throw) before the list has
  // measured itself — getItemLayout gives it an exact answer up front.
  const getItemLayout = (_: ArrayLike<Slide> | null | undefined, i: number) => ({
    length: width,
    offset: width * i,
    index: i,
  });

  const isLast = index === SLIDES.length - 1;

  return (
    <Screen backgroundColor={Colors.background} scroll={false} padded={false}>
      <AnimatedPressable onPress={finish} style={styles.skip}>
        <Text style={styles.skipText}>Skip</Text>
      </AnimatedPressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={({ index: failedIndex }) => {
          listRef.current?.scrollToOffset({ offset: failedIndex * width, animated: true });
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={64} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Button
        title={isLast ? 'Get Started' : 'Next'}
        onPress={handleNext}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  skip: { position: 'absolute', top: Spacing.md, right: Spacing.lg, zIndex: 1 },
  skipText: { color: Colors.textSecondary, fontFamily: Typography.fontFamilySemiBold, fontSize: Typography.size.body },
  slide: { width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.body,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: Spacing.lg },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  button: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
});

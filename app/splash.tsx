import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useAuthStore, type AuthState } from '@/store/authStore';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const [displayText, setDisplayText] = useState('');
  const [animationFinished, setAnimationFinished] = useState(false);
  const fullText = 'SMART DUKA';

  const user = useAuthStore((s: AuthState) => s.user);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
        setAnimationFinished(true);
      }
    }, 120);
    return () => clearInterval(timer);
  }, []);

  const glowOpacity = useSharedValue(0);
  const glowTranslate = useSharedValue(-width);

  useEffect(() => {
    if (!animationFinished) return;

    glowOpacity.value = withTiming(1, { duration: 200 });
    glowTranslate.value = withSequence(
      withTiming(width, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      withTiming(-width, { duration: 0 })
    );

    const timeout = setTimeout(() => {
      if (user) {
        router.replace(user.role === 'owner' ? '/(owner)/dashboard' : '/(staff)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [animationFinished]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ translateX: glowTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>{displayText}</Text>
        {animationFinished && (
          <Animated.View style={[styles.glow, glowStyle]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    position: 'relative',
  },
  logoText: {
    fontFamily: Typography.fontFamilyBold,
    fontSize: Typography.size.display,
    color: Colors.white,
    letterSpacing: 2,
    textAlign: 'center',
  },
  glow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ skewX: '-20deg' }],
  },
});

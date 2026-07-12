import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { CrossfadeCircle } from '@/components/ui/motion';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACTION_CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - 12) / 2;

export interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  route: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => {
  return (
    <Animated.View entering={FadeInUp.duration(420).delay(180)} style={styles.quickSection}>
      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        {actions.map((action, index) => (
          <Animated.View
            key={action.id}
            entering={FadeInUp.duration(380).delay(220 + index * 60)}
            style={styles.actionWrapper}
          >
            <AnimatedPressable
              onPress={() => router.push(action.route as any)}
              style={styles.actionCard}
              accessibilityRole="button"
              accessibilityLabel={`${action.title}: ${action.subtitle}`}
            >
              <LinearGradient
                colors={action.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <CrossfadeCircle
                  phase={index % 2 === 0 ? 'in' : 'out'}
                  duration={5200}
                  style={styles.actionDecorCircle}
                />
                <View style={styles.actionIconWrap}>
                  <Ionicons name={action.icon} size={22} color={Colors.white} />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </LinearGradient>
            </AnimatedPressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  quickSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionWrapper: {
    width: ACTION_CARD_WIDTH,
  },
  actionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  actionGradient: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    overflow: 'hidden',
    gap: 2,
  },
  actionDecorCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
    right: -15,
    top: -15,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.white,
    letterSpacing: -0.1,
  },
  actionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },
});

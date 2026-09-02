import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAiAccess } from '@/hooks/useAiAccess';
import { useShopConfigToggle } from '@/hooks/useShopConfigToggle';
import { DukanaAiSection } from '@/components/profile/DukanaAiSection';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function AiSettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { state: aiAccessState, aiEnabled, isLoading: loadingShop } = useAiAccess();
  const { toggling, handleToggle: handleToggleAi } = useShopConfigToggle(
    'aiEnabled',
    { on: 'DuQana AI is on', off: 'DuQana AI is off. No data is sent to Gemini' },
    [['aiInsight']],
  );

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <Animated.View entering={FadeInUp.duration(320)} style={styles.wrap}>
          <DukanaAiSection
            state={aiAccessState}
            aiEnabled={aiEnabled}
            toggling={toggling}
            loadingShop={loadingShop}
            onToggle={handleToggleAi}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  wrap: { marginHorizontal: Spacing.lg },
});

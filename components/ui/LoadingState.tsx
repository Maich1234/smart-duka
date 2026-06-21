import React from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

interface LoadingStateProps {
  size?: number;
  fullscreen?: boolean;
}

/**
 * Drop-in replacement for a bare full-page `ActivityIndicator`, used while a
 * screen's primary data is still loading.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ size = 96, fullscreen = true }) => {
  return (
    <View style={fullscreen ? styles.fullscreen : styles.inline}>
      <LottieView
        source={require('@/assets/lottie/loading-dots.json')}
        autoPlay
        loop
        style={{ width: size, height: size * 0.625 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
});

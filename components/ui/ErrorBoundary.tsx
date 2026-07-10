import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface Props {
  children: ReactNode;
  /** Optional fallback — defaults to the built-in recovery screen. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary] Uncaught error:', error.message, info.componentStack);
    }
    // TODO: send to Sentry / Firebase Crashlytics
    // Crashlytics.recordError(error);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return <ErrorFallback error={this.state.error} onReset={this.reset} />;
  }
}

// ─── Default recovery screen ──────────────────────────────────────────────────

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <View style={s.root}>
      <View style={s.iconWrap}>
        <Ionicons name="warning-outline" size={40} color={Colors.danger} />
      </View>
      <Text style={s.title}>Something went wrong</Text>
      <Text style={s.subtitle}>
        An unexpected error occurred. Your data is safe — tap below to reload this screen.
      </Text>
      {__DEV__ && error && (
        <View style={s.devBox}>
          <Text style={s.devText} numberOfLines={6}>
            {error.message}
          </Text>
        </View>
      )}
      <TouchableOpacity style={s.btn} onPress={onReset} activeOpacity={0.85}>
        <Ionicons name="refresh-outline" size={16} color="#fff" />
        <Text style={s.btnText}>Reload screen</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  devBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  devText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.danger,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: '#fff',
  },
});

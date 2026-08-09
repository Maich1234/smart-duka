import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { getWebviewToken } from '@/services/auth';
import { WEB_URL } from '@/constants/config';
import { Colors } from '@/constants/Colors';

/**
 * Empty native shell (header + back button) hosting the real Setup Guide
 * content from smart-duka-web, loaded via WebView rather than built as more
 * native screens — the guide's explanations and layout live in one place
 * (web) instead of being duplicated across platforms.
 *
 * Auth handoff: mints a short-lived, single-purpose token (GET
 * /setup/status is the only endpoint that accepts it) rather than passing
 * the real session token into the page — see backend utils/webviewToken.js.
 */
export default function SetupGuideScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWebviewToken()
      .then(({ token }) => {
        if (!cancelled) setUri(`${WEB_URL}/embed/setup-guide?token=${encodeURIComponent(token)}`);
      })
      .catch(() => {
        if (!cancelled) router.back();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => {
    if (canGoBack) webViewRef.current?.goBack();
    else router.back();
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message?.type === 'navigate' && typeof message.route === 'string') {
        router.replace(message.route as Parameters<typeof router.replace>[0]);
      }
    } catch {
      // Ignore malformed messages rather than crash the screen.
    }
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Setup Guide" onBack={handleBack} />
      {uri ? (
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.flex}
          // Confines navigation to our own web origin — the page carries a
          // scoped auth token in its URL, so an off-domain redirect (a stray
          // link on the guide page, a compromised ad, etc.) must not be able
          // to load third-party content inside this authenticated WebView.
          originWhitelist={[`${WEB_URL}/*`]}
          onNavigationStateChange={(nav: WebViewNavigation) => setCanGoBack(nav.canGoBack)}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => <LoadingState fullscreen />}
        />
      ) : (
        <LoadingState fullscreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
});

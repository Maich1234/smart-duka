import * as WebBrowser from 'expo-web-browser';

/**
 * Opens a URL in an in-app browser tab (Chrome Custom Tabs / SFSafariViewController)
 * instead of handing off to a separate browser app — the user never feels like they
 * left Dukana. Every outbound link to smart-duka-web (Help Center, legal docs,
 * contact form, notification actions) should go through this rather than
 * `Linking.openURL`.
 */
export function openWebPage(url: string) {
  // createTask: false keeps Custom Tabs in the app's own task on Android —
  // without it, the browser opens as a separate entry in the recents/app
  // switcher, breaking the in-app feel.
  WebBrowser.openBrowserAsync(url, { createTask: false });
}

/**
 * Pre-warms the Custom Tabs process (Android only — a no-op elsewhere) so the
 * first `openWebPage` call from a screen feels instant rather than showing a
 * cold-start flash. Call on mount of a screen that hosts several external
 * links (e.g. Profile), and `coolDownWebBrowser` on unmount.
 */
export function warmUpWebBrowser() {
  WebBrowser.warmUpAsync();
}

export function coolDownWebBrowser() {
  WebBrowser.coolDownAsync();
}

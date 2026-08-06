import { useEffect } from 'react';
import { warmUpWebBrowser, coolDownWebBrowser } from '@/utils/openWebPage';

/**
 * Pre-warms the in-app browser for screens that host several outbound links
 * (Help, Legal, Support) so the first tap opens instantly instead of showing
 * a cold-start flash. No-op on iOS/web — Android Custom Tabs only.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    warmUpWebBrowser();
    return () => coolDownWebBrowser();
  }, []);
}

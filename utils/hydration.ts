// Zustand's persist middleware hydrates AsyncStorage/SecureStore asynchronously,
// so code that reads a persisted store right after mount can see the initial
// (signed-out, onboarding-not-completed) defaults instead of the real state.
// Await this before making routing decisions off persisted state.

interface PersistApi {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: (state: unknown) => void) => () => void;
}

/** Max time to wait — a broken storage layer must never strand the splash screen. */
const HYDRATION_TIMEOUT_MS = 3000;

export const waitForHydration = (...stores: { persist: PersistApi }[]): Promise<void[]> =>
  Promise.all(
    stores.map(({ persist }) => {
      if (persist.hasHydrated()) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          unsubscribe();
          resolve();
        }, HYDRATION_TIMEOUT_MS);
        const unsubscribe = persist.onFinishHydration(() => {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        });
      });
    })
  );

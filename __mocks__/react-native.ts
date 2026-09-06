// Minimal stand-in for the slice of react-native the offline-first data layer
// touches (Platform.OS branching in secureStorage.ts/offlineDb.ts, AppState
// listeners in offlineManager.ts). Not a general RN mock — component tests
// need jest-expo instead.
export const Platform = {
  OS: 'ios' as const,
  select: <T extends Record<string, unknown>>(obj: T) => obj.ios ?? obj.default,
};

export const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

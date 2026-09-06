// Controllable NetInfo mock. Tests drive connectivity with __setState /
// __setFetchResult; production code only ever sees `.fetch()` and
// `.addEventListener()`, matching the real module's shape.
export type MockNetInfoState = { isConnected: boolean | null };

type Listener = (state: MockNetInfoState) => void;

let currentState: MockNetInfoState = { isConnected: true };
const listeners = new Set<Listener>();

const fetchMock = jest.fn(async (): Promise<MockNetInfoState> => currentState);

const NetInfo = {
  fetch: fetchMock,
  addEventListener: jest.fn((listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }),
};

/** Sets the state every future `.fetch()` resolves to, and fires listeners. */
export function __setState(state: MockNetInfoState): void {
  currentState = state;
  listeners.forEach((l) => l(state));
}

/** Resets to the default (online, no listeners) — call between tests. */
export function __resetNetInfo(): void {
  currentState = { isConnected: true };
  listeners.clear();
  fetchMock.mockClear();
}

export default NetInfo;

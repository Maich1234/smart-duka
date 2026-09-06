import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { __setState } from '@react-native-community/netinfo';
import api from '@/services/api';
import { getPendingCount } from '@/utils/offlineQueue';
import { API_BASE_URL } from '@/constants/config';
import { resetAllTestState } from '../testUtils';

// api.ts builds its own axios instance via axios.create(); binding the mock
// adapter to the SAME instance is what lets it intercept api.get/api.post.
const mock = new MockAdapter(api);
// tokenRefresh.ts uses a bare axios.post(...), a separate instance.
const rawMock = new MockAdapter(axios);

describe('services/api interceptors', () => {
  beforeEach(() => {
    resetAllTestState();
    mock.reset();
    rawMock.reset();
  });

  afterAll(() => {
    mock.restore();
    rawMock.restore();
  });

  it('queues a non-GET write instead of hanging when the device is offline (airplane mode)', async () => {
    __setState({ isConnected: false });

    await expect(api.post('/expenses', { amount: 500 })).rejects.toMatchObject({ offlineQueued: true });

    expect(mock.history.post.length).toBe(0); // never dispatched
    expect(getPendingCount()).toBe(1);
  });

  it('never pre-flight-blocks a GET request while offline', async () => {
    __setState({ isConnected: false });
    mock.onGet('/expenses').reply(200, { success: true, data: [] });

    const res = await api.get('/expenses');
    expect(res.data.success).toBe(true);
  });

  it('queues retroactively when the pre-flight check says online but the request then times out mid-flight', async () => {
    __setState({ isConnected: true });
    mock.onPost('/expenses').networkError();

    await expect(api.post('/expenses', { amount: 500 })).rejects.toMatchObject({ offlineQueued: true });
    expect(getPendingCount()).toBe(1);
  });

  it('a request that resolves normally is never queued', async () => {
    mock.onPost('/expenses').reply(201, { success: true, data: { _id: 'e1' } });

    const res = await api.post('/expenses', { amount: 500 });
    expect(res.data.data._id).toBe('e1');
    expect(getPendingCount()).toBe(0);
  });

  it('REALTIME_ONLY endpoints fail fast offline instead of queuing', async () => {
    __setState({ isConnected: false });

    await expect(api.post('/mpesa/initiate', { phoneNumber: '+254712345678', amount: 100 }))
      .rejects.toMatchObject({ offlineRealtime: true });

    expect(getPendingCount()).toBe(0);
  });

  it('NEVER_QUEUE (auth) requests are exempt from the offline pre-flight block and still attempt the request', async () => {
    __setState({ isConnected: false });
    mock.onPost('/auth/login').reply(200, { success: true, data: { token: 't', user: {} } });

    const res = await api.post('/auth/login', { email: 'a@a.com', password: 'x' });
    expect(res.data.success).toBe(true);
    expect(getPendingCount()).toBe(0);
  });

  it('a genuinely unreachable auth request surfaces a plain connection error, never a queued one', async () => {
    __setState({ isConnected: false });
    mock.onPost('/auth/login').networkError();

    await expect(api.post('/auth/login', { email: 'a@a.com', password: 'x' }))
      .rejects.toMatchObject({ message: expect.stringContaining('No internet connection') });
    expect(getPendingCount()).toBe(0);
  });

  it('refreshes the access token once on a 401 and transparently replays the original request', async () => {
    let calls = 0;
    mock.onPost('/expenses').reply(() => {
      calls += 1;
      return calls === 1 ? [401, { message: 'expired' }] : [201, { success: true, data: { _id: 'e1' } }];
    });
    rawMock.onPost(`${API_BASE_URL}/auth/refresh`).reply(200, {
      data: { token: 'new-token', refreshToken: 'new-refresh' },
    });

    const res = await api.post('/expenses', { amount: 500 });
    expect(calls).toBe(2);
    expect(res.data.data._id).toBe('e1');
  });
});

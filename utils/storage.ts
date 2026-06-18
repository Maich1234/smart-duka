import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@smart_duka_token';
const USER_KEY = '@smart_duka_user';

/**
 * Store authentication token
 */
export const storeToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store token', error);
  }
};

/**
 * Get authentication token
 */
export const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get token', error);
    return null;
  }
};

/**
 * Remove authentication token
 */
export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to remove token', error);
  }
};

/**
 * Store user data
 */
export const storeUser = async (user: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to store user', error);
  }
};

/**
 * Get user data
 */
export const getUser = async (): Promise<any | null> => {
  try {
    const user = await AsyncStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Failed to get user', error);
    return null;
  }
};

/**
 * Remove user data
 */
export const removeUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Failed to remove user', error);
  }
};

/**
 * Clear all authentication data
 */
export const clearAll = async (): Promise<void> => {
  await removeToken();
  await removeUser();
};
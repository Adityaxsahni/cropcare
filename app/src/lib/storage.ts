import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  settings: 'cropcare.settings.v1',
  history: 'cropcare.history.v1',
  queue: 'cropcare.queue.v1',
  installId: 'cropcare.installId.v1',
  advice: 'cropcare.advice.v1',
} as const;

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

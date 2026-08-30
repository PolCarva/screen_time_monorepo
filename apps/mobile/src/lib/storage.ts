import Storage from "expo-sqlite/kv-store";

export const localStorage = Storage;

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const value = await localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function setJson(key: string, value: unknown) {
  await localStorage.setItem(key, JSON.stringify(value));
}

export async function clearLocalStorage() {
  await localStorage.clear();
}

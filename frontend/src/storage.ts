// localStorage can throw (private mode, blocked site data); never let that break the UI.
const PREFIX = 'minirag:'

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(PREFIX + key, value)
    } catch {
      /* ignore */
    }
  },
  getJSON<T>(key: string): T | null {
    const raw = storage.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },
  setJSON(key: string, value: unknown) {
    storage.set(key, JSON.stringify(value))
  },
}

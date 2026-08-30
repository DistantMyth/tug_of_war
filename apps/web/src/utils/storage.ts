/**
 * Safe localStorage wrapper that gracefully handles SSR, Node.js 22 experimental storage,
 * and environments without window/localStorage.
 */
export function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function safeRemoveStorage(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.removeItem === "function") {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors
  }
}

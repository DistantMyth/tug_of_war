/**
 * Frontend Environment and URL Configuration
 *
 * Resolves API and WebSocket URLs using VITE_API_URL and VITE_SOCKET_URL,
 * with fallback to localhost in development.
 */

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:3001`;
}

export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function getSocketUrl(): string {
  const envUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    const base = envUrl.trim().replace(/\/+$/, "");
    return base.endsWith("/game") ? base : `${base}/game`;
  }

  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:3001/game`;
}

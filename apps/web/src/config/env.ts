/**
 * Frontend Environment and URL Configuration
 *
 * Resolves API and WebSocket URLs using VITE_API_URL and VITE_SOCKET_URL,
 * with fallback to localhost in development.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // When running Vite dev server on port 5173, backend is on port 3001
    if (window.location.port === "5173") {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      return `${protocol}//${window.location.hostname}:3001`;
    }
    // When accessed via tunnel, reverse proxy, LAN IP, or production server, always use current origin
    return window.location.origin;
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  return "http://localhost:3001";
}

export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function getSocketUrl(): string {
  if (typeof window !== "undefined") {
    // When running Vite dev server on port 5173, backend is on port 3001
    if (window.location.port === "5173") {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      return `${protocol}//${window.location.hostname}:3001/game`;
    }
    // When accessed via tunnel, reverse proxy, LAN IP, or production server, always use current origin
    return `${window.location.origin}/game`;
  }

  const envUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    const base = envUrl.trim().replace(/\/+$/, "");
    return base.endsWith("/game") ? base : `${base}/game`;
  }

  return "http://localhost:3001/game";
}

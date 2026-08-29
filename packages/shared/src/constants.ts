export const DEFAULT_ROUND_DURATION_MS = 30_000;
export const DEFAULT_COUNTDOWN_MS = 3_000;
export const DEFAULT_BALANCING_TIMEOUT_MS = 20_000;
export const DEFAULT_DISCONNECT_GRACE_MS = 120_000;
export const DEFAULT_TAP_RATE_PER_SEC = 10;
export const DEFAULT_TAP_BURST = 15;
export const SCORE_BROADCAST_HZ = 10;
export const EXTEND_SECONDS = [5, 10, 15] as const;
export type ExtendSeconds = (typeof EXTEND_SECONDS)[number];

export const SOCKET_NAMESPACES = {
  game: "/game",
  admin: "/admin",
} as const;

export const SOCKET_ROLES = {
  player: "player",
  display: "display",
} as const;

export type SocketRole = (typeof SOCKET_ROLES)[keyof typeof SOCKET_ROLES];

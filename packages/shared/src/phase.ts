export const GAME_PHASES = [
  "WAITING",
  "OPEN",
  "LOCKING",
  "BALANCING",
  "COUNTDOWN",
  "RUNNING",
  "PAUSED",
  "FINISHED",
  "RESULTS",
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

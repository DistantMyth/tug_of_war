import type { GamePhase, PlayerRole, PlayerStatus, TeamId, Winner } from "@tow/shared";
import type { BalanceMove, BalancePlanStatus } from "../../engine/balance/types.js";

export type StoredGameState = {
  gameId: string;
  phase: GamePhase;
  roundNumber: number;
  createdAt: number;
  durationMs: number;
  startTime: number | null;
  endTime: number | null;
  pausedAt: number | null;
  pauseAccumMs: number;
  countdownEndsAt: number | null;
  winner: Winner | null;
  joinAllowed: boolean;
};

export type StoredPlayer = {
  playerId: string;
  label: string;
  team: PlayerRole | null;
  wildcard: boolean;
  status: PlayerStatus;
  joinedAt: number;
  lastSeen: number;
};

export type StoredBalancePlan = {
  targetLeft: number;
  targetRight: number;
  wildcardNeeded: 0 | 1;
  needLeftToRight: number;
  needRightToLeft: number;
  remainingLeftToRight: number;
  remainingRightToLeft: number;
  wildcardPlayerId: string | null;
  wildcardApplied: boolean;
  status: BalancePlanStatus;
};

export type StoredCounts = {
  total: number;
  left: number;
  right: number;
  chaos: number;
  online: number;
  offline: number;
};

export type StoredPublicState = {
  sessionId: string;
  phase: GamePhase;
  roundNumber: number;
  counts: StoredCounts;
  scores: {
    left: number;
    right: number;
    seq: number;
    at: number;
  };
  timing: {
    durationMs: number;
    startTime: number | null;
    endTime: number | null;
    pausedAt: number | null;
    pauseAccumMs: number;
    countdownEndsAt: number | null;
    serverNow: number;
  };
  plan: {
    targetLeft: number;
    targetRight: number;
    needLeftToRight: number;
    needRightToLeft: number;
    chaosNeeded: boolean;
    remainingLeftToRight: number;
    remainingRightToLeft: number;
    remainingMs: number | null;
  } | null;
  winner: Winner | null;
  chaosPlayerId: string | null;
  chaosLabel: string | null;
};

export type RepositoryErrorCode =
  | "GAME_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "INVALID_PHASE"
  | "INVALID_TEAM"
  | "PLAYER_ALREADY_ON_TEAM"
  | "WILDCARD_NOT_ALLOWED"
  | "WILDCARD_ALREADY_ASSIGNED"
  | "MOVE_NOT_ALLOWED"
  | "MOVE_WOULD_OVERSHOOT"
  | "BALANCE_INCOMPLETE"
  | "CONCURRENT_MODIFICATION"
  | "RATE_LIMITED"
  | "REDIS_ERROR"
  | "SERIALIZATION_ERROR";

export type RepositoryError = {
  code: RepositoryErrorCode;
  message: string;
  retryAfterMs?: number;
};

export type RepositorySuccess<T> = {
  ok: true;
  value: T;
};

export type RepositoryFailure = {
  ok: false;
  error: RepositoryError;
};

export type RepositoryResult<T> = RepositorySuccess<T> | RepositoryFailure;

export type ChooseOrSwitchResult = {
  previousTeam: TeamId | "chaos" | null;
  newTeam: TeamId;
  counts: StoredCounts;
};

export type LockAndSnapshotResult = {
  phase: "LOCKING";
  leftCount: number;
  rightCount: number;
  wildcardCount: number;
  totalPlayers: number;
  onlineCount: number;
  roster: { playerId: string; team: PlayerRole }[];
};

export type VolunteerMoveAtomicResult = {
  move: BalanceMove;
  remainingLeftToRight: number;
  remainingRightToLeft: number;
  status: BalancePlanStatus;
  counts: StoredCounts;
};

export type WildcardAtomicResult = {
  move: BalanceMove;
  wildcardPlayerId: string;
  status: BalancePlanStatus;
  counts: StoredCounts;
};

export type AutoBalanceAtomicResult = {
  movesApplied: number;
  status: "complete";
  counts: StoredCounts;
};

export type TapIncrementResult = {
  team: TeamId;
  newScore: number;
  scores: { left: number; right: number };
  seq: number;
};

export type StartRunningResult = {
  phase: "RUNNING";
  startTime: number;
  endTime: number;
  durationMs: number;
};

export type PauseResult = {
  phase: "PAUSED";
  pausedAt: number;
};

export type ResumeResult = {
  phase: "RUNNING";
  startTime: number | null;
  endTime: number;
  pausedAt: null;
  pauseAccumMs: number;
  durationMs: number;
};

export type ExtendResult = {
  seconds: number;
  endTime: number;
  serverNow: number;
};

export type FinishResult = {
  phase: "FINISHED";
  left: number;
  right: number;
  winner: Winner;
  roundNumber: number;
};

export type NextRoundResult = {
  phase: "COUNTDOWN";
  roundNumber: number;
  countdownEndsAt: number;
  durationMs: number;
  counts: StoredCounts;
};

export type RateLimitResult = {
  allowed: boolean;
  current: number;
  maxAllowed: number;
  retryAfterMs?: number;
};

import type { ExtendSeconds } from "./constants.js";
import type { GamePhase } from "./phase.js";
import type { PlayerRole, PlayerStatus, TeamId, Winner } from "./teams.js";

export type PlayerHelloPayload = {
  token?: string;
};

export type ChooseTeamPayload = {
  team: TeamId;
};

export type SwitchTeamPayload = {
  team: TeamId;
};

export type TapPayload = Record<string, never>;

export type RequestSyncPayload = Record<string, never>;

export type AdminOpenPayload = {
  durationMs?: number;
};

export type AdminConfirmPayload = {
  confirm: true;
};

export type AdminAutoBalancePayload = {
  preview?: boolean;
  confirm?: true;
};

export type AdminSetWildcardPayload = {
  playerId: string;
};

export type AdminExtendPayload = {
  seconds: ExtendSeconds;
};

export type GameCounts = {
  left: number;
  right: number;
  chaos: number;
  total: number;
  online: number;
  offline: number;
};

export type BalancePlanView = {
  targetLeft: number;
  targetRight: number;
  needLeftToRight: number;
  needRightToLeft: number;
  chaosNeeded: boolean;
  remainingLeftToRight: number;
  remainingRightToLeft: number;
  remainingMs: number | null;
};

export type TimingView = {
  durationMs: number;
  startTime: number | null;
  endTime: number | null;
  pausedAt: number | null;
  pauseAccumMs: number;
  countdownEndsAt: number | null;
  serverNow: number;
};

export type ScoreView = {
  left: number;
  right: number;
  seq: number;
  at: number;
};

export type YouView = {
  playerId: string;
  label: string;
  team: TeamId | null;
  chaos: boolean;
  status: PlayerStatus;
  role: PlayerRole | null;
};

export type PublicState = {
  sessionId: string | null;
  phase: GamePhase | null;
  roundNumber: number;
  counts: GameCounts;
  scores: ScoreView;
  timing: TimingView;
  plan: BalancePlanView | null;
  winner: Winner | null;
  chaosPlayerId: string | null;
  chaosLabel: string | null;
};

export type PhaseEventPayload = {
  phase: GamePhase;
  at: number;
};

export type ScoreEventPayload = ScoreView;

export type TimeEventPayload = TimingView;

export type ExtendedEventPayload = {
  seconds: ExtendSeconds;
  endTime: number;
  serverNow: number;
};

export type FinishedEventPayload = {
  left: number;
  right: number;
  winner: Winner;
  roundNumber: number;
};

export type DisplaySyncPayload = {
  public: PublicState;
};

export type SyncPayload = {
  public: PublicState;
  you: YouView;
};


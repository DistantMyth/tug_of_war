import type { PlayerRole, TeamId } from "@tow/shared";

export type BalancerPlayer = {
  playerId: string;
  team: PlayerRole;
};

export type Roster = {
  players: readonly BalancerPlayer[];
};

export type RosterCounts = {
  total: number;
  left: number;
  right: number;
  chaos: number;
};

export type BalanceTarget = {
  totalPlayers: number;
  playablePlayers: number;
  targetLeft: number;
  targetRight: number;
  wildcardNeeded: 0 | 1;
};

export type MoveReason = "volunteer" | "auto" | "host" | "wildcard";

export type TeamSwitchMove = {
  kind: "team_switch";
  playerId: string;
  from: TeamId;
  to: TeamId;
  reason: Extract<MoveReason, "volunteer" | "auto">;
  sequence: number;
};

export type WildcardMove = {
  kind: "wildcard";
  playerId: string;
  from: TeamId;
  to: "chaos";
  reason: Extract<MoveReason, "wildcard" | "auto" | "host">;
  sequence: number;
};

export type BalanceMove = TeamSwitchMove | WildcardMove;

export type BalancePlanStatus = "complete" | "needs_moves" | "needs_wildcard";

export type BalancePlan = {
  target: BalanceTarget;
  needLeftToRight: number;
  needRightToLeft: number;
  remainingLeftToRight: number;
  remainingRightToLeft: number;
  wildcardNeeded: 0 | 1;
  wildcardPlayerId: string | null;
  wildcardApplied: boolean;
  moves: readonly BalanceMove[];
  status: BalancePlanStatus;
};

export type BalancerEventType =
  | "BALANCE_PLAN_CREATED"
  | "VOLUNTEER_MOVE_ACCEPTED"
  | "AUTO_BALANCE_PLANNED"
  | "WILDCARD_SELECTED"
  | "BALANCE_COMPLETED";

export type BalancerEvent = {
  type: BalancerEventType;
};

export type BalancerErrorCode =
  | "EMPTY_ROSTER"
  | "PLAYER_NOT_FOUND"
  | "INVALID_TEAM"
  | "INVALID_WILDCARD"
  | "WILDCARD_ALREADY_ASSIGNED"
  | "MOVE_NOT_ALLOWED"
  | "MOVE_WOULD_OVERSHOOT"
  | "BALANCE_NOT_REQUIRED"
  | "BALANCE_INCOMPLETE"
  | "INVALID_BALANCE_PLAN";

export type BalancerError = {
  code: BalancerErrorCode;
  message: string;
};

export type BalancerSuccess<T> = {
  ok: true;
  value: T;
  events: BalancerEvent[];
};

export type BalancerFailure = {
  ok: false;
  error: BalancerError;
};

export type BalancerResult<T> = BalancerSuccess<T> | BalancerFailure;

export type PlanWithRoster = {
  roster: Roster;
  plan: BalancePlan;
};

export type AutoBalancePreview = {
  wildcardPlayerId: string | null;
  moves: readonly BalanceMove[];
  finalCounts: RosterCounts;
  remainingLeftToRight: 0;
  remainingRightToLeft: 0;
  reason: "auto";
};

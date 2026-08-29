import type { GamePhase, PlayerStatus, TeamId, Winner } from "@tow/shared";
import type { BalanceMove, BalancePlanStatus } from "../../engine/balance/types.js";
import type { StoredBalancePlan, StoredGameState, StoredPlayer } from "./types.js";

export function serializePlayer(player: StoredPlayer): string {
  return JSON.stringify(player);
}

export function deserializePlayer(raw: string | null | undefined): StoredPlayer | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || typeof data.playerId !== "string") {
      return null;
    }
    return {
      playerId: data.playerId,
      label: typeof data.label === "string" ? data.label : data.playerId,
      team: (data.team === "left" || data.team === "right" || data.team === "chaos") ? data.team : null,
      wildcard: Boolean(data.wildcard),
      status: (data.status === "online" || data.status === "offline" || data.status === "abandoned")
        ? data.status
        : "online",
      joinedAt: typeof data.joinedAt === "number" ? data.joinedAt : Date.now(),
      lastSeen: typeof data.lastSeen === "number" ? data.lastSeen : Date.now(),
    };
  } catch {
    return null;
  }
}

export function serializeGameState(state: StoredGameState): Record<string, string> {
  return {
    gameId: state.gameId,
    phase: state.phase,
    roundNumber: String(state.roundNumber),
    createdAt: String(state.createdAt),
    durationMs: String(state.durationMs),
    startTime: state.startTime !== null ? String(state.startTime) : "",
    endTime: state.endTime !== null ? String(state.endTime) : "",
    pausedAt: state.pausedAt !== null ? String(state.pausedAt) : "",
    pauseAccumMs: String(state.pauseAccumMs),
    countdownEndsAt: state.countdownEndsAt !== null ? String(state.countdownEndsAt) : "",
    winner: state.winner ?? "",
    joinAllowed: state.joinAllowed ? "true" : "false",
  };
}

export function deserializeGameState(hash: Record<string, string> | null | undefined): StoredGameState | null {
  if (!hash || !hash.gameId || !hash.phase) {
    return null;
  }
  return {
    gameId: hash.gameId,
    phase: hash.phase as GamePhase,
    roundNumber: parseInt(hash.roundNumber || "0", 10) || 0,
    createdAt: parseInt(hash.createdAt || "0", 10) || Date.now(),
    durationMs: parseInt(hash.durationMs || "30000", 10) || 30000,
    startTime: hash.startTime && hash.startTime !== "" ? parseInt(hash.startTime, 10) : null,
    endTime: hash.endTime && hash.endTime !== "" ? parseInt(hash.endTime, 10) : null,
    pausedAt: hash.pausedAt && hash.pausedAt !== "" ? parseInt(hash.pausedAt, 10) : null,
    pauseAccumMs: parseInt(hash.pauseAccumMs || "0", 10) || 0,
    countdownEndsAt: hash.countdownEndsAt && hash.countdownEndsAt !== "" ? parseInt(hash.countdownEndsAt, 10) : null,
    winner: (hash.winner === "left" || hash.winner === "right" || hash.winner === "draw") ? (hash.winner as Winner) : null,
    joinAllowed: hash.joinAllowed === "true",
  };
}

export function serializeBalancePlan(plan: StoredBalancePlan): Record<string, string> {
  return {
    targetLeft: String(plan.targetLeft),
    targetRight: String(plan.targetRight),
    wildcardNeeded: String(plan.wildcardNeeded),
    needLeftToRight: String(plan.needLeftToRight),
    needRightToLeft: String(plan.needRightToLeft),
    remainingLeftToRight: String(plan.remainingLeftToRight),
    remainingRightToLeft: String(plan.remainingRightToLeft),
    wildcardPlayerId: plan.wildcardPlayerId ?? "",
    wildcardApplied: plan.wildcardApplied ? "1" : "0",
    status: plan.status,
  };
}

export function deserializeBalancePlan(hash: Record<string, string> | null | undefined): StoredBalancePlan | null {
  if (!hash || typeof hash.targetLeft === "undefined" || !hash.status) {
    return null;
  }
  return {
    targetLeft: parseInt(hash.targetLeft || "0", 10) || 0,
    targetRight: parseInt(hash.targetRight || "0", 10) || 0,
    wildcardNeeded: (parseInt(hash.wildcardNeeded || "0", 10) === 1 ? 1 : 0) as 0 | 1,
    needLeftToRight: parseInt(hash.needLeftToRight || "0", 10) || 0,
    needRightToLeft: parseInt(hash.needRightToLeft || "0", 10) || 0,
    remainingLeftToRight: parseInt(hash.remainingLeftToRight || "0", 10) || 0,
    remainingRightToLeft: parseInt(hash.remainingRightToLeft || "0", 10) || 0,
    wildcardPlayerId: hash.wildcardPlayerId && hash.wildcardPlayerId !== "" ? hash.wildcardPlayerId : null,
    wildcardApplied: hash.wildcardApplied === "1" || hash.wildcardApplied === "true",
    status: hash.status as BalancePlanStatus,
  };
}

export function serializeMove(move: BalanceMove): string {
  return JSON.stringify(move);
}

export function deserializeMove(raw: string | null | undefined): BalanceMove | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.playerId || !data.kind) {
      return null;
    }
    return data as BalanceMove;
  } catch {
    return null;
  }
}

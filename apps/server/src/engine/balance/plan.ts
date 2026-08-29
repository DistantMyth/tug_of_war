import type { TeamId } from "@tow/shared";
import { balancerError } from "./errors.js";
import { countRoster, findPlayer, uniqueIds } from "./roster.js";
import { calculateBalanceTarget } from "./target.js";
import type { BalancePlan, BalancePlanStatus, BalancerResult, Roster } from "./types.js";
import { chooseWildcardCandidate, teamSwitchCount } from "./wildcard.js";

function needs(left: number, right: number, targetLeft: number, targetRight: number): {
  needLeftToRight: number;
  needRightToLeft: number;
} {
  return {
    needLeftToRight: Math.max(0, left - targetLeft),
    needRightToLeft: Math.max(0, right - targetRight),
  };
}

function statusOf(plan: Omit<BalancePlan, "status" | "moves"> & { moves?: BalancePlan["moves"] }): BalancePlanStatus {
  if (plan.remainingLeftToRight > 0 || plan.remainingRightToLeft > 0) {
    return "needs_moves";
  }
  if (plan.wildcardNeeded === 1 && !plan.wildcardApplied) {
    return "needs_wildcard";
  }
  return "complete";
}

export function derivePlanFromRoster(roster: Roster, wildcardPlayerId: string | null): BalancerResult<BalancePlan> {
  if (!uniqueIds(roster)) {
    return balancerError("INVALID_BALANCE_PLAN", "Roster contains duplicate player IDs");
  }

  for (const player of roster.players) {
    if (player.team !== "left" && player.team !== "right" && player.team !== "chaos") {
      return balancerError("INVALID_TEAM", `Player ${player.playerId} has invalid team: ${player.team}`);
    }
  }

  const counts = countRoster(roster);
  const targetResult = calculateBalanceTarget(counts.total);
  if (!targetResult.ok) {
    return targetResult;
  }
  const target = targetResult.value;

  if (target.wildcardNeeded === 0 && wildcardPlayerId !== null) {
    return balancerError("INVALID_WILDCARD", "Even roster does not require a CHAOS PLAYER");
  }

  const chaosPlayers = roster.players.filter((player) => player.team === "chaos");
  if (chaosPlayers.length > 1) {
    return balancerError("INVALID_WILDCARD", "Roster already has more than one CHAOS PLAYER");
  }
  if (target.wildcardNeeded === 0 && chaosPlayers.length > 0) {
    return balancerError("INVALID_WILDCARD", "Even roster must not include a CHAOS PLAYER");
  }

  const assignedChaos = chaosPlayers[0]?.playerId ?? null;
  let effectiveWildcard = wildcardPlayerId ?? assignedChaos;
  let wildcardApplied = assignedChaos !== null;

  if (target.wildcardNeeded === 1 && !effectiveWildcard) {
    effectiveWildcard = chooseWildcardCandidate(roster, target);
  }

  if (target.wildcardNeeded === 1 && !effectiveWildcard) {
    return balancerError("INVALID_WILDCARD", "No eligible CHAOS PLAYER candidate");
  }
  if (target.wildcardNeeded === 0) {
    effectiveWildcard = null;
    wildcardApplied = false;
  }

  let left = counts.left;
  let right = counts.right;
  if (effectiveWildcard && !wildcardApplied) {
    const pending = findPlayer(roster, effectiveWildcard);
    if (!pending) {
      return balancerError("PLAYER_NOT_FOUND", `CHAOS PLAYER candidate ${effectiveWildcard} is not on the roster`);
    }
    if (pending.team === "chaos") {
      return balancerError("INVALID_WILDCARD", "CHAOS PLAYER candidate is already chaos");
    }
    if (pending.team !== "left" && pending.team !== "right") {
      return balancerError("INVALID_TEAM", "CHAOS PLAYER candidate must be on LEFT or RIGHT");
    }
    if (pending.team === "left") {
      left -= 1;
    } else if (pending.team === "right") {
      right -= 1;
    }
  }

  const required = needs(left, right, target.targetLeft, target.targetRight);
  const plan: BalancePlan = {
    target,
    needLeftToRight: required.needLeftToRight,
    needRightToLeft: required.needRightToLeft,
    remainingLeftToRight: required.needLeftToRight,
    remainingRightToLeft: required.needRightToLeft,
    wildcardNeeded: target.wildcardNeeded,
    wildcardPlayerId: effectiveWildcard,
    wildcardApplied,
    moves: [],
    status: "needs_moves",
  };
  plan.status = statusOf(plan);

  if (plan.needLeftToRight > 0 && plan.needRightToLeft > 0) {
    return balancerError("INVALID_BALANCE_PLAN", "Two-team balance must not require moves in both directions");
  }

  return {
    ok: true,
    value: plan,
    events: [{ type: "BALANCE_PLAN_CREATED" }],
  };
}

export function createBalancePlan(roster: Roster): BalancerResult<BalancePlan> {
  return derivePlanFromRoster(roster, null);
}

export function copyPlan(plan: BalancePlan): BalancePlan {
  return {
    ...plan,
    target: { ...plan.target },
    moves: plan.moves.map((move) => ({ ...move })),
  };
}

export function surplusTeam(plan: BalancePlan): TeamId | null {
  if (plan.remainingLeftToRight > 0) {
    return "left";
  }
  if (plan.remainingRightToLeft > 0) {
    return "right";
  }
  return null;
}

export function deficitTeam(plan: BalancePlan): TeamId | null {
  const surplus = surplusTeam(plan);
  if (surplus === "left") {
    return "right";
  }
  if (surplus === "right") {
    return "left";
  }
  return null;
}

export function refreshRemaining(plan: BalancePlan, left: number, right: number): BalancePlan {
  const required = needs(left, right, plan.target.targetLeft, plan.target.targetRight);
  const next = copyPlan(plan);
  next.remainingLeftToRight = required.needLeftToRight;
  next.remainingRightToLeft = required.needRightToLeft;
  next.status = statusOf(next);
  return next;
}

export { teamSwitchCount };

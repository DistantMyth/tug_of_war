import type { TeamId } from "@tow/shared";
import { balancerError } from "./errors.js";
import { copyPlan, deficitTeam, surplusTeam } from "./plan.js";
import { cloneRoster, countRoster, playersOn, replacePlayer, sortedPlayerIds } from "./roster.js";
import type {
  AutoBalancePreview,
  BalanceMove,
  BalancePlan,
  BalancerResult,
  PlanWithRoster,
  Roster,
} from "./types.js";

function effectiveTeamPlayers(roster: Roster, plan: BalancePlan, team: TeamId) {
  return playersOn(roster, team).filter((player) => player.playerId !== plan.wildcardPlayerId);
}

function wildcardFrom(roster: Roster, playerId: string): TeamId | null {
  if (playersOn(roster, "left").some((player) => player.playerId === playerId)) {
    return "left";
  }
  if (playersOn(roster, "right").some((player) => player.playerId === playerId)) {
    return "right";
  }
  return null;
}

function buildAutoMoves(roster: Roster, plan: BalancePlan): BalancerResult<BalanceMove[]> {
  const moves: BalanceMove[] = [];
  let sequence = plan.moves.length;
  const next = copyPlan(plan);
  const from = surplusTeam(next);
  const to = deficitTeam(next);
  const remaining = from === "left" ? next.remainingLeftToRight : from === "right" ? next.remainingRightToLeft : 0;

  if (from && to && remaining > 0) {
    const eligibleIds = sortedPlayerIds(effectiveTeamPlayers(roster, next, from));
    if (eligibleIds.length < remaining) {
      return balancerError("BALANCE_INCOMPLETE", "Not enough eligible surplus players for automatic balance");
    }
    for (let i = 0; i < remaining; i += 1) {
      const playerId = eligibleIds[i];
      if (!playerId) {
        return balancerError("BALANCE_INCOMPLETE", "Automatic mover list is short");
      }
      sequence += 1;
      moves.push({
        kind: "team_switch",
        playerId,
        from,
        to,
        reason: "auto",
        sequence,
      });
    }
  }

  if (next.wildcardNeeded === 1 && next.wildcardPlayerId && !next.wildcardApplied) {
    const wildcardSide = wildcardFrom(roster, next.wildcardPlayerId);
    if (!wildcardSide) {
      return balancerError("INVALID_WILDCARD", "Automatic CHAOS PLAYER is not on LEFT or RIGHT");
    }
    sequence += 1;
    moves.push({
      kind: "wildcard",
      playerId: next.wildcardPlayerId,
      from: wildcardSide,
      to: "chaos",
      reason: "auto",
      sequence,
    });
  }

  return { ok: true, value: moves, events: [{ type: "AUTO_BALANCE_PLANNED" }] };
}

function applyMoves(roster: Roster, moves: readonly BalanceMove[]): Roster {
  let next = cloneRoster(roster);
  for (const move of moves) {
    next = replacePlayer(next, move.playerId, move.to);
  }
  return next;
}

/**
 * Preview only. Redis must later apply the same ordered playerIds atomically
 * (SMOVE / chaos set update) so two confirmations cannot diverge.
 */
export function previewAutoBalance(roster: Roster, plan: BalancePlan): BalancerResult<AutoBalancePreview> {
  const built = buildAutoMoves(roster, plan);
  if (!built.ok) {
    return built;
  }
  const applied = applyMoves(roster, built.value);
  const finalCounts = countRoster(applied);
  return {
    ok: true,
    value: {
      wildcardPlayerId: plan.wildcardPlayerId,
      moves: built.value,
      finalCounts,
      remainingLeftToRight: 0,
      remainingRightToLeft: 0,
      reason: "auto",
    },
    events: built.events,
  };
}

export function applyAutoBalance(roster: Roster, plan: BalancePlan): BalancerResult<PlanWithRoster> {
  const preview = previewAutoBalance(roster, plan);
  if (!preview.ok) {
    return preview;
  }

  const nextRoster = applyMoves(roster, preview.value.moves);
  const nextPlan = copyPlan(plan);
  nextPlan.moves = [...nextPlan.moves, ...preview.value.moves];
  nextPlan.remainingLeftToRight = 0;
  nextPlan.remainingRightToLeft = 0;
  nextPlan.wildcardApplied = nextPlan.wildcardNeeded === 1;
  nextPlan.status = "complete";

  return {
    ok: true,
    value: { roster: nextRoster, plan: nextPlan },
    events: [...preview.events, { type: "BALANCE_COMPLETED" }],
  };
}

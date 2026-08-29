import type { GamePhase } from "@tow/shared";
import { balancerError } from "./errors.js";
import { copyPlan, deficitTeam, surplusTeam } from "./plan.js";
import { cloneRoster, findPlayer, replacePlayer } from "./roster.js";
import type { BalanceMove, BalancePlan, BalancerEvent, BalancerResult, PlanWithRoster, Roster } from "./types.js";

export type VolunteerContext = {
  phase: GamePhase;
};

/**
 * Volunteer validation is pure here. Redis/Lua (Phase 3/6) must re-check atomically:
 * phase === BALANCING, player still on surplus, remaining need > 0, player is not CHAOS,
 * and the switch cannot overshoot the target.
 */
export function applyVolunteerMove(
  roster: Roster,
  plan: BalancePlan,
  playerId: string,
  context: VolunteerContext,
): BalancerResult<PlanWithRoster> {
  if (context.phase !== "BALANCING") {
    return balancerError("MOVE_NOT_ALLOWED", "Volunteer moves are only allowed during BALANCING");
  }

  const player = findPlayer(roster, playerId);
  if (!player) {
    return balancerError("PLAYER_NOT_FOUND", `Player ${playerId} is not on the roster`);
  }
  if (player.team === "chaos" || playerId === plan.wildcardPlayerId) {
    return balancerError("MOVE_NOT_ALLOWED", "CHAOS PLAYER cannot volunteer a team switch");
  }

  const from = surplusTeam(plan);
  const to = deficitTeam(plan);
  if (!from || !to) {
    return balancerError("MOVE_NOT_ALLOWED", "No remaining team imbalance to volunteer for");
  }
  if (player.team !== from) {
    return balancerError("MOVE_NOT_ALLOWED", "Only surplus-team players may volunteer");
  }

  const remaining = from === "left" ? plan.remainingLeftToRight : plan.remainingRightToLeft;
  if (remaining <= 0) {
    return balancerError("MOVE_WOULD_OVERSHOOT", "Team is already at the playable target");
  }

  const move: BalanceMove = {
    kind: "team_switch",
    playerId,
    from,
    to,
    reason: "volunteer",
    sequence: plan.moves.length + 1,
  };

  const nextPlan = copyPlan(plan);
  nextPlan.moves = [...nextPlan.moves, move];
  if (from === "left") {
    nextPlan.remainingLeftToRight -= 1;
  } else {
    nextPlan.remainingRightToLeft -= 1;
  }
  if (nextPlan.remainingLeftToRight === 0 && nextPlan.remainingRightToLeft === 0) {
    nextPlan.status = nextPlan.wildcardNeeded === 1 && !nextPlan.wildcardApplied ? "needs_wildcard" : "complete";
  } else {
    nextPlan.status = "needs_moves";
  }

  const events: BalancerEvent[] = [{ type: "VOLUNTEER_MOVE_ACCEPTED" }];
  if (nextPlan.status === "complete") {
    events.push({ type: "BALANCE_COMPLETED" });
  }

  return {
    ok: true,
    value: {
      roster: replacePlayer(cloneRoster(roster), playerId, to),
      plan: nextPlan,
    },
    events,
  };
}

import { balancerError } from "./errors.js";
import { copyPlan, derivePlanFromRoster } from "./plan.js";
import { countRoster, findPlayer } from "./roster.js";
import type { BalancePlan, BalancerResult, Roster } from "./types.js";

export { applyAutoBalance, previewAutoBalance } from "./auto.js";
export { createBalancePlan, derivePlanFromRoster } from "./plan.js";
export { calculateBalanceTarget } from "./target.js";
export { applyVolunteerMove, type VolunteerContext } from "./volunteer.js";
export {
  cloneRoster,
  countRoster,
  findPlayer,
  playersOn,
  replacePlayer,
  sortedPlayerIds,
  uniqueIds,
} from "./roster.js";
export { chooseWildcardCandidate, teamSwitchCount } from "./wildcard.js";
export type * from "./types.js";

export function selectWildcard(
  roster: Roster,
  plan: BalancePlan,
  playerId: string,
): BalancerResult<BalancePlan> {
  if (plan.wildcardNeeded !== 1) {
    return balancerError("INVALID_WILDCARD", "This roster does not require a CHAOS PLAYER");
  }
  if (plan.wildcardApplied) {
    return balancerError("WILDCARD_ALREADY_ASSIGNED", "A CHAOS PLAYER is already assigned");
  }
  if (plan.moves.length > 0) {
    return balancerError("INVALID_BALANCE_PLAN", "Cannot change CHAOS PLAYER after team moves have started");
  }

  const player = findPlayer(roster, playerId);
  if (!player) {
    return balancerError("PLAYER_NOT_FOUND", `Player ${playerId} is not on the roster`);
  }
  if (player.team === "chaos") {
    return balancerError("WILDCARD_ALREADY_ASSIGNED", "Player is already the CHAOS PLAYER");
  }
  if (player.team !== "left" && player.team !== "right") {
    return balancerError("INVALID_TEAM", "CHAOS PLAYER must currently be on LEFT or RIGHT");
  }

  const next = derivePlanFromRoster(roster, playerId);
  if (!next.ok) {
    return next;
  }

  return {
    ok: true,
    value: next.value,
    events: [{ type: "WILDCARD_SELECTED" }, ...next.events],
  };
}

export function isBalanceComplete(roster: Roster, plan: BalancePlan): boolean {
  const counts = countRoster(roster);
  return (
    plan.status === "complete" &&
    counts.left === plan.target.targetLeft &&
    counts.right === plan.target.targetRight &&
    counts.chaos === plan.wildcardNeeded &&
    counts.total === plan.target.totalPlayers
  );
}

export function snapshotPlan(plan: BalancePlan): BalancePlan {
  return copyPlan(plan);
}

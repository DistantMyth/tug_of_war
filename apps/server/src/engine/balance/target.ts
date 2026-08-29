import { balancerError } from "./errors.js";
import type { BalanceTarget, BalancerResult } from "./types.js";

export function calculateBalanceTarget(totalPlayers: number): BalancerResult<BalanceTarget> {
  if (!Number.isInteger(totalPlayers) || totalPlayers < 0) {
    return balancerError("INVALID_BALANCE_PLAN", "Roster size must be a non-negative integer");
  }
  if (totalPlayers === 0) {
    return balancerError("EMPTY_ROSTER", "Cannot balance an empty roster");
  }

  const wildcardNeeded = (totalPlayers % 2 === 0 ? 0 : 1) as 0 | 1;
  const playablePlayers = totalPlayers - wildcardNeeded;
  const targetPerTeam = playablePlayers / 2;

  return {
    ok: true,
    value: {
      totalPlayers,
      playablePlayers,
      targetLeft: targetPerTeam,
      targetRight: targetPerTeam,
      wildcardNeeded,
    },
    events: [],
  };
}

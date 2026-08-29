import type { GameState } from "./types.js";

export type RosterSnapshot = Pick<
  GameState,
  "totalPlayers" | "leftCount" | "rightCount" | "wildcardPlayerId"
>;

/**
 * Even/odd lock invariant only. Not the Phase 2 TeamBalancer
 * (no volunteer flow, min-switch plan, or auto-move selection).
 */
export function isRosterReadyForCountdown(roster: RosterSnapshot): boolean {
  const { totalPlayers: n, leftCount, rightCount, wildcardPlayerId } = roster;
  if (n < 1) {
    return false;
  }

  const chaos = wildcardPlayerId !== null;
  const assigned = leftCount + rightCount + (chaos ? 1 : 0);
  if (assigned !== n) {
    return false;
  }

  const target = Math.floor(n / 2);
  if (n % 2 === 0) {
    return !chaos && leftCount === target && rightCount === target;
  }

  return chaos && leftCount === target && rightCount === target;
}

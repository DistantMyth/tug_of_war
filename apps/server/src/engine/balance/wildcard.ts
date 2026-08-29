import type { TeamId } from "@tow/shared";
import type { BalanceTarget, Roster } from "./types.js";
import { countRoster, playersOn, sortedPlayerIds } from "./roster.js";

export function teamSwitchCount(left: number, right: number, target: BalanceTarget): number {
  return Math.max(0, left - target.targetLeft) + Math.max(0, right - target.targetRight);
}

export function chooseWildcardCandidate(roster: Roster, target: BalanceTarget): string | null {
  if (target.wildcardNeeded === 0) {
    return null;
  }

  const counts = countRoster(roster);
  if (counts.chaos === 1) {
    const existing = playersOn(roster, "chaos")[0];
    return existing?.playerId ?? null;
  }

  const sides: TeamId[] = ["left", "right"];
  const scored: { side: TeamId; switches: number; ids: string[] }[] = [];

  for (const side of sides) {
    const ids = sortedPlayerIds(playersOn(roster, side));
    if (ids.length === 0) {
      continue;
    }
    const left = side === "left" ? counts.left - 1 : counts.left;
    const right = side === "right" ? counts.right - 1 : counts.right;
    scored.push({ side, switches: teamSwitchCount(left, right, target), ids });
  }

  if (scored.length === 0) {
    return null;
  }

  const best = Math.min(...scored.map((entry) => entry.switches));
  const candidateIds = scored
    .filter((entry) => entry.switches === best)
    .flatMap((entry) => entry.ids)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return candidateIds[0] ?? null;
}

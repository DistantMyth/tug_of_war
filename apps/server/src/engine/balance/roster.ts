import type { TeamId } from "@tow/shared";
import type { BalancerPlayer, Roster, RosterCounts } from "./types.js";

export function cloneRoster(roster: Roster): Roster {
  return {
    players: roster.players.map((player) => ({ ...player })),
  };
}

export function countRoster(roster: Roster): RosterCounts {
  const counts: RosterCounts = { total: roster.players.length, left: 0, right: 0, chaos: 0 };
  for (const player of roster.players) {
    if (player.team === "left") {
      counts.left += 1;
    } else if (player.team === "right") {
      counts.right += 1;
    } else if (player.team === "chaos") {
      counts.chaos += 1;
    }
  }
  return counts;
}

export function findPlayer(roster: Roster, playerId: string): BalancerPlayer | undefined {
  return roster.players.find((player) => player.playerId === playerId);
}

export function playersOn(roster: Roster, team: TeamId | "chaos"): BalancerPlayer[] {
  return roster.players.filter((player) => player.team === team);
}

export function sortedPlayerIds(players: readonly BalancerPlayer[]): string[] {
  return players.map((player) => player.playerId).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function replacePlayer(roster: Roster, playerId: string, team: BalancerPlayer["team"]): Roster {
  return {
    players: roster.players.map((player) =>
      player.playerId === playerId ? { ...player, team } : player,
    ),
  };
}

export function uniqueIds(roster: Roster): boolean {
  const ids = new Set(roster.players.map((player) => player.playerId));
  return ids.size === roster.players.length;
}

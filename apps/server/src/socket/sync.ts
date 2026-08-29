import type { PublicState, YouView } from "@tow/shared";
import type { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import type { RedisGameRepository } from "../store/redis/repository.js";
import type { StoredPlayer } from "../store/redis/types.js";

export function buildYouView(player: StoredPlayer): YouView {
  const isChaos = player.wildcard || player.team === "chaos";
  const team = (player.team === "left" || player.team === "right") && !isChaos ? player.team : null;
  return {
    playerId: player.playerId,
    label: player.label,
    team,
    chaos: isChaos,
    status: player.status,
    role: isChaos ? "chaos" : player.team,
  };
}

/**
 * Build the full sync payload for a player socket.
 * Key is `public` to match the shared SyncPayload type { public: PublicState; you: YouView }.
 * applySync() on the frontend reads `sync.public`.
 */
export async function buildPlayerSync(
  gameId: string,
  player: StoredPlayer,
  repository: RedisGameRepository | MemoryGameRepository,
): Promise<{ public: PublicState; you: YouView }> {
  const publicResult = await repository.getPublicGameState(gameId);
  const publicState = publicResult.ok
    ? (publicResult.value as PublicState)
    : ({} as PublicState);

  return {
    public: publicState,
    you: buildYouView(player),
  };
}

/**
 * Build the sync payload for a display/admin socket.
 * Key is `public` to match the shared DisplaySyncPayload type { public: PublicState }.
 * applySync() on the frontend reads `sync.public`.
 */
export async function buildDisplaySync(
  gameId: string,
  repository: RedisGameRepository | MemoryGameRepository,
): Promise<{ public: PublicState }> {
  const publicResult = await repository.getPublicGameState(gameId);
  const publicState = publicResult.ok
    ? (publicResult.value as PublicState)
    : ({} as PublicState);

  return {
    public: publicState,
  };
}

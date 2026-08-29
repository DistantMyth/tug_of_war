import { logger } from "../../obs/logger.js";
import type { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import type { RedisGameRepository } from "../../store/redis/repository.js";
import { buildDisplaySync } from "../sync.js";
import type { GameNamespace, GameSocket } from "../types.js";

export type DisplayHandlerContext = {
  repository: RedisGameRepository | MemoryGameRepository;
};

/** Empty public state emitted when no active game exists yet. */
const NO_GAME_SYNC = {
  public: {
    sessionId: null,
    phase: "WAITING" as const,
    roundNumber: 0,
    counts: { total: 0, left: 0, right: 0, chaos: 0, online: 0, offline: 0 },
    scores: { left: 0, right: 0, seq: 0, at: 0 },
    timing: {
      durationMs: 0,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      serverNow: 0,
    },
    plan: null,
    winner: null,
    chaosPlayerId: null,
    chaosLabel: null,
  },
};

export function registerDisplayHandlers(
  socket: GameSocket,
  _namespace: GameNamespace,
  context: DisplayHandlerContext,
): void {
  const { repository } = context;

  if (socket.data.role !== "display") {
    return;
  }

  const gameIdAtConnect = socket.data.gameId;

  // Always join the display broadcast room so phase/count/score events are received
  socket.join("display");

  if (gameIdAtConnect) {
    socket.join(`game:${gameIdAtConnect}`);

    // Send initial authoritative sync with correct `public` key
    buildDisplaySync(gameIdAtConnect, repository)
      .then((syncData) => {
        socket.emit("sync", syncData);
        logger.info("display_connected_and_synced", { gameId: gameIdAtConnect, socketId: socket.id });
      })
      .catch((err) => {
        logger.error("display_sync_error", { error: String(err), socketId: socket.id });
      });
  } else {
    // No active game — send WAITING sync so display shows correct idle state
    logger.info("display_connected_no_game", { socketId: socket.id });
    const waitingSync = {
      ...NO_GAME_SYNC,
      public: { ...NO_GAME_SYNC.public, scores: { ...NO_GAME_SYNC.public.scores, at: Date.now() }, timing: { ...NO_GAME_SYNC.public.timing, serverNow: Date.now() } },
    };
    socket.emit("sync", waitingSync);
  }

  // Allow display to request a fresh sync (e.g. after reconnect)
  socket.on("player:request_sync", async (_payload, callback) => {
    try {
      // Re-read current game id in case admin opened a new game since connect
      const currentGameId = (await repository.getCurrentGameId()) || gameIdAtConnect;
      if (!currentGameId) {
        const waitingSync = {
          ...NO_GAME_SYNC,
          public: { ...NO_GAME_SYNC.public, scores: { ...NO_GAME_SYNC.public.scores, at: Date.now() }, timing: { ...NO_GAME_SYNC.public.timing, serverNow: Date.now() } },
        };
        socket.emit("sync", waitingSync);
        if (callback) callback({ ok: true, data: waitingSync as any });
        return;
      }
      const syncData = await buildDisplaySync(currentGameId, repository);
      socket.emit("sync", syncData);
      if (callback) callback({ ok: true, data: syncData as any });
    } catch (err) {
      logger.error("display_request_sync_error", { error: String(err) });
      if (callback) {
        callback({ ok: false, code: "VALIDATION", message: "Failed to build display sync" });
      }
    }
  });

  socket.on("disconnect", () => {
    logger.info("display_disconnected", { gameId: gameIdAtConnect || "(none)", socketId: socket.id });
  });
}

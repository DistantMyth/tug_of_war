import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { GameOrchestrator, type OrchestratorEmitter } from "../engine/orchestrator/GameOrchestrator.js";
import { PlayerIdentityService } from "../identity/service.js";
import { logger } from "../obs/logger.js";
import type { MongoPersistenceService } from "../store/mongo/persistenceService.js";
import { getRedisClient, isRedisConfigured } from "../store/redis/client.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import { RedisGameRepository } from "../store/redis/repository.js";
import { createGameAuthMiddleware } from "./auth.js";
import { GameConnectionManager } from "./connectionManager.js";
import { registerAdminHandlers } from "./handlers/admin.js";
import { registerDisplayHandlers } from "./handlers/display.js";
import { registerPlayerHandlers } from "./handlers/player.js";
import { buildDisplaySync, buildPlayerSync } from "./sync.js";
import type { GameNamespace, GameServer, GameSocket } from "./types.js";

export type SocketServerOptions = {
  repository?: RedisGameRepository | MemoryGameRepository;
  identityService?: PlayerIdentityService;
  orchestrator?: GameOrchestrator;
  connectionManager?: GameConnectionManager;
  persistenceService?: MongoPersistenceService;
  corsOrigin?: string;
  pingInterval?: number;
  pingTimeout?: number;
};

export type GameSocketServerResult = {
  io: GameServer;
  gameNamespace: GameNamespace;
  connectionManager: GameConnectionManager;
  repository: RedisGameRepository | MemoryGameRepository;
  identityService: PlayerIdentityService;
  orchestrator: GameOrchestrator;
};

export function setupGameSocketServer(
  httpServer: HttpServer,
  options?: SocketServerOptions,
): GameSocketServerResult {
  const repository =
    options?.repository ??
    (isRedisConfigured()
      ? new RedisGameRepository(getRedisClient())
      : new MemoryGameRepository());

  const identityService = options?.identityService ?? new PlayerIdentityService(repository);
  const connectionManager = options?.connectionManager ?? new GameConnectionManager();
  const io: GameServer = new Server(httpServer, {
    cors: {
      origin: (requestOrigin, callback) => {
        callback(null, requestOrigin || true);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingInterval: options?.pingInterval ?? 25000,
    pingTimeout: options?.pingTimeout ?? 60000,
    maxHttpBufferSize: 1e6, // 1MB
  });

  const gameNamespace: GameNamespace = io.of("/game");

  const emitter: OrchestratorEmitter = {
    emitPhase(gameId, phase, at) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:phase", { phase, at });
    },
    emitCounts(gameId, counts) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:counts", counts);
    },
    emitBalancePlan(gameId, plan) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:balance_plan" as any, plan);
    },
    emitBalanceMove(gameId, move) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:balance_move" as any, move);
    },
    emitWildcard(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:wildcard" as any, data);
    },
    emitCountdown(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:countdown" as any, data);
    },
    emitScore(gameId, score) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:score" as any, score);
    },
    emitTime(gameId, timing) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:time" as any, timing);
    },
    emitPaused(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:paused" as any, data);
    },
    emitResumed(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:resumed" as any, data);
    },
    emitExtended(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:extended" as any, data);
    },
    emitFinished(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:finished" as any, data);
    },
    emitRound(gameId, data) {
      gameNamespace.to(`game:${gameId}`).to("display").emit("game:round" as any, data);
    },
    emitPlayerYou(playerId, you) {
      gameNamespace.to(`player:${playerId}`).emit("player:you", you);
    },
    emitSync(gameId) {
      buildDisplaySync(gameId, repository)
        .then((syncData) => {
          // Emit to: game room (all players in this game),
          // display room (display sockets + admin sockets which join "display" on connect),
          // admin room (admin sockets not yet in this game room, e.g. after admin:open).
          gameNamespace
            .to(`game:${gameId}`)
            .to("display")
            .to("admin")
            .emit("sync", syncData);
        })
        .catch(() => {});
    },
  };

  const orchestrator =
    options?.orchestrator ??
    new GameOrchestrator(repository, emitter, undefined, undefined, options?.persistenceService);

  // Recover any in-progress timers or countdowns if Node restarted
  orchestrator.recoverProcessState().catch((err) => {
    logger.error("startup_recovery_error", { error: String(err) });
  });

  // Authentication middleware for /game
  gameNamespace.use(createGameAuthMiddleware({ identityService, repository }));

  // Connection lifecycle on /game
  gameNamespace.on("connection", (socket: GameSocket) => {
    connectionManager.incrementConnections();
    logger.info("socket_connected", {
      socketId: socket.id,
      role: socket.data.role,
      gameId: socket.data.gameId,
      playerId: socket.data.role === "player" ? socket.data.playerId : undefined,
    });

    if (socket.data.role === "display") {
      registerDisplayHandlers(socket, gameNamespace, { repository });
    } else if (socket.data.role === "admin") {
      socket.join("admin");
      socket.join("display");
      if (socket.data.gameId) {
        socket.join(`game:${socket.data.gameId}`);
        buildDisplaySync(socket.data.gameId, repository)
          .then((syncData) => {
            socket.emit("sync", syncData);
          })
          .catch(() => {});
      } else {
        // No active game at connect time — send WAITING sync so admin UI shows correct initial state
        const waitingSync = {
          public: {
            sessionId: null,
            phase: "WAITING" as const,
            roundNumber: 0,
            counts: { total: 0, left: 0, right: 0, chaos: 0, online: 0, offline: 0 },
            scores: { left: 0, right: 0, seq: 0, at: Date.now() },
            timing: {
              durationMs: 0, startTime: null, endTime: null,
              pausedAt: null, pauseAccumMs: 0,
              countdownEndsAt: null, serverNow: Date.now(),
            },
            plan: null,
            winner: null,
            chaosPlayerId: null,
            chaosLabel: null,
          },
        };
        socket.emit("sync", waitingSync);
      }
      registerAdminHandlers(socket, gameNamespace, { orchestrator });
    } else {
      // Player role: ONLY player handlers are registered.
      // Admin handlers must never be accessible to player sockets.
      registerPlayerHandlers(socket, gameNamespace, {
        identityService,
        repository,
        connectionManager,
        orchestrator,
      });
    }

    socket.on("disconnect", (reason) => {
      connectionManager.decrementConnections();
      logger.info("socket_disconnected", {
        socketId: socket.id,
        role: socket.data.role,
        reason,
      });
    });
  });

  return {
    io,
    gameNamespace,
    connectionManager,
    repository,
    identityService,
    orchestrator,
  };
}

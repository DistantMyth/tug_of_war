import type { ChooseTeamPayload, ErrorCode, PlayerHelloPayload, RequestSyncPayload, SwitchTeamPayload } from "@tow/shared";
import type { GameOrchestrator } from "../../engine/orchestrator/GameOrchestrator.js";
import type { PlayerIdentityService } from "../../identity/service.js";
import { logger } from "../../obs/logger.js";
import type { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import type { RedisGameRepository } from "../../store/redis/repository.js";
import type { GameConnectionManager } from "../connectionManager.js";
import { buildPlayerSync, buildYouView } from "../sync.js";
import type { GameNamespace, GameSocket, PlayerSocketData } from "../types.js";

export type PlayerHandlerContext = {
  identityService: PlayerIdentityService;
  repository: RedisGameRepository | MemoryGameRepository;
  connectionManager: GameConnectionManager;
  orchestrator?: GameOrchestrator;
};

export function registerPlayerHandlers(
  socket: GameSocket,
  namespace: GameNamespace,
  context: PlayerHandlerContext,
): void {
  const { repository, identityService, connectionManager, orchestrator } = context;

  // ==========================================
  // HELPER: ACTIVATE PLAYER SOCKET
  // ==========================================
  async function activatePlayerSocket(data: PlayerSocketData): Promise<void> {
    socket.data = data;

    const previousSocketId = connectionManager.setActiveSocket(data.playerId, socket.id);
    if (previousSocketId && previousSocketId !== socket.id) {
      logger.info("player_socket_replaced", {
        playerId: data.playerId,
        oldSocketId: previousSocketId,
        newSocketId: socket.id,
      });
      namespace.to(previousSocketId).emit("player:replaced", {
        message: "Session resumed in another tab or device",
      });
    }

    socket.join(`game:${data.gameId}`);
    socket.join(`player:${data.playerId}`);

    await repository.setPlayerOnline(data.gameId, data.playerId, true);
  }

  // If socket was pre-authenticated during handshake
  if (socket.data.role === "player" && socket.data.playerId && socket.data.gameId) {
    activatePlayerSocket(socket.data as PlayerSocketData).catch((err) => {
      logger.error("error_activating_handshake_socket", { error: String(err) });
    });
  }

  // ==========================================
  // EVENT: player:hello
  // ==========================================
  socket.on("player:hello", async (payload: PlayerHelloPayload, callback) => {
    try {
      const token = payload?.token ?? (socket.data.role === "player" ? socket.data.token : undefined);

      if (!token) {
        const errAck = { ok: false as const, code: "UNAUTHORIZED" as ErrorCode, message: "Missing authentication token" };
        socket.emit("error", { code: "UNAUTHORIZED", message: "Missing authentication token" });
        if (callback) callback(errAck);
        return;
      }

      const verifyResult = identityService.verifyToken(token);
      if (!verifyResult.ok) {
        const errAck = { ok: false as const, code: verifyResult.code, message: verifyResult.message };
        socket.emit("error", { code: verifyResult.code, message: verifyResult.message });
        if (callback) callback(errAck);
        return;
      }

      const claims = verifyResult.claims;
      const playerResult = await repository.getPlayer(claims.sessionId, claims.playerId);
      if (!playerResult.ok) {
        const errAck = { ok: false as const, code: "UNKNOWN_PLAYER" as ErrorCode, message: "Player identity not found" };
        socket.emit("error", { code: "UNKNOWN_PLAYER", message: "Player identity not found" });
        if (callback) callback(errAck);
        return;
      }

      const player = playerResult.value;
      const playerSocketData: PlayerSocketData = {
        role: "player",
        gameId: claims.sessionId,
        playerId: claims.playerId,
        player,
        token,
        isActive: true,
      };

      await activatePlayerSocket(playerSocketData);

      const syncData = await buildPlayerSync(claims.sessionId, player, repository);
      socket.emit("sync", syncData);

      if (callback) {
        callback({ ok: true, data: syncData });
      }

      // Broadcast updated online count to lobby
      const countsResult = await repository.getCounts(claims.sessionId);
      if (countsResult.ok) {
        namespace.to(`game:${claims.sessionId}`).emit("game:counts", countsResult.value);
      }
    } catch (err) {
      logger.error("player_hello_error", { error: String(err), socketId: socket.id });
      const errAck = { ok: false as const, code: "VALIDATION" as ErrorCode, message: "Internal server error during hello" };
      socket.emit("error", { code: "VALIDATION", message: "Internal error" });
      if (callback) callback(errAck);
    }
  });

  // ==========================================
  // EVENT: player:request_sync
  // ==========================================
  socket.on("player:request_sync", async (_payload: RequestSyncPayload, callback) => {
    try {
      if (socket.data.role !== "player" || !socket.data.playerId || !socket.data.gameId) {
        const errAck = { ok: false as const, code: "UNAUTHORIZED" as ErrorCode, message: "Socket unauthenticated" };
        if (callback) callback(errAck);
        return;
      }

      const { gameId, playerId } = socket.data;
      const playerResult = await repository.getPlayer(gameId, playerId);
      if (!playerResult.ok) {
        const errAck = { ok: false as const, code: "UNKNOWN_PLAYER" as ErrorCode, message: "Player not found" };
        if (callback) callback(errAck);
        return;
      }

      const syncData = await buildPlayerSync(gameId, playerResult.value, repository);
      socket.emit("sync", syncData);
      if (callback) callback({ ok: true, data: syncData });
    } catch (err) {
      logger.error("player_request_sync_error", { error: String(err) });
      if (callback) {
        callback({ ok: false, code: "VALIDATION", message: "Failed to build sync" });
      }
    }
  });

  // ==========================================
  // HANDLER: TEAM SELECTION & SWITCHING
  // ==========================================
  async function handleTeamChange(
    teamPayload: ChooseTeamPayload | SwitchTeamPayload,
    callback?: (ack: any) => void,
  ): Promise<void> {
    try {
      // 1. Authenticated socket validation
      if (socket.data.role !== "player" || !socket.data.playerId || !socket.data.gameId) {
        const errAck = { ok: false, code: "UNAUTHORIZED", message: "Socket not authenticated" };
        if (callback) callback(errAck);
        return;
      }

      const { gameId, playerId } = socket.data;

      // 2. Active tab check (duplicate tab guard)
      if (!connectionManager.isActiveSocket(playerId, socket.id)) {
        const errAck = {
          ok: false,
          code: "SESSION_REPLACED",
          message: "This browser tab is no longer the active connection",
        };
        if (callback) callback(errAck);
        return;
      }

      // 3. Payload validation
      if (!teamPayload || (teamPayload.team !== "left" && teamPayload.team !== "right")) {
        const errAck = { ok: false, code: "VALIDATION", message: "Target team must be left or right" };
        if (callback) callback(errAck);
        return;
      }

      const gameResult = await repository.getGame(gameId);
      if (!gameResult.ok) {
        const errAck = { ok: false, code: "GAME_NOT_FOUND", message: "Game not found" };
        if (callback) callback(errAck);
        return;
      }

      const game = gameResult.value;

      // If in BALANCING phase, treat team switch as volunteer move if orchestrator available
      if (game.phase === "BALANCING" && orchestrator) {
        const volunteerResult = await orchestrator.applyVolunteerMove(playerId);
        if (!volunteerResult.ok) {
          const errAck = { ok: false, code: volunteerResult.code, message: volunteerResult.message };
          if (callback) callback(errAck);
          return;
        }
        if (callback) {
          callback({
            ok: true,
            data: {
              team: volunteerResult.data.move.to,
              counts: volunteerResult.data.counts,
            },
          });
        }
        return;
      }

      // 4. Atomic repository mutation during OPEN
      const result = await repository.chooseOrSwitchTeam(gameId, playerId, teamPayload.team);
      if (!result.ok) {
        let code: ErrorCode = "SWITCH_LOCKED";
        if (result.error.code === "PLAYER_NOT_FOUND") code = "UNKNOWN_PLAYER";
        if (result.error.code === "INVALID_TEAM") code = "VALIDATION";
        if (result.error.code === "MOVE_NOT_ALLOWED") code = "NOT_ELIGIBLE";

        const errAck = { ok: false, code, message: result.error.message };
        if (callback) callback(errAck);
        return;
      }

      // 5. Success Acknowledgement
      if (callback) {
        callback({
          ok: true,
          data: {
            team: result.value.newTeam,
            counts: result.value.counts,
          },
        });
      }

      // 6. Broadcast updated player view to player's room
      const playerResult = await repository.getPlayer(gameId, playerId);
      if (playerResult.ok) {
        socket.data.player = playerResult.value;
        namespace.to(`player:${playerId}`).emit("player:you", buildYouView(playerResult.value));
      }

      // 7. Broadcast live counts to whole game lobby
      namespace.to(`game:${gameId}`).emit("game:counts", result.value.counts);

      logger.info("player_team_changed", {
        gameId,
        playerId,
        previousTeam: result.value.previousTeam,
        newTeam: result.value.newTeam,
      });
    } catch (err) {
      logger.error("team_change_error", { error: String(err), socketId: socket.id });
      if (callback) {
        callback({ ok: false, code: "VALIDATION", message: "Failed to process team selection" });
      }
    }
  }

  socket.on("player:choose_team", (payload, callback) => handleTeamChange(payload, callback));
  socket.on("player:switch_team", (payload, callback) => handleTeamChange(payload, callback));
  socket.on("player:volunteer" as any, async (_payload: any, callback?: (ack: any) => void) => {
    if (!orchestrator || socket.data.role !== "player" || !socket.data.playerId) {
      if (callback) callback({ ok: false, code: "SWITCH_LOCKED", message: "Balancing not active" });
      return;
    }
    const res = await orchestrator.applyVolunteerMove(socket.data.playerId);
    if (callback) callback(res);
  });

  // ==========================================
  // EVENT: player:tap
  // ==========================================
  socket.on("player:tap", async (_payload: any, callback) => {
    try {
      if (socket.data.role !== "player" || !socket.data.playerId || !socket.data.gameId) {
        const errAck = { ok: false as const, code: "UNAUTHORIZED" as ErrorCode, message: "Socket not authenticated" };
        if (callback) callback(errAck);
        return;
      }

      const { playerId } = socket.data;

      // Duplicate tab check (only active socket can tap)
      if (!connectionManager.isActiveSocket(playerId, socket.id)) {
        const errAck = {
          ok: false as const,
          code: "SESSION_REPLACED" as ErrorCode,
          message: "This browser tab is no longer the active connection",
        };
        if (callback) callback(errAck);
        return;
      }

      if (!orchestrator) {
        const errAck = { ok: false as const, code: "SWITCH_LOCKED" as ErrorCode, message: "Game engine unavailable" };
        if (callback) callback(errAck);
        return;
      }

      const tapResult = await orchestrator.processTap(playerId);
      if (!tapResult.ok) {
        const errAck = { ok: false as const, code: tapResult.code, message: tapResult.message };
        if (callback) callback(errAck);
        return;
      }

      if (callback) {
        callback({
          ok: true,
          data: {
            team: tapResult.data.team,
            scores: tapResult.data.scores,
            seq: tapResult.data.seq,
          },
        });
      }
    } catch (err) {
      logger.error("player_tap_error", { error: String(err), socketId: socket.id });
      if (callback) {
        callback({ ok: false, code: "VALIDATION", message: "Failed to process tap" });
      }
    }
  });

  // ==========================================
  // EVENT: disconnect
  // ==========================================
  socket.on("disconnect", async () => {
    try {
      const { playerId, wasActive } = connectionManager.removeSocket(socket.id);

      if (playerId && socket.data.role === "player" && socket.data.gameId) {
        const gameId = socket.data.gameId;

        // If no other socket is active for this player, mark offline
        if (wasActive && !connectionManager.getActiveSocket(playerId)) {
          await repository.setPlayerOnline(gameId, playerId, false);

          const countsResult = await repository.getCounts(gameId);
          if (countsResult.ok) {
            namespace.to(`game:${gameId}`).emit("game:counts", countsResult.value);
          }
        }
      }
    } catch (err) {
      logger.error("player_disconnect_cleanup_error", { error: String(err) });
    }
  });
}

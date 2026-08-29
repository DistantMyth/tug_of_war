import type { ExtendedError } from "socket.io";
import type { PlayerIdentityService } from "../identity/service.js";
import { logger } from "../obs/logger.js";
import type { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import type { RedisGameRepository } from "../store/redis/repository.js";
import { verifyAdminSecret } from "./adminAuth.js";
import { verifyDisplaySecret } from "./displayAuth.js";
import type { GameSocket } from "./types.js";

export type SocketAuthContext = {
  identityService: PlayerIdentityService;
  repository: RedisGameRepository | MemoryGameRepository;
};

export function createGameAuthMiddleware(context: SocketAuthContext) {
  return async (socket: GameSocket, next: (err?: ExtendedError) => void) => {
    try {
      const auth = socket.handshake.auth ?? {};
      const query = socket.handshake.query ?? {};

      const role = (auth.role || query.role || "player") as string;

      // ==========================================
      // ADMIN AUTHENTICATION
      // ==========================================
      if (role === "admin") {
        const candidateSecret =
          (typeof auth.adminToken === "string" ? auth.adminToken : undefined) ??
          (typeof auth.secret === "string" ? auth.secret : undefined) ??
          (typeof auth.token === "string" ? auth.token : undefined) ??
          (typeof auth.password === "string" ? auth.password : undefined) ??
          (typeof query.adminToken === "string" ? (query.adminToken as string) : undefined) ??
          (typeof query.secret === "string" ? (query.secret as string) : undefined) ??
          (typeof query.password === "string" ? (query.password as string) : undefined);

        if (!verifyAdminSecret(candidateSecret)) {
          logger.warn("admin_auth_failed", { socketId: socket.id });
          return next(new Error("UNAUTHORIZED: Invalid admin credentials"));
        }

        const activeGameId = (await context.repository.getCurrentGameId()) ?? "";

        socket.data = {
          role: "admin",
          gameId: activeGameId,
          authenticatedAt: Date.now(),
        };
        return next();
      }

      // ==========================================
      // DISPLAY AUTHENTICATION
      // ==========================================
      if (role === "display") {
        const candidateSecret =
          (typeof auth.displayToken === "string" ? auth.displayToken : undefined) ??
          (typeof auth.displaySecret === "string" ? auth.displaySecret : undefined) ??
          (typeof auth.token === "string" ? auth.token : undefined) ??
          (typeof auth.pin === "string" ? auth.pin : undefined) ??
          (typeof query.displayToken === "string" ? (query.displayToken as string) : undefined);

        if (!verifyDisplaySecret(candidateSecret)) {
          logger.warn("display_auth_failed", { socketId: socket.id });
          return next(new Error("UNAUTHORIZED: Invalid display credentials"));
        }

        const activeGameId = (await context.repository.getCurrentGameId()) ?? "";

        socket.data = {
          role: "display",
          gameId: activeGameId,
        };
        logger.info("display_authenticated", { socketId: socket.id, gameId: activeGameId || "(none)" });
        return next();
      }

      // ==========================================
      // PLAYER AUTHENTICATION
      // ==========================================
      const token =
        (typeof auth.token === "string" ? auth.token : undefined) ??
        (typeof query.token === "string" ? (query.token as string) : undefined);

      // If token provided during handshake, verify and attach identity
      if (token && token.trim().length > 0) {
        const verifyResult = context.identityService.verifyToken(token.trim());
        if (!verifyResult.ok) {
          logger.warn("player_auth_failed", { reason: verifyResult.code, socketId: socket.id });
          return next(new Error(`${verifyResult.code}: ${verifyResult.message}`));
        }

        const claims = verifyResult.claims;
        const playerResult = await context.repository.getPlayer(claims.sessionId, claims.playerId);
        if (!playerResult.ok) {
          logger.warn("player_not_found_on_auth", { playerId: claims.playerId, gameId: claims.sessionId });
          return next(new Error("UNKNOWN_PLAYER: Player identity not found"));
        }

        socket.data = {
          role: "player",
          gameId: claims.sessionId,
          playerId: claims.playerId,
          player: playerResult.value,
          token: token.trim(),
          isActive: true,
        };
        return next();
      }

      // Allow connection if handshake doesn't include token (auth via player:hello)
      socket.data = {
        role: "player",
        gameId: "",
        playerId: "",
        player: null as any,
        token: undefined,
        isActive: false,
      };
      return next();
    } catch (err) {
      logger.error("socket_auth_middleware_error", { error: String(err) });
      return next(new Error("INTERNAL_ERROR: Authentication failed"));
    }
  };
}

import crypto from "node:crypto";
import type { PublicState, YouView } from "@tow/shared";
import { logger } from "../obs/logger.js";
import type { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import type { RedisGameRepository } from "../store/redis/repository.js";
import type { StoredPlayer } from "../store/redis/types.js";
import { getPlayerTokenSecret, signPlayerToken, verifyPlayerToken } from "./token.js";
import type {
  Clock,
  PlayerTokenClaims,
  RegisterPlayerInput,
  RegisterPlayerResult,
  VerifyTokenResult,
} from "./types.js";

const DEFAULT_TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours
const DEFAULT_DISCONNECT_GRACE_MS = 120 * 1000; // 120 seconds

export type IdentityServiceOptions = {
  tokenSecret?: string;
  tokenLifetimeMs?: number;
  disconnectGraceMs?: number;
  clock?: Clock;
};

export function formatPlayerLabel(sequenceNumber: number): string {
  return `P-${String(sequenceNumber).padStart(3, "0")}`;
}

export class PlayerIdentityService {
  private readonly tokenSecret: string;
  private readonly tokenLifetimeMs: number;
  private readonly disconnectGraceMs: number;
  private readonly clock: Clock;

  constructor(
    private readonly repository: RedisGameRepository | MemoryGameRepository,
    options?: IdentityServiceOptions,
  ) {
    this.tokenSecret = options?.tokenSecret ?? getPlayerTokenSecret();
    this.tokenLifetimeMs = options?.tokenLifetimeMs ?? DEFAULT_TOKEN_LIFETIME_MS;
    this.disconnectGraceMs = options?.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
    this.clock = options?.clock ?? { now: () => Date.now() };
  }

  private now(override?: number): number {
    return override ?? this.clock.now();
  }

  // ==========================================
  // TOKEN VERIFICATION
  // ==========================================

  verifyToken(token: string, currentTime?: number): VerifyTokenResult {
    return verifyPlayerToken(token, this.tokenSecret, this.now(currentTime));
  }

  // ==========================================
  // REGISTRATION & RESUME FLOW
  // ==========================================

  async registerOrResume(
    input: RegisterPlayerInput,
    currentTime?: number,
  ): Promise<RegisterPlayerResult> {
    const timestamp = this.now(currentTime);

    // 1. Resolve current active game pointer
    const currentGameId = await this.repository.getCurrentGameId();
    if (!currentGameId) {
      return {
        ok: false,
        code: "GAME_NOT_FOUND",
        message: "No active game session is currently open",
      };
    }

    const gameResult = await this.repository.getGame(currentGameId);
    if (!gameResult.ok) {
      return {
        ok: false,
        code: "GAME_NOT_FOUND",
        message: `Game session ${currentGameId} not found`,
      };
    }
    const game = gameResult.value;

    // 2. RESUME FLOW: Valid token provided
    if (input.token && input.token.trim().length > 0) {
      const verifyResult = this.verifyToken(input.token.trim(), timestamp);
      if (!verifyResult.ok) {
        logger.warn("token_rejected", { reason: verifyResult.code });
        return {
          ok: false,
          code: verifyResult.code,
          message: verifyResult.message,
        };
      }

      const claims = verifyResult.claims;

      // Token belongs to a different session
      if (claims.sessionId !== currentGameId) {
        logger.warn("token_session_mismatch", {
          tokenSession: claims.sessionId,
          activeSession: currentGameId,
        });
        return {
          ok: false,
          code: "SESSION_REPLACED",
          message: "Token belongs to an expired or different game session",
        };
      }

      // Check player exists in repository
      const playerResult = await this.repository.getPlayer(currentGameId, claims.playerId);
      if (!playerResult.ok) {
        logger.warn("token_player_not_found", {
          playerId: claims.playerId,
          gameId: currentGameId,
        });
        return {
          ok: false,
          code: "UNKNOWN_PLAYER",
          message: "Player identity not found in active session",
        };
      }

      const player = playerResult.value;

      // Update last seen
      await this.refreshLastSeen(currentGameId, player.playerId, timestamp);

      const publicStateResult = await this.repository.getPublicGameState(currentGameId);
      const publicState: PublicState = publicStateResult.ok
        ? (publicStateResult.value as PublicState)
        : ({} as any);

      const you: YouView = {
        playerId: player.playerId,
        label: player.label,
        team: player.team === "chaos" ? null : player.team,
        chaos: player.wildcard || player.team === "chaos",
        status: player.status,
        role: player.wildcard || player.team === "chaos" ? "chaos" : player.team,
      };

      logger.info("player_resumed", {
        gameId: currentGameId,
        playerId: player.playerId,
        label: player.label,
      });

      return {
        ok: true,
        data: {
          isNew: false,
          player: you,
          token: input.token.trim(),
          publicState,
        },
      };
    }

    // 3. NEW REGISTRATION FLOW
    if (game.phase !== "OPEN" || !game.joinAllowed) {
      logger.warn("registration_rejected_phase", {
        gameId: currentGameId,
        phase: game.phase,
        joinAllowed: game.joinAllowed,
      });
      return {
        ok: false,
        code: "JOIN_CLOSED",
        message: `Registration is closed for phase ${game.phase}`,
      };
    }

    const countsResult = await this.repository.getCounts(currentGameId);
    const totalRegistered = countsResult.ok ? countsResult.value.total : 0;

    const newPlayerId = crypto.randomUUID();
    const label = formatPlayerLabel(totalRegistered + 1);

    const tokenClaims: PlayerTokenClaims = {
      playerId: newPlayerId,
      sessionId: currentGameId,
      jti: crypto.randomUUID(),
      issuedAt: timestamp,
      expiresAt: timestamp + this.tokenLifetimeMs,
    };

    const token = signPlayerToken(tokenClaims, this.tokenSecret);

    const newPlayer: StoredPlayer = {
      playerId: newPlayerId,
      label,
      team: null,
      wildcard: false,
      status: "online",
      joinedAt: timestamp,
      lastSeen: timestamp,
    };

    await this.repository.addOrUpdatePlayer(currentGameId, newPlayer);

    const publicStateResult = await this.repository.getPublicGameState(currentGameId);
    const publicState: PublicState = publicStateResult.ok
      ? (publicStateResult.value as PublicState)
      : ({} as any);

    const you: YouView = {
      playerId: newPlayer.playerId,
      label: newPlayer.label,
      team: null,
      chaos: false,
      status: "online",
      role: null,
    };

    logger.info("player_registered", {
      gameId: currentGameId,
      playerId: newPlayerId,
      label,
    });

    return {
      ok: true,
      data: {
        isNew: true,
        player: you,
        token,
        publicState,
      },
    };
  }

  // ==========================================
  // PLAYER RESOLUTION & LIFECYCLE
  // ==========================================

  async resolvePlayer(gameId: string, playerId: string): Promise<StoredPlayer | null> {
    const result = await this.repository.getPlayer(gameId, playerId);
    return result.ok ? result.value : null;
  }

  async refreshLastSeen(gameId: string, playerId: string, currentTime?: number): Promise<void> {
    const timestamp = this.now(currentTime);
    const playerResult = await this.repository.getPlayer(gameId, playerId);
    if (playerResult.ok) {
      const updated: StoredPlayer = {
        ...playerResult.value,
        lastSeen: timestamp,
      };
      await this.repository.addOrUpdatePlayer(gameId, updated);
    }
  }

  async evaluateGracePeriod(
    gameId: string,
    graceMs?: number,
    currentTime?: number,
  ): Promise<{ abandonedPlayerIds: string[] }> {
    const timestamp = this.now(currentTime);
    const maxInactiveMs = graceMs ?? this.disconnectGraceMs;

    const gameResult = await this.repository.getGame(gameId);
    if (!gameResult.ok) {
      return { abandonedPlayerIds: [] };
    }

    const game = gameResult.value;
    // Abandonment policy only operates during OPEN phase
    if (game.phase !== "OPEN") {
      return { abandonedPlayerIds: [] };
    }

    const playersResult = await this.repository.getAllPlayers(gameId);
    if (!playersResult.ok) {
      return { abandonedPlayerIds: [] };
    }

    const abandonedPlayerIds: string[] = [];
    for (const player of playersResult.value) {
      if (player.status !== "abandoned" && timestamp - player.lastSeen > maxInactiveMs) {
        await this.markPlayerAbandoned(gameId, player.playerId);
        abandonedPlayerIds.push(player.playerId);
      }
    }

    return { abandonedPlayerIds };
  }

  async markPlayerAbandoned(gameId: string, playerId: string): Promise<boolean> {
    const gameResult = await this.repository.getGame(gameId);
    if (!gameResult.ok || gameResult.value.phase !== "OPEN") {
      // Invariant: locked/running rounds never abandon players
      return false;
    }

    const playerResult = await this.repository.getPlayer(gameId, playerId);
    if (!playerResult.ok) {
      return false;
    }

    const player = playerResult.value;
    const updated: StoredPlayer = {
      ...player,
      team: null,
      wildcard: false,
      status: "abandoned",
    };

    await this.repository.addOrUpdatePlayer(gameId, updated);

    logger.info("player_abandoned", { gameId, playerId });
    return true;
  }

  // ==========================================
  // PUBLIC CURRENT SESSION INFO
  // ==========================================

  async getCurrentSessionInfo(): Promise<{ active: boolean; publicState: PublicState | null }> {
    const currentGameId = await this.repository.getCurrentGameId();
    if (!currentGameId) {
      return { active: false, publicState: null };
    }
    const publicStateResult = await this.repository.getPublicGameState(currentGameId);
    if (!publicStateResult.ok) {
      return { active: false, publicState: null };
    }
    return {
      active: true,
      publicState: publicStateResult.value as PublicState,
    };
  }
}

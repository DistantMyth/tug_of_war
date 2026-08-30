import type { Redis } from "ioredis";
import type { TeamId } from "@tow/shared";
import type { BalanceMove, Roster } from "../../engine/balance/types.js";
import { logger } from "../../obs/logger.js";
import { RedisKeys } from "./keys.js";
import { checkTapRateLimit, type TapRateLimitConfig } from "./rateLimit.js";
import { LuaScripts } from "./scripts.js";
import {
  deserializeBalancePlan,
  deserializeGameState,
  deserializeMove,
  deserializePlayer,
  serializeBalancePlan,
  serializeGameState,
  serializePlayer,
} from "./serialization.js";
import type {
  AutoBalanceAtomicResult,
  ChooseOrSwitchResult,
  ExtendResult,
  FinishResult,
  LockAndSnapshotResult,
  NextRoundResult,
  PauseResult,
  RateLimitResult,
  RepositoryResult,
  ResumeResult,
  StartRunningResult,
  StoredBalancePlan,
  StoredCounts,
  StoredGameState,
  StoredPlayer,
  StoredPublicState,
  TapIncrementResult,
  VolunteerMoveAtomicResult,
  WildcardAtomicResult,
} from "./types.js";

export class RedisGameRepository {
  constructor(private readonly redis: Redis) {}

  // ==========================================
  // SESSION POINTER
  // ==========================================

  async getCurrentGameId(): Promise<string | null> {
    return this.redis.get(RedisKeys.currentEvent());
  }

  async setCurrentGameId(gameId: string): Promise<void> {
    await this.redis.set(RedisKeys.currentEvent(), gameId);
  }

  async clearCurrentGameId(): Promise<void> {
    await this.redis.del(RedisKeys.currentEvent());
  }

  // ==========================================
  // GAME STATE
  // ==========================================

  async createGame(state: StoredGameState): Promise<RepositoryResult<StoredGameState>> {
    const key = RedisKeys.game(state.gameId);
    const serialized = serializeGameState(state);
    await this.redis.hset(key, serialized);
    await this.resetScores(state.gameId);
    return { ok: true, value: state };
  }

  async getGame(gameId: string): Promise<RepositoryResult<StoredGameState>> {
    const key = RedisKeys.game(gameId);
    const raw = await this.redis.hgetall(key);
    const state = deserializeGameState(raw);
    if (!state) {
      return {
        ok: false,
        error: { code: "GAME_NOT_FOUND", message: `Game ${gameId} not found` },
      };
    }
    return { ok: true, value: state };
  }

  async updateGame(
    gameId: string,
    patch: Partial<StoredGameState>,
  ): Promise<RepositoryResult<StoredGameState>> {
    const currentResult = await this.getGame(gameId);
    if (!currentResult.ok) {
      return currentResult;
    }
    const updated: StoredGameState = { ...currentResult.value, ...patch };
    const serialized = serializeGameState(updated);
    await this.redis.hset(RedisKeys.game(gameId), serialized);
    return { ok: true, value: updated };
  }

  async getPublicGameState(gameId: string): Promise<RepositoryResult<StoredPublicState>> {
    const gameResult = await this.getGame(gameId);
    if (!gameResult.ok) {
      return gameResult;
    }
    const game = gameResult.value;
    const countsResult = await this.getCounts(gameId);
    const counts: StoredCounts = countsResult.ok
      ? countsResult.value
      : { total: 0, left: 0, right: 0, chaos: 0, online: 0, offline: 0 };
    const scores = await this.getScores(gameId);
    const planResult = await this.getPlan(gameId);
    const plan = planResult.ok && planResult.value ? planResult.value : null;

    let chaosPlayerId: string | null = null;
    let chaosLabel: string | null = null;
    if (counts.chaos > 0) {
      const chaosMembers = await this.redis.smembers(RedisKeys.teamWild(gameId));
      if (chaosMembers[0]) {
        chaosPlayerId = chaosMembers[0];
        const chaosPlayer = await this.getPlayer(gameId, chaosPlayerId);
        if (chaosPlayer.ok) {
          chaosLabel = chaosPlayer.value.label;
        }
      }
    }

    const publicState: StoredPublicState = {
      sessionId: game.gameId,
      phase: game.phase,
      roundNumber: game.roundNumber,
      counts,
      scores: {
        left: scores.left,
        right: scores.right,
        seq: scores.left + scores.right,
        at: Date.now(),
      },
      timing: {
        durationMs: game.durationMs,
        startTime: game.startTime,
        endTime: game.endTime,
        pausedAt: game.pausedAt,
        pauseAccumMs: game.pauseAccumMs,
        countdownEndsAt: game.countdownEndsAt,
        serverNow: Date.now(),
      },
      plan: plan
        ? {
            targetLeft: plan.targetLeft,
            targetRight: plan.targetRight,
            needLeftToRight: plan.needLeftToRight,
            needRightToLeft: plan.needRightToLeft,
            chaosNeeded: plan.wildcardNeeded === 1,
            remainingLeftToRight: plan.remainingLeftToRight,
            remainingRightToLeft: plan.remainingRightToLeft,
            remainingMs: null,
          }
        : null,
      winner: game.winner,
      chaosPlayerId,
      chaosLabel,
    };

    return { ok: true, value: publicState };
  }

  // ==========================================
  // PLAYERS & MEMBERSHIP
  // ==========================================

  async addOrUpdatePlayer(
    gameId: string,
    player: StoredPlayer,
  ): Promise<RepositoryResult<StoredPlayer>> {
    const key = RedisKeys.players(gameId);
    const serialized = serializePlayer(player);
    await this.redis.hset(key, player.playerId, serialized);

    if (player.team === "left") {
      await this.redis.sadd(RedisKeys.teamLeft(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamRight(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamWild(gameId), player.playerId);
    } else if (player.team === "right") {
      await this.redis.sadd(RedisKeys.teamRight(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamLeft(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamWild(gameId), player.playerId);
    } else if (player.wildcard) {
      await this.redis.sadd(RedisKeys.teamWild(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamLeft(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamRight(gameId), player.playerId);
    } else {
      await this.redis.srem(RedisKeys.teamLeft(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamRight(gameId), player.playerId);
      await this.redis.srem(RedisKeys.teamWild(gameId), player.playerId);
    }

    if (player.status === "online") {
      await this.redis.sadd(RedisKeys.online(gameId), player.playerId);
    } else {
      await this.redis.srem(RedisKeys.online(gameId), player.playerId);
    }

    return { ok: true, value: player };
  }

  async getPlayer(gameId: string, playerId: string): Promise<RepositoryResult<StoredPlayer>> {
    const raw = await this.redis.hget(RedisKeys.players(gameId), playerId);
    const player = deserializePlayer(raw);
    if (!player) {
      return {
        ok: false,
        error: { code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` },
      };
    }
    return { ok: true, value: player };
  }

  async getAllPlayers(gameId: string): Promise<RepositoryResult<StoredPlayer[]>> {
    const rawMap = await this.redis.hgetall(RedisKeys.players(gameId));
    const players = Object.values(rawMap)
      .map((raw) => deserializePlayer(raw))
      .filter((p): p is StoredPlayer => p !== null);
    return { ok: true, value: players };
  }

  async setPlayerOnline(gameId: string, playerId: string, online: boolean): Promise<void> {
    if (online) {
      await this.redis.sadd(RedisKeys.online(gameId), playerId);
    } else {
      await this.redis.srem(RedisKeys.online(gameId), playerId);
    }
    const playerResult = await this.getPlayer(gameId, playerId);
    if (playerResult.ok) {
      const current = playerResult.value;
      const status = online ? "online" : (current.status === "abandoned" ? "abandoned" : "offline");
      const updated: StoredPlayer = {
        ...current,
        status,
        lastSeen: Date.now(),
      };
      await this.redis.hset(RedisKeys.players(gameId), playerId, serializePlayer(updated));
    }
  }

  async getCounts(gameId: string): Promise<RepositoryResult<StoredCounts>> {
    const [leftCount, rightCount, wildCount, onlineCount, totalCount] = await Promise.all([
      this.redis.scard(RedisKeys.teamLeft(gameId)),
      this.redis.scard(RedisKeys.teamRight(gameId)),
      this.redis.scard(RedisKeys.teamWild(gameId)),
      this.redis.scard(RedisKeys.online(gameId)),
      this.redis.hlen(RedisKeys.players(gameId)),
    ]);

    return {
      ok: true,
      value: {
        left: leftCount,
        right: rightCount,
        chaos: wildCount,
        online: onlineCount,
        offline: Math.max(0, totalCount - onlineCount),
        total: totalCount,
      },
    };
  }

  async getRoster(gameId: string): Promise<RepositoryResult<Roster>> {
    const [leftMembers, rightMembers, wildMembers] = await Promise.all([
      this.redis.smembers(RedisKeys.teamLeft(gameId)),
      this.redis.smembers(RedisKeys.teamRight(gameId)),
      this.redis.smembers(RedisKeys.teamWild(gameId)),
    ]);

    const players = [
      ...leftMembers.map((id) => ({ playerId: id, team: "left" as const })),
      ...rightMembers.map((id) => ({ playerId: id, team: "right" as const })),
      ...wildMembers.map((id) => ({ playerId: id, team: "chaos" as const })),
    ];

    return { ok: true, value: { players } };
  }

  // ==========================================
  // SCORES
  // ==========================================

  async getScores(gameId: string): Promise<{ left: number; right: number }> {
    const [left, right] = await Promise.all([
      this.redis.get(RedisKeys.scoreLeft(gameId)),
      this.redis.get(RedisKeys.scoreRight(gameId)),
    ]);
    return {
      left: parseInt(left || "0", 10) || 0,
      right: parseInt(right || "0", 10) || 0,
    };
  }

  async setScores(gameId: string, left: number, right: number): Promise<void> {
    await Promise.all([
      this.redis.set(RedisKeys.scoreLeft(gameId), String(left)),
      this.redis.set(RedisKeys.scoreRight(gameId), String(right)),
    ]);
  }

  // ==========================================
  // PLAN & MOVES
  // ==========================================

  async getPlan(gameId: string): Promise<RepositoryResult<StoredBalancePlan | null>> {
    const raw = await this.redis.hgetall(RedisKeys.plan(gameId));
    if (!raw || Object.keys(raw).length === 0) {
      return { ok: true, value: null };
    }
    const plan = deserializeBalancePlan(raw);
    return { ok: true, value: plan };
  }

  async getMoves(gameId: string): Promise<BalanceMove[]> {
    const rawMoves = await this.redis.lrange(RedisKeys.planMoves(gameId), 0, -1);
    return rawMoves.map((raw) => deserializeMove(raw)).filter((m): m is BalanceMove => m !== null);
  }

  // ==========================================
  // ATOMIC OPERATIONS (LUA)
  // ==========================================

  async chooseOrSwitchTeam(
    gameId: string,
    playerId: string,
    targetTeam: TeamId,
  ): Promise<RepositoryResult<ChooseOrSwitchResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.players(gameId),
      RedisKeys.teamLeft(gameId),
      RedisKeys.teamRight(gameId),
      RedisKeys.teamWild(gameId),
      RedisKeys.online(gameId),
    ];
    const args = [playerId, targetTeam, String(Date.now())];

    const raw = (await this.redis.eval(
      LuaScripts.chooseOrSwitchTeam,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        previousTeam: result.previousTeam,
        newTeam: result.newTeam,
        counts: result.counts,
      },
    };
  }

  async lockAndSnapshot(gameId: string): Promise<RepositoryResult<LockAndSnapshotResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.players(gameId),
      RedisKeys.teamLeft(gameId),
      RedisKeys.teamRight(gameId),
      RedisKeys.teamWild(gameId),
      RedisKeys.online(gameId),
    ];

    const raw = (await this.redis.eval(
      LuaScripts.lockAndSnapshot,
      keys.length,
      ...keys,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        phase: result.phase,
        leftCount: result.leftCount,
        rightCount: result.rightCount,
        wildcardCount: result.wildcardCount,
        totalPlayers: result.totalPlayers,
        onlineCount: result.onlineCount,
        roster: result.roster,
      },
    };
  }

  async writeBalancePlan(
    gameId: string,
    plan: StoredBalancePlan,
    moves: BalanceMove[] = [],
  ): Promise<RepositoryResult<void>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.plan(gameId),
      RedisKeys.planMoves(gameId),
    ];
    const args = [
      String(plan.targetLeft),
      String(plan.targetRight),
      String(plan.wildcardNeeded),
      String(plan.needLeftToRight),
      String(plan.needRightToLeft),
      String(plan.remainingLeftToRight),
      String(plan.remainingRightToLeft),
      plan.wildcardPlayerId ?? "",
      plan.wildcardApplied ? "1" : "0",
      plan.status,
      JSON.stringify(moves),
    ];

    const raw = (await this.redis.eval(
      LuaScripts.writePlan,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return { ok: true, value: undefined };
  }

  async applyVolunteerMove(
    gameId: string,
    playerId: string,
    targetTeam: TeamId,
  ): Promise<RepositoryResult<VolunteerMoveAtomicResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.players(gameId),
      RedisKeys.teamLeft(gameId),
      RedisKeys.teamRight(gameId),
      RedisKeys.teamWild(gameId),
      RedisKeys.plan(gameId),
      RedisKeys.planMoves(gameId),
      RedisKeys.online(gameId),
    ];
    const args = [playerId, targetTeam];

    const raw = (await this.redis.eval(
      LuaScripts.applyVolunteerMove,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        move: result.move,
        remainingLeftToRight: result.remainingLeftToRight,
        remainingRightToLeft: result.remainingRightToLeft,
        status: result.status,
        counts: result.counts,
      },
    };
  }

  async assignWildcard(
    gameId: string,
    playerId: string,
    reason: "wildcard" | "host" | "auto" = "wildcard",
  ): Promise<RepositoryResult<WildcardAtomicResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.players(gameId),
      RedisKeys.teamLeft(gameId),
      RedisKeys.teamRight(gameId),
      RedisKeys.teamWild(gameId),
      RedisKeys.plan(gameId),
      RedisKeys.planMoves(gameId),
      RedisKeys.online(gameId),
    ];
    const args = [playerId, reason];

    const raw = (await this.redis.eval(
      LuaScripts.assignWildcard,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        move: result.move,
        wildcardPlayerId: result.wildcardPlayerId,
        status: result.status,
        counts: result.counts,
      },
    };
  }

  async applyAutoBalance(
    gameId: string,
    moves: BalanceMove[],
    // FIX #5: optional version param for type compatibility with MemoryGameRepository
    // Redis Lua scripts are already atomic so version check is implicit
    _expectedRosterVersion?: number,
  ): Promise<RepositoryResult<AutoBalanceAtomicResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.players(gameId),
      RedisKeys.teamLeft(gameId),
      RedisKeys.teamRight(gameId),
      RedisKeys.teamWild(gameId),
      RedisKeys.plan(gameId),
      RedisKeys.planMoves(gameId),
      RedisKeys.online(gameId),
    ];
    const args = [JSON.stringify(moves)];

    const raw = (await this.redis.eval(
      LuaScripts.applyAutoBalance,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        movesApplied: result.movesApplied,
        status: result.status,
        counts: result.counts,
      },
    };
  }

  async tapIncrement(
    gameId: string,
    playerId: string,
  ): Promise<RepositoryResult<TapIncrementResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.players(gameId),
      RedisKeys.scoreLeft(gameId),
      RedisKeys.scoreRight(gameId),
    ];
    const args = [playerId];

    const raw = (await this.redis.eval(
      LuaScripts.tapIncrement,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        team: result.team,
        newScore: result.newScore,
        scores: result.scores,
        seq: result.seq,
      },
    };
  }

  async startRunning(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<StartRunningResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.scoreLeft(gameId),
      RedisKeys.scoreRight(gameId),
    ];
    const args = [String(now)];

    const raw = (await this.redis.eval(
      LuaScripts.startRunning,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        phase: "RUNNING",
        startTime: result.startTime,
        endTime: result.endTime,
        durationMs: result.durationMs,
      },
    };
  }

  async pauseGame(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<PauseResult>> {
    const keys = [RedisKeys.game(gameId)];
    const args = [String(now)];

    const raw = (await this.redis.eval(
      LuaScripts.pauseGame,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        phase: "PAUSED",
        pausedAt: result.pausedAt,
      },
    };
  }

  async resumeGame(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<ResumeResult>> {
    const keys = [RedisKeys.game(gameId)];
    const args = [String(now)];

    const raw = (await this.redis.eval(
      LuaScripts.resumeGame,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        phase: "RUNNING",
        startTime: result.startTime,
        endTime: result.endTime,
        pausedAt: null,
        pauseAccumMs: result.pauseAccumMs,
        durationMs: result.durationMs,
      },
    };
  }

  async extendTime(
    gameId: string,
    seconds: number,
    now = Date.now(),
  ): Promise<RepositoryResult<ExtendResult>> {
    const keys = [RedisKeys.game(gameId)];
    const args = [String(seconds), String(now)];

    const raw = (await this.redis.eval(
      LuaScripts.extendTime,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        seconds: result.seconds,
        endTime: result.endTime,
        serverNow: result.serverNow,
      },
    };
  }

  async finishGame(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<FinishResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.scoreLeft(gameId),
      RedisKeys.scoreRight(gameId),
    ];
    const args = [String(now)];

    const raw = (await this.redis.eval(
      LuaScripts.finishGame,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        phase: "FINISHED",
        left: result.left,
        right: result.right,
        winner: result.winner,
        roundNumber: result.roundNumber,
      },
    };
  }

  async prepareNextRound(
    gameId: string,
    durationMs = 30000,
    countdownMs = 3000,
    now = Date.now(),
  ): Promise<RepositoryResult<NextRoundResult>> {
    const keys = [
      RedisKeys.game(gameId),
      RedisKeys.scoreLeft(gameId),
      RedisKeys.scoreRight(gameId),
      RedisKeys.teamLeft(gameId),
      RedisKeys.teamRight(gameId),
      RedisKeys.teamWild(gameId),
      RedisKeys.online(gameId),
      RedisKeys.players(gameId),
    ];
    const args = [String(durationMs), String(countdownMs), String(now)];

    const raw = (await this.redis.eval(
      LuaScripts.prepareNextRound,
      keys.length,
      ...keys,
      ...args,
    )) as string;

    const result = JSON.parse(raw);
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }
    return {
      ok: true,
      value: {
        phase: "COUNTDOWN",
        roundNumber: result.roundNumber,
        countdownEndsAt: result.countdownEndsAt,
        durationMs: result.durationMs,
        counts: result.counts,
      },
    };
  }

  async resetScores(gameId: string): Promise<RepositoryResult<void>> {
    await this.redis.mset(
      RedisKeys.scoreLeft(gameId),
      0,
      RedisKeys.scoreRight(gameId),
      0,
    );
    return { ok: true, value: undefined };
  }

  async checkRateLimit(
    playerId: string,
    config?: TapRateLimitConfig,
  ): Promise<RateLimitResult> {
    return checkTapRateLimit(this.redis, playerId, config);
  }
}

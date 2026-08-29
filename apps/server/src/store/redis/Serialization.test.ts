import { describe, expect, it } from "vitest";
import {
  deserializeBalancePlan,
  deserializeGameState,
  deserializeMove,
  deserializePlayer,
  serializeBalancePlan,
  serializeGameState,
  serializeMove,
  serializePlayer,
} from "./serialization.js";
import type { StoredBalancePlan, StoredGameState, StoredPlayer } from "./types.js";
import type { BalanceMove } from "../../engine/balance/types.js";
import { RedisKeys } from "./keys.js";

describe("RedisKeys Schema", () => {
  it("builds exact required keys with tow: prefix", () => {
    const gameId = "game_test_123";
    const playerId = "p_456";

    expect(RedisKeys.currentEvent()).toBe("tow:event:current");
    expect(RedisKeys.game(gameId)).toBe("tow:game:game_test_123");
    expect(RedisKeys.players(gameId)).toBe("tow:game:game_test_123:players");
    expect(RedisKeys.teamLeft(gameId)).toBe("tow:game:game_test_123:team:left");
    expect(RedisKeys.teamRight(gameId)).toBe("tow:game:game_test_123:team:right");
    expect(RedisKeys.teamWild(gameId)).toBe("tow:game:game_test_123:team:wild");
    expect(RedisKeys.online(gameId)).toBe("tow:game:game_test_123:online");
    expect(RedisKeys.scoreLeft(gameId)).toBe("tow:game:game_test_123:score:left");
    expect(RedisKeys.scoreRight(gameId)).toBe("tow:game:game_test_123:score:right");
    expect(RedisKeys.plan(gameId)).toBe("tow:game:game_test_123:plan");
    expect(RedisKeys.planMoves(gameId)).toBe("tow:game:game_test_123:plan:moves");
    expect(RedisKeys.rateLimitTap(playerId)).toBe("tow:rl:tap:p_456");
  });
});

describe("Serialization & Deserialization", () => {
  it("round-trips StoredGameState with nulls and full values", () => {
    const state: StoredGameState = {
      gameId: "g1",
      phase: "RUNNING",
      roundNumber: 2,
      createdAt: 1700000000000,
      durationMs: 45000,
      startTime: 1700000010000,
      endTime: 1700000055000,
      pausedAt: null,
      pauseAccumMs: 500,
      countdownEndsAt: null,
      winner: "left",
      joinAllowed: false,
    };

    const hash = serializeGameState(state);
    const restored = deserializeGameState(hash);
    expect(restored).toEqual(state);
  });

  it("handles null or missing game state cleanly", () => {
    expect(deserializeGameState(null)).toBeNull();
    expect(deserializeGameState({})).toBeNull();
    expect(deserializeGameState({ gameId: "g1" })).toBeNull();
  });

  it("round-trips StoredPlayer with left, right, and chaos", () => {
    const leftPlayer: StoredPlayer = {
      playerId: "p1",
      label: "Player 1",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 1000,
      lastSeen: 2000,
    };
    const chaosPlayer: StoredPlayer = {
      playerId: "p2",
      label: "Player 2",
      team: null,
      wildcard: true,
      status: "offline",
      joinedAt: 1050,
      lastSeen: 2050,
    };

    expect(deserializePlayer(serializePlayer(leftPlayer))).toEqual(leftPlayer);
    expect(deserializePlayer(serializePlayer(chaosPlayer))).toEqual(chaosPlayer);
  });

  it("handles corrupt player JSON gracefully without throwing", () => {
    expect(deserializePlayer("")).toBeNull();
    expect(deserializePlayer("not a json string")).toBeNull();
    expect(deserializePlayer(JSON.stringify({ noPlayerId: true }))).toBeNull();
  });

  it("round-trips StoredBalancePlan", () => {
    const plan: StoredBalancePlan = {
      targetLeft: 108,
      targetRight: 108,
      wildcardNeeded: 1,
      needLeftToRight: 14,
      needRightToLeft: 0,
      remainingLeftToRight: 14,
      remainingRightToLeft: 0,
      wildcardPlayerId: "p-left-001",
      wildcardApplied: false,
      status: "needs_moves",
    };

    const hash = serializeBalancePlan(plan);
    const restored = deserializeBalancePlan(hash);
    expect(restored).toEqual(plan);
  });

  it("round-trips BalanceMove", () => {
    const teamMove: BalanceMove = {
      kind: "team_switch",
      playerId: "p1",
      from: "left",
      to: "right",
      reason: "volunteer",
      sequence: 1,
    };
    const wildMove: BalanceMove = {
      kind: "wildcard",
      playerId: "p2",
      from: "left",
      to: "chaos",
      reason: "auto",
      sequence: 2,
    };

    expect(deserializeMove(serializeMove(teamMove))).toEqual(teamMove);
    expect(deserializeMove(serializeMove(wildMove))).toEqual(wildMove);
    expect(deserializeMove("invalid")).toBeNull();
  });
});

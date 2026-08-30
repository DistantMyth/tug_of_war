import type { TeamId, Winner } from "@tow/shared";
import type { BalanceMove, Roster } from "../../engine/balance/types.js";
import type { TapRateLimitConfig } from "./rateLimit.js";
import {
  deserializeGameState,
  deserializePlayer,
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
  RepositoryError,
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

/**
 * MemoryGameRepository
 *
 * In-memory ephemeral repository used for unit/integration testing and local development
 * when Redis is not configured.
 *
 * Persistence Architecture:
 * - Without Redis (Development/Testing):
 *   Current session state and player rosters reside purely in Node.js process memory.
 *   Restarting the Node.js process clears the active game session and player rosters.
 *
 * - With Redis (Production/Staging):
 *   RedisGameRepository stores active sessions, rosters, bitfields, and scores in Redis.
 *   Live game sessions persist through Node.js process restarts and server upgrades.
 */
export class MemoryGameRepository {
  private currentEventId: string | null = null;
  private games = new Map<string, StoredGameState>();
  private players = new Map<string, Map<string, StoredPlayer>>(); // gameId -> (playerId -> StoredPlayer)
  private teamLeft = new Map<string, Set<string>>(); // gameId -> Set<playerId>
  private teamRight = new Map<string, Set<string>>(); // gameId -> Set<playerId>
  private teamWild = new Map<string, Set<string>>(); // gameId -> Set<playerId>
  private onlinePlayers = new Map<string, Set<string>>(); // gameId -> Set<playerId>
  private scores = new Map<string, { left: number; right: number }>();
  private plans = new Map<string, StoredBalancePlan>();
  private planMoves = new Map<string, BalanceMove[]>();
  private rateLimits = new Map<string, { count: number; expiresAt: number }>();
  // FIX #2: in-flight guard for startRunning to prevent concurrent COUNTDOWN→RUNNING
  _startingGames = new Set<string>();
  // FIX #4: per-game registration mutex (promise chain) to serialize concurrent registrations
  private _registrationChain = new Map<string, Promise<void>>();
  // FIX #5: roster version counter — incremented on every team-changing operation
  private _rosterVersion = new Map<string, number>();

  // ==========================================
  // HELPERS
  // ==========================================

  private getLeftSet(gameId: string): Set<string> {
    let set = this.teamLeft.get(gameId);
    if (!set) {
      set = new Set();
      this.teamLeft.set(gameId, set);
    }
    return set;
  }

  private getRightSet(gameId: string): Set<string> {
    let set = this.teamRight.get(gameId);
    if (!set) {
      set = new Set();
      this.teamRight.set(gameId, set);
    }
    return set;
  }

  private getWildSet(gameId: string): Set<string> {
    let set = this.teamWild.get(gameId);
    if (!set) {
      set = new Set();
      this.teamWild.set(gameId, set);
    }
    return set;
  }

  private getOnlineSet(gameId: string): Set<string> {
    let set = this.onlinePlayers.get(gameId);
    if (!set) {
      set = new Set();
      this.onlinePlayers.set(gameId, set);
    }
    return set;
  }

  private getPlayersMap(gameId: string): Map<string, StoredPlayer> {
    let map = this.players.get(gameId);
    if (!map) {
      map = new Map();
      this.players.set(gameId, map);
    }
    return map;
  }

  // ==========================================
  // SESSION POINTER
  // ==========================================

  async getCurrentGameId(): Promise<string | null> {
    return this.currentEventId;
  }

  async setCurrentGameId(gameId: string): Promise<void> {
    this.currentEventId = gameId;
  }

  async clearCurrentGameId(): Promise<void> {
    this.currentEventId = null;
  }

  // ==========================================
  // GAME STATE
  // ==========================================

  async createGame(state: StoredGameState): Promise<RepositoryResult<StoredGameState>> {
    // Round-trip through serializer to guarantee identical validation
    const serialized = serializeGameState(state);
    const deserialized = deserializeGameState(serialized)!;
    this.games.set(state.gameId, deserialized);
    this.players.set(state.gameId, new Map());
    this.teamLeft.set(state.gameId, new Set());
    this.teamRight.set(state.gameId, new Set());
    this.teamWild.set(state.gameId, new Set());
    this.onlinePlayers.set(state.gameId, new Set());
    this.scores.set(state.gameId, { left: 0, right: 0 });
    this.plans.delete(state.gameId);
    this.planMoves.delete(state.gameId);
    this._rosterVersion.set(state.gameId, 0); // FIX #5: initialize roster version
    this._registrationChain.set(state.gameId, Promise.resolve()); // FIX #4: init mutex
    return { ok: true, value: deserialized };
  }

  async getGame(gameId: string): Promise<RepositoryResult<StoredGameState>> {
    const game = this.games.get(gameId);
    if (!game) {
      return {
        ok: false,
        error: { code: "GAME_NOT_FOUND", message: `Game ${gameId} not found` },
      };
    }
    return { ok: true, value: { ...game } };
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
    this.games.set(gameId, updated);
    return { ok: true, value: { ...updated } };
  }

  async getPublicGameState(gameId: string): Promise<RepositoryResult<StoredPublicState>> {
    const gameResult = await this.getGame(gameId);
    if (!gameResult.ok) {
      return gameResult;
    }
    const game = gameResult.value;
    const countsResult = await this.getCounts(gameId);
    const counts = countsResult.ok
      ? countsResult.value
      : { total: 0, left: 0, right: 0, chaos: 0, online: 0, offline: 0 };
    const scores = await this.getScores(gameId);
    const planResult = await this.getPlan(gameId);
    const plan = planResult.ok ? planResult.value : null;

    let chaosPlayerId: string | null = null;
    let chaosLabel: string | null = null;
    if (counts.chaos > 0) {
      const wildSet = this.getWildSet(gameId);
      const firstChaos = Array.from(wildSet)[0];
      if (firstChaos) {
        chaosPlayerId = firstChaos;
        const player = await this.getPlayer(gameId, firstChaos);
        if (player.ok) {
          chaosLabel = player.value.label;
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
    const raw = serializePlayer(player);
    const stored = deserializePlayer(raw)!;
    this.getPlayersMap(gameId).set(player.playerId, stored);

    const leftSet = this.getLeftSet(gameId);
    const rightSet = this.getRightSet(gameId);
    const wildSet = this.getWildSet(gameId);

    if (player.team === "left") {
      leftSet.add(player.playerId);
      rightSet.delete(player.playerId);
      wildSet.delete(player.playerId);
    } else if (player.team === "right") {
      rightSet.add(player.playerId);
      leftSet.delete(player.playerId);
      wildSet.delete(player.playerId);
    } else if (player.wildcard) {
      wildSet.add(player.playerId);
      leftSet.delete(player.playerId);
      rightSet.delete(player.playerId);
    } else {
      leftSet.delete(player.playerId);
      rightSet.delete(player.playerId);
      wildSet.delete(player.playerId);
    }

    if (player.status === "online") {
      this.getOnlineSet(gameId).add(player.playerId);
    } else {
      this.getOnlineSet(gameId).delete(player.playerId);
    }

    return { ok: true, value: { ...stored } };
  }

  async getPlayer(gameId: string, playerId: string): Promise<RepositoryResult<StoredPlayer>> {
    const player = this.getPlayersMap(gameId).get(playerId);
    if (!player) {
      return {
        ok: false,
        error: { code: "PLAYER_NOT_FOUND", message: `Player ${playerId} not found` },
      };
    }
    return { ok: true, value: { ...player } };
  }

  async getAllPlayers(gameId: string): Promise<RepositoryResult<StoredPlayer[]>> {
    const playersMap = this.getPlayersMap(gameId);
    const players = Array.from(playersMap.values()).map((p) => ({ ...p }));
    return { ok: true, value: players };
  }

  async setPlayerOnline(gameId: string, playerId: string, online: boolean): Promise<void> {
    if (online) {
      this.getOnlineSet(gameId).add(playerId);
    } else {
      this.getOnlineSet(gameId).delete(playerId);
    }
    const player = this.getPlayersMap(gameId).get(playerId);
    if (player) {
      player.status = online ? "online" : (player.status === "abandoned" ? "abandoned" : "offline");
      player.lastSeen = Date.now();
    }
  }

  async getCounts(gameId: string): Promise<RepositoryResult<StoredCounts>> {
    const left = this.getLeftSet(gameId).size;
    const right = this.getRightSet(gameId).size;
    const chaos = this.getWildSet(gameId).size;
    const online = this.getOnlineSet(gameId).size;
    const total = this.getPlayersMap(gameId).size;

    return {
      ok: true,
      value: {
        left,
        right,
        chaos,
        online,
        offline: Math.max(0, total - online),
        total,
      },
    };
  }

  async getRoster(gameId: string): Promise<RepositoryResult<Roster>> {
    const leftMembers = Array.from(this.getLeftSet(gameId));
    const rightMembers = Array.from(this.getRightSet(gameId));
    const wildMembers = Array.from(this.getWildSet(gameId));

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
    const score = this.scores.get(gameId) ?? { left: 0, right: 0 };
    return { ...score };
  }

  async setScores(gameId: string, left: number, right: number): Promise<void> {
    this.scores.set(gameId, { left, right });
  }

  // ==========================================
  // PLAN & MOVES
  // ==========================================

  async getPlan(gameId: string): Promise<RepositoryResult<StoredBalancePlan | null>> {
    const plan = this.plans.get(gameId) ?? null;
    return { ok: true, value: plan ? { ...plan } : null };
  }

  async getMoves(gameId: string): Promise<BalanceMove[]> {
    const moves = this.planMoves.get(gameId) ?? [];
    return moves.map((m) => ({ ...m }));
  }

  // ==========================================
  // ATOMIC OPERATIONS
  // ==========================================

  async chooseOrSwitchTeam(
    gameId: string,
    playerId: string,
    targetTeam: TeamId,
  ): Promise<RepositoryResult<ChooseOrSwitchResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "OPEN") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Team switching is only allowed during OPEN phase" },
      };
    }
    if (targetTeam !== "left" && targetTeam !== "right") {
      return {
        ok: false,
        error: { code: "INVALID_TEAM", message: "Target team must be left or right" },
      };
    }

    const player = this.getPlayersMap(gameId).get(playerId);
    if (!player) {
      return { ok: false, error: { code: "PLAYER_NOT_FOUND", message: "Player not found" } };
    }
    if (player.status === "abandoned") {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "Player is marked abandoned" },
      };
    }

    const previousTeam = player.team;
    const leftSet = this.getLeftSet(gameId);
    const rightSet = this.getRightSet(gameId);
    const wildSet = this.getWildSet(gameId);

    // Idempotent success if already on team
    if (previousTeam === targetTeam && !player.wildcard) {
      const countsResult = await this.getCounts(gameId);
      return {
        ok: true,
        value: {
          previousTeam,
          newTeam: targetTeam,
          counts: countsResult.ok ? countsResult.value : ({} as any),
        },
      };
    }

    // Atomic move
    if (previousTeam === "left") {
      leftSet.delete(playerId);
    } else if (previousTeam === "right") {
      rightSet.delete(playerId);
    } else if (previousTeam === "chaos" || player.wildcard) {
      wildSet.delete(playerId);
    }

    if (targetTeam === "left") {
      leftSet.add(playerId);
    } else {
      rightSet.add(playerId);
    }

    player.team = targetTeam;
    player.wildcard = false;
    player.lastSeen = Date.now();
    // FIX #5: increment roster version so stale auto-balance plans are detected
    this._rosterVersion.set(gameId, (this._rosterVersion.get(gameId) ?? 0) + 1);

    const countsResult = await this.getCounts(gameId);
    return {
      ok: true,
      value: {
        previousTeam,
        newTeam: targetTeam,
        counts: countsResult.ok ? countsResult.value : ({} as StoredCounts),
      },
    };
  }

  async lockAndSnapshot(gameId: string): Promise<RepositoryResult<LockAndSnapshotResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "OPEN") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Game can only be locked from OPEN phase" },
      };
    }

    game.phase = "LOCKING";
    game.joinAllowed = false;

    const leftMembers = Array.from(this.getLeftSet(gameId));
    const rightMembers = Array.from(this.getRightSet(gameId));
    const wildMembers = Array.from(this.getWildSet(gameId));
    const onlineCount = this.getOnlineSet(gameId).size;
    const totalPlayers = this.getPlayersMap(gameId).size;

    const roster = [
      ...leftMembers.map((id) => ({ playerId: id, team: "left" as const })),
      ...rightMembers.map((id) => ({ playerId: id, team: "right" as const })),
      ...wildMembers.map((id) => ({ playerId: id, team: "chaos" as const })),
    ];

    return {
      ok: true,
      value: {
        phase: "LOCKING",
        leftCount: leftMembers.length,
        rightCount: rightMembers.length,
        wildcardCount: wildMembers.length,
        totalPlayers,
        onlineCount,
        roster,
      },
    };
  }

  async writeBalancePlan(
    gameId: string,
    plan: StoredBalancePlan,
    moves: BalanceMove[] = [],
  ): Promise<RepositoryResult<void>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "LOCKING" && game.phase !== "BALANCING") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Balance plan can only be written during LOCKING or BALANCING phase" },
      };
    }

    this.plans.set(gameId, { ...plan });
    if (moves && moves.length > 0) {
      this.planMoves.set(gameId, moves.map((m) => ({ ...m })));
    } else {
      this.planMoves.set(gameId, []);
    }

    return { ok: true, value: undefined };
  }

  async applyVolunteerMove(
    gameId: string,
    playerId: string,
    targetTeam: TeamId,
  ): Promise<RepositoryResult<VolunteerMoveAtomicResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "BALANCING") {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "Volunteer moves are only allowed during BALANCING phase" },
      };
    }

    const plan = this.plans.get(gameId);
    if (!plan) {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "No active balance plan" },
      };
    }

    const player = this.getPlayersMap(gameId).get(playerId);
    if (!player) {
      return { ok: false, error: { code: "PLAYER_NOT_FOUND", message: "Player not found" } };
    }
    if (player.team === "chaos" || player.wildcard || plan.wildcardPlayerId === playerId) {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "CHAOS PLAYER cannot volunteer" },
      };
    }

    let expectedFrom: TeamId;
    let expectedTo: TeamId;
    if (plan.remainingLeftToRight > 0) {
      expectedFrom = "left";
      expectedTo = "right";
    } else if (plan.remainingRightToLeft > 0) {
      expectedFrom = "right";
      expectedTo = "left";
    } else {
      return {
        ok: false,
        error: { code: "MOVE_WOULD_OVERSHOOT", message: "Team balance already achieved" },
      };
    }

    if (player.team !== expectedFrom || targetTeam !== expectedTo) {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "Only surplus-team players may volunteer toward deficit team" },
      };
    }

    const leftSet = this.getLeftSet(gameId);
    const rightSet = this.getRightSet(gameId);

    if (expectedFrom === "left") {
      leftSet.delete(playerId);
      rightSet.add(playerId);
      plan.remainingLeftToRight -= 1;
    } else {
      rightSet.delete(playerId);
      leftSet.add(playerId);
      plan.remainingRightToLeft -= 1;
    }

    player.team = expectedTo;
    // FIX #5: increment roster version so stale auto-balance plans are detected
    this._rosterVersion.set(gameId, (this._rosterVersion.get(gameId) ?? 0) + 1);

    if (plan.remainingLeftToRight === 0 && plan.remainingRightToLeft === 0) {
      plan.status = plan.wildcardNeeded === 1 && !plan.wildcardApplied ? "needs_wildcard" : "complete";
    } else {
      plan.status = "needs_moves";
    }

    let moves = this.planMoves.get(gameId);
    if (!moves) {
      moves = [];
      this.planMoves.set(gameId, moves);
    }
    const moveObj: BalanceMove = {
      kind: "team_switch",
      playerId,
      from: expectedFrom,
      to: expectedTo,
      reason: "volunteer",
      sequence: moves.length + 1,
    };
    moves.push(moveObj);

    const countsResult = await this.getCounts(gameId);
    return {
      ok: true,
      value: {
        move: moveObj,
        remainingLeftToRight: plan.remainingLeftToRight,
        remainingRightToLeft: plan.remainingRightToLeft,
        status: plan.status,
        counts: countsResult.ok ? countsResult.value : ({} as StoredCounts),
      },
    };
  }

  async assignWildcard(
    gameId: string,
    playerId: string,
    reason: "wildcard" | "host" | "auto" = "wildcard",
  ): Promise<RepositoryResult<WildcardAtomicResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "BALANCING" && game.phase !== "LOCKING") {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "Wildcard assignment only allowed during BALANCING or LOCKING" },
      };
    }

    const plan = this.plans.get(gameId);
    if (!plan || plan.wildcardNeeded !== 1) {
      return {
        ok: false,
        error: { code: "WILDCARD_NOT_ALLOWED", message: "This game does not require a wildcard" },
      };
    }

    const wildSet = this.getWildSet(gameId);
    if (wildSet.size > 0) {
      return {
        ok: false,
        error: { code: "WILDCARD_ALREADY_ASSIGNED", message: "Wildcard is already assigned" },
      };
    }

    const player = this.getPlayersMap(gameId).get(playerId);
    if (!player) {
      return { ok: false, error: { code: "PLAYER_NOT_FOUND", message: "Player not found" } };
    }
    const fromTeam = player.team;
    if (fromTeam !== "left" && fromTeam !== "right") {
      return {
        ok: false,
        error: { code: "INVALID_TEAM", message: "Wildcard candidate must be on left or right" },
      };
    }

    const leftSet = this.getLeftSet(gameId);
    const rightSet = this.getRightSet(gameId);

    if (fromTeam === "left") {
      leftSet.delete(playerId);
    } else {
      rightSet.delete(playerId);
    }
    wildSet.add(playerId);

    player.team = "chaos";
    player.wildcard = true;

    plan.wildcardPlayerId = playerId;
    plan.wildcardApplied = true;
    if (plan.remainingLeftToRight === 0 && plan.remainingRightToLeft === 0) {
      plan.status = "complete";
    }

    let moves = this.planMoves.get(gameId);
    if (!moves) {
      moves = [];
      this.planMoves.set(gameId, moves);
    }
    const moveObj: BalanceMove = {
      kind: "wildcard",
      playerId,
      from: fromTeam,
      to: "chaos",
      reason,
      sequence: moves.length + 1,
    };
    moves.push(moveObj);
    // FIX #5: increment roster version so stale auto-balance plans are detected
    this._rosterVersion.set(gameId, (this._rosterVersion.get(gameId) ?? 0) + 1);

    const countsResult = await this.getCounts(gameId);
    return {
      ok: true,
      value: {
        move: moveObj,
        wildcardPlayerId: playerId,
        status: plan.status,
        counts: countsResult.ok ? countsResult.value : ({} as StoredCounts),
      },
    };
  }

  /**
   * FIX #5: Version-checked applyAutoBalance.
   * expectedRosterVersion must match the current roster version; if roster changed since preview, reject.
   */
  async applyAutoBalance(
    gameId: string,
    moves: BalanceMove[],
    expectedRosterVersion?: number,
  ): Promise<RepositoryResult<AutoBalanceAtomicResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "BALANCING") {
      return {
        ok: false,
        error: { code: "MOVE_NOT_ALLOWED", message: "Auto balance can only be applied during BALANCING phase" },
      };
    }

    // FIX #5: version check — if any team-changing op happened since preview, reject
    if (expectedRosterVersion !== undefined) {
      const currentVersion = this._rosterVersion.get(gameId) ?? 0;
      if (currentVersion !== expectedRosterVersion) {
        return {
          ok: false,
          error: {
            code: "CONCURRENT_MODIFICATION",
            message: `Roster changed since preview (expected v${expectedRosterVersion}, current v${currentVersion}). Please re-preview.`,
          },
        };
      }
    }

    const playersMap = this.getPlayersMap(gameId);
    // Pre-validation: verify each player exists and is on expected from team
    for (const move of moves) {
      const p = playersMap.get(move.playerId);
      if (!p) {
        return {
          ok: false,
          error: { code: "PLAYER_NOT_FOUND", message: `Player ${move.playerId} not found` },
        };
      }
      if (p.team !== move.from) {
        return {
          ok: false,
          error: {
            code: "CONCURRENT_MODIFICATION",
            message: `Player ${move.playerId} is no longer on team ${move.from}`,
          },
        };
      }
    }

    const leftSet = this.getLeftSet(gameId);
    const rightSet = this.getRightSet(gameId);
    const wildSet = this.getWildSet(gameId);
    const plan = this.plans.get(gameId);

    let existingMoves = this.planMoves.get(gameId);
    if (!existingMoves) {
      existingMoves = [];
      this.planMoves.set(gameId, existingMoves);
    }

    let wildcardPlayerId = plan?.wildcardPlayerId ?? null;

    for (const move of moves) {
      if (move.from === "left") {
        leftSet.delete(move.playerId);
      } else if (move.from === "right") {
        rightSet.delete(move.playerId);
      }

      if (move.to === "left") {
        leftSet.add(move.playerId);
      } else if (move.to === "right") {
        rightSet.add(move.playerId);
      } else if (move.to === "chaos") {
        wildSet.add(move.playerId);
        wildcardPlayerId = move.playerId;
      }

      const p = playersMap.get(move.playerId)!;
      p.team = move.to === "chaos" ? "chaos" : move.to;
      p.wildcard = move.to === "chaos";

      existingMoves.push({ ...move });
    }

    if (plan) {
      plan.remainingLeftToRight = 0;
      plan.remainingRightToLeft = 0;
      plan.wildcardApplied = plan.wildcardNeeded === 1;
      plan.wildcardPlayerId = wildcardPlayerId;
      plan.status = "complete";
    }

    // FIX #5: bump roster version after applying moves
    this._rosterVersion.set(gameId, (this._rosterVersion.get(gameId) ?? 0) + 1);

    const countsResult = await this.getCounts(gameId);
    return {
      ok: true,
      value: {
        movesApplied: moves.length,
        status: "complete",
        counts: countsResult.ok ? countsResult.value : ({} as StoredCounts),
      },
    };
  }

  // FIX #4: atomic registration — returns the current roster version for use in plans
  getRosterVersion(gameId: string): number {
    return this._rosterVersion.get(gameId) ?? 0;
  }

  /**
   * FIX #4: Atomically register a new player, serialized per-game to prevent label collisions.
   * The promise chain ensures only one registration runs at a time per game.
   */
  async atomicRegisterPlayer(
    gameId: string,
    buildPlayer: (existingCount: number) => StoredPlayer,
  ): Promise<RepositoryResult<StoredPlayer>> {
    // Get or initialize the chain for this game
    let chain = this._registrationChain.get(gameId);
    if (!chain) {
      chain = Promise.resolve();
      this._registrationChain.set(gameId, chain);
    }

    let resolveOuter!: (p: StoredPlayer) => void;
    let rejectOuter!: (e: RepositoryError) => void;
    const resultPromise = new Promise<StoredPlayer>((res, rej) => {
      resolveOuter = res;
      rejectOuter = rej;
    });

    // Chain: each registration waits for the previous one to complete
    const newChain = chain.then(async () => {
      const game = this.games.get(gameId);
      if (!game) {
        rejectOuter({ code: "GAME_NOT_FOUND", message: "Game not found" });
        return;
      }
      // Count only non-abandoned players for label sequence
      const playersMap = this.getPlayersMap(gameId);
      const activeCount = Array.from(playersMap.values()).filter((p) => p.status !== "abandoned").length;
      const player = buildPlayer(activeCount);

      const raw = serializePlayer(player);
      const stored = deserializePlayer(raw)!;
      playersMap.set(player.playerId, stored);

      const leftSet = this.getLeftSet(gameId);
      const rightSet = this.getRightSet(gameId);
      const wildSet = this.getWildSet(gameId);

      if (player.team === "left") {
        leftSet.add(player.playerId);
        rightSet.delete(player.playerId);
        wildSet.delete(player.playerId);
      } else if (player.team === "right") {
        rightSet.add(player.playerId);
        leftSet.delete(player.playerId);
        wildSet.delete(player.playerId);
      } else if (player.wildcard) {
        wildSet.add(player.playerId);
        leftSet.delete(player.playerId);
        rightSet.delete(player.playerId);
      }

      if (player.status === "online") {
        this.getOnlineSet(gameId).add(player.playerId);
      } else {
        this.getOnlineSet(gameId).delete(player.playerId);
      }

      resolveOuter({ ...stored });
    }).catch((err) => {
      rejectOuter({ code: "GAME_NOT_FOUND", message: String(err) });
    });

    this._registrationChain.set(gameId, newChain);

    try {
      const player = await resultPromise;
      return { ok: true, value: player };
    } catch (err) {
      const e = err as RepositoryError;
      return { ok: false, error: e };
    }
  }

  async tapIncrement(
    gameId: string,
    playerId: string,
  ): Promise<RepositoryResult<TapIncrementResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "RUNNING") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Tapping is only allowed during RUNNING phase" },
      };
    }

    const player = this.getPlayersMap(gameId).get(playerId);
    if (!player) {
      return { ok: false, error: { code: "PLAYER_NOT_FOUND", message: "Player not found" } };
    }
    const team = player.team;
    if (team !== "left" && team !== "right") {
      return {
        ok: false,
        error: { code: "INVALID_TEAM", message: "CHAOS PLAYER or unassigned player cannot score" },
      };
    }

    let score = this.scores.get(gameId);
    if (!score) {
      score = { left: 0, right: 0 };
      this.scores.set(gameId, score);
    }

    if (team === "left") {
      score.left += 1;
    } else {
      score.right += 1;
    }

    const seq = score.left + score.right;
    return {
      ok: true,
      value: {
        team,
        newScore: team === "left" ? score.left : score.right,
        scores: { left: score.left, right: score.right },
        seq,
      },
    };
  }

  async startRunning(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<StartRunningResult>> {
    // Atomically check and acquire lock — prevents concurrent COUNTDOWN→RUNNING races
    if (this._startingGames.has(gameId)) {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "startRunning already in progress for this game" },
      };
    }
    this._startingGames.add(gameId);
    try {
      const game = this.games.get(gameId);
      if (!game) {
        return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
      }
      // CRITICAL FIX #2: only COUNTDOWN → RUNNING is valid. RUNNING → RUNNING resets scores, which is unacceptable.
      if (game.phase !== "COUNTDOWN") {
        return {
          ok: false,
          error: { code: "INVALID_PHASE", message: `Cannot start RUNNING from phase ${game.phase}. Only COUNTDOWN is valid.` },
        };
      }

      const durationMs = game.durationMs || 30000;
      const startTime = now;
      const endTime = now + durationMs;

      game.phase = "RUNNING";
      game.startTime = startTime;
      game.endTime = endTime;
      game.pausedAt = null;
      game.pauseAccumMs = 0;
      game.countdownEndsAt = null;

      // Scores are reset only on the legitimate COUNTDOWN→RUNNING transition
      this.scores.set(gameId, { left: 0, right: 0 });

      return {
        ok: true,
        value: {
          phase: "RUNNING",
          startTime,
          endTime,
          durationMs,
        },
      };
    } finally {
      this._startingGames.delete(gameId);
    }
  }

  async pauseGame(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<PauseResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "RUNNING") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Game can only be paused during RUNNING phase" },
      };
    }

    game.phase = "PAUSED";
    game.pausedAt = now;

    return {
      ok: true,
      value: {
        phase: "PAUSED",
        pausedAt: now,
      },
    };
  }

  async resumeGame(
    gameId: string,
    now = Date.now(),
  ): Promise<RepositoryResult<ResumeResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "PAUSED") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Game can only be resumed from PAUSED phase" },
      };
    }

    const pausedAt = game.pausedAt ?? now;
    const delta = Math.max(0, now - pausedAt);
    const newEndTime = (game.endTime ?? now) + delta;
    const newPauseAccum = game.pauseAccumMs + delta;

    game.phase = "RUNNING";
    game.pausedAt = null;
    game.pauseAccumMs = newPauseAccum;
    game.endTime = newEndTime;

    return {
      ok: true,
      value: {
        phase: "RUNNING",
        startTime: game.startTime,
        endTime: newEndTime,
        pausedAt: null,
        pauseAccumMs: newPauseAccum,
        durationMs: game.durationMs,
      },
    };
  }

  async extendTime(
    gameId: string,
    seconds: number,
    now = Date.now(),
  ): Promise<RepositoryResult<ExtendResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "RUNNING") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Time extension is only allowed while RUNNING" },
      };
    }

    const currentEndTime = game.endTime ?? now;
    const newEndTime = currentEndTime + seconds * 1000;
    game.endTime = newEndTime;

    return {
      ok: true,
      value: {
        seconds,
        endTime: newEndTime,
        serverNow: now,
      },
    };
  }

  async finishGame(
    gameId: string,
    _now = Date.now(),
  ): Promise<RepositoryResult<FinishResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }

    const score = this.scores.get(gameId) ?? { left: 0, right: 0 };
    const roundNumber = game.roundNumber || 1;

    if (game.phase === "FINISHED" || game.phase === "RESULTS") {
      return {
        ok: true,
        value: {
          phase: "FINISHED",
          left: score.left,
          right: score.right,
          winner: game.winner ?? "draw",
          roundNumber,
        },
      };
    }

    if (game.phase !== "RUNNING" && game.phase !== "PAUSED") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Game can only be finished from RUNNING or PAUSED phase" },
      };
    }

    let winner: Winner = "draw";
    if (score.left > score.right) {
      winner = "left";
    } else if (score.right > score.left) {
      winner = "right";
    }

    game.phase = "FINISHED";
    game.winner = winner;

    return {
      ok: true,
      value: {
        phase: "FINISHED",
        left: score.left,
        right: score.right,
        winner,
        roundNumber,
      },
    };
  }

  async prepareNextRound(
    gameId: string,
    durationMs = 30000,
    countdownMs = 3000,
    now = Date.now(),
  ): Promise<RepositoryResult<NextRoundResult>> {
    const game = this.games.get(gameId);
    if (!game) {
      return { ok: false, error: { code: "GAME_NOT_FOUND", message: "Game not found" } };
    }
    if (game.phase !== "FINISHED" && game.phase !== "RESULTS") {
      return {
        ok: false,
        error: { code: "INVALID_PHASE", message: "Next round can only be prepared from FINISHED or RESULTS phase" },
      };
    }

    const nextRound = (game.roundNumber || 1) + 1;
    const countdownEndsAt = now + countdownMs;

    game.phase = "COUNTDOWN";
    game.roundNumber = nextRound;
    game.durationMs = durationMs;
    game.countdownEndsAt = countdownEndsAt;
    game.startTime = null;
    game.endTime = null;
    game.pausedAt = null;
    game.pauseAccumMs = 0;
    game.winner = null;

    this.scores.set(gameId, { left: 0, right: 0 });

    const countsResult = await this.getCounts(gameId);
    return {
      ok: true,
      value: {
        phase: "COUNTDOWN",
        roundNumber: nextRound,
        countdownEndsAt,
        durationMs,
        counts: countsResult.ok ? countsResult.value : ({} as any),
      },
    };
  }

  async resetScores(gameId: string): Promise<RepositoryResult<void>> {
    this.scores.set(gameId, { left: 0, right: 0 });
    return { ok: true, value: undefined };
  }

  async checkRateLimit(
    playerId: string,
    config?: TapRateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config?.windowMs ?? 1000;
    const maxBurst = config?.maxBurst ?? 15;

    let bucket = this.rateLimits.get(playerId);
    if (!bucket || now >= bucket.expiresAt) {
      bucket = { count: 1, expiresAt: now + windowMs };
      this.rateLimits.set(playerId, bucket);
      return { allowed: true, current: 1, maxAllowed: maxBurst };
    }

    bucket.count += 1;
    if (bucket.count > maxBurst) {
      return {
        allowed: false,
        current: bucket.count,
        maxAllowed: maxBurst,
        retryAfterMs: Math.max(0, bucket.expiresAt - now),
      };
    }

    return { allowed: true, current: bucket.count, maxAllowed: maxBurst };
  }
}

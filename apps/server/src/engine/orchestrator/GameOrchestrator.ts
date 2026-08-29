import crypto from "node:crypto";
import type {
  BalancePlanView,
  ExtendSeconds,
  ExtendedEventPayload,
  FinishedEventPayload,
  GameCounts,
  GamePhase,
  PublicState,
  ScoreView,
  TimeEventPayload,
  TimingView,
  Winner,
  YouView,
} from "@tow/shared";
import { EXTEND_SECONDS } from "@tow/shared";
import { logger } from "../../obs/logger.js";
import type { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import type { RedisGameRepository } from "../../store/redis/repository.js";
import type {
  StoredBalancePlan,
  StoredCounts,
  StoredGameState,
  StoredPlayer,
} from "../../store/redis/types.js";
import {
  chooseWildcardCandidate,
  createBalancePlan,
  derivePlanFromRoster,
  isBalanceComplete,
  previewAutoBalance as calculateAutoBalancePreview,
  selectWildcard as domainSelectWildcard,
  type BalanceMove,
  type BalancePlan,
  type Roster,
} from "../balance/index.js";
import type { MongoPersistenceService } from "../../store/mongo/persistenceService.js";
import { ScoreBroadcaster } from "../score/ScoreBroadcaster.js";
import { TimerManager } from "../timer/TimerManager.js";
import type { AutoBalancePreview, OrchestratorResult } from "./types.js";

export interface OrchestratorEmitter {
  emitPhase(gameId: string, phase: GamePhase, at: number): void;
  emitCounts(gameId: string, counts: GameCounts): void;
  emitBalancePlan(gameId: string, plan: BalancePlanView): void;
  emitBalanceMove(gameId: string, move: BalanceMove & { remainingLeftToRight: number; remainingRightToLeft: number }): void;
  emitWildcard(gameId: string, data: { playerId: string; label: string }): void;
  emitCountdown(gameId: string, data: { endsAt: number; durationMs: number }): void;
  emitScore(gameId: string, score: ScoreView): void;
  emitTime(gameId: string, timing: TimingView): void;
  emitPaused(gameId: string, data: { pausedAt: number }): void;
  emitResumed(gameId: string, data: { resumedAt: number; endTime: number }): void;
  emitExtended(gameId: string, data: ExtendedEventPayload): void;
  emitFinished(gameId: string, data: FinishedEventPayload): void;
  emitRound(gameId: string, data: { roundNumber: number }): void;
  emitPlayerYou(playerId: string, you: YouView): void;
  emitSync(gameId: string): void;
}

export class GameOrchestrator {
  private readonly repository: RedisGameRepository | MemoryGameRepository;
  private readonly emitter?: OrchestratorEmitter;
  readonly timerManager: TimerManager;
  readonly scoreBroadcaster: ScoreBroadcaster;
  private readonly persistenceService?: MongoPersistenceService;
  private roundExtensions = new Map<string, { seconds: number; timestamp: number }[]>();
  private lockedComposition = new Map<string, { playerId: string; label: string; team: "left" | "right" | "chaos" }[]>();

  constructor(
    repository: RedisGameRepository | MemoryGameRepository,
    emitter?: OrchestratorEmitter,
    timerManager?: TimerManager,
    scoreBroadcaster?: ScoreBroadcaster,
    persistenceService?: MongoPersistenceService,
  ) {
    this.repository = repository;
    this.emitter = emitter;
    this.timerManager = timerManager ?? new TimerManager();
    this.scoreBroadcaster =
      scoreBroadcaster ??
      new ScoreBroadcaster((gameId, score) => {
        if (this.emitter) {
          this.emitter.emitScore(gameId, score);
        }
      });
    this.persistenceService = persistenceService;
  }

  // ==========================================
  // 1. CREATE / OPEN ACTIVE GAME
  // ==========================================

  async openGame(options?: { durationMs?: number; customGameId?: string }): Promise<
    OrchestratorResult<{ gameId: string; publicState: PublicState }>
  > {
    try {
      const gameId = options?.customGameId ?? `tow_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      this.timerManager.cancel(gameId);
      this.scoreBroadcaster.reset(gameId);
      this.roundExtensions.delete(gameId);
      this.lockedComposition.delete(gameId);

      const durationMs = options?.durationMs ?? 30000;
      const now = Date.now();

      const game: StoredGameState = {
        gameId,
        phase: "OPEN",
        roundNumber: 1,
        createdAt: now,
        durationMs,
        startTime: null,
        endTime: null,
        pausedAt: null,
        pauseAccumMs: 0,
        countdownEndsAt: null,
        winner: null,
        joinAllowed: true,
      };

      const createResult = await this.repository.createGame(game);
      if (!createResult.ok) {
        return { ok: false, code: "VALIDATION", message: createResult.error.message };
      }

      await this.repository.setCurrentGameId(gameId);

      const publicStateResult = await this.repository.getPublicGameState(gameId);
      const publicState = publicStateResult.ok ? (publicStateResult.value as PublicState) : ({} as PublicState);

      logger.info("game_session_opened", { gameId, durationMs });

      this.persistenceService?.persistSessionCreated({
        sessionId: gameId,
        status: "active",
        createdAt: now,
        config: { roundDurationMs: durationMs },
      });
      this.persistenceService?.persistAuditEvent({
        sessionId: gameId,
        eventType: "PHASE_CHANGE",
        data: { phase: "OPEN" },
        timestamp: now,
      });

      if (this.emitter) {
        this.emitter.emitPhase(gameId, "OPEN", now);
        const counts = await this.repository.getCounts(gameId);
        if (counts.ok) {
          this.emitter.emitCounts(gameId, counts.value);
        }
        this.emitter.emitSync(gameId);
      }

      return { ok: true, data: { gameId, publicState } };
    } catch (err) {
      logger.error("open_game_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to open game session" };
    }
  }

  // ==========================================
  // 2. LOCK GAME & EVALUATE BALANCING
  // ==========================================

  async lockGame(): Promise<
    OrchestratorResult<{
      phase: GamePhase;
      plan?: StoredBalancePlan;
      counts: StoredCounts;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session found" };
      }

      const lockResult = await this.repository.lockAndSnapshot(gameId);
      if (!lockResult.ok) {
        let code: any = "INVALID_TRANSITION";
        if (lockResult.error.code === "GAME_NOT_FOUND") code = "GAME_NOT_FOUND";
        return { ok: false, code, message: lockResult.error.message };
      }

      const snapshot = lockResult.value;

      // Zero Player Rule: If host locks with zero players, return EMPTY_ROSTER and revert to OPEN
      if (snapshot.totalPlayers === 0) {
        logger.warn("lock_attempt_empty_roster", { gameId });
        await this.repository.updateGame(gameId, { phase: "OPEN", joinAllowed: true });
        return {
          ok: false,
          code: "EMPTY_ROSTER",
          message: "Cannot lock game with zero active players in lobby",
        };
      }

      const domainRoster: Roster = {
        players: snapshot.roster.map((p) => ({
          playerId: p.playerId,
          team: p.team,
        })),
      };

      const planResult = createBalancePlan(domainRoster);
      if (!planResult.ok) {
        return { ok: false, code: "VALIDATION", message: planResult.error.message };
      }

      const plan = planResult.value;
      const countsResult = await this.repository.getCounts(gameId);
      const counts = countsResult.ok ? countsResult.value : ({} as StoredCounts);

      // Check if roster is already perfectly balanced
      if (isBalanceComplete(domainRoster, plan)) {
        logger.info("roster_already_balanced_proceeding_to_countdown", { gameId });
        const countdownRes = await this.startCountdownInternal(gameId, 3000);
        if (!countdownRes.ok) {
          return { ok: false, code: countdownRes.code, message: countdownRes.message };
        }
        return {
          ok: true,
          data: {
            phase: "COUNTDOWN",
            counts,
          },
        };
      }

      // Roster requires balancing: Transition to BALANCING
      const storedPlan: StoredBalancePlan = {
        targetLeft: plan.target.targetLeft,
        targetRight: plan.target.targetRight,
        wildcardNeeded: plan.wildcardNeeded,
        needLeftToRight: plan.needLeftToRight,
        needRightToLeft: plan.needRightToLeft,
        remainingLeftToRight: plan.remainingLeftToRight,
        remainingRightToLeft: plan.remainingRightToLeft,
        wildcardPlayerId: plan.wildcardPlayerId,
        wildcardApplied: plan.wildcardApplied,
        status: plan.status,
      };

      await this.repository.writeBalancePlan(gameId, storedPlan, []);
      await this.repository.updateGame(gameId, { phase: "BALANCING" });

      logger.info("game_locked_and_balancing_started", {
        gameId,
        total: snapshot.totalPlayers,
        left: snapshot.leftCount,
        right: snapshot.rightCount,
        wildcardNeeded: plan.wildcardNeeded,
      });

      if (this.emitter) {
        this.emitter.emitPhase(gameId, "BALANCING", Date.now());
        this.emitter.emitCounts(gameId, counts);
        const planView: BalancePlanView = {
          targetLeft: storedPlan.targetLeft,
          targetRight: storedPlan.targetRight,
          needLeftToRight: storedPlan.needLeftToRight,
          needRightToLeft: storedPlan.needRightToLeft,
          chaosNeeded: storedPlan.wildcardNeeded === 1,
          remainingLeftToRight: storedPlan.remainingLeftToRight,
          remainingRightToLeft: storedPlan.remainingRightToLeft,
          remainingMs: null,
        };
        this.emitter.emitBalancePlan(gameId, planView);
      }

      return {
        ok: true,
        data: {
          phase: "BALANCING",
          plan: storedPlan,
          counts,
        },
      };
    } catch (err) {
      logger.error("lock_game_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to lock game" };
    }
  }

  // ==========================================
  // 3. WILDCARD BALANCING FLOW
  // ==========================================

  async selectWildcard(playerId: string): Promise<
    OrchestratorResult<{
      wildcardPlayerId: string;
      counts: StoredCounts;
      balanceComplete: boolean;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok || (gameResult.value.phase !== "BALANCING" && gameResult.value.phase !== "LOCKING")) {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: "Wildcard can only be assigned during BALANCING phase",
        };
      }

      const [planResult, rawRosterResult] = await Promise.all([
        this.repository.getPlan(gameId),
        this.repository.getRoster(gameId),
      ]);

      if (!planResult.ok || !planResult.value || !rawRosterResult.ok) {
        return { ok: false, code: "BALANCE_INCOMPLETE", message: "Missing balance plan or roster" };
      }

      const plan = planResult.value;
      if (plan.wildcardNeeded !== 1) {
        return { ok: false, code: "INVALID_WILDCARD", message: "This round does not require a CHAOS PLAYER" };
      }

      const playerResult = await this.repository.getPlayer(gameId, playerId);
      if (!playerResult.ok) {
        return { ok: false, code: "UNKNOWN_PLAYER", message: "Player not found" };
      }

      const domainRoster: Roster = {
        players: rawRosterResult.value.players.map((p) => ({
          playerId: p.playerId,
          team: p.team,
        })),
      };

      const target = {
        totalPlayers: domainRoster.players.length,
        playablePlayers: plan.targetLeft + plan.targetRight,
        targetLeft: plan.targetLeft,
        targetRight: plan.targetRight,
        wildcardNeeded: plan.wildcardNeeded as 1,
      };

      const domainPlan: BalancePlan = {
        target,
        wildcardNeeded: plan.wildcardNeeded,
        wildcardPlayerId: plan.wildcardPlayerId,
        wildcardApplied: plan.wildcardApplied,
        needLeftToRight: plan.needLeftToRight,
        needRightToLeft: plan.needRightToLeft,
        remainingLeftToRight: plan.remainingLeftToRight,
        remainingRightToLeft: plan.remainingRightToLeft,
        moves: [],
        status: plan.status,
      };

      const domainValidation = domainSelectWildcard(domainRoster, domainPlan, playerId);
      if (!domainValidation.ok) {
        return { ok: false, code: "INVALID_WILDCARD", message: domainValidation.error.message };
      }

      const assignResult = await this.repository.assignWildcard(gameId, playerId);
      if (!assignResult.ok) {
        return { ok: false, code: "INVALID_WILDCARD", message: assignResult.error.message };
      }

      const updatedPlayer = await this.repository.getPlayer(gameId, playerId);
      const label = updatedPlayer.ok ? updatedPlayer.value.label : "P-???";

      logger.info("wildcard_assigned", { gameId, playerId, label });

      if (this.emitter) {
        this.emitter.emitWildcard(gameId, { playerId, label });
        this.emitter.emitCounts(gameId, assignResult.value.counts);
        this.emitter.emitPlayerYou(playerId, {
          playerId,
          label,
          team: null,
          chaos: true,
          status: "online",
          role: "chaos",
        });
      }

      const balanceComplete = assignResult.value.status === "complete";
      if (balanceComplete) {
        await this.startCountdownInternal(gameId, 3000);
      }

      return {
        ok: true,
        data: {
          wildcardPlayerId: playerId,
          counts: assignResult.value.counts,
          balanceComplete,
        },
      };
    } catch (err) {
      logger.error("select_wildcard_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to assign wildcard" };
    }
  }

  // ==========================================
  // 4. VOLUNTEER BALANCING MOVE
  // ==========================================

  async applyVolunteerMove(playerId: string): Promise<
    OrchestratorResult<{
      move: BalanceMove;
      counts: StoredCounts;
      balanceComplete: boolean;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok || gameResult.value.phase !== "BALANCING") {
        return {
          ok: false,
          code: "SWITCH_LOCKED",
          message: "Volunteer moves are only allowed during BALANCING phase",
        };
      }

      const playerResult = await this.repository.getPlayer(gameId, playerId);
      if (!playerResult.ok) {
        return { ok: false, code: "UNKNOWN_PLAYER", message: "Player not found" };
      }

      const player = playerResult.value;
      if (player.wildcard || player.team === "chaos") {
        return {
          ok: false,
          code: "MOVE_NOT_ALLOWED",
          message: "CHAOS PLAYER cannot move between teams",
        };
      }

      if (player.team !== "left" && player.team !== "right") {
        return {
          ok: false,
          code: "MOVE_NOT_ALLOWED",
          message: "Player is not on a team",
        };
      }

      const planResult = await this.repository.getPlan(gameId);
      if (!planResult.ok || !planResult.value) {
        return { ok: false, code: "BALANCE_INCOMPLETE", message: "Balance plan not found" };
      }

      const plan = planResult.value;
      const fromTeam = player.team;
      const toTeam = fromTeam === "left" ? "right" : "left";

      if (fromTeam === "left" && plan.remainingLeftToRight <= 0) {
        return {
          ok: false,
          code: "MOVE_WOULD_OVERSHOOT",
          message: "Team LEFT does not need to move to RIGHT",
        };
      }
      if (fromTeam === "right" && plan.remainingRightToLeft <= 0) {
        return {
          ok: false,
          code: "MOVE_WOULD_OVERSHOOT",
          message: "Team RIGHT does not need to move to LEFT",
        };
      }

      const moveResult = await this.repository.applyVolunteerMove(gameId, playerId, toTeam);
      if (!moveResult.ok) {
        let code: any = "MOVE_NOT_ALLOWED";
        if (moveResult.error.code === "MOVE_WOULD_OVERSHOOT") code = "MOVE_WOULD_OVERSHOOT";
        return { ok: false, code, message: moveResult.error.message };
      }

      const res = moveResult.value;
      logger.info("volunteer_move_applied", {
        gameId,
        playerId,
        fromTeam,
        toTeam,
        remainingLtoR: res.remainingLeftToRight,
        remainingRtoL: res.remainingRightToLeft,
      });

      if (this.emitter) {
        this.emitter.emitBalanceMove(gameId, {
          ...res.move,
          remainingLeftToRight: res.remainingLeftToRight,
          remainingRightToLeft: res.remainingRightToLeft,
        });
        this.emitter.emitCounts(gameId, res.counts);
        this.emitter.emitPlayerYou(playerId, {
          playerId,
          label: player.label,
          team: toTeam,
          chaos: false,
          status: player.status,
          role: toTeam,
        });
      }

      const balanceComplete = res.status === "complete";
      if (balanceComplete) {
        await this.startCountdownInternal(gameId, 3000);
      }

      return {
        ok: true,
        data: {
          move: res.move,
          counts: res.counts,
          balanceComplete,
        },
      };
    } catch (err) {
      logger.error("apply_volunteer_move_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to apply volunteer move" };
    }
  }

  // ==========================================
  // 5. AUTO-BALANCE PREVIEW & CONFIRMATION
  // ==========================================

  async previewAutoBalance(): Promise<OrchestratorResult<AutoBalancePreview>> {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok || gameResult.value.phase !== "BALANCING") {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: "Auto-balance preview is only available during BALANCING phase",
        };
      }

      const rawRosterResult = await this.repository.getRoster(gameId);
      if (!rawRosterResult.ok) {
        return { ok: false, code: "VALIDATION", message: "Failed to read live roster" };
      }

      const domainRoster: Roster = {
        players: rawRosterResult.value.players.map((p) => ({
          playerId: p.playerId,
          team: p.team,
        })),
      };

      const planResult = await this.repository.getPlan(gameId);
      let domainPlan: BalancePlan;
      if (planResult.ok && planResult.value) {
        const p = planResult.value;
        const target = {
          totalPlayers: domainRoster.players.length,
          playablePlayers: p.targetLeft + p.targetRight,
          targetLeft: p.targetLeft,
          targetRight: p.targetRight,
          wildcardNeeded: p.wildcardNeeded,
        };
        const candidate = p.wildcardPlayerId ?? (p.wildcardNeeded === 1 ? chooseWildcardCandidate(domainRoster, target) : null);
        domainPlan = {
          target,
          wildcardNeeded: p.wildcardNeeded,
          wildcardPlayerId: candidate,
          wildcardApplied: p.wildcardApplied,
          needLeftToRight: p.needLeftToRight,
          needRightToLeft: p.needRightToLeft,
          remainingLeftToRight: p.remainingLeftToRight,
          remainingRightToLeft: p.remainingRightToLeft,
          moves: [],
          status: p.status,
        };
      } else {
        const created = createBalancePlan(domainRoster);
        if (!created.ok) return { ok: false, code: "VALIDATION", message: created.error.message };
        domainPlan = created.value;
        if (domainPlan.wildcardNeeded === 1 && !domainPlan.wildcardPlayerId) {
          domainPlan.wildcardPlayerId = chooseWildcardCandidate(domainRoster, domainPlan.target);
        }
      }

      const previewResult = calculateAutoBalancePreview(domainRoster, domainPlan);
      if (!previewResult.ok) {
        return { ok: false, code: "VALIDATION", message: previewResult.error.message };
      }

      const preview = previewResult.value;
      return {
        ok: true,
        data: {
          moves: [...preview.moves],
          wildcardPlayerId: preview.wildcardPlayerId,
          finalCounts: preview.finalCounts,
        },
      };
    } catch (err) {
      logger.error("preview_auto_balance_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to generate auto-balance preview" };
    }
  }

  async confirmAutoBalance(customMoves?: BalanceMove[]): Promise<
    OrchestratorResult<{
      movesApplied: number;
      counts: StoredCounts;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok || gameResult.value.phase !== "BALANCING") {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: "Auto-balance can only be confirmed during BALANCING phase",
        };
      }

      let moves = customMoves;

      if (!moves) {
        const previewResult = await this.previewAutoBalance();
        if (!previewResult.ok) {
          return previewResult;
        }
        moves = previewResult.data.moves;
      }

      const applyResult = await this.repository.applyAutoBalance(gameId, moves);
      if (!applyResult.ok) {
        if (applyResult.error.code === "CONCURRENT_MODIFICATION") {
          logger.warn("auto_balance_concurrency_conflict", { gameId });
          return {
            ok: false,
            code: "CONCURRENT_MODIFICATION",
            message: "A volunteer moved before confirmation. Please review the updated preview.",
          };
        }
        return { ok: false, code: "VALIDATION", message: applyResult.error.message };
      }

      const res = applyResult.value;
      logger.info("auto_balance_confirmed_and_applied", {
        gameId,
        movesApplied: res.movesApplied,
        counts: res.counts,
      });

      if (this.emitter) {
        this.emitter.emitCounts(gameId, res.counts);
      }

      await this.startCountdownInternal(gameId, 3000);

      return {
        ok: true,
        data: {
          movesApplied: res.movesApplied,
          counts: res.counts,
        },
      };
    } catch (err) {
      logger.error("confirm_auto_balance_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to confirm auto-balance" };
    }
  }

  // ==========================================
  // 6. CANCEL BALANCING
  // ==========================================

  async cancelBalancing(): Promise<OrchestratorResult<void>> {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "Game session not found" };
      }

      if (gameResult.value.phase !== "BALANCING" && gameResult.value.phase !== "LOCKING") {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: `Cannot cancel balancing from phase ${gameResult.value.phase}`,
        };
      }

      this.timerManager.cancel(gameId);

      await this.repository.updateGame(gameId, { phase: "OPEN", joinAllowed: true });
      logger.info("balancing_cancelled_reverted_to_open", { gameId });

      if (this.emitter) {
        this.emitter.emitPhase(gameId, "OPEN", Date.now());
        const counts = await this.repository.getCounts(gameId);
        if (counts.ok) {
          this.emitter.emitCounts(gameId, counts.value);
        }
      }

      return { ok: true, data: undefined };
    } catch (err) {
      logger.error("cancel_balancing_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to cancel balancing" };
    }
  }

  // ==========================================
  // 7. COUNTDOWN & START RUNNING
  // ==========================================

  async startCountdown(durationMs = 3000): Promise<
    OrchestratorResult<{
      endsAt: number;
      durationMs: number;
    }>
  > {
    const gameId = await this.repository.getCurrentGameId();
    if (!gameId) {
      return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
    }
    return this.startCountdownInternal(gameId, durationMs);
  }

  private async startCountdownInternal(
    gameId: string,
    durationMs = 3000,
  ): Promise<OrchestratorResult<{ endsAt: number; durationMs: number }>> {
    try {
      const countsResult = await this.repository.getCounts(gameId);
      if (!countsResult.ok) {
        return { ok: false, code: "VALIDATION", message: "Failed to read counts" };
      }

      const counts = countsResult.value;
      const wildcardRequired = counts.total % 2;

      if (counts.left !== counts.right || counts.chaos !== wildcardRequired) {
        return {
          ok: false,
          code: "BALANCE_INCOMPLETE",
          message: `Teams are not balanced: Left=${counts.left}, Right=${counts.right}, Chaos=${counts.chaos}`,
        };
      }

      const now = Date.now();
      const endsAt = now + durationMs;

      await this.repository.updateGame(gameId, {
        phase: "COUNTDOWN",
        countdownEndsAt: endsAt,
        joinAllowed: false,
      });

      logger.info("countdown_started", { gameId, endsAt, durationMs });

      // Snapshot locked round composition
      const playersRes = await this.repository.getAllPlayers(gameId);
      if (playersRes.ok) {
        const comp = playersRes.value.map((p) => ({
          playerId: p.playerId,
          label: p.label,
          team: (p.wildcard || p.team === "chaos" ? "chaos" : (p.team ?? "chaos")) as "left" | "right" | "chaos",
        }));
        this.lockedComposition.set(gameId, comp);
      }

      if (this.emitter) {
        this.emitter.emitPhase(gameId, "COUNTDOWN", now);
        this.emitter.emitCountdown(gameId, { endsAt, durationMs });
      }

      this.timerManager.scheduleCountdown(gameId, durationMs, () => {
        return this.completeCountdown(gameId).then(() => {});
      });

      return { ok: true, data: { endsAt, durationMs } };
    } catch (err) {
      logger.error("start_countdown_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to start countdown" };
    }
  }

  async completeCountdown(targetGameId?: string): Promise<OrchestratorResult<void>> {
    try {
      const gameId = targetGameId ?? (await this.repository.getCurrentGameId());
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const now = Date.now();
      const startResult = await this.repository.startRunning(gameId, now);
      if (!startResult.ok) {
        return { ok: false, code: "INVALID_TRANSITION", message: startResult.error.message };
      }

      const { startTime, endTime, durationMs } = startResult.value;
      logger.info("game_running_started", { gameId, startTime, endTime, durationMs });

      this.timerManager.scheduleRoundFinish(gameId, endTime, () => {
        return this.finishGame("timer").then(() => {});
      });

      if (this.emitter) {
        this.emitter.emitPhase(gameId, "RUNNING", now);
        const timing: TimingView = {
          durationMs,
          startTime,
          endTime,
          pausedAt: null,
          pauseAccumMs: 0,
          countdownEndsAt: null,
          serverNow: now,
        };
        this.emitter.emitTime(gameId, timing);
      }

      return { ok: true, data: undefined };
    } catch (err) {
      logger.error("complete_countdown_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to complete countdown" };
    }
  }

  // ==========================================
  // 8. TAPS & SCORING (PHASE 8)
  // ==========================================

  async processTap(playerId: string): Promise<
    OrchestratorResult<{
      team: "left" | "right";
      scores: { left: number; right: number };
      seq: number;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const rl = await this.repository.checkRateLimit(playerId);
      if (!rl.allowed) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          message: "Rate limit exceeded (10 taps/sec sustained, max burst 15)",
        };
      }

      const tapResult = await this.repository.tapIncrement(gameId, playerId);
      if (!tapResult.ok) {
        let code: any = "SWITCH_LOCKED";
        if (tapResult.error.code === "PLAYER_NOT_FOUND") code = "UNKNOWN_PLAYER";
        if (tapResult.error.code === "INVALID_TEAM") code = "NOT_ELIGIBLE";
        if (tapResult.error.code === "INVALID_PHASE") code = "SWITCH_LOCKED";
        return { ok: false, code, message: tapResult.error.message };
      }

      const res = tapResult.value;

      this.scoreBroadcaster.recordTap(gameId, res.scores, res.seq);

      return {
        ok: true,
        data: {
          team: res.team,
          scores: res.scores,
          seq: res.seq,
        },
      };
    } catch (err) {
      logger.error("process_tap_error", { playerId, error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to process tap" };
    }
  }

  // ==========================================
  // 9. PAUSE & RESUME (PHASE 7)
  // ==========================================

  async pauseGame(): Promise<OrchestratorResult<{ pausedAt: number }>> {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const now = Date.now();
      const pauseResult = await this.repository.pauseGame(gameId, now);
      if (!pauseResult.ok) {
        return { ok: false, code: "INVALID_TRANSITION", message: pauseResult.error.message };
      }

      this.timerManager.pause(gameId);
      logger.info("game_paused", { gameId, pausedAt: now });

      if (this.emitter) {
        this.emitter.emitPaused(gameId, { pausedAt: now });
        this.emitter.emitPhase(gameId, "PAUSED", now);
      }

      return { ok: true, data: { pausedAt: now } };
    } catch (err) {
      logger.error("pause_game_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to pause game" };
    }
  }

  async resumeGame(): Promise<
    OrchestratorResult<{
      startTime: number | null;
      endTime: number;
      durationMs: number;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const now = Date.now();
      const resumeResult = await this.repository.resumeGame(gameId, now);
      if (!resumeResult.ok) {
        return { ok: false, code: "INVALID_TRANSITION", message: resumeResult.error.message };
      }

      const res = resumeResult.value;
      logger.info("game_resumed", { gameId, newEndTime: res.endTime, pauseAccumMs: res.pauseAccumMs });

      this.timerManager.resume(gameId, res.endTime, () => {
        return this.finishGame("timer").then(() => {});
      });

      if (this.emitter) {
        this.emitter.emitResumed(gameId, { resumedAt: now, endTime: res.endTime });
        this.emitter.emitPhase(gameId, "RUNNING", now);
        const timing: TimingView = {
          durationMs: res.durationMs,
          startTime: res.startTime,
          endTime: res.endTime,
          pausedAt: null,
          pauseAccumMs: res.pauseAccumMs,
          countdownEndsAt: null,
          serverNow: now,
        };
        this.emitter.emitTime(gameId, timing);
      }

      return {
        ok: true,
        data: {
          startTime: res.startTime,
          endTime: res.endTime,
          durationMs: res.durationMs,
        },
      };
    } catch (err) {
      logger.error("resume_game_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to resume game" };
    }
  }

  // ==========================================
  // 10. EXTEND TIME (PHASE 7)
  // ==========================================

  async extendTime(seconds: ExtendSeconds): Promise<
    OrchestratorResult<{
      seconds: ExtendSeconds;
      endTime: number;
      serverNow: number;
    }>
  > {
    try {
      if (!EXTEND_SECONDS.includes(seconds as any)) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Extension seconds must be 5, 10, or 15",
        };
      }

      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const now = Date.now();
      const extendResult = await this.repository.extendTime(gameId, seconds, now);
      if (!extendResult.ok) {
        let code: any = "EXTEND_REJECTED";
        if (extendResult.error.code === "INVALID_PHASE") code = "EXTEND_REJECTED";
        return { ok: false, code, message: extendResult.error.message };
      }

      const res = extendResult.value;
      logger.info("game_time_extended", { gameId, seconds, newEndTime: res.endTime });

      let extList = this.roundExtensions.get(gameId);
      if (!extList) {
        extList = [];
        this.roundExtensions.set(gameId, extList);
      }
      extList.push({ seconds, timestamp: now });

      this.timerManager.extend(gameId, res.endTime, () => {
        return this.finishGame("timer").then(() => {});
      });

      if (this.emitter) {
        this.emitter.emitExtended(gameId, {
          seconds,
          endTime: res.endTime,
          serverNow: now,
        });

        const game = await this.repository.getGame(gameId);
        if (game.ok) {
          const timing: TimingView = {
            durationMs: game.value.durationMs,
            startTime: game.value.startTime,
            endTime: res.endTime,
            pausedAt: game.value.pausedAt,
            pauseAccumMs: game.value.pauseAccumMs,
            countdownEndsAt: null,
            serverNow: now,
          };
          this.emitter.emitTime(gameId, timing);
        }
      }

      return {
        ok: true,
        data: {
          seconds,
          endTime: res.endTime,
          serverNow: now,
        },
      };
    } catch (err) {
      logger.error("extend_time_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to extend time" };
    }
  }

  // ==========================================
  // 11. FINISH GAME & RESULTS (PHASE 8)
  // ==========================================

  async finishGame(reason: "timer" | "host" = "timer"): Promise<
    OrchestratorResult<{
      left: number;
      right: number;
      winner: Winner;
      roundNumber: number;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const now = Date.now();
      const finishResult = await this.repository.finishGame(gameId, now);
      if (!finishResult.ok) {
        return { ok: false, code: "INVALID_TRANSITION", message: finishResult.error.message };
      }

      const res = finishResult.value;
      this.timerManager.cancel(gameId);

      const finalScore = this.scoreBroadcaster.flush(gameId, {
        left: res.left,
        right: res.right,
        seq: res.left + res.right,
      });

      logger.info("game_finished", {
        gameId,
        reason,
        winner: res.winner,
        left: res.left,
        right: res.right,
        roundNumber: res.roundNumber,
      });

      if (this.persistenceService) {
        Promise.all([
          this.repository.getAllPlayers(gameId),
          this.repository.getGame(gameId),
          this.repository.getCounts(gameId),
          this.repository.getPlan(gameId),
        ])
          .then(([playersRes, gameRes, countsRes, planRes]) => {
            const gameData = gameRes.ok ? gameRes.value : null;
            const allPlayers = playersRes.ok ? playersRes.value : [];
            const counts = countsRes.ok ? countsRes.value : { left: 0, right: 0, chaos: 0, total: 0 };
            const plan = planRes.ok ? planRes.value : null;

            // Find actual chaos player ID
            const chaosPlayer = allPlayers.find((p) => p.wildcard || p.team === "chaos");
            const wildcardPlayerId = chaosPlayer ? chaosPlayer.playerId : (plan?.wildcardPlayerId ?? null);

            // Composition from locked snapshot, falling back to current players
            const snapshotComp = this.lockedComposition.get(gameId);
            const composition = snapshotComp && snapshotComp.length > 0
              ? snapshotComp
              : allPlayers.map((p) => ({
                  playerId: p.playerId,
                  label: p.label,
                  team: (p.wildcard || p.team === "chaos" ? "chaos" : (p.team ?? "chaos")) as any,
                }));

            const extensions = this.roundExtensions.get(gameId) ?? [];

            this.persistenceService?.persistRoundCompleted({
              sessionId: gameId,
              roundNumber: res.roundNumber,
              startedAt: gameData?.startTime ?? now - 30000,
              endedAt: now,
              durationMs: gameData?.durationMs ?? 30000,
              pauseAccumMs: gameData?.pauseAccumMs ?? 0,
              extensions,
              teamLeftCount: counts.left,
              teamRightCount: counts.right,
              wildcardPlayerId,
              scoreLeft: res.left,
              scoreRight: res.right,
              winner: res.winner,
              finishReason: reason,
              composition,
              createdAt: now,
            });

            this.persistenceService?.persistPlayerRoster(
              gameId,
              allPlayers.map((p) => ({
                sessionId: gameId,
                playerId: p.playerId,
                displayLabel: p.label,
                finalTeam: (p.team === "chaos" ? null : p.team) as any,
                wasWildcard: Boolean(p.wildcard),
                role: (p.wildcard ? "chaos" : p.team) as any,
                status: p.status,
                joinedAt: p.joinedAt,
                updatedAt: now,
              })),
            );

            this.persistenceService?.persistAuditEvent({
              sessionId: gameId,
              eventType: "ROUND_FINISH",
              data: {
                winner: res.winner,
                scoreLeft: res.left,
                scoreRight: res.right,
                teamLeftCount: counts.left,
                teamRightCount: counts.right,
                wildcardPlayerId,
                roundNumber: res.roundNumber,
                finishReason: reason,
                extensionsCount: extensions.length,
              },
              timestamp: now,
            });
          })
          .catch((err) => {
            logger.warn("finish_game_persist_warning", { error: String(err) });
          });
      }

      if (this.emitter) {
        this.emitter.emitFinished(gameId, {
          left: res.left,
          right: res.right,
          winner: res.winner,
          roundNumber: res.roundNumber,
        });
        this.emitter.emitPhase(gameId, "FINISHED", now);
        this.emitter.emitScore(gameId, finalScore);
      }

      return {
        ok: true,
        data: {
          left: res.left,
          right: res.right,
          winner: res.winner,
          roundNumber: res.roundNumber,
        },
      };
    } catch (err) {
      logger.error("finish_game_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to finish game" };
    }
  }

  // ==========================================
  // 12. REMATCH / PLAY AGAIN (PHASE 8)
  // ==========================================

  async prepareNextRound(options?: { durationMs?: number }): Promise<
    OrchestratorResult<{
      roundNumber: number;
      countdownEndsAt: number;
      counts: StoredCounts;
    }>
  > {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "No active game session" };
      }

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok) {
        return { ok: false, code: "GAME_NOT_FOUND", message: "Game not found" };
      }

      const durationMs = options?.durationMs ?? gameResult.value.durationMs ?? 30000;
      const countdownMs = 3000;
      const now = Date.now();

      const nextResult = await this.repository.prepareNextRound(gameId, durationMs, countdownMs, now);
      if (!nextResult.ok) {
        return { ok: false, code: "INVALID_TRANSITION", message: nextResult.error.message };
      }

      const res = nextResult.value;
      this.scoreBroadcaster.reset(gameId);
      this.roundExtensions.delete(gameId);

      logger.info("next_round_prepared", {
        gameId,
        roundNumber: res.roundNumber,
        countdownEndsAt: res.countdownEndsAt,
      });

      this.timerManager.scheduleCountdown(gameId, countdownMs, () => {
        return this.completeCountdown(gameId).then(() => {});
      });

      if (this.emitter) {
        this.emitter.emitRound(gameId, { roundNumber: res.roundNumber });
        this.emitter.emitPhase(gameId, "COUNTDOWN", now);
        this.emitter.emitCountdown(gameId, { endsAt: res.countdownEndsAt, durationMs: countdownMs });
        this.emitter.emitCounts(gameId, res.counts);
      }

      return {
        ok: true,
        data: {
          roundNumber: res.roundNumber,
          countdownEndsAt: res.countdownEndsAt,
          counts: res.counts,
        },
      };
    } catch (err) {
      logger.error("prepare_next_round_error", { error: String(err) });
      return { ok: false, code: "VALIDATION", message: "Failed to prepare next round" };
    }
  }

  // ==========================================
  // 13. PROCESS RESTART RECOVERY
  // ==========================================

  async recoverProcessState(): Promise<void> {
    try {
      const gameId = await this.repository.getCurrentGameId();
      if (!gameId) return;

      const gameResult = await this.repository.getGame(gameId);
      if (!gameResult.ok) return;

      const game = gameResult.value;
      const now = Date.now();

      if (game.phase === "COUNTDOWN" && game.countdownEndsAt) {
        const remaining = game.countdownEndsAt - now;
        if (remaining <= 0) {
          logger.info("recovering_expired_countdown", { gameId });
          await this.completeCountdown(gameId);
        } else {
          logger.info("recovering_active_countdown", { gameId, remaining });
          this.timerManager.scheduleCountdown(gameId, remaining, () => {
            return this.completeCountdown(gameId).then(() => {});
          });
        }
      } else if (game.phase === "RUNNING" && game.endTime) {
        const remaining = game.endTime - now;
        if (remaining <= 0) {
          logger.info("recovering_expired_running_game", { gameId });
          await this.finishGame("timer");
        } else {
          logger.info("recovering_active_running_game", { gameId, remaining });
          this.timerManager.scheduleRoundFinish(gameId, game.endTime, () => {
            return this.finishGame("timer").then(() => {});
          });
        }
      }
    } catch (err) {
      logger.error("process_recovery_error", { error: String(err) });
    }
  }

  dispose(): void {
    this.timerManager.dispose();
    this.scoreBroadcaster.dispose();
  }
}

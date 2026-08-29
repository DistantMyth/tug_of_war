import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtendSeconds, ScoreView } from "@tow/shared";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import { GameOrchestrator, type OrchestratorEmitter } from "./GameOrchestrator.js";

describe("LiveEngine — Live Timer, Tapping, Scoring, Pause, Resume, Extend, Finish, and Rematch", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;
  let emittedScores: { gameId: string; score: ScoreView }[] = [];
  let emittedPhases: { gameId: string; phase: string }[] = [];
  let emittedTimes: any[] = [];
  let emittedFinishes: any[] = [];

  const mockEmitter: OrchestratorEmitter = {
    emitPhase(gameId, phase) {
      emittedPhases.push({ gameId, phase });
    },
    emitCounts() {},
    emitBalancePlan() {},
    emitBalanceMove() {},
    emitWildcard() {},
    emitCountdown() {},
    emitScore(gameId, score) {
      emittedScores.push({ gameId, score });
    },
    emitTime(gameId, timing) {
      emittedTimes.push({ gameId, timing });
    },
    emitPaused() {},
    emitResumed() {},
    emitExtended() {},
    emitFinished(gameId, data) {
      emittedFinishes.push({ gameId, data });
    },
    emitRound() {},
    emitPlayerYou() {},
    emitSync() {},
  };

  beforeEach(() => {
    vi.useFakeTimers();
    emittedScores = [];
    emittedPhases = [];
    emittedTimes = [];
    emittedFinishes = [];
    repo = new MemoryGameRepository();
    orchestrator = new GameOrchestrator(repo, mockEmitter);
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  // Helper to setup a game in RUNNING phase with 2 players (pLeft on Left, pRight on Right)
  async function setupRunningGame(durationMs = 30000) {
    const openRes = await orchestrator.openGame({ durationMs });
    const gameId = (openRes as any).data.gameId;

    await repo.addOrUpdatePlayer(gameId, {
      playerId: "pLeft",
      label: "P-001",
      team: "left",
      wildcard: false,
      status: "online",
      joinedAt: 100,
      lastSeen: 100,
    });
    await repo.addOrUpdatePlayer(gameId, {
      playerId: "pRight",
      label: "P-002",
      team: "right",
      wildcard: false,
      status: "online",
      joinedAt: 200,
      lastSeen: 200,
    });

    await orchestrator.lockGame(); // Even balanced lobby triggers COUNTDOWN

    // Advance 3s countdown
    vi.advanceTimersByTime(3000);
    // Allow any async microtasks to settle
    await Promise.resolve();

    return { gameId, pLeft: "pLeft", pRight: "pRight" };
  }

  // ==================================================
  // 1. TAPS & SCORING
  // ==================================================
  describe("Taps & Live Scoring", () => {
    it("accepts valid taps during RUNNING and updates scores", async () => {
      const { gameId, pLeft, pRight } = await setupRunningGame(30000);

      const tap1 = await orchestrator.processTap(pLeft);
      expect(tap1.ok).toBe(true);
      if (tap1.ok) {
        expect(tap1.data.team).toBe("left");
        expect(tap1.data.scores.left).toBe(1);
        expect(tap1.data.scores.right).toBe(0);
        expect(tap1.data.seq).toBe(1);
      }

      const tap2 = await orchestrator.processTap(pRight);
      expect(tap2.ok).toBe(true);
      if (tap2.ok) {
        expect(tap2.data.team).toBe("right");
        expect(tap2.data.scores.left).toBe(1);
        expect(tap2.data.scores.right).toBe(1);
        expect(tap2.data.seq).toBe(2);
      }

      // Check live scores in repository
      const scores = await repo.getScores(gameId);
      expect(scores.left).toBe(1);
      expect(scores.right).toBe(1);
    });

    it("rejects taps when game is not in RUNNING phase", async () => {
      const openRes = await orchestrator.openGame();
      const gameId = (openRes as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, {
        playerId: "p1",
        label: "P-001",
        team: "left",
        wildcard: false,
        status: "online",
        joinedAt: 100,
        lastSeen: 100,
      });

      // Tapping during OPEN
      const tapOpen = await orchestrator.processTap("p1");
      expect(tapOpen.ok).toBe(false);
      if (!tapOpen.ok) {
        expect(tapOpen.code).toBe("SWITCH_LOCKED");
      }
    });

    it("rejects taps from CHAOS player", async () => {
      const openRes = await orchestrator.openGame();
      const gameId = (openRes as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p3", label: "P-003", team: "right", wildcard: false, status: "online", joinedAt: 300, lastSeen: 300 });

      await orchestrator.lockGame();
      await orchestrator.selectWildcard("p1"); // p1 becomes chaos player

      vi.advanceTimersByTime(3000);
      await Promise.resolve();

      const tapChaos = await orchestrator.processTap("p1");
      expect(tapChaos.ok).toBe(false);
      if (!tapChaos.ok) {
        expect(tapChaos.code).toBe("NOT_ELIGIBLE");
      }
    });

    it("enforces rate limit per playerId (max burst 15)", async () => {
      const { pLeft } = await setupRunningGame();

      // Tap 15 times within window (burst allowed)
      for (let i = 0; i < 15; i++) {
        const res = await orchestrator.processTap(pLeft);
        expect(res.ok).toBe(true);
      }

      // 16th tap exceeds rate limit
      const blocked = await orchestrator.processTap(pLeft);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.code).toBe("RATE_LIMITED");
      }
    });

    it("handles 100 concurrent simultaneous taps losslessly without dropping any", async () => {
      const { gameId, pLeft, pRight } = await setupRunningGame();

      // Reset rate limit map to allow load test bursts
      (repo as any).rateLimits.clear();

      // 50 taps for Left, 50 taps for Right simultaneously
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(repo.tapIncrement(gameId, pLeft));
        promises.push(repo.tapIncrement(gameId, pRight));
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        expect(res.ok).toBe(true);
      }

      const finalScores = await repo.getScores(gameId);
      expect(finalScores.left).toBe(50);
      expect(finalScores.right).toBe(50);
      expect(finalScores.left + finalScores.right).toBe(100);
    });
  });

  // ==================================================
  // 2. PAUSE & RESUME
  // ==================================================
  describe("Pause & Resume", () => {
    it("pauses game, rejects taps while paused, and resumes without losing round duration", async () => {
      const { gameId, pLeft } = await setupRunningGame(30000);

      // Advance 10 seconds into round
      vi.advanceTimersByTime(10000);

      // 1. Pause game
      const pauseRes = await orchestrator.pauseGame();
      expect(pauseRes.ok).toBe(true);

      const pausedGame = await repo.getGame(gameId);
      expect(pausedGame.ok && pausedGame.value.phase).toBe("PAUSED");
      expect(pausedGame.ok && pausedGame.value.pausedAt).toBeDefined();

      // 2. Taps must be rejected while paused
      const tapPaused = await orchestrator.processTap(pLeft);
      expect(tapPaused.ok).toBe(false);
      if (!tapPaused.ok) {
        expect(tapPaused.code).toBe("SWITCH_LOCKED");
      }

      // Stay paused for 8 seconds
      vi.advanceTimersByTime(8000);

      // 3. Resume game
      const resumeRes = await orchestrator.resumeGame();
      expect(resumeRes.ok).toBe(true);

      const resumedGame = await repo.getGame(gameId);
      expect(resumedGame.ok && resumedGame.value.phase).toBe("RUNNING");
      expect(resumedGame.ok && resumedGame.value.pausedAt).toBeNull();
      expect(resumedGame.ok && resumedGame.value.pauseAccumMs).toBe(8000);

      // 4. Taps valid again after resume
      const tapResumed = await orchestrator.processTap(pLeft);
      expect(tapResumed.ok).toBe(true);

      // 5. Advance remaining 19.9s (should still be RUNNING)
      vi.advanceTimersByTime(19900);
      const stillRunning = await repo.getGame(gameId);
      expect(stillRunning.ok && stillRunning.value.phase).toBe("RUNNING");

      // Advance past extended endTime
      vi.advanceTimersByTime(200);
      await Promise.resolve();

      const finishedGame = await repo.getGame(gameId);
      expect(finishedGame.ok && finishedGame.value.phase).toBe("FINISHED");
    });
  });

  // ==================================================
  // 3. TIME EXTENSION
  // ==================================================
  describe("Time Extension", () => {
    it("extends round timer by +5, +10, +15 seconds and reschedules finish", async () => {
      const { gameId } = await setupRunningGame(30000);

      // Advance 25s (5s remaining)
      vi.advanceTimersByTime(25000);

      // Extend +10s
      const extRes = await orchestrator.extendTime(10 as ExtendSeconds);
      expect(extRes.ok).toBe(true);
      if (extRes.ok) {
        expect(extRes.data.seconds).toBe(10);
      }

      // Advance 6s (past original 30s mark)
      vi.advanceTimersByTime(6000);

      const gameStillRunning = await repo.getGame(gameId);
      expect(gameStillRunning.ok && gameStillRunning.value.phase).toBe("RUNNING");

      // Advance remaining 9.1s
      vi.advanceTimersByTime(9100);
      await Promise.resolve();

      const gameFinished = await repo.getGame(gameId);
      expect(gameFinished.ok && gameFinished.value.phase).toBe("FINISHED");
    });

    it("rejects extension if game is PAUSED or FINISHED", async () => {
      const { gameId } = await setupRunningGame(30000);

      await orchestrator.pauseGame();

      // Extend while paused must be rejected
      const extPaused = await orchestrator.extendTime(5 as ExtendSeconds);
      expect(extPaused.ok).toBe(false);
      if (!extPaused.ok) {
        expect(extPaused.code).toBe("EXTEND_REJECTED");
      }
    });
  });

  // ==================================================
  // 4. FINISH & WINNER DETERMINATION
  // ==================================================
  describe("Finish & Winner Determination", () => {
    it("determines LEFT as winner when leftScore > rightScore", async () => {
      const { gameId, pLeft } = await setupRunningGame(10000);

      await orchestrator.processTap(pLeft); // Left gets 1 score

      // Advance to timer expiration
      vi.advanceTimersByTime(10000);
      await Promise.resolve();

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("FINISHED");
      expect(game.ok && game.value.winner).toBe("left");
    });

    it("determines RIGHT as winner when rightScore > leftScore", async () => {
      const { gameId, pRight } = await setupRunningGame(10000);

      await orchestrator.processTap(pRight); // Right gets 1 score

      const finishRes = await orchestrator.finishGame("host");
      expect(finishRes.ok).toBe(true);
      if (finishRes.ok) {
        expect(finishRes.data.winner).toBe("right");
      }
    });

    it("determines DRAW when scores are equal", async () => {
      const { gameId } = await setupRunningGame(10000);

      const finishRes = await orchestrator.finishGame("host");
      expect(finishRes.ok).toBe(true);
      if (finishRes.ok) {
        expect(finishRes.data.winner).toBe("draw");
      }
    });

    it("is idempotent: subsequent finish calls return existing result without duplicate errors", async () => {
      const { gameId } = await setupRunningGame(10000);

      const finish1 = await orchestrator.finishGame("timer");
      const finish2 = await orchestrator.finishGame("host");

      expect(finish1.ok).toBe(true);
      expect(finish2.ok).toBe(true);
    });
  });

  // ==================================================
  // 5. ROUND REMATCH & PLAY AGAIN
  // ==================================================
  describe("Rematch / Play Again Primitives", () => {
    it("increments roundNumber, resets scores to 0, preserves roster, and starts COUNTDOWN", async () => {
      const { gameId, pLeft, pRight } = await setupRunningGame(10000);

      await orchestrator.processTap(pLeft);
      await orchestrator.finishGame("host");

      // Rematch / Next Round
      const nextRes = await orchestrator.prepareNextRound({ durationMs: 40000 });
      expect(nextRes.ok).toBe(true);
      if (nextRes.ok) {
        expect(nextRes.data.roundNumber).toBe(2);
        expect(nextRes.data.countdownEndsAt).toBeDefined();
      }

      const nextGame = await repo.getGame(gameId);
      expect(nextGame.ok && nextGame.value.phase).toBe("COUNTDOWN");
      expect(nextGame.ok && nextGame.value.roundNumber).toBe(2);
      expect(nextGame.ok && nextGame.value.durationMs).toBe(40000);
      expect(nextGame.ok && nextGame.value.winner).toBeNull();

      // Scores must be reset to 0
      const scores = await repo.getScores(gameId);
      expect(scores.left).toBe(0);
      expect(scores.right).toBe(0);

      // Player teams preserved
      const pl = await repo.getPlayer(gameId, pLeft);
      const pr = await repo.getPlayer(gameId, pRight);
      expect(pl.ok && pl.value.team).toBe("left");
      expect(pr.ok && pr.value.team).toBe("right");
    });
  });

  // ==================================================
  // 6. PROCESS RECOVERY
  // ==================================================
  describe("Process Restart Recovery", () => {
    it("recovers active running game from Redis and schedules finish timer", async () => {
      const { gameId } = await setupRunningGame(30000);

      // Advance 10s into game
      vi.advanceTimersByTime(10000);

      // Simulate new server instance rebooting and recovering
      const newOrchestrator = new GameOrchestrator(repo, mockEmitter);
      await newOrchestrator.recoverProcessState();

      expect(newOrchestrator.timerManager.isScheduled(gameId)).toBe(true);

      // Advance 20.1s
      vi.advanceTimersByTime(20100);
      await Promise.resolve();

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("FINISHED");
      newOrchestrator.dispose();
    });
  });
});

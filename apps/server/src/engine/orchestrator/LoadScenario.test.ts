import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScoreView } from "@tow/shared";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import { ScoreBroadcaster } from "../score/ScoreBroadcaster.js";
import { GameOrchestrator, type OrchestratorEmitter } from "./GameOrchestrator.js";

describe("LoadScenario — 300 Concurrent Clients Live Ingestion & Coalescing", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;
  let broadcaster: ScoreBroadcaster;
  let emittedSnapshots: ScoreView[] = [];

  const mockEmitter: OrchestratorEmitter = {
    emitPhase() {},
    emitCounts() {},
    emitBalancePlan() {},
    emitBalanceMove() {},
    emitWildcard() {},
    emitCountdown() {},
    emitScore(_gameId, score) {
      emittedSnapshots.push(score);
    },
    emitTime() {},
    emitPaused() {},
    emitResumed() {},
    emitExtended() {},
    emitFinished() {},
    emitRound() {},
    emitPlayerYou() {},
    emitSync() {},
  };

  beforeEach(() => {
    vi.useFakeTimers();
    emittedSnapshots = [];
    repo = new MemoryGameRepository();
    broadcaster = new ScoreBroadcaster((_gid, s) => mockEmitter.emitScore(_gid, s), 10);
    orchestrator = new GameOrchestrator(repo, mockEmitter, undefined, broadcaster);
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  it("handles 300 concurrent participants tapping at ~10 Hz with zero lost taps and throttled broadcasts", async () => {
    const openRes = await orchestrator.openGame({ durationMs: 30000 });
    const gameId = (openRes as any).data.gameId;

    const CLIENT_COUNT = 300;
    const clientIds: string[] = [];

    // Register 150 Left, 150 Right players
    for (let i = 1; i <= CLIENT_COUNT; i++) {
      const id = `client_${i}`;
      clientIds.push(id);
      const team = i % 2 === 1 ? "left" : "right";
      await repo.addOrUpdatePlayer(gameId, {
        playerId: id,
        label: `P-${i}`,
        team,
        wildcard: false,
        status: "online",
        joinedAt: i * 10,
        lastSeen: i * 10,
      });
    }

    await orchestrator.lockGame();
    vi.advanceTimersByTime(3000); // 3s countdown
    await Promise.resolve();

    // Clear rate limits for clean high-throughput test run
    (repo as any).rateLimits.clear();

    // Simulate 300 clients each making 10 taps over 1 second (total 3,000 taps)
    const TAPS_PER_CLIENT = 10;
    const allTapPromises: Promise<any>[] = [];

    for (let t = 0; t < TAPS_PER_CLIENT; t++) {
      for (const clientId of clientIds) {
        allTapPromises.push(repo.tapIncrement(gameId, clientId));
      }
    }

    const tapResults = await Promise.all(allTapPromises);
    for (const r of tapResults) {
      expect(r.ok).toBe(true);
      if (r.ok) {
        broadcaster.recordTap(gameId, r.value.scores, r.value.seq);
      }
    }

    // Advance 1 second in timer loop to process ticks
    for (let tick = 0; tick < 10; tick++) {
      vi.advanceTimersByTime(100);
    }

    // Verify exact authoritative final scores in storage
    const finalScores = await repo.getScores(gameId);
    expect(finalScores.left).toBe(150 * TAPS_PER_CLIENT); // 1500
    expect(finalScores.right).toBe(150 * TAPS_PER_CLIENT); // 1500
    expect(finalScores.left + finalScores.right).toBe(3000);

    // Verify broadcast snapshots are throttled (approximately 10 per second, NOT 3,000 broadcasts)
    expect(emittedSnapshots.length).toBeLessThanOrEqual(12);
    expect(emittedSnapshots.length).toBeGreaterThan(0);

    // Flush exact score on finish
    const flushed = broadcaster.flush(gameId, {
      left: finalScores.left,
      right: finalScores.right,
      seq: finalScores.left + finalScores.right,
    });

    expect(flushed.left).toBe(1500);
    expect(flushed.right).toBe(1500);
    expect(flushed.seq).toBe(3000);
  });
});

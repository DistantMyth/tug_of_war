import { beforeEach, describe, expect, it } from "vitest";
import { GameOrchestrator } from "../../engine/orchestrator/GameOrchestrator.js";
import { PlayerIdentityService } from "../../identity/service.js";
import { MongoClientService } from "../../store/mongo/client.js";
import { MongoPersistenceService } from "../../store/mongo/persistenceService.js";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";

// Mock collections to verify calls and idempotency
class MockMongoCollection {
  public documents = new Map<string, any>();
  public callCount = 0;

  async updateOne(filter: any, update: any, options?: { upsert?: boolean }) {
    this.callCount++;
    const key = JSON.stringify(filter);
    const existing = this.documents.get(key) || {};
    const updated = { ...existing, ...(update.$set || {}), ...(update.$setOnInsert && !this.documents.has(key) ? update.$setOnInsert : {}) };
    this.documents.set(key, updated);
    return { acknowledged: true, upsertedCount: options?.upsert ? 1 : 0 };
  }

  async bulkWrite(ops: any[]) {
    this.callCount += ops.length;
    for (const op of ops) {
      if (op.updateOne) {
        await this.updateOne(op.updateOne.filter, op.updateOne.update, op.updateOne);
      }
    }
    return { acknowledged: true };
  }

  clear() {
    this.documents.clear();
    this.callCount = 0;
  }
}

describe("MongoDB Resilience, Retry & Idempotency Testing", () => {
  let repository: MemoryGameRepository;
  let identityService: PlayerIdentityService;
  let mongoClient: MongoClientService;
  let persistenceService: MongoPersistenceService;
  let orchestrator: GameOrchestrator;
  let mockSessions: MockMongoCollection;
  let mockRounds: MockMongoCollection;
  let mockPlayers: MockMongoCollection;
  let mockAudit: MockMongoCollection;
  let mongoStatus: "connected" | "disconnected" | "disabled" = "disconnected";

  beforeEach(() => {
    repository = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repository);
    mongoClient = new MongoClientService();
    mockSessions = new MockMongoCollection();
    mockRounds = new MockMongoCollection();
    mockPlayers = new MockMongoCollection();
    mockAudit = new MockMongoCollection();

    mongoStatus = "disconnected";
    mongoClient.getHealth = () => ({ status: mongoStatus });

    // Wire mocks into mongoClient
    mongoClient.getSessionsCollection = () => mockSessions as any;
    mongoClient.getRoundsCollection = () => mockRounds as any;
    mongoClient.getPlayersCollection = () => mockPlayers as any;
    mongoClient.getAuditCollection = () => mockAudit as any;

    persistenceService = new MongoPersistenceService(mongoClient, {
      maxAttempts: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
    });

    orchestrator = new GameOrchestrator(
      repository,
      undefined,
      undefined,
      undefined,
      persistenceService,
    );
  });

  it("ensures live gameplay is 100% unaffected when MongoDB is completely offline", async () => {
    const openRes = (await orchestrator.openGame({ durationMs: 30000 })) as any;
    expect(openRes.ok).toBe(true);
    const gameId = openRes.data.gameId;

    // Register 2 players
    const p1 = (await identityService.registerOrResume({}) as any).data.player.playerId;
    const p2 = (await identityService.registerOrResume({}) as any).data.player.playerId;

    await repository.chooseOrSwitchTeam(gameId, p1, "left");
    await repository.chooseOrSwitchTeam(gameId, p2, "right");

    await orchestrator.lockGame();
    await orchestrator.startCountdown(10);
    await new Promise((r) => setTimeout(r, 20));
    await orchestrator.completeCountdown();

    // Process live taps while Mongo is offline
    const tap1 = await orchestrator.processTap(p1);
    const tap2 = await orchestrator.processTap(p2);
    expect(tap1.ok).toBe(true);
    expect(tap2.ok).toBe(true);

    // Host extends and finishes
    await orchestrator.extendTime(5);
    const finishRes = (await orchestrator.finishGame("timer")) as any;
    expect(finishRes.ok).toBe(true);
    expect(finishRes.data.winner).toBe("draw");

    // Verify persistence tasks are queued and deferred, NOT discarded
    const metrics = persistenceService.getMetrics();
    expect(metrics.queueLength).toBeGreaterThan(0);
    expect(metrics.permanentlyFailedCount).toBe(0);

    await persistenceService.shutdown();
  });

  it("flushes all queued records without duplicates when MongoDB reconnects", async () => {
    mockSessions.clear();
    mockRounds.clear();
    mockPlayers.clear();
    mockAudit.clear();

    const isolatedClient = new MongoClientService();
    isolatedClient.getHealth = () => ({ status: mongoStatus });
    isolatedClient.getSessionsCollection = () => mockSessions as any;
    isolatedClient.getRoundsCollection = () => mockRounds as any;
    isolatedClient.getPlayersCollection = () => mockPlayers as any;
    isolatedClient.getAuditCollection = () => mockAudit as any;

    const isolatedService = new MongoPersistenceService(isolatedClient, {
      maxAttempts: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
    });

    // 1. Queue operations while offline
    const testSession = {
      sessionId: "tow_test_retry_1",
      createdAt: Date.now(),
      status: "active" as const,
      config: { roundDurationMs: 30000 },
    };
    isolatedService.persistSessionCreated(testSession);

    const testRound = {
      sessionId: "tow_test_retry_1",
      roundNumber: 1,
      startedAt: Date.now() - 30000,
      endedAt: Date.now(),
      durationMs: 30000,
      pauseAccumMs: 0,
      extensions: [{ seconds: 5, timestamp: Date.now() - 10000 }],
      teamLeftCount: 50,
      teamRightCount: 50,
      wildcardPlayerId: null,
      scoreLeft: 120,
      scoreRight: 110,
      winner: "left" as const,
      finishReason: "timer" as const,
      composition: [],
      createdAt: Date.now(),
    };
    isolatedService.persistRoundCompleted(testRound);

    expect(isolatedService.getQueueLength()).toBe(2);

    // 2. Simulate Mongo reconnection
    mongoStatus = "connected";

    // 3. Flush queue
    await isolatedService.flush(2000);

    expect(isolatedService.getQueueLength()).toBe(0);
    expect(mockSessions.documents.size).toBe(1);
    expect(mockRounds.documents.size).toBe(1);

    const persistedRound = Array.from(mockRounds.documents.values())[0];
    expect(persistedRound.teamLeftCount).toBe(50);
    expect(persistedRound.teamRightCount).toBe(50);
    expect(persistedRound.scoreLeft).toBe(120);
    expect(persistedRound.scoreRight).toBe(110);
    expect(persistedRound.extensions.length).toBe(1);

    // 4. Re-persisting the same round should be idempotent (upsert)
    isolatedService.persistRoundCompleted(testRound);
    await isolatedService.flush(2000);
    expect(mockRounds.documents.size).toBe(1);

    await isolatedService.shutdown();
  });

  it("handles transient errors with bounded retries and logs permanent failure when exhausted", async () => {
    mongoStatus = "connected";

    // Make mock collection throw errors
    mockSessions.updateOne = async () => {
      throw new Error("Simulated database write failure");
    };

    persistenceService.persistSessionCreated({
      sessionId: "tow_failing_session",
      createdAt: Date.now(),
      status: "active",
      config: { roundDurationMs: 30000 },
    });

    // Run retries until max attempts (3) exhausted
    for (let i = 0; i < 5; i++) {
      await persistenceService.flush(500);
      await new Promise((r) => setTimeout(r, 60));
    }

    const metrics = persistenceService.getMetrics();
    expect(metrics.permanentlyFailedCount).toBe(1);
    expect(metrics.queueLength).toBe(0);

    await persistenceService.shutdown();
  });
});

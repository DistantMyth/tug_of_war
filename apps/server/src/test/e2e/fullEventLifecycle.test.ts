import { beforeEach, describe, expect, it } from "vitest";
import { GameOrchestrator } from "../../engine/orchestrator/GameOrchestrator.js";
import { PlayerIdentityService } from "../../identity/service.js";
import { MongoClientService } from "../../store/mongo/client.js";
import { MongoPersistenceService } from "../../store/mongo/persistenceService.js";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";

// Mock collections to capture persisted documents
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
}

describe("Full Event Lifecycle E2E Test (217 Participants, Chaos Player, Pause, Extend, Rematch)", () => {
  let repository: MemoryGameRepository;
  let identityService: PlayerIdentityService;
  let mongoClient: MongoClientService;
  let persistenceService: MongoPersistenceService;
  let orchestrator: GameOrchestrator;
  let mockSessions: MockMongoCollection;
  let mockRounds: MockMongoCollection;
  let mockPlayers: MockMongoCollection;
  let mockAudit: MockMongoCollection;

  beforeEach(() => {
    repository = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repository);
    mongoClient = new MongoClientService();
    mockSessions = new MockMongoCollection();
    mockRounds = new MockMongoCollection();
    mockPlayers = new MockMongoCollection();
    mockAudit = new MockMongoCollection();

    mongoClient.getHealth = () => ({ status: "connected" });
    mongoClient.getSessionsCollection = () => mockSessions as any;
    mongoClient.getRoundsCollection = () => mockRounds as any;
    mongoClient.getPlayersCollection = () => mockPlayers as any;
    mongoClient.getAuditCollection = () => mockAudit as any;

    persistenceService = new MongoPersistenceService(mongoClient);
    orchestrator = new GameOrchestrator(
      repository,
      undefined,
      undefined,
      undefined,
      persistenceService,
    );
  });

  it("executes the complete orientation event scenario seamlessly", async () => {
    // 1. Host opens game
    const openRes = await orchestrator.openGame({ durationMs: 30000 });
    expect(openRes.ok).toBe(true);
    const gameId = (openRes as any).data.gameId;

    // 2. 217 participants join via permanent QR bootstrap
    const totalParticipants = 217;
    const playerTokens: string[] = [];
    const playerIds: string[] = [];

    for (let i = 0; i < totalParticipants; i++) {
      const reg = (await identityService.registerOrResume({})) as any;
      expect(reg.ok).toBe(true);
      playerTokens.push(reg.data.token);
      playerIds.push(reg.data.player.playerId);
    }
    expect(playerIds.length).toBe(217);

    // 3. Participants freely choose teams (imbalanced initial distribution)
    // 140 join Left, 77 join Right
    for (let i = 0; i < 140; i++) {
      await repository.chooseOrSwitchTeam(gameId, playerIds[i]!, "left");
    }
    for (let i = 140; i < 217; i++) {
      await repository.chooseOrSwitchTeam(gameId, playerIds[i]!, "right");
    }

    let counts = ((await repository.getCounts(gameId)) as any).value;
    expect(counts.left).toBe(140);
    expect(counts.right).toBe(77);
    expect(counts.total).toBe(217);

    // 4. Some participants switch teams before lock
    await repository.chooseOrSwitchTeam(gameId, playerIds[0]!, "right");
    await repository.chooseOrSwitchTeam(gameId, playerIds[1]!, "right");
    counts = ((await repository.getCounts(gameId)) as any).value;
    expect(counts.left).toBe(138);
    expect(counts.right).toBe(79);

    // 5. Host locks roster -> triggers BALANCING
    const lockRes = (await orchestrator.lockGame()) as any;
    expect(lockRes.ok).toBe(true);
    expect(lockRes.data.status === "balancing" || lockRes.data.phase === "BALANCING").toBe(true);

    // 6. Volunteers switch / auto-balance applies moves
    const autoBalanceRes = await orchestrator.confirmAutoBalance();
    expect(autoBalanceRes.ok).toBe(true);

    // 7. Verify Balanced Distribution: Exactly 108 Left, 108 Right, 1 Chaos!
    counts = ((await repository.getCounts(gameId)) as any).value;
    expect(counts.left).toBe(108);
    expect(counts.right).toBe(108);
    expect(counts.chaos).toBe(1);
    expect(counts.total).toBe(217);

    // 8. Countdown & Launch match
    await orchestrator.startCountdown(50);
    await new Promise((r) => setTimeout(r, 60));
    await orchestrator.completeCountdown();

    const runningGame = ((await repository.getGame(gameId)) as any).value;
    expect(runningGame.phase).toBe("RUNNING");

    // 9. Gameplay Taps
    // Left players tap
    for (let i = 0; i < 50; i++) {
      const pId = playerIds[i]!;
      const player = ((await repository.getPlayer(gameId, pId)) as any).value;
      if (player.team === "left") {
        await orchestrator.processTap(pId);
      }
    }

    // Right players tap
    for (let i = 140; i < 180; i++) {
      const pId = playerIds[i]!;
      const player = ((await repository.getPlayer(gameId, pId)) as any).value;
      if (player.team === "right") {
        await orchestrator.processTap(pId);
      }
    }

    // Chaos Player tries to tap -> must be rejected
    const allPlayers = ((await repository.getAllPlayers(gameId)) as any).value;
    const chaosPlayer = allPlayers.find((p: any) => p.role === "chaos" || p.wildcard);
    expect(chaosPlayer).toBeDefined();
    const chaosTap = await orchestrator.processTap(chaosPlayer.playerId);
    expect(chaosTap.ok).toBe(false);

    // 10. Host Pauses, Resumes, and Extends Match
    const pauseRes = await orchestrator.pauseGame();
    expect(pauseRes.ok).toBe(true);

    const resumeRes = await orchestrator.resumeGame();
    expect(resumeRes.ok).toBe(true);

    const extendRes = await orchestrator.extendTime(10);
    expect(extendRes.ok).toBe(true);

    // 11. Complete Round 1
    const finishRes = (await orchestrator.finishGame("timer")) as any;
    expect(finishRes.ok).toBe(true);
    expect(finishRes.data.roundNumber).toBe(1);

    // 12. Host initiates Rematch (Play Again) with same teams preserved
    const rematchRes = (await orchestrator.prepareNextRound({ durationMs: 30000 })) as any;
    expect(rematchRes.ok).toBe(true);
    expect(rematchRes.data.roundNumber).toBe(2);

    // Verify teams preserved and scores reset
    const r2PublicState = ((await repository.getPublicGameState(gameId)) as any).value;
    expect(r2PublicState.roundNumber).toBe(2);
    expect(r2PublicState.scores.left).toBe(0);
    expect(r2PublicState.scores.right).toBe(0);
    expect(r2PublicState.counts.left).toBe(108);
    expect(r2PublicState.counts.right).toBe(108);
    expect(r2PublicState.counts.chaos).toBe(1);

    // Launch and finish Round 2
    await orchestrator.completeCountdown();
    const finishR2 = (await orchestrator.finishGame("timer")) as any;
    expect(finishR2.ok).toBe(true);
    expect(finishR2.data.roundNumber).toBe(2);

    // Flush persistence work
    await persistenceService.flush();

    // 13. Verify persisted documents: exact team counts, exact scores, exact chaos ID, exact extension history
    expect(mockRounds.documents.size).toBe(2);
    const round1Doc = Array.from(mockRounds.documents.values()).find((r: any) => r.roundNumber === 1);
    expect(round1Doc).toBeDefined();
    expect(round1Doc.teamLeftCount).toBe(108);
    expect(round1Doc.teamRightCount).toBe(108);
    expect(round1Doc.wildcardPlayerId).toBe(chaosPlayer.playerId);
    expect(round1Doc.scoreLeft).toBe(finishRes.data.left);
    expect(round1Doc.scoreRight).toBe(finishRes.data.right);
    expect(round1Doc.extensions.length).toBe(1);
    expect(round1Doc.extensions[0].seconds).toBe(10);
    expect(round1Doc.composition.length).toBe(217);

    await persistenceService.shutdown();
  });
});

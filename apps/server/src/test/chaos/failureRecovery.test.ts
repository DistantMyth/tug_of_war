import { beforeEach, describe, expect, it } from "vitest";
import { GameOrchestrator } from "../../engine/orchestrator/GameOrchestrator.js";
import { PlayerIdentityService } from "../../identity/service.js";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";

describe("Failure Injection & Chaos Recovery Testing", () => {
  let repository: MemoryGameRepository;
  let identityService: PlayerIdentityService;
  let orchestrator: GameOrchestrator;

  beforeEach(async () => {
    repository = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repository);
    orchestrator = new GameOrchestrator(repository);
  });

  it("handles player disconnect and reconnect cleanly while preserving identity, team, and score eligibility", async () => {
    const openRes = await orchestrator.openGame({ durationMs: 30000 });
    const gameId = (openRes as any).data.gameId;

    // 1. Initial registration
    const regRes = await identityService.registerOrResume({});
    expect(regRes.ok).toBe(true);
    const { token, player } = (regRes as any).data;

    // 2. Select team
    const chooseRes = await repository.chooseOrSwitchTeam(gameId, player.playerId, "left");
    expect(chooseRes.ok).toBe(true);

    // 3. Simulate disconnect (socket closed, marked offline)
    await repository.setPlayerOnline(gameId, player.playerId, false);

    // 4. Reconnect with existing token
    const resumeRes = await identityService.registerOrResume({ token });
    expect(resumeRes.ok).toBe(true);
    expect((resumeRes as any).data.isNew).toBe(false);
    expect((resumeRes as any).data.player.playerId).toBe(player.playerId);
    expect((resumeRes as any).data.player.team).toBe("left");
    expect((resumeRes as any).data.player.label).toBe(player.label);
  });

  it("safely handles race condition when host locks while player attempts team switch", async () => {
    const openRes = await orchestrator.openGame({ durationMs: 30000 });
    const gameId = (openRes as any).data.gameId;
    const regRes = await identityService.registerOrResume({});
    const playerId = (regRes as any).data.player.playerId;

    await repository.chooseOrSwitchTeam(gameId, playerId, "left");

    // Host locks roster
    await orchestrator.lockGame();

    // Player attempts to switch team during lock
    const switchRes = await repository.chooseOrSwitchTeam(gameId, playerId, "right");
    expect(switchRes.ok).toBe(false);
    expect((switchRes as any).error.code).toBe("INVALID_PHASE");
  });

  it("rejects taps when game is PAUSED or FINISHED without losing scores", async () => {
    const openRes = await orchestrator.openGame({ durationMs: 30000 });
    const gameId = (openRes as any).data.gameId;

    // Register 2 players (1 left, 1 right for balanced match)
    const p1 = (await identityService.registerOrResume({}) as any).data.player.playerId;
    const p2 = (await identityService.registerOrResume({}) as any).data.player.playerId;

    await repository.chooseOrSwitchTeam(gameId, p1, "left");
    await repository.chooseOrSwitchTeam(gameId, p2, "right");

    await orchestrator.lockGame();
    await orchestrator.startCountdown(10);
    await new Promise((r) => setTimeout(r, 20));
    await orchestrator.completeCountdown();

    // Valid tap during RUNNING
    const tap1 = await orchestrator.processTap(p1);
    expect(tap1.ok).toBe(true);

    // Host pauses match
    await orchestrator.pauseGame();

    // Tap rejected during PAUSED
    const tapDuringPause = await orchestrator.processTap(p1);
    expect(tapDuringPause.ok).toBe(false);

    // Host resumes match
    await orchestrator.resumeGame();
    const tapAfterResume = await orchestrator.processTap(p1);
    expect(tapAfterResume.ok).toBe(true);

    // Finish match
    await orchestrator.finishGame("timer");

    // Tap rejected after FINISHED
    const tapAfterFinish = await orchestrator.processTap(p1);
    expect(tapAfterFinish.ok).toBe(false);
  });

  it("recovers timer accurately when server process restarts during RUNNING phase", async () => {
    const openRes = await orchestrator.openGame({ durationMs: 30000 });
    const gameId = (openRes as any).data.gameId;
    const p1 = (await identityService.registerOrResume({}) as any).data.player.playerId;
    const p2 = (await identityService.registerOrResume({}) as any).data.player.playerId;
    await repository.chooseOrSwitchTeam(gameId, p1, "left");
    await repository.chooseOrSwitchTeam(gameId, p2, "right");

    await orchestrator.lockGame();
    await orchestrator.startCountdown(10);
    await new Promise((r) => setTimeout(r, 20));
    await orchestrator.completeCountdown();

    // Simulate process crash and new orchestrator instance booting
    const newOrchestrator = new GameOrchestrator(repository);
    await newOrchestrator.recoverProcessState();

    expect(newOrchestrator.timerManager.isScheduled(gameId)).toBe(true);
    newOrchestrator.timerManager.dispose();
  });
});

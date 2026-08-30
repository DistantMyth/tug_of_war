import { beforeEach, describe, expect, it } from "vitest";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";
import type { StoredGameState } from "../../store/redis/types.js";
import { GameOrchestrator } from "./GameOrchestrator.js";

describe("GameOrchestrator — Full Lifecycle & Team Balancing Orchestration", () => {
  let repo: MemoryGameRepository;
  let orchestrator: GameOrchestrator;

  beforeEach(() => {
    repo = new MemoryGameRepository();
    orchestrator = new GameOrchestrator(repo);
  });

  // ==================================================
  // 1. OPEN GAME & PERMANENT QR POINTER
  // ==================================================
  describe("openGame", () => {
    it("creates an active game session and sets tow:event:current pointer", async () => {
      const result = await orchestrator.openGame({ durationMs: 45000 });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.gameId).toBeDefined();
      expect(result.data.publicState.phase).toBe("OPEN");
      expect(result.data.publicState.roundNumber).toBe(1);
      expect(result.data.publicState.timing.durationMs).toBe(45000);

      const activeId = await repo.getCurrentGameId();
      expect(activeId).toBe(result.data.gameId);
    });
  });

  // ==================================================
  // 2. LOCK GAME & EMPTY ROSTER RULE
  // ==================================================
  describe("lockGame", () => {
    it("rejects locking an empty lobby with EMPTY_ROSTER and remains OPEN", async () => {
      const open = await orchestrator.openGame();
      expect(open.ok).toBe(true);

      const lock = await orchestrator.lockGame();
      expect(lock.ok).toBe(false);
      if (!lock.ok) {
        expect(lock.code).toBe("EMPTY_ROSTER");
      }

      // Game must still be in OPEN phase
      const gameId = await repo.getCurrentGameId();
      const game = await repo.getGame(gameId!);
      expect(game.ok && game.value.phase).toBe("OPEN");
      expect(game.ok && game.value.joinAllowed).toBe(true);
    });

    it("skips BALANCING and transitions directly to COUNTDOWN for an already balanced even lobby", async () => {
      const open = await orchestrator.openGame();
      expect(open.ok).toBe(true);
      const gameId = (open as any).data.gameId;

      // Add 1 player Left, 1 player Right
      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "right", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });

      const lock = await orchestrator.lockGame();
      expect(lock.ok).toBe(true);
      if (!lock.ok) return;

      expect(lock.data.phase).toBe("COUNTDOWN");

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("COUNTDOWN");
      expect(game.ok && game.value.countdownEndsAt).toBeDefined();
    });

    it("enters BALANCING for an unbalanced lobby and writes balance plan", async () => {
      const open = await orchestrator.openGame();
      expect(open.ok).toBe(true);
      const gameId = (open as any).data.gameId;

      // 4 on Left, 0 on Right
      for (let i = 1; i <= 4; i++) {
        await repo.addOrUpdatePlayer(gameId, {
          playerId: `p${i}`,
          label: `P-00${i}`,
          team: "left",
          wildcard: false,
          status: "online",
          joinedAt: 100 * i,
          lastSeen: 100 * i,
        });
      }

      const lock = await orchestrator.lockGame();
      expect(lock.ok).toBe(true);
      if (!lock.ok) return;

      expect(lock.data.phase).toBe("BALANCING");
      expect(lock.data.plan).toBeDefined();
      expect(lock.data.plan?.targetLeft).toBe(2);
      expect(lock.data.plan?.targetRight).toBe(2);
      expect(lock.data.plan?.remainingLeftToRight).toBe(2);
      expect(lock.data.plan?.remainingRightToLeft).toBe(0);

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("BALANCING");
    });
  });

  // ==================================================
  // 3. WILDCARD BALANCING FLOW (ODD PLAYERS)
  // ==================================================
  describe("Wildcard / Chaos Player", () => {
    it("handles odd total (3 players: 2 Left, 1 Right) with wildcard selection", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p3", label: "P-003", team: "right", wildcard: false, status: "online", joinedAt: 300, lastSeen: 300 });

      const lock = await orchestrator.lockGame();
      expect(lock.ok).toBe(true);
      if (!lock.ok) return;

      expect(lock.data.phase).toBe("BALANCING");
      expect(lock.data.plan?.wildcardNeeded).toBe(1);

      // Select p1 (on surplus left) as wildcard
      const wildcardRes = await orchestrator.selectWildcard("p1");
      expect(wildcardRes.ok).toBe(true);
      if (!wildcardRes.ok) return;

      expect(wildcardRes.data.balanceComplete).toBe(true);
      expect(wildcardRes.data.counts.left).toBe(1);
      expect(wildcardRes.data.counts.right).toBe(1);
      expect(wildcardRes.data.counts.chaos).toBe(1);

      // Wildcard completion triggers COUNTDOWN
      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("COUNTDOWN");
    });

    it("rejects selecting a player not on the surplus team or not in the roster", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p3", label: "P-003", team: "right", wildcard: false, status: "online", joinedAt: 300, lastSeen: 300 });

      await orchestrator.lockGame();

      // Nonexistent player
      const fakeRes = await orchestrator.selectWildcard("nonexistent_id");
      expect(fakeRes.ok).toBe(false);
      if (!fakeRes.ok) {
        expect(fakeRes.code).toBe("UNKNOWN_PLAYER");
      }
    });
  });

  // ==================================================
  // 4. VOLUNTEER BALANCING FLOW
  // ==================================================
  describe("Volunteer Balancing Moves", () => {
    it("allows surplus team player to volunteer, updates counts, and triggers COUNTDOWN on completion", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      // 3 on Left, 1 on Right (Needs 1 move from Left -> Right)
      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p3", label: "P-003", team: "left", wildcard: false, status: "online", joinedAt: 300, lastSeen: 300 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p4", label: "P-004", team: "right", wildcard: false, status: "online", joinedAt: 400, lastSeen: 400 });

      await orchestrator.lockGame();

      // p1 volunteers from Left -> Right
      const volRes = await orchestrator.applyVolunteerMove("p1");
      expect(volRes.ok).toBe(true);
      if (!volRes.ok) return;

      expect(volRes.data.move.from).toBe("left");
      expect(volRes.data.move.to).toBe("right");
      expect(volRes.data.counts.left).toBe(2);
      expect(volRes.data.counts.right).toBe(2);
      expect(volRes.data.balanceComplete).toBe(true);

      // Transitioned to COUNTDOWN
      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("COUNTDOWN");
    });

    it("rejects volunteer move from deficit team with MOVE_WOULD_OVERSHOOT", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      // 3 on Left, 1 on Right
      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p3", label: "P-003", team: "left", wildcard: false, status: "online", joinedAt: 300, lastSeen: 300 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p4", label: "P-004", team: "right", wildcard: false, status: "online", joinedAt: 400, lastSeen: 400 });

      await orchestrator.lockGame();

      // p4 on deficit Right tries to volunteer to Left
      const badRes = await orchestrator.applyVolunteerMove("p4");
      expect(badRes.ok).toBe(false);
      if (!badRes.ok) {
        expect(badRes.code).toBe("MOVE_WOULD_OVERSHOOT");
      }
    });
  });

  // ==================================================
  // 5. AUTO-BALANCE PREVIEW & CONFIRMATION
  // ==================================================
  describe("Auto-Balance", () => {
    it("generates deterministic preview and applies auto-balance atomically", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      // 5 on Left, 1 on Right (total 6: targets 3 Left, 3 Right, need 2 moves)
      for (let i = 1; i <= 5; i++) {
        await repo.addOrUpdatePlayer(gameId, {
          playerId: `p${i}`,
          label: `P-00${i}`,
          team: "left",
          wildcard: false,
          status: "online",
          joinedAt: 100 * i,
          lastSeen: 100 * i,
        });
      }
      await repo.addOrUpdatePlayer(gameId, {
        playerId: "p6",
        label: "P-006",
        team: "right",
        wildcard: false,
        status: "online",
        joinedAt: 600,
        lastSeen: 600,
      });

      await orchestrator.lockGame();

      const previewRes = await orchestrator.previewAutoBalance();
      expect(previewRes.ok).toBe(true);
      if (!previewRes.ok) return;

      expect(previewRes.data.moves.length).toBe(2);
      expect(previewRes.data.finalCounts.left).toBe(3);
      expect(previewRes.data.finalCounts.right).toBe(3);

      // Confirm
      const confirmRes = await orchestrator.confirmAutoBalance();
      expect(confirmRes.ok).toBe(true);
      if (!confirmRes.ok) return;

      expect(confirmRes.data.movesApplied).toBe(2);
      expect(confirmRes.data.counts.left).toBe(3);
      expect(confirmRes.data.counts.right).toBe(3);

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("COUNTDOWN");
    });

    it("rejects auto-balance confirm with CONCURRENT_MODIFICATION if player moved before confirm", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      // 4 on Left, 0 on Right
      for (let i = 1; i <= 4; i++) {
        await repo.addOrUpdatePlayer(gameId, {
          playerId: `p${i}`,
          label: `P-00${i}`,
          team: "left",
          wildcard: false,
          status: "online",
          joinedAt: 100 * i,
          lastSeen: 100 * i,
        });
      }

      await orchestrator.lockGame();

      const previewRes = await orchestrator.previewAutoBalance();
      expect(previewRes.ok).toBe(true);
      if (!previewRes.ok) return;

      const staleMoves = previewRes.data.moves;

      // Volunteer move happens before admin confirms
      const volunteerPlayerId = staleMoves[0]!.playerId;
      await orchestrator.applyVolunteerMove(volunteerPlayerId);

      // Admin tries to apply stale preview
      const confirmRes = await orchestrator.confirmAutoBalance(staleMoves);
      expect(confirmRes.ok).toBe(false);
      if (!confirmRes.ok) {
        expect(confirmRes.code).toBe("CONCURRENT_MODIFICATION");
      }
    });
  });

  // ==================================================
  // 6. CANCEL BALANCING
  // ==================================================
  describe("cancelBalancing", () => {
    it("reverts BALANCING phase back to OPEN", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });

      await orchestrator.lockGame();

      const cancelRes = await orchestrator.cancelBalancing();
      expect(cancelRes.ok).toBe(true);

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("OPEN");
      expect(game.ok && game.value.joinAllowed).toBe(true);
    });
  });

  // ==================================================
  // 7. COUNTDOWN & COMPLETE TO RUNNING
  // ==================================================
  describe("Countdown -> Running", () => {
    it("transitions from COUNTDOWN to RUNNING on completeCountdown", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "right", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });

      await orchestrator.lockGame();

      const completeRes = await orchestrator.completeCountdown(gameId);
      expect(completeRes.ok).toBe(true);

      const game = await repo.getGame(gameId);
      expect(game.ok && game.value.phase).toBe("RUNNING");
      expect(game.ok && game.value.startTime).toBeDefined();
    });

    it("rejects manual startCountdown if teams are not balanced with BALANCE_INCOMPLETE", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      // Unbalanced
      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P-001", team: "left", wildcard: false, status: "online", joinedAt: 100, lastSeen: 100 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P-002", team: "left", wildcard: false, status: "online", joinedAt: 200, lastSeen: 200 });

      await orchestrator.lockGame();

      const countdownRes = await orchestrator.startCountdown();
      expect(countdownRes.ok).toBe(false);
      if (!countdownRes.ok) {
        expect(countdownRes.code).toBe("BALANCE_INCOMPLETE");
      }
    });
  });

  // ==================================================
  // 8. ODD PLAYER TOTALS & EXTREME DISTRIBUTIONS
  // ==================================================
  describe("Odd Totals & Extreme Distributions", () => {
    it.each([1, 3, 5, 21, 203, 217])(
      "correctly balances odd roster size of %i players into equal teams + 1 chaos",
      async (total) => {
        const open = await orchestrator.openGame();
        const gameId = (open as any).data.gameId;

        // All on Left initially
        for (let i = 1; i <= total; i++) {
          await repo.addOrUpdatePlayer(gameId, {
            playerId: `p_${total}_${i}`,
            label: `P-${i}`,
            team: "left",
            wildcard: false,
            status: "online",
            joinedAt: i * 10,
            lastSeen: i * 10,
          });
        }

        await orchestrator.lockGame();

        // Auto-balance
        const confirmRes = await orchestrator.confirmAutoBalance();
        expect(confirmRes.ok).toBe(true);
        if (!confirmRes.ok) return;

        const expectedEach = Math.floor(total / 2);
        expect(confirmRes.data.counts.left).toBe(expectedEach);
        expect(confirmRes.data.counts.right).toBe(expectedEach);
        expect(confirmRes.data.counts.chaos).toBe(1);
        expect(confirmRes.data.counts.total).toBe(total);
      },
    );
  });

  // ==================================================
  // 9. EMERGENCY STOP & SESSION RESET
  // ==================================================
  describe("Emergency Stop & Reset Lifecycle", () => {
    it("successfully performs emergencyStop from RUNNING state", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P1", team: "left", wildcard: false, status: "online", joinedAt: 10, lastSeen: 10 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P2", team: "right", wildcard: false, status: "online", joinedAt: 20, lastSeen: 20 });

      await orchestrator.lockGame();
      await orchestrator.completeCountdown(gameId);

      const runningGame = await repo.getGame(gameId);
      expect((runningGame as any).value.phase).toBe("RUNNING");

      const stopRes = await orchestrator.emergencyStop();
      expect(stopRes.ok).toBe(true);

      const stoppedGame = await repo.getGame(gameId);
      expect((stoppedGame as any).value.phase).toBe("WAITING");
      expect((stoppedGame as any).value.joinAllowed).toBe(false);
    });

    it("successfully performs endEvent from FINISHED state", async () => {
      const open = await orchestrator.openGame();
      const gameId = (open as any).data.gameId;

      await repo.addOrUpdatePlayer(gameId, { playerId: "p1", label: "P1", team: "left", wildcard: false, status: "online", joinedAt: 10, lastSeen: 10 });
      await repo.addOrUpdatePlayer(gameId, { playerId: "p2", label: "P2", team: "right", wildcard: false, status: "online", joinedAt: 20, lastSeen: 20 });

      await orchestrator.lockGame();
      await orchestrator.completeCountdown(gameId);
      await orchestrator.finishGame("timer");

      const finishedGame = await repo.getGame(gameId);
      expect((finishedGame as any).value.phase).toBe("FINISHED");

      const endRes = await orchestrator.endEvent();
      expect(endRes.ok).toBe(true);

      const endedGame = await repo.getGame(gameId);
      expect((endedGame as any).value.phase).toBe("WAITING");
    });

    it("successfully resets session with resetSession", async () => {
      const open = await orchestrator.openGame();
      expect(open.ok).toBe(true);

      const currentGameId = await repo.getCurrentGameId();
      expect(currentGameId).toBeTruthy();

      const resetRes = await orchestrator.resetSession();
      expect(resetRes.ok).toBe(true);

      const afterResetGameId = await repo.getCurrentGameId();
      expect(afterResetGameId).toBeNull();
    });
  });
});


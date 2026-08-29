import { beforeEach, describe, expect, it, vi } from "vitest";
import { MongoClientService } from "./client.js";
import { MongoPersistenceService } from "./persistenceService.js";

describe("MongoPersistenceService (Non-blocking Asynchronous Write-Behind)", () => {
  let mockClient: MongoClientService;
  let persistence: MongoPersistenceService;

  beforeEach(() => {
    mockClient = new MongoClientService();
    persistence = new MongoPersistenceService(mockClient, {
      maxAttempts: 3,
      initialBackoffMs: 10,
      maxBackoffMs: 50,
    });
  });

  it("handles disabled mongo client without crashing or blocking", async () => {
    expect(() => {
      persistence.persistSessionCreated({
        sessionId: "sess_1",
        status: "active",
        createdAt: Date.now(),
        config: { roundDurationMs: 30000 },
      });
    }).not.toThrow();

    await persistence.flush(500);
    expect(persistence.getErrorCount()).toBe(0);
  });

  it("persists round completed asynchronously when connected", async () => {
    const updateOneMock = vi.fn().mockResolvedValue({ acknowledged: true });
    vi.spyOn(mockClient, "getHealth").mockReturnValue({ status: "connected" });
    vi.spyOn(mockClient, "getRoundsCollection").mockReturnValue({
      updateOne: updateOneMock,
    } as any);

    persistence.persistRoundCompleted({
      sessionId: "sess_100",
      roundNumber: 1,
      startedAt: Date.now() - 30000,
      endedAt: Date.now(),
      durationMs: 30000,
      pauseAccumMs: 0,
      extensions: [{ seconds: 5, timestamp: Date.now() - 10000 }],
      teamLeftCount: 50,
      teamRightCount: 50,
      wildcardPlayerId: null,
      scoreLeft: 520,
      scoreRight: 490,
      winner: "left",
      finishReason: "timer",
      composition: [
        { playerId: "p1", label: "P-001", team: "left" },
        { playerId: "p2", label: "P-002", team: "right" },
      ],
      createdAt: Date.now(),
    });

    await persistence.flush(1000);

    expect(updateOneMock).toHaveBeenCalledWith(
      { sessionId: "sess_100", roundNumber: 1 },
      expect.objectContaining({
        $set: expect.objectContaining({
          sessionId: "sess_100",
          winner: "left",
          scoreLeft: 520,
        }),
      }),
      { upsert: true },
    );
  });

  it("swallows mongo exceptions safely without throwing into gameplay thread", async () => {
    const updateOneMock = vi.fn().mockRejectedValue(new Error("MongoDB Connection Pool Timeout"));
    vi.spyOn(mockClient, "getHealth").mockReturnValue({ status: "connected" });
    vi.spyOn(mockClient, "getRoundsCollection").mockReturnValue({
      updateOne: updateOneMock,
    } as any);

    // Caller never gets exception
    expect(() => {
      persistence.persistRoundCompleted({
        sessionId: "sess_fail",
        roundNumber: 1,
        startedAt: Date.now() - 30000,
        endedAt: Date.now(),
        durationMs: 30000,
        pauseAccumMs: 0,
        extensions: [],
        teamLeftCount: 10,
        teamRightCount: 10,
        wildcardPlayerId: null,
        scoreLeft: 100,
        scoreRight: 90,
        winner: "left",
        finishReason: "timer",
        composition: [],
        createdAt: Date.now(),
      });
    }).not.toThrow();

    await persistence.flush(500);
    expect(persistence.getErrorCount()).toBeGreaterThanOrEqual(1);
  });

  it("persists player roster and audit events", async () => {
    const bulkWriteMock = vi.fn().mockResolvedValue({ acknowledged: true });
    const auditUpdateOneMock = vi.fn().mockResolvedValue({ acknowledged: true });

    vi.spyOn(mockClient, "getHealth").mockReturnValue({ status: "connected" });
    vi.spyOn(mockClient, "getPlayersCollection").mockReturnValue({
      bulkWrite: bulkWriteMock,
    } as any);
    vi.spyOn(mockClient, "getAuditCollection").mockReturnValue({
      updateOne: auditUpdateOneMock,
    } as any);

    persistence.persistPlayerRoster("sess_200", [
      {
        sessionId: "sess_200",
        playerId: "p1",
        displayLabel: "P-001",
        finalTeam: "left",
        wasWildcard: false,
        role: "left",
        status: "online",
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    persistence.persistAuditEvent({
      sessionId: "sess_200",
      eventType: "ROUND_START",
      data: { round: 1 },
      timestamp: Date.now(),
    });

    await persistence.flush(1000);

    expect(bulkWriteMock).toHaveBeenCalled();
    expect(auditUpdateOneMock).toHaveBeenCalled();
  });
});

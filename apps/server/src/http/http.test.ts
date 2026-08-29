import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { PlayerIdentityService } from "../identity/service.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import { createApp } from "./app.js";

describe("HTTP Bootstrap Endpoints", () => {
  let server: Server;
  let baseUrl: string;
  let repo: MemoryGameRepository;
  let identityService: PlayerIdentityService;

  const gameId = "game_http_test_1";

  beforeAll(async () => {
    repo = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repo, { tokenSecret: "test-http-secret" });

    const app = createApp({
      repository: repo,
      identityService,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("GET /health returns health report", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.ok).toBe(true);
    expect(data.redis).toBeDefined();
  });

  it("GET /api/session/current returns active: false when no session is set", async () => {
    const res = await fetch(`${baseUrl}/api/session/current`);
    expect(res.status).toBe(200);

    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.data.active).toBe(false);
  });

  it("POST /api/player/register returns 404 GAME_NOT_FOUND when no active game session exists", async () => {
    const res = await fetch(`${baseUrl}/api/player/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(false);
    expect(json.code).toBe("GAME_NOT_FOUND");
    expect(json.message).toContain("No active game session");
  });

  it("POST /api/player/register creates a new player with authoritative shape when game is OPEN", async () => {
    // Setup active game
    await repo.createGame({
      gameId,
      phase: "OPEN",
      roundNumber: 1,
      createdAt: Date.now(),
      durationMs: 30000,
      startTime: null,
      endTime: null,
      pausedAt: null,
      pauseAccumMs: 0,
      countdownEndsAt: null,
      winner: null,
      joinAllowed: true,
    });
    await repo.setCurrentGameId(gameId);

    const res = await fetch(`${baseUrl}/api/player/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
    expect(json.data.isNew).toBe(true);
    expect(json.data.player.label).toBe("P-001");
    expect(json.data.player.playerId).toBeDefined();
    expect(json.data.player.status).toBe("online");
    expect(typeof json.data.token).toBe("string");
    expect(json.data.publicState).toBeDefined();
    expect(json.data.publicState.phase).toBe("OPEN");

    // Resuming with the token returned: guarantees no duplicate player
    const resumeRes = await fetch(`${baseUrl}/api/player/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: json.data.token }),
    });

    expect(resumeRes.status).toBe(200);
    const resumeJson = (await resumeRes.json()) as any;
    expect(resumeJson.ok).toBe(true);
    expect(resumeJson.data.isNew).toBe(false);
    expect(resumeJson.data.player.playerId).toBe(json.data.player.playerId);
    expect(resumeJson.data.player.label).toBe(json.data.player.label);

    const counts = await repo.getCounts(gameId);
    expect(counts.ok ? counts.value.total : 0).toBe(1);
  });

  it("POST /api/player/register returns 409 when registration is closed", async () => {
    await repo.updateGame(gameId, { phase: "LOCKING", joinAllowed: false });

    const res = await fetch(`${baseUrl}/api/player/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(409);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(false);
    expect(json.code).toBe("JOIN_CLOSED");
  });

  it("POST /api/player/register returns 401 when an invalid token is passed", async () => {
    const res = await fetch(`${baseUrl}/api/player/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid.jwt.token" }),
    });

    expect(res.status).toBe(401);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });
});

import http, { type Server as HttpServer } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { GameCounts, PublicState, YouView } from "@tow/shared";
import { createApp } from "../http/app.js";
import { PlayerIdentityService } from "../identity/service.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import type { StoredGameState } from "../store/redis/types.js";
import { setupGameSocketServer, type GameSocketServerResult } from "./server.js";

describe("Socket.IO /game Namespace — Player & Display Transport", () => {
  let httpServer: HttpServer;
  let serverPort: number;
  let baseUrl: string;
  let repo: MemoryGameRepository;
  let identityService: PlayerIdentityService;
  let socketServer: GameSocketServerResult;

  const gameId = "game_socket_test_1";
  const displaySecret = "test-display-secret-123";
  const openClients: ClientSocket[] = [];

  function createClient(options?: {
    token?: string;
    role?: "player" | "display";
    displayToken?: string;
  }): ClientSocket {
    const client = ioc(`${baseUrl}/game`, {
      auth: {
        role: options?.role ?? "player",
        token: options?.token,
        displayToken: options?.displayToken,
      },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(client);
    return client;
  }

  function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  function waitForConnect(socket: ClientSocket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }
      socket.once("connect", () => resolve());
      socket.once("connect_error", (err) => reject(err));
    });
  }

  beforeAll(async () => {
    process.env.DISPLAY_SECRET = displaySecret;
    repo = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repo, { tokenSecret: "test-socket-token-secret" });

    const app = createApp({ repository: repo, identityService });
    httpServer = http.createServer(app);

    socketServer = setupGameSocketServer(httpServer, {
      repository: repo,
      identityService,
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === "object") {
          serverPort = addr.port;
          baseUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const c of openClients) {
      c.disconnect();
    }
    socketServer.io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(async () => {
    // Reset game state before each test
    const game: StoredGameState = {
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
    };
    await repo.createGame(game);
    await repo.setCurrentGameId(gameId);
  });

  afterEach(() => {
    while (openClients.length > 0) {
      const c = openClients.pop();
      c?.disconnect();
    }
  });

  // ==================================================
  // 1. AUTHENTICATION & HANDSHAKE
  // ==================================================
  describe("Authentication & Handshake", () => {
    it("connects player with valid token successfully", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const client = createClient({ token: reg.data.token });
      await waitForConnect(client);
      expect(client.connected).toBe(true);
    });

    it("rejects connection when handshake token is invalid", async () => {
      const client = createClient({ token: "invalid.token.string" });
      await expect(waitForConnect(client)).rejects.toThrow();
      expect(client.connected).toBe(false);
    });

    it("connects display with valid displayToken", async () => {
      const client = createClient({ role: "display", displayToken: displaySecret });
      const syncPromise = waitForEvent<{ public: PublicState }>(client, "sync");
      await waitForConnect(client);
      expect(client.connected).toBe(true);

      const sync = await syncPromise;
      // Sync payload uses `public` key (matches SyncPayload/DisplaySyncPayload shared type)
      expect(sync.public.sessionId).toBe(gameId);
      expect(sync.public.phase).toBe("OPEN");
    });

    it("rejects display with invalid displayToken", async () => {
      const client = createClient({ role: "display", displayToken: "wrong-secret-pin" });
      await expect(waitForConnect(client)).rejects.toThrow(/UNAUTHORIZED/);
    });

    it("rejects participant attempting role: display without valid secret", async () => {
      const client = createClient({ role: "display" });
      await expect(waitForConnect(client)).rejects.toThrow(/UNAUTHORIZED/);
    });
  });

  // ==================================================
  // 2. PLAYER HELLO & SYNC
  // ==================================================
  describe("player:hello & State Synchronization", () => {
    it("receives state sync via player:hello", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      // Connect without token in handshake, authenticate via player:hello
      const client = createClient({});
      await waitForConnect(client);

      const helloAck = await new Promise<any>((resolve) => {
        client.emit("player:hello", { token: reg.data.token }, (ack: any) => resolve(ack));
      });

      expect(helloAck.ok).toBe(true);
      expect(helloAck.data.you.playerId).toBe(reg.data.player.playerId);
      // Sync key is `public` (fixed from legacy `publicState`)
      expect(helloAck.data.public.phase).toBe("OPEN");
    });

    it("re-fetches state via player:request_sync", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const client = createClient({ token: reg.data.token });
      await waitForConnect(client);

      const syncAck = await new Promise<any>((resolve) => {
        client.emit("player:request_sync", {}, (ack: any) => resolve(ack));
      });

      expect(syncAck.ok).toBe(true);
      // Sync key is `public` (fixed from legacy `publicState`)
      expect(syncAck.data.public.phase).toBe("OPEN");
      expect(syncAck.data.you.playerId).toBe(reg.data.player.playerId);
    });
  });

  // ==================================================
  // 3. TEAM SELECTION & SWITCHING
  // ==================================================
  describe("Team Selection & Switching", () => {
    it("chooses LEFT and broadcasts live counts to all clients", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      // Create display listener
      const display = createClient({ role: "display", displayToken: displaySecret });
      await waitForConnect(display);

      // Create player socket
      const player = createClient({ token: reg.data.token });
      await waitForConnect(player);

      // Listen for broadcasts
      const displayCountsPromise = waitForEvent<GameCounts>(display, "game:counts");
      const playerYouPromise = waitForEvent<YouView>(player, "player:you");

      const chooseAck = await new Promise<any>((resolve) => {
        player.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
      });

      expect(chooseAck.ok).toBe(true);
      expect(chooseAck.data.team).toBe("left");
      expect(chooseAck.data.counts.left).toBe(1);

      const [displayCounts, playerYou] = await Promise.all([displayCountsPromise, playerYouPromise]);
      expect(displayCounts.left).toBe(1);
      expect(displayCounts.right).toBe(0);
      expect(playerYou.team).toBe("left");
      expect(playerYou.role).toBe("left");
    });

    it("switches from LEFT to RIGHT", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const player = createClient({ token: reg.data.token });
      await waitForConnect(player);

      // Choose LEFT first
      await new Promise<any>((resolve) => {
        player.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
      });

      // Switch to RIGHT
      const switchAck = await new Promise<any>((resolve) => {
        player.emit("player:switch_team", { team: "right" }, (ack: any) => resolve(ack));
      });

      expect(switchAck.ok).toBe(true);
      expect(switchAck.data.team).toBe("right");
      expect(switchAck.data.counts.left).toBe(0);
      expect(switchAck.data.counts.right).toBe(1);
    });

    it("rejects team selection when game is not in OPEN phase", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const player = createClient({ token: reg.data.token });
      await waitForConnect(player);

      // Lock game
      await repo.updateGame(gameId, { phase: "LOCKING", joinAllowed: false });

      const chooseAck = await new Promise<any>((resolve) => {
        player.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
      });

      expect(chooseAck.ok).toBe(false);
      expect(chooseAck.code).toBe("SWITCH_LOCKED");
    });

    it("rejects malformed team selection payloads", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const player = createClient({ token: reg.data.token });
      await waitForConnect(player);

      const badAck = await new Promise<any>((resolve) => {
        player.emit("player:choose_team", { team: "middle" as any }, (ack: any) => resolve(ack));
      });

      expect(badAck.ok).toBe(false);
      expect(badAck.code).toBe("VALIDATION");
    });
  });

  // ==================================================
  // 4. DUPLICATE TAB & NEWEST SOCKET OWNERSHIP
  // ==================================================
  describe("Duplicate Tab & Newest-Socket Replacement", () => {
    it("replaces older socket when same token connects from new tab", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const token = reg.data.token;

      // Tab 1 connects
      const tab1 = createClient({ token });
      await waitForConnect(tab1);

      // Setup listener on Tab 1 for player:replaced
      const replacedPromise = waitForEvent<{ message: string }>(tab1, "player:replaced");

      // Tab 2 connects with same token
      const tab2 = createClient({ token });
      await waitForConnect(tab2);

      // Tab 1 must receive player:replaced
      const replacedData = await replacedPromise;
      expect(replacedData.message).toContain("Session resumed in another tab");

      // Tab 1 mutation attempt is rejected
      const tab1Attempt = await new Promise<any>((resolve) => {
        tab1.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
      });
      expect(tab1Attempt.ok).toBe(false);
      expect(tab1Attempt.code).toBe("SESSION_REPLACED");

      // Tab 2 mutation succeeds
      const tab2Attempt = await new Promise<any>((resolve) => {
        tab2.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
      });
      expect(tab2Attempt.ok).toBe(true);
      expect(tab2Attempt.data.team).toBe("left");
    });
  });

  // ==================================================
  // 5. DISCONNECT & RECONNECT
  // ==================================================
  describe("Disconnect & Reconnect", () => {
    it("preserves player team and updates counts on disconnect and reconnect", async () => {
      const reg = await identityService.registerOrResume({});
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      const token = reg.data.token;

      // Connect and choose left
      let playerSocket = createClient({ token });
      await waitForConnect(playerSocket);

      await new Promise<any>((resolve) => {
        playerSocket.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
      });

      // Disconnect
      playerSocket.disconnect();

      // Wait a moment for disconnect cleanup
      await new Promise((r) => setTimeout(r, 50));

      // Check team membership preserved in repo
      const stored = await repo.getPlayer(gameId, reg.data.player.playerId);
      expect(stored.ok && stored.value.team).toBe("left");

      // Reconnect with same token
      playerSocket = createClient({ token });
      await waitForConnect(playerSocket);

      const syncAck = await new Promise<any>((resolve) => {
        playerSocket.emit("player:request_sync", {}, (ack: any) => resolve(ack));
      });

      expect(syncAck.ok).toBe(true);
      expect(syncAck.data.you.team).toBe("left");
    });
  });

  // ==================================================
  // 6. CONCURRENT TEAM SWITCHES
  // ==================================================
  describe("Concurrency", () => {
    it("handles 10 players choosing teams simultaneously without race corruption", async () => {
      const registrations = await Promise.all(
        Array.from({ length: 10 }, () => identityService.registerOrResume({})),
      );

      const clients = registrations.map((r) => {
        if (!r.ok) throw new Error("Registration failed");
        return createClient({ token: r.data.token });
      });

      await Promise.all(clients.map((c) => waitForConnect(c)));

      // 5 choose left, 5 choose right concurrently
      const mutationPromises = clients.map((c, i) => {
        const team = i < 5 ? "left" : "right";
        return new Promise<any>((resolve) => {
          c.emit("player:choose_team", { team }, (ack: any) => resolve(ack));
        });
      });

      const acks = await Promise.all(mutationPromises);
      expect(acks.every((a) => a.ok)).toBe(true);

      const counts = await repo.getCounts(gameId);
      expect(counts.ok).toBe(true);
      if (counts.ok) {
        expect(counts.value.left).toBe(5);
        expect(counts.value.right).toBe(5);
        expect(counts.value.total).toBe(10);
      }
    });
  });
});

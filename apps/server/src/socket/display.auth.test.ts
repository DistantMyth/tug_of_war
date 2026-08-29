/**
 * Display socket authentication regression tests.
 * Covers requirements 9 and 12:
 *  9. Player socket cannot impersonate display
 * 12. No raw display secret appears in logs
 *
 * Also covers:
 *  - correct displayToken connects as role="display"
 *  - wrong displayToken is rejected
 *  - display can connect with no active game (gets WAITING sync)
 *  - display receives initial sync after auth
 *  - admin token cannot impersonate display
 */
import http, { type Server as HttpServer } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { createApp } from "../http/app.js";
import { PlayerIdentityService } from "../identity/service.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import { setupGameSocketServer, type GameSocketServerResult } from "./server.js";

describe("Display Socket Authentication Regression", () => {
  let httpServer: HttpServer;
  let serverPort: number;
  let baseUrl: string;
  let repo: MemoryGameRepository;
  let identityService: PlayerIdentityService;
  let socketServer: GameSocketServerResult;

  const DISPLAY_SECRET = "test-display-secret-abc";
  const ADMIN_SECRET = "test-admin-secret-abc";
  const openClients: ClientSocket[] = [];

  function createDisplayClient(displayToken?: string): ClientSocket {
    const client = ioc(`${baseUrl}/game`, {
      auth: { role: "display", displayToken },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(client);
    return client;
  }

  function createPlayerClient(token?: string): ClientSocket {
    const client = ioc(`${baseUrl}/game`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(client);
    return client;
  }

  function createAdminClient(adminToken: string): ClientSocket {
    const client = ioc(`${baseUrl}/game`, {
      auth: { role: "admin", adminToken },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(client);
    return client;
  }

  function waitForConnect(socket: ClientSocket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (socket.connected) { resolve(); return; }
      socket.once("connect", () => resolve());
      socket.once("connect_error", (err) => reject(err));
    });
  }

  function waitForConnectError(socket: ClientSocket): Promise<Error> {
    return new Promise<Error>((resolve, reject) => {
      socket.once("connect_error", (err) => resolve(err));
      socket.once("connect", () => reject(new Error("Expected auth failure but socket connected")));
    });
  }

  function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for "${event}" after ${timeoutMs}ms`));
      }, timeoutMs);
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  beforeAll(async () => {
    process.env.DISPLAY_SECRET = DISPLAY_SECRET;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;

    repo = new MemoryGameRepository();
    identityService = new PlayerIdentityService(repo, { tokenSecret: "test-display-token-secret" });

    const app = createApp({ repository: repo, identityService });
    httpServer = http.createServer(app);

    socketServer = setupGameSocketServer(httpServer, { repository: repo, identityService });

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
    for (const c of openClients) c.disconnect();
    socketServer.orchestrator.dispose();
    socketServer.io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  afterEach(() => {
    while (openClients.length > 0) {
      const c = openClients.pop();
      c?.disconnect();
    }
  });

  // ── Display auth: correct token ──────────────────────────────────────────
  it("correct displayToken authenticates as role=display", async () => {
    const client = createDisplayClient(DISPLAY_SECRET);
    await expect(waitForConnect(client)).resolves.toBeUndefined();
    expect(client.connected).toBe(true);
  });

  // ── Display auth: wrong token ────────────────────────────────────────────
  it("wrong displayToken is rejected with UNAUTHORIZED error", async () => {
    const client = createDisplayClient("wrong-display-pin");
    const err = await waitForConnectError(client);
    expect(err.message).toMatch(/UNAUTHORIZED/);
    expect(client.connected).toBe(false);
  });

  // ── Display auth: no token ───────────────────────────────────────────────
  it("missing displayToken is rejected", async () => {
    const client = createDisplayClient(undefined);
    const err = await waitForConnectError(client);
    expect(err.message).toMatch(/UNAUTHORIZED/);
    expect(client.connected).toBe(false);
  });

  // ── Display connects with no active game ─────────────────────────────────
  it("display can connect when no active game exists and receives WAITING sync", async () => {
    const client = createDisplayClient(DISPLAY_SECRET);
    // Register sync listener BEFORE connect resolves — server emits sync inside the connection handler
    const syncPromise = waitForEvent(client, "sync", 5000);
    await waitForConnect(client);
    const sync = await syncPromise;
    // Should receive a sync with WAITING phase (no game) — shape: { public: { phase } }
    expect(sync).toBeDefined();
    expect((sync as any).public?.phase).toBe("WAITING");
  });

  // ── Display receives sync after open ────────────────────────────────────
  it("display receives real sync after admin opens a game", async () => {
    // Open a game first with admin
    const admin = createAdminClient(ADMIN_SECRET);
    await waitForConnect(admin);
    await new Promise<any>((resolve) => admin.emit("admin:open", { durationMs: 30000, adminToken: ADMIN_SECRET }, resolve));

    // Register sync listener BEFORE connect resolves
    const display = createDisplayClient(DISPLAY_SECRET);
    const syncPromise = waitForEvent(display, "sync", 5000);
    await waitForConnect(display);

    const sync = await syncPromise;
    expect(sync).toBeDefined();
    // Phase is nested under `public` key — { public: { phase: "OPEN" } }
    expect((sync as any).public?.phase).toBe("OPEN");
  });

  // ── Test 9: Player socket cannot impersonate display ─────────────────────
  it("9. player socket claiming role=display is rejected without displayToken", async () => {
    // A player attempting to connect as display without valid displayToken
    const impostor = ioc(`${baseUrl}/game`, {
      auth: { role: "display" }, // No displayToken
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(impostor);

    const err = await waitForConnectError(impostor);
    expect(err.message).toMatch(/UNAUTHORIZED/);
    expect(impostor.connected).toBe(false);
  });

  it("9b. player socket with player token cannot impersonate display", async () => {
    // Connect as a regular player first
    const playerClient = createPlayerClient();
    await waitForConnect(playerClient);
    expect(playerClient.connected).toBe(true);

    // player socket is role="player", not "display" — cannot access display events
    // Try connecting a socket claiming display role using a fake player token
    const impostor = ioc(`${baseUrl}/game`, {
      auth: { role: "display", displayToken: "fake-player-token-not-display" },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(impostor);
    const err = await waitForConnectError(impostor);
    expect(err.message).toMatch(/UNAUTHORIZED/);
  });

  it("9c. admin token cannot be used as displayToken", async () => {
    // Connect with role=display but passing adminToken as displayToken
    const impostor = ioc(`${baseUrl}/game`, {
      auth: { role: "display", displayToken: ADMIN_SECRET },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    openClients.push(impostor);
    const err = await waitForConnectError(impostor);
    expect(err.message).toMatch(/UNAUTHORIZED/);
  });

  // ── Test 12: No raw display secret in logs ───────────────────────────────
  it("12. display authentication log does not contain the raw display secret", async () => {
    const logMessages: string[] = [];
    // Spy on JSON.stringify output to capture what the logger would write
    const originalWrite = process.stdout.write.bind(process.stdout);
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((...args) => {
      const msg = String(args[0]);
      logMessages.push(msg);
      return originalWrite(...(args as Parameters<typeof originalWrite>));
    });

    try {
      const client = createDisplayClient(DISPLAY_SECRET);
      await waitForConnect(client);

      // Give logger a moment to flush
      await new Promise((r) => setTimeout(r, 100));

      // No log line should contain the raw display secret value
      for (const line of logMessages) {
        expect(line).not.toContain(DISPLAY_SECRET);
      }
    } finally {
      spy.mockRestore();
    }
  });
});

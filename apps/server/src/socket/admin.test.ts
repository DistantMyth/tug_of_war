import http, { type Server as HttpServer } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { BalancePlanView } from "@tow/shared";
import { createApp } from "../http/app.js";
import { PlayerIdentityService } from "../identity/service.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import { setupGameSocketServer, type GameSocketServerResult } from "./server.js";

describe("Socket.IO Admin Authentication & Stage Orchestration", () => {
  let httpServer: HttpServer;
  let serverPort: number;
  let baseUrl: string;
  let repo: MemoryGameRepository;
  let identityService: PlayerIdentityService;
  let socketServer: GameSocketServerResult;

  const adminSecret = "test-admin-secret-999";
  const displaySecret = "test-display-secret-123";
  const openClients: ClientSocket[] = [];

  function createClient(options?: {
    token?: string;
    role?: "player" | "display" | "admin";
    displayToken?: string;
    adminToken?: string;
  }): ClientSocket {
    const client = ioc(`${baseUrl}/game`, {
      auth: {
        role: options?.role ?? (options?.adminToken ? "admin" : "player"),
        token: options?.token,
        displayToken: options?.displayToken,
        adminToken: options?.adminToken,
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
    process.env.ADMIN_PASSWORD = adminSecret;
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
    socketServer.orchestrator.dispose();
    socketServer.io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  afterEach(() => {
    while (openClients.length > 0) {
      const c = openClients.pop();
      c?.disconnect();
    }
  });

  // ==========================================
  // AUTHENTICATION REGRESSION TESTS
  // ==========================================

  it("1. Unauthenticated player socket attempting admin:open is rejected (no handler registered)", async () => {
    const unauthClient = createClient({ role: "player" });
    await waitForConnect(unauthClient);

    // Player sockets have NO admin event handlers registered.
    // The emit produces no ack — the callback never fires.
    // We verify this by racing a short timeout against the ack.
    const openAck = await Promise.race([
      new Promise<any>((resolve) => {
        unauthClient.emit("admin:open", { durationMs: 30000 } as any, resolve);
      }),
      new Promise<any>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);

    // No ack should arrive from a player socket — null means the emit was silently ignored
    expect(openAck).toBeNull();
  });

  it("2. Player-authenticated socket attempting admin:open is rejected (no handler registered)", async () => {
    // Open a game first to have a valid player registration
    await socketServer.orchestrator.openGame({ durationMs: 30000 });
    const reg = await identityService.registerOrResume({});
    expect(reg.ok).toBe(true);
    const playerToken = (reg as any).data.token;

    const playerClient = createClient({ role: "player", token: playerToken });
    await waitForConnect(playerClient);

    // Player sockets have NO admin event handlers — emit is silently ignored (no ack)
    const openAck = await Promise.race([
      new Promise<any>((resolve) => {
        playerClient.emit("admin:open", { durationMs: 30000 } as any, resolve);
      }),
      new Promise<any>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);

    // No ack from a player socket
    expect(openAck).toBeNull();
  });

  it("3. Admin socket with wrong secret is rejected at handshake", async () => {
    const badAdmin = createClient({ role: "admin", adminToken: "completely-wrong-secret" });
    const connectPromise = waitForConnect(badAdmin);

    await expect(connectPromise).rejects.toThrow(/UNAUTHORIZED: Invalid admin credentials/);
  });

  it("4 & 5. Admin socket with correct secret connects with role=admin and executes admin:open successfully", async () => {
    const admin = createClient({ role: "admin", adminToken: adminSecret });
    await waitForConnect(admin);

    // Notice no adminToken needed in the payload because socket.data.role === "admin"
    const openAck = await new Promise<any>((resolve) => {
      admin.emit("admin:open", { durationMs: 35000 } as any, resolve);
    });

    expect(openAck.ok).toBe(true);
    expect(openAck.data.gameId).toBeDefined();
    // Sync key is now `public` (fixed from legacy `publicState`)
    expect(openAck.data.publicState.phase).toBe("OPEN");
  });

  it("6, 7 & 8. Player, Display, and Admin sockets retain strict role isolation", async () => {
    // Ensure game is opened in OPEN phase
    await socketServer.orchestrator.openGame({ durationMs: 30000 });

    // Player socket
    const pReg = await identityService.registerOrResume({});
    const player = createClient({ role: "player", token: (pReg as any).data.token });
    await waitForConnect(player);
    await new Promise((r) => player.emit("player:choose_team", { team: "left" }, r));

    // Display socket
    const display = createClient({ role: "display", displayToken: displaySecret });
    await waitForConnect(display);

    // Admin socket
    const admin = createClient({ role: "admin", adminToken: adminSecret });
    await waitForConnect(admin);

    // Verify player CANNOT execute admin commands:
    // Player sockets have no admin handlers — emit is silently ignored (no ack, null after timeout)
    const pTryAdmin = await Promise.race([
      new Promise<any>((resolve) => {
        player.emit("admin:lock", {} as any, resolve);
      }),
      new Promise<any>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    // No ack from a player socket — proves admin handlers are NOT registered on player sockets
    expect(pTryAdmin).toBeNull();

    // Verify admin CAN execute admin commands
    const adminLock = await new Promise<any>((resolve) => {
      admin.emit("admin:lock", {} as any, resolve);
    });
    expect(adminLock.ok).toBe(true);
  });

  it("9. Admin reconnect restores admin authorization seamlessly", async () => {
    const admin = createClient({ role: "admin", adminToken: adminSecret });
    await waitForConnect(admin);

    const open1 = await new Promise<any>((resolve) => {
      admin.emit("admin:open", { durationMs: 30000 } as any, resolve);
    });
    expect(open1.ok).toBe(true);

    admin.disconnect();

    // Reconnect as admin with secret
    const admin2 = createClient({ role: "admin", adminToken: adminSecret });
    await waitForConnect(admin2);

    const open2 = await new Promise<any>((resolve) => {
      admin2.emit("admin:open", { durationMs: 30000 } as any, resolve);
    });
    expect(open2.ok).toBe(true);
  });

  it("10. Full lifecycle orchestration: open -> join -> lock -> volunteer balance -> countdown -> running", async () => {
    const admin = createClient({ role: "admin", adminToken: adminSecret });
    await waitForConnect(admin);

    // 1. Admin opens game
    const openAck = await new Promise<any>((resolve) => {
      admin.emit("admin:open", { durationMs: 30000 } as any, resolve);
    });
    expect(openAck.ok).toBe(true);

    // Connect display to active game
    const display = createClient({ role: "display", displayToken: displaySecret });
    await waitForConnect(display);

    // 2. Register 4 players (3 Left, 1 Right)
    const p1Reg = await identityService.registerOrResume({});
    const p2Reg = await identityService.registerOrResume({});
    const p3Reg = await identityService.registerOrResume({});
    const p4Reg = await identityService.registerOrResume({});

    const p1 = createClient({ role: "player", token: p1Reg.ok ? p1Reg.data.token : "" });
    const p2 = createClient({ role: "player", token: p2Reg.ok ? p2Reg.data.token : "" });
    const p3 = createClient({ role: "player", token: p3Reg.ok ? p3Reg.data.token : "" });
    const p4 = createClient({ role: "player", token: p4Reg.ok ? p4Reg.data.token : "" });

    await Promise.all([waitForConnect(p1), waitForConnect(p2), waitForConnect(p3), waitForConnect(p4)]);

    // Choose teams: p1, p2, p3 choose Left; p4 chooses Right
    await new Promise<any>((r) => p1.emit("player:choose_team", { team: "left" }, (ack: any) => r(ack)));
    await new Promise<any>((r) => p2.emit("player:choose_team", { team: "left" }, (ack: any) => r(ack)));
    await new Promise<any>((r) => p3.emit("player:choose_team", { team: "left" }, (ack: any) => r(ack)));
    await new Promise<any>((r) => p4.emit("player:choose_team", { team: "right" }, (ack: any) => r(ack)));

    // Listen for display events
    const displayPlanPromise = waitForEvent<BalancePlanView>(display, "game:balance_plan");
    const displayPhasePromise = waitForEvent<any>(display, "game:phase");

    // 3. Admin locks game
    const lockAck = await new Promise<any>((resolve) => {
      admin.emit("admin:lock", {} as any, resolve);
    });

    expect(lockAck.ok).toBe(true);
    expect(lockAck.data.phase).toBe("BALANCING");

    const [planEvent, phaseEvent] = await Promise.all([displayPlanPromise, displayPhasePromise]);
    expect(planEvent.targetLeft).toBe(2);
    expect(planEvent.targetRight).toBe(2);
    expect(planEvent.needLeftToRight).toBe(1);
    expect(phaseEvent.phase).toBe("BALANCING");

    // 4. Player 1 volunteers to switch from Left to Right
    const displayCountdownPromise = waitForEvent<any>(display, "game:countdown");

    const volAck = await new Promise<any>((resolve) => {
      p1.emit("player:choose_team", { team: "right" }, (ack: any) => resolve(ack));
    });

    expect(volAck.ok).toBe(true);
    expect(volAck.data.team).toBe("right");
    expect(volAck.data.counts.left).toBe(2);
    expect(volAck.data.counts.right).toBe(2);

    // 5. Final balance triggers COUNTDOWN
    const countdownEvent = await displayCountdownPromise;
    expect(countdownEvent.durationMs).toBe(3000);
  });

  it("11. Handles multiple admin tabs without race corruption", async () => {
    const adminA = createClient({ role: "admin", adminToken: adminSecret });
    const adminB = createClient({ role: "admin", adminToken: adminSecret });
    await Promise.all([waitForConnect(adminA), waitForConnect(adminB)]);

    // Open game
    await new Promise<any>((resolve) => {
      adminA.emit("admin:open", { durationMs: 30000 } as any, resolve);
    });

    // Add players
    const p1 = await identityService.registerOrResume({});
    const p2 = await identityService.registerOrResume({});
    const c1 = createClient({ role: "player", token: p1.ok ? p1.data.token : "" });
    const c2 = createClient({ role: "player", token: p2.ok ? p2.data.token : "" });
    await Promise.all([waitForConnect(c1), waitForConnect(c2)]);
    await new Promise((r) => c1.emit("player:choose_team", { team: "left" }, r));
    await new Promise((r) => c2.emit("player:choose_team", { team: "right" }, r));

    // Admin A and Admin B both press lock simultaneously
    const [lockA, lockB] = await Promise.all([
      new Promise<any>((resolve) => adminA.emit("admin:lock", {} as any, resolve)),
      new Promise<any>((resolve) => adminB.emit("admin:lock", {} as any, resolve)),
    ]);

    // Exactly one must succeed and the other must receive INVALID_TRANSITION
    const successes = [lockA, lockB].filter((l) => l.ok);
    const failures = [lockA, lockB].filter((l) => !l.ok);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].code).toBe("INVALID_TRANSITION");
  });
});

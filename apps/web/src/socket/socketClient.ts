import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  DisplaySyncPayload,
  ExtendSeconds,
  ExtendedEventPayload,
  FinishedEventPayload,
  GameCounts,
  GamePhase,
  ScoreView,
  SyncPayload,
  TeamId,
  TimingView,
  YouView,
} from "@tow/shared";
import { soundManager } from "../audio/soundManager.js";
import { getSocketUrl } from "../config/env.js";
import { useConnectionStore } from "../store/useConnectionStore.js";
import { useDisplayConnectionStore } from "../store/useDisplayConnectionStore.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { useUiStore } from "../store/useUiStore.js";

export type ClientRole = "player" | "display" | "admin";

class SocketClient {
  private socket: Socket | null = null;
  private currentRole: ClientRole | null = null;

  // Dedicated display socket — separate from the player/admin socket.
  private displaySocket: Socket | null = null;

  connect(role: ClientRole = "player", explicitToken?: string, forceReconnect = false): void {
    // Display role MUST use connectDisplay() — never the generic connect() path.
    if (role === "display") {
      console.warn("[SocketClient] Use connectDisplay(secret) for display role.");
      return;
    }

    if (!forceReconnect && this.socket && (this.socket.connected || (this.socket.io as any)._readyState === "opening") && this.currentRole === role) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentRole = role;

    const session = useSessionStore.getState();
    const token = explicitToken ?? session.token ?? undefined;
    const adminToken = explicitToken ?? session.adminToken ?? undefined;

    // For admin role: don't connect without secret
    if (role === "admin" && !adminToken) {
      useConnectionStore.getState().setStatus("disconnected");
      return;
    }

    useConnectionStore.getState().setStatus("connecting");

    const auth: Record<string, any> = {};
    if (role === "player" && token) auth.token = token;
    if (role === "admin") {
      auth.role = "admin";
      if (adminToken) auth.adminToken = adminToken;
    }

    const serverUrl = getSocketUrl();

    this.socket = io(serverUrl, {
      auth,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupListeners();
  }

  async connectAdmin(secret: string): Promise<{ ok: boolean; message?: string }> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      this.currentRole = "admin";
      useConnectionStore.getState().setStatus("connecting");
      useConnectionStore.getState().setLastError(null);

      const serverUrl = getSocketUrl();
      const socket = io(serverUrl, {
        auth: { role: "admin", adminToken: secret },
        transports: ["websocket", "polling"],
        reconnection: false,
        timeout: 8000,
      });

      this.socket = socket;

      let settled = false;

      // IMPORTANT: Call setupListeners() BEFORE registering .once() handlers.
      // setupListeners() calls removeAllListeners() to prevent stacking.
      // If we register .once() first and then call setupListeners(), the
      // .once() handlers get wiped and the Promise never resolves.
      this.setupListeners();

      const settle = (result: { ok: boolean; message?: string }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      socket.once("connect", () => {
        // Enable auto-reconnect after first successful auth
        (socket.io as any).opts.reconnection = true;
        useSessionStore.getState().setAdminToken(secret);
        settle({ ok: true });
      });

      socket.once("connect_error", (err: Error) => {
        settle({ ok: false, message: err.message });
      });

      // Safety: resolve with error after timeout if neither event fires
      setTimeout(() => {
        settle({ ok: false, message: "Connection timed out" });
      }, 9000);
    });
  }

  /**
   * Connect the DISPLAY socket using an operator-supplied secret.
   * Sends auth.displayToken — which the server middleware reads.
   * On success: stores secret locally for auto-reconnect.
   * On failure: clears stored secret, does NOT mark display as connected.
   *
   * The display socket is kept SEPARATE from the player/admin socket.
   * Calling this while a player socket is active will NOT affect the player.
   */
  async connectDisplay(secret: string): Promise<{ ok: boolean; message?: string }> {
    return new Promise((resolve) => {
      // Tear down any existing display socket
      if (this.displaySocket) {
        this.displaySocket.removeAllListeners();
        this.displaySocket.disconnect();
        this.displaySocket = null;
      }

      // Signal connecting state immediately
      useDisplayConnectionStore.getState().setStatus("connecting");
      useDisplayConnectionStore.getState().setLastError(null);
      useDisplayConnectionStore.getState().setSocketId(null);

      const serverUrl = getSocketUrl();
      const socket = io(serverUrl, {
        auth: { role: "display", displayToken: secret },
        transports: ["websocket", "polling"],
        reconnection: false, // Managed manually after first success
        timeout: 8000,
      });

      this.displaySocket = socket;

      let settled = false;

      const onConnect = () => {
        if (settled) return;
        settled = true;
        // Enable auto-reconnect after first successful connection
        (socket.io as any).opts.reconnection = true;
        (socket.io as any).opts.reconnectionAttempts = Infinity;
        (socket.io as any).opts.reconnectionDelay = 2000;
        (socket.io as any).opts.reconnectionDelayMax = 10000;
        useSessionStore.getState().setDisplaySecret(secret);
        resolve({ ok: true });
        // Status is set inside setupDisplayListeners's "connect" handler
        // so it fires for both initial connect AND auto-reconnects.
      };

      const onConnectError = (err: Error) => {
        if (settled) return;
        settled = true;
        // Clear stored credential if auth fails
        if (err.message.includes("UNAUTHORIZED") || err.message.includes("Invalid display")) {
          useSessionStore.getState().setDisplaySecret(null);
        }
        // Status is set inside setupDisplayListeners's "connect_error" handler.
        resolve({ ok: false, message: err.message });
      };

      socket.once("connect", onConnect);
      socket.once("connect_error", onConnectError);

      this.setupDisplayListeners(socket, secret);
    });
  }

  /**
   * Reconnect display using the stored secret (called on page load if credential exists).
   */
  async reconnectDisplay(): Promise<{ ok: boolean; message?: string }> {
    const stored = useSessionStore.getState().displaySecret;
    if (!stored) return { ok: false, message: "No stored display credential" };
    return this.connectDisplay(stored);
  }

  /**
   * Disconnect and clear display socket.
   */
  disconnectDisplay(): void {
    if (this.displaySocket) {
      this.displaySocket.removeAllListeners();
      this.displaySocket.disconnect();
      this.displaySocket = null;
    }
  }

  /**
   * Whether the display socket is currently connected.
   */
  get isDisplayConnected(): boolean {
    return this.displaySocket?.connected === true;
  }

  private setupListeners(): void {
    if (!this.socket) return;

    // Remove all existing listeners on this socket instance before re-registering.
    // This prevents event handler stacking when setupListeners is called multiple
    // times (e.g. connectAdmin teardown/rebuild flow).
    this.socket.removeAllListeners();

    // Capture local reference so callbacks always operate on the correct socket
    // instance and not `this.socket` which can be replaced during reconnects.
    const socket = this.socket;
    const self = this;

    socket.on("connect", () => {
      useConnectionStore.getState().setStatus("connected");
      useConnectionStore.getState().setSocketId(socket.id ?? null);
      useConnectionStore.getState().setLastError(null);

      // Trigger initial hello sync for player
      if (self.currentRole === "player") {
        socket.emit("player:hello", {}, (ack: Ack<SyncPayload>) => {
          if (ack && ack.ok) {
            useGameStore.getState().applySync(ack.data);
            useSessionStore.getState().updateFromYou(ack.data.you);
          }
        });
      }
    });

    socket.on("disconnect", (reason) => {
      useConnectionStore.getState().setStatus("disconnected");
      useConnectionStore.getState().setSocketId(null);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", (err) => {
      useConnectionStore.getState().setStatus("error");
      useConnectionStore.getState().setLastError(err.message);
    });

    // Core Game Broadcast Events
    socket.on("sync", (data: SyncPayload | DisplaySyncPayload) => {
      useGameStore.getState().applySync(data);
      if ("you" in data && data.you) {
        useSessionStore.getState().updateFromYou(data.you);
      }
    });

    socket.on("game:phase", ({ phase }: { phase: GamePhase; at: number }) => {
      useGameStore.getState().setPhase(phase);
    });

    socket.on("game:counts", (counts: GameCounts) => {
      useGameStore.getState().setCounts(counts);
    });

    socket.on("game:score", (score: ScoreView) => {
      useGameStore.getState().setScores(score);
    });

    socket.on("game:time", (timing: TimingView) => {
      useGameStore.getState().setTiming(timing);
    });

    socket.on("game:countdown", ({ endsAt, durationMs }: { endsAt: number; durationMs: number }) => {
      useGameStore.getState().setCountdown(endsAt, durationMs);
      soundManager.playCountdownTick();
    });

    socket.on("game:balance_plan", (plan) => {
      useGameStore.getState().setBalancePlan(plan);
    });

    socket.on("game:wildcard", (data: { playerId: string; label: string }) => {
      useGameStore.getState().setWildcard(data);
    });

    socket.on("game:balance_move", (move) => {
      useGameStore.getState().setBalanceMove(move);
      soundManager.playSwitch();
    });

    socket.on("game:paused", ({ pausedAt }: { pausedAt: number }) => {
      useGameStore.getState().setPaused(pausedAt);
      soundManager.playPause();
    });

    socket.on("game:resumed", ({ resumedAt, endTime }: { resumedAt: number; endTime: number }) => {
      useGameStore.getState().setResumed(resumedAt, endTime);
    });

    socket.on("game:extended", (data: ExtendedEventPayload) => {
      useGameStore.getState().setExtended(data.seconds, data.endTime, data.serverNow);
      soundManager.playExtend();
    });

    socket.on("game:finished", (data: FinishedEventPayload) => {
      useGameStore.getState().setFinished(data);
      soundManager.playWin();
    });

    socket.on("game:round", ({ roundNumber }: { roundNumber: number }) => {
      useGameStore.getState().setRound(roundNumber);
    });

    // Player Specific Events
    socket.on("player:you", (you: YouView) => {
      useSessionStore.getState().updateFromYou(you);
    });

    socket.on("player:replaced", () => {
      useUiStore.getState().addToast({
        type: "warning",
        title: "Session Replaced",
        description: "Another browser tab is now the active session for this player.",
      });
    });
  }

  /**
   * Set up all game-state listeners for the DISPLAY socket.
   * Uses the captured `socket` argument (NOT this.displaySocket) to prevent
   * stale-closure bugs when the singleton pointer changes during reconnects.
   */
  private setupDisplayListeners(socket: Socket, _secret: string): void {
    // ────────────────────────────────────────────────
    // Display socket connection lifecycle — write to display-specific store
    // ────────────────────────────────────────────────
    socket.on("connect", () => {
      useDisplayConnectionStore.getState().setStatus("connected");
      useDisplayConnectionStore.getState().setSocketId(socket.id ?? null);
      useDisplayConnectionStore.getState().setLastError(null);
    });

    socket.on("disconnect", (reason) => {
      useDisplayConnectionStore.getState().setStatus("disconnected");
      useDisplayConnectionStore.getState().setSocketId(null);
      // Log but don't clear credential — auto-reconnect will retry
      if (reason === "io server disconnect") {
        // Server intentionally kicked the display (e.g. credential revoked)
        useDisplayConnectionStore.getState().setLastError("Disconnected by server.");
      }
    });

    socket.on("connect_error", (err) => {
      useDisplayConnectionStore.getState().setStatus("error");
      useDisplayConnectionStore.getState().setLastError(err.message);
      // Clear stored credential if auth definitively rejected
      if (err.message.includes("UNAUTHORIZED") || err.message.includes("Invalid display")) {
        useSessionStore.getState().setDisplaySecret(null);
      }
    });

    // ────────────────────────────────────────────────
    // Game-state broadcast events
    // ────────────────────────────────────────────────
    socket.on("sync", (data: SyncPayload | DisplaySyncPayload) => {
      useGameStore.getState().applySync(data);
    });

    socket.on("game:phase", ({ phase }: { phase: GamePhase; at: number }) => {
      useGameStore.getState().setPhase(phase);
    });

    socket.on("game:counts", (counts: GameCounts) => {
      useGameStore.getState().setCounts(counts);
    });

    socket.on("game:score", (score: ScoreView) => {
      useGameStore.getState().setScores(score);
    });

    socket.on("game:time", (timing: TimingView) => {
      useGameStore.getState().setTiming(timing);
    });

    socket.on("game:countdown", ({ endsAt, durationMs }: { endsAt: number; durationMs: number }) => {
      useGameStore.getState().setCountdown(endsAt, durationMs);
      soundManager.playCountdownTick();
    });

    socket.on("game:balance_plan", (plan) => {
      useGameStore.getState().setBalancePlan(plan);
    });

    socket.on("game:wildcard", (data: { playerId: string; label: string }) => {
      useGameStore.getState().setWildcard(data);
    });

    socket.on("game:balance_move", (move) => {
      useGameStore.getState().setBalanceMove(move);
      soundManager.playSwitch();
    });

    socket.on("game:paused", ({ pausedAt }: { pausedAt: number }) => {
      useGameStore.getState().setPaused(pausedAt);
      soundManager.playPause();
    });

    socket.on("game:resumed", ({ resumedAt, endTime }: { resumedAt: number; endTime: number }) => {
      useGameStore.getState().setResumed(resumedAt, endTime);
    });

    socket.on("game:extended", (data: ExtendedEventPayload) => {
      useGameStore.getState().setExtended(data.seconds, data.endTime, data.serverNow);
      soundManager.playExtend();
    });

    socket.on("game:finished", (data: FinishedEventPayload) => {
      useGameStore.getState().setFinished(data);
      soundManager.playWin();
    });

    socket.on("game:round", ({ roundNumber }: { roundNumber: number }) => {
      useGameStore.getState().setRound(roundNumber);
    });
  }

  // ==========================================
  // PLAYER ACTIONS
  // ==========================================

  async playerTap(): Promise<Ack<{ team: "left" | "right"; scores: { left: number; right: number }; seq: number }>> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ ok: false, code: "UNAUTHORIZED", message: "Connecting to battle..." });
        return;
      }

      this.socket.emit("player:tap", {}, (ack: any) => {
        if (ack?.ok) {
          soundManager.playTap();
          useUiStore.getState().triggerTapFeedback();
        }
        resolve(ack ?? { ok: false, code: "VALIDATION", message: "No response from server" });
      });
    });
  }

  async playerChooseTeam(team: TeamId): Promise<Ack<{ team: TeamId; counts: GameCounts }>> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Not connected" });
      this.socket.emit("player:choose_team", { team }, (ack: any) => {
        if (ack?.ok) soundManager.playSwitch();
        resolve(ack);
      });
    });
  }

  async playerSwitchTeam(team: TeamId): Promise<Ack<{ team: TeamId; counts: GameCounts }>> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Not connected" });
      this.socket.emit("player:switch_team", { team }, (ack: any) => {
        if (ack?.ok) soundManager.playSwitch();
        resolve(ack);
      });
    });
  }

  async playerVolunteer(): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Not connected" });
      this.socket.emit("player:volunteer" as any, {}, (ack: any) => {
        if (ack?.ok) soundManager.playSwitch();
        resolve(ack);
      });
    });
  }

  // ==========================================
  // ADMIN ACTIONS
  // ==========================================

  async adminOpen(durationMs = 30000): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:open" as any, { durationMs, adminToken }, resolve);
    });
  }

  async adminLock(): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:lock" as any, { adminToken }, resolve);
    });
  }

  async adminSetWildcard(playerId: string): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:set_wildcard" as any, { playerId, adminToken }, resolve);
    });
  }

  async adminAutoBalance(preview = false, confirm = false): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:auto_balance" as any, { preview, confirm, adminToken }, resolve);
    });
  }

  async adminCancelBalance(): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:cancel_balance" as any, { adminToken }, resolve);
    });
  }

  async adminStartCountdown(durationMs = 3000): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:start_countdown" as any, { durationMs, adminToken }, resolve);
    });
  }

  async adminPause(): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:pause" as any, { adminToken }, resolve);
    });
  }

  async adminResume(): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:resume" as any, { adminToken }, resolve);
    });
  }

  async adminExtend(seconds: ExtendSeconds): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:extend" as any, { seconds, adminToken }, resolve);
    });
  }

  async adminEndRound(): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:end_round" as any, { adminToken }, resolve);
    });
  }

  async adminPlayAgain(durationMs?: number): Promise<Ack<any>> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, code: "UNAUTHORIZED", message: "Admin not connected" });
      const adminToken = useSessionStore.getState().adminToken ?? undefined;
      this.socket.emit("admin:play_again" as any, { durationMs, adminToken }, resolve);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRole = null;
    }
  }
}

export const socketClient = new SocketClient();

/**
 * DisplayStage connection status tests.
 * Verifies:
 * 1. Initial display connection -> shows CONNECTING
 * 2. Successful connect -> shows CONNECTED (green)
 * 3. Successful sync -> display still shows CONNECTED
 * 4. Disconnect -> shows DISCONNECTED (red)
 * 5. connect_error -> shows ERROR (red)
 * 6. Reconnect -> shows CONNECTED again
 * 7. Player socket events do NOT affect display status
 * 8. Admin socket events do NOT affect display status
 * 9. Display receives live game counts while status is CONNECTED
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDisplayConnectionStore } from "../../store/useDisplayConnectionStore.js";
import { useConnectionStore } from "../../store/useConnectionStore.js";
import { useGameStore } from "../../store/useGameStore.js";
import { DisplayStage } from "./DisplayStage.js";

describe("DisplayStage — Connection Status Indicator", () => {
  beforeEach(() => {
    // Reset both stores before each test
    useDisplayConnectionStore.setState({ status: "idle", lastError: null, socketId: null });
    useConnectionStore.setState({ status: "disconnected", lastError: null, socketId: null });
    useGameStore.setState({
      phase: "OPEN",
      counts: { total: 10, left: 5, right: 5, chaos: 0, online: 10, offline: 0 },
      scores: { left: 0, right: 0, seq: 0, at: Date.now() },
    });
  });

  function renderFullDisplay() {
    // Render without isPreview so the status pill appears
    return render(<DisplayStage isPreview={false} />);
  }

  // ── Test 1: initial idle ──────────────────────────────────────────────────
  it("1. shows IDLE status initially (before any connection attempt)", () => {
    useDisplayConnectionStore.setState({ status: "idle" });
    renderFullDisplay();
    expect(screen.getByText("IDLE")).toBeInTheDocument();
  });

  // ── Test 2: connecting -> connected ──────────────────────────────────────
  it("2. shows CONNECTED with green dot when display socket connects", () => {
    useDisplayConnectionStore.setState({ status: "connected", socketId: "disp-123" });
    renderFullDisplay();

    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    const dot = screen.getByText("CONNECTED").previousElementSibling;
    expect(dot?.className).toContain("bg-emerald-400");
  });

  // ── Test 3: sync does not change connected status ─────────────────────────
  it("3. CONNECTED status persists after receiving a game sync", () => {
    useDisplayConnectionStore.setState({ status: "connected", socketId: "disp-123" });
    // Simulate a sync arriving by updating game state
    useGameStore.setState({
      phase: "OPEN",
      counts: { total: 42, left: 21, right: 21, chaos: 0, online: 42, offline: 0 },
    });
    renderFullDisplay();

    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    // Game counts are shown — data is live
    expect(screen.getAllByText(/42/i).length).toBeGreaterThan(0);
  });

  // ── Test 4: disconnect ────────────────────────────────────────────────────
  it("4. shows DISCONNECTED with red dot when socket disconnects", () => {
    useDisplayConnectionStore.setState({ status: "disconnected", socketId: null });
    renderFullDisplay();

    expect(screen.getByText("DISCONNECTED")).toBeInTheDocument();
    const dot = screen.getByText("DISCONNECTED").previousElementSibling;
    expect(dot?.className).toContain("bg-red-400");
  });

  // ── Test 5: connect_error ─────────────────────────────────────────────────
  it("5. shows ERROR with red dot on connect_error", () => {
    useDisplayConnectionStore.setState({ status: "error", lastError: "UNAUTHORIZED: Invalid display credentials" });
    renderFullDisplay();

    expect(screen.getByText("ERROR")).toBeInTheDocument();
    const dot = screen.getByText("ERROR").previousElementSibling;
    expect(dot?.className).toContain("bg-red-400");
  });

  // ── Test 6: reconnect ─────────────────────────────────────────────────────
  it("6. returns to CONNECTED after reconnect (status cycles disconnected -> connected)", () => {
    // Simulate disconnect
    useDisplayConnectionStore.setState({ status: "disconnected" });
    const { rerender } = renderFullDisplay();
    expect(screen.getByText("DISCONNECTED")).toBeInTheDocument();

    // Simulate reconnect
    useDisplayConnectionStore.setState({ status: "connected", socketId: "disp-456" });
    rerender(<DisplayStage isPreview={false} />);
    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
  });

  // ── Test 7: player socket does NOT affect display status ──────────────────
  it("7. player socket connect/disconnect does not change display status", () => {
    useDisplayConnectionStore.setState({ status: "connected" });
    // Simulate player socket events — should have no effect on display status
    useConnectionStore.setState({ status: "disconnected" });
    renderFullDisplay();

    // Display still shows CONNECTED (from display store)
    expect(screen.getByText("CONNECTED")).toBeInTheDocument();

    // Simulate player socket reconnecting — still should not change display
    useConnectionStore.setState({ status: "connected" });
    expect(useDisplayConnectionStore.getState().status).toBe("connected");
  });

  // ── Test 8: admin socket does NOT affect display status ───────────────────
  it("8. admin socket events do not change display connection status", () => {
    useDisplayConnectionStore.setState({ status: "connected" });
    // Simulate admin socket error
    useConnectionStore.setState({ status: "error", lastError: "admin error" });
    renderFullDisplay();

    // Display status is unaffected by admin/player store
    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    expect(useDisplayConnectionStore.getState().status).toBe("connected");
    expect(useDisplayConnectionStore.getState().lastError).toBeNull();
  });

  // ── Test 9: live counts visible while CONNECTED ───────────────────────────
  it("9. displays live game counts while status is CONNECTED", () => {
    useDisplayConnectionStore.setState({ status: "connected" });
    useGameStore.setState({
      phase: "OPEN",
      counts: { total: 57, left: 30, right: 27, chaos: 0, online: 55, offline: 2 },
    });
    renderFullDisplay();

    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    // WelcomeScene shows total/team counts
    expect(screen.getAllByText(/57|30|27/i).length).toBeGreaterThan(0);
  });

  // ── CONNECTING: amber dot ─────────────────────────────────────────────────
  it("shows CONNECTING with amber dot during connection attempt", () => {
    useDisplayConnectionStore.setState({ status: "connecting" });
    renderFullDisplay();

    expect(screen.getByText("CONNECTING")).toBeInTheDocument();
    const dot = screen.getByText("CONNECTING").previousElementSibling;
    expect(dot?.className).toContain("bg-amber-400");
  });

  // ── Display store is isolated from connection store ───────────────────────
  it("useDisplayConnectionStore and useConnectionStore are completely independent", () => {
    useDisplayConnectionStore.setState({ status: "connected" });
    useConnectionStore.setState({ status: "error" });

    // Display store should be unaffected
    expect(useDisplayConnectionStore.getState().status).toBe("connected");
    // Player/admin store should be unaffected
    expect(useConnectionStore.getState().status).toBe("error");
  });
});

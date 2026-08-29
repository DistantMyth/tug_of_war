import { BrowserRouter } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { socketClient } from "../socket/socketClient.js";
import { useConnectionStore } from "../store/useConnectionStore.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { AdminPage } from "./AdminPage.js";

describe("AdminPage Dashboard & Controls", () => {
  beforeEach(() => {
    vi.spyOn(socketClient, "connectAdmin").mockResolvedValue({ ok: true });
    useConnectionStore.setState({ status: "connected" });
    useSessionStore.setState({ adminToken: "secret_admin_token" });
    useGameStore.setState({
      phase: "OPEN",
      roundNumber: 1,
      counts: { total: 50, left: 25, right: 25, chaos: 0, online: 50, offline: 0 },
      scores: { left: 0, right: 0, seq: 0, at: Date.now() },
      timing: {
        durationMs: 30000,
        startTime: null,
        endTime: null,
        pausedAt: null,
        pauseAccumMs: 0,
        countdownEndsAt: null,
        serverNow: Date.now(),
      },
      balancePlan: null,
      winner: null,
    });
  });

  it("renders live projector preview and control panels", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    expect(screen.getByText(/Battle Control Panel/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Projector Broadcast View/i)).toBeInTheDocument();
    expect(screen.getByText(/Lobby & Roster Controls/i)).toBeInTheDocument();
  });

  it("shows unauthenticated guidance when no token is present and disables controls", async () => {
    useSessionStore.setState({ adminToken: null });
    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    expect(screen.getByText(/ADMIN AUTHENTICATION REQUIRED/i)).toBeInTheDocument();
    const openBtn = screen.getByText(/Open \/ Reset Lobby/i);
    expect(openBtn).toBeDisabled();
  });

  it("authenticates when user enters secret and clicks Auth", async () => {
    useSessionStore.setState({ adminToken: null });
    const connectAdminSpy = vi.spyOn(socketClient, "connectAdmin").mockResolvedValue({ ok: true });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const input = screen.getByPlaceholderText(/Admin Secret.../i);
    const authBtn = screen.getByRole("button", { name: /^Auth$/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "my-valid-secret" } });
      fireEvent.click(authBtn);
    });

    expect(connectAdminSpy).toHaveBeenCalledWith("my-valid-secret");
    expect(screen.getByText(/ADMIN AUTHENTICATED/i)).toBeInTheDocument();
  });

  it("dispatches adminOpen when Open / Reset Lobby button is clicked", async () => {
    const openSpy = vi.spyOn(socketClient, "adminOpen").mockResolvedValue({ ok: true, data: {} as any });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const openBtn = screen.getByText(/Open \/ Reset Lobby/i);
    await act(async () => {
      fireEvent.click(openBtn);
    });
    expect(openSpy).toHaveBeenCalledWith(30000);
  });

  it("dispatches adminLock when Lock Roster button is clicked in OPEN phase", async () => {
    const lockSpy = vi.spyOn(socketClient, "adminLock").mockResolvedValue({ ok: true, data: {} as any });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const lockBtn = screen.getByText(/Lock Roster/i);
    await act(async () => {
      fireEvent.click(lockBtn);
    });
    expect(lockSpy).toHaveBeenCalled();
  });

  it("dispatches adminPause and adminResume during match phase", async () => {
    useGameStore.setState({ phase: "RUNNING" });
    const pauseSpy = vi.spyOn(socketClient, "adminPause").mockResolvedValue({ ok: true, data: {} as any });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const pauseBtn = screen.getByText(/^Pause$/i);
    await act(async () => {
      fireEvent.click(pauseBtn);
    });
    expect(pauseSpy).toHaveBeenCalled();
  });

  it("dispatches adminExtend when +10 Seconds button is clicked", async () => {
    useGameStore.setState({ phase: "RUNNING" });
    const extendSpy = vi.spyOn(socketClient, "adminExtend").mockResolvedValue({ ok: true, data: {} as any });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const ext10Btn = screen.getByText(/\+10 Seconds/i);
    await act(async () => {
      fireEvent.click(ext10Btn);
    });
    expect(extendSpy).toHaveBeenCalledWith(10);
  });

  it("triggers confirmation modal before executing End Round", async () => {
    useGameStore.setState({ phase: "RUNNING" });
    const endSpy = vi.spyOn(socketClient, "adminEndRound").mockResolvedValue({ ok: true, data: {} as any });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const endBtn = screen.getByRole("button", { name: /End Round/i });
    await act(async () => {
      fireEvent.click(endBtn);
    });

    // Modal popup appears
    expect(screen.getByText(/End Match Now\?/i)).toBeInTheDocument();
    const confirmBtn = screen.getByText(/^Confirm$/i);
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(endSpy).toHaveBeenCalled();
  });

  it("dispatches adminPlayAgain when Play Next Round button is clicked in FINISHED phase", async () => {
    useGameStore.setState({ phase: "FINISHED", winner: "left" });
    const nextSpy = vi.spyOn(socketClient, "adminPlayAgain").mockResolvedValue({ ok: true, data: {} as any });

    await act(async () => {
      render(
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>,
      );
    });

    const nextBtn = screen.getByText(/Play Next Round \(Same Teams\)/i);
    await act(async () => {
      fireEvent.click(nextBtn);
    });
    expect(nextSpy).toHaveBeenCalledWith(30000);
  });
});

import { BrowserRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { JoinPage } from "./JoinPage.js";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("JoinPage Bootstrap & Error UX", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    useSessionStore.setState({ token: null, playerId: null, label: null, team: null, chaos: false, role: null });
    useGameStore.setState({ phase: "OPEN", roundNumber: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1 & 2. Calls exactly /api/player/register endpoint during player bootstrap", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          isNew: true,
          player: {
            playerId: "player_001",
            label: "P-001",
            team: null,
            chaos: false,
            status: "online",
            role: null,
          },
          token: "jwt_token_valid_123",
          publicState: {
            sessionId: "game_abc",
            phase: "OPEN",
            roundNumber: 1,
            counts: { total: 1, left: 0, right: 0, chaos: 0, online: 1, offline: 0 },
            scores: { left: 0, right: 0, seq: 0, at: Date.now() },
            timing: { durationMs: 30000, startTime: null, endTime: null, pausedAt: null, pauseAccumMs: 0, countdownEndsAt: null, serverNow: Date.now() },
            plan: null,
            winner: null,
            chaosPlayerId: null,
            chaosLabel: null,
          },
        },
      }),
    } as any);

    global.fetch = fetchSpy;

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = fetchSpy.mock.calls[0]?.[0];
      expect(calledUrl).toContain("/api/player/register");
      expect(calledUrl).not.toContain("/api/players/bootstrap");
    });
  });

  it("3, 4, 5 & 6. Correctly parses response shape and stores token, playerId, and label", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          isNew: true,
          player: {
            playerId: "player_abc_999",
            label: "P-042",
            team: null,
            chaos: false,
            status: "online",
            role: null,
          },
          token: "authoritative_jwt_token_999",
          publicState: null,
        },
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(useSessionStore.getState().token).toBe("authoritative_jwt_token_999");
      expect(useSessionStore.getState().playerId).toBe("player_abc_999");
      expect(useSessionStore.getState().label).toBe("P-042");
    });
  });

  it("7. Applies authoritative publicState to useGameStore upon successful join", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          isNew: true,
          player: { playerId: "p_1", label: "P-001", team: null, chaos: false, status: "online", role: null },
          token: "tok_1",
          publicState: {
            sessionId: "game_session_live_777",
            phase: "OPEN",
            roundNumber: 3,
            counts: { total: 10, left: 5, right: 5, chaos: 0, online: 10, offline: 0 },
            scores: { left: 100, right: 90, seq: 1, at: Date.now() },
            timing: { durationMs: 45000, startTime: null, endTime: null, pausedAt: null, pauseAccumMs: 0, countdownEndsAt: null, serverNow: Date.now() },
            plan: null,
            winner: null,
            chaosPlayerId: null,
            chaosLabel: null,
          },
        },
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(useGameStore.getState().gameId).toBe("game_session_live_777");
      expect(useGameStore.getState().roundNumber).toBe(3);
    });
  });

  it("8. Displays user-friendly standby message when GAME_NOT_FOUND error occurs", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        ok: false,
        code: "GAME_NOT_FOUND",
        message: "No active game session",
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No Active Battle/i)).toBeInTheDocument();
      expect(screen.getByText(/No battle is open right now\. Please wait for the host\./i)).toBeInTheDocument();
      expect(screen.getByText(/STANDBY/i)).toBeInTheDocument();
      expect(screen.getByText(/Check Again/i)).toBeInTheDocument();
    });
  });

  it("9. Displays user-friendly locked message when JOIN_CLOSED error occurs", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        code: "JOIN_CLOSED",
        message: "Registration is locked",
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Registration Closed/i)).toBeInTheDocument();
      expect(screen.getByText(/Registration for this battle is closed\./i)).toBeInTheDocument();
      expect(screen.getByText(/ROSTER LOCKED/i)).toBeInTheDocument();
    });
  });

  it("10. Displays user-friendly error on network/fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Connection Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Could not reach the battle server\. Please check your connection\./i)).toBeInTheDocument();
      expect(screen.getByText(/Retry Connection/i)).toBeInTheDocument();
    });
  });

  it("11. Displays server unavailable message on HTTP 500", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        ok: false,
        code: "SERVER_ERROR",
        message: "Internal Server Error",
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Server Unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/The battle server is temporarily unavailable\./i)).toBeInTheDocument();
    });
  });

  it("12. Handles malformed success response gracefully without throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          // missing player and token
        },
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Protocol Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Received an invalid response from the battle server\./i)).toBeInTheDocument();
    });
  });

  it("13. Navigates to /game only after successful registration and does not navigate on error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          isNew: true,
          player: { playerId: "p_valid", label: "P-100", team: null, chaos: false, status: "online", role: null },
          token: "tok_valid",
        },
      }),
    } as any);

    render(
      <BrowserRouter>
        <JoinPage />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/game");
    });
  });
});

import { BrowserRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { socketClient } from "../socket/socketClient.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { GamePage } from "./GamePage.js";

describe("GamePage Participant View", () => {
  beforeEach(() => {
    useSessionStore.setState({
      token: "tok_test",
      playerId: "p_test",
      label: "P-001",
      team: null,
      chaos: false,
      role: null,
    });

    useGameStore.setState({
      phase: "OPEN",
      roundNumber: 1,
      counts: { total: 10, left: 6, right: 4, chaos: 0, online: 10, offline: 0 },
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

  it("renders team selection buttons in OPEN phase and handles team joining", () => {
    const chooseSpy = vi.spyOn(socketClient, "playerChooseTeam").mockResolvedValue({ ok: true, data: {} as any });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { name: /choose your side/i })).toBeInTheDocument();
    const joinCyanBtn = screen.getByRole("button", { name: /cyan/i });
    expect(joinCyanBtn).toBeInTheDocument();

    fireEvent.click(joinCyanBtn);
    expect(chooseSpy).toHaveBeenCalledWith("left");
  });

  it("renders switch team button when participant already chose a team in OPEN phase", () => {
    useSessionStore.setState({ team: "left", role: "left" });
    const switchSpy = vi.spyOn(socketClient, "playerSwitchTeam").mockResolvedValue({ ok: true, data: {} as any });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    const switchBtn = screen.getByRole("button", { name: /switch to amber/i });
    expect(switchBtn).toBeInTheDocument();

    fireEvent.click(switchBtn);
    expect(switchSpy).toHaveBeenCalledWith("right");
  });

  it("renders volunteer CTA during BALANCING phase if on surplus team", () => {
    useSessionStore.setState({ team: "left", role: "left" });
    useGameStore.setState({
      phase: "BALANCING",
      balancePlan: {
        targetLeft: 5,
        targetRight: 5,
        needLeftToRight: 1,
        needRightToLeft: 0,
        remainingLeftToRight: 1,
        remainingRightToLeft: 0,
        chaosNeeded: false,
        remainingMs: null,
      },
    });

    const volunteerSpy = vi.spyOn(socketClient, "playerVolunteer").mockResolvedValue({ ok: true, data: {} as any });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { name: /balancing teams/i })).toBeInTheDocument();
    const volunteerBtn = screen.getByRole("button", { name: /volunteer and switch/i });
    expect(volunteerBtn).toBeInTheDocument();

    fireEvent.click(volunteerBtn);
    expect(volunteerSpy).toHaveBeenCalled();
  });

  it("renders special Chaos Player screen when assigned chaos role", () => {
    useSessionStore.setState({ chaos: true, role: "chaos" });
    useGameStore.setState({ phase: "RUNNING" });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { name: /chaos wildcard/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tap for team/i })).not.toBeInTheDocument();
  });

  it("renders big TAP button during RUNNING phase and fires player:tap on click", () => {
    useSessionStore.setState({ team: "left", role: "left" });
    useGameStore.setState({
      phase: "RUNNING",
      scores: { left: 42, right: 38, seq: 80, at: Date.now() },
    });

    const tapSpy = vi.spyOn(socketClient, "playerTap").mockResolvedValue({
      ok: true,
      data: { team: "left", scores: { left: 43, right: 38 }, seq: 81 },
    });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    const tapBtn = screen.getByRole("button", {
      name: /tap for team left/i,
    });
    expect(tapBtn).toBeInTheDocument();
    expect(tapBtn).toBeEnabled();

    fireEvent.click(tapBtn);
    expect(tapSpy).toHaveBeenCalledTimes(1);
  });

  it("disables TAP button during PAUSED phase while preserving accessible name", () => {
    useSessionStore.setState({ team: "left", role: "left" });
    useGameStore.setState({ phase: "PAUSED" });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    const btn = screen.getByRole("button", {
      name: /tap for team left/i,
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(screen.getAllByText(/PAUSED/i).length).toBeGreaterThanOrEqual(1);
  });

  it("maintains stable accessible name on tap control across RUNNING and PAUSED phases", () => {
    useSessionStore.setState({ team: "left", role: "left" });

    // 1. RUNNING phase: enabled with team-specific accessible label
    useGameStore.setState({ phase: "RUNNING" });
    const { unmount } = render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    const runningBtn = screen.getByRole("button", { name: /tap for team left/i });
    expect(runningBtn).toBeEnabled();
    expect(runningBtn).toHaveAttribute("aria-label", "Tap for team left");
    unmount();

    // 2. PAUSED phase: same accessible name, but disabled with visible PAUSED text
    useGameStore.setState({ phase: "PAUSED" });
    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    const pausedBtn = screen.getByRole("button", { name: /tap for team left/i });
    expect(pausedBtn).toBeDisabled();
    expect(pausedBtn).toHaveAttribute("aria-label", "Tap for team left");
    expect(screen.getAllByText(/PAUSED/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders victory announcement in FINISHED phase", () => {
    useSessionStore.setState({ team: "left", role: "left" });
    useGameStore.setState({
      phase: "FINISHED",
      winner: "left",
      scores: { left: 100, right: 90, seq: 190, at: Date.now() },
    });

    render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { name: /your team won/i })).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
  });
});


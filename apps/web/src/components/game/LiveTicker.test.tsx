import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../../store/useGameStore.js";
import { LiveTicker } from "./LiveTicker.js";

describe("LiveTicker Esports Broadcast Marquee", () => {
  beforeEach(() => {
    useGameStore.setState({
      phase: "RUNNING",
      scores: { left: 1000, right: 900, seq: 1900, at: Date.now() },
      counts: { total: 40, left: 20, right: 20, chaos: 0, online: 40, offline: 0 },
      timing: {
        durationMs: 30000,
        startTime: Date.now(),
        endTime: Date.now() + 25000,
        pausedAt: null,
        pauseAccumMs: 0,
        countdownEndsAt: null,
        serverNow: Date.now(),
      },
      winner: null,
      wildcard: null,
      extensionBanner: null,
    });
  });

  it("renders live ticker feed badge and active commentary items", () => {
    render(<LiveTicker />);
    expect(screen.getByTestId("live-ticker")).toBeInTheDocument();
    expect(screen.getByText(/LIVE FEED/i)).toBeInTheDocument();
    expect(screen.getAllByText(/TEAM CYAN LAUNCHES A MAJOR SURGE!/i).length).toBeGreaterThan(0);
  });

  it("renders countdown commentary during COUNTDOWN phase", () => {
    useGameStore.setState({ phase: "COUNTDOWN" });
    render(<LiveTicker />);
    expect(screen.getAllByText(/COUNTDOWN IN PROGRESS/i).length).toBeGreaterThan(0);
  });

  it("renders balancing commentary during BALANCING phase", () => {
    useGameStore.setState({
      phase: "BALANCING",
      wildcard: { playerId: "p1", label: "Chaos Master" },
    });
    render(<LiveTicker />);
    expect(screen.getAllByText(/MATCH ROSTER BALANCING/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CHAOS MASTER/i).length).toBeGreaterThan(0);
  });

  it("renders victory commentary during FINISHED phase", () => {
    useGameStore.setState({
      phase: "FINISHED",
      winner: "left",
      scores: { left: 1500, right: 1200, seq: 2700, at: Date.now() },
    });
    render(<LiveTicker />);
    expect(screen.getAllByText(/CYBER TITANS CLAIM SUPREME DOMINANCE!/i).length).toBeGreaterThan(0);
  });

  it("renders custom messages when passed", () => {
    render(<LiveTicker customMessages={["CUSTOM ESPORTS TOURNAMENT HEADLINE"]} />);
    expect(screen.getAllByText(/CUSTOM ESPORTS TOURNAMENT HEADLINE/i).length).toBeGreaterThan(0);
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../../store/useGameStore.js";
import { DisplayStage } from "./DisplayStage.js";

describe("DisplayStage Component & Scene Router", () => {
  beforeEach(() => {
    useGameStore.setState({
      phase: "OPEN",
      counts: { total: 200, left: 100, right: 100, chaos: 0, online: 195, offline: 5 },
      scores: { left: 500, right: 450, seq: 950, at: Date.now() },
      timing: {
        durationMs: 30000,
        startTime: Date.now(),
        endTime: Date.now() + 30000,
        pausedAt: null,
        pauseAccumMs: 0,
        countdownEndsAt: null,
        serverNow: Date.now(),
      },
      balancePlan: null,
      winner: null,
      roundNumber: 1,
    });
  });

  it("renders WelcomeScene during OPEN phase", () => {
    useGameStore.setState({ phase: "OPEN" });
    render(<DisplayStage isPreview={true} />);

    expect(screen.getByText(/Tug of War/i)).toBeInTheDocument();
    expect(screen.getByText(/SCAN TO ENTER ARENA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/CYAN/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AMBER/i).length).toBeGreaterThan(0);
  });

  it("renders TeamBalanceScene during BALANCING phase", () => {
    useGameStore.setState({
      phase: "BALANCING",
      balancePlan: {
        targetLeft: 100,
        targetRight: 100,
        needLeftToRight: 15,
        needRightToLeft: 0,
        remainingLeftToRight: 15,
        remainingRightToLeft: 0,
        chaosNeeded: false,
        remainingMs: null,
      },
    });

    render(<DisplayStage isPreview={true} />);
    expect(screen.getByText(/Balancing The Battle/i)).toBeInTheDocument();
    expect(screen.getAllByText(/15/i).length).toBeGreaterThan(0);
  });

  it("renders CountdownScene during COUNTDOWN phase", () => {
    useGameStore.setState({
      phase: "COUNTDOWN",
      timing: {
        durationMs: 3000,
        startTime: null,
        endTime: null,
        pausedAt: null,
        pauseAccumMs: 0,
        countdownEndsAt: Date.now() + 3000,
        serverNow: Date.now(),
      },
    });

    render(<DisplayStage isPreview={true} />);
    expect(screen.getByText(/Get Ready To Tap!/i)).toBeInTheDocument();
  });

  it("renders BattleScene during RUNNING phase with scores and tug meter", () => {
    useGameStore.setState({
      phase: "RUNNING",
      scores: { left: 10842, right: 9931, seq: 20773, at: Date.now() },
    });

    render(<DisplayStage isPreview={true} />);
    expect(screen.getAllByText(/CYAN CREW/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AMBER CREW/i).length).toBeGreaterThan(0);
    expect(screen.getByText("10,842")).toBeInTheDocument();
    expect(screen.getByText("9,931")).toBeInTheDocument();
  });

  it("renders ResultsScene during FINISHED phase with winner announcement", () => {
    useGameStore.setState({
      phase: "FINISHED",
      winner: "left",
      scores: { left: 10842, right: 9931, seq: 20773, at: Date.now() },
    });

    render(<DisplayStage isPreview={true} />);
    expect(screen.getByText(/VICTORY ACHIEVED!/i)).toBeInTheDocument();
    expect(screen.getByText(/TEAM CYAN WINS!/i)).toBeInTheDocument();
  });
});

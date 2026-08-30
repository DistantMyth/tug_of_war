import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RopeArena } from "./RopeArena.js";

describe("RopeArena Dynamic SVG & Physics Component", () => {
  it("renders with neutral state when scores are 0", () => {
    render(
      <RopeArena
        leftScore={0}
        rightScore={0}
        phase="RUNNING"
      />
    );

    const arena = screen.getByTestId("rope-arena");
    expect(arena).toBeInTheDocument();
    expect(arena).toHaveAttribute("aria-label");
    expect(arena.getAttribute("aria-label")).toContain("Teams are dead even");
    expect(arena.getAttribute("aria-label")).toContain("0% displacement");
  });

  it("calculates correct displacement and lead when Left leads", () => {
    render(
      <RopeArena
        leftScore={75}
        rightScore={25}
        phase="RUNNING"
      />
    );

    const arena = screen.getByTestId("rope-arena");
    expect(arena.getAttribute("aria-label")).toContain("Team Cyan is leading");
    expect(arena.getAttribute("aria-label")).toContain("-35% displacement");
  });

  it("calculates correct displacement and lead when Right leads", () => {
    render(
      <RopeArena
        leftScore={20}
        rightScore={80}
        phase="RUNNING"
      />
    );

    const arena = screen.getByTestId("rope-arena");
    expect(arena.getAttribute("aria-label")).toContain("Team Amber is leading");
    expect(arena.getAttribute("aria-label")).toContain("35% displacement");
  });

  it("applies hyper vibration and high tension in last 5 seconds", () => {
    render(
      <RopeArena
        leftScore={50}
        rightScore={48}
        phase="RUNNING"
        isLastFiveSec={true}
      />
    );

    const arena = screen.getByTestId("rope-arena");
    expect(arena.getAttribute("aria-label")).toContain("hyper maximum taut");
  });

  it("renders properly in FINISHED and RESULTS phase with winner", () => {
    const { rerender } = render(
      <RopeArena
        leftScore={100}
        rightScore={60}
        phase="FINISHED"
        winner="left"
      />
    );

    expect(screen.getByLabelText(/Cyber Titan athlete/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Solar Phoenix athlete/)).toBeInTheDocument();

    rerender(
      <RopeArena
        leftScore={60}
        rightScore={100}
        phase="RESULTS"
        winner="right"
      />
    );

    expect(screen.getByLabelText(/Solar Phoenix athlete/)).toBeInTheDocument();
  });

  it("scales correctly in projector mode", () => {
    render(
      <RopeArena
        leftScore={40}
        rightScore={40}
        phase="RUNNING"
        isProjector={true}
      />
    );

    const arena = screen.getByTestId("rope-arena");
    expect(arena).toBeInTheDocument();
  });
});

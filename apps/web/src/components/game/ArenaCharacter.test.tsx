import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArenaCharacter } from "./ArenaCharacter.js";

describe("ArenaCharacter Vector Rig & Animation Component", () => {
  it("renders Cyber Titan athlete for left team in idle state", () => {
    const { container } = render(<ArenaCharacter team="left" state="idle" />);
    const root = container.querySelector('[role="img"]');
    expect(root).toBeInTheDocument();
    expect(root?.getAttribute("aria-label")).toBe("Cyber Titan athlete");

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 130 150");
  });

  it("renders Solar Phoenix athlete for right team in pulling state", () => {
    const { container } = render(<ArenaCharacter team="right" state="pulling" />);
    const root = container.querySelector('[role="img"]');
    expect(root).toBeInTheDocument();
    expect(root?.getAttribute("aria-label")).toContain("Solar Phoenix");
    expect(root?.className).toContain("animate-char-heave-right");
  });

  it("renders losing state with tremor posture", () => {
    const { container } = render(<ArenaCharacter team="left" state="losing" />);
    const root = container.querySelector('[role="img"]');
    expect(root).toBeInTheDocument();
    expect(root?.className).toContain("animate-char-tremor");
    expect(root?.getAttribute("style")).toContain("rotate(9deg)");
  });

  it("renders won celebration state", () => {
    const { container } = render(<ArenaCharacter team="left" state="won" />);
    const root = container.querySelector('[role="img"]');
    expect(root).toBeInTheDocument();
    expect(root?.className).toContain("animate-char-celebrate");
  });

  it("renders lost slump state with slouched posture", () => {
    const { container } = render(<ArenaCharacter team="right" state="lost" />);
    const root = container.querySelector('[role="img"]');
    expect(root).toBeInTheDocument();
    expect(root?.getAttribute("style")).toContain("translateY(14px)");
  });

  it("renders paused stance", () => {
    const { container } = render(<ArenaCharacter team="left" state="paused" />);
    const root = container.querySelector('[role="img"]');
    expect(root).toBeInTheDocument();
    expect(root?.getAttribute("style")).toContain("rotate(-7deg)");
  });

  it("applies responsive scale and custom className correctly", () => {
    const { container } = render(<ArenaCharacter team="right" state="idle" scale={1.4} className="custom-test-class" />);
    const root = container.querySelector('[role="img"]');
    expect(root?.className).toContain("custom-test-class");
    expect(root?.getAttribute("style")).toContain("scale(1.4)");
  });
});

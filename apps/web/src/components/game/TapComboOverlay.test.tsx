import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TapComboOverlay, getComboTier } from "./TapComboOverlay.js";

describe("TapComboOverlay Component & Streak Engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates correct combo tier based on streak thresholds", () => {
    expect(getComboTier(0)).toBe("normal");
    expect(getComboTier(1)).toBe("normal");
    expect(getComboTier(4)).toBe("normal");
    expect(getComboTier(5)).toBe("combo");
    expect(getComboTier(9)).toBe("combo");
    expect(getComboTier(10)).toBe("turbo");
    expect(getComboTier(19)).toBe("turbo");
    expect(getComboTier(20)).toBe("overdrive");
    expect(getComboTier(50)).toBe("overdrive");
  });

  it("renders floating chip and shockwave rings on tap trigger", () => {
    const { rerender, container } = render(<TapComboOverlay lastTap={null} />);

    // Trigger normal pull tap
    rerender(
      <TapComboOverlay
        lastTap={{
          id: "tap_1",
          x: 150,
          y: 300,
          streak: 2,
          team: "left",
          timestamp: Date.now(),
        }}
      />
    );

    // Verify outer shockwave and chip are rendered
    const outerWaves = container.querySelectorAll(".animate-shockwave-outer");
    expect(outerWaves.length).toBe(1);

    const innerWaves = container.querySelectorAll(".animate-shockwave-inner");
    expect(innerWaves.length).toBe(1);
  });

  it("renders special turbo and overdrive styling at high combo streaks", () => {
    const { rerender, container } = render(<TapComboOverlay lastTap={null} />);

    // Trigger Overdrive tap (streak 20+)
    rerender(
      <TapComboOverlay
        lastTap={{
          id: "tap_overdrive",
          x: 200,
          y: 400,
          streak: 25,
          team: "right",
          timestamp: Date.now(),
        }}
      />
    );

    // Overdrive ping ring and aura should be present
    const pingRings = container.querySelectorAll(".animate-ping");
    expect(pingRings.length).toBeGreaterThanOrEqual(1);

    const overdriveAura = container.querySelectorAll(".animate-overdrive-aura");
    expect(overdriveAura.length).toBeGreaterThanOrEqual(1);
  });

  it("automatically cleans up expired particles and shockwaves to prevent memory leaks", () => {
    const { rerender, container } = render(<TapComboOverlay lastTap={null} />);

    rerender(
      <TapComboOverlay
        lastTap={{
          id: "tap_cleanup_test",
          x: 100,
          y: 200,
          streak: 6,
          team: "left",
          timestamp: Date.now(),
        }}
      />
    );

    expect(container.querySelectorAll(".animate-shockwave-outer").length).toBe(1);

    // Advance timers past shockwave TTL (550ms)
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(container.querySelectorAll(".animate-shockwave-outer").length).toBe(0);

    // Advance timers past chip TTL (850ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelectorAll("span").length).toBe(0);
  });

  it("caps maximum active particles to prevent performance degradation under rapid spam tapping", () => {
    const { rerender, container } = render(<TapComboOverlay lastTap={null} />);

    // Rapidly trigger 30 taps
    for (let i = 1; i <= 30; i++) {
      rerender(
        <TapComboOverlay
          lastTap={{
            id: `tap_spam_${i}`,
            x: 100 + i,
            y: 200 + i,
            streak: i,
            team: "left",
            timestamp: Date.now() + i,
          }}
        />
      );
    }

    // Number of chips in DOM should not exceed 20
    const chips = container.querySelectorAll(".animate-shockwave-outer");
    expect(chips.length).toBeLessThanOrEqual(15);
  });

  it("clears all pending timeout handles safely when unmounted", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { unmount, rerender } = render(<TapComboOverlay lastTap={null} />);

    rerender(
      <TapComboOverlay
        lastTap={{
          id: "tap_unmount",
          x: 150,
          y: 250,
          streak: 12,
          team: "left",
          timestamp: Date.now(),
        }}
      />
    );

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

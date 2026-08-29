import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerManager } from "./TimerManager.js";

describe("TimerManager — Server-Authoritative Timer & Scheduling", () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    timerManager = new TimerManager();
  });

  afterEach(() => {
    timerManager.dispose();
    vi.useRealTimers();
  });

  it("schedules countdown and fires callback on expiration", async () => {
    let fired = false;
    timerManager.scheduleCountdown("game_1", 3000, () => {
      fired = true;
    });

    expect(timerManager.isScheduled("game_1")).toBe(true);
    expect(fired).toBe(false);

    vi.advanceTimersByTime(2999);
    expect(fired).toBe(false);

    vi.advanceTimersByTime(2);
    expect(fired).toBe(true);
    expect(timerManager.isScheduled("game_1")).toBe(false);
  });

  it("schedules round finish and fires callback on exact endTime", async () => {
    let finished = false;
    const now = Date.now();
    const endTime = now + 30000;

    timerManager.scheduleRoundFinish("game_1", endTime, () => {
      finished = true;
    });

    expect(timerManager.isScheduled("game_1")).toBe(true);
    expect(finished).toBe(false);

    vi.advanceTimersByTime(29999);
    expect(finished).toBe(false);

    vi.advanceTimersByTime(2);
    expect(finished).toBe(true);
  });

  it("pauses timer and prevents callback from firing", async () => {
    let finished = false;
    const now = Date.now();
    const endTime = now + 30000;

    timerManager.scheduleRoundFinish("game_1", endTime, () => {
      finished = true;
    });

    vi.advanceTimersByTime(10000);
    timerManager.pause("game_1");
    expect(timerManager.isScheduled("game_1")).toBe(false);

    vi.advanceTimersByTime(30000);
    expect(finished).toBe(false);
  });

  it("resumes timer with extended endTime and fires on new schedule", async () => {
    let finished = false;
    const now = Date.now();
    const endTime = now + 30000;

    timerManager.scheduleRoundFinish("game_1", endTime, () => {
      finished = true;
    });

    // Run for 10s then pause for 5s
    vi.advanceTimersByTime(10000);
    timerManager.pause("game_1");

    vi.advanceTimersByTime(5000);
    const newEndTime = endTime + 5000;
    timerManager.resume("game_1", newEndTime, () => {
      finished = true;
    });

    // Advance 19.9s (should not be finished yet)
    vi.advanceTimersByTime(19900);
    expect(finished).toBe(false);

    // Advance 200ms (total 20.1s after resume)
    vi.advanceTimersByTime(200);
    expect(finished).toBe(true);
  });

  it("extends timer by adding seconds to active finish schedule", async () => {
    let finished = false;
    const now = Date.now();
    const endTime = now + 30000;

    timerManager.scheduleRoundFinish("game_1", endTime, () => {
      finished = true;
    });

    vi.advanceTimersByTime(20000);

    // Extend by +10s (new endTime is +10000)
    const extendedEndTime = endTime + 10000;
    timerManager.extend("game_1", extendedEndTime);

    // Advance past original endTime (10s later)
    vi.advanceTimersByTime(10001);
    expect(finished).toBe(false);

    // Advance remaining extension time
    vi.advanceTimersByTime(10000);
    expect(finished).toBe(true);
  });

  it("cancels timer and cleans up references without leaks", async () => {
    let finished = false;
    timerManager.scheduleRoundFinish("game_1", Date.now() + 10000, () => {
      finished = true;
    });

    timerManager.cancel("game_1");
    expect(timerManager.isScheduled("game_1")).toBe(false);

    vi.advanceTimersByTime(20000);
    expect(finished).toBe(false);
  });
});

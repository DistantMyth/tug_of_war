import { describe, expect, it } from "vitest";
import {
  ADMIN_EVENTS,
  ERROR_CODES,
  GAME_PHASES,
  PLAYER_EVENTS,
  TEAMS,
} from "./index.js";

describe("@tow/shared exports", () => {
  it("includes the full game phase set", () => {
    expect(GAME_PHASES).toEqual([
      "WAITING",
      "OPEN",
      "LOCKING",
      "BALANCING",
      "COUNTDOWN",
      "RUNNING",
      "PAUSED",
      "FINISHED",
      "RESULTS",
    ]);
  });

  it("exposes player and admin event names", () => {
    expect(PLAYER_EVENTS.tap).toBe("player:tap");
    expect(ADMIN_EVENTS.lock).toBe("admin:lock");
    expect(TEAMS).toEqual(["left", "right"]);
    expect(ERROR_CODES).toContain("INVALID_TRANSITION");
  });
});

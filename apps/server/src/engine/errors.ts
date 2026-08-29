import type { GamePhase } from "@tow/shared";
import type { GameTransitionResult } from "./types.js";

export function invalidTransition(from: GamePhase, to: GamePhase): GameTransitionResult {
  return {
    ok: false,
    error: {
      code: "INVALID_TRANSITION",
      message: `Cannot transition from ${from} to ${to}`,
    },
  };
}

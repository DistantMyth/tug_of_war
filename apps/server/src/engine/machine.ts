import type { GamePhase } from "@tow/shared";

const NORMAL_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  WAITING: ["OPEN"],
  OPEN: ["LOCKING"],
  LOCKING: ["BALANCING", "COUNTDOWN"],
  BALANCING: ["COUNTDOWN", "OPEN"],
  COUNTDOWN: ["RUNNING"],
  RUNNING: ["PAUSED", "FINISHED"],
  PAUSED: ["RUNNING", "FINISHED"],
  FINISHED: ["RESULTS"],
  RESULTS: ["COUNTDOWN", "BALANCING", "WAITING"],
};

export function allowedNormalTargets(from: GamePhase): readonly GamePhase[] {
  return NORMAL_TRANSITIONS[from];
}

export function isEmergencyReset(to: GamePhase): boolean {
  return to === "WAITING";
}

export function canTransition(from: GamePhase, to: GamePhase, emergency = false): boolean {
  if (emergency) {
    return isEmergencyReset(to);
  }
  return NORMAL_TRANSITIONS[from].includes(to);
}

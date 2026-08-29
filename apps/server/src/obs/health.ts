import type { GamePhase } from "@tow/shared";

export type DependencyStatus = "ok" | "down" | "not_configured";

export type HealthReport = {
  ok: boolean;
  redis: DependencyStatus;
  mongo: DependencyStatus;
  phase: GamePhase | null;
  connections: number;
  uptime: number;
};

export function buildHealthReport(input: {
  redis: DependencyStatus;
  mongo: DependencyStatus;
  phase: GamePhase | null;
  connections: number;
  uptime: number;
}): HealthReport {
  const ok = input.redis !== "down" && input.mongo !== "down";
  return {
    ok,
    redis: input.redis,
    mongo: input.mongo,
    phase: input.phase,
    connections: input.connections,
    uptime: Math.floor(input.uptime),
  };
}

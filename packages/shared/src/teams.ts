export const TEAMS = ["left", "right"] as const;

export type TeamId = (typeof TEAMS)[number];

export type PlayerRole = TeamId | "chaos";

export type PlayerStatus = "online" | "offline" | "abandoned";

export type Winner = TeamId | "draw";

export type FinishReason = "timer" | "admin_end" | "emergency";

import { create } from "zustand";
import type {
  BalancePlanView,
  DisplaySyncPayload,
  ExtendSeconds,
  FinishedEventPayload,
  GameCounts,
  GamePhase,
  ScoreView,
  SyncPayload,
  TimingView,
  Winner,
} from "@tow/shared";

interface GameState {
  gameId: string | null;
  phase: GamePhase;
  roundNumber: number;
  counts: GameCounts;
  scores: ScoreView;
  timing: TimingView;
  balancePlan: BalancePlanView | null;
  winner: Winner | null;
  wildcard: { playerId: string; label: string } | null;
  lastMove: { playerId: string; from: string; to: string; remainingLeftToRight: number; remainingRightToLeft: number } | null;
  extensionBanner: { seconds: ExtendSeconds; at: number } | null;

  setPhase: (phase: GamePhase) => void;
  setCounts: (counts: GameCounts) => void;
  setScores: (scores: ScoreView) => void;
  setTiming: (timing: TimingView) => void;
  setBalancePlan: (plan: BalancePlanView | null) => void;
  setWildcard: (wildcard: { playerId: string; label: string } | null) => void;
  setBalanceMove: (move: any) => void;
  setFinished: (data: FinishedEventPayload) => void;
  setExtended: (seconds: ExtendSeconds, endTime: number, serverNow: number) => void;
  setPaused: (pausedAt: number) => void;
  setResumed: (resumedAt: number, endTime: number) => void;
  setRound: (roundNumber: number) => void;
  setCountdown: (endsAt: number, durationMs: number) => void;
  applySync: (sync: SyncPayload | DisplaySyncPayload) => void;
  resetGame: () => void;
}

const initialCounts: GameCounts = {
  total: 0,
  left: 0,
  right: 0,
  chaos: 0,
  online: 0,
  offline: 0,
};

const initialScores: ScoreView = {
  left: 0,
  right: 0,
  seq: 0,
  at: Date.now(),
};

const initialTiming: TimingView = {
  durationMs: 30000,
  startTime: null,
  endTime: null,
  pausedAt: null,
  pauseAccumMs: 0,
  countdownEndsAt: null,
  serverNow: Date.now(),
};

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  phase: "WAITING",
  roundNumber: 1,
  counts: initialCounts,
  scores: initialScores,
  timing: initialTiming,
  balancePlan: null,
  winner: null,
  wildcard: null,
  lastMove: null,
  extensionBanner: null,

  setPhase: (phase) => set((state) => ({ phase, winner: phase === "COUNTDOWN" || phase === "OPEN" ? null : state.winner })),
  setCounts: (counts) => set({ counts }),
  setScores: (scores) => set({ scores }),
  setTiming: (timing) => set({ timing }),
  setBalancePlan: (balancePlan) => set({ balancePlan }),
  setWildcard: (wildcard) => set({ wildcard }),
  setBalanceMove: (move) => set({ lastMove: move }),

  setFinished: (data) =>
    set({
      phase: "FINISHED",
      winner: data.winner,
      roundNumber: data.roundNumber,
      scores: {
        left: data.left,
        right: data.right,
        seq: data.left + data.right,
        at: Date.now(),
      },
    }),

  setExtended: (seconds, endTime, serverNow) =>
    set((state) => ({
      extensionBanner: { seconds, at: Date.now() },
      timing: {
        ...state.timing,
        endTime,
        serverNow,
      },
    })),

  setPaused: (pausedAt) =>
    set((state) => ({
      phase: "PAUSED",
      timing: {
        ...state.timing,
        pausedAt,
      },
    })),

  setResumed: (_resumedAt, endTime) =>
    set((state) => ({
      phase: "RUNNING",
      timing: {
        ...state.timing,
        endTime,
        pausedAt: null,
      },
    })),

  setRound: (roundNumber) =>
    set({
      roundNumber,
      winner: null,
      scores: { left: 0, right: 0, seq: 0, at: Date.now() },
    }),

  setCountdown: (endsAt, durationMs) =>
    set((state) => ({
      phase: "COUNTDOWN",
      winner: null,
      timing: {
        ...state.timing,
        durationMs,
        countdownEndsAt: endsAt,
        startTime: null,
        endTime: null,
      },
    })),

  applySync: (sync) =>
    set((state) => {
      // Support both `public` (correct per SyncPayload type) and the legacy `publicState` key.
      // The server now emits `public`, but this fallback prevents silent failures
      // if any legacy payload makes it through.
      const publicState = (sync as any).public ?? (sync as any).publicState;
      if (!publicState) return state; // Guard: don't wipe state on malformed payload
      return {
        gameId: publicState.sessionId ?? state.gameId,
        phase: (publicState.phase as GamePhase) ?? state.phase,
        roundNumber: publicState.roundNumber ?? state.roundNumber,
        counts: publicState.counts ?? state.counts,
        scores: publicState.scores ?? state.scores,
        timing: publicState.timing ?? state.timing,
        balancePlan: publicState.plan ?? state.balancePlan,
        winner: publicState.winner ?? state.winner,
      };
    }),


  resetGame: () =>
    set({
      gameId: null,
      phase: "WAITING",
      roundNumber: 1,
      counts: initialCounts,
      scores: initialScores,
      timing: initialTiming,
      balancePlan: null,
      winner: null,
      wildcard: null,
      lastMove: null,
      extensionBanner: null,
    }),
}));

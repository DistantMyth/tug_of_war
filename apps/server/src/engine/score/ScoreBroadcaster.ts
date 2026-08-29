import type { ScoreView } from "@tow/shared";
import { SCORE_BROADCAST_HZ } from "@tow/shared";
import { logger } from "../../obs/logger.js";

export type ScoreBroadcastEmitter = (gameId: string, score: ScoreView) => void;

type GameScoreState = {
  left: number;
  right: number;
  seq: number;
  lastBroadcastSeq: number;
  dirty: boolean;
  interval?: NodeJS.Timeout;
};

export class ScoreBroadcaster {
  private games = new Map<string, GameScoreState>();
  private intervalMs: number;

  constructor(
    private emitter: ScoreBroadcastEmitter,
    hz = SCORE_BROADCAST_HZ,
  ) {
    this.intervalMs = Math.round(1000 / hz);
  }

  /**
   * Ingest an authoritative score increment from Redis INCR.
   */
  recordTap(
    gameId: string,
    scores: { left: number; right: number },
    seq: number,
  ): void {
    let state = this.games.get(gameId);
    if (!state) {
      state = {
        left: scores.left,
        right: scores.right,
        seq,
        lastBroadcastSeq: -1,
        dirty: true,
      };
      this.games.set(gameId, state);
      this.startBroadcastLoop(gameId);
    } else {
      state.left = scores.left;
      state.right = scores.right;
      state.seq = seq;
      state.dirty = true;
      if (!state.interval) {
        this.startBroadcastLoop(gameId);
      }
    }
  }

  private startBroadcastLoop(gameId: string): void {
    const state = this.games.get(gameId);
    if (!state || state.interval) return;

    state.interval = setInterval(() => {
      this.tick(gameId);
    }, this.intervalMs);
  }

  private tick(gameId: string): void {
    const state = this.games.get(gameId);
    if (!state) return;

    if (state.dirty && state.seq !== state.lastBroadcastSeq) {
      const payload: ScoreView = {
        left: state.left,
        right: state.right,
        seq: state.seq,
        at: Date.now(),
      };
      state.lastBroadcastSeq = state.seq;
      state.dirty = false;

      try {
        this.emitter(gameId, payload);
      } catch (err) {
        logger.error("score_broadcast_error", { gameId, error: String(err) });
      }
    }
  }

  /**
   * Flush final exact score immediately (e.g. on round finish) and stop interval.
   */
  flush(
    gameId: string,
    exact?: { left: number; right: number; seq: number },
  ): ScoreView {
    const state = this.games.get(gameId);
    const left = exact?.left ?? state?.left ?? 0;
    const right = exact?.right ?? state?.right ?? 0;
    const seq = exact?.seq ?? state?.seq ?? left + right;

    const payload: ScoreView = {
      left,
      right,
      seq,
      at: Date.now(),
    };

    if (state) {
      state.left = left;
      state.right = right;
      state.seq = seq;
      state.lastBroadcastSeq = seq;
      state.dirty = false;
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = undefined;
      }
    }

    try {
      this.emitter(gameId, payload);
    } catch (err) {
      logger.error("score_flush_broadcast_error", { gameId, error: String(err) });
    }

    logger.info("scores_flushed", { gameId, left, right, seq });
    return payload;
  }

  /**
   * Stop interval for gameId.
   */
  stop(gameId: string): void {
    const state = this.games.get(gameId);
    if (state?.interval) {
      clearInterval(state.interval);
      state.interval = undefined;
    }
  }

  /**
   * Reset/clear scores for a new round.
   */
  reset(gameId: string): void {
    this.stop(gameId);
    this.games.delete(gameId);
  }

  /**
   * Dispose all broadcaster intervals.
   */
  dispose(): void {
    for (const [gameId, state] of this.games.entries()) {
      if (state.interval) {
        clearInterval(state.interval);
      }
      logger.info("score_broadcaster_disposed", { gameId });
    }
    this.games.clear();
  }
}

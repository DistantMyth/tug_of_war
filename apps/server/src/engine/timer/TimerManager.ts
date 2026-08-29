import { logger } from "../../obs/logger.js";

export type ScheduledTimerType = "countdown" | "round";

export type ScheduledTimer = {
  gameId: string;
  type: ScheduledTimerType;
  handle: NodeJS.Timeout;
  endsAt: number;
  onExpire: () => Promise<void> | void;
};

export class TimerManager {
  private activeTimers = new Map<string, ScheduledTimer>();

  /**
   * Schedule countdown timer for a game session.
   */
  scheduleCountdown(
    gameId: string,
    durationMs: number,
    onExpire: () => Promise<void> | void,
  ): void {
    this.cancel(gameId);

    const endsAt = Date.now() + durationMs;
    const handle = setTimeout(async () => {
      this.activeTimers.delete(gameId);
      try {
        await onExpire();
      } catch (err) {
        logger.error("timer_countdown_expire_error", { gameId, error: String(err) });
      }
    }, Math.max(0, durationMs));

    this.activeTimers.set(gameId, {
      gameId,
      type: "countdown",
      handle,
      endsAt,
      onExpire,
    });

    logger.info("timer_countdown_scheduled", { gameId, durationMs, endsAt });
  }

  /**
   * Schedule round finish timer based on server-authoritative endTime.
   */
  scheduleRoundFinish(
    gameId: string,
    endTime: number,
    onExpire: () => Promise<void> | void,
  ): void {
    this.cancel(gameId);

    const now = Date.now();
    const delayMs = Math.max(0, endTime - now);

    const handle = setTimeout(async () => {
      this.activeTimers.delete(gameId);
      try {
        await onExpire();
      } catch (err) {
        logger.error("timer_round_finish_expire_error", { gameId, error: String(err) });
      }
    }, delayMs);

    this.activeTimers.set(gameId, {
      gameId,
      type: "round",
      handle,
      endsAt: endTime,
      onExpire,
    });

    logger.info("timer_round_finish_scheduled", { gameId, delayMs, endsAt: endTime });
  }

  /**
   * Pause active round timer (clears timeout handle).
   */
  pause(gameId: string): void {
    const existing = this.activeTimers.get(gameId);
    if (existing) {
      clearTimeout(existing.handle);
      this.activeTimers.delete(gameId);
      logger.info("timer_paused", { gameId });
    }
  }

  /**
   * Resume round timer with updated endTime.
   */
  resume(
    gameId: string,
    newEndTime: number,
    onExpire: () => Promise<void> | void,
  ): void {
    this.scheduleRoundFinish(gameId, newEndTime, onExpire);
    logger.info("timer_resumed", { gameId, newEndTime });
  }

  /**
   * Extend active round timer with new endTime.
   */
  extend(
    gameId: string,
    newEndTime: number,
    onExpire?: () => Promise<void> | void,
  ): void {
    const existing = this.activeTimers.get(gameId);
    const callback = onExpire ?? existing?.onExpire;
    if (callback) {
      this.scheduleRoundFinish(gameId, newEndTime, callback);
      logger.info("timer_extended", { gameId, newEndTime });
    }
  }

  /**
   * Cancel and clear any timer for gameId.
   */
  cancel(gameId: string): void {
    const existing = this.activeTimers.get(gameId);
    if (existing) {
      clearTimeout(existing.handle);
      this.activeTimers.delete(gameId);
      logger.info("timer_cancelled", { gameId, type: existing.type });
    }
  }

  /**
   * Check if a timer is actively scheduled for gameId.
   */
  isScheduled(gameId: string): boolean {
    return this.activeTimers.has(gameId);
  }

  /**
   * Get active timer details.
   */
  getTimer(gameId: string): ScheduledTimer | undefined {
    return this.activeTimers.get(gameId);
  }

  /**
   * Dispose all active timers.
   */
  dispose(): void {
    for (const [gameId, timer] of this.activeTimers.entries()) {
      clearTimeout(timer.handle);
      logger.info("timer_disposed", { gameId });
    }
    this.activeTimers.clear();
  }
}

import { logger } from "../../obs/logger.js";
import type { MongoClientService } from "./client.js";
import type {
  AuditEventDocument,
  PlayerDocument,
  RoundDocument,
  SessionDocument,
} from "./types.js";

export type PersistenceTaskType =
  | "SESSION_CREATED"
  | "SESSION_ENDED"
  | "PLAYER_ROSTER"
  | "ROUND_COMPLETED"
  | "AUDIT_EVENT";

export interface QueuedPersistenceTask {
  id: string;
  type: PersistenceTaskType;
  execute: () => Promise<void>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  createdAt: number;
  description: string;
}

export interface PersistenceMetrics {
  queueLength: number;
  inFlightCount: number;
  retryingCount: number;
  deferredCount: number;
  permanentlyFailedCount: number;
  totalErrors: number;
  totalPersisted: number;
}

export interface PersistenceServiceOptions {
  maxAttempts?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_INITIAL_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 8000;

export class MongoPersistenceService {
  private queue: QueuedPersistenceTask[] = [];
  private currentProcessingPromise: Promise<void> | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private inFlight = 0;

  // Metrics
  private totalErrors = 0;
  private totalPersisted = 0;
  private permanentlyFailedCount = 0;

  private readonly maxAttempts: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(
    private readonly mongoClient: MongoClientService,
    options?: PersistenceServiceOptions,
  ) {
    this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.initialBackoffMs = options?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.maxBackoffMs = options?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  }

  private enqueue(type: PersistenceTaskType, description: string, execute: () => Promise<void>): void {
    if (this.isShuttingDown) {
      logger.warn("persistence_enqueue_rejected_shutting_down", { type, description });
      return;
    }

    const task: QueuedPersistenceTask = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      execute,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      description,
    };

    this.queue.push(task);
    this.scheduleProcessing(0);
  }

  private scheduleProcessing(delayMs = 0): void {
    if (this.isShuttingDown && this.queue.length === 0) return;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.triggerProcessing();
    }, Math.max(0, delayMs));
  }

  private triggerProcessing(): Promise<void> {
    if (!this.currentProcessingPromise) {
      this.currentProcessingPromise = this.processQueue().finally(() => {
        this.currentProcessingPromise = null;
        if (this.queue.length > 0 && !this.isShuttingDown) {
          const now = Date.now();
          const nextEligible = Math.min(...this.queue.map((t) => t.nextAttemptAt));
          const delay = Math.max(200, nextEligible - now);
          this.scheduleProcessing(delay);
        }
      });
    }
    return this.currentProcessingPromise;
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    // Check if Mongo is connected
    const health = this.mongoClient.getHealth();
    if (health.status === "disabled") {
      this.queue = [];
      return;
    }
    if (health.status !== "connected") {
      logger.info("persistence_deferred_mongo_offline", {
        queueLength: this.queue.length,
        mongoStatus: health.status,
      });
      // Do not discard! Tasks remain queued. Check again in 1000ms.
      this.scheduleProcessing(1000);
      return;
    }

    const now = Date.now();
    const tasksToProcess = this.queue.filter((t) => t.nextAttemptAt <= now);
    if (tasksToProcess.length === 0) return;

    for (const task of tasksToProcess) {
      this.inFlight++;
      try {
        await task.execute();
        this.totalPersisted++;

        // Successfully completed: remove from queue
        const idx = this.queue.indexOf(task);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
      } catch (err) {
        this.totalErrors++;
        task.attempts++;

        if (task.attempts >= task.maxAttempts) {
          this.permanentlyFailedCount++;
          logger.error("persistence_task_permanently_failed", {
            taskId: task.id,
            type: task.type,
            attempts: task.attempts,
            error: String(err),
            description: task.description,
          });
          // Remove exhausted task
          const idx = this.queue.indexOf(task);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
        } else {
          const backoff = Math.min(
            this.initialBackoffMs * Math.pow(2, task.attempts - 1),
            this.maxBackoffMs,
          );
          task.nextAttemptAt = Date.now() + backoff;
          logger.warn("persistence_task_deferred_retry", {
            taskId: task.id,
            type: task.type,
            attempt: task.attempts,
            nextAttemptInMs: backoff,
            error: String(err),
          });
        }
      } finally {
        this.inFlight--;
      }
    }
  }

  persistSessionCreated(session: SessionDocument): void {
    this.enqueue("SESSION_CREATED", `session:${session.sessionId}`, async () => {
      const col = this.mongoClient.getSessionsCollection();
      await col.updateOne(
        { sessionId: session.sessionId },
        { $set: session },
        { upsert: true },
      );
      logger.info("session_persisted", { sessionId: session.sessionId });
    });
  }

  persistSessionEnded(sessionId: string, endedAt: number): void {
    this.enqueue("SESSION_ENDED", `session_end:${sessionId}`, async () => {
      const col = this.mongoClient.getSessionsCollection();
      await col.updateOne(
        { sessionId },
        { $set: { status: "finished", endedAt } },
      );
      logger.info("session_ended_persisted", { sessionId, endedAt });
    });
  }

  persistPlayerRoster(sessionId: string, players: PlayerDocument[]): void {
    if (!players || players.length === 0) return;
    this.enqueue("PLAYER_ROSTER", `roster:${sessionId}:${players.length}`, async () => {
      const col = this.mongoClient.getPlayersCollection();
      const operations = players.map((p) => ({
        updateOne: {
          filter: { sessionId, playerId: p.playerId },
          update: { $set: p },
          upsert: true,
        },
      }));
      await col.bulkWrite(operations, { ordered: false });
      logger.info("player_roster_persisted", { sessionId, count: players.length });
    });
  }

  persistRoundCompleted(round: RoundDocument): void {
    this.enqueue(
      "ROUND_COMPLETED",
      `round:${round.sessionId}:r${round.roundNumber}`,
      async () => {
        const col = this.mongoClient.getRoundsCollection();
        await col.updateOne(
          { sessionId: round.sessionId, roundNumber: round.roundNumber },
          { $set: round },
          { upsert: true },
        );
        logger.info("round_completed_persisted", {
          sessionId: round.sessionId,
          roundNumber: round.roundNumber,
          winner: round.winner,
        });
      },
    );
  }

  persistAuditEvent(event: AuditEventDocument): void {
    this.enqueue("AUDIT_EVENT", `audit:${event.sessionId}:${event.eventType}`, async () => {
      const col = this.mongoClient.getAuditCollection();
      await col.updateOne(
        {
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          eventType: event.eventType,
        },
        { $setOnInsert: event },
        { upsert: true },
      );
    });
  }

  getMetrics(): PersistenceMetrics {
    const now = Date.now();
    const retrying = this.queue.filter((t) => t.attempts > 0).length;
    const deferred = this.queue.filter((t) => t.nextAttemptAt > now).length;

    return {
      queueLength: this.queue.length,
      inFlightCount: this.inFlight,
      retryingCount: retrying,
      deferredCount: deferred,
      permanentlyFailedCount: this.permanentlyFailedCount,
      totalErrors: this.totalErrors,
      totalPersisted: this.totalPersisted,
    };
  }

  getErrorCount(): number {
    return this.totalErrors;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  async flush(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.queue.length > 0 && Date.now() - start < timeoutMs) {
      const health = this.mongoClient.getHealth();
      if (health.status !== "connected") {
        break;
      }
      // Force immediate processing
      for (const t of this.queue) {
        t.nextAttemptAt = 0;
      }
      const p = this.triggerProcessing();
      await p;
      if (this.currentProcessingPromise) {
        await this.currentProcessingPromise;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    await this.flush(3000);
  }
}

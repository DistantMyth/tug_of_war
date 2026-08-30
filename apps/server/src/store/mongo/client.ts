import { type Collection, type Db, MongoClient } from "mongodb";
import { logger } from "../../obs/logger.js";
import type {
  AuditEventDocument,
  PlayerDocument,
  RoundDocument,
  SessionDocument,
} from "./types.js";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

export class MongoClientService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;
  // FIX #7: bounded reconnect state
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private closed = false;

  constructor(private readonly uri?: string, private readonly dbName = "tug_of_war") {}

  async connect(): Promise<boolean> {
    if (!this.uri) {
      logger.info("mongodb_disabled_no_uri");
      return false;
    }

    try {
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;
      this.reconnectAttempt = 0; // reset on success

      await this.ensureIndexes();
      logger.info("mongodb_connected", { dbName: this.dbName });
      return true;
    } catch (err) {
      this.isConnected = false;
      logger.warn("mongodb_connect_warning", { error: String(err) });
      // FIX #7: schedule reconnect with backoff (non-blocking — caller gets false immediately)
      this.scheduleReconnect();
      return false;
    }
  }

  // FIX #7: exponential backoff reconnect scheduler
  private scheduleReconnect(): void {
    if (this.closed || !this.uri) return;
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn("mongodb_reconnect_exhausted", { attempts: MAX_RECONNECT_ATTEMPTS });
      return;
    }
    if (this.retryTimer !== null) return; // guard: only one pending timer at a time

    const delayMs = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt++;

    logger.info("mongodb_reconnect_scheduled", {
      attempt: this.reconnectAttempt,
      delayMs,
    });

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (this.closed) return;
      try {
        // close previous client if any
        if (this.client) {
          try { await this.client.close(); } catch {}
          this.client = null;
          this.db = null;
        }
        const ok = await this.connect();
        if (!ok && !this.closed && this.reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
          // connect() already called scheduleReconnect() on failure — nothing more to do here
        }
      } catch (err) {
        logger.warn("mongodb_reconnect_attempt_error", { error: String(err) });
        this.scheduleReconnect();
      }
    }, delayMs);
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;
    try {
      await Promise.all([
        this.getSessionsCollection().createIndex({ sessionId: 1 }, { unique: true }),
        this.getPlayersCollection().createIndex({ sessionId: 1, playerId: 1 }, { unique: true }),
        this.getRoundsCollection().createIndex({ sessionId: 1, roundNumber: 1 }, { unique: true }),
        this.getAuditCollection().createIndex({ sessionId: 1, timestamp: 1 }),
      ]);
      logger.info("mongodb_indexes_ensured");
    } catch (err) {
      logger.warn("mongodb_index_creation_warning", { error: String(err) });
    }
  }

  getSessionsCollection(): Collection<SessionDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<SessionDocument>("sessions");
  }

  getPlayersCollection(): Collection<PlayerDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<PlayerDocument>("players");
  }

  getRoundsCollection(): Collection<RoundDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<RoundDocument>("rounds");
  }

  getAuditCollection(): Collection<AuditEventDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<AuditEventDocument>("audit_events");
  }

  getHealth(): { status: "connected" | "disconnected" | "disabled" } {
    if (!this.uri) return { status: "disabled" };
    return { status: this.isConnected ? "connected" : "disconnected" };
  }

  async close(): Promise<void> {
    this.closed = true;
    // FIX #7: cancel any pending reconnect timer
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info("mongodb_closed");
    }
  }
}
